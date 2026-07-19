import { config } from '@/config';
import { logger } from '@/utils/logger';

let resendClient: any = null;

function getResend() {
  if (!config.resend.apiKey) {
    return null;
  }
  if (!resendClient) {
    const { Resend } = require('resend');
    resendClient = new Resend(config.resend.apiKey);
  }
  return resendClient;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    logger.warn('Resend not configured — email not sent', { to: params.to, subject: params.subject });
    return { success: false, error: 'Resend not configured' };
  }

  const from = params.from || config.resend.fromEmail;

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      logger.error('Failed to send email via Resend', { error: error.message, to: params.to, subject: params.subject });
      return { success: false, error: error.message };
    }

    logger.info('Email sent successfully', { to: params.to, subject: params.subject, id: data?.id });
    return { success: true };
  } catch (err: any) {
    logger.error('Failed to send email (exception)', { error: err.message, to: params.to });
    return { success: false, error: err.message };
  }
}

export function buildRejectionEmail(candidateName: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">Dear ${candidateName},</p>
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">
        Thank you for taking the time to apply and interview with us. We truly appreciate your interest in the position and the effort you invested in the process.
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">
        After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match the current needs of the role.
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">
        This decision was not easy, and we encourage you to apply for future positions that align with your skills and experience.
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">Best regards,<br/>RecruitIQ Talent Team</p>
    </div>
  `;
}

export function buildOfferEmail(candidateName: string, salary?: number, joiningDate?: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">Dear ${candidateName},</p>
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">
        Congratulations! We are delighted to offer you the position. Your skills, experience, and enthusiasm stood out throughout the interview process.
      </p>
      ${salary ? `<p style="font-size: 16px; line-height: 1.6; color: #374151;">Compensation: <strong>$${salary.toLocaleString()}/year</strong></p>` : ''}
      ${joiningDate ? `<p style="font-size: 16px; line-height: 1.6; color: #374151;">Proposed Start Date: <strong>${joiningDate}</strong></p>` : ''}
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">
        Please review the attached offer letter and let us know your decision by replying to this email.
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">We look forward to welcoming you to the team!</p>
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">Best regards,<br/>RecruitIQ Talent Team</p>
    </div>
  `;
}

export function buildInterviewEmailHtml(
  candidateName: string,
  jobTitle: string,
  scheduledDate: string,
  scheduledTime: string,
  interviewType: string,
  meetingLink?: string,
): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">Dear ${candidateName},</p>
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">
        Thank you for your interest in the <strong>${jobTitle}</strong> position. We were impressed by your application and would like to invite you to an interview.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr><td style="padding: 8px 12px; color: #6B7280; font-size: 14px;">Date</td><td style="padding: 8px 12px; font-size: 14px; color: #111111;"><strong>${scheduledDate}</strong></td></tr>
        <tr><td style="padding: 8px 12px; color: #6B7280; font-size: 14px;">Time</td><td style="padding: 8px 12px; font-size: 14px; color: #111111;"><strong>${scheduledTime}</strong></td></tr>
        <tr><td style="padding: 8px 12px; color: #6B7280; font-size: 14px;">Type</td><td style="padding: 8px 12px; font-size: 14px; color: #111111;"><strong>${interviewType}</strong></td></tr>
      </table>
      ${meetingLink ? `<p style="font-size: 16px; line-height: 1.6; color: #374151;">Meeting Link: <a href="${meetingLink}" style="color: #1F4770;">${meetingLink}</a></p>` : ''}
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">
        Please confirm your availability by replying to this email. We look forward to speaking with you!
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">Best regards,<br/>RecruitIQ Talent Team</p>
    </div>
  `;
}
