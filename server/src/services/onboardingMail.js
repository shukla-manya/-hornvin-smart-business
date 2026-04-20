import { sendMail } from "../config/mail.js";

/**
 * Sends login identifier + temporary password (best-effort; logs in dev if SMTP missing).
 */
export async function emailTemporaryCredentials(toEmail, { roleTitle, loginLine, temporaryPassword, name }) {
  const greeting = name ? `Hello ${name},` : "Hello,";
  const subject = `Your Vello ${roleTitle} account`;
  const text = `${greeting}

Your account has been created on Vello.

${loginLine}

Temporary password: ${temporaryPassword}

You must set a new password the first time you sign in. Until then, the app will only allow you to change your password.

If you did not expect this message, ignore it or contact your administrator.
`;
  const html = `<p>${greeting}</p><p>Your <strong>${roleTitle}</strong> account is ready.</p><p><strong>${loginLine.replace(/\n/g, "<br/>")}</strong></p><p>Temporary password: <code style="font-size:16px">${temporaryPassword}</code></p><p>You will be asked to choose a new password on first sign-in.</p>`;
  try {
    await sendMail({ to: toEmail, subject, text, html });
  } catch (e) {
    if (process.env.NODE_ENV === "production") {
      console.error("[onboarding-email]", e.message);
    } else {
      console.info(`[onboarding-email] NOT SENT (${e.message}). ${loginLine} temp password: ${temporaryPassword}`);
    }
  }
}
