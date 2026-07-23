const nodemailer = require('nodemailer');

// Gmail via OAuth2 over HTTPS (not raw SMTP) — avoids providers/hosts that
// block outbound SMTP ports (25/465/587). Requires:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET  (same ones used for Google login)
//   GMAIL_REFRESH_TOKEN                     (generated once via OAuth Playground,
//                                            authorized against GMAIL_USER's account)
//   GMAIL_USER                              (the sending address)
let transporter = null;
let mailerConfigured = false;

const { GMAIL_USER, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;

if (GMAIL_USER && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GMAIL_REFRESH_TOKEN) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: GMAIL_USER,
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      refreshToken: GMAIL_REFRESH_TOKEN,
    },
  });
  mailerConfigured = true;
} else {
  console.warn(
    'GMAIL_USER/GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GMAIL_REFRESH_TOKEN not fully set — verification emails are disabled until they are.'
  );
}

async function sendVerificationEmail(toEmail, verifyUrl) {
  if (!mailerConfigured) {
    console.warn(`Mailer not configured — would have sent verification link to ${toEmail}: ${verifyUrl}`);
    return;
  }
  await transporter.sendMail({
    from: `"Vector" <${GMAIL_USER}>`,
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