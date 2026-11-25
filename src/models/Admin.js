import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

const adminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin'], default: 'admin' },
    lastLoginAt: { type: Date, default: null }
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'admins'
  }
);

const Admin = mongoose.model('Admin', adminSchema, 'admins');

/**
 * Ensures the configured environment admin exists in the `admins` collection
 * without modifying or deleting any other collections or records.
 */
export async function syncAdminFromEnv() {
  if (!env.adminEmail) return;

  let passwordHash = env.adminPasswordHash;
  if (!passwordHash && env.adminPassword) {
    passwordHash = await bcrypt.hash(env.adminPassword, 12);
  }
  if (!passwordHash) return;

  await Admin.updateOne(
    { email: env.adminEmail },
    { $set: { email: env.adminEmail, passwordHash, role: 'admin' } },
    { upsert: true }
  );
}

export default Admin;
