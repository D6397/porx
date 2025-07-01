#!/usr/bin/env node

// 代理服务器启动脚本
require('dotenv').config();

const ProxyServer = require('./core/ProxyServer');

// 全局错误处理，防止进程崩溃
process.on('uncaughtException', (error) => {
  console.error('[%s] [error] 未捕获的异常:', new Date().toISOString(), error.message);
  console.error(error.stack);
  // 不退出进程，继续运行
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[%s] [error] 未处理的Promise拒绝:', new Date().toISOString(), reason);
  // 不退出进程，继续运行
});

async function startProxy() {
  try {
    // 从命令行参数或环境变量获取配置
    let host = process.env.PROXY_HOST || process.argv[2] || '0.0.0.0';
    const httpPort = parseInt(process.env.PROXY_HTTP_PORT || process.argv[3]) || 8082;
    const httpsPort = parseInt(process.env.PROXY_HTTPS_PORT || process.argv[4]) || 8083;
    const sslEnabled = (process.env.PROXY_SSL_ENABLED || process.argv[5]) === 'true';
    const serverId = process.env.PROXY_SERVER_ID ? parseInt(process.env.PROXY_SERVER_ID) : null;

    // 强制使用本地监听地址，不绑定到域名IP
    // 如果指定了域名，只用于显示，实际监听使用 0.0.0.0
    let displayHost = host;
    if (host !== '0.0.0.0' && host !== 'localhost') {
      try {
        const dns = require('dns');
        await new Promise((resolve, reject) => {
          dns.lookup(host, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        console.log(`✅ 域名解析成功: ${host}`);
        displayHost = host;
        // 强制使用 0.0.0.0 进行本地监听
        host = '0.0.0.0';
      } catch (error) {
        console.log(`⚠️  域名解析失败: ${host}, 使用本地监听`);
        displayHost = host;
        host = '0.0.0.0';
      }
    }

    const config = {
      server: {
        host: host, // 实际监听地址
        httpPort: httpPort,
        httpsPort: httpsPort,
      },
      ssl: {
        enabled: sslEnabled
      },
      serverId: serverId // 传递服务器ID
    };

    console.log('🚀 正在启动代理服务器...');
    console.log(`📍 配置: ${displayHost}:${config.server.httpPort}`);
    console.log(`📡 监听: ${config.server.host}:${config.server.httpPort}`);
    
    if (config.ssl.enabled) {
      console.log(`📍 HTTPS: ${displayHost}:${config.server.httpsPort}`);
    }

    // 创建并启动代理服务器
    const proxyServer = new ProxyServer(config);
    
    // 设置优雅关闭
    proxyServer.setupGracefulShutdown();
    
    // 启动服务器
    const result = await proxyServer.start();
    
    if (result.success) {
      console.log('✅ 代理服务器启动成功！');
      
      // 保持进程运行
      process.stdin.resume();
    } else {
      console.error('❌ 代理服务器启动失败:', result.message);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ 启动代理服务器时发生错误:', error.message);
    process.exit(1);
  }
}

// 运行启动函数
if (require.main === module) {
  startProxy();
}

module.exports = { startProxy }; 