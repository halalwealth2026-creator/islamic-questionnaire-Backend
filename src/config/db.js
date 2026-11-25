import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
  await mongoose.connect(env.mongodbUri, {
    dbName: env.dbName,
    serverSelectionTimeoutMS: 10000
  });
  return mongoose.connection;
}

export function getDatabaseStatus() {
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
}
