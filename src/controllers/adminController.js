import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import Submission from '../models/Submission.js';
import { env } from '../config/env.js';
import { QUESTION_DEFINITIONS } from '../utils/questions.js';
import { buildResponsesCsv } from '../utils/csv.js';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseDateBound(raw, endOfDay = false) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildSubmissionFilter(query) {
  const filter = {};
  const search = String(query.search || '').trim().slice(0, 100);

  if (search) {
    const regex = escapeRegex(search);
    filter.$or = [
      { submissionId: { $regex: regex, $options: 'i' } },
      { 'answers.answerText': { $regex: regex, $options: 'i' } },
      { 'basicInfo.name': { $regex: regex, $options: 'i' } },
      { 'basicInfo.email': { $regex: regex, $options: 'i' } },
      { 'basicInfo.phone': { $regex: regex, $options: 'i' } }
    ];
  }

  if (query.language === 'ta' || query.language === 'en') {
    filter.language = query.language;
  }

  const start = parseDateBound(query.startDate, false);
  const end = parseDateBound(query.endDate, true);
  if (start || end) {
    filter.createdAt = {};
    if (start) filter.createdAt.$gte = start;
    if (end) filter.createdAt.$lte = end;
  }

  return filter;
}

export async function loginAdmin(req, res, next) {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    if (email !== env.adminEmail) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const passwordMatches = await bcrypt.compare(password, admin.passwordHash).catch(() => false);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    const token = jwt.sign(
      { sub: admin._id.toString(), role: 'admin', email: admin.email },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    return res.json({
      token,
      admin: { email: admin.email }
    });
  } catch (error) {
    return next(error);
  }
}

export async function getDashboardStats(_req, res, next) {
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6);

    const [totalSubmissions, todaySubmissions, weekSubmissions, tamilCount, englishCount, latest] =
      await Promise.all([
        Submission.countDocuments(),
        Submission.countDocuments({ createdAt: { $gte: startOfToday } }),
        Submission.countDocuments({ createdAt: { $gte: startOfWeek } }),
        Submission.countDocuments({ language: 'ta' }),
        Submission.countDocuments({ language: 'en' }),
        Submission.findOne().sort({ createdAt: -1 }).select('createdAt submittedAt').lean()
      ]);

    return res.json({
      totalSubmissions,
      todaySubmissions,
      weekSubmissions,
      tamilCount,
      englishCount,
      latestSubmissionAt: latest ? latest.submittedAt || latest.createdAt : null,
      total: totalSubmissions,
      today: todaySubmissions
    });
  } catch (error) {
    return next(error);
  }
}

export async function listResponses(req, res, next) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 15));
    const filter = buildSubmissionFilter(req.query);

    const [docs, total] = await Promise.all([
      Submission.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('submissionId language basicInfo submittedAt createdAt answers')
        .lean(),
      Submission.countDocuments(filter)
    ]);

    const items = docs.map((doc) => {
      const findAnswer = (qId) => doc.answers?.find((a) => a.questionId === qId)?.answerText || '';
      return {
        submissionId: doc.submissionId,
        language: doc.language || 'ta',
        basicInfo: doc.basicInfo || null,
        submittedAt: doc.submittedAt || doc.createdAt,
        createdAt: doc.createdAt,
        preview: {
          gender: findAnswer('question_1'),
          age: findAnswer('question_2'),
          location: findAnswer('question_6')
        }
      };
    });

    return res.json({
      items,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit))
    });
  } catch (error) {
    return next(error);
  }
}

export async function getResponseById(req, res, next) {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ message: 'Submission ID is required.' });
    }

    const query = mongoose.isValidObjectId(id)
      ? { $or: [{ submissionId: id }, { _id: id }] }
      : { submissionId: id };

    const item = await Submission.findOne(query).lean();
    if (!item) {
      return res.status(404).json({ message: 'Submission not found.' });
    }

    return res.json(item);
  } catch (error) {
    return next(error);
  }
}

export async function exportResponses(req, res, next) {
  try {
    const filter = buildSubmissionFilter(req.query);
    const rows = await Submission.find(filter).sort({ createdAt: -1 }).lean();
    const csvContent = buildResponsesCsv(rows, QUESTION_DEFINITIONS);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="questionnaire-responses.csv"');
    return res.send(csvContent);
  } catch (error) {
    return next(error);
  }
}
