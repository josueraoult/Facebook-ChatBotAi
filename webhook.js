const axios = require('axios');
const gemini = require('./gemini');

const handleWebhook = async (req, res) => {
  if (req.body.object === 'page') {
    for (const entry of req.body.entry) {
      for (const event of entry.messaging) {
        try {
          // Gestion du message de bienvenue
          if (event.postback && event.postback.payload === 'GET_STARTED') {
            await sendWelcomeMessage(event.sender.id);
            continue;
          }

          // Réponse aux messages texte
          if (event.message && event.message.text) {
            const response = await processMessage(event);
            await sendMessage(event.sender.id, response);
          }
        } catch (error) {
          console.error('Error processing message:', error);
          await sendErrorMessage(event.sender.id);
        }
      }
    }
    res.status(200).end();
  } else {
    res.sendStatus(404);
  }
};

const sendWelcomeMessage = async (senderId) => {
  const message = {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements: [{
          title: "Bienvenue sur Amani Chat! 🌍",
          image_url: "https://chatbot-amani.vercel.app/images/amani-logo.png",
          subtitle: "Je suis votre assistant africain intelligent. Comment puis-je vous aider?",
          buttons: [
            {
              type: "postback",
              title: "Options",
              payload: "SHOW_OPTIONS"
            },
            {
              type: "web_url",
              title: "Notre Site",
              url: "https://example.com",
              webview_height_ratio: "full"
            }
          ]
        }]
      }
    }
  };

  await callSendAPI(senderId, message);
};

const processMessage = async (event) => {
  try {
    // Optimisation: Cache simple pour les requêtes fréquentes
    const cacheKey = event.message.text.trim().toLowerCase();
    if (cache[cacheKey]) return cache[cacheKey];

    const response = await gemini.generateContent(event.message.text);
    
    // Cache la réponse pour 5 minutes
    cache[cacheKey] = response;
    setTimeout(() => delete cache[cacheKey], 300000);
    
    return response;
  } catch (error) {
    console.error('Error processing with Gemini:', error);
    return "Désolé, je rencontre des difficultés techniques. Veuillez réessayer plus tard. 🕊️";
  }
};

const cache = {};

const callSendAPI = async (senderId, message) => {
  try {
    const startTime = Date.now();
    const response = await axios.post(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: senderId },
        message: message,
        messaging_type: "RESPONSE"
      },
      { timeout: 5000 } // Timeout de 5 secondes
    );
    
    console.log(`Message delivered in ${Date.now() - startTime}ms`);
    return response.data;
  } catch (error) {
    console.error('Error sending message:', {
      error: error.response?.data || error.message,
      recipient: senderId,
      message: message
    });
    throw error;
  }
};

module.exports = {
  handleWebhook,
  verifyWebhook
};
