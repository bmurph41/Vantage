/**
 * Test Setup and Utilities
 * Shared utilities for integration tests
 */

import { beforeAll, afterAll } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests

// Global test timeout
jest.setTimeout(30000); // 30 seconds

// Suppress console during tests (optional)
if (process.env.SUPPRESS_LOGS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

/**
 * Setup runs before all tests
 */
beforeAll(() => {
  console.log('🧪 Starting test suite...\n');
});

/**
 * Cleanup runs after all tests
 */
afterAll(() => {
  console.log('\n🧪 Test suite complete');
});

/**
 * Helper: Wait for a condition
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Helper: Retry an operation
 */
export async function retry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries reached');
}

/**
 * Helper: Generate random test email
 */
export function generateTestEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
}

/**
 * Helper: Generate random slug
 */
export function generateTestSlug(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Helper: Clean up test data after tests
 */
export async function cleanupTestData(orgIds: number[]) {
  // This will be imported by individual test files
  // Implement based on your ORM
}

export default {
  waitFor,
  retry,
  generateTestEmail,
  generateTestSlug,
  cleanupTestData
};
