import { z } from 'zod';

const SAFE_URL_REGEX = /^https?:\/\/[^\s<>"']+$/i;

export const urlSchema = z.string().url().refine(
  (url) => SAFE_URL_REGEX.test(url),
  { message: 'URL must use HTTP or HTTPS protocol' }
);

export const submissionSchema = z.object({
  site_id: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(1).max(5000),
  name: z.string().max(200).optional(),
  subject: z.string().max(200).optional(),
  success_url: urlSchema.optional(),
  error_url: urlSchema.optional(),
  _website: z.string().optional(),
}).strip();

export function sanitizeEmail(email) {
  return email.replace(/[\r\n]/g, '');
}

export function redactEmail(email) {
  return email.replace(/(.{2}).*@/, '$1***@');
}
