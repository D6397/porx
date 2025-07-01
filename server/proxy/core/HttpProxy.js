const http = require('http');
const https = require('https');
const url = require('url');
const net = require('net');

class HttpProxy {
  constructor(config, auth, logger, tracker) {
    this.config = config;
    this.auth = auth;
    this.logger = logger;
    this.tracker = tracker;
  }

  // 处理HTTP请求
  async handleHttp(req, res) {
    const clientIP = req.connection.remoteAddress || req.socket.remoteAddress;
    const sessionId = this.tracker.generateSessionId();

    try {
      this.logger.logAccess(req.method, req.url, null, clientIP, sessionId);

      // 验证认证
      const authResult = await this.auth.authenticateHttp(req);
      if (!authResult.authenticated) {
        this.logger.logAuth(null, clientIP, false, authResult.error, sessionId);
        this.auth.sendAuthRequired(res);
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
        this.logger.log('warn', `连接被拒绝: ${limitCheck.reason}`, sessionId);
        res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`连接被拒绝: ${limitCheck.reason}`);
        return;
      }

      // 添加连接跟踪
      const trackingSessionId = this.tracker.addConnection(clientIP, user.username);

      try {
        await this.forwardHttpRequest(req, res, user, clientIP, trackingSessionId);
      } finally {
        this.tracker.removeConnection(trackingSessionId);
      }

    } catch (error) {
      this.logger.logError(error, 'HTTP请求处理错误', sessionId);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('代理服务器内部错误');
      }
    }
  }

  // 转发HTTP请求
  async forwardHttpRequest(req, res, user, clientIP, sessionId) {
    const target = url.parse(req.url);
    
    // 记录连接日志
    await this.logger.logConnection(user.username, clientIP, target.hostname, 'http_request', sessionId);

    const options = {
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: target.path,
      method: req.method,
      headers: { ...req.headers }
    };

    // 清理和修改请求头
    this.sanitizeHeaders(options.headers);

    const protocol = target.protocol === 'https:' ? https : http;

    const proxyReq = protocol.request(options, (proxyRes) => {
      // 清理响应头
      this.sanitizeResponseHeaders(proxyRes.headers);

      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', async (error) => {
      this.logger.logError(error, `HTTP转发错误 (${target.hostname}:${target.port})`, sessionId);
      await this.logger.logConnection(user.username, clientIP, target.hostname, 'error', sessionId);
      
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`代理请求失败: 无法连接到 ${target.hostname}`);
      }
    });

    // 设置请求超时
    proxyReq.setTimeout(30000, () => {
      this.logger.log('warn', `HTTP请求超时: ${target.hostname}`, sessionId);
      proxyReq.destroy();
    });

    // 转发请求体
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq, { end: true });
    } else {
      proxyReq.end();
    }

    // 处理客户端断开连接
    req.on('close', () => {
      if (!proxyReq.destroyed) {
        proxyReq.destroy();
      }
    });
  }

  // 处理CONNECT请求（HTTPS隧道）
  async handleConnect(req, clientSocket, head) {
    const clientIP = clientSocket.remoteAddress;
    const sessionId = this.tracker.generateSessionId();

    try {
      this.logger.log('info', `HTTPS隧道请求: ${req.url}`, sessionId);

      // 验证认证
      const authResult = await this.auth.authenticateConnect(req);
      if (!authResult.authenticated) {
        this.logger.logAuth(null, clientIP, false, authResult.error, sessionId);
        this.auth.sendConnectAuthRequired(clientSocket);
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
        this.logger.log('warn', `CONNECT连接被拒绝: ${limitCheck.reason}`, sessionId);
        this.auth.sendConnectAuthRequired(clientSocket);
        return;
      }

      // 添加连接跟踪
      const trackingSessionId = this.tracker.addConnection(clientIP, user.username);

      try {
        await this.createTunnel(req, clientSocket, head, user, clientIP, trackingSessionId);
      } finally {
        this.tracker.removeConnection(trackingSessionId);
      }

    } catch (error) {
      this.logger.logError(error, 'CONNECT请求处理错误', sessionId);
      clientSocket.end();
    }
  }

  // 创建HTTPS隧道
  async createTunnel(req, clientSocket, head, user, clientIP, sessionId) {
    const { hostname, port } = url.parse(`http://${req.url}`);
    const serverPort = port || 443;

    // 记录连接日志
    await this.logger.logConnection(user.username, clientIP, hostname, 'https_tunnel', sessionId);

    try {
      // 创建到目标服务器的连接
      const serverSocket = net.connect(serverPort, hostname, () => {
        this.logger.log('info', `隧道建立成功: ${hostname}:${serverPort}`, sessionId);

        // 发送连接建立响应
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

        // 开始数据转发
        if (head && head.length > 0) {
          serverSocket.write(head);
        }

        // 设置pipe连接并处理错误
        const serverPipe = serverSocket.pipe(clientSocket, { end: false });
        const clientPipe = clientSocket.pipe(serverSocket, { end: false });

        // 为pipe添加错误处理
        serverPipe.on('error', (error) => {
          this.logger.logError(error, `隧道服务器pipe错误: ${hostname}`, sessionId);
        });

        clientPipe.on('error', (error) => {
          this.logger.logError(error, `隧道客户端pipe错误: ${hostname}`, sessionId);
        });
      });

      // 为所有socket添加通用错误处理
      serverSocket.on('error', async (error) => {
        this.logger.logError(error, `隧道服务器连接错误: ${hostname}`, sessionId);
        await this.logger.logConnection(user.username, clientIP, hostname, 'error', sessionId);
        if (!clientSocket.destroyed) {
          clientSocket.destroy();
        }
      });

      clientSocket.on('error', async (error) => {
        this.logger.logError(error, `隧道客户端连接错误: ${hostname}`, sessionId);
        await this.logger.logConnection(user.username, clientIP, hostname, 'disconnect', sessionId);
        if (!serverSocket.destroyed) {
          serverSocket.destroy();
        }
      });

      serverSocket.on('close', async (hadError) => {
        this.logger.log('debug', `隧道服务器连接关闭: ${hostname}${hadError ? ' (with error)' : ''}`, sessionId);
        await this.logger.logConnection(user.username, clientIP, hostname, 'disconnect', sessionId);
        if (!clientSocket.destroyed) {
          clientSocket.destroy();
        }
      });

      clientSocket.on('close', (hadError) => {
        this.logger.log('debug', `隧道客户端连接关闭: ${hostname}${hadError ? ' (with error)' : ''}`, sessionId);
        if (!serverSocket.destroyed) {
          serverSocket.destroy();
        }
      });

      // 设置超时
      serverSocket.setTimeout(60000, () => {
        this.logger.log('warn', `隧道连接超时: ${hostname}`, sessionId);
        serverSocket.destroy();
      });

      clientSocket.setTimeout(60000, () => {
        this.logger.log('warn', `客户端连接超时: ${hostname}`, sessionId);
        clientSocket.destroy();
      });

    } catch (error) {
      this.logger.logError(error, `隧道创建失败: ${hostname}`, sessionId);
      await this.logger.logConnection(user.username, clientIP, hostname, 'error', sessionId);
      if (!clientSocket.destroyed) {
        clientSocket.destroy();
      }
    }
  }

  // 清理请求头
  sanitizeHeaders(headers) {
    // 删除代理认证头
    delete headers['proxy-authorization'];
    
    // 删除可能暴露信息的头
    delete headers['x-forwarded-for'];
    delete headers['x-real-ip'];
    delete headers['via'];
    delete headers['x-forwarded-proto'];

    // 伪装User-Agent（如果没有的话）
    if (!headers['user-agent']) {
      headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }
    
    // 保持连接控制头的原有值，不强制覆盖
    if (!headers['connection']) {
      headers['connection'] = 'keep-alive';
    }
  }

  // 清理响应头
  sanitizeResponseHeaders(headers) {
    // 删除可能暴露服务器信息的头
    delete headers['server'];
    delete headers['x-powered-by'];
    delete headers['x-aspnet-version'];
    delete headers['x-aspnetmvc-version'];

    // 添加隐私保护头
    headers['cache-control'] = 'no-cache, no-store, must-revalidate';
    headers['pragma'] = 'no-cache';
  }
}

module.exports = HttpProxy; 