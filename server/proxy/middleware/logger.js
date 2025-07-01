class ProxyLogger {
  constructor(config, dbPool) {
    this.config = config;
    this.dbPool = dbPool;
  }

  // 格式化日志消息
  formatMessage(level, message, sessionId = null) {
    const timestamp = new Date().toISOString();
    const session = sessionId ? `[${sessionId}]` : '';
    return `[${timestamp}] [${level}] ${session} ${message}`;
  }

  // 控制台日志
  log(level, message, sessionId = null) {
    if (this.config.privacy.silentMode) return;

    const formattedMessage = this.formatMessage(level, message, sessionId);

    switch (level.toLowerCase()) {
      case 'error':
        console.error(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'info':
        if (this.config.security.enableLogs) {
          console.log(formattedMessage);
        }
        break;
      case 'debug':
        if (this.config.security.enableDetailedLogs) {
          console.log(formattedMessage);
        }
        break;
      default:
        console.log(formattedMessage);
    }
  }

  // 记录连接日志到数据库
  async logConnection(username, clientIP, targetHost, action = 'connect', sessionId = null) {
    try {
      if (!this.config.security.enableLogs) return;

      await this.dbPool.execute(
        'INSERT INTO connection_logs (username, client_ip, target_host, action, session_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [username, clientIP, targetHost, action, sessionId]
      );

      this.log('debug', `日志记录: ${username} ${action} ${targetHost}`, sessionId);
    } catch (error) {
      this.log('error', `记录连接日志失败: ${error.message}`, sessionId);
    }
  }

  // 记录认证日志
  async logAuth(username, clientIP, success, reason = null, sessionId = null) {
    try {
      const action = success ? 'auth_success' : 'auth_failed';
      const message = success ? '认证成功' : `认证失败: ${reason}`;

      await this.logConnection(username || 'unknown', clientIP, 'auth', action, sessionId);
      this.log('info', `${username || 'unknown'} - ${message}`, sessionId);
    } catch (error) {
      this.log('error', `记录认证日志失败: ${error.message}`, sessionId);
    }
  }

  // 记录错误日志
  logError(error, context = '', sessionId = null) {
    const message = `${context}: ${error.message}`;
    this.log('error', message, sessionId);
  }

  // 记录访问日志
  logAccess(method, url, username, clientIP, sessionId = null) {
    if (!this.config.security.enableLogs) return;

    const message = `${method} ${url} - ${username || 'anonymous'}@${clientIP}`;
    this.log('info', message, sessionId);
  }

  // 记录统计信息
  logStats(stats, sessionId = null) {
    if (!this.config.security.enableDetailedLogs) return;

    const message = `统计: ${JSON.stringify(stats)}`;
    this.log('debug', message, sessionId);
  }

  // 清理过期日志
  async cleanupLogs(days = 30) {
    try {
      await this.dbPool.execute(
        'DELETE FROM connection_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
        [days]
      );
      this.log('info', `清理了 ${days} 天前的日志`);
    } catch (error) {
      this.log('error', `清理日志失败: ${error.message}`);
    }
  }

  // 获取日志统计
  async getLogStats() {
    try {
      const [totalLogs] = await this.dbPool.execute(
        'SELECT COUNT(*) as total FROM connection_logs'
      );

      const [todayLogs] = await this.dbPool.execute(
        'SELECT COUNT(*) as today FROM connection_logs WHERE DATE(created_at) = CURDATE()'
      );

      const [topUsers] = await this.dbPool.execute(
        'SELECT username, COUNT(*) as count FROM connection_logs WHERE DATE(created_at) = CURDATE() GROUP BY username ORDER BY count DESC LIMIT 10'
      );

      return {
        total: totalLogs[0].total,
        today: todayLogs[0].today,
        topUsers: topUsers
      };
    } catch (error) {
      this.log('error', `获取日志统计失败: ${error.message}`);
      return null;
    }
  }
}

module.exports = ProxyLogger; 