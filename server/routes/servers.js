const express = require('express');
const sequelize = require('../models');
const proxyService = require('../services/proxyService');
const {
  validateServerId
} = require('../config/security');

const router = express.Router();

// 获取代理服务器列表
router.get('/', async (req, res) => {
  try {
    const [results] = await sequelize.query('SELECT * FROM proxy_servers ORDER BY created_at DESC');
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('获取服务器列表错误:', error);
    res.status(500).json({ error: '获取服务器列表失败' });
  }
});

// 创建代理服务器
router.post('/', async (req, res) => {
  try {
    const { name, http_port, https_port, domain, ssl_enabled = false } = req.body;
    
    if (!name || !http_port) {
      return res.status(400).json({ error: '名称和HTTP端口不能为空' });
    }
    
    // 检查端口是否已被使用
    const [existingPorts] = await sequelize.query(
      'SELECT * FROM proxy_servers WHERE http_port = ? OR https_port = ?',
      { replacements: [http_port, https_port || 0] }
    );
    
    if (existingPorts.length > 0) {
      return res.status(400).json({ error: '端口已被使用' });
    }
    
    await sequelize.query(
      'INSERT INTO proxy_servers (name, http_port, https_port, domain, ssl_enabled) VALUES (?, ?, ?, ?, ?)',
      { replacements: [name, http_port, https_port || null, domain || null, ssl_enabled] }
    );
    
    res.json({ success: true, message: '代理服务器创建成功' });
  } catch (error) {
    console.error('创建服务器错误:', error);
    res.status(500).json({ error: '创建代理服务器失败' });
  }
});

// 更新代理服务器
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, http_port, https_port, domain, ssl_enabled } = req.body;
    
    if (!name || !http_port) {
      return res.status(400).json({ error: '名称和HTTP端口不能为空' });
    }
    
    // 检查端口是否已被其他服务器使用
    const [existingPorts] = await sequelize.query(
      'SELECT * FROM proxy_servers WHERE (http_port = ? OR https_port = ?) AND id != ?',
      { replacements: [http_port, https_port || 0, id] }
    );
    
    if (existingPorts.length > 0) {
      return res.status(400).json({ error: '端口已被其他服务器使用' });
    }
    
    const [result] = await sequelize.query(
      'UPDATE proxy_servers SET name = ?, http_port = ?, https_port = ?, domain = ?, ssl_enabled = ? WHERE id = ?',
      { replacements: [name, http_port, https_port || null, domain || null, ssl_enabled, id] }
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '代理服务器不存在' });
    }
    
    res.json({ success: true, message: '代理服务器更新成功' });
  } catch (error) {
    console.error('更新服务器错误:', error);
    res.status(500).json({ error: '更新代理服务器失败' });
  }
});

// 获取代理服务器实时状态
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取数据库中的状态
    const [servers] = await sequelize.query(
      'SELECT * FROM proxy_servers WHERE id = ?',
      { replacements: [id] }
    );
    
    if (servers.length === 0) {
      return res.status(404).json({ error: '代理服务器不存在' });
    }
    
    const server = servers[0];
    
    // 获取实际运行状态
    const runtimeStatus = proxyService.getStatus();
    
    res.json({
      success: true,
      data: {
        ...server,
        runtime: runtimeStatus
      }
    });
  } catch (error) {
    console.error('获取服务器状态错误:', error);
    res.status(500).json({ error: '获取服务器状态失败' });
  }
});

// 启动代理服务器
router.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取服务器配置
    const [servers] = await sequelize.query(
      'SELECT * FROM proxy_servers WHERE id = ?',
      { replacements: [id] }
    );
    
    if (servers.length === 0) {
      return res.status(404).json({ error: '代理服务器不存在' });
    }
    
    const server = servers[0];
    
    // 获取实际运行状态
    const runtimeStatus = proxyService.getStatus();
    
    // 检查是否已经在运行同一个服务器
    if (runtimeStatus.isRunning && runtimeStatus.serverId === parseInt(id)) {
      return res.status(400).json({ error: '代理服务器已在运行' });
    }
    
    // 启动实际的代理服务
    try {
      const result = await proxyService.startProxy(id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } catch (error) {
    console.error('启动服务器错误:', error);
    res.status(500).json({ error: '启动代理服务器失败' });
  }
});

// 停止代理服务器
router.post('/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取服务器配置
    const [servers] = await sequelize.query(
      'SELECT * FROM proxy_servers WHERE id = ?',
      { replacements: [id] }
    );
    
    if (servers.length === 0) {
      return res.status(404).json({ error: '代理服务器不存在' });
    }
    
    const server = servers[0];
    
    // 获取实际运行状态
    const runtimeStatus = proxyService.getStatus();
    
    // 检查是否真的在运行
    if (!runtimeStatus.isRunning) {
      return res.status(400).json({ error: '代理服务器未在运行' });
    }
    
    // 停止实际的代理服务
    try {
      const result = await proxyService.stopProxy();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } catch (error) {
    console.error('停止服务器错误:', error);
    res.status(500).json({ error: '停止代理服务器失败' });
  }
});

module.exports = router; 