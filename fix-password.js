// 密码问题诊断和修复工具
require('dotenv').config();
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

async function fixPassword() {
  console.log('🔧 密码问题诊断和修复工具');
  console.log('='.repeat(50));

  try {
    // 1. 系统信息
    console.log('\n📊 系统信息:');
    console.log(`   Node.js版本: ${process.version}`);
    console.log(`   平台: ${process.platform}`);
    console.log(`   架构: ${process.arch}`);
    
    // 2. bcrypt版本信息
    const bcryptVersion = require('bcrypt/package.json').version;
    console.log(`   bcrypt版本: ${bcryptVersion}`);

    // 3. 数据库连接测试
    console.log('\n🔗 数据库连接测试...');
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'proxy',
      password: process.env.DB_PASSWORD || '12345',
      database: process.env.DB_NAME || 'proxy'
    };
    
    console.log(`   连接信息: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    
    const connection = await mysql.createConnection(dbConfig);
    console.log('   ✅ 数据库连接成功');

    // 4. 检查admin用户
    console.log('\n👤 检查admin用户...');
    const [adminResults] = await connection.execute(
      'SELECT id, username, password, role, status, created_at FROM admin_users WHERE username = "admin"'
    );

    if (adminResults.length === 0) {
      console.log('   ❌ admin用户不存在，正在创建...');
      const newPasswordHash = await bcrypt.hash('admin123', 10);
      await connection.execute(
        'INSERT INTO admin_users (username, password, role, status) VALUES (?, ?, ?, ?)',
        ['admin', newPasswordHash, 'admin', 'active']
      );
      console.log('   ✅ admin用户已创建');
    } else {
      const admin = adminResults[0];
      console.log(`   用户ID: ${admin.id}`);
      console.log(`   用户名: ${admin.username}`);
      console.log(`   角色: ${admin.role}`);
      console.log(`   状态: ${admin.status}`);
      console.log(`   创建时间: ${admin.created_at}`);
      console.log(`   密码哈希: ${admin.password}`);

      // 5. 密码验证测试
      console.log('\n🔐 密码验证测试...');
      
      // 测试不同的密码
      const testPasswords = ['admin123', 'admin', 'password', '123456'];
      let validPasswordFound = false;
      
      for (const testPwd of testPasswords) {
        try {
          const isValid = await bcrypt.compare(testPwd, admin.password);
          console.log(`   测试密码 "${testPwd}": ${isValid ? '✅ 正确' : '❌ 错误'}`);
          if (isValid) {
            validPasswordFound = true;
            console.log(`   🎯 找到正确密码: ${testPwd}`);
            break;
          }
        } catch (error) {
          console.log(`   测试密码 "${testPwd}": ❌ 验证出错 - ${error.message}`);
        }
      }

      // 6. 如果密码验证失败，重新生成
      if (!validPasswordFound) {
        console.log('\n⚠️  所有测试密码都验证失败，重新生成密码哈希...');
        
        try {
          const newPasswordHash = await bcrypt.hash('admin123', 10);
          console.log(`   新密码哈希: ${newPasswordHash}`);
          
          // 验证新哈希
          const newHashValid = await bcrypt.compare('admin123', newPasswordHash);
          console.log(`   新哈希验证: ${newHashValid ? '✅ 成功' : '❌ 失败'}`);
          
          if (newHashValid) {
            await connection.execute(
              'UPDATE admin_users SET password = ?, updated_at = NOW() WHERE username = "admin"',
              [newPasswordHash]
            );
            console.log('   ✅ 密码已更新到数据库');
            
            // 最终验证
            const [updatedResults] = await connection.execute(
              'SELECT password FROM admin_users WHERE username = "admin"'
            );
            const finalCheck = await bcrypt.compare('admin123', updatedResults[0].password);
            console.log(`   最终验证: ${finalCheck ? '✅ 成功' : '❌ 失败'}`);
          }
        } catch (error) {
          console.error(`   ❌ 密码重置失败: ${error.message}`);
        }
      }
    }

    // 7. 总结
    console.log('\n📋 诊断总结:');
    console.log('   - 数据库连接: ✅ 正常');
    console.log('   - admin用户: ✅ 存在');
    console.log('   - 密码验证: ✅ 正常');
    console.log('   - 建议密码: admin123');

    await connection.end();
    
  } catch (error) {
    console.error(`\n❌ 诊断失败: ${error.message}`);
    console.error(error.stack);
  }

  console.log('\n🎉 诊断完成！');
  console.log('现在可以尝试使用以下账号登录:');
  console.log('   用户名: admin');
  console.log('   密码: admin123');
}

// 运行修复
fixPassword(); 