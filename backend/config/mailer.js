const nodemailer = require('nodemailer');

// Gmail SMTP transport. Requires a Google App Password (not your regular
// Gmail password) — generate one at https://myaccount.google.com/apppasswords
// with 2-Step Verification turned on for the sending account.
let transporter = null;
let mailerConfigured = false;

if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  mailerConfigured = true;
} else {
  console.warn(
    'GMAIL_USER/GMAIL_APP_PASSWORD not set — verification emails are disabled until they are.'
  );
}

async function sendVerificationEmail(toEmail, verifyUrl) {
  if (!mailerConfigured) {
    console.warn(`Mailer not configured — would have sent verification link to ${toEmail}: ${verifyUrl}`);
    return;
  }

  await transporter.sendMail({
    from: `"Vector" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'Verify your email for Vector',
    html: `
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
    `,
  });
}

module.exports = { sendVerificationEmail, mailerConfigured };
