const nodemailer = require('nodemailer');

/**
 * Phase 15 — outgoing email.
 *
 * Two interchangeable providers, chosen with EMAIL_PROVIDER:
 *
 *   smtp  (default) — Nodemailer over SMTP. Works with any SMTP relay
 *                     (Brevo, SendGrid, Mailgun, Amazon SES, Gmail app
 *                     password, Mailpit for local dev, ...).
 *   brevo           — Brevo's HTTPS transactional-email API (port 443).
 *
 * Why an HTTPS option exists: since September 2025 Render's FREE web
 * services block outbound traffic on SMTP ports 25, 465 and 587. On a free
 * Render instance either use EMAIL_PROVIDER=brevo, or an SMTP relay that
 * listens on port 2525 (Brevo/SendGrid/Mailgun all do). Paid Render
 * instances can use any SMTP port.
 *
 * All configuration comes from environment variables — no credentials are
 * hard-coded anywhere, and none of this ever reaches the React/Vite
 * frontend (only VITE_-prefixed variables are bundled there).
 *
 * Logging rules: the email body contains the raw verification code, so
 * Nodemailer's transcript logger/debug output are explicitly OFF, and send
 * failures are logged as a sanitized one-line summary (provider + error
 * code), never the message body, the recipient's full address, or any
 * credential.
 */

const APP_NAME = 'Corporate Event Management';
const DEFAULT_BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const SEND_TIMEOUT_MS = 10000;

const env = (name) => (process.env[name] || '').trim();

const getProvider = () => (env('EMAIL_PROVIDER') || 'smtp').toLowerCase();

const getMissingEmailConfig = () => {
  const provider = getProvider();
  if (provider === 'brevo') {
    return ['EMAIL_API_KEY', 'EMAIL_FROM'].filter((n) => !env(n));
  }
  if (provider === 'smtp') {
    return ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_FROM'].filter((n) => !env(n));
  }
  return ['EMAIL_PROVIDER (must be "smtp" or "brevo")'];
};

const isEmailConfigured = () => getMissingEmailConfig().length === 0;

/** "Name <addr@x.com>" | "addr@x.com" -> { name, email } */
const parseFromAddress = (from) => {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  if (match) return { name: match[1].trim() || APP_NAME, email: match[2].trim() };
  return { name: APP_NAME, email: from.trim() };
};

let smtpTransport = null;

const getSmtpTransport = () => {
  if (smtpTransport) return smtpTransport;

  const secure = env('EMAIL_SECURE').toLowerCase() === 'true';
  const requireTlsSetting = env('EMAIL_REQUIRE_TLS').toLowerCase();
  // Default: in production, refuse to send over a connection that never
  // upgrades to TLS (STARTTLS). Port-465 "secure" connections are TLS from
  // the first byte, so requireTLS only matters when secure=false.
  const requireTLS =
    !secure &&
    (requireTlsSetting ? requireTlsSetting === 'true' : process.env.NODE_ENV === 'production');

  const user = env('EMAIL_USER');
  const pass = process.env.EMAIL_PASSWORD || ''; // passwords may legitimately contain spaces

  smtpTransport = nodemailer.createTransport({
    host: env('EMAIL_HOST'),
    port: parseInt(env('EMAIL_PORT'), 10),
    secure,
    requireTLS,
    auth: user ? { user, pass } : undefined,
    connectionTimeout: SEND_TIMEOUT_MS,
    greetingTimeout: SEND_TIMEOUT_MS,
    socketTimeout: SEND_TIMEOUT_MS * 1.5,
    logger: false,
    debug: false,
  });
  return smtpTransport;
};

const sendViaSmtp = async ({ to, subject, text, html }) => {
  await getSmtpTransport().sendMail({ from: env('EMAIL_FROM'), to, subject, text, html });
};

const sendViaBrevo = async ({ to, subject, text, html }) => {
  const sender = parseFromAddress(env('EMAIL_FROM'));
  const res = await fetch(env('BREVO_API_URL') || DEFAULT_BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': env('EMAIL_API_KEY'),
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = new Error(`Email API responded with HTTP ${res.status}`);
    err.code = `HTTP_${res.status}`;
    throw err;
  }
};

/**
 * Sends one email. Throws a sanitized Error on failure (callers decide
 * what the user sees). Never logs the body.
 */
const sendEmail = async (message) => {
  if (!isEmailConfigured()) {
    const err = new Error('Email delivery is not configured');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  const provider = getProvider();
  try {
    if (provider === 'brevo') {
      await sendViaBrevo(message);
    } else {
      await sendViaSmtp(message);
    }
  } catch (err) {
    const safe = new Error(`Email delivery failed (${provider})`);
    safe.code = err.code || err.name || 'EMAIL_SEND_FAILED';
    safe.responseCode = err.responseCode;
    throw safe;
  }
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Verification email content. Contains: app name, the user's name, the
 * 6-digit code, its expiry, a security notice and "ignore if this wasn't
 * you". Contains NO password, token, internal id or database detail.
 */
const buildVerificationEmail = ({ name, code, expiresInMinutes }) => {
  const subject = `Verify your ${APP_NAME} account`;

  const text = [
    `Hello ${name},`,
    '',
    `Your verification code for ${APP_NAME} is:`,
    '',
    `    ${code}`,
    '',
    `This code expires in ${expiresInMinutes} minutes and can only be used once.`,
    '',
    `For your security, never share this code with anyone. ${APP_NAME} staff will never ask you for it.`,
    '',
    'If you did not create this account, you can safely ignore this email.',
    '',
    `— ${APP_NAME}`,
  ].join('\n');

  const safeName = escapeHtml(name);
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;">
      <tr><td style="padding:28px 28px 8px;">
        <p style="margin:0;font-size:13px;font-weight:bold;color:#4f46e5;letter-spacing:0.04em;text-transform:uppercase;">${APP_NAME}</p>
        <h1 style="margin:12px 0 0;font-size:20px;">Verify your email</h1>
      </td></tr>
      <tr><td style="padding:8px 28px;font-size:14px;line-height:1.6;">
        <p style="margin:12px 0;">Hello ${safeName},</p>
        <p style="margin:12px 0;">Your verification code for ${APP_NAME} is:</p>
        <p style="margin:20px 0;text-align:center;">
          <span style="display:inline-block;padding:12px 20px;font-size:30px;font-weight:bold;letter-spacing:8px;font-family:'Courier New',monospace;background:#eef2ff;color:#312e81;border-radius:10px;">${code}</span>
        </p>
        <p style="margin:12px 0;">This code expires in <strong>${expiresInMinutes} minutes</strong> and can only be used once.</p>
        <p style="margin:12px 0;color:#64748b;font-size:13px;">For your security, never share this code with anyone. ${APP_NAME} staff will never ask you for it.</p>
        <p style="margin:12px 0 24px;color:#64748b;font-size:13px;">If you did not create this account, you can safely ignore this email.</p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
};

const sendVerificationEmail = async ({ to, name, code, expiresInMinutes }) => {
  const content = buildVerificationEmail({ name, code, expiresInMinutes });
  await sendEmail({ to, ...content });
};

/** Test hook: lets a test process point at a freshly started SMTP sink. */
const resetTransportForTests = () => {
  smtpTransport = null;
};

module.exports = {
  APP_NAME,
  getProvider,
  getMissingEmailConfig,
  isEmailConfigured,
  sendEmail,
  sendVerificationEmail,
  buildVerificationEmail,
  parseFromAddress,
  resetTransportForTests,
};
