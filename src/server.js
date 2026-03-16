import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import configManager from './config.js';
import { sendEmail, formatEmailContent } from './services/email.js';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const API_KEY = process.env.API_KEY;

const submissionSchema = z.object({
  site_id: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(1).max(5000),
  name: z.string().max(200).optional(),
  subject: z.string().max(200).optional(),
  success_url: z.string().url().optional(),
  error_url: z.string().url().optional(),
  _website: z.string().optional(),
}).passthrough();

async function registerPlugins() {
  await fastify.register(rateLimit, {
    max: 5,
    timeWindow: '1 hour',
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: (req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${context.after}`,
    }),
  });

  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      cb(null, true);
    },
    credentials: true,
  });
}

function checkApiKey(request, reply, done) {
  if (!API_KEY) {
    done();
    return;
  }

  const providedKey = request.headers['x-api-key'];
  if (!providedKey || providedKey !== API_KEY) {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid or missing API key',
    });
    return;
  }

  done();
}

function checkOrigin(siteId) {
  return async (request, reply) => {
    const origin = request.headers.origin;

    if (!configManager.hasSite(siteId)) {
      reply.status(404).send({
        error: 'Not Found',
        message: 'Site not configured',
      });
      return;
    }

    const allowedOrigins = configManager.getAllowedOrigins(siteId);

    if (origin && !allowedOrigins.includes(origin)) {
      reply.status(403).send({
        error: 'Forbidden',
        message: 'Origin not allowed',
      });
      return;
    }
  };
}

fastify.get('/healthz', async () => {
  return { status: 'healthy' };
});

fastify.get('/readyz', async () => {
  const hasConfig = configManager.sites.size > 0;
  if (!hasConfig) {
    const error = new Error('Configuration not loaded');
    error.statusCode = 503;
    throw error;
  }
  return { status: 'ready', sites: configManager.sites.size };
});

fastify.post('/v1/submit', {
  preHandler: [checkApiKey],
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '1 hour',
    },
  },
}, async (request, reply) => {
  try {
    const validatedData = submissionSchema.parse(request.body);

    const { site_id, email, message, name, subject, success_url, error_url, _website, ...extraFields } = validatedData;

    if (_website) {
      console.log(`Honeypot triggered for site: ${site_id}, IP: ${request.ip}`);
      if (success_url) {
        return reply.redirect(302, success_url);
      }
      return { success: true, message: 'Form submitted successfully' };
    }

    if (!configManager.hasSite(site_id)) {
      if (error_url) {
        return reply.redirect(302, error_url);
      }
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Site not found',
      });
    }

    const siteConfig = configManager.getSite(site_id);
    const origin = request.headers.origin;

    if (origin && !configManager.isOriginAllowed(site_id, origin)) {
      if (error_url) {
        return reply.redirect(302, error_url);
      }
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Origin not allowed for this site',
      });
    }

    const { html, text } = formatEmailContent({ name, email, subject, message, ...extraFields });

    await sendEmail({
      to: siteConfig.recipient,
      subject: siteConfig.subject,
      html,
      text,
      replyTo: email,
    });

    console.log(`Email sent for site: ${site_id}, from: ${email}, to: ${siteConfig.recipient}`);

    if (success_url) {
      return reply.redirect(302, success_url);
    }

    return {
      success: true,
      message: 'Form submitted successfully',
    };
  } catch (error) {
    console.error('Form submission error:', error.message);

    if (error instanceof z.ZodError) {
      const errorUrl = request.body?.error_url;
      if (errorUrl) {
        return reply.redirect(302, errorUrl);
      }
      return reply.status(400).send({
        error: 'Validation Error',
        message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      });
    }

    const errorUrl = request.body?.error_url;
    if (errorUrl) {
      return reply.redirect(302, errorUrl);
    }

    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to process form submission',
    });
  }
});

async function start() {
  try {
    await registerPlugins();
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`Server listening on ${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

async function closeGracefully(signal) {
  console.log(`Received signal ${signal}, shutting down gracefully...`);
  await fastify.close();
  console.log('Server closed');
  process.exit(0);
}

process.on('SIGTERM', () => closeGracefully('SIGTERM'));
process.on('SIGINT', () => closeGracefully('SIGINT'));

start();
