const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sequelize = require('../models');
const {
  FILE_UPLOAD_CONFIG,
  generateSecureFilename,
  validatePath,
  validateFilename,
  validateFileExtension,
  validateFileContent,
  safeDeleteFile,
  validateServerId
} = require('../config/security');

const router = express.Router();

// 配置SSL证书文件上传（安全版本）
const sslStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const config = FILE_UPLOAD_CONFIG.ssl;
      const uploadDir = config.uploadDir;
      
      // 确保ssl目录存在
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.mkdir(path.join(uploadDir, config.subDirs.cert), { recursive: true });
      await fs.mkdir(path.join(uploadDir, config.subDirs.key), { recursive: true });
      
      // 根据文件类型选择目录
      let targetDir;
      if (file.fieldname === 'cert') {
        targetDir = path.join(uploadDir, config.subDirs.cert);
      } else if (file.fieldname === 'key') {
        targetDir = path.join(uploadDir, config.subDirs.key);
      } else {
        return cb(new Error('不支持的文件类型'));
      }
      
      // 验证路径安全性
      if (!validatePath(uploadDir, targetDir)) {
        return cb(new Error('路径验证失败'));
      }
      
      cb(null, targetDir);
    } catch (error) {
      console.error('创建SSL目录失败:', error);
      cb(new Error('目录创建失败'));
    }
  },
  filename: (req, file, cb) => {
    try {
      // 验证服务器ID
      const serverIdValidation = validateServerId(req.params.id);
      if (!serverIdValidation.valid) {
        return cb(new Error(serverIdValidation.error));
      }
      
      // 验证文件名
      const filenameValidation = validateFilename(file.originalname);
      if (!filenameValidation.valid) {
        return cb(new Error(filenameValidation.error));
      }
      
      // 验证文件扩展名
      const config = FILE_UPLOAD_CONFIG.ssl;
      const extValidation = validateFileExtension(file.originalname, config.allowedExtensions);
      if (!extValidation.valid) {
        return cb(new Error(extValidation.error));
      }
      
      // 生成安全的文件名
      const ext = path.extname(file.originalname).toLowerCase();
      const secureFilename = generateSecureFilename(req.params.id, file.fieldname, ext);
      cb(null, secureFilename);
    } catch (error) {
      cb(new Error('文件名生成失败'));
    }
  }
});

const sslUpload = multer({
  storage: sslStorage,
  limits: {
    fileSize: FILE_UPLOAD_CONFIG.ssl.maxFileSize,
    files: FILE_UPLOAD_CONFIG.ssl.maxFiles,
    fields: 0, // 不允许额外字段
    parts: 10 // 限制表单部分数量
  },
  fileFilter: (req, file, cb) => {
    try {
      const config = FILE_UPLOAD_CONFIG.ssl;
      
      // 验证文件扩展名
      const extValidation = validateFileExtension(file.originalname, config.allowedExtensions);
      if (!extValidation.valid) {
        return cb(new Error(extValidation.error));
      }
      
      // 检查文件字段名
      if (file.fieldname !== 'cert' && file.fieldname !== 'key') {
        return cb(new Error('无效的文件字段'));
      }
      
      // 检查MIME类型（基础检查）
      if (file.mimetype && !config.allowedMimeTypes.includes(file.mimetype)) {
        console.warn(`可疑的MIME类型: ${file.mimetype} for file: ${file.originalname}`);
      }
      
      cb(null, true);
    } catch (error) {
      cb(new Error('文件验证失败'));
    }
  }
});

// 清理临时文件的函数
const cleanupTempFiles = async (files) => {
  if (!files) return;
  
  const allFiles = [];
  if (files.cert) allFiles.push(...files.cert);
  if (files.key) allFiles.push(...files.key);
  
  for (const file of allFiles) {
    try {
      await fs.unlink(file.path);
    } catch (error) {
      console.error('清理临时文件失败:', error);
    }
  }
};

