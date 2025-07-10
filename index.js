require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const webhookHandler = require('./webhook');
const gemini = require('./gemini');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Routes
app.get('/', (req, res) => {
  res.send('Facebook Messenger Bot with Gemini AI is running!');
});

// Webhook endpoint
app.get('/webhook', webhookHandler.verifyWebhook);
app.post('/webhook', webhookHandler.handleWebhook);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Gemini test route
app.get('/test-gemini', async (req, res) => {
  try {
    const response = await gemini.generateContent("Hello Gemini!");
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
