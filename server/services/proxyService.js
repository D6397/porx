const { spawn } = require('child_process');
const path = require('path');
const sequelize = require('../models');

class ProxyService {
  constructor() {
    this.proxyProcess = null;
    this.isRunning = false;
    this.serverId = null;
    
    // 初始化时同步数据库状态
    this.syncDatabaseStatus();
    
    // 设置进程退出监听器，确保子进程被清理
    this.setupProcessCleanup();
  }

  // 同步数据库状态
  async syncDatabaseStatus() {
    try {
      // 重置所有服务器状态为stopped
      await sequelize.query('UPDATE proxy_servers SET status = "stopped"');
      console.log('已同步数据库代理服务器状态');
    } catch (error) {
      console.error('同步数据库状态失败:', error);
    }
  }

  // 设置进程清理
  setupProcessCleanup() {
    let isCleaningUp = false; // 防止重复清理
    
    // 监听进程退出事件进行清理（不主动处理SIGINT/SIGTERM，让主进程处理）
    const cleanup = async () => {
      if (isCleaningUp) {
        return; // 避免重复执行清理
      }
      isCleaningUp = true;
      
      console.log('进程退出时清理代理进程...');
      if (this.proxyProcess && !this.proxyProcess.killed) {
        try {
          // 发送终止信号
          this.proxyProcess.kill('SIGTERM');
          
          // 等待进程优雅关闭
          await new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
              if (this.proxyProcess && !this.proxyProcess.killed) {
                console.log('强制终止代理进程');
                this.proxyProcess.kill('SIGKILL');
              }
              resolve();
            }, 3000);

            this.proxyProcess.on('close', () => {
              clearTimeout(timeoutId);
              resolve();
            });
          });
          
