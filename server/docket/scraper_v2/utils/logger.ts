import { logger as baseLogger } from '../../../lib/logger';

export function createRunLogger(runId: string) {
  return baseLogger.child({ 
    module: 'docket_v2', 
    runId,
  });
}

export function logDiscovery(runId: string, sourceId: string, count: number, method: string) {
  baseLogger.info({
    module: 'docket_v2',
    event: 'discovery_complete',
    runId,
    sourceId,
    count,
    method,
  });
}

export function logFetch(runId: string, url: string, statusCode: number, ms: number) {
  baseLogger.debug({
    module: 'docket_v2',
    event: 'fetch_complete',
    runId,
    url,
    statusCode,
    durationMs: ms,
  });
}

export function logExtraction(runId: string, url: string, success: boolean, error?: string) {
  const level = success ? 'debug' : 'warn';
  baseLogger[level]({
    module: 'docket_v2',
    event: 'extraction_complete',
    runId,
    url,
    success,
    error,
  });
}

export function logRelevance(runId: string, articleId: string, score: number, label: string) {
  baseLogger.debug({
    module: 'docket_v2',
    event: 'relevance_scored',
    runId,
    articleId,
    score,
    label,
  });
}

export function logRunComplete(runId: string, status: string, metrics: Record<string, number>) {
  baseLogger.info({
    module: 'docket_v2',
    event: 'run_complete',
    runId,
    status,
    ...metrics,
  });
}

export function logError(runId: string, error: Error, context?: Record<string, unknown>) {
  baseLogger.error({
    module: 'docket_v2',
    event: 'error',
    runId,
    error: error.message,
    stack: error.stack,
    ...context,
  });
}

export { baseLogger as logger };
