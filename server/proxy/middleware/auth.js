const bcrypt = require('bcrypt');

class ProxyAuth {
  constructor(dbPool) {
    this.dbPool = dbPool;
  }

  // 解析认证头
  parseAuthHeader(authHeader) {
    if (!authHeader) {
      return { valid: false, credentials: null };
    }

    const authParts = authHeader.split(' ');
    if (authParts.length !== 2 || authParts[0] !== 'Basic') {
      return { valid: false, credentials: null };
    }

    try {
      const credentials = Buffer.from(authParts[1], 'base64').toString();
      const [username, password] = credentials.split(':');

      if (!username || !password) {
        return { valid: false, credentials: null };
      }

      return { valid: true, credentials: { username, password } };
    } catch (error) {
      return { valid: false, credentials: null };
    }
  }

  // 验证用户凭据
  async validateCredentials(username, password) {
    try {
      const [rows] = await this.dbPool.execute(
        'SELECT username, password, status, max_connections FROM proxy_users WHERE username = ? AND status = "active"',
        [username]
      );

      if (rows.length === 0) {
        return { valid: false, user: null };
      }

      const user = rows[0];

      // 验证密码
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return { valid: false, user: null };
      }

      return { valid: true, user };
    } catch (error) {
      console.error('数据库认证错误:', error);
      return { valid: false, user: null };
    }
  }

  // HTTP请求认证中间件
  async authenticateHttp(req) {
    const authHeader = req.headers['proxy-authorization'];
    const parseResult = this.parseAuthHeader(authHeader);

    if (!parseResult.valid) {
      return { authenticated: false, user: null, error: '缺少认证信息' };
    }

    const { username, password } = parseResult.credentials;
    const validateResult = await this.validateCredentials(username, password);

    if (!validateResult.valid) {
      return { authenticated: false, user: null, error: '用户名或密码错误' };
    }

    return { authenticated: true, user: validateResult.user, error: null };
  }

  // CONNECT请求认证中间件
  async authenticateConnect(req) {
    return this.authenticateHttp(req);
  }

  // 发送认证要求响应
  sendAuthRequired(res, realm = 'Proxy Server') {
    res.writeHead(407, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Proxy-Authenticate': `Basic realm="${realm}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    });
    res.end('🔐 代理服务器需要身份验证\n\n请使用有效的代理账号');
  }

  // 发送CONNECT认证要求
  sendConnectAuthRequired(clientSocket, realm = 'Proxy Server') {
    const authResponse = `HTTP/1.1 407 Proxy Authentication Required\r\n` +
                        `Proxy-Authenticate: Basic realm="${realm}"\r\n` +
                        `Content-Type: text/plain; charset=utf-8\r\n` +
                        `Cache-Control: no-cache, no-store, must-revalidate\r\n` +
                        `Content-Length: 60\r\n` +
                        `\r\n` +
                        `🔐 代理服务器需要身份验证。请使用有效的代理账号。`;
    clientSocket.write(authResponse);
    clientSocket.end();
  }
}

module.exports = ProxyAuth; 