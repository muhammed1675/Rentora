/**
 * Email Service
 * Handles email template management and sending
 * 
 * Setup Instructions:
 * 1. Install Resend (npm install resend) - recommended email provider
 * 2. Set REACT_APP_RESEND_API_KEY environment variable
 * 3. Or use your preferred email service (SendGrid, Mailgun, etc.)
 */

/**
 * Email template variables for interpolation
 */
const templateVariables = {
  currentYear: new Date().getFullYear(),
};

/**
 * Replace template variables with actual values
 */
function interpolateTemplate(template, variables) {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  });
  return result;
}

/**
 * Send verification email
 */
export async function sendVerificationEmail(email, userName, verificationLink) {
  try {
    // Template would be loaded from the HTML files
    // For now, we're providing the structure for integration
    
    const emailData = {
      to: email,
      subject: 'Verify Your Rentora Account',
      template: 'verifyEmail',
      variables: {
        ...templateVariables,
        userName,
        verificationLink,
      },
    };

    return await sendEmail(emailData);
  } catch (error) {
    console.error('[EmailService] Failed to send verification email:', error);
    throw error;
  }
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(email, userName) {
  try {
    const emailData = {
      to: email,
      subject: 'Welcome to Rentora - Your Student Housing Journey Starts Here',
      template: 'welcomeEmail',
      variables: {
        ...templateVariables,
        userName,
        browseLink: `${process.env.REACT_APP_BASE_URL || ''}/browse`,
        faqLink: `${process.env.REACT_APP_BASE_URL || ''}/faq`,
        contactLink: `${process.env.REACT_APP_BASE_URL || ''}/contact`,
      },
    };

    return await sendEmail(emailData);
  } catch (error) {
    console.error('[EmailService] Failed to send welcome email:', error);
    throw error;
  }
}

/**
 * Send booking confirmation email
 */
export async function sendBookingConfirmationEmail(email, bookingData) {
  try {
    const emailData = {
      to: email,
      subject: `Booking Confirmed - ${bookingData.propertyName}`,
      template: 'bookingConfirmation',
      variables: {
        ...templateVariables,
        bookingId: bookingData.bookingId,
        propertyName: bookingData.propertyName,
        propertyAddress: bookingData.propertyAddress,
        monthlyRent: bookingData.monthlyRent.toLocaleString('en-NG'),
        totalAmount: bookingData.totalAmount.toLocaleString('en-NG'),
        moveInDate: new Date(bookingData.moveInDate).toLocaleDateString('en-NG', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        bookingDetailsLink: `${process.env.REACT_APP_BASE_URL || ''}/profile/bookings/${bookingData.bookingId}`,
      },
    };

    return await sendEmail(emailData);
  } catch (error) {
    console.error('[EmailService] Failed to send booking confirmation email:', error);
    throw error;
  }
}

/**
 * Send agent notification email
 */
export async function sendAgentNotificationEmail(agentEmail, propertyName, studentName, studentEmail) {
  try {
    const emailData = {
      to: agentEmail,
      subject: `New Booking - ${propertyName}`,
      html: `
        <h2>New Booking Notification</h2>
        <p>You have a new booking for <strong>${propertyName}</strong></p>
        <p><strong>Student Name:</strong> ${studentName}</p>
        <p><strong>Student Email:</strong> ${studentEmail}</p>
        <p>Please review the booking details and contact the student within 24 hours to confirm move-in arrangements.</p>
      `,
    };

    return await sendEmail(emailData);
  } catch (error) {
    console.error('[EmailService] Failed to send agent notification:', error);
    throw error;
  }
}

/**
 * Core email sending function
 * Integrates with your preferred email service
 */
async function sendEmail(emailData) {
  const apiKey = process.env.REACT_APP_RESEND_API_KEY;

  if (!apiKey) {
    console.warn('[EmailService] REACT_APP_RESEND_API_KEY not set. Emails will not be sent.');
    console.log('[EmailService] Email data:', emailData);
    return { success: false, message: 'Email service not configured' };
  }

  try {
    // Example using Resend (recommended)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'noreply@rentora.com.ng',
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html || emailData.template, // Use provided HTML or template
      }),
    });

    if (!response.ok) {
      throw new Error(`Email API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[EmailService] Email sent successfully:', data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('[EmailService] Error sending email:', error);
    throw error;
  }
}

/**
 * Batch send emails
 */
export async function sendBatchEmails(emails) {
  const results = [];

  for (const emailData of emails) {
    try {
      const result = await sendEmail(emailData);
      results.push({ ...emailData, status: 'sent', result });
    } catch (error) {
      results.push({ ...emailData, status: 'failed', error: error.message });
    }
  }

  return results;
}

/**
 * Send contact form response
 */
export async function sendContactFormResponse(email, name, subject) {
  try {
    const responseEmail = {
      to: email,
      subject: `We Received Your Message - ${subject}`,
      html: `
        <h2>Thank You for Contacting Rentora!</h2>
        <p>Hi ${name},</p>
        <p>We've received your message about: <strong>${subject}</strong></p>
        <p>Our support team will review your inquiry and get back to you as soon as possible, typically within 24 hours.</p>
        <p>In the meantime, check out our <a href="${process.env.REACT_APP_BASE_URL || ''}/faq">FAQ</a> for quick answers to common questions.</p>
        <p>Best regards,<br>The Rentora Team</p>
      `,
    };

    return await sendEmail(responseEmail);
  } catch (error) {
    console.error('[EmailService] Failed to send contact response:', error);
    throw error;
  }
}

export default {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendBookingConfirmationEmail,
  sendAgentNotificationEmail,
  sendContactFormResponse,
  sendBatchEmails,
};
