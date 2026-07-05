import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import('pdf-parse');
    const doc = new PDFParse({ data: buffer, verbosity: 0 });
    const result = await doc.getText();
    return typeof result === 'string' ? result : (result?.text ?? '');
  } catch (error) {
    logger.error('Failed to parse PDF', { error });
    throw new AppError('Failed to extract text from PDF', 400);
  }
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error) {
    logger.error('Failed to parse DOCX', { error });
    throw new AppError('Failed to extract text from DOCX', 400);
  }
}

const MAX_TEXT_LENGTH = 50000;

export function sanitizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH);
}

export async function extractResumeText(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const isPdf = mimeType === 'application/pdf' || mimeType.includes('pdf');
  const isDocx =
    mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType.includes('word') ||
    mimeType.includes('docx');

  if (isPdf) {
    return extractTextFromPdf(buffer);
  }
  if (isDocx) {
    return extractTextFromDocx(buffer);
  }

  throw new AppError(
    'Unsupported file format. Please upload a PDF or DOCX file.',
    400,
  );
}
