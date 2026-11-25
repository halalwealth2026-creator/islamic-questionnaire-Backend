import { env } from '../config/env.js';

function applyCorsHeadersIfAllowed(req, res) {
  const origin = req?.headers?.origin;
  if (!origin) return;
  const normalizedOrigin = origin.trim().replace(/\/$/, '');
  if (env.allowedOrigins.includes(normalizedOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', normalizedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.append('Vary', 'Origin');
  }
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ message: 'Route not found.' });
}

export function errorHandler(error, req, res, _next) {
  if (error?.message?.includes('CORS')) {
    return res.status(403).json({ message: 'Origin is not allowed to access this API.' });
  }

  applyCorsHeadersIfAllowed(req, res);

  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON request body.' });
  }

  if (error?.name === 'ValidationError') {
    const firstMessage = Object.values(error.errors || {})[0]?.message;
    return res.status(400).json({ message: firstMessage || 'Validation failed.' });
  }

  console.error('Unhandled server error:', error?.message || error);
  return res.status(500).json({ message: 'An unexpected server error occurred.' });
}
