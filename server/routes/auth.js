const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sequelize = require('../models');

const router = express.Router();

// 登录接口
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    // 查询用户
    const [results] = await sequelize.query(
      'SELECT * FROM admin_users WHERE username = ? AND status = "active"',
      { replacements: [username] }
    );
    
    if (results.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    const user = results[0];
    
    // 验证密码
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    // 生成Token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // 更新最后登录时间
    await sequelize.query(
      'UPDATE admin_users SET updated_at = NOW() WHERE id = ?',
      { replacements: [user.id] }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

// 登出接口
router.post('/logout', (req, res) => {
  res.json({ success: true, message: '登出成功' });
});

// 获取用户信息
router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: '未提供访问令牌' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [results] = await sequelize.query(
      'SELECT id, username, role, status FROM admin_users WHERE id = ? AND status = "active"',
      { replacements: [decoded.id] }
    );
    
    if (results.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json({ success: true, user: results[0] });
  } catch (error) {
    res.status(403).json({ error: '令牌无效' });
  }
});

// 获取当前用户信息（别名）
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: '未提供访问令牌' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [results] = await sequelize.query(
      'SELECT id, username, role, status FROM admin_users WHERE id = ? AND status = "active"',
      { replacements: [decoded.id] }
    );
    
    if (results.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json({ success: true, user: results[0] });
  } catch (error) {
    res.status(403).json({ error: '令牌无效' });
  }
});

module.exports = router; 