// SSL证书上传（安全版本）
router.post('/:id/ssl-upload', sslUpload.fields([
  { name: 'cert', maxCount: 1 },
  { name: 'key', maxCount: 1 }
]), async (req, res) => {
  let uploadedFiles = req.files;
  
  try {
    const { id } = req.params;
    
    // 验证服务器ID
    const serverIdValidation = validateServerId(id);
    if (!serverIdValidation.valid) {
      await cleanupTempFiles(uploadedFiles);
      return res.status(400).json({ error: serverIdValidation.error });
    }
    
    // 检查服务器是否存在和状态
    const [servers] = await sequelize.query(
      'SELECT * FROM proxy_servers WHERE id = ?',
      { replacements: [id] }
    );
    
    if (servers.length === 0) {
      await cleanupTempFiles(uploadedFiles);
      return res.status(404).json({ error: '代理服务器不存在' });
    }
    
    const server = servers[0];
    if (server.status === 'running') {
      await cleanupTempFiles(uploadedFiles);
      return res.status(400).json({ error: '请先停止代理服务器再上传SSL证书' });
    }
    
    if (!uploadedFiles || (!uploadedFiles.cert && !uploadedFiles.key)) {
      await cleanupTempFiles(uploadedFiles);
      return res.status(400).json({ error: '请上传证书文件或密钥文件' });
    }
    
    let updateFields = [];
    let updateValues = [];
    let validatedFiles = [];
    
    // 处理并验证证书文件
    if (uploadedFiles.cert && uploadedFiles.cert[0]) {
      const certFile = uploadedFiles.cert[0];
      
      // 验证文件内容
      const validation = await validateFileContent(certFile.path, 'cert');
      if (!validation.valid) {
        await cleanupTempFiles(uploadedFiles);
        return res.status(400).json({ error: validation.error });
      }
      
      updateFields.push('cert_file_name = ?', 'cert_path = ?');
      updateValues.push(certFile.originalname, certFile.path);
      validatedFiles.push(certFile);
    }
    
    // 处理并验证密钥文件
    if (uploadedFiles.key && uploadedFiles.key[0]) {
      const keyFile = uploadedFiles.key[0];
      
      // 验证文件内容
      const validation = await validateFileContent(keyFile.path, 'key');
      if (!validation.valid) {
        await cleanupTempFiles(uploadedFiles);
        return res.status(400).json({ error: validation.error });
      }
      
      updateFields.push('key_file_name = ?', 'key_path = ?');
      updateValues.push(keyFile.originalname, keyFile.path);
      validatedFiles.push(keyFile);
    }
    
    // 添加上传时间
    updateFields.push('cert_uploaded_at = NOW()');
    updateValues.push(id);
    
    // 删除旧的证书文件（如果存在）
    if (server.cert_path && uploadedFiles.cert) {
      try {
        await fs.unlink(server.cert_path);
      } catch (error) {
        console.warn('删除旧证书文件失败:', error.message);
      }
    }
    if (server.key_path && uploadedFiles.key) {
      try {
        await fs.unlink(server.key_path);
      } catch (error) {
        console.warn('删除旧密钥文件失败:', error.message);
      }
    }
    
    // 更新数据库
    const updateQuery = `UPDATE proxy_servers SET ${updateFields.join(', ')} WHERE id = ?`;
    await sequelize.query(updateQuery, { replacements: updateValues });
    
    res.json({ 
      success: true, 
      message: 'SSL证书上传成功',
      files: {
        cert: uploadedFiles.cert ? uploadedFiles.cert[0].originalname : null,
        key: uploadedFiles.key ? uploadedFiles.key[0].originalname : null
      }
    });
  } catch (error) {
    // 清理上传的文件
    await cleanupTempFiles(uploadedFiles);
    
    console.error('SSL证书上传错误:', error);
    
    // 不泄露敏感错误信息
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: '文件大小超出限制（最大10MB）' });
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({ error: '文件数量超出限制' });
    } else if (error.message.includes('不支持') || error.message.includes('无效') || error.message.includes('格式')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'SSL证书上传失败' });
    }
  }
});

// 删除SSL证书（保留服务器配置）
router.delete('/:id/ssl', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证服务器ID
    const serverIdValidation = validateServerId(id);
    if (!serverIdValidation.valid) {
      return res.status(400).json({ error: serverIdValidation.error });
    }
  
    // 获取服务器信息
    const [servers] = await sequelize.query(
      'SELECT cert_path, key_path, status FROM proxy_servers WHERE id = ?',
      { replacements: [id] }
    );
    
    if (servers.length === 0) {
      return res.status(404).json({ error: '代理服务器不存在' });
    }
    
    const server = servers[0];
    
    // 检查服务器是否在运行
    if (server.status === 'running') {
      return res.status(400).json({ error: '请先停止代理服务器再删除SSL证书' });
    }
    
    const sslBaseDir = FILE_UPLOAD_CONFIG.ssl.uploadDir;
    let deleteErrors = [];
    
    // 安全删除SSL证书文件
    if (server.cert_path) {
      const certResult = await safeDeleteFile(server.cert_path, sslBaseDir);
      if (!certResult.success) {
        deleteErrors.push(`证书文件删除失败: ${certResult.error}`);
        console.warn('删除证书文件失败:', certResult.error);
      }
    }
    
    if (server.key_path) {
      const keyResult = await safeDeleteFile(server.key_path, sslBaseDir);
      if (!keyResult.success) {
        deleteErrors.push(`私钥文件删除失败: ${keyResult.error}`);
        console.warn('删除密钥文件失败:', keyResult.error);
      }
    }
    
    // 清空数据库中的SSL相关字段
    await sequelize.query(
      'UPDATE proxy_servers SET cert_file_name = NULL, key_file_name = NULL, cert_path = NULL, key_path = NULL, cert_expire_date = NULL, cert_uploaded_at = NULL WHERE id = ?',
      { replacements: [id] }
    );
    
    // 返回结果
    if (deleteErrors.length > 0) {
      res.json({ 
        success: true, 
        message: 'SSL证书删除完成，但部分文件删除失败',
        warnings: deleteErrors
      });
    } else {
      res.json({ success: true, message: 'SSL证书删除成功' });
    }
  } catch (error) {
    console.error('删除SSL证书错误:', error);
    res.status(500).json({ error: '删除SSL证书失败' });
  }
});

module.exports = router; 