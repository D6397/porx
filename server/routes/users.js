const express = require('express');
const bcrypt = require('bcrypt');
const sequelize = require('../models');

const router = express.Router();

// 获取代理用户列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    let params = [];
    
    if (search) {
      whereClause = 'WHERE username LIKE ?';
      params.push(`%${search}%`);
    }
    
    // 获取总数
    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM proxy_users ${whereClause}`,
      { replacements: params }
    );
    
    // 获取数据
    const [results] = await sequelize.query(
      `SELECT id, username, status, max_connections, expire_date, created_at, updated_at 
       FROM proxy_users ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      { replacements: [...params, parseInt(limit), offset] }
    );
    
    res.json({ 
      success: true, 
      data: results,
      pagination: {
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 创建代理用户
router.post('/', async (req, res) => {
  try {
    const { username, password, max_connections = 10, expire_date } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: '用户名长度必须在3-20个字符之间' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度不能少于6个字符' });
    }
    
    // 密码加密
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await sequelize.query(
      'INSERT INTO proxy_users (username, password, max_connections, expire_date) VALUES (?, ?, ?, ?)',
      { replacements: [username, hashedPassword, max_connections, expire_date || null] }
    );
    
    res.json({ success: true, message: '用户创建成功' });
  } catch (error) {
    console.error('创建用户错误:', error);
    if (error.parent?.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: '用户名已存在' });
    } else {
      res.status(500).json({ error: '创建用户失败' });
    }
  }
});

// 更新代理用户
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, max_connections, expire_date, status } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: '用户名不能为空' });
    }
    
    let query = 'UPDATE proxy_users SET username = ?, max_connections = ?, expire_date = ?, status = ?';
    let params = [username, max_connections, expire_date || null, status];
    
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: '密码长度不能少于6个字符' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }
    
    query += ' WHERE id = ?';
    params.push(id);
    
    const [result] = await sequelize.query(query, { replacements: params });
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json({ success: true, message: '用户更新成功' });
  } catch (error) {
    console.error('更新用户错误:', error);
    if (error.parent?.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: '用户名已存在' });
    } else {
      res.status(500).json({ error: '更新用户失败' });
    }
  }
});

// 删除代理用户
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 先删除相关的连接日志
    await sequelize.query('DELETE FROM connection_logs WHERE proxy_user_id = ?', { replacements: [id] });
    
    // 删除用户
    const [result] = await sequelize.query('DELETE FROM proxy_users WHERE id = ?', { replacements: [id] });
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json({ success: true, message: '用户删除成功' });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

// 批量操作
router.post('/batch', async (req, res) => {
  try {
    const { action, ids } = req.body;
    
    if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '参数无效' });
    }
    
    const placeholders = ids.map(() => '?').join(',');
    
    switch (action) {
      case 'enable':
        await sequelize.query(
          `UPDATE proxy_users SET status = 'active' WHERE id IN (${placeholders})`,
          { replacements: ids }
        );
        res.json({ success: true, message: '用户批量启用成功' });
        break;
        
      case 'disable':
        await sequelize.query(
          `UPDATE proxy_users SET status = 'inactive' WHERE id IN (${placeholders})`,
          { replacements: ids }
        );
        res.json({ success: true, message: '用户批量禁用成功' });
        break;
        
      case 'delete':
        // 先删除相关的连接日志
        await sequelize.query(
          `DELETE FROM connection_logs WHERE proxy_user_id IN (${placeholders})`,
          { replacements: ids }
        );
        // 删除用户
        await sequelize.query(
          `DELETE FROM proxy_users WHERE id IN (${placeholders})`,
          { replacements: ids }
        );
        res.json({ success: true, message: '用户批量删除成功' });
        break;
        
      default:
        res.status(400).json({ error: '不支持的操作' });
    }
  } catch (error) {
    console.error('批量操作错误:', error);
    res.status(500).json({ error: '批量操作失败' });
  }
});

module.exports = router; 