          this.isRunning = false;
          this.proxyProcess = null;
          console.log('✅ 代理进程清理完成');
        } catch (error) {
          console.error('清理代理进程时发生错误:', error);
        }
      }
    };

    // 只监听进程退出事件，不主动处理信号（让主进程统一处理）
    process.on('exit', cleanup);    // 进程退出时清理
    
    // 监听未捕获异常时进行清理
    process.on('uncaughtException', (error) => {
      console.error('未捕获的异常:', error);
      cleanup().then(() => {
        // 给主进程一点时间处理
        setTimeout(() => process.exit(1), 100);
      });
    });
  }

  // 启动代理服务器
  async startProxy(serverId) {
    try {
      // 检查是否已经在运行同一个服务器
      if (this.isRunning && this.serverId === serverId) {
        throw new Error('代理服务器已在运行');
      }

      // 如果在运行其他服务器，先停止
      if (this.isRunning && this.serverId !== serverId) {
        console.log('停止当前运行的代理服务器...');
        await this.stopProxy();
      }

      // 从数据库获取服务器配置
      const [serverConfig] = await sequelize.query(
        'SELECT * FROM proxy_servers WHERE id = ?',
        { replacements: [serverId] }
      );

      if (!serverConfig || serverConfig.length === 0) {
        throw new Error('服务器配置不存在');
      }

      const config = serverConfig[0];
      
      // 启动前清理可能的残留进程
      await this.cleanupStaleProcesses(config.http_port);
      
      // 设置环境变量
      const env = {
        ...process.env,
        PROXY_HOST: config.domain || '0.0.0.0',
        PROXY_HTTP_PORT: config.http_port,
        PROXY_HTTPS_PORT: config.https_port || 8083,
        PROXY_SSL_ENABLED: config.ssl_enabled ? 'true' : 'false',
        PROXY_SERVER_ID: serverId, // 传递服务器ID
        DB_HOST: process.env.DB_HOST,
        DB_PORT: process.env.DB_PORT,
        DB_NAME: process.env.DB_NAME,
        DB_USER: process.env.DB_USER,
        DB_PASSWORD: process.env.DB_PASSWORD
      };

      // 启动代理进程
      const proxyPath = path.join(__dirname, '../proxy/start.js');
      this.proxyProcess = spawn('node', [proxyPath], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false // 确保子进程不会脱离主进程
      });

      // 监听进程输出
      this.proxyProcess.stdout.on('data', (data) => {
        console.log(`代理服务器: ${data.toString().trim()}`);
      });

      this.proxyProcess.stderr.on('data', (data) => {
        console.error(`代理服务器错误: ${data.toString().trim()}`);
      });

      // 监听进程退出
      this.proxyProcess.on('close', (code) => {
        console.log(`代理服务器进程退出，代码: ${code}`);
        this.isRunning = false;
        this.proxyProcess = null;
        if (this.serverId) {
          this.updateServerStatus(this.serverId, 'stopped');
          this.serverId = null;
        }
      });

      // 监听进程错误
      this.proxyProcess.on('error', (error) => {
        console.error('代理服务器进程错误:', error);
        this.isRunning = false;
        this.proxyProcess = null;
        if (this.serverId) {
          this.updateServerStatus(this.serverId, 'stopped');
          this.serverId = null;
        }
      });

      // 等待进程启动
      await new Promise((resolve, reject) => {
        let started = false;
        
        // 监听启动成功的输出
        this.proxyProcess.stdout.on('data', (data) => {
          const output = data.toString();
          if (output.includes('代理服务器启动成功') && !started) {
            started = true;
            resolve();
          }
        });

        // 监听启动错误
        this.proxyProcess.stderr.on('data', (data) => {
          const error = data.toString();
          if ((error.includes('Error') || error.includes('EADDRINUSE')) && !started) {
            started = true;
            // 如果是端口占用，先清理残留进程
            if (error.includes('EADDRINUSE')) {
              reject(new Error(`端口被占用，请先清理残留进程: ${error}`));
            } else {
              reject(new Error(`代理服务器启动失败: ${error}`));
            }
          }
        });

        // 监听进程退出（启动失败）
        this.proxyProcess.on('close', (code) => {
          if (!started) {
            started = true;
            reject(new Error(`代理服务器启动失败，退出代码: ${code}`));
          }
        });

        // 超时检查
        setTimeout(() => {
          if (!started) {
            started = true;
            reject(new Error('代理服务器启动超时，可能端口被占用'));
          }
        }, 15000); // 增加超时时间
      });

      this.isRunning = true;
      this.serverId = serverId;

      // 更新数据库状态
      await this.updateServerStatus(serverId, 'running');

      return { success: true, message: '代理服务器启动成功' };
    } catch (error) {
      console.error('启动代理服务器失败:', error);
      throw error;
    }
  }

  // 停止代理服务器
  async stopProxy() {
    try {
      if (!this.isRunning || !this.proxyProcess) {
        // 同步数据库状态
        if (this.serverId) {
          await this.updateServerStatus(this.serverId, 'stopped');
          this.serverId = null;
        }
        return { success: true, message: '代理服务器已停止' };
      }

      const currentServerId = this.serverId;

      // 检查进程是否已经被杀死
      if (this.proxyProcess.killed) {
        this.isRunning = false;
        this.proxyProcess = null;
        if (currentServerId) {
          await this.updateServerStatus(currentServerId, 'stopped');
          this.serverId = null;
        }
        return { success: true, message: '代理服务器已停止' };
      }

      // 优雅关闭
      this.proxyProcess.kill('SIGTERM');
      
      // 等待进程结束
      await new Promise((resolve) => {
        let resolved = false;
        
        const timeoutId = setTimeout(() => {
          if (!resolved && this.proxyProcess && !this.proxyProcess.killed) {
            console.log('强制终止代理服务器进程');
            this.proxyProcess.kill('SIGKILL');
          }
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }, 5000);

        this.proxyProcess.on('close', () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            resolve();
          }
        });
        
        this.proxyProcess.on('exit', () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            resolve();
          }
        });
      });

      this.isRunning = false;
      this.proxyProcess = null;

      // 更新数据库状态
      if (currentServerId) {
        await this.updateServerStatus(currentServerId, 'stopped');
        this.serverId = null;
      }

      return { success: true, message: '代理服务器停止成功' };
    } catch (error) {
      console.error('停止代理服务器失败:', error);
      
      // 强制清理状态
      this.isRunning = false;
      this.proxyProcess = null;
      if (this.serverId) {
        await this.updateServerStatus(this.serverId, 'stopped');
        this.serverId = null;
      }
      
      throw error;
    }
  }

  // 获取代理服务器状态
  getStatus() {
    return {
      isRunning: this.isRunning,
      serverId: this.serverId,
      pid: this.proxyProcess ? this.proxyProcess.pid : null
    };
  }

  // 更新数据库中的服务器状态
  async updateServerStatus(serverId, status) {
    try {
      await sequelize.query(
        'UPDATE proxy_servers SET status = ?, updated_at = NOW() WHERE id = ?',
        { replacements: [status, serverId] }
      );
    } catch (error) {
      console.error('更新服务器状态失败:', error);
    }
  }

  // 获取用户认证信息（供代理服务器调用）
  async getUserAuth(username) {
    try {
      const [results] = await sequelize.query(
        'SELECT username, password, status, max_connections FROM proxy_users WHERE username = ? AND status = "active"',
        { replacements: [username] }
      );
      
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error('获取用户认证信息失败:', error);
      return null;
    }
  }

  // 记录连接日志
  async logConnection(username, clientIP, targetHost, action = 'connect') {
    try {
      await sequelize.query(
        'INSERT INTO connection_logs (username, client_ip, target_host, action, created_at) VALUES (?, ?, ?, ?, NOW())',
        { replacements: [username, clientIP, targetHost, action] }
      );
    } catch (error) {
      console.error('记录连接日志失败:', error);
    }
  }

  // 清理可能的残留进程
  async cleanupStaleProcesses(port) {
    try {
      console.log(`🧹 检查端口 ${port} 是否被占用...`);
      const { spawn } = require('child_process');
      
      // 强制清理可能占用端口的代理进程
      await new Promise((resolve) => {
        const killProcess = spawn('pkill', ['-f', 'server/proxy/start.js'], {
          stdio: 'pipe'
        });
        
        killProcess.on('close', (code) => {
          if (code === 0) {
            console.log('🗑️  清理了残留的代理进程');
          }
          resolve();
        });
        
        // 超时保护
        setTimeout(() => {
          killProcess.kill();
          resolve();
        }, 2000);
      });
      
      // 等待端口释放
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error('清理残留进程时发生错误:', error);
    }
  }
}

// 单例模式
const proxyService = new ProxyService();

module.exports = proxyService; 