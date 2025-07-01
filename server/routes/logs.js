const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// 使用认证中间件
router.use(requireAuth);

// 系统日志配置
const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILES = {
  app: 'app.log',
  error: 'error.log',
  access: 'access.log'
};

// 确保日志目录存在
const ensureLogDir = async () => {
  try {
    await fs.access(LOG_DIR);
  } catch {
    await fs.mkdir(LOG_DIR, { recursive: true });
  }
};

// 写入日志到文件
const writeLog = async (type, level, message, metadata = {}) => {
  await ensureLogDir();
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...metadata
  };
  
  const logFile = path.join(LOG_DIR, LOG_FILES[type] || LOG_FILES.app);
  const logLine = JSON.stringify(logEntry) + '\n';
  
  try {
    await fs.appendFile(logFile, logLine);
  } catch (error) {
    console.error(`写入日志失败: ${error.message}`);
  }
};

// 读取日志文件
const readLogFile = async (type, lines = 100) => {
  const logFile = path.join(LOG_DIR, LOG_FILES[type]);
  
  try {
    const data = await fs.readFile(logFile, 'utf-8');
    const logLines = data.trim().split('\n').filter(line => line);
    const recentLines = logLines.slice(-lines);
    
    return recentLines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: line
        };
      }
    });
  } catch (error) {
    return [];
  }
};

// 获取系统日志
router.get('/system', async (req, res) => {
  try {
    const { type = 'app', lines = 100, level } = req.query;
    
    if (!LOG_FILES[type]) {
      return res.status(400).json({ error: '无效的日志类型' });
    }
    
    let logs = await readLogFile(type, parseInt(lines));
    
    // 按级别过滤
    if (level && level !== 'all') {
      logs = logs.filter(log => log.level === level);
    }
    
    res.json({
      success: true,
      data: logs.reverse(), // 最新的在前面
      total: logs.length
    });
  } catch (error) {
    console.error('获取系统日志错误:', error);
    res.status(500).json({ error: '获取系统日志失败' });
  }
});

// 获取日志文件列表和大小
router.get('/files', async (req, res) => {
  try {
    await ensureLogDir();
    const files = await fs.readdir(LOG_DIR);
    const logFiles = [];
    
    for (const file of files) {
      if (file.endsWith('.log')) {
        const filePath = path.join(LOG_DIR, file);
        const stats = await fs.stat(filePath);
        logFiles.push({
          name: file,
          size: stats.size,
          modified: stats.mtime,
          type: Object.keys(LOG_FILES).find(key => LOG_FILES[key] === file) || 'other'
        });
      }
    }
    
    res.json({
      success: true,
      data: logFiles
    });
  } catch (error) {
    console.error('获取日志文件列表错误:', error);
    res.status(500).json({ error: '获取日志文件列表失败' });
  }
});

// 清理日志文件
router.delete('/cleanup', async (req, res) => {
  try {
    const { type, days = 7 } = req.body;
    
    if (type && !LOG_FILES[type]) {
      return res.status(400).json({ error: '无效的日志类型' });
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const filesToClean = type ? [LOG_FILES[type]] : Object.values(LOG_FILES);
    let cleanedFiles = 0;
    
    for (const file of filesToClean) {
      const filePath = path.join(LOG_DIR, file);
      try {
        const stats = await fs.stat(filePath);
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          cleanedFiles++;
        }
      } catch (error) {
        // 文件不存在，忽略
      }
    }
    
    res.json({
      success: true,
      message: `成功清理 ${cleanedFiles} 个日志文件`,
      cleanedFiles
    });
  } catch (error) {
    console.error('清理日志文件错误:', error);
    res.status(500).json({ error: '清理日志文件失败' });
  }
});

// 下载日志文件
router.get('/download/:type', async (req, res) => {
  try {
    const { type } = req.params;
    
    if (!LOG_FILES[type]) {
      return res.status(400).json({ error: '无效的日志类型' });
    }
    
    const filePath = path.join(LOG_DIR, LOG_FILES[type]);
    
    try {
      await fs.access(filePath);
      res.download(filePath, `${type}-${new Date().toISOString().split('T')[0]}.log`);
    } catch (error) {
      res.status(404).json({ error: '日志文件不存在' });
    }
  } catch (error) {
    console.error('下载日志文件错误:', error);
    res.status(500).json({ error: '下载日志文件失败' });
  }
});

// 记录应用日志
router.post('/write', async (req, res) => {
  try {
    const { type = 'app', level = 'info', message, metadata = {} } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: '消息内容不能为空' });
    }
    
    await writeLog(type, level, message, {
      ...metadata,
      user: req.user?.username,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: '日志记录成功'
    });
  } catch (error) {
    console.error('写入日志错误:', error);
    res.status(500).json({ error: '写入日志失败' });
  }
});

// 实时日志流（简化版）
router.get('/stream/:type', async (req, res) => {
  try {
    const { type } = req.params;
    
    if (!LOG_FILES[type]) {
      return res.status(400).json({ error: '无效的日志类型' });
    }
    
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    
    // 发送初始数据
    const recentLogs = await readLogFile(type, 10);
    res.write(`data: ${JSON.stringify({ type: 'initial', logs: recentLogs })}\n\n`);
    
    // 定期发送心跳
    const heartbeat = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
    }, 30000);
    
    req.on('close', () => {
      clearInterval(heartbeat);
    });
    
  } catch (error) {
    console.error('日志流错误:', error);
    res.status(500).json({ error: '日志流失败' });
  }
});

// 导出日志工具函数
const logSystem = {
  info: (message, metadata) => writeLog('app', 'info', message, metadata),
  warn: (message, metadata) => writeLog('app', 'warn', message, metadata),
  error: (message, metadata) => writeLog('error', 'error', message, metadata),
  access: (message, metadata) => writeLog('access', 'info', message, metadata)
};

module.exports = { router, logSystem }; 