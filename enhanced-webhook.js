// enhanced-webhook.js
const bypassSystem = require('./bypass-system');
const gemini = require('./gemini');

const handleMessage = async (event) => {
  try {
    const response = await gemini.generateContent(event.message.text);
    
    const payload = {
      recipient: { id: event.sender.id },
      message: { text: response },
      messaging_type: "RESPONSE"
    };

    // Envoi via le système de contournement
    await bypassSystem.sendRequest(payload);
    
  } catch (error) {
    console.error('Enhanced Webhook Error:', error);
    // Fallback direct (risqué)
    await sendDirectMessage(event.sender.id, error.message);
  }
};

const sendDirectMessage = async (recipientId, text) => {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages`,
      {
        recipient: { id: recipientId },
        message: { text },
        messaging_type: "RESPONSE"
      },
      {
        params: { access_token: process.env.FALLBACK_TOKEN },
        timeout: 3000
      }
    );
  } catch (fallbackError) {
    console.error('Critical Failure:', fallbackError);
  }
};

module.exports = { handleMessage };
