// 代理服务器默认配置
module.exports = {
  // 服务器基本配置
  server: {
    host: process.env.PROXY_HOST || '0.0.0.0',
    httpPort: process.env.PROXY_HTTP_PORT || 8082,
    httpsPort: process.env.PROXY_HTTPS_PORT || 8083,
  },

  // SSL配置 (备用配置 - 优先使用数据库中的SSL证书)
  ssl: {
    enabled: process.env.PROXY_SSL_ENABLED === 'true',
    keyPath: process.env.PROXY_SSL_KEY || './ssl/keys/server.key',
    certPath: process.env.PROXY_SSL_CERT || './ssl/certs/server.crt',
    passphrase: process.env.PROXY_SSL_PASSPHRASE || undefined
  },

  // 数据库配置
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '12345',
    database: process.env.DB_NAME || 'proxy',
    charset: 'utf8mb4',
    connectionLimit: 10
  },

  // 安全配置
  security: {
    enableAuth: true,
    enableLogs: process.env.PROXY_ENABLE_LOGS !== 'false',
    enableDetailedLogs: process.env.PROXY_DETAILED_LOGS === 'true',
    hideCredentials: process.env.PROXY_HIDE_CREDS !== 'false',
    enableRateLimit: true,
    maxConnectionsPerIP: parseInt(process.env.PROXY_MAX_CONN_IP) || 100,
    enableDnsOverHttps: true
  },

  // 隐私配置
  privacy: {
    enableConnectionLimits: true,
    silentMode: process.env.PROXY_SILENT === 'true',
    dohServers: [
      'https://1.1.1.1/dns-query',
      'https://8.8.8.8/dns-query'
    ]
  },

  // 日志配置
  logging: {
    level: process.env.PROXY_LOG_LEVEL || 'info',
    enableConsole: true,
    enableFile: false,
    logDir: './logs',
    maxFiles: 7,
    maxSize: '10m'
  }
}; 