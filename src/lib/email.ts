/**
 * Email Service for VM Financial Services
 * Uses nodemailer for sending emails
 */

import nodemailer from 'nodemailer';

// Email configuration - uses environment variables
// Zoho India SMTP with TLS on port 587 (Railway blocks port 465)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtppro.zoho.in',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // TLS/STARTTLS on port 587
  auth: {
    user: process.env.SMTP_USER || 'support@vmfinancialservices.com',
    pass: process.env.SMTP_PASS,
  },
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
});

const FROM_EMAIL = process.env.SMTP_FROM || 'support@vmfinancialservices.com';
const FROM_NAME = 'VM Financial Services';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // Try Resend API first (reliable on Vercel serverless)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      console.log(`Sending email to ${options.to} via Resend API`);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text || options.html.replace(/<[^>]*>/g, ''),
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`Email sent via Resend to ${options.to}, id: ${data.id}`);
        return true;
      }

      const errorData = await response.text();
      console.error(`Resend API failed (${response.status}):`, errorData);
      // Fall through to SMTP
    } catch (error) {
      console.error('Resend API error:', error);
      // Fall through to SMTP
    }
  }

  // Fallback to SMTP (nodemailer)
  try {
    console.log(`Attempting to send email to ${options.to} via SMTP ${process.env.SMTP_HOST || 'smtppro.zoho.in'}`);
    const info = await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    });
    console.log(`Email sent via SMTP to ${options.to}, messageId: ${info.messageId}`);
    return true;
  } catch (error: unknown) {
    console.error('SMTP send failed:', error);
    return false;
  }
}

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(userEmail: string, userName: string): Promise<boolean> {
  const subject = 'Welcome to Vijay Malik Financial Services ARN 317605';
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to VM Financial Services</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 40px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">
                Welcome to VM Financial Services
              </h1>
              <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0; font-size: 14px;">
                ARN 317605 | Your Trusted Financial Partner
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
              <h2 style="color: #1e3a5f; margin: 0 0 20px; font-size: 22px;">
                Hi ${userName},
              </h2>
              
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Thank you for joining Vijay Malik Financial Services! We're thrilled to have you as part of our growing family of investors.
              </p>
              
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Your journey towards financial freedom starts here. With our platform, you can:
              </p>
              
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                    <table role="presentation" style="border-collapse: collapse;">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <div style="width: 32px; height: 32px; background-color: #dbeafe; border-radius: 8px; text-align: center; line-height: 32px; color: #2563eb;">✓</div>
                        </td>
                        <td style="padding-left: 12px; color: #475569; font-size: 15px;">
                          <strong style="color: #1e3a5f;">Track Your Portfolio</strong><br>
                          Import your CAS and monitor all your mutual fund investments in one place
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                    <table role="presentation" style="border-collapse: collapse;">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <div style="width: 32px; height: 32px; background-color: #dbeafe; border-radius: 8px; text-align: center; line-height: 32px; color: #2563eb;">✓</div>
                        </td>
                        <td style="padding-left: 12px; color: #475569; font-size: 15px;">
                          <strong style="color: #1e3a5f;">Explore 10,000+ Funds</strong><br>
                          Research and compare mutual funds with detailed analytics
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <table role="presentation" style="border-collapse: collapse;">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <div style="width: 32px; height: 32px; background-color: #dbeafe; border-radius: 8px; text-align: center; line-height: 32px; color: #2563eb;">✓</div>
                        </td>
                        <td style="padding-left: 12px; color: #475569; font-size: 15px;">
                          <strong style="color: #1e3a5f;">Use Financial Calculators</strong><br>
                          Plan your SIP, lumpsum investments, and retirement goals
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://vijaymalikfinancial.com'}/dashboard" 
                   style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1e3a5f 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 16px;">
                  Go to Dashboard →
                </a>
              </div>
              
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 20px 0 0;">
                If you have any questions, feel free to reach out to us. We're here to help you achieve your financial goals.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 30px 40px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0; border-top: none;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center;">
                    <p style="color: #64748b; font-size: 14px; margin: 0 0 10px;">
                      <strong>Vijay Malik Financial Services</strong><br>
                      AMFI Registered Mutual Fund Distributor | ARN 317605
                    </p>
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                      Mutual Fund investments are subject to market risks. Please read all scheme related documents carefully before investing.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendEmail({ to: userEmail, subject, html });
}

/**
 * Generate a 6-digit OTP
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send password reset OTP email
 */
export async function sendPasswordResetOTP(userEmail: string, userName: string, otp: string): Promise<boolean> {
  const subject = 'Your Password Reset OTP - VM Financial Services';
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset OTP</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 40px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
                Password Reset
              </h1>
              <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0; font-size: 14px;">
                ARN 317605
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
              <h2 style="color: #1e3a5f; margin: 0 0 20px; font-size: 20px;">
                Hi ${userName},
              </h2>
              
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                We received a request to reset your password. Use the OTP below to verify your identity:
              </p>
              
              <!-- OTP Box -->
              <div style="text-align: center; margin: 32px 0;">
                <div style="display: inline-block; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border: 2px solid #1e3a5f; border-radius: 12px; padding: 20px 40px;">
                  <p style="margin: 0 0 8px; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Your OTP</p>
                  <p style="margin: 0; color: #1e3a5f; font-size: 36px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otp}</p>
                </div>
              </div>
              
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 8px 8px 0; margin: 24px 0;">
                <p style="color: #92400e; font-size: 14px; margin: 0;">
                  <strong>⏱ This OTP expires in 10 minutes.</strong><br>
                  Do not share this OTP with anyone.
                </p>
              </div>
              
              <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 20px 0 0;">
                If you didn't request this password reset, please ignore this email or contact our support team if you have concerns.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 30px 40px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
              <p style="color: #64748b; font-size: 14px; margin: 0 0 10px;">
                <strong>Vijay Malik Financial Services</strong>
              </p>
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                AMFI Registered Mutual Fund Distributor | ARN 317605
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

  return sendEmail({ to: userEmail, subject, html });
}
