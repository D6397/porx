require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const DatabaseInitializer = require('./utils/database-init');

const app = express();
const PORT = process.env.ADMIN_PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 访问日志中间件
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', async () => {
    const duration = Date.now() - start;
    const { router: logsRoutes, logSystem } = require('./routes/logs');
    
    await logSystem.access(`${req.method} ${req.originalUrl}`, {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length') || 0
    });
  });
  
  next();
});

// 静态文件服务 - 直接服务web/public目录
app.use(express.static(path.join(__dirname, '../web/public')));
// 静态文件服务 - 服务web/src目录用于组件文件
app.use('/src', express.static(path.join(__dirname, '../web/src')));

// 基础路由
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: '隧道代理后台管理系统运行正常',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// 导入路由
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const proxyRoutes = require('./routes/proxy');
const { router: logsRoutes, logSystem } = require('./routes/logs');

// 使用路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/logs', logsRoutes);

// SSL证书管理路由（简化版）
app.get('/api/ssl/certificates', (req, res) => {
  res.json({ success: true, data: [], message: 'SSL证书管理功能开发中' });
});

// 404处理
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API接口不存在' });
});

// 前端路由支持 - 所有非API路由都返回index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../web/public/index.html'));
});

// 错误处理中间件
app.use(async (err, req, res, next) => {
  console.error('服务器错误:', err);
  
  // 记录错误日志
  try {
    const { logSystem } = require('./routes/logs');
    await logSystem.error(err.message, {
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
  } catch (logError) {
    console.error('记录错误日志失败:', logError);
  }
  
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动函数
async function startServer() {
  try {
    // 1. 数据库自动初始化
    console.log('🔄 正在检查数据库状态...');
    const dbInitializer = new DatabaseInitializer();
    const initSuccess = await dbInitializer.autoInit();
    
    if (!initSuccess) {
      console.error('❌ 数据库初始化失败，无法启动服务器');
      process.exit(1);
    }
    
    // 2. 启动HTTP服务器
    const server = app.listen(PORT, async () => {
      console.log('🚀 ========================================');
      console.log('🚀 隧道代理后台管理系统启动成功！');
      console.log('🚀 ========================================');
      console.log(`📍 管理界面: http://localhost:${PORT}`);
      console.log(`🔗 API文档: http://localhost:${PORT}/api/health`);
      console.log(`🗃️ 数据库: ${process.env.DB_NAME} @ ${process.env.DB_HOST}:${process.env.DB_PORT}`);
      console.log('🚀 ========================================');
      
      // 显示默认账号信息
      console.log('');
      console.log('🔑 默认账号信息：');
      console.log('   管理员: admin / admin123');
      console.log('   测试用户: test_user / admin123');
      console.log('');
      
      // 记录应用启动日志
      try {
        const { logSystem } = require('./routes/logs');
        await logSystem.info('隧道代理后台管理系统启动成功', {
          port: PORT,
          environment: process.env.NODE_ENV || 'development',
          nodeVersion: process.version,
          platform: process.platform
        });
      } catch (logError) {
        console.error('记录启动日志失败:', logError);
      }
    });
    
    return server;
  } catch (error) {
    console.error('❌ 启动服务器失败:', error.message);
    process.exit(1);
  }
}

// 优雅关闭处理（将在启动后重新定义）
let isShuttingDown = false;

// 监听未捕获的异常
process.on('uncaughtException', async (error) => {
  console.error('💥 未捕获的异常:', error);
  
  try {
    const { logSystem } = require('./routes/logs');
    await logSystem.error('未捕获的异常', {
      message: error.message,
      stack: error.stack
    });
  } catch (logError) {
    console.error('记录异常日志失败:', logError);
  }
  
  process.exit(1);
});

// 监听未处理的Promise拒绝
process.on('unhandledRejection', async (reason, promise) => {
  console.error('💥 未处理的Promise拒绝:', reason);
  
  try {
    const { logSystem } = require('./routes/logs');
    await logSystem.error('未处理的Promise拒绝', {
      reason: reason,
      promise: promise
    });
  } catch (logError) {
    console.error('记录Promise拒绝日志失败:', logError);
  }
  
  process.exit(1);
});

// 启动服务器
let server;
if (require.main === module) {
  // 只有在直接运行此文件时才启动服务器
  startServer().then(s => {
    server = s;
    
    // 重新定义优雅关闭处理，使用正确的server实例
    const gracefulShutdownWithServer = async (signal) => {
      if (isShuttingDown) {
        return;
      }
      isShuttingDown = true;
      
      console.log(`\n🛑 收到 ${signal} 信号，开始优雅关闭主服务器...`);
      
      try {
        // 先强制清理所有代理进程
        console.log('🔄 正在清理代理进程...');
        
        // 方法1：使用proxyService清理
        const proxyService = require('./services/proxyService');
        const status = proxyService.getStatus();
        if (status.isRunning && status.pid) {
          try {
            console.log(`🔫 停止代理进程 PID: ${status.pid}`);
            await proxyService.stopProxy();
            console.log('✅ 代理进程清理完成');
          } catch (error) {
            console.error('proxyService清理失败:', error.message);
          }
        }
        
        // 方法2：强制清理所有相关进程
        try {
          const { spawn } = require('child_process');
          
          // 查找并清理所有代理进程
          await new Promise((resolve) => {
            const killProcess = spawn('pkill', ['-f', 'server/proxy/start.js'], {
              stdio: 'inherit'
            });
            
            killProcess.on('close', (code) => {
              if (code === 0) {
                console.log('🗑️  强制清理了残留的代理进程');
              }
              resolve();
            });
            
            // 超时保护
            setTimeout(() => {
              killProcess.kill();
              resolve();
            }, 3000);
          });
        } catch (error) {
          console.error('强制清理进程失败:', error.message);
        }
        
        // 停止接受新的连接
        server.close(async () => {
          console.log('📴 HTTP服务器已关闭');
          
          try {
            // 记录关闭日志
            const { logSystem } = require('./routes/logs');
            await logSystem.info(`隧道代理后台管理系统收到 ${signal} 信号，正在关闭`, {
              signal: signal,
              uptime: process.uptime()
            });
          } catch (logError) {
            console.error('记录关闭日志失败:', logError);
          }
          
          console.log('✅ 主服务器已完全关闭');
          process.exit(0);
        });
        
        // 设置强制退出超时
        setTimeout(() => {
          console.log('⚠️  强制退出主服务器（超时）');
          process.exit(1);
        }, 8000);
        
      } catch (error) {
        console.error('关闭主服务器时发生错误:', error);
        process.exit(1);
      }
    };
    
    // 重新绑定信号处理器
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.on('SIGINT', () => gracefulShutdownWithServer('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdownWithServer('SIGTERM'));
    
  }).catch(error => {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  });
}

module.exports = app; 