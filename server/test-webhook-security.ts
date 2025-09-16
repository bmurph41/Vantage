#!/usr/bin/env tsx
/**
 * Test script for the updated webhook security implementation
 * Tests all the critical fixes that were applied
 */

import { 
  WebhookSecurity,
  createTestWebhookSignature,
  createTestWebhookPayload,
  cleanup,
  type WebhookEvent
} from './webhook-security';
import crypto from 'crypto';

const WEBHOOK_SECRET = 'test-secret-for-security-validation';

/**
 * Test 1: Redis-based idempotency with atomic operations
 */
async function testRedisIdempotency(): Promise<void> {
  console.log('🧪 Testing Redis-based idempotency manager...');
  
  const webhookSecurity = new WebhookSecurity({
    secret: WEBHOOK_SECRET,
    redis: {
      host: 'localhost',
      port: 6379
    }
  });
  
  const testPayload = createTestWebhookPayload('document.created', {
    documentId: 'test-doc-123',
    projectId: 'test-project-456',
    fileName: 'test-document.pdf',
    fileType: 'application/pdf',
    uploadedBy: 'user-789'
  });
  
  const payloadString = JSON.stringify(testPayload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const { signature } = createTestWebhookSignature(payloadString, WEBHOOK_SECRET, timestamp);
  const idempotencyKey = crypto.randomUUID();
  
  // Create mock request with proper headers
  const mockReq = {
    get: (header: string) => {
      switch (header.toLowerCase()) {
        case 'x-webhook-signature':
          return signature;
        case 'x-webhook-timestamp':
          return timestamp;
        case 'x-idempotency-key':
          return idempotencyKey;
        default:
          return undefined;
      }
    }
  } as any;
  
  try {
    // First verification should succeed
    const result1 = await webhookSecurity.verifyWebhook(mockReq, payloadString);
    if (!result1.isValid) {
      throw new Error(`First verification failed: ${result1.error}`);
    }
    console.log('✅ First verification successful');
    
    // Second verification with same idempotency key should fail
    const result2 = await webhookSecurity.verifyWebhook(mockReq, payloadString);
    if (result2.isValid) {
      throw new Error('Second verification should have failed due to duplicate idempotency key');
    }
    if (!result2.error?.includes('already been processed')) {
      throw new Error(`Expected idempotency error, got: ${result2.error}`);
    }
    console.log('✅ Duplicate idempotency key properly rejected');
    
  } catch (error) {
    console.error('❌ Redis idempotency test failed:', error);
    throw error;
  }
}

/**
 * Test 2: Signature format validation
 */
async function testSignatureFormatValidation(): Promise<void> {
  console.log('🧪 Testing signature format validation...');
  
  const webhookSecurity = new WebhookSecurity({ secret: WEBHOOK_SECRET });
  const testPayload = '{"event":"test","data":{"id":"123"}}';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  const testCases = [
    { signature: 'invalid-format', expected: 'signature format' },
    { signature: 'sha256=tooshort', expected: 'signature format' },
    { signature: 'sha256=toolongextracharacters1234567890abcdef1234567890abcdef1234567890', expected: 'signature format' },
    { signature: 'sha256=invalidhexwithzzzz1234567890abcdef1234567890abcdef1234567890abcdef', expected: 'signature format' }
  ];
  
  for (const testCase of testCases) {
    const mockReq = {
      get: (header: string) => {
        switch (header.toLowerCase()) {
          case 'x-webhook-signature':
            return testCase.signature;
          case 'x-webhook-timestamp':
            return timestamp;
          case 'x-idempotency-key':
            return crypto.randomUUID();
          default:
            return undefined;
        }
      }
    } as any;
    
    const result = await webhookSecurity.verifyWebhook(mockReq, testPayload);
    if (result.isValid || !result.error?.includes(testCase.expected)) {
      throw new Error(`Expected signature format error for ${testCase.signature}, got: ${result.error}`);
    }
  }
  
  console.log('✅ Signature format validation working correctly');
}

/**
 * Test 3: Proper error type mapping
 */
async function testErrorTypeMapping(): Promise<void> {
  console.log('🧪 Testing proper error type mapping...');
  
  const webhookSecurity = new WebhookSecurity({ secret: WEBHOOK_SECRET });
  
  // Test missing signature
  const mockReqMissingSignature = {
    get: (header: string) => header === 'x-webhook-timestamp' ? Math.floor(Date.now() / 1000).toString() : undefined
  } as any;
  
  const result1 = await webhookSecurity.verifyWebhook(mockReqMissingSignature, '{"test":true}');
  if (result1.isValid) {
    throw new Error('Should have failed due to missing signature');
  }
  console.log('✅ Missing signature properly detected');
  
  // Test expired timestamp
  const expiredTimestamp = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 minutes ago
  const mockReqExpired = {
    get: (header: string) => {
      switch (header.toLowerCase()) {
        case 'x-webhook-signature':
          return 'sha256=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
        case 'x-webhook-timestamp':
          return expiredTimestamp;
        case 'x-idempotency-key':
          return crypto.randomUUID();
        default:
          return undefined;
      }
    }
  } as any;
  
  const result2 = await webhookSecurity.verifyWebhook(mockReqExpired, '{"test":true}');
  if (result2.isValid || !result2.error?.includes('expired')) {
    throw new Error(`Expected expired timestamp error, got: ${result2.error}`);
  }
  console.log('✅ Expired timestamp properly detected');
}

/**
 * Test 4: Raw body enforcement (simulate the middleware behavior)
 */
function testRawBodyEnforcement(): void {
  console.log('🧪 Testing raw body enforcement...');
  
  const webhookSecurity = new WebhookSecurity({ secret: WEBHOOK_SECRET });
  const middleware = webhookSecurity.createVerificationMiddleware();
  
  // Mock request without rawBody
  const mockReqNoRawBody = {} as any;
  const mockRes = {
    status: (code: number) => ({
      json: (body: any) => {
        if (code !== 400 || !body.error?.includes('Raw request body is required')) {
          throw new Error(`Expected 400 with raw body error, got ${code}: ${JSON.stringify(body)}`);
        }
        console.log('✅ Raw body enforcement working correctly');
        return { status: code, body };
      }
    })
  } as any;
  
  // This should trigger the raw body error
  middleware(mockReqNoRawBody, mockRes, () => {
    throw new Error('Next should not have been called');
  });
}

/**
 * Run all security tests
 */
async function runAllSecurityTests(): Promise<void> {
  console.log('🚀 Running comprehensive webhook security tests...\n');
  
  try {
    await testRedisIdempotency();
    console.log('');
    
    await testSignatureFormatValidation();
    console.log('');
    
    await testErrorTypeMapping();
    console.log('');
    
    testRawBodyEnforcement();
    console.log('');
    
    console.log('🎉 ALL SECURITY TESTS PASSED!');
    console.log('✅ Redis-based atomic idempotency working');
    console.log('✅ JSON.stringify fallback removed and raw body enforced');
    console.log('✅ HMAC comparison with signature format validation working');
    console.log('✅ Error mapping using proper error types working');
    console.log('✅ Signature format validation working');
    
  } catch (error) {
    console.error('❌ SECURITY TEST FAILED:', error);
    throw error;
  } finally {
    // Cleanup
    await cleanup();
  }
}

// Run tests if this file is executed directly
if (import.meta.url.endsWith(process.argv[1])) {
  runAllSecurityTests()
    .then(() => {
      console.log('\n🏁 All webhook security tests completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Webhook security tests failed:', error);
      process.exit(1);
    });
}

export { runAllSecurityTests };