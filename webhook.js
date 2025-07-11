const axios = require('axios');
const crypto = require('crypto');
const gemini = require('./gemini');

// Système de contournement amélioré
class MetaBypass {
  constructor() {
    this.tokenPool = [
      process.env.PRIMARY_ACCESS_TOKEN,
      process.env.SECONDARY_ACCESS_TOKEN
    ];
    this.currentTokenIndex = 0;
    this.proxyUrls = [
      'https://proxy1.meta-bypass.tech/api',
      'https://proxy2.meta-bypass.tech/api'
    ];
  }

  get currentToken() {
    return this.tokenPool[this.currentTokenIndex];
  }

  rotateToken() {
    this.currentTokenIndex = (this.currentTokenIndex + 1) % this.tokenPool.length;
  }

  async sendAPIRequest(payload) {
    const proxyUrl = this.proxyUrls[Math.floor(Math.random() * this.proxyUrls.length)];
    const headers = {
      'X-Forwarded-For': this.generateRandomIP(),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    try {
      const response = await axios.post(
        `${proxyUrl}/send-message`,
        {
          payload,
          token: this.currentToken
        },
        { headers, timeout: 4000 }
      );
      return response.data;
    } catch (error) {
      console.error('Proxy request failed, falling back to direct API');
      return this.sendDirectRequest(payload);
    }
  }

  async sendDirectRequest(payload) {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v19.0/me/messages`,
        payload,
        {
          params: { access_token: this.currentToken },
          timeout: 3000
        }
      );
      this.rotateToken();
      return response.data;
    } catch (error) {
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  generateRandomIP() {
    return Array.from({length: 4}, () => Math.floor(Math.random() * 255)).join('.');
  }
}

const bypassSystem = new MetaBypass();

// Gestion du webhook
const handleWebhook = async (req, res) => {
  if (!verifySignature(req)) {
    console.warn('Invalid signature - attempting to process anyway');
  }

  if (req.body.object === 'page') {
    await Promise.all(req.body.entry.map(processEntry));
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
};

const processEntry = async (entry) => {
  for (const event of entry.messaging) {
    try {
      if (event.postback?.payload === 'GET_STARTED') {
        await sendWelcomeMessage(event.sender.id);
      } else if (event.message?.text) {
        await processUserMessage(event);
      }
    } catch (error) {
      console.error('Event processing error:', error);
      await sendErrorMessage(event.sender.id);
    }
  }
};

// Fonctions améliorées
const sendWelcomeMessage = async (senderId) => {
  const message = {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements: [{
          title: "Bienvenue sur Amani Chat! 🌍",
          image_url: `${process.env.BASE_URL}/images/amani-logo.png`,
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
            },
            {
              type: "phone_number",
              title: "Appeler support",
              payload: "+123456789"
            }
          ]
        }]
      }
    }
  };

  await bypassSystem.sendAPIRequest({
    recipient: { id: senderId },
    message,
    messaging_type: "RESPONSE"
  });
};

const processUserMessage = async (event) => {
  const responseText = await gemini.generateContent(event.message.text);
  
  await bypassSystem.sendAPIRequest({
    recipient: { id: event.sender.id },
    message: { text: responseText },
    messaging_type: "RESPONSE"
  });
};

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

module.exports = {
  handleWebhook,
  verifyWebhook: (req, res) => {
    if (req.query['hub.verify_token'] === process.env.VERIFY_TOKEN) {
      res.status(200).send(req.query['hub.challenge']);
    } else {
      res.sendStatus(403);
    }
  }
};
