const HttpProxy = require('./HttpProxy');

class HttpsProxy extends HttpProxy {
  constructor(config, auth, logger, tracker) {
    super(config, auth, logger, tracker);
  }

  // HTTPS代理可以复用HTTP的所有功能
  // 这里可以添加SSL特定的处理逻辑

  // 重写日志记录，标识为HTTPS请求
  async handleHttp(req, res) {
    const clientIP = req.connection.remoteAddress || req.socket.remoteAddress;
    const sessionId = this.tracker.generateSessionId();

    try {
      this.logger.logAccess(`HTTPS-${req.method}`, req.url, null, clientIP, sessionId);

      // 验证认证
      const authResult = await this.auth.authenticateHttp(req);
      if (!authResult.authenticated) {
        this.logger.logAuth(null, clientIP, false, authResult.error, sessionId);
        this.auth.sendAuthRequired(res, 'HTTPS Proxy Server');
        return;
      }

      const user = authResult.user;
      this.logger.logAuth(user.username, clientIP, true, null, sessionId);

      // 检查连接限制
      const limitCheck = this.tracker.checkLimits(
        clientIP,
        user.username,
        user.max_connections,
        this.config.security.maxConnectionsPerIP
      );

      if (!limitCheck.allowed) {
        this.logger.log('warn', `HTTPS连接被拒绝: ${limitCheck.reason}`, sessionId);
        res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`HTTPS连接被拒绝: ${limitCheck.reason}`);
        return;
      }

      // 添加连接跟踪
      const trackingSessionId = this.tracker.addConnection(clientIP, user.username);

      try {
        await this.forwardHttpsRequest(req, res, user, clientIP, trackingSessionId);
      } finally {
        this.tracker.removeConnection(trackingSessionId);
      }

    } catch (error) {
      this.logger.logError(error, 'HTTPS请求处理错误', sessionId);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('HTTPS代理服务器内部错误');
      }
    }
  }

  // HTTPS特定的请求转发
  async forwardHttpsRequest(req, res, user, clientIP, sessionId) {
    // 记录为HTTPS请求
    await this.logger.logConnection(user.username, clientIP, req.headers.host || 'unknown', 'https_request', sessionId);
    
    // 调用父类的转发方法
    return super.forwardHttpRequest(req, res, user, clientIP, sessionId);
  }

  // 重写CONNECT处理，标识为HTTPS隧道
  async handleConnect(req, clientSocket, head) {
    const clientIP = clientSocket.remoteAddress;
    const sessionId = this.tracker.generateSessionId();

    try {
      this.logger.log('info', `HTTPS-SSL隧道请求: ${req.url}`, sessionId);

      // 验证认证
      const authResult = await this.auth.authenticateConnect(req);
      if (!authResult.authenticated) {
        this.logger.logAuth(null, clientIP, false, authResult.error, sessionId);
        this.auth.sendConnectAuthRequired(clientSocket, 'HTTPS Proxy Server');
        return;
      }

      const user = authResult.user;
      this.logger.logAuth(user.username, clientIP, true, null, sessionId);

      // 检查连接限制
      const limitCheck = this.tracker.checkLimits(
        clientIP,
        user.username,
        user.max_connections,
        this.config.security.maxConnectionsPerIP
      );

      if (!limitCheck.allowed) {
        this.logger.log('warn', `HTTPS-SSL隧道连接被拒绝: ${limitCheck.reason}`, sessionId);
        this.auth.sendConnectAuthRequired(clientSocket, 'HTTPS Proxy Server');
        return;
      }

      // 添加连接跟踪
      const trackingSessionId = this.tracker.addConnection(clientIP, user.username);

      try {
        await this.createHttpsTunnel(req, clientSocket, head, user, clientIP, trackingSessionId);
      } finally {
        this.tracker.removeConnection(trackingSessionId);
      }

    } catch (error) {
      this.logger.logError(error, 'HTTPS-SSL隧道处理错误', sessionId);
      clientSocket.end();
    }
  }

  // HTTPS特定的隧道创建
  async createHttpsTunnel(req, clientSocket, head, user, clientIP, sessionId) {
    const { hostname, port } = require('url').parse(`http://${req.url}`);
    const serverPort = port || 443;

    // 记录为HTTPS-SSL隧道
    await this.logger.logConnection(user.username, clientIP, hostname, 'https_ssl_tunnel', sessionId);

    // 调用父类的隧道创建方法
    return super.createTunnel(req, clientSocket, head, user, clientIP, sessionId);
  }

  // 重写响应头清理，添加SSL相关的安全头
  sanitizeResponseHeaders(headers) {
    super.sanitizeResponseHeaders(headers);
    
    // 添加SSL相关的安全头
    headers['strict-transport-security'] = 'max-age=31536000; includeSubDomains';
    headers['x-content-type-options'] = 'nosniff';
    headers['x-frame-options'] = 'DENY';
    headers['x-xss-protection'] = '1; mode=block';
  }
}

module.exports = HttpsProxy; 