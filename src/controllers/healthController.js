import { getDatabaseStatus } from '../config/db.js';

export function getHealth(_req, res) {
  const database = getDatabaseStatus();
  res.status(200).json({
    status: database === 'connected' ? 'ok' : 'degraded',
    database,
    timestamp: new Date().toISOString()
  });
}
