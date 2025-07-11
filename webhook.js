const axios = require('axios');
const crypto = require('crypto');
const proxyManager = require('./proxy-manager');
const gemini = require('./gemini');

// Configuration
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT = 5000;

// Vérification de la signature webhook
const verifySignature = (req) => {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;
  
  const hmac = crypto.createHmac('sha256', process.env.APP_SECRET);
  const expectedSignature = `sha256=${hmac.update(JSON.stringify(req.body)).digest('hex')}`;
  
  return crypto.timingSafeEqual(
    Buffer.from(signature), 
    Buffer.from(expectedSignature)
  );
};

// Gestionnaire principal du webhook
const handleWebhook = async (req, res) => {
  try {
    // Vérification de sécurité (optionnelle en mode contournement)
    if (process.env.NODE_ENV === 'production' && !verifySignature(req)) {
      console.warn('Invalid signature - processing anyway in bypass mode');
    }

    if (req.body.object !== 'page') {
      return res.status(400).send('Invalid request format');
    }

    await Promise.all(req.body.entry.map(processEntry));
    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).send('SERVER_ERROR');
  }
};

// Traitement d'une entrée individuelle
const processEntry = async (entry) => {
  for (const event of entry.messaging) {
    try {
      if (event.postback?.payload === 'GET_STARTED') {
        await sendWelcomeMessage(event.sender.id);
      } else if (event.message?.text) {
        await processUserMessage(event);
      }
      // Ajouter d'autres types d'événements ici
    } catch (error) {
      console.error('Error processing event:', error);
      await sendErrorMessage(event.sender.id);
    }
  }
};

// Envoi du message de bienvenue
const sendWelcomeMessage = async (senderId) => {
  const message = {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements: [{
          title: "Bienvenue sur Amani Chat! 🌍",
          image_url: `${process.env.BASE_URL}/images/welcome.jpg`,
          subtitle: "Je suis votre assistant africain intelligent. Comment puis-je vous aider?",
          buttons: [
            {
              type: "postback",
              title: "Options",
              payload: "SHOW_OPTIONS"
            },
            {
              type: "web_url",
              title: "Visitez notre site",
              url: "https://example.com"
            }
          ]
        }]
      }
    }
  };

  await sendWithFallback(senderId, message);
};

// Traitement des messages utilisateur
const processUserMessage = async (event) => {
  try {
    const responseText = await gemini.generateContent(event.message.text);
    await sendWithFallback(event.sender.id, { text: responseText });
  } catch (error) {
    console.error('Gemini processing error:', error);
    await sendErrorMessage(event.sender.id);
  }
};

// Système d'envoi avec fallback proxy/direct
const sendWithFallback = async (recipientId, message, retries = MAX_RETRIES) => {
  const payload = {
    recipient: { id: recipientId },
    message: message,
    messaging_type: "RESPONSE"
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Essayer d'abord avec proxy
      if (attempt === 1) {
        return await proxyManager.sendRequest(payload);
      } 
      // Fallback direct
      else {
        return await sendDirect(payload);
      }
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

// Envoi direct à l'API Facebook
const sendDirect = async (payload) => {
  try {
    const response = await axios.post(
      'https://graph.facebook.com/v19.0/me/messages',
      payload,
      {
        params: { access_token: process.env.PAGE_ACCESS_TOKEN },
        timeout: REQUEST_TIMEOUT,
        headers: {
          'X-Forwarded-For': proxyManager.generateRandomIP(),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Direct send failed:', error.response?.data || error.message);
    throw error;
  }
};

// Envoi de message d'erreur
const sendErrorMessage = async (senderId) => {
  const errorMessage = {
    text: "Désolé, je rencontre des difficultés techniques. Veuillez réessayer plus tard. 🕊️"
  };
  
  try {
    await sendDirect({
      recipient: { id: senderId },
      message: errorMessage,
      messaging_type: "RESPONSE"
    });
  } catch (fallbackError) {
    console.error('Even error message failed to send:', fallbackError);
  }
};

// Vérification du webhook pour Facebook
const verifyWebhook = (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === process.env.VERIFY_TOKEN) {
    console.log('Webhook verified');
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error('Verification failed');
    res.sendStatus(403);
  }
};

module.exports = {
  handleWebhook,
  verifyWebhook
};
