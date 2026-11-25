import { env, validateEnv } from './config/env.js';
import { connectDatabase } from './config/db.js';
import { syncAdminFromEnv } from './models/Admin.js';
import app from './app.js';

try {
  validateEnv();
  await connectDatabase();
  await syncAdminFromEnv();
  console.log(`MongoDB connected to database "${env.dbName}".`);

  app.listen(env.port, () => {
    console.log(`API listening on port ${env.port} (${env.nodeEnv})`);
  });
} catch (error) {
  console.error('Server startup failed:', error.message);
  process.exit(1);
}
