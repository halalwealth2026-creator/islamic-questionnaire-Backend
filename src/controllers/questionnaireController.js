import { randomUUID } from 'node:crypto';
import Submission from '../models/Submission.js';
import { QUESTION_DEFINITIONS, resolveSelectLabels } from '../utils/questions.js';

const STRICT_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const STRICT_PHONE_REGEX = /^\d{10}$/;

const MESSAGES = {
  ta: {
    basicInfoRequired: 'பங்கேற்பாளர் விவரங்கள் (பெயர், மின்னஞ்சல், தொலைபேசி எண்) அவசியம்.',
    invalidName: 'தயவுசெய்து உங்கள் முழுப் பெயரை உள்ளிடவும் (அதிகபட்சம் 120 எழுத்துகள்).',
    invalidEmail: 'சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும் (எ.கா: example@gmail.com).',
    invalidPhone: 'தொலைபேசி எண் சரியாக 10 இலக்க எண்களாக மட்டுமே இருக்க வேண்டும் (எ.கா: 9876543210).',
    invalidAnswersPayload: 'அனைத்து கேள்வித்தாள் பதில்களும் தேவை.',
    requiredQuestion: (num) => `கேள்வி ${num}-க்குப் பதிலளிக்கவும்.`,
    requiredSelect: (num) => `கேள்வி ${num}-க்கு ஒரு விருப்பத்தைத் தேர்ந்தெடுக்கவும்.`,
    invalidOption: (num) => `கேள்வி ${num}-க்கு சரியான விருப்பத்தைத் தேர்ந்தெடுக்கவும்.`,
    requiredOther: (num) => `கேள்வி ${num}-இல் "மற்றவை" என்பதற்கு உங்கள் பதிலை குறிப்பிடவும்.`,
    invalidNumber: (num, min, max) => `கேள்வி ${num}-க்கு ${min} முதல் ${max} வரை உள்ள எண்ணை உள்ளிடவும்.`,
    maxLength: (num) => `கேள்வி ${num} பதில் 10,000 எழுத்துகளுக்குள் இருக்க வேண்டும்.`,
    success: 'உங்கள் பதில்கள் வெற்றிகரமாகச் சமர்ப்பிக்கப்பட்டுள்ளன.'
  },
  en: {
    basicInfoRequired: 'Participant information (Full Name, Email, and Phone Number) is required.',
    invalidName: 'Please enter your full name (maximum 120 characters).',
    invalidEmail: 'Please enter a valid email address (e.g., example@gmail.com).',
    invalidPhone: 'Phone number must be exactly 10 digits with numbers only (e.g., 9876543210).',
    invalidAnswersPayload: 'Questionnaire answers are required.',
    requiredQuestion: (num) => `Please answer question ${num}.`,
    requiredSelect: (num) => `Please select an option for question ${num}.`,
    invalidOption: (num) => `Please select a valid option for question ${num}.`,
    requiredOther: (num) => `Please specify your answer for "Other" in question ${num}.`,
    invalidNumber: (num, min, max) => `Please enter a number between ${min} and ${max} for question ${num}.`,
    maxLength: (num) => `Answer for question ${num} must be under 10,000 characters.`,
    success: 'Your responses have been submitted successfully.'
  }
};

function generateSubmissionId() {
  const timePart = Date.now().toString(36).toUpperCase();
  const randomPart = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `ISQ-${timePart}-${randomPart}`;
}

