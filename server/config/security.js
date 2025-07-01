// 安全配置文件
const path = require('path');
const crypto = require('crypto');

// 文件上传安全配置
const FILE_UPLOAD_CONFIG = {
  // SSL证书上传
  ssl: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 2,
    allowedExtensions: ['.pem', '.crt', '.cer', '.key', '.txt'],
    allowedMimeTypes: [
      'application/x-pem-file',
      'application/x-x509-ca-cert',
      'application/pkcs8',
      'text/plain',
      'application/octet-stream'
    ],
    uploadDir: path.resolve(__dirname, '../../ssl'),
    subDirs: {
      cert: 'certs',
      key: 'keys'
    }
  }
};

// 文件内容验证规则
const FILE_VALIDATION_PATTERNS = {
  cert: [
    /-----BEGIN CERTIFICATE-----/,
    /-----BEGIN TRUSTED CERTIFICATE-----/
  ],
  key: [
    /-----BEGIN PRIVATE KEY-----/,
    /-----BEGIN RSA PRIVATE KEY-----/,
    /-----BEGIN EC PRIVATE KEY-----/
  ]
};

// 安全的文件名生成
const generateSecureFilename = (serverId, fileType, originalExt) => {
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const safeExt = originalExt.replace(/[^a-zA-Z0-9.]/g, '');
  
  return `${fileType}-${serverId}-${timestamp}-${randomBytes}${safeExt}`;
};

// 路径遍历防护
const validatePath = (basePath, targetPath) => {
  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(targetPath);
  
  return resolvedTarget.startsWith(resolvedBase);
};

// 文件名安全验证
const validateFilename = (filename) => {
  if (!filename || filename.length > 255) {
    return { valid: false, error: '文件名无效或过长' };
  }
  
  // 检查危险字符
  const dangerousChars = /[<>:"|?*\x00-\x1f]/;
  if (dangerousChars.test(filename)) {
    return { valid: false, error: '文件名包含非法字符' };
  }
  
  // 检查路径遍历攻击
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return { valid: false, error: '文件名包含路径字符' };
  }
  
  // 检查保留名称（Windows）
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
  if (reservedNames.test(filename)) {
    return { valid: false, error: '文件名为系统保留名称' };
  }
  
  return { valid: true };
};

// 文件扩展名验证
const validateFileExtension = (filename, allowedExtensions) => {
  const ext = path.extname(filename).toLowerCase();
  
  if (!allowedExtensions.includes(ext)) {
    return { valid: false, error: `不支持的文件格式，只允许: ${allowedExtensions.join(', ')}` };
  }
  
  return { valid: true };
};

// 文件内容验证
const validateFileContent = async (filePath, fileType) => {
  const fs = require('fs').promises;
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const patterns = FILE_VALIDATION_PATTERNS[fileType];
    
    if (!patterns) {
      return { valid: false, error: '未知的文件类型' };
    }
    
    const isValid = patterns.some(pattern => pattern.test(content));
    
    if (!isValid) {
      return { valid: false, error: `无效的${fileType === 'cert' ? '证书' : '私钥'}文件格式` };
    }
    
    // 检查文件大小（内容长度）
    if (content.length > FILE_UPLOAD_CONFIG.ssl.maxFileSize) {
      return { valid: false, error: '文件内容过大' };
    }
    
    // 检查是否包含敏感信息
    if (content.toLowerCase().includes('password') || content.toLowerCase().includes('passphrase')) {
      console.warn(`警告: 文件可能包含密码信息: ${filePath}`);
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: '文件内容读取失败或格式错误' };
  }
};

// 安全的文件删除
const safeDeleteFile = async (filePath, baseDir) => {
  const fs = require('fs').promises;
  
  if (!filePath) return { success: true };
  
  try {
    // 验证文件路径安全性
    if (!validatePath(baseDir, filePath)) {
      return { success: false, error: '文件路径不安全' };
    }
    
    // 检查文件是否存在
    await fs.access(filePath);
    
    // 删除文件
    await fs.unlink(filePath);
    
    return { success: true };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { success: true }; // 文件不存在，认为删除成功
    }
    return { success: false, error: error.message };
  }
};

// 服务器ID验证
const validateServerId = (id) => {
  if (!id || !/^\d+$/.test(id)) {
    return { valid: false, error: '无效的服务器ID' };
  }
  
  const numericId = parseInt(id, 10);
  if (numericId <= 0 || numericId > 2147483647) { // MySQL INT max value
    return { valid: false, error: '服务器ID超出范围' };
  }
  
  return { valid: true };
};

module.exports = {
  FILE_UPLOAD_CONFIG,
  FILE_VALIDATION_PATTERNS,
  generateSecureFilename,
  validatePath,
  validateFilename,
  validateFileExtension,
  validateFileContent,
  safeDeleteFile,
  validateServerId
}; 