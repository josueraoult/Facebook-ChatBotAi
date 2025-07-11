const axios = require('axios');
const SocksProxyAgent = require('socks-proxy-agent');

class ProxyManager {
  constructor() {
    this.proxies = [
      { ip: '78.29.4.218', port: '4145', country: 'RU', protocol: 'socks4', latency: 68.406 },
      { ip: '63.76.255.180', port: '5678', country: 'US', protocol: 'socks4', latency: 111.537 },
      { ip: '132.148.166.129', port: '9864', country: 'US', protocol: 'socks4', latency: 140.781 },
      // Ajoutez d'autres proxies de votre liste ici
    ];
    
    this.currentProxyIndex = 0;
    this.failedProxies = new Set();
  }

  getNextProxy() {
    // Sélectionne le proxy le plus rapide disponible
    const availableProxies = this.proxies
      .filter(p => !this.failedProxies.has(p.ip))
      .sort((a, b) => a.latency - b.latency);
    
    return availableProxies[0] || null;
  }

  async sendRequest(payload) {
    const proxy = this.getNextProxy();
    if (!proxy) throw new Error('No available proxies');

    try {
      const agent = new SocksProxyAgent(
        `${proxy.protocol}://${proxy.ip}:${proxy.port}`
      );

      const startTime = Date.now();
      const response = await axios.post(
        'https://graph.facebook.com/v19.0/me/messages',
        payload,
        {
          httpsAgent: agent,
          timeout: 5000,
          params: {
            access_token: process.env.PAGE_ACCESS_TOKEN
          },
          headers: this.generateHeaders(proxy)
        }
      );

      // Mise à jour de la latence dynamique
      proxy.latency = Date.now() - startTime;
      
      return response.data;
    } catch (error) {
      this.failedProxies.add(proxy.ip);
      console.error(`Proxy ${proxy.ip} failed. Marked as temporary unavailable.`);
      throw error;
    }
  }

  generateHeaders(proxy) {
    return {
      'X-Forwarded-For': this.generateRandomIP(),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'X-Proxy-Country': proxy.country,
      'X-Proxy-Latency': proxy.latency.toString()
    };
  }

  generateRandomIP() {
    return Array.from({length: 4}, () => Math.floor(Math.random() * 255)).join('.');
  }

  // Vérification périodique des proxies défaillants
  async checkFailedProxies() {
    for (const ip of this.failedProxies) {
      const proxy = this.proxies.find(p => p.ip === ip);
      if (proxy) {
        try {
          await axios.get('https://api.ipify.org?format=json', {
            httpsAgent: new SocksProxyAgent(
              `${proxy.protocol}://${proxy.ip}:${proxy.port}`
            ),
            timeout: 3000
          });
          this.failedProxies.delete(ip);
        } catch (e) {
          // Le proxy est toujours défaillant
        }
      }
    }
  }
}

// Initialisation et vérification toutes les 5 minutes
const proxyManager = new ProxyManager();
setInterval(() => proxyManager.checkFailedProxies(), 300000);

module.exports = proxyManager;
