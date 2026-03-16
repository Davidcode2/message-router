import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@message-router.local';

export async function sendEmail({ to, subject, html, text, replyTo }) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text,
      replyTo,
    });

    if (error) {
      throw new Error(`Resend API error: ${error.message}`);
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Email sending failed:', error.message);
    throw error;
  }
}

export function formatEmailContent(data) {
  const { name, email, subject, message, ...extraFields } = data;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>New Contact Form Submission</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
      New Contact Form Submission
    </h2>
    
    <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
      <p><strong>Name:</strong> ${escapeHtml(name || 'Not provided')}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      ${subject ? `<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>` : ''}
    </div>

    <div style="background: #fff; padding: 20px; border: 1px solid #dee2e6; border-radius: 5px;">
      <h3 style="margin-top: 0; color: #495057;">Message:</h3>
      <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
    </div>

    ${Object.keys(extraFields).length > 0 ? `
    <div style="margin-top: 20px; padding: 15px; background: #e9ecef; border-radius: 5px;">
      <h4 style="margin-top: 0; color: #6c757d;">Additional Fields:</h4>
      ${Object.entries(extraFields)
        .filter(([key]) => !key.startsWith('_'))
        .map(([key, value]) => `<p><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}</p>`)
        .join('')}
    </div>
    ` : ''}

    <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
    <p style="color: #6c757d; font-size: 12px;">
      This email was sent from a contact form. Reply directly to this email to respond to ${escapeHtml(email)}.
    </p>
  </div>
</body>
</html>
  `;

  const textContent = `
New Contact Form Submission

Name: ${name || 'Not provided'}
Email: ${email}
${subject ? `Subject: ${subject}\n` : ''}

Message:
${message}

${Object.keys(extraFields).length > 0 ? `
Additional Fields:
${Object.entries(extraFields)
  .filter(([key]) => !key.startsWith('_'))
  .map(([key, value]) => `${key}: ${value}`)
  .join('\n')}
` : ''}

---
This email was sent from a contact form.
  `.trim();

  return { html, text: textContent };
}

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
