const http = require('http');
const https = require('https');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const config = require('../config/default');
const ProxyAuth = require('../middleware/auth');
const ProxyLogger = require('../middleware/logger');
const tracker = require('../utils/tracker');
const HttpProxy = require('./HttpProxy');
const HttpsProxy = require('./HttpsProxy');

class ProxyServer {
  constructor(serverConfig = {}) {
    // 合并配置
    this.config = { ...config, ...serverConfig };
    
    // 初始化组件
    this.dbPool = null;
    this.auth = null;
    this.logger = null;
    this.httpProxy = null;
    this.httpsProxy = null;
    
    // 运行状态
    this.isRunning = false;
    this.startTime = null;
    
    // 服务器配置ID（用于从数据库加载SSL证书）
    this.serverId = serverConfig.serverId || null;
    this.serverData = null;
  }

  // 初始化数据库连接
  async initDatabase() {
    try {
      this.dbPool = mysql.createPool({
        ...this.config.database,
        waitForConnections: true,
        connectionLimit: this.config.database.connectionLimit,
        queueLimit: 0
      });

      // 测试连接
      const connection = await this.dbPool.getConnection();
      connection.release();
      
      return true;
    } catch (error) {
      console.error('❌ 数据库连接失败:', error.message);
      return false;
    }
  }

  // 初始化组件
  initComponents() {
    this.auth = new ProxyAuth(this.dbPool);
    this.logger = new ProxyLogger(this.config, this.dbPool);
    this.httpProxy = new HttpProxy(this.config, this.auth, this.logger, tracker);
    
    if (this.config.ssl.enabled) {
      this.httpsProxy = new HttpsProxy(this.config, this.auth, this.logger, tracker);
    }
  }

  // 从数据库加载服务器配置
  async loadServerConfig() {
    if (!this.serverId) {
      return null;
    }

    try {
      const connection = await this.dbPool.getConnection();
      try {
        const [rows] = await connection.execute(
          'SELECT * FROM proxy_servers WHERE id = ?',
          [this.serverId]
        );
        
        if (rows.length > 0) {
          this.serverData = rows[0];
          return this.serverData;
        }
        
        return null;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('加载服务器配置失败:', error.message);
      return null;
    }
  }

  // 加载SSL证书（支持从数据库配置加载）
  async loadSSLOptions() {
    try {
      const options = {};
      let certPath, keyPath;

      // 如果有服务器配置，优先使用数据库中的SSL证书路径
      if (this.serverData && this.serverData.ssl_enabled) {
        certPath = this.serverData.cert_path;
        keyPath = this.serverData.key_path;
        
        if (!certPath || !keyPath) {
          throw new Error('服务器启用了SSL但未配置证书文件路径');
        }
      } else {
        // 回退到配置文件中的路径
        certPath = this.config.ssl.certPath;
        keyPath = this.config.ssl.keyPath;
      }

      // 加载私钥文件
      if (fs.existsSync(keyPath)) {
        options.key = fs.readFileSync(keyPath);
      } else {
        throw new Error(`SSL私钥文件不存在: ${keyPath}`);
      }
      
      // 加载证书文件
      if (fs.existsSync(certPath)) {
        options.cert = fs.readFileSync(certPath);
      } else {
        throw new Error(`SSL证书文件不存在: ${certPath}`);
      }
      
      // 如果有密码
      if (this.config.ssl.passphrase) {
        options.passphrase = this.config.ssl.passphrase;
      }
      
      return options;
    } catch (error) {
      throw new Error(`加载SSL证书失败: ${error.message}`);
    }
  }

  // 启动代理服务器
  async start() {
    try {
      if (this.isRunning) {
        throw new Error('代理服务器已在运行');
      }

      // 初始化数据库
      const dbReady = await this.initDatabase();
      if (!dbReady) {
        throw new Error('数据库初始化失败');
      }

      // 加载服务器配置（如果有serverId）
      if (this.serverId) {
        await this.loadServerConfig();
      }

      // 初始化组件
      this.initComponents();

      // 启动连接跟踪器清理
      tracker.startCleanup();

      // 启动HTTP代理服务器
      await this.startHttpProxy();

      // 检查是否需要启动HTTPS代理服务器
      const shouldStartHttps = this.serverData 
        ? this.serverData.ssl_enabled && this.serverData.cert_path && this.serverData.key_path
        : this.config.ssl.enabled;

      if (shouldStartHttps) {
        await this.startHttpsProxy();
      }

      this.isRunning = true;
      this.startTime = new Date();

      this.logger.log('info', '🚇 代理服务器启动成功');
      this.printServerInfo();

      return { success: true, message: '代理服务器启动成功' };
    } catch (error) {
      this.logger.logError(error, '启动代理服务器失败');
      throw error;
    }
  }

  // 启动HTTP代理
  async startHttpProxy() {
    return new Promise((resolve, reject) => {
      const server = http.createServer(this.httpProxy.handleHttp.bind(this.httpProxy));
      server.on('connect', this.httpProxy.handleConnect.bind(this.httpProxy));

      const httpPort = this.serverData ? this.serverData.http_port : this.config.server.httpPort;
      
      server.listen(httpPort, this.config.server.host, () => {
        this.logger.log('info', `HTTP代理监听: ${this.config.server.host}:${httpPort}`);
        this.httpServer = server;
        resolve();
      });

      server.on('error', (error) => {
        this.logger.logError(error, 'HTTP代理服务器错误');
        reject(error);
      });
    });
  }

  // 启动HTTPS代理
  async startHttpsProxy() {
    return new Promise(async (resolve, reject) => {
      try {
        const sslOptions = await this.loadSSLOptions();
        const server = https.createServer(sslOptions, this.httpsProxy.handleHttp.bind(this.httpsProxy));
        server.on('connect', this.httpsProxy.handleConnect.bind(this.httpsProxy));

        const httpsPort = this.serverData ? this.serverData.https_port : this.config.server.httpsPort;
        
        server.listen(httpsPort, this.config.server.host, () => {
          this.logger.log('info', `HTTPS代理监听: ${this.config.server.host}:${httpsPort}`);
          if (this.serverData) {
            this.logger.log('info', `SSL证书: ${this.serverData.cert_file_name || '配置文件'}`);
          }
          this.httpsServer = server;
          resolve();
        });

        server.on('error', (error) => {
          this.logger.logError(error, 'HTTPS代理服务器错误');
          reject(error);
        });
      } catch (error) {
        this.logger.log('warn', `HTTPS代理启动失败: ${error.message}`);
        resolve(); // HTTPS失败不影响HTTP服务
      }
    });
  }

  // 停止代理服务器
  async stop() {
    try {
      if (!this.isRunning) {
        throw new Error('代理服务器未在运行');
      }

      const promises = [];

      // 关闭HTTP服务器
      if (this.httpServer) {
        promises.push(new Promise((resolve) => {
          this.httpServer.close(() => {
            this.logger.log('info', 'HTTP代理服务器已关闭');
            resolve();
          });
        }));
      }

      // 关闭HTTPS服务器
      if (this.httpsServer) {
        promises.push(new Promise((resolve) => {
          this.httpsServer.close(() => {
            this.logger.log('info', 'HTTPS代理服务器已关闭');
            resolve();
          });
        }));
      }

      await Promise.all(promises);

      // 关闭数据库连接
      if (this.dbPool) {
        await this.dbPool.end();
        this.logger.log('info', '数据库连接已关闭');
      }

      // 清理连接跟踪器
      tracker.clear();

      this.isRunning = false;
      this.startTime = null;

      this.logger.log('info', '✅ 代理服务器已完全关闭');

      return { success: true, message: '代理服务器停止成功' };
    } catch (error) {
      this.logger.logError(error, '停止代理服务器失败');
      throw error;
    }
  }

  // 获取服务器状态
  getStatus() {
    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      uptime: this.isRunning ? Date.now() - this.startTime.getTime() : 0,
      config: {
        httpPort: this.config.server.httpPort,
        httpsPort: this.config.server.httpsPort,
        host: this.config.server.host,
        sslEnabled: this.config.ssl.enabled
      },
      connections: tracker.getStats(),
      pid: process.pid
    };
  }

