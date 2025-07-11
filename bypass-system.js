// bypass-system.js
const axios = require('axios');
const crypto = require('crypto');

class MetaBypassSystem {
  constructor() {
    this.proxyPool = [
      'https://proxy1.meta-bypass.tech',
      'https://proxy2.meta-bypass.tech',
      'https://proxy3.meta-bypass.tech'
    ];
    this.tokenRotation = {
      tokens: [
        process.env.PRIMARY_TOKEN,
        process.env.SECONDARY_TOKEN,
        process.env.FALLBACK_TOKEN
      ],
      currentIndex: 0,
      lastRotated: Date.now()
    };
  }

  async sendRequest(payload) {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const proxy = this.getRandomProxy();
        const token = this.getCurrentToken();
        
        const response = await axios.post(
          `${proxy}/v19.0/me/messages`,
          payload,
          {
            headers: this.generateHeaders(token),
            timeout: 5000
          }
        );
        
        return response.data;
      } catch (error) {
        if (attempt === maxRetries) throw error;
        this.rotateToken();
        await this.delay(1000 * attempt);
      }
    }
  }

  getRandomProxy() {
    return this.proxyPool[Math.floor(Math.random() * this.proxyPool.length)];
  }

  getCurrentToken() {
    if (Date.now() - this.tokenRotation.lastRotated > 3600000) {
      this.rotateToken();
    }
    return this.tokenRotation.tokens[this.tokenRotation.currentIndex];
  }

  rotateToken() {
    this.tokenRotation.currentIndex = 
      (this.tokenRotation.currentIndex + 1) % this.tokenRotation.tokens.length;
    this.tokenRotation.lastRotated = Date.now();
  }

  generateHeaders(token) {
    return {
      'Authorization': `Bearer ${token}`,
      'X-Forwarded-For': this.generateRandomIP(),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Content-Type': 'application/json'
    };
  }

  generateRandomIP() {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new MetaBypassSystem();
