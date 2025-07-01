#!/usr/bin/env node

const { spawn } = require('child_process');
const fetch = require('node:http').request;

console.log('🔄 正在重启服务器...');

// 检查服务器是否正在运行
const checkServer = () => {
  return new Promise((resolve) => {
    const req = fetch('http://localhost:3000/api/health', (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
};

async function restartServer() {
  const isRunning = await checkServer();
  
  if (isRunning) {
    console.log('⚠️ 检测到服务器正在运行');
    console.log('请手动停止服务器 (Ctrl+C) 然后运行:');
    console.log('   node server/app.js');
    console.log('');
    console.log('或者使用以下命令强制重启:');
    console.log('   pkill -f "node server/app.js" && node server/app.js');
  } else {
    console.log('✅ 启动服务器...');
    const serverProcess = spawn('node', ['server/app.js'], {
      stdio: 'inherit',
      detached: false
    });
    
    serverProcess.on('error', (error) => {
      console.error('❌ 启动失败:', error.message);
    });
  }
}

restartServer(); 