  // 获取统计信息
  async getStats() {
    if (!this.logger) return null;
    return await this.logger.getLogStats();
  }

  // 打印服务器信息
  printServerInfo() {
    console.log('');
    console.log('🔒 代理服务器信息:');
    console.log(`📍 HTTP地址: ${this.config.server.host}:${this.config.server.httpPort}`);
    
    if (this.config.ssl.enabled && this.httpsServer) {
      console.log(`📍 HTTPS地址: ${this.config.server.host}:${this.config.server.httpsPort}`);
    }
    
    console.log('');
    console.log('✨ 功能特性:');
    console.log('✅ 数据库认证');
    console.log('✅ 连接日志记录');
    console.log('✅ 用户连接限制');
    console.log('✅ 隐私保护');
    
    if (this.config.security.enableDnsOverHttps) {
      console.log('✅ DNS over HTTPS');
    }
    
    console.log('');
    console.log('💡 使用方法:');
    console.log(`   HTTP代理: ${this.config.server.host}:${this.config.server.httpPort}`);
    
    if (this.config.ssl.enabled && this.httpsServer) {
      console.log(`   HTTPS代理: ${this.config.server.host}:${this.config.server.httpsPort} (SSL)`);
    }
    
    console.log('   认证: 使用数据库中的代理账号');
    console.log('');
  }

  // 优雅关闭
  setupGracefulShutdown() {
    let isShuttingDown = false; // 防止重复关闭
    
    const shutdown = async () => {
      if (isShuttingDown) {
        return; // 避免重复执行关闭
      }
      isShuttingDown = true;
      
      console.log('\n🛑 收到关闭信号，正在优雅关闭...');
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        console.error('关闭失败:', error);
        process.exit(1);
      }
    };

    // 只绑定一次信号监听器
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }
}

module.exports = ProxyServer; 