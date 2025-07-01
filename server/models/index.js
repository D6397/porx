const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  dialect: 'mysql',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// 测试数据库连接
sequelize.authenticate()
  .then(() => {
    console.log('✅ 数据库连接成功');
  })
  .catch(err => {
    console.error('❌ 数据库连接失败:', err.message);
  });

module.exports = sequelize; 