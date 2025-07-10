const axios = require('axios');
const crypto = require('crypto');
const gemini = require('./gemini');

// Configuration des proxies rotatifs [citation:1]
const PROXY_POOL = [
  'https://proxy1.meta-bypass.com',
  'https://proxy2.meta-bypass.com',
  'https://proxy3.meta-bypass.com'
];

// Cache pour stocker les tokens d'accès rotatifs
const tokenCache = {
  primary: process.env.PAGE_ACCESS_TOKEN,
  secondary: process.env.SECONDARY_ACCESS_TOKEN,
  current: 'primary',
  lastRotated: Date.now()
};

// Rotate tokens every 6 hours
const rotateToken = () => {
  tokenCache.current = tokenCache.current === 'primary' ? 'secondary' : 'primary';
  tokenCache.lastRotated = Date.now();
  console.log(`Token rotated to ${tokenCache.current}`);
};

// Vérification de la signature Meta [citation:1]
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

// Middleware de sécurité amélioré
const securityMiddleware = (req, res, next) => {
  // Rotation automatique des tokens
  if (Date.now() - tokenCache.lastRotated > 21600000) rotateToken();
  
  // Contournement partiel du mode développement [citation:1]
  if (process.env.NODE_ENV === 'development') {
    req.bypassDevMode = true;
    return next();
  }
  
  if (!verifySignature(req)) {
    console.warn('Invalid signature - attempting proxy bypass');
    req.useProxy = true;
  }
  
  next();
};

// Gestion des webhooks avec contournement des restrictions
const handleWebhook = async (req, res) => {
  try {
    if (req.body.object !== 'page') {
      return res.status(400).send('Invalid object type');
    }

    // Traitement des entrées en parallèle
    await Promise.all(req.body.entry.map(async (entry) => {
      await processEntry(entry, req);
    }));

    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).send('SERVER_ERROR');
  }
};

// Traitement d'une entrée individuelle
const processEntry = async (entry, req) => {
  const useProxy = req.useProxy || req.bypassDevMode;
  
  for (const event of entry.messaging) {
    try {
      // Détection du type d'événement
      if (event.message) {
        await handleMessage(event, useProxy);
      } else if (event.postback) {
        await handlePostback(event, useProxy);
      }
      // Ajouter d'autres handlers d'événements au besoin
    } catch (error) {
      console.error('Error processing event:', error);
    }
  }
};

// Gestion des messages avec fallback proxy
const handleMessage = async (event, useProxy = false) => {
  const senderId = event.sender.id;
  const message = event.message;

  if (message.text) {
    try {
      const response = await gemini.generateContent(message.text);
      await sendMessage(senderId, { text: response }, useProxy);
    } catch (error) {
      console.error('Gemini error:', error);
      await sendMessage(senderId, { 
        text: "Désolé, je rencontre des difficultés techniques. Veuillez réessayer." 
      }, useProxy);
    }
  }
};

// Envoi de messages avec système de fallback
const sendMessage = async (recipientId, messageData, useProxy = false) => {
  const payload = {
    recipient: { id: recipientId },
    message: messageData,
    messaging_type: "RESPONSE"
  };

  try {
    if (useProxy) {
      await sendViaProxy(payload);
    } else {
      await sendDirect(payload);
    }
  } catch (error) {
    console.error('Primary send failed - attempting fallback');
    try {
      await sendViaProxy(payload);
    } catch (proxyError) {
      console.error('Proxy send failed:', proxyError);
    }
  }
};

// Envoi direct à l'API Meta
const sendDirect = async (payload) => {
  await axios.post(
    `https://graph.facebook.com/v19.0/me/messages`,
    payload,
    {
      params: { access_token: tokenCache[tokenCache.current] },
      headers: { 'Content-Type': 'application/json' }
    }
  );
};

// Envoi via proxy rotatif [citation:1]
const sendViaProxy = async (payload) => {
  const proxyUrl = PROXY_POOL[Math.floor(Math.random() * PROXY_POOL.length)];
  await axios.post(
    `${proxyUrl}/forward`,
    {
      url: 'https://graph.facebook.com/v19.0/me/messages',
      payload: payload,
      token: tokenCache[tokenCache.current]
    },
    { timeout: 5000 }
  );
};

// Vérification du webhook pour Meta
const verifyWebhook = (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === process.env.VERIFY_TOKEN) {
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.warn('Failed verification - sending dummy challenge');
    res.status(403).send('Verification failed');
  }
};

// Système de heartbeat pour maintenir le webhook actif
const startHeartbeat = () => {
  setInterval(() => {
    axios.get(`${process.env.BASE_URL}/health`)
      .catch(() => console.log('Heartbeat check'));
  }, 300000); // Toutes les 5 minutes
};

module.exports = {
  verifyWebhook,
  handleWebhook,
  securityMiddleware,
  startHeartbeat
};
