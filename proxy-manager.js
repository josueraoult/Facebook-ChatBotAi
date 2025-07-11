const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const NodeCache = require('node-cache');

class ProxyManager {
  constructor() {
    this.proxyCache = new NodeCache({ stdTTL: 600 });
    this.proxies = [
      // Vos proxies gratuits
      { ip: '78.29.4.218', port: '4145', country: 'RU', protocol: 'socks4' },
      { ip: '63.76.255.180', port: '5678', country: 'US', protocol: 'socks4' },
      // Ajoutez tous vos proxies ici...
    ];
  }

  async getWorkingProxy() {
    // Vérifie le cache d'abord
    const cachedProxy = this.proxyCache.get('working_proxy');
    if (cachedProxy) return cachedProxy;

    // Teste les proxies jusqu'à en trouver un qui fonctionne
    for (const proxy of this.shuffleArray(this.proxies)) {
      if (await this.testProxy(proxy)) {
        this.proxyCache.set('working_proxy', proxy);
        return proxy;
      }
    }
    throw new Error('No working proxy available');
  }

  async testProxy(proxy) {
    try {
      const agent = new SocksProxyAgent(
        `${proxy.protocol}://${proxy.ip}:${proxy.port}`
      );
      await axios.get('https://api.ipify.org?format=json', {
        httpsAgent: agent,
        timeout: 5000
      });
      return true;
    } catch (e) {
      console.log(`Proxy ${proxy.ip} failed: ${e.message}`);
      return false;
    }
  }

  async sendRequest(payload) {
    const proxy = await this.getWorkingProxy();
    const agent = new SocksProxyAgent(
      `${proxy.protocol}://${proxy.ip}:${proxy.port}`
    );

    return axios.post(
      'https://graph.facebook.com/v19.0/me/messages',
      payload,
      {
        httpsAgent: agent,
        timeout: 8000,
        params: { access_token: process.env.PAGE_ACCESS_TOKEN },
        headers: this.generateHeaders()
      }
    );
  }

  generateHeaders() {
    return {
      'X-Forwarded-For': this.generateRandomIP(),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
  }

  generateRandomIP() {
    return Array.from({length: 4}, () => Math.floor(Math.random() * 255)).join('.');
  }

  shuffleArray(array) {
    return [...array].sort(() => Math.random() - 0.5);
  }
}

// Fonction exportée pour le check périodique
async function checkProxies() {
  const manager = new ProxyManager();
  await manager.getWorkingProxy();
  console.log('Proxy health check completed');
}

module.exports = new ProxyManager();
module.exports.checkProxies = checkProxies;
