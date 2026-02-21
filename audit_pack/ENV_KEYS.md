# Environment Variable Keys

This document lists all environment variable keys referenced in the codebase.
**No values are included - only key names.**

## Core Application

| Key | Purpose |
|-----|---------|
| `NODE_ENV` | Environment mode (development/production) |
| `PORT` | Server port (default 5000) |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session encryption |
| `JWT_SECRET` | JWT token signing |
| `ENCRYPTION_KEY` | General data encryption |

## Authentication & Security

| Key | Purpose |
|-----|---------|
| `ISSUER_URL` | OAuth issuer URL |
| `DEV_ALLOW_ANON_ORG` | Development mode anonymous auth |
| `REPL_ID` | Replit environment ID |
| `REPL_IDENTITY` | Replit identity |
| `REPLIT_DOMAIN` | Replit domain |
| `REPLIT_DOMAINS` | Replit domains (multiple) |
| `REPLIT_DEV_DOMAIN` | Replit dev domain |
| `REPLIT_CONNECTORS_HOSTNAME` | Replit connectors host |

## AI/LLM Services

| Key | Purpose |
|-----|---------|
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_API_KEY_ENV_VAR` | OpenAI key reference |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Replit AI integrations OpenAI key |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Replit AI integrations base URL |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `ANTHROPIC_API_KEY_ENV_VAR` | Anthropic key reference |
| `LLM_PROVIDER` | LLM provider selection |
| `LLM_MODEL` | LLM model selection |
| `LLM_API_KEY` | Generic LLM API key |
| `EMBEDDINGS_PROVIDER` | Embeddings service provider |
| `EMBEDDINGS_MODEL` | Embeddings model |
| `EMBEDDINGS_DIMS` | Embeddings dimensions |

## Document Processing (OCR)

| Key | Purpose |
|-----|---------|
| `OCR_PROVIDER` | OCR service provider |
| `OCR_API_KEY` | OCR service API key |
| `VERYFI_CLIENT_ID` | Veryfi OCR client ID |
| `VERYFI_USERNAME` | Veryfi OCR username |

## Email Services

| Key | Purpose |
|-----|---------|
| `SENDGRID_API_KEY` | SendGrid email API key |
| `SENDGRID_FROM_EMAIL` | SendGrid sender email |
| `SENDGRID_WEBHOOK_SECRET` | SendGrid webhook verification |
| `RESEND_API_KEY` | Resend email API key |
| `RESEND_FROM_EMAIL` | Resend sender email |

## External APIs

| Key | Purpose |
|-----|---------|
| `GOOGLE_MAPS_API_KEY` | Google Maps geocoding |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps (frontend) |
| `FRED_API_KEY` | Federal Reserve Economic Data |
| `CENSUS_API_KEY` | US Census Bureau API |
| `APIFY_API_TOKEN` | Apify web scraping |
| `APIFY_CREXI_ACTOR_ID` | Apify Crexi actor |

## QuickBooks Integration

| Key | Purpose |
|-----|---------|
| `QUICKBOOKS_CLIENT_ID` | QB OAuth client ID |
| `QUICKBOOKS_CLIENT_SECRET` | QB OAuth client secret |
| `QUICKBOOKS_REDIRECT_URI` | QB OAuth redirect |
| `QB_ENCRYPTION_KEY` | QB token encryption |
| `CONNECTOR_QBO_ENABLED` | QB connector feature flag |
| `CONNECTOR_NETSUITE_ENABLED` | NetSuite connector flag |
| `CONNECTOR_INTACCT_ENABLED` | Sage Intacct connector flag |

## Email Marketing (Constant Contact)

| Key | Purpose |
|-----|---------|
| `CONSTANT_CONTACT_CLIENT_ID` | CC OAuth client ID |
| `CONSTANT_CONTACT_CLIENT_SECRET` | CC OAuth client secret |
| `CONSTANT_CONTACT_REDIRECT_URI` | CC OAuth redirect |
| `EMAIL_MARKETING_ENCRYPTION_KEY` | Token encryption |

## Payments (Stripe)

| Key | Purpose |
|-----|---------|
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `VITE_STRIPE_PUBLIC_KEY` | Stripe public key (frontend) |

## SMS (Twilio)

| Key | Purpose |
|-----|---------|
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |

## Marina Management System Integrations

| Key | Purpose |
|-----|---------|
| `DOCKMASTER_API_URL` | DockMaster API endpoint |
| `DOCKWA_API_URL` | Dockwa API endpoint |
| `STORABLE_MARINE_API_URL` | Storable Marine API endpoint |
| `MARINA_OFFICE_API_URL` | Marina Office API endpoint |
| `MOLO_API_URL` | Molo API endpoint |
| `PIERS_API_URL` | Piers API endpoint |
| `MARINACLOUD_API_URL` | MarinaCloud API endpoint |
| `MARINAGO_API_URL` | MarinaGo API endpoint |
| `HARBOUR_ASSIST_API_URL` | Harbour Assist API endpoint |
| `ANCHOR_API_URL` | Anchor API endpoint |

## Feature Flags

| Key | Purpose |
|-----|---------|
| `FINANCIAL_KERNEL_UI_ENABLED` | Financial Kernel feature flag |
| `INTEGRATIONS_PLATFORM_ENABLED` | Integrations platform flag |
| `LISTING_INGESTION_V` | Listing ingestion version |
| `LISTING_V` | Listings version |
| `DOCKET_V` | Docket version |
| `DOCKET_SCRAPER_V` | Docket scraper version |

## Background Services Configuration

| Key | Purpose |
|-----|---------|
| `CRON_SCHEDULE` | Cron job schedule |
| `DEV_CRON_SCHEDULE` | Dev cron schedule |
| `AUTO_START_DEADLINE_MONITOR` | Auto-start deadline monitor |
| `AUTO_START_RECONCILIATION_SERVICE` | Auto-start reconciliation |
| `RECONCILIATION_BATCH_SIZE` | Batch size for reconciliation |
| `RECONCILIATION_SYNC_INTERVAL_MINUTES` | Sync interval |
| `RECONCILIATION_MAX_RETRIES` | Max retry attempts |
| `RECONCILIATION_BASE_DELAY_MS` | Base delay in ms |
| `RECONCILIATION_MAX_DELAY_MS` | Max delay in ms |
| `RECONCILIATION_REQUEST_TIMEOUT_MS` | Request timeout |
| `RECONCILIATION_HEALTH_CHECK_INTERVAL_MS` | Health check interval |
| `RECONCILIATION_PARALLEL_SYNCS` | Parallel sync count |

## File Upload Configuration

| Key | Purpose |
|-----|---------|
| `UPLOAD_DIR` | Upload directory path |
| `MAX_UPLOAD_MB` | Max upload size in MB |

## Webhooks

| Key | Purpose |
|-----|---------|
| `WEBHOOK_SECRET` | Webhook signature verification |
| `APP_URL` | Application base URL |
| `WEB_REPL_RENEWAL` | Replit renewal flag |
| `WS_PATH` | WebSocket path |
| `VITE_WS_PATH` | WebSocket path (frontend) |

---

**Total: ~90+ environment variables**
