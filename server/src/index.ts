import app from './app';
import { config } from './config';
import { initDb } from './db';

async function start() {
  // 初始化数据库
  console.log('Initializing database...');
  await initDb();
  console.log('Database initialized successfully.');

  // 启动服务器
  app.listen(config.port, () => {
    console.log(`\n🚀 Interview Coach Server running at http://localhost:${config.port}`);
    console.log(`📋 Health check: http://localhost:${config.port}/api/health`);
    console.log(`💾 Database: ${config.db.path}\n`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
