const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * Escapes a single CSV field and neutralizes spreadsheet formula injection.
 */
export function escapeCsvCell(value) {
  let normalized = String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  if (FORMULA_PREFIX.test(normalized)) {
    normalized = `'${normalized}`;
  }
  return `"${normalized.replace(/"/g, '""')}"`;
}

export function buildResponsesCsv(rows, questionDefinitions) {
  const questionColumns = questionDefinitions.map((def) => {
    const qNum = String(def.number).padStart(2, '0');
    return {
      header: `Q${qNum} (${def.question.ta} | ${def.question.en})`,
      extract: (row) => {
        if (Array.isArray(row.answers) && row.answers.length > 0) {
          const entry = row.answers.find((a) => a.questionId === def.id);
          if (!entry) return '';
          if (entry.isOther && entry.otherText) {
            return `Other: ${entry.otherText}`;
          }
          if (entry.answerLabelTa && entry.answerLabelEn && entry.answerLabelTa !== entry.answerLabelEn) {
            return `${entry.answerText} (${entry.answerLabelTa} / ${entry.answerLabelEn})`;
          }
          return entry.answerText || String(entry.answer ?? '');
        }
        return '';
      }
    };
  });

  const headers = [
    'Submission ID',
    'Submitted At',
    'Language',
    'Full Name',
    'Email Address',
    'Phone Number',
    ...questionColumns.map((col) => col.header)
  ];

  const lines = [headers.map(escapeCsvCell).join(',')];

  for (const row of rows) {
    const submittedDate = row.submittedAt || row.createdAt;
    const langLabel = row.language === 'en' ? 'English (en)' : 'Tamil (ta)';

    lines.push(
      [
        row.submissionId,
        submittedDate ? new Date(submittedDate).toISOString() : '',
        langLabel,
        row.basicInfo?.name || '',
        row.basicInfo?.email || '',
        row.basicInfo?.phone || '',
        ...questionColumns.map((col) => col.extract(row))
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  return '\uFEFF' + lines.join('\r\n');
}
