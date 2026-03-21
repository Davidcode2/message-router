import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import configManager from './config.js';
import { sendEmail, formatEmailContent } from './services/email.js';
import { submissionSchema, redactEmail } from './validation.js';
import { validateApiKey, validateOrigin } from './middleware.js';

const fastify = Fastify({
  logger: { level: process.env.LOG_LEVEL || 'info' },
});

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

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
      if (!origin) return cb(null, true);
      cb(null, true);
    },
    credentials: true,
  });
}

fastify.get('/healthz', async () => ({ status: 'healthy' }));

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
  preHandler: [validateApiKey, validateOrigin],
  config: {
    rateLimit: { max: 5, timeWindow: '1 hour' },
  },
}, async (request, reply) => {
  try {
    const validatedData = submissionSchema.parse(request.body);
    const { site_id, email, message, name, subject, success_url, error_url, _website } = validatedData;

    if (_website) {
      return handleHoneypot(reply, success_url, request.ip, request.log);
    }

    if (!configManager.hasSite(site_id)) {
      return handleSiteNotFound(reply, error_url);
    }

    const siteConfig = configManager.getSite(site_id);

    if (!isOriginAllowed(request, site_id)) {
      return handleForbidden(reply, error_url);
    }

    await sendFormEmail({ name, email, subject, message, siteConfig, validatedData });

    logSuccess(site_id, email, siteConfig.recipient, request.log);

    return handleSuccess(reply, success_url);
  } catch (error) {
    return handleError(error, reply, request.body?.error_url, request.log);
  }
});

async function handleHoneypot(reply, successUrl, ip, log) {
  log.warn(`Honeypot triggered from IP: ${ip}`);
  if (successUrl) {
    return reply.redirect(302, successUrl);
  }
  return { success: true, message: 'Form submitted successfully' };
}

function handleSiteNotFound(reply, errorUrl) {
  if (errorUrl) {
    return reply.redirect(302, errorUrl);
  }
  return reply.status(404).send({
    error: 'Not Found',
    message: 'Site not found',
  });
}

function handleForbidden(reply, errorUrl) {
  if (errorUrl) {
    return reply.redirect(302, errorUrl);
  }
  return reply.status(403).send({
    error: 'Forbidden',
    message: 'Origin not allowed for this site',
  });
}

function isOriginAllowed(request, siteId) {
  const origin = request.headers.origin;
  if (!origin) return true;
  return configManager.isOriginAllowed(siteId, origin);
}

async function sendFormEmail({ name, email, subject, message, siteConfig, validatedData }) {
  const { html, text } = formatEmailContent({ name, email, subject, message });

  await sendEmail({
    to: siteConfig.recipient,
    subject: siteConfig.subject,
    html,
    text,
    replyTo: email,
  });
}

function logSuccess(siteId, email, recipient, log) {
  log.info(
    `Email sent for site: ${siteId}, from: ${redactEmail(email)}, to: ${redactEmail(recipient)}`
  );
}

function handleSuccess(reply, successUrl) {
  if (successUrl) {
    return reply.redirect(302, successUrl);
  }
  return {
    success: true,
    message: 'Form submitted successfully',
  };
}

function handleError(error, reply, errorUrl, log) {
  log.error({ error: error.message }, 'Form submission failed');

  if (errorUrl) {
    return reply.redirect(302, errorUrl);
  }

  return reply.status(500).send({
    error: 'Internal Server Error',
    message: 'Failed to process form submission',
  });
}

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
