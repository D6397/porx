const express = require('express');
const sequelize = require('../models');

const router = express.Router();

// 获取实时统计
router.get('/', async (req, res) => {
  try {
    // 获取活跃用户数
    const [userCount] = await sequelize.query('SELECT COUNT(*) as count FROM proxy_users WHERE status = "active"');
    
    // 获取今日连接数
    const [todayConnections] = await sequelize.query(
      'SELECT COUNT(*) as count FROM connection_logs WHERE DATE(created_at) = CURDATE()'
    );
    
    // 获取运行中的服务器数
    const [runningServers] = await sequelize.query('SELECT COUNT(*) as count FROM proxy_servers WHERE status = "running"');
    
    // 获取总流量（今日）- 改为连接数统计
    const [todayTraffic] = await sequelize.query(
      'SELECT COUNT(*) as total FROM connection_logs WHERE DATE(created_at) = CURDATE()'
    );
    
    res.json({
      success: true,
      data: {
        activeUsers: userCount[0].count,
        todayConnections: todayConnections[0].count,
        runningServers: runningServers[0].count,
        todayTraffic: todayTraffic[0].total,
        systemStatus: 'running',
        uptime: process.uptime()
      }
    });
  } catch (error) {
    console.error('获取统计信息错误:', error);
    res.status(500).json({ error: '获取统计信息失败' });
  }
});

// 获取系统日志统计
router.get('/logs', async (req, res) => {
  try {
    // 获取今日日志统计
    const [todayStats] = await sequelize.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN action = 'connect' THEN 1 END) as connections,
        COUNT(CASE WHEN action = 'auth_success' THEN 1 END) as successful_auths,
        COUNT(CASE WHEN action = 'auth_failed' THEN 1 END) as failed_auths,
        COUNT(CASE WHEN action = 'error' THEN 1 END) as errors
       FROM connection_logs 
       WHERE DATE(created_at) = CURDATE()`
    );

    // 获取小时级别统计
    const [hourlyStats] = await sequelize.query(
      `SELECT 
        HOUR(created_at) as hour,
        COUNT(*) as count
       FROM connection_logs 
       WHERE DATE(created_at) = CURDATE()
       GROUP BY HOUR(created_at)
       ORDER BY hour`
    );

    // 获取最近7天统计
    const [weeklyStats] = await sequelize.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
       FROM connection_logs 
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date`
    );

    // 获取热门目标主机
    const [topHosts] = await sequelize.query(
      `SELECT 
        target_host,
        COUNT(*) as count
       FROM connection_logs 
       WHERE DATE(created_at) = CURDATE() AND target_host IS NOT NULL
       GROUP BY target_host
       ORDER BY count DESC
       LIMIT 10`
    );

    res.json({
      success: true,
      data: {
        today: todayStats[0],
        hourly: hourlyStats,
        weekly: weeklyStats,
        topHosts: topHosts
      }
    });
  } catch (error) {
    console.error('获取日志统计错误:', error);
    res.status(500).json({ error: '获取日志统计失败' });
  }
});

module.exports = router; 