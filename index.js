require('dotenv').config();
const express = require('express');
const { handleWebhook, verifyWebhook } = require('./webhook');
const { checkProxies } = require('./proxy-manager');

const app = express();
app.use(express.json());

// Routes
app.get('/webhook', verifyWebhook);
app.post('/webhook', handleWebhook);
app.get('/health', (req, res) => res.status(200).send('OK'));

// Vérification périodique des proxies
setInterval(checkProxies, 3600000); // Toutes les heures

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
