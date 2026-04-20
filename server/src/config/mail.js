import nodemailer from "nodemailer";

export function getMailer() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: { user, pass },
  });
}

export async function sendMail({ to, subject, text, html }) {
  const transporter = getMailer();
  if (!transporter) {
    throw new Error("SMTP not configured (set SMTP_USER and SMTP_PASS for Gmail)");
  }
  const from = process.env.SMTP_FROM || `"Vello" <${process.env.SMTP_USER}>`;
  await transporter.sendMail({ from, to, subject, text, html });
}
