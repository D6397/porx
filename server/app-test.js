require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.ADMIN_PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

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
try {
  const authRoutes = require('./routes/auth');
  const userRoutes = require('./routes/users');
  const proxyRoutes = require('./routes/proxy');

  // 使用路由
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/proxy', proxyRoutes);
} catch (error) {
  console.error('路由加载错误:', error.message);
}

// 简单的根路由
app.get('/', (req, res) => {
  res.json({ message: '隧道代理后台管理系统' });
});

// 启动服务器
app.listen(PORT, () => {
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
});

module.exports = app; 