const express = require('express');
const sequelize = require('../models');
const {
  FILE_UPLOAD_CONFIG,
  safeDeleteFile,
  validateServerId
} = require('../config/security');

const router = express.Router();

// 导入SSL路由处理函数
const sslRouter = require('./ssl');

// 删除代理服务器（安全版本）
router.delete('/servers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证服务器ID
    const serverIdValidation = validateServerId(id);
    if (!serverIdValidation.valid) {
      return res.status(400).json({ error: serverIdValidation.error });
    }
    
    // 检查服务器状态
    const [server] = await sequelize.query(
      'SELECT status, cert_path, key_path FROM proxy_servers WHERE id = ?',
      { replacements: [id] }
    );
    
    if (server.length === 0) {
      return res.status(404).json({ error: '代理服务器不存在' });
    }
    
    if (server[0].status === 'running') {
      return res.status(400).json({ error: '请先停止代理服务器再删除' });
    }
    
    const sslBaseDir = FILE_UPLOAD_CONFIG.ssl.uploadDir;
    let deleteWarnings = [];
    
    // 安全删除SSL证书文件
    const serverData = server[0];
    if (serverData.cert_path) {
      const certResult = await safeDeleteFile(serverData.cert_path, sslBaseDir);
      if (!certResult.success) {
        deleteWarnings.push(`证书文件删除失败: ${certResult.error}`);
        console.warn('删除证书文件失败:', certResult.error);
      }
    }
    if (serverData.key_path) {
      const keyResult = await safeDeleteFile(serverData.key_path, sslBaseDir);
      if (!keyResult.success) {
        deleteWarnings.push(`私钥文件删除失败: ${keyResult.error}`);
        console.warn('删除密钥文件失败:', keyResult.error);
      }
    }
    
    // 删除数据库记录
    await sequelize.query('DELETE FROM proxy_servers WHERE id = ?', { replacements: [id] });
    
    // 返回结果
    if (deleteWarnings.length > 0) {
      res.json({ 
        success: true, 
        message: '代理服务器删除成功，但部分SSL文件删除失败',
        warnings: deleteWarnings
      });
    } else {
      res.json({ success: true, message: '代理服务器删除成功' });
    }
  } catch (error) {
    console.error('删除服务器错误:', error);
    res.status(500).json({ error: '删除代理服务器失败' });
  }
});

// 挂载服务器管理路由
router.use('/servers', require('./servers'));

// SSL证书路由 - 保持原有API路径
router.use('/servers', sslRouter);

// 统计路由
router.use('/stats', require('./stats'));

module.exports = router; 