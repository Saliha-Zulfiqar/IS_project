# Security

## Reporting issues

If you discover a security vulnerability, please report it privately to the repository maintainer (do not open a public issue with exploit details).

## Secrets

- Never commit `.env` or API keys.
- Use `.env.example` as a template only.
- Rotate `HF_TOKEN` or `GROQ_API_KEY` immediately if they are exposed.

## Local API

The backend binds to `0.0.0.0:8000` for development. Do not expose this port to the public internet without authentication and TLS.
