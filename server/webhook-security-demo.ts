/**
 * Webhook Security System Demo
 * 
 * This file demonstrates how to use the webhook security system for secure
 * inter-app communication with HMAC verification, replay attack prevention,
 * and idempotency checking.
 */

import type { Express, Request, Response } from "express";
import { 
  WebhookSecurity, 
  createTestWebhookSignature,
  createTestWebhookPayload,
  isValidWebhookEventType,
  cleanup,
  type WebhookEvent,
  type DocumentCreatedEvent,
  type TaskStatusChangedEvent,
} from "./webhook-security";
import crypto from "crypto";

// =============================================================================
// WEBHOOK SECURITY SETUP
// =============================================================================

// In production, this should come from environment variables
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "your-secure-webhook-secret";

// Create webhook security instance
const webhookSecurity = new WebhookSecurity({
  secret: WEBHOOK_SECRET,
  timestampToleranceMinutes: 5, // Allow 5 minutes tolerance for timestamp
  requireIdempotencyKey: true,   // Require idempotency keys for duplicate prevention
});

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Safely extracts an event ID from webhook payload data
 */
function getEventId(payload: WebhookEvent): string {
  const data = payload.data as any;
  return data.documentId || data.taskId || data.projectId || 'unknown';
}

// =============================================================================
// WEBHOOK HANDLERS BY EVENT TYPE
// =============================================================================

/**
 * Handle document creation webhook
 */
async function handleDocumentCreated(payload: DocumentCreatedEvent): Promise<void> {
  console.log('📄 Document created:', payload.data.fileName);
  
  // Example: Update database with new document info
  // await storage.createDocumentRequirement({
  //   projectId: payload.data.projectId,
  //   taskId: payload.data.taskId,
  //   title: payload.data.fileName,
  //   provider: payload.source,
  //   externalDocId: payload.data.documentId,
  //   status: 'received',
  //   metadata: payload.data.metadata || {},
  // });
  
  console.log(`✅ Processed document creation for project ${payload.data.projectId}`);
}

/**
 * Handle task status change webhook
 */
async function handleTaskStatusChanged(payload: TaskStatusChangedEvent): Promise<void> {
  console.log(`📋 Task status changed: ${payload.data.previousStatus} → ${payload.data.newStatus}`);
  
  // Example: Update task status in database
  // await storage.updateTask(payload.data.taskId, {
  //   status: payload.data.newStatus as any,
  //   updatedAt: new Date(payload.data.changeDate),
  // });
  
  console.log(`✅ Processed task status change for task ${payload.data.taskId}`);
}

/**
 * Central webhook event handler
 */
async function handleWebhookEvent(payload: WebhookEvent): Promise<void> {
  console.log(`🔔 Processing webhook event: ${payload.event}`);
  
  try {
    switch (payload.event) {
      case 'document.created':
        await handleDocumentCreated(payload);
        break;
        
      case 'document.tagged':
        console.log(`🏷️ Document tagged: ${payload.data.documentId} with tags: ${payload.data.tags.join(', ')}`);
        break;
        
      case 'document.verified':
        console.log(`✅ Document verified: ${payload.data.documentId} status: ${payload.data.verificationStatus}`);
        break;
        
      case 'document.rejected':
        console.log(`❌ Document rejected: ${payload.data.documentId} reason: ${payload.data.reason}`);
        break;
        
      case 'document.deleted':
        console.log(`🗑️ Document deleted: ${payload.data.documentId}`);
        break;
        
      case 'task.status_changed':
        await handleTaskStatusChanged(payload);
        break;
        
      case 'task.assigned':
        console.log(`👤 Task assigned: ${payload.data.taskId} to ${payload.data.assignedTo}`);
        break;
        
      case 'project.created':
        console.log(`🚀 Project created: ${payload.data.name} (${payload.data.projectId})`);
        break;
        
      default:
        console.log(`⚠️ Unknown event type: ${(payload as any).event}`);
    }
  } catch (error) {
    console.error(`❌ Error processing webhook event ${payload.event}:`, error);
    throw error;
  }
}

// =============================================================================
// EXPRESS MIDDLEWARE SETUP
// =============================================================================

/**
 * SECURITY-ENFORCED Raw body parser middleware for webhook verification
 * This is CRITICAL - we need the exact raw request body to verify signatures
 * Any modification to the original body will cause signature verification to fail
 */
export const rawBodyMiddleware = (req: any, res: any, next: any) => {
  if (req.originalUrl?.startsWith('/webhooks/')) {
    const chunks: Buffer[] = [];
    
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    
    req.on('end', () => {
      // Store both Buffer and string versions for flexibility
      req.rawBodyBuffer = Buffer.concat(chunks);
      req.rawBody = req.rawBodyBuffer.toString('utf8');
      
      // Validate that we actually received data
      if (req.rawBody.length === 0) {
        return res.status(400).json({
          error: 'Empty webhook payload received',
          code: 'EMPTY_PAYLOAD'
        });
      }
      
      next();
    });
    
    req.on('error', (error: Error) => {
      console.error('Raw body parsing error:', error);
      res.status(400).json({
        error: 'Failed to parse raw request body',
        code: 'RAW_BODY_PARSE_ERROR'
      });
    });
  } else {
    next();
  }
};

/**
 * Register webhook routes with security
 */
