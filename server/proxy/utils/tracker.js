// 连接跟踪器
class ConnectionTracker {
  constructor() {
    this.ipConnections = new Map();
    this.userConnections = new Map();
    this.sessions = new Map();
  }

  // 生成会话ID
  generateSessionId() {
    return require('crypto').randomBytes(8).toString('hex');
  }

  // 检查连接限制
  checkLimits(clientIP, username, maxConnections, maxConnectionsPerIP) {
    // IP连接限制
    if (maxConnectionsPerIP && maxConnectionsPerIP > 0) {
      const ipConns = this.ipConnections.get(clientIP) || 0;
      if (ipConns >= maxConnectionsPerIP) {
        return { allowed: false, reason: 'IP连接数超限' };
      }
    }

    // 用户连接限制
    if (username && maxConnections && maxConnections > 0) {
      const userConns = this.userConnections.get(username) || 0;
      if (userConns >= maxConnections) {
        return { allowed: false, reason: '用户连接数超限' };
      }
    }

    return { allowed: true };
  }

  // 增加连接计数
  addConnection(clientIP, username) {
    const sessionId = this.generateSessionId();

    // IP计数
    this.ipConnections.set(clientIP, (this.ipConnections.get(clientIP) || 0) + 1);

    // 用户计数
    if (username) {
      this.userConnections.set(username, (this.userConnections.get(username) || 0) + 1);
    }

    // 会话记录
    this.sessions.set(sessionId, {
      clientIP,
      username,
      startTime: Date.now()
    });

    return sessionId;
  }

  // 减少连接计数
  removeConnection(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const { clientIP, username } = session;

    // 减少IP计数
    const ipCount = this.ipConnections.get(clientIP) || 0;
    if (ipCount > 0) {
      this.ipConnections.set(clientIP, ipCount - 1);
      if (ipCount === 1) {
        this.ipConnections.delete(clientIP);
      }
    }

    // 减少用户计数
    if (username) {
      const userCount = this.userConnections.get(username) || 0;
      if (userCount > 0) {
        this.userConnections.set(username, userCount - 1);
        if (userCount === 1) {
          this.userConnections.delete(username);
        }
      }
    }

    // 删除会话
    this.sessions.delete(sessionId);
  }

  // 获取统计信息
  getStats() {
    return {
      totalSessions: this.sessions.size,
      uniqueIPs: this.ipConnections.size,
      uniqueUsers: this.userConnections.size,
      ipConnections: Object.fromEntries(this.ipConnections),
      userConnections: Object.fromEntries(this.userConnections)
    };
  }

  // 清理过期连接
  cleanup() {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30分钟超时

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.startTime > timeout) {
        this.removeConnection(sessionId);
      }
    }
  }

  // 定期清理
  startCleanup() {
    setInterval(() => {
      this.cleanup();
      
      // 如果数据量过大，全部清理
      if (this.sessions.size > 10000) {
        this.clear();
      }
    }, 5 * 60 * 1000); // 5分钟清理一次
  }

  // 清空所有连接
  clear() {
    this.ipConnections.clear();
    this.userConnections.clear();
    this.sessions.clear();
  }
}

module.exports = new ConnectionTracker(); 