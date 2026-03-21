import configManager from './config.js';

const API_KEY = process.env.API_KEY;

export function validateApiKey(request, reply, done) {
  if (!API_KEY) {
    reply.status(500).send({
      error: 'Configuration Error',
      message: 'Authentication not configured',
    });
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

export function validateOrigin(request, reply, done) {
  const origin = request.headers.origin;

  if (!origin) {
    done();
    return;
  }

  const allAllowedOrigins = getAllAllowedOrigins();

  if (!allAllowedOrigins.includes(origin)) {
    reply.status(403).send({
      error: 'Forbidden',
      message: 'Origin not allowed',
    });
    return;
  }

  done();
}

function getAllAllowedOrigins() {
  const origins = new Set();

  for (const siteConfig of configManager.sites.values()) {
    if (siteConfig.allowed_origins) {
      siteConfig.allowed_origins.forEach((origin) => origins.add(origin));
    }
  }

  return Array.from(origins);
}
