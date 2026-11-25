import mongoose from 'mongoose';

const bilingualAnswerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true, trim: true },
    number: { type: Number, required: true },
    questionTa: { type: String, required: true, trim: true, maxlength: 1500 },
    questionEn: { type: String, required: true, trim: true, maxlength: 1500 },
    type: { type: String, required: true, trim: true },
    answer: { type: mongoose.Schema.Types.Mixed, required: true },
    answerText: { type: String, required: true, trim: true, maxlength: 10000 },
    answerLabelTa: { type: String, trim: true, maxlength: 10000 },
    answerLabelEn: { type: String, trim: true, maxlength: 10000 },
    isOther: { type: Boolean, default: false },
    otherText: { type: String, trim: true, maxlength: 10000, default: '' }
  },
  { _id: false }
);

const legacyResponseSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    question: { type: String, required: true, trim: true, maxlength: 1000 },
    answer: { type: String, required: true, trim: true, maxlength: 10000 }
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    submissionId: { type: String, required: true, unique: true, index: true },
    language: { type: String, enum: ['ta', 'en'], default: 'ta', index: true },
    basicInfo: {
      name: { type: String, required: true, trim: true, maxlength: 120 },
      email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
      phone: { type: String, required: true, match: /^\d{10}$/ }
    },
    answers: { type: [bilingualAnswerSchema], default: undefined },
    responses: { type: [legacyResponseSchema], default: undefined },
    submittedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'questionnaire_responses'
  }
);

submissionSchema.index({ createdAt: -1 });
submissionSchema.index({ 'basicInfo.email': 1 });
submissionSchema.index({ 'basicInfo.name': 1 });
submissionSchema.index({ 'answers.answerText': 1 });

export default mongoose.model('Submission', submissionSchema, 'questionnaire_responses');