export async function submitQuestionnaire(req, res, next) {
  try {
    const body = req.body || {};
    const language = body.language === 'en' ? 'en' : 'ta';
    const msg = MESSAGES[language];

    const { basicInfo, answers, responses } = body;

    let normalizedBasicInfo;
    if (basicInfo !== undefined && basicInfo !== null) {
      if (typeof basicInfo !== 'object' || Array.isArray(basicInfo)) {
        return res.status(400).json({ message: msg.basicInfoRequired });
      }

      const name = typeof basicInfo.name === 'string' ? basicInfo.name.trim() : '';
      const email = typeof basicInfo.email === 'string' ? basicInfo.email.trim().toLowerCase() : '';
      const phone = typeof basicInfo.phone === 'string' ? basicInfo.phone.trim() : '';

      if (name || email || phone) {
        if (name && name.length > 120) {
          return res.status(400).json({ message: msg.invalidName, field: 'name' });
        }

        if (email && (email.length > 254 || email.includes('..') || !STRICT_EMAIL_REGEX.test(email))) {
          return res.status(400).json({ message: msg.invalidEmail, field: 'email' });
        }

        if (phone && !STRICT_PHONE_REGEX.test(phone)) {
          return res.status(400).json({ message: msg.invalidPhone, field: 'phone' });
        }

        normalizedBasicInfo = {
          ...(name ? { name } : {}),
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {})
        };
      }
    }

    // Preserve legacy 10-question format compatibility if ever posted
    if (!Array.isArray(answers) && Array.isArray(responses) && responses.length === 10) {
      const normalizedLegacy = responses.map((item, idx) => ({
        id: Number(item?.id) || idx + 1,
        question: String(item?.question || '').trim(),
        answer: typeof item?.answer === 'string' ? item.answer.trim() : ''
      }));
      if (!normalizedLegacy.every((r) => r.question && r.answer && r.answer.length <= 10000)) {
        return res.status(400).json({ message: msg.invalidAnswersPayload });
      }
      const submission = await Submission.create({
        submissionId: generateSubmissionId(),
        language,
        ...(normalizedBasicInfo ? { basicInfo: normalizedBasicInfo } : {}),
        responses: normalizedLegacy,
        submittedAt: new Date()
      });
      return res.status(201).json({
        success: true,
        message: msg.success,
        submissionId: submission.submissionId,
        language: submission.language,
        submittedAt: submission.submittedAt || submission.createdAt
      });
    }

    if (!Array.isArray(answers)) {
      return res.status(400).json({ message: msg.invalidAnswersPayload });
    }

    const submittedMap = new Map();
    for (const entry of answers) {
      if (entry && typeof entry.questionId === 'string') {
        submittedMap.set(entry.questionId.trim(), entry);
      }
    }

    const normalizedAnswers = [];

    for (const def of QUESTION_DEFINITIONS) {
      const incoming = submittedMap.get(def.id);
      const rawValue = incoming?.answer;

      if (def.type === 'select') {
        const selected = typeof rawValue === 'string' ? rawValue.trim() : '';
        if (!selected) {
          return res.status(400).json({
            message: msg.requiredSelect(def.number),
            questionId: def.id
          });
        }

        const allowed = new Set((def.options || []).map((opt) => opt.value));
        if (!allowed.has(selected)) {
          return res.status(400).json({
            message: msg.invalidOption(def.number),
            questionId: def.id
          });
        }

        const isOther = selected === 'other';
        let otherText = '';
        if (isOther) {
          otherText = typeof incoming?.otherText === 'string' ? incoming.otherText.trim() : '';
          if (!otherText) {
            return res.status(400).json({
              message: msg.requiredOther(def.number),
              questionId: def.id,
              isOtherError: true
            });
          }
          if (otherText.length > 10000) {
            return res.status(400).json({
              message: msg.maxLength(def.number),
              questionId: def.id,
              isOtherError: true
            });
          }
        }

        const labels = resolveSelectLabels(def, selected, otherText, language);
        normalizedAnswers.push({
          questionId: def.id,
          number: def.number,
          questionTa: def.question.ta,
          questionEn: def.question.en,
          type: def.type,
          answer: selected,
          answerText: labels.answerText,
          answerLabelTa: labels.answerLabelTa,
          answerLabelEn: labels.answerLabelEn,
          isOther,
          otherText
        });
        continue;
      }

      if (def.type === 'number') {
        if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
          return res.status(400).json({
            message: msg.requiredQuestion(def.number),
            questionId: def.id
          });
        }
        const num = Number(rawValue);
        const min = def.min ?? 1;
        const max = def.max ?? 120;
        if (!Number.isFinite(num) || num < min || num > max) {
          return res.status(400).json({
            message: msg.invalidNumber(def.number, min, max),
            questionId: def.id
          });
        }
        normalizedAnswers.push({
          questionId: def.id,
          number: def.number,
          questionTa: def.question.ta,
          questionEn: def.question.en,
          type: def.type,
          answer: num,
          answerText: String(num),
          isOther: false,
          otherText: ''
        });
        continue;
      }

      const str = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (!str) {
        return res.status(400).json({
          message: msg.requiredQuestion(def.number),
          questionId: def.id
        });
      }
      if (str.length > 10000) {
        return res.status(400).json({
          message: msg.maxLength(def.number),
          questionId: def.id
        });
      }

      normalizedAnswers.push({
        questionId: def.id,
        number: def.number,
        questionTa: def.question.ta,
        questionEn: def.question.en,
        type: def.type,
        answer: str,
        answerText: str,
        isOther: false,
        otherText: ''
      });
    }

    const submission = await Submission.create({
      submissionId: generateSubmissionId(),
      language,
      ...(normalizedBasicInfo ? { basicInfo: normalizedBasicInfo } : {}),
      answers: normalizedAnswers,
      submittedAt: new Date()
    });

    return res.status(201).json({
      success: true,
      message: msg.success,
      submissionId: submission.submissionId,
      language: submission.language,
      submittedAt: submission.submittedAt || submission.createdAt
    });
  } catch (error) {
    return next(error);
  }
}
