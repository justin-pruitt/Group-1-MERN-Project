// Mailer.js
const { google } = require('googleapis');

const { GMAIL_USER, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;

let mailerConfigured = false;
let oauth2Client = null;

if (GMAIL_USER && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GMAIL_REFRESH_TOKEN) {
  oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
  mailerConfigured = true;
} else {
  console.warn(
    'GMAIL_USER/GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GMAIL_REFRESH_TOKEN not fully set — verification emails are disabled until they are.'
  );
}

function buildRawEmail(toEmail, verifyUrl) {
  const subject = 'Verify your email for Vector';
  const html = `
    <div style="font-family: sans-serif; max-width: 480px;">
      <h2 style="margin-bottom: 4px;">Welcome to Vector</h2>
      <p>Confirm your email address to finish setting up your account.</p>
      <p>
        <a href="${verifyUrl}"
           style="display:inline-block;padding:10px 18px;background:#3fe0d0;color:#0d1220;
                  text-decoration:none;border-radius:6px;font-weight:bold;">
          Verify email
        </a>
      </p>
      <p style="color:#666;font-size:13px;">
        This link expires in 24 hours. If you didn't create this account, you can ignore this email.
      </p>
    </div>
  `;

  const message = [
    `From: "Vector" <${GMAIL_USER}>`,
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
  ].join('\n');

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sendVerificationEmail(toEmail, verifyUrl) {
  if (!mailerConfigured) {
    console.warn(`Mailer not configured — would have sent verification link to ${toEmail}: ${verifyUrl}`);
    return;
  }
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: buildRawEmail(toEmail, verifyUrl) },
  });
}

module.exports = { sendVerificationEmail, mailerConfigured };