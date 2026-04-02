import nodemailer, { type Transporter } from "nodemailer";

type EmailProvider = "smtp" | "resend";

let smtpTransporter: Transporter | null = null;

function getProvider(): EmailProvider {
  const provider = (process.env.EMAIL_PROVIDER ?? "smtp").toLowerCase();
  return provider === "resend" ? "resend" : "smtp";
}

function getFromAddress() {
  const from = process.env.EMAIL_FROM?.trim();
  if (from) return from;

  const user = process.env.EMAIL_USER?.trim();
  if (user) return `"CamTop Support" <${user}>`;

  throw new Error("EMAIL_FROM or EMAIL_USER is required");
}

function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;

  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASS?.trim();

  if (!user) throw new Error("EMAIL_USER is required when EMAIL_PROVIDER=smtp");
  if (!pass) throw new Error("EMAIL_PASS is required when EMAIL_PROVIDER=smtp");

  const smtpHost = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;

  smtpTransporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user, pass },
  });

  return smtpTransporter;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return "";
  } catch {
    return "";
  }
}

async function sendWithSmtp(to: string, subject: string, html: string, text: string) {
  const transporter = getSmtpTransporter();
  return transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    html,
    text,
  });
}

async function sendWithResend(to: string, subject: string, html: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required when EMAIL_PROVIDER=resend");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend API error (${response.status}): ${errorBody}`);
  }

  return response.json().catch(() => null);
}

const EmailService = {
  sendVerificationEmail: async (to: string, name: string, verifyUrl: string) => {
    const subject = "Verify Your Email Address";
    const safeName = escapeHtml(name.trim() || "there");
    const verifiedUrl = sanitizeHttpUrl(verifyUrl.trim());
    if (!verifiedUrl) {
      throw new Error("Invalid verification URL");
    }

    const safeVerifyUrl = escapeHtml(verifiedUrl);
    const logoUrl = sanitizeHttpUrl(process.env.EMAIL_LOGO_URL?.trim() || "");
    const brandIcon = logoUrl
      ? `<img src="${escapeHtml(logoUrl)}" alt="CamTop Logo" width="46" height="46"
              style="display:block;border-radius:12px;border:1px solid #dbeafe;background:#ffffff;object-fit:cover"/>`
      : `<div style="width:46px;height:46px;border-radius:12px;background:#dbeafe;
                    border:1px solid #bfdbfe;text-align:center;line-height:46px;font-size:22px">🏠</div>`;

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Verify your email</title>
        </head>
        <body style="font-family:'Segoe UI',Arial,sans-serif;background:#eef2ff;padding:24px 12px;margin:0">
          <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:16px;
                      box-shadow:0 10px 28px rgba(30,41,59,0.12);overflow:hidden">
            <div style="background:linear-gradient(140deg,#2563eb 0%, #0ea5e9 100%);padding:28px 30px">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%">
                <tr>
                  <td style="width:56px;vertical-align:middle">${brandIcon}</td>
                  <td style="vertical-align:middle;padding-left:12px">
                    <div style="color:#ffffff;font-size:20px;font-weight:700;line-height:1.3">CamTop Property System</div>
                    <div style="color:#dbeafe;font-size:13px;margin-top:2px">Account Security Verification</div>
                  </td>
                </tr>
              </table>
            </div>
            <div style="padding:30px 30px 26px">
              <h2 style="color:#0f172a;font-size:24px;margin:0 0 10px">Hi ${safeName},</h2>
              <p style="color:#334155;line-height:1.7;margin:0 0 22px;font-size:15px">
                Welcome to CamTop. Please confirm your email address to activate your account and start using the platform.
              </p>
              <div style="text-align:center;margin:26px 0 20px">
                <a href="${safeVerifyUrl}"
                   style="background:linear-gradient(140deg,#2563eb 0%, #0284c7 100%);
                          color:#ffffff;padding:13px 30px;border-radius:10px;
                          text-decoration:none;font-weight:700;font-size:15px;
                          display:inline-block;box-shadow:0 8px 18px rgba(37,99,235,0.35)">
                  Verify Email Address
                </a>
              </div>
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;
                          padding:13px 14px;margin:18px 0;color:#334155;font-size:13px;line-height:1.6">
                <strong style="color:#0f172a">Security notice:</strong>
                this verification link will expire in <strong>24 hours</strong>. If you did not create this account, you can ignore this message.
              </div>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0 14px"/>
              <p style="font-size:12px;color:#64748b;line-height:1.7;margin:0">
                If the button does not work, paste this URL into your browser:
              </p>
              <p style="margin:8px 0 0">
                <a href="${safeVerifyUrl}" style="color:#2563eb;font-size:12px;word-break:break-all">${safeVerifyUrl}</a>
              </p>
              <p style="font-size:11px;color:#94a3b8;line-height:1.7;margin-top:12px">
                For your safety, never share this link with anyone.
              </p>
            </div>
            <div style="background:#f8fafc;border-top:1px solid #e2e8f0;
                        padding:16px 24px;text-align:center;font-size:12px;color:#94a3b8">
              © ${new Date().getFullYear()} CamTop Property System &nbsp;·&nbsp; Phnom Penh, Cambodia
            </div>
          </div>
        </body>
        </html>
      `;
    const text = [
      `Hi ${name.trim() || "there"},`,
      "",
      "Thanks for signing up. Verify your email by opening this link:",
      verifiedUrl,
      "",
      "This link expires in 24 hours.",
    ].join("\n");

    const provider = getProvider();
    if (provider === "resend") {
      await sendWithResend(to, subject, html, text);
    } else {
      await sendWithSmtp(to, subject, html, text);
    }

    console.log(`📧 Verification email sent → ${to}`);
  },
};

export default EmailService;
