/**
 * OpenTelemetry Tracing Configuration
 * 
 * Provides distributed tracing and APM for the Marinalytics platform.
 * Instruments Express, PostgreSQL, and HTTP automatically.
 * 
 * IMPORTANT: This file must be imported BEFORE any other imports in index.ts:
 * 
 *   import './lib/tracing';  // Must be first!
 *   import express from 'express';
 *   // ... rest of imports
 * 
 * Environment Variables:
 *   OTEL_ENABLED=true                         - Enable/disable tracing
 *   OTEL_EXPORTER_ENDPOINT=http://...         - OTLP collector endpoint
 *   OTEL_SERVICE_NAME=marinalytics            - Service name in traces
 *   DD_API_KEY=xxx                            - If using Datadog, send traces there
 */

import { logger } from './logger';

const OTEL_ENABLED = process.env.OTEL_ENABLED === 'true';
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'marinalytics';

async function initTracing(): Promise<void> {
  if (!OTEL_ENABLED) {
    logger.info('OpenTelemetry tracing is disabled (set OTEL_ENABLED=true to enable)');
    return;
  }

  try {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
    const { Resource } = await import('@opentelemetry/resources');
    const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import('@opentelemetry/semantic-conventions');

    const traceExporter = new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_ENDPOINT || 'http://localhost:4318/v1/traces',
    });

    const sdk = new NodeSDK({
      resource: new Resource({
        [ATTR_SERVICE_NAME]: SERVICE_NAME,
        [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
        'deployment.environment': process.env.NODE_ENV || 'development',
      }),
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-express': { enabled: true },
          '@opentelemetry/instrumentation-pg': {
            enabled: true,
            enhancedDatabaseReporting: true,
          },
          '@opentelemetry/instrumentation-http': {
            enabled: true,
            ignoreIncomingPaths: ['/health', '/health/live', '/health/ready'],
          },
          // Disable noisy instrumentation
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-dns': { enabled: false },
        }),
      ],
    });

    sdk.start();
    logger.info({ service: SERVICE_NAME }, 'OpenTelemetry tracing initialized');

    // Graceful shutdown
    const shutdown = async () => {
      try {
        await sdk.shutdown();
        logger.info('OpenTelemetry SDK shut down successfully');
      } catch (err) {
        logger.error({ error: err }, 'Error shutting down OpenTelemetry SDK');
      }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.warn(
      { error },
      'OpenTelemetry packages not installed. Run: npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources @opentelemetry/semantic-conventions'
    );
  }
}

// Initialize on import
initTracing().catch((err) => {
  logger.error({ error: err }, 'Failed to initialize tracing');
});
