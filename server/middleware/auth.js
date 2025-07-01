const jwt = require('jsonwebtoken');
const sequelize = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret_key';

// 调试：检查JWT密钥
console.log('认证中间件JWT密钥:', JWT_SECRET ? 'JWT_SECRET已设置' : 'JWT_SECRET未设置');

const requireAuth = async (req, res, next) => {
  try {
    console.log('认证中间件被调用:', req.url);
    const authHeader = req.headers.authorization;
    console.log('Authorization header:', authHeader ? `Bearer ${authHeader.substring(7, 20)}...` : '无');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('认证失败: 缺少或格式错误的令牌');
      return res.status(401).json({ error: '缺少认证令牌' });
    }
    
    const token = authHeader.substring(7);
    console.log('提取的token长度:', token.length);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('JWT解码成功:', { id: decoded.id, username: decoded.username });
      
      // 验证用户是否仍然存在
      const [users] = await sequelize.query(
        'SELECT id, username FROM admin_users WHERE id = ? AND status = "active"',
        { replacements: [decoded.id] }
      );
      
      console.log('数据库查询结果用户数量:', users.length);
      
      if (users.length === 0) {
        console.log('认证失败: 用户不存在或已被禁用');
        return res.status(401).json({ error: '用户不存在或已被禁用' });
      }
      
      req.user = users[0];
      console.log('认证成功:', req.user.username);
      next();
    } catch (jwtError) {
      console.log('JWT验证失败:', jwtError.message);
      return res.status(401).json({ error: '无效的认证令牌' });
    }
  } catch (error) {
    console.error('认证中间件错误:', error);
    return res.status(500).json({ error: '认证验证失败' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const [users] = await sequelize.query(
          'SELECT id, username FROM admin_users WHERE id = ? AND status = "active"',
          { replacements: [decoded.id] }
        );
        
        if (users.length > 0) {
          req.user = users[0];
        }
      } catch (jwtError) {
        // 忽略JWT错误，继续请求
      }
    }
    
    next();
  } catch (error) {
    console.error('可选认证中间件错误:', error);
    next();
  }
};

module.exports = {
  requireAuth,
  optionalAuth
}; 