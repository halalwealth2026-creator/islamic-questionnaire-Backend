import { Router } from 'express';
import {
  exportResponses,
  getDashboardStats,
  getResponseById,
  listResponses,
  loginAdmin
} from '../controllers/adminController.js';
import { requireAdmin } from '../middleware/auth.js';
import { adminApiLimiter, loginLimiter } from '../middleware/rateLimiters.js';

const router = Router();

router.post('/login', loginLimiter, loginAdmin);

router.use(requireAdmin);
router.use(adminApiLimiter);

router.get('/dashboard', getDashboardStats);
router.get('/stats', getDashboardStats);
router.get('/responses/export', exportResponses);
router.get('/responses', listResponses);
router.get('/responses/:id', getResponseById);

export default router;
