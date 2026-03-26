/**
 * Contact Form API
 * Sends email notification to info@vmfinancialservices.com when someone submits inquiry
 */

import { NextRequest, NextResponse } from 'next/server';

// Email sending using Resend or similar service
// For now, we'll use a simple approach that logs and can be extended

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ContactFormData = await request.json();
    
    // Validate required fields
    if (!body.name || !body.email || !body.phone || !body.message) {
      return NextResponse.json({
        success: false,
        error: 'All required fields must be filled'
      }, { status: 400 });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid email address'
      }, { status: 400 });
    }

    // Phone validation (basic)
    const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
    if (!phoneRegex.test(body.phone)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid phone number'
      }, { status: 400 });
    }

    // Subject mapping
    const subjectMap: Record<string, string> = {
      'general': 'General Inquiry',
      'investment': 'Investment Related',
      'service': 'Service Issue',
      'partnership': 'Partnership Opportunity',
      'other': 'Other'
    };

    const subjectText = subjectMap[body.subject] || 'General Inquiry';

    // Zero-PII log — subject only, no name/email/phone/message
    console.info('[contact] New inquiry received', { subject: subjectText, time: new Date().toISOString() });

    // Try to send emails using Resend (if API key is configured)
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (resendApiKey) {
      try {
        // 1. Send notification email to Vijay Malik Financial Services team
        const teamEmailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Vijay Malik Financial Services <info@vmfinancialservices.com>',
            to: ['info@vmfinancialservices.com'],
            subject: `🔔 New Inquiry: ${subjectText} from ${body.name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #1B365D, #2E5984); padding: 20px; text-align: center;">
                  <h1 style="color: #C5A572; margin: 0;">New Customer Inquiry</h1>
                </div>
                
                <div style="padding: 30px; background: #f8f9fa;">
                  <p style="color: #1B365D; font-size: 16px; margin-bottom: 20px;">
                    <strong>A potential customer has shown interest!</strong> Please contact them at your earliest convenience.
                  </p>
                  
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; color: #1B365D; width: 120px;">Name:</td>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd; color: #333;">${body.name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; color: #1B365D;">Email:</td>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd; color: #333;">
                        <a href="mailto:${body.email}" style="color: #2E5984;">${body.email}</a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; color: #1B365D;">Phone:</td>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd; color: #333;">
                        <a href="tel:${body.phone}" style="color: #2E5984;">${body.phone}</a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; color: #1B365D;">Subject:</td>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd; color: #333;">${subjectText}</td>
                    </tr>
                  </table>
                  
                  <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 8px; border-left: 4px solid #C5A572;">
                    <p style="font-weight: bold; color: #1B365D; margin: 0 0 10px 0;">Message:</p>
                    <p style="color: #333; margin: 0; white-space: pre-wrap;">${body.message}</p>
                  </div>
                  
                  <div style="margin-top: 30px; padding: 15px; background: #e8f4e8; border-radius: 8px; text-align: center;">
                    <p style="color: #28a745; margin: 0; font-weight: bold;">
                      ⏰ Please respond within 24-48 hours to maximize conversion!
                    </p>
                  </div>
                </div>
                
                <div style="background: #1B365D; padding: 15px; text-align: center;">
                  <p style="color: #C5A572; margin: 0; font-size: 12px;">
                    Vijay Malik Financial Services | ARN-317605
                  </p>
                </div>
              </div>
            `
          })
        });

        if (teamEmailResponse.ok) {
          console.info('[contact] Team notification email sent');
        } else {
          const errorData = await teamEmailResponse.text();
          console.error('Team email error:', errorData);
        }

        // 2. Send confirmation email to the customer
        const customerEmailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Vijay Malik Financial Services <info@vmfinancialservices.com>',
            to: [body.email],
            subject: `Thank you for contacting Vijay Malik Financial Services`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #1B365D, #2E5984); padding: 30px; text-align: center;">
                  <h1 style="color: #C5A572; margin: 0; font-size: 24px;">Thank You for Reaching Out!</h1>
                  <p style="color: white; margin: 10px 0 0 0; font-size: 14px;">Vijay Malik Financial Services</p>
                </div>
                
                <div style="padding: 30px; background: #f8f9fa;">
                  <p style="color: #1B365D; font-size: 18px; margin-bottom: 10px;">
                    Dear <strong>${body.name}</strong>,
                  </p>
                  
                  <p style="color: #333; font-size: 15px; line-height: 1.6;">
                    Thank you for contacting Vijay Malik Financial Services. We have received your inquiry and our team will get back to you within <strong>24-48 hours</strong>.
                  </p>
                  
                  <div style="margin: 25px 0; padding: 20px; background: white; border-radius: 8px; border-left: 4px solid #C5A572;">
                    <p style="font-weight: bold; color: #1B365D; margin: 0 0 10px 0;">Your Inquiry Details:</p>
                    <p style="color: #666; margin: 5px 0;"><strong>Subject:</strong> ${subjectText}</p>
                    <p style="color: #666; margin: 5px 0;"><strong>Phone:</strong> ${body.phone}</p>
                    <p style="color: #666; margin: 5px 0;"><strong>Message:</strong></p>
                    <p style="color: #333; margin: 5px 0; white-space: pre-wrap; background: #f5f5f5; padding: 10px; border-radius: 4px;">${body.message}</p>
                  </div>
                  
                  <p style="color: #333; font-size: 15px; line-height: 1.6;">
                    In the meantime, feel free to explore our services at <a href="https://vmfinancialservices.com" style="color: #2E5984;">vmfinancialservices.com</a>
                  </p>
                  
                  <div style="margin-top: 25px; padding: 20px; background: #e8f4fc; border-radius: 8px;">
                    <p style="color: #1B365D; margin: 0 0 10px 0; font-weight: bold;">📞 Need Immediate Assistance?</p>
                    <p style="color: #333; margin: 5px 0;">Call us: <a href="tel:+919417334348" style="color: #2E5984; font-weight: bold;">+91 94173 34348</a></p>
                    <p style="color: #333; margin: 5px 0;">WhatsApp: <a href="https://wa.me/919417334348" style="color: #2E5984; font-weight: bold;">+91 94173 34348</a></p>
                  </div>
                </div>
                
                <div style="background: #1B365D; padding: 20px; text-align: center;">
                  <p style="color: white; margin: 0 0 5px 0; font-size: 14px;">
                    Vijay Malik Financial Services
                  </p>
                  <p style="color: #C5A572; margin: 0; font-size: 12px;">
                    AMFI Registered Mutual Fund Distributor | ARN-317605
                  </p>
                  <p style="color: #999; margin: 10px 0 0 0; font-size: 11px;">
                    Motia Royal City, Zirakpur, Punjab - 140603
                  </p>
                </div>
                
                <div style="padding: 15px; background: #f0f0f0; text-align: center;">
                  <p style="color: #666; margin: 0; font-size: 10px;">
                    Mutual Fund investments are subject to market risks. Read all scheme related documents carefully before investing.
                  </p>
                </div>
              </div>
            `
          })
        });

        if (customerEmailResponse.ok) {
          console.info('[contact] Customer confirmation email sent');
        } else {
          const errorData = await customerEmailResponse.text();
          console.error('Customer email error:', errorData);
        }

      } catch (emailError) {
        console.error('Failed to send emails via Resend:', emailError);
        // Don't fail the request if email fails - we still logged the inquiry
      }
    } else {
      console.warn('[contact] RESEND_API_KEY not configured — emails not sent');
    }

    // Return success
    return NextResponse.json({
      success: true,
      message: 'Your inquiry has been submitted successfully. We will contact you within 24-48 hours.'
    });

  } catch (error: any) {
    console.error('Contact form error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to submit inquiry. Please try again.'
    }, { status: 500 });
  }
}
