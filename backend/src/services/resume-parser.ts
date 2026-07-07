import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    logger.info('Extracting text from PDF', { bufferSize: buffer.length });
    const { PDFParse } = await import('pdf-parse');
    const doc = new PDFParse({ data: buffer, verbosity: 0 });
    const result = await doc.getText();
    const text = typeof result === 'string' ? result : (result?.text ?? '');
    logger.info('PDF text extracted', { length: text.length });
    return text;
  } catch (error: any) {
    logger.error('Failed to parse PDF', { error: error.message });
    throw new AppError(`Failed to extract text from PDF: ${error.message}`, 400, ErrorCodes.VALIDATION_ERROR);
  }
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    logger.info('Extracting text from DOCX', { bufferSize: buffer.length });
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value || '';
    logger.info('DOCX text extracted', { length: text.length });
    return text;
  } catch (error: any) {
    logger.error('Failed to parse DOCX', { error: error.message });
    throw new AppError(`Failed to extract text from DOCX: ${error.message}`, 400, ErrorCodes.VALIDATION_ERROR);
  }
}

const MAX_TEXT_LENGTH = 50000;

export function sanitizeText(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH);
  logger.debug('Text sanitized', { originalLength: text.length, cleanedLength: cleaned.length });
  return cleaned;
}

export async function extractResumeText(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const isPdf = mimeType === 'application/pdf' || mimeType.includes('pdf');
  const isDocx =
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType.includes('word') ||
    mimeType.includes('docx');

  logger.info('Extracting resume text', { mimeType, bufferSize: buffer.length, isPdf, isDocx });

  if (isPdf) {
    return extractTextFromPdf(buffer);
  }
  if (isDocx) {
    return extractTextFromDocx(buffer);
  }

  throw new AppError(
    `Unsupported file format: ${mimeType}. Please upload a PDF or DOCX file.`,
    400,
    ErrorCodes.VALIDATION_ERROR,
  );
}
