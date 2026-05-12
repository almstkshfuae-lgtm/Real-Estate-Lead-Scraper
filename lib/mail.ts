import nodemailer from 'nodemailer';

/**
 * Mail Library
 * 
 * Handles sending emails via SMTP configured in user settings.
 */

export interface MailParams {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Sends an email using SMTP
 */
export async function sendEmail(params: MailParams) {
  const transporter = nodemailer.createTransport({
    host: params.host,
    port: params.port,
    secure: params.secure,
    auth: {
      user: params.user,
      pass: params.pass,
    },
  });

  const info = await transporter.sendMail({
    from: params.from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });

  return info;
}

/**
 * Tests SMTP connection
 */
export async function testMailConnection(host: string, port: number, secure: boolean, user: string, pass: string) {
  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    await transporter.verify();
    return true;
  } catch (e) {
    console.error("SMTP Test Error:", e);
    return false;
  }
}