export function registerWebhookRoutes(app: Express): void {
  // Apply raw body middleware for webhook routes
  app.use('/webhooks', rawBodyMiddleware);
  
  // Webhook endpoint with security verification
  app.post('/webhooks/events', 
    webhookSecurity.createVerificationMiddleware(),
    async (req: any, res: Response) => {
      try {
        const payload: WebhookEvent = req.webhookPayload;
        
        // Process the webhook event
        await handleWebhookEvent(payload);
        
        // Return success response
        res.status(200).json({ 
          success: true, 
          message: `Webhook event ${payload.event} processed successfully`,
          eventId: getEventId(payload),
        });
        
      } catch (error) {
        console.error('❌ Webhook processing error:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Internal server error while processing webhook',
        });
      }
    }
  );

  // Health check endpoint (no auth required)
  app.get('/webhooks/health', (req: Request, res: Response) => {
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'webhook-security',
    });
  });
}

// =============================================================================
// TESTING UTILITIES
// =============================================================================

/**
 * Test webhook signature generation and verification
 */
export async function testWebhookSecurity(): Promise<void> {
  console.log('🧪 Testing webhook security system...');
  
  try {
    // Create test payload
    const testPayload = createTestWebhookPayload('document.created', {
      documentId: 'doc-123',
      projectId: 'project-456', 
      fileName: 'test-document.pdf',
      fileType: 'application/pdf',
      uploadedBy: 'user-789',
      metadata: { size: 1024, version: 1 },
    });
    
    const payloadString = JSON.stringify(testPayload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    // Generate signature
    const { signature } = createTestWebhookSignature(payloadString, WEBHOOK_SECRET, timestamp);
    
    // Create mock request object
    const mockReq = {
      get: (header: string) => {
        switch (header.toLowerCase()) {
          case 'x-webhook-signature':
            return signature;
          case 'x-webhook-timestamp':
            return timestamp;
          case 'x-idempotency-key':
            return crypto.randomUUID();
          default:
            return undefined;
        }
      },
      rawBody: payloadString,
    } as any;
    
    // Test verification
    const result = await webhookSecurity.verifyWebhook(mockReq, payloadString);
    
    if (result.isValid) {
      console.log('✅ Webhook verification test PASSED');
      console.log('📄 Parsed payload:', result.parsedPayload?.event);
    } else {
      console.log('❌ Webhook verification test FAILED:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Webhook security test error:', error);
  }
}

/**
 * Test invalid signature handling
 */
export async function testInvalidSignature(): Promise<void> {
  console.log('🧪 Testing invalid signature handling...');
  
  const testPayload = '{"event":"document.created","data":{"documentId":"test"}}';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  const mockReq = {
    get: (header: string) => {
      switch (header.toLowerCase()) {
        case 'x-webhook-signature':
          return 'sha256=invalid-signature';
        case 'x-webhook-timestamp':
          return timestamp;
        case 'x-idempotency-key':
          return crypto.randomUUID();
        default:
          return undefined;
      }
    },
    rawBody: testPayload,
  } as any;
  
  const result = await webhookSecurity.verifyWebhook(mockReq, testPayload);
  
  if (!result.isValid && result.error?.includes('signature')) {
    console.log('✅ Invalid signature test PASSED - correctly rejected');
  } else {
    console.log('❌ Invalid signature test FAILED - should have been rejected');
  }
}

/**
 * Test timestamp expiration handling
 */
export async function testExpiredTimestamp(): Promise<void> {
  console.log('🧪 Testing expired timestamp handling...');
  
  const testPayload = '{"event":"document.created","data":{"documentId":"test"}}';
  const expiredTimestamp = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 minutes ago
  
  const mockReq = {
    get: (header: string) => {
      switch (header.toLowerCase()) {
        case 'x-webhook-signature':
          return webhookSecurity.generateSignature(testPayload, expiredTimestamp);
        case 'x-webhook-timestamp':
          return expiredTimestamp;
        case 'x-idempotency-key':
          return crypto.randomUUID();
        default:
          return undefined;
      }
    },
    rawBody: testPayload,
  } as any;
  
  const result = await webhookSecurity.verifyWebhook(mockReq, testPayload);
  
  if (!result.isValid && result.error?.includes('timestamp')) {
    console.log('✅ Expired timestamp test PASSED - correctly rejected');
  } else {
    console.log('❌ Expired timestamp test FAILED - should have been rejected');
  }
}

/**
 * Run all webhook security tests
 */
export async function runWebhookTests(): Promise<void> {
  console.log('🚀 Running webhook security tests...\n');
  
  await testWebhookSecurity();
  console.log('');
  
  await testInvalidSignature();
  console.log('');
  
  await testExpiredTimestamp();
  console.log('');
  
  console.log('🏁 All webhook security tests completed!');
}

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

/**
 * Cleanup function for graceful shutdown
 */
export async function cleanupWebhookSystem(): Promise<void> {
  console.log('🧹 Cleaning up webhook security system...');
  await cleanup();
  console.log('✅ Webhook security system cleanup completed');
}

// =============================================================================
// EXAMPLE USAGE IN MAIN APPLICATION
// =============================================================================

/**
 * Example of how to integrate webhook security into your main app
 */
export function exampleIntegration(): void {
  /*
  // In your main server file (server/index.ts):
  
  import express from 'express';
  import { registerWebhookRoutes, cleanupWebhookSystem } from './webhook-security-demo';
  
  const app = express();
  
  // Register webhook routes
  registerWebhookRoutes(app);
  
  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    await cleanupWebhookSystem();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    await cleanupWebhookSystem();
    process.exit(0);
  });
  */
}

// =============================================================================
// MANUAL TESTING (if running this file directly)
// =============================================================================

if (require.main === module) {
  console.log('🔧 Running webhook security demo...\n');
  
  runWebhookTests().then(() => {
    console.log('\n🎉 Demo completed successfully!');
    cleanupWebhookSystem();
  }).catch((error) => {
    console.error('\n💥 Demo failed:', error);
    cleanupWebhookSystem();
    process.exit(1);
  });
}