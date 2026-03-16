# Message Router

A lightweight, multi-tenant form submission service for customer websites. Built with Node.js, Fastify, and Resend.

## Features

- **Multi-Tenant Configuration**: Add new sites by simply updating a ConfigMap
- **Security Hardened**: CORS lockdown, rate limiting (5/hour per IP), API key authentication, honeypot spam detection
- **Dynamic Reply-To**: Automatically extracts user email and sets it as reply_to header
- **Kubernetes Native**: Health checks, graceful shutdown, resource limits
- **30-Second Setup**: Add a site to the config, apply, and start receiving emails

## Quick Start

### 1. Configure Secrets

```bash
kubectl apply -f k8s/secret.yaml
# Edit the secret with your actual RESEND_API_KEY:
kubectl edit secret message-router-secrets -n message-router
```

### 2. Configure Sites

Edit `k8s/configmap.yaml` to add your sites:

```json
{
  "my-client-site": {
    "recipient": "client@example.com",
    "subject": "New Contact Form Submission",
    "allowed_origins": ["https://client-website.com"]
  }
}
```

### 3. Deploy

```bash
kubectl apply -f k8s/
```

### 4. Frontend Integration

```javascript
fetch('https://api.yourdomain.com/v1/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': 'your-api-key-here' // Optional but recommended
  },
  body: JSON.stringify({
    site_id: 'my-client-site',
    name: 'John Doe',
    email: 'john@example.com',
    message: 'Hello, I am interested in your services!',
    // Honeypot field (hidden, should be empty)
    _website: ''
  })
});
```

## Configuration Options

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RESEND_API_KEY` | Yes | - | Your Resend API key |
| `API_KEY` | No | - | Optional API key for frontend authentication |
| `FROM_EMAIL` | Yes | - | Sender email address (must be verified in Resend) |
| `CONFIG_PATH` | No | `/app/config/sites.json` | Path to sites configuration file |
| `PORT` | No | `3000` | Server port |
| `LOG_LEVEL` | No | `info` | Logging level |

### Site Configuration

Each site in the config requires:

- `recipient`: Email address to receive form submissions
- `subject`: Email subject line
- `allowed_origins`: Array of allowed CORS origins

## Security Features

1. **CORS**: Only allows requests from configured origins per site
2. **Rate Limiting**: 5 submissions per hour per IP address
3. **API Key**: Optional `X-Api-Key` header validation
4. **Honeypot**: Hidden `_website` field - if filled, request is silently dropped
5. **Input Validation**: Zod schema validation prevents injection attacks
6. **HTML Escaping**: All user input is escaped before email generation

## API Endpoints

### POST /v1/submit

Submit a form.

**Request Body:**
```json
{
  "site_id": "my-site",
  "email": "user@example.com",
  "message": "Hello world",
  "name": "John Doe",
  "subject": "Contact Request",
  "success_url": "https://example.com/thanks",
  "error_url": "https://example.com/error",
  "_website": ""
}
```

**Required Fields:** `site_id`, `email`, `message`

### GET /healthz

Health check endpoint.

### GET /readyz

Readiness check endpoint.

## Development

```bash
# Install dependencies
yarn install

# Run locally
yarn dev

# Build Docker image
docker build -t message-router .
```

## License

MIT
