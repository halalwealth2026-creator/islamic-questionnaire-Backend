import { Router } from 'express';
import { submitQuestionnaire } from '../controllers/questionnaireController.js';
import { submissionLimiter } from '../middleware/rateLimiters.js';

const router = Router();

router.post('/submit', submissionLimiter, submitQuestionnaire);

export default router;
