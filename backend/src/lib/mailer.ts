import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env.js';

let transporterPromise: Promise<Transporter> | null = null;

async function initTransporter(): Promise<Transporter> {
  if (env.ETHEREAL_USER && env.ETHEREAL_PASS) {
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: env.ETHEREAL_USER,
        pass: env.ETHEREAL_PASS,
      },
    });
  }

  const account = await nodemailer.createTestAccount();
  console.log(`Initialized dynamic Ethereal mailbox: ${account.user}`);

  return nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: {
      user: account.user,
      pass: account.pass,
    },
  });
}

export async function getTransporter(): Promise<Transporter> {
  if (!transporterPromise) {
    transporterPromise = initTransporter();
  }
  return transporterPromise;
}

export async function sendEmail(opts: {
  from: string;
  to: string;
  subject: string;
  body: string;
}) {
  const mailer = await getTransporter();
  const info = await mailer.sendMail({
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    text: opts.body,
    html: opts.body.replace(/\n/g, '<br/>'),
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`Ethereal email preview [${opts.to}]: ${previewUrl}`);
  }

  return { messageId: info.messageId, previewUrl };
}
