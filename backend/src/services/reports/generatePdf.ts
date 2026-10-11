import PDFDocument from 'pdfkit';
import type { HiringReport } from './buildReport';

/**
 * Lightweight server-side PDF via pdfkit (no Chromium/Puppeteer).
 * Renders ONLY the report object it is given — callers must pass the
 * candidate-safe variant on candidate paths. No filesystem paths,
 * secrets, or internal keys are ever rendered.
 */
export function generateReportPdf(report: HiringReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: 'HireStack Hiring Report' } });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const heading = (text: string) => {
        doc.moveDown(0.6).fontSize(13).fillColor('#1F4770').text(text, { underline: false });
        doc.moveDown(0.2);
      };
      const body = (text: string) => {
        doc.fontSize(10).fillColor('#111827').text(text, { lineGap: 2 });
      };
      const kv = (k: string, v: string | null | undefined) => {
        if (v === null || v === undefined || v === '') return;
        doc.fontSize(10).fillColor('#374151').text(`${k}: `, { continued: true }).fillColor('#111827').text(v);
      };

      // Brand header
      doc.fontSize(20).fillColor('#1F4770').text('HireStack');
      doc.fontSize(11).fillColor('#6B7280').text(`Hiring Report — ${report.reportType === 'candidate' ? 'Candidate Copy' : 'Internal Recruiter Copy'}`);
      doc.moveDown(0.2);
      doc.fontSize(9).fillColor('#6B7280').text(`Report ID: ${report.reportId || '—'}   •   Version: ${report.version}   •   Generated: ${report.generatedAt}`);
      doc.moveDown(0.4);
      doc.strokeColor('#E5E7EB').lineWidth(1).moveTo(48, doc.y).lineTo(547, doc.y).stroke();

      heading('Candidate');
      body(report.candidate.name || '—');
      kv('Email', report.candidate.email);
      if (report.candidate.phone) kv('Phone', report.candidate.phone);
      if (report.candidate.location) kv('Location', report.candidate.location);
      if (report.candidate.currentTitle) kv('Title', `${report.candidate.currentTitle}${report.candidate.currentCompany ? ` @ ${report.candidate.currentCompany}` : ''}`);
      if (report.job?.title) kv('Role applied', report.job.title);
      if (report.candidate.applicationDate) kv('Applied', String(report.candidate.applicationDate).slice(0, 10));

      if (report.screening) {
        heading('Screening (RAG)');
        const s = report.screening;
        kv('Overall', fmtNum(s.overall));
        kv('Semantic / Skills / Experience / Education', `${fmtNum(s.semantic)} / ${fmtNum(s.skills)} / ${fmtNum(s.experience)} / ${fmtNum(s.education)}`);
        kv('Status', s.status);
        if (s.matchedSkills.length) body(`Matched: ${s.matchedSkills.slice(0, 20).join(', ')}`);
        if (s.missingSkills.length) body(`Missing: ${s.missingSkills.slice(0, 20).join(', ')}`);
        if (s.explanation) body(`Notes: ${s.explanation.slice(0, 800)}`);
      }

      if (report.assessment) {
        heading('Assessment');
        const a = report.assessment;
        kv('Assessment', a.name);
        if (a.startedAt) kv('Started', String(a.startedAt).slice(0, 16).replace('T', ' '));
        if (a.submittedAt) kv('Completed', String(a.submittedAt).slice(0, 16).replace('T', ' '));
        kv('Score', a.score !== null && a.maxScore !== null ? `${a.score} / ${a.maxScore}${a.percentage !== null ? ` (${a.percentage}%)` : ''}` : null);
        kv('Result', a.passed === null ? null : a.passed ? 'Pass' : 'Not passed');
        kv('Questions answered', `${a.answeredCount} / ${a.questionCount}`);
      }

      if (report.technicalInterview) {
        heading('Technical Interview');
        const t = report.technicalInterview;
        if (t.date) kv('Date', `${t.date}${t.time ? ` ${t.time}` : ''}`);
        if (t.interviewer) kv('Interviewer', t.interviewer);
        if (t.status) kv('Status', t.status);
        kv(
          'Scores (Tech / Problem-solving / Communication / Code quality)',
          [t.technicalKnowledge, t.problemSolving, t.communication, t.codeQuality].every((v) => v === null)
            ? null
            : [t.technicalKnowledge, t.problemSolving, t.communication, t.codeQuality].map((v) => (v === null ? '—' : String(v))).join(' / '),
        );
        if (t.recommendation) kv('Recommendation', t.recommendation);
        if (t.summary) body(`Feedback: ${t.summary.slice(0, 800)}`);
        if (t.video?.durationSeconds !== null && t.video?.durationSeconds !== undefined) {
          kv('Video session duration', `${Math.floor(t.video.durationSeconds / 60)} min ${t.video.durationSeconds % 60} sec`);
        }
      }

      if (report.hrInterview) {
        heading('Managerial / HR Interview');
        const h = report.hrInterview;
        if (h.date) kv('Date', h.date);
        if (h.status) kv('Status', h.status);
        if (h.recommendation) kv('Recommendation', h.recommendation);
        if (h.summary) body(`Feedback: ${h.summary.slice(0, 800)}`);
      }

      heading('Final Outcome');
      kv('Current stage', report.finalOutcome.currentStage);
      kv('Decision', report.finalOutcome.finalDecision);
      if (report.finalOutcome.decisionAt) kv('Decided', String(report.finalOutcome.decisionAt).slice(0, 16).replace('T', ' '));
      if (report.finalOutcome.timeline.length > 0) {
        body('Timeline:');
        for (const t of report.finalOutcome.timeline.slice(0, 20)) {
          body(`  • ${t.status} — ${String(t.at).slice(0, 16).replace('T', ' ')}`);
        }
      }

      doc.moveDown(1);
      doc.fontSize(8).fillColor('#9CA3AF').text('HireStack — candidate-safe copies contain only candidate-visible information. Internal notes, answer keys, hidden tests, and confidential comments are never included in candidate copies.');
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function fmtNum(v: number | null): string | null {
  if (v === null || v === undefined) return null;
  return String(Math.round(Number(v) * 10) / 10);
}
