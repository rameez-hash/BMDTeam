import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true, // SSL
  auth: {
    user: process.env.SMTP_USER || 'no-reply@staging-webdev.com',
    pass: process.env.SMTP_PASS || 'Some12345@',
  },
});

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: `"BMD HRMS" <${process.env.SMTP_USER || 'no-reply@staging-webdev.com'}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

export function getPasswordResetEmail(name: string, resetLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#f8fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafb;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.06);">
              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#0d9488,#059669);padding:32px 32px 24px;text-align:center;">
                  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Password Reset</h1>
                  <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">BMD HRMS</p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
                    Hi <strong>${name}</strong>,
                  </p>
                  <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
                    We received a request to reset your password. Click the button below to set a new password. This link will expire in <strong>1 hour</strong>.
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding:8px 0 24px;">
                        <a href="${resetLink}" style="display:inline-block;background-color:#0d9488;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:14px;font-weight:600;letter-spacing:0.01em;">
                          Reset Password
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0 0 12px;color:#64748b;font-size:13px;line-height:1.6;">
                    If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
                  </p>
                  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
                  <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
                    If the button doesn't work, copy and paste this link into your browser:<br>
                    <a href="${resetLink}" style="color:#0d9488;word-break:break-all;">${resetLink}</a>
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background-color:#f8fafb;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
                  <p style="margin:0;color:#94a3b8;font-size:11px;">
                    © ${new Date().getFullYear()} BMD HRMS. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
