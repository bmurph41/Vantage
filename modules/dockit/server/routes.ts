import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { notificationService } from "./notifications";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import { billingService } from "./billingService";
import { insertBillingScheduleSchema } from "../shared/schema";
import { setupAuth, isAuthenticated, requirePermission, requireRole } from "./replitAuth";
import { PERMISSIONS, ROLES } from "../shared/permissions";

// Utility function to convert snake_case keys to camelCase
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

function normalizeKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(normalizeKeys);
  }
  const normalized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    normalized[toCamelCase(key)] = normalizeKeys(value);
  }
  return normalized;
}
import { 
  insertCustomerSchema, insertBoatSchema, insertSlipSchema, 
  insertLeaseSchema, insertLaunchSchema, insertPaymentSchema,
  insertIntegrationSchema, insertCommunicationSchema,
  insertImportJobSchema, insertMarinaLayoutSchema, insertReservationSchema,
  insertPricingRuleSchema, insertSlipPricingSchema,
  insertMessageThreadSchema, insertMessageSchema,
  insertOrganizationSchema, insertMarinaSchema,
  insertContractSchema, insertContractTemplateSchema,
  insertAuditLogSchema
} from "../shared/schema";
import { initializeWebSocket, getWebSocketServer } from "./websocket";
import { z } from "zod";

// File signature validation for security
function validateFileSignature(buffer: Buffer, extension: string): boolean {
  const ext = extension.toLowerCase();
  
  // Check file signatures (magic bytes)
  if (ext === '.xlsx') {
    // XLSX files start with PK (ZIP signature)
    return buffer[0] === 0x50 && buffer[1] === 0x4B;
  } else if (ext === '.xls') {
    // XLS files have OLE signature
    return buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0;
  } else if (ext === '.csv') {
    // CSV files should be plain text - allow UTF-8 content
    const sample = buffer.slice(0, Math.min(1024, buffer.length));
    let controlByteCount = 0;
    
    for (let i = 0; i < sample.length; i++) {
      const byte = sample[i];
      // Count problematic control bytes (not newlines, carriage returns, tabs)
      if (byte < 9 || (byte > 13 && byte < 32)) {
        controlByteCount++;
      }
    }
    
    // Allow high UTF-8 bytes (>126) and only reject if too many control bytes
    const controlByteRatio = controlByteCount / sample.length;
    return controlByteRatio < 0.1; // Allow up to 10% control bytes for UTF-8 tolerance
  }
  
  return false;
}

// Zod validation schemas for import endpoints
const importStartSchema = z.object({
  mappings: z.record(z.array(z.object({
    sourceColumn: z.string(),
    targetField: z.string(),
    required: z.boolean().optional()
  }))),
  duplicateStrategy: z.enum(['skip', 'update', 'error']).default('skip'),
  validateOnly: z.boolean().default(false)
});

// Zod validation schemas for SpeedyDock endpoints
const checkInSchema = z.object({
  customerLocation: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().optional()
  }),
  timestamp: z.number().optional()
});

const queueStatusSchema = z.object({
  status: z.enum(['checked_in', 'queued', 'in_progress', 'launched', 'retrieved']),
  staffAssigned: z.string().optional(),
  priorityLevel: z.enum(['low', 'normal', 'high', 'urgent']).optional()
});

// Authentication middleware for customer-specific endpoints
const requireCustomerAuth = (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
};

// Authorization middleware for staff-only endpoints
const requireStaffAuth = (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  // In production, check actual staff role from user object
  // For demo: assume all authenticated users can act as staff in development
  if (process.env.NODE_ENV !== 'development' && !req.session?.user?.isStaff) {
    return res.status(403).json({ message: "Staff access required" });
  }
  next();
};
import { FileParser } from "./import/parsers";
import { DataMapper } from "./import/mappers";
import { ImportProcessor } from "./import/processors";
import { ImportValidator } from "./import/validators";

export async function registerRoutes(
  app: Express,
  sessionParser: any,
  sessionSecret: string
): Promise<Server> {
  // Set up Replit Auth
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User management routes - require MANAGE_STAFF permission
  app.get('/api/users', isAuthenticated, requirePermission(PERMISSIONS.MANAGE_STAFF), async (_req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get('/api/users/:id', isAuthenticated, requirePermission(PERMISSIONS.VIEW_DASHBOARD), async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post('/api/users', isAuthenticated, requirePermission(PERMISSIONS.MANAGE_STAFF), async (req, res) => {
    try {
      const { email, firstName, lastName, role } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      const validRoles = Object.values(ROLES);
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role specified" });
      }
      
      const newUser = await storage.createUser({
        email,
        firstName,
        lastName,
        role: role || ROLES.CUSTOMER,
      });
      res.status(201).json(newUser);
    } catch (error: any) {
      console.error("Error creating user:", error);
      if (error.message?.includes('unique') || error.code === '23505') {
        return res.status(400).json({ message: "A user with this email already exists" });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.patch('/api/users/:id', isAuthenticated, requirePermission(PERMISSIONS.MANAGE_STAFF), async (req, res) => {
    try {
      const { email, firstName, lastName, role, isActive } = req.body;
      
      const validRoles = Object.values(ROLES);
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role specified" });
      }
      
      const updatedUser = await storage.updateUser(req.params.id, {
        email,
        firstName,
        lastName,
        role,
        isActive,
      });
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete('/api/users/:id', isAuthenticated, requirePermission(PERMISSIONS.MANAGE_ROLES), async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Organizations
  app.get("/api/organizations", isAuthenticated, async (_req, res) => {
    try {
      const organizations = await storage.getOrganizations();
      res.json(organizations);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      res.status(500).json({ message: "Failed to fetch organizations" });
    }
  });

  app.get("/api/organizations/:id", isAuthenticated, async (req, res) => {
    try {
      const organization = await storage.getOrganization(req.params.id);
      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }
      res.json(organization);
    } catch (error) {
      console.error("Error fetching organization:", error);
      res.status(500).json({ message: "Failed to fetch organization" });
    }
  });

  app.get("/api/organizations/:id/marinas", isAuthenticated, async (req, res) => {
    try {
      const marinas = await storage.getMarinasByOrganization(req.params.id);
      res.json(marinas);
    } catch (error) {
      console.error("Error fetching organization marinas:", error);
      res.status(500).json({ message: "Failed to fetch marinas" });
    }
  });

  app.post("/api/organizations", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_ROLES), async (req, res) => {
    try {
      const result = insertOrganizationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid organization data", 
          errors: result.error.issues 
        });
      }
      const organization = await storage.createOrganization(result.data);
      res.status(201).json(organization);
    } catch (error: any) {
      console.error("Error creating organization:", error);
      res.status(500).json({ message: "Failed to create organization" });
    }
  });

  app.patch("/api/organizations/:id", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_ROLES), async (req, res) => {
    try {
      const updateSchema = insertOrganizationSchema.partial();
      const result = updateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid organization data", 
          errors: result.error.issues 
        });
      }
      const organization = await storage.updateOrganization(req.params.id, result.data);
      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }
      res.json(organization);
    } catch (error) {
      console.error("Error updating organization:", error);
      res.status(500).json({ message: "Failed to update organization" });
    }
  });

  // Marina map data
  app.get("/api/marina/map-data", async (_req, res) => {
    try {
      const mapData = await storage.getMarinaMapData();
      res.json(mapData);
    } catch (error) {
      console.error("Error fetching marina map data:", error);
      res.status(500).json({ message: "Failed to fetch marina map data" });
    }
  });

  // Marinas
  app.get("/api/marinas", async (_req, res) => {
    try {
      const marinas = await storage.getMarinas();
      res.json(marinas);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch marinas" });
    }
  });

  app.get("/api/marinas/:id", async (req, res) => {
    try {
      const marina = await storage.getMarina(req.params.id);
      if (!marina) {
        return res.status(404).json({ message: "Marina not found" });
      }
      res.json(marina);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch marina" });
    }
  });

  app.post("/api/marinas", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_ROLES), async (req, res) => {
    try {
      const result = insertMarinaSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid marina data", 
          errors: result.error.issues 
        });
      }
      const marina = await storage.createMarina(result.data);
      res.status(201).json(marina);
    } catch (error: any) {
      console.error("Error creating marina:", error);
      res.status(500).json({ message: "Failed to create marina" });
    }
  });

  app.patch("/api/marinas/:id", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_ROLES), async (req, res) => {
    try {
      const updateSchema = insertMarinaSchema.partial();
      const result = updateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid marina data", 
          errors: result.error.issues 
        });
      }
      const marina = await storage.updateMarina(req.params.id, result.data);
      if (!marina) {
        return res.status(404).json({ message: "Marina not found" });
      }
      res.json(marina);
    } catch (error) {
      console.error("Error updating marina:", error);
      res.status(500).json({ message: "Failed to update marina" });
    }
  });

  // Customers
  app.get("/api/customers", async (_req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      // Normalize snake_case to camelCase
      const normalizedBody = normalizeKeys(req.body);
      const result = insertCustomerSchema.safeParse(normalizedBody);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid customer data", 
          errors: result.error.issues 
        });
      }
      const customer = await storage.createCustomer(result.data);
      res.status(201).json(customer);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/customers/:id", async (req, res) => {
    try {
      // Allow updates to both insert fields and calculated fields like lastLaunchDate
      const allowedUpdates = insertCustomerSchema.partial().extend({
        lastLaunchDate: z.string().datetime().optional(),
      });
      const validatedData = allowedUpdates.parse(req.body);
      
      // Convert lastLaunchDate string to Date if provided
      const updateData: any = { ...validatedData };
      if (updateData.lastLaunchDate) {
        updateData.lastLaunchDate = new Date(updateData.lastLaunchDate);
      }
      
      const customer = await storage.updateCustomer(req.params.id, updateData);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Customer update error:", error);
      res.status(400).json({ message: "Invalid customer data" });
    }
  });

  // Boats
  app.get("/api/boats", async (_req, res) => {
    try {
      const boats = await storage.getBoats();
      res.json(boats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch boats" });
    }
  });

  app.get("/api/customers/:customerId/boats", async (req, res) => {
    try {
      const boats = await storage.getBoatsByCustomer(req.params.customerId);
      res.json(boats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch customer boats" });
    }
  });

  app.post("/api/boats", async (req, res) => {
    try {
      const normalized = normalizeKeys(req.body);
      // Ensure length and beam are strings for decimal fields
      const coalesced = { 
        ...normalized, 
        length: typeof normalized.length === 'number' ? String(normalized.length) : normalized.length, 
        beam: typeof normalized.beam === 'number' ? String(normalized.beam) : normalized.beam 
      };
      const result = insertBoatSchema.safeParse(coalesced);
      if (!result.success) {
        return res.status(400).json({ 
          message: 'Invalid boat data', 
          errors: result.error.issues 
        });
      }
      const boat = await storage.createBoat(result.data);
      res.status(201).json(boat);
    } catch (error) {
      res.status(400).json({ message: "Invalid boat data" });
    }
  });

  // Slips
  app.get("/api/slips", async (_req, res) => {
    try {
      const slips = await storage.getSlips();
      res.json(slips);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch slips" });
    }
  });

  app.get("/api/slips/available", async (_req, res) => {
    try {
      const slips = await storage.getAvailableSlips();
      res.json(slips);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch available slips" });
    }
  });

  app.post("/api/slips", async (req, res) => {
    try {
      const validatedData = insertSlipSchema.parse(req.body);
      const slip = await storage.createSlip(validatedData);
      res.status(201).json(slip);
    } catch (error) {
      res.status(400).json({ message: "Invalid slip data" });
    }
  });

  // Leases
  app.get("/api/leases", async (_req, res) => {
    try {
      const leases = await storage.getLeases();
      res.json(leases);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch leases" });
    }
  });

  app.get("/api/leases/active", async (_req, res) => {
    try {
      const leases = await storage.getActiveLeases();
      res.json(leases);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active leases" });
    }
  });

  app.post("/api/leases", async (req, res) => {
    try {
      const validatedData = insertLeaseSchema.parse(req.body);
      const lease = await storage.createLease(validatedData);
      res.status(201).json(lease);
    } catch (error) {
      res.status(400).json({ message: "Invalid lease data" });
    }
  });

  app.put("/api/leases/:id", async (req, res) => {
    try {
      const validatedData = insertLeaseSchema.partial().parse(req.body);
      const lease = await storage.updateLease(req.params.id, validatedData);
      if (!lease) {
        return res.status(404).json({ message: "Lease not found" });
      }
      res.json(lease);
    } catch (error) {
      res.status(400).json({ message: "Invalid lease data" });
    }
  });

  // Contracts and E-signatures
  app.get("/api/contracts", isAuthenticated, async (req, res) => {
    try {
      const marinaId = req.query.marinaId as string | undefined;
      const contracts = await storage.getContracts(marinaId);
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ message: "Failed to fetch contracts" });
    }
  });

  app.get("/api/contracts/:id", isAuthenticated, async (req, res) => {
    try {
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contract" });
    }
  });

  app.get("/api/contracts/customer/:customerId", isAuthenticated, async (req, res) => {
    try {
      const contracts = await storage.getContractsByCustomer(req.params.customerId);
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch customer contracts" });
    }
  });

  app.get("/api/contracts/status/:status", isAuthenticated, async (req, res) => {
    try {
      const marinaId = req.query.marinaId as string | undefined;
      const contracts = await storage.getContractsByStatus(req.params.status, marinaId);
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contracts by status" });
    }
  });

  app.get("/api/contracts/pending/expiring", isAuthenticated, async (req, res) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      const contracts = await storage.getPendingContracts(days);
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch expiring contracts" });
    }
  });

  app.post("/api/contracts", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_BILLING), async (req, res) => {
    try {
      const result = insertContractSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid contract data", 
          errors: result.error.issues 
        });
      }
      const contract = await storage.createContract(result.data);
      res.status(201).json(contract);
    } catch (error) {
      console.error("Error creating contract:", error);
      res.status(500).json({ message: "Failed to create contract" });
    }
  });

  app.patch("/api/contracts/:id", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_BILLING), async (req, res) => {
    try {
      const updateSchema = insertContractSchema.partial();
      const result = updateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid contract data", 
          errors: result.error.issues 
        });
      }
      const contract = await storage.updateContract(req.params.id, result.data);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      console.error("Error updating contract:", error);
      res.status(500).json({ message: "Failed to update contract" });
    }
  });

  app.post("/api/contracts/:id/send", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_BILLING), async (req, res) => {
    try {
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      
      // Update contract status to sent
      const updatedContract = await storage.updateContract(req.params.id, {
        status: 'sent',
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days
      });
      
      // Send notification to customer
      const customer = await storage.getCustomer(contract.customerId);
      if (customer?.email) {
        await notificationService.notifyCustomer({
          type: 'contract_sent',
          customerId: contract.customerId,
          customerEmail: customer.email,
          customerName: `${customer.firstName} ${customer.lastName}`,
          contractId: contract.id,
          contractType: contract.contractType,
        });
      }
      
      res.json(updatedContract);
    } catch (error) {
      console.error("Error sending contract:", error);
      res.status(500).json({ message: "Failed to send contract" });
    }
  });

  app.post("/api/contracts/:id/sign", async (req, res) => {
    try {
      const { signedBy, signatureImageUrl } = req.body;
      
      if (!signedBy) {
        return res.status(400).json({ message: "Signer name is required" });
      }
      
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      
      if (contract.status === 'signed') {
        return res.status(400).json({ message: "Contract is already signed" });
      }
      
      if (contract.status === 'expired') {
        return res.status(400).json({ message: "Contract has expired" });
      }
      
      const signatureData = {
        signedBy,
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        signatureImageUrl,
      };
      
      const signedContract = await storage.signContract(req.params.id, signatureData);
      
      // Send confirmation notification
      const customer = await storage.getCustomer(contract.customerId);
      if (customer?.email) {
        await notificationService.notifyCustomer({
          type: 'contract_signed',
          customerId: contract.customerId,
          customerEmail: customer.email,
          customerName: `${customer.firstName} ${customer.lastName}`,
          contractId: contract.id,
          contractType: contract.contractType,
        });
      }
      
      res.json(signedContract);
    } catch (error) {
      console.error("Error signing contract:", error);
      res.status(500).json({ message: "Failed to sign contract" });
    }
  });

  // Contract Templates
  app.get("/api/contract-templates", isAuthenticated, async (req, res) => {
    try {
      const marinaId = req.query.marinaId as string | undefined;
      const templates = await storage.getContractTemplates(marinaId);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contract templates" });
    }
  });

  app.get("/api/contract-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const template = await storage.getContractTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  app.post("/api/contract-templates", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_ROLES), async (req, res) => {
    try {
      const result = insertContractTemplateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid template data", 
          errors: result.error.issues 
        });
      }
      const template = await storage.createContractTemplate(result.data);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating contract template:", error);
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  app.patch("/api/contract-templates/:id", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_ROLES), async (req, res) => {
    try {
      const updateSchema = insertContractTemplateSchema.partial();
      const result = updateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid template data", 
          errors: result.error.issues 
        });
      }
      const template = await storage.updateContractTemplate(req.params.id, result.data);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error updating contract template:", error);
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  app.delete("/api/contract-templates/:id", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_ROLES), async (req, res) => {
    try {
      await storage.deleteContractTemplate(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting contract template:", error);
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // Contract generation from template
  app.post("/api/contracts/generate", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_BILLING), async (req, res) => {
    try {
      const { templateId, customerId, reservationId, leaseId, contractData } = req.body;
      
      if (!templateId || !customerId) {
        return res.status(400).json({ message: "Template ID and customer ID are required" });
      }
      
      const template = await storage.getContractTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      const customer = await storage.getCustomer(customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      // Build contract from template
      const contractResult = insertContractSchema.safeParse({
        marinaId: template.marinaId || contractData?.marina?.id || 'default-marina',
        customerId,
        reservationId,
        leaseId,
        contractType: template.contractType,
        templateId,
        status: 'pending',
        contractData: contractData || {},
      });
      
      if (!contractResult.success) {
        return res.status(400).json({ 
          message: "Invalid contract data", 
          errors: contractResult.error.issues 
        });
      }
      
      const contract = await storage.createContract(contractResult.data);
      res.status(201).json(contract);
    } catch (error) {
      console.error("Error generating contract:", error);
      res.status(500).json({ message: "Failed to generate contract" });
    }
  });

  // Audit Logs
  app.get("/api/audit-logs", isAuthenticated, requirePermission(PERMISSIONS.VIEW_REPORTS), async (req, res) => {
    try {
      const options = {
        marinaId: req.query.marinaId as string | undefined,
        userId: req.query.userId as string | undefined,
        entityType: req.query.entityType as string | undefined,
        entityId: req.query.entityId as string | undefined,
        action: req.query.action as string | undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };
      
      const logs = await storage.getAuditLogs(options);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/audit-logs/stats", isAuthenticated, requirePermission(PERMISSIONS.VIEW_REPORTS), async (req, res) => {
    try {
      const marinaId = req.query.marinaId as string | undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const stats = await storage.getAuditLogStats(marinaId, startDate, endDate);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching audit log stats:", error);
      res.status(500).json({ message: "Failed to fetch audit log stats" });
    }
  });

  app.get("/api/audit-logs/entity/:entityType/:entityId", isAuthenticated, requirePermission(PERMISSIONS.VIEW_REPORTS), async (req, res) => {
    try {
      const logs = await storage.getAuditLogsByEntity(req.params.entityType, req.params.entityId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching entity audit logs:", error);
      res.status(500).json({ message: "Failed to fetch entity audit logs" });
    }
  });

  app.get("/api/audit-logs/:id", isAuthenticated, requirePermission(PERMISSIONS.VIEW_REPORTS), async (req, res) => {
    try {
      const log = await storage.getAuditLog(req.params.id);
      if (!log) {
        return res.status(404).json({ message: "Audit log not found" });
      }
      res.json(log);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit log" });
    }
  });

  app.post("/api/audit-logs", isAuthenticated, async (req, res) => {
    try {
      const result = insertAuditLogSchema.safeParse({
        ...req.body,
        userId: (req as any).user?.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });
      
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid audit log data", 
          errors: result.error.issues 
        });
      }
      
      const log = await storage.createAuditLog(result.data);
      res.status(201).json(log);
    } catch (error) {
      console.error("Error creating audit log:", error);
      res.status(500).json({ message: "Failed to create audit log" });
    }
  });

  // Compliance data export
  app.get("/api/audit-logs/export", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_ROLES), async (req, res) => {
    try {
      const options = {
        marinaId: req.query.marinaId as string | undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        limit: 10000, // Allow larger exports
      };
      
      const logs = await storage.getAuditLogs(options);
      
      // Format for CSV export
      const format = req.query.format as string || 'json';
      
      if (format === 'csv') {
        const headers = ['ID', 'Timestamp', 'User ID', 'Marina ID', 'Action', 'Entity Type', 'Entity ID', 'IP Address', 'User Agent', 'Details'];
        const rows = logs.map(log => [
          log.id,
          log.timestamp?.toISOString() || '',
          log.userId || '',
          log.marinaId || '',
          log.action,
          log.entityType || '',
          log.entityId || '',
          log.ipAddress || '',
          log.userAgent || '',
          JSON.stringify(log.details || {}),
        ]);
        
        const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
        return res.send(csvContent);
      }
      
      res.json(logs);
    } catch (error) {
      console.error("Error exporting audit logs:", error);
      res.status(500).json({ message: "Failed to export audit logs" });
    }
  });

  // Launches
  app.get("/api/launches", async (_req, res) => {
    try {
      const launches = await storage.getLaunches();
      res.json(launches);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch launches" });
    }
  });

  app.get("/api/launches/today", async (_req, res) => {
    try {
      const launches = await storage.getTodaysLaunches();
      res.json(launches);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch today's launches" });
    }
  });

  app.get("/api/launches/upcoming", async (_req, res) => {
    try {
      const launches = await storage.getUpcomingLaunches();
      res.json(launches);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch upcoming launches" });
    }
  });

  app.post("/api/launches", async (req, res) => {
    try {
      // Normalize snake_case to camelCase
      const normalizedBody = normalizeKeys(req.body);
      const result = insertLaunchSchema.safeParse(normalizedBody);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid launch data", 
          errors: result.error.issues 
        });
      }
      
      // Use atomic launch creation with conflict checking
      const launch = await storage.createLaunchWithConflictCheck(result.data);
      
      // Send notifications to customer and staff
      try {
        const customer = await storage.getCustomer(launch.customerId);
        const boat = await storage.getBoat(launch.boatId);
        
        const notificationData = {
          type: 'launch_scheduled' as const,
          customerId: launch.customerId,
          customerEmail: customer?.email,
          customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown Customer',
          launchId: launch.id,
          scheduledTime: launch.scheduledTime.toISOString(),
          boatInfo: boat ? `${boat.year} ${boat.make} ${boat.model}` : 'Unknown Boat',
          notes: launch.notes || undefined
        };
        
        // Notify customer
        await notificationService.notifyCustomer(notificationData);
        
        // Notify marina staff
        await notificationService.notifyStaff({
          ...notificationData,
          priority: 'normal' as const,
          staffEmails: ['dock@marina.com', 'operations@marina.com']
        });
        
      } catch (notificationError) {
        console.warn('Failed to send notifications:', notificationError);
        // Don't fail the launch creation if notifications fail
      }
      
      return res.status(201).location(`/api/launches/${launch.id}`).json(launch);
    } catch (error) {
      // Handle atomic conflict errors
      if (error instanceof Error && error.message.startsWith('SCHEDULING_CONFLICT:')) {
        return res.status(409).json({
          message: "Scheduling conflict",
          error: error.message.replace('SCHEDULING_CONFLICT: ', '')
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/launches/:id", async (req, res) => {
    try {
      const validatedData = insertLaunchSchema.partial().parse(req.body);
      const launch = await storage.updateLaunchWithConflictCheck(req.params.id, validatedData);
      if (!launch) {
        return res.status(404).json({ message: "Launch not found" });
      }
      res.json(launch);
    } catch (error) {
      // Handle atomic conflict errors
      if (error instanceof Error && error.message.startsWith('SCHEDULING_CONFLICT:')) {
        return res.status(409).json({
          message: "Scheduling conflict",
          error: error.message.replace('SCHEDULING_CONFLICT: ', '')
        });
      }
      res.status(400).json({ message: "Invalid launch data" });
    }
  });

  // SpeedyDock-style check-in endpoint
  app.post("/api/launches/:id/checkin", requireCustomerAuth, async (req, res) => {
    try {
      const launchId = req.params.id;
      
      // Validate request body using Zod
      const validationResult = checkInSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid check-in data", 
          errors: validationResult.error.issues 
        });
      }
      
      const { customerLocation, timestamp } = validationResult.data;

      // Get the current launch to validate
      const launch = await storage.getLaunch(launchId);
      if (!launch) {
        return res.status(404).json({ message: "Launch not found" });
      }
      
      // Authorization: Ensure customer can only check in their own launches
      // In production, verify launch belongs to authenticated customer
      if (process.env.NODE_ENV !== 'development' && launch.customerId !== req.session.userId) {
        return res.status(403).json({ message: "You can only check in your own launches" });
      }

      // Check if launch is in correct status for check-in
      if (launch.status !== 'scheduled') {
        return res.status(400).json({ 
          message: `Cannot check in for launch with status: ${launch.status}` 
        });
      }

      // Use atomic transaction to prevent race conditions in queue assignment
      const updatedLaunch = await storage.checkInLaunch(launchId, {
        customerLocation,
        timestamp: timestamp || Date.now()
      });
      
      // TODO: Send real-time notification to marina staff
      // TODO: Send confirmation SMS/email to customer
      
      res.json({
        ...updatedLaunch,
        message: "Successfully checked in! You've been added to the launch queue."
      });
    } catch (error) {
      console.error('Check-in error:', error);
      res.status(500).json({ message: "Failed to process check-in" });
    }
  });

  // Get current launch queue (SpeedyDock-style)
  app.get("/api/launches/queue", requireStaffAuth, async (_req, res) => {
    try {
      const queue = await storage.getLaunchQueue();
      res.json(queue);
    } catch (error) {
      console.error('Launch queue error:', error);
      res.status(500).json({ 
        message: "Failed to fetch launch queue",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Customer-specific launches endpoint
  app.get("/api/customers/:customerId/launches", requireCustomerAuth, async (req, res) => {
    try {
      const { customerId } = req.params;
      const { status } = req.query;
      
      // Authorization: customers can only access their own launches
      if (process.env.NODE_ENV !== 'development' && customerId !== req.session.userId) {
        return res.status(403).json({ message: "You can only access your own launches" });
      }
      
      const launches = await storage.getLaunchesByCustomer(customerId, status as string);
      res.json(launches);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch customer launches" });
    }
  });

  // Update queue position (staff endpoint)
  app.put("/api/launches/:id/queue-status", requireStaffAuth, async (req, res) => {
    try {
      const launchId = req.params.id;
      
      // Validate request body using Zod
      const validationResult = queueStatusSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid queue status data", 
          errors: validationResult.error.issues 
        });
      }
      
      const { status, staffAssigned, priorityLevel } = validationResult.data;

      const updateData: any = {
        status,
        lastStatusUpdate: new Date(),
      };

      if (staffAssigned) updateData.staffAssigned = staffAssigned;
      if (priorityLevel) updateData.priorityLevel = priorityLevel;

      // If moving to in_progress, set actual launch time
      if (status === 'in_progress') {
        updateData.actualLaunchTime = new Date();
      }
      
      // If launching, clear queue position
      if (status === 'launched') {
        updateData.queuePosition = null;
        updateData.estimatedWaitTime = null;
      }

      const updatedLaunch = await storage.updateLaunch(launchId, updateData);
      
      if (!updatedLaunch) {
        return res.status(404).json({ message: "Launch not found" });
      }

      // TODO: Update queue positions for remaining boats
      // TODO: Send status update notification to customer
      
      res.json(updatedLaunch);
    } catch (error) {
      console.error('Queue status update error:', error);
      res.status(500).json({ message: "Failed to update queue status" });
    }
  });

  // Transient Reservations
  app.get("/api/reservations", async (_req, res) => {
    try {
      const reservations = await storage.getReservations();
      res.json(reservations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reservations" });
    }
  });

  app.get("/api/reservations/:id", async (req, res) => {
    try {
      const reservation = await storage.getReservation(req.params.id);
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      res.json(reservation);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reservation" });
    }
  });

  // Search available slips for booking
  app.post("/api/reservations/search-availability", async (req, res) => {
    try {
      const { marinaId, checkInDate, checkOutDate, boatLength, boatBeam } = req.body;
      
      if (!marinaId || !checkInDate || !checkOutDate || !boatLength || !boatBeam) {
        return res.status(400).json({ 
          message: "Missing required fields: marinaId, checkInDate, checkOutDate, boatLength, boatBeam" 
        });
      }

      const availableSlips = await storage.findAvailableSlips(
        marinaId,
        new Date(checkInDate),
        new Date(checkOutDate),
        parseFloat(boatLength),
        parseFloat(boatBeam)
      );

      res.json(availableSlips);
    } catch (error) {
      console.error("Availability search error:", error);
      res.status(500).json({ message: "Failed to search availability" });
    }
  });

  // Create new reservation
  app.post("/api/reservations", async (req, res) => {
    try {
      const normalizedBody = normalizeKeys(req.body);
      const result = insertReservationSchema.safeParse(normalizedBody);
      
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid reservation data", 
          errors: result.error.issues 
        });
      }

      // Validate slip is assigned
      if (!result.data.slipId) {
        return res.status(400).json({ 
          message: "Slip must be assigned for reservation",
          error: "SLIP_REQUIRED"
        });
      }

      // Get pricing rule to validate booking rules before transaction
      const pricingRule = await storage.getActivePricingRule(
        result.data.marinaId,
        result.data.checkInDate
      );

      // Validate booking rules if pricing rule exists
      if (pricingRule) {
        const bookingRules = pricingRule.bookingRules as any;
        
        if (bookingRules) {
          // Check minimum nights
          if (bookingRules.minNights && result.data.numberOfNights < bookingRules.minNights) {
            return res.status(400).json({ 
              message: `Minimum stay is ${bookingRules.minNights} nights`,
              error: "MIN_NIGHTS_NOT_MET"
            });
          }

          // Check maximum nights
          if (bookingRules.maxNights && result.data.numberOfNights > bookingRules.maxNights) {
            return res.status(400).json({ 
              message: `Maximum stay is ${bookingRules.maxNights} nights`,
              error: "MAX_NIGHTS_EXCEEDED"
            });
          }

          // Check advance booking window
          if (bookingRules.advanceNoticeDays) {
            const daysDiff = Math.floor((result.data.checkInDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            if (daysDiff < bookingRules.advanceNoticeDays) {
              return res.status(400).json({ 
                message: `Reservations must be made at least ${bookingRules.advanceNoticeDays} days in advance`,
                error: "ADVANCE_NOTICE_REQUIRED"
              });
            }
          }

          // Check maximum advance booking window
          if (bookingRules.maxAdvanceBookingDays) {
            const daysDiff = Math.floor((result.data.checkInDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            if (daysDiff > bookingRules.maxAdvanceBookingDays) {
              return res.status(400).json({ 
                message: `Reservations cannot be made more than ${bookingRules.maxAdvanceBookingDays} days in advance`,
                error: "MAX_ADVANCE_EXCEEDED"
              });
            }
          }
        }
      }

      // Create reservation (pricing calculation, availability check, and confirmation code generation happen atomically in transaction)
      const reservation = await storage.createReservation(result.data as InsertReservation & { slipId: string });

      // TODO: Send confirmation email to customer
      // TODO: Send notification to marina staff

      res.status(201).json(reservation);
    } catch (error: any) {
      console.error("Reservation creation error:", error);
      if (error.message === "SLIP_UNAVAILABLE") {
        return res.status(409).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to create reservation" });
    }
  });

  // Update reservation
  app.put("/api/reservations/:id", async (req, res) => {
    try {
      const normalizedBody = normalizeKeys(req.body);
      const result = insertReservationSchema.partial().safeParse(normalizedBody);
      
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid reservation data", 
          errors: result.error.issues 
        });
      }

      // Update reservation (availability check and pricing recalculation happen atomically in transaction)
      const reservation = await storage.updateReservation(req.params.id, result.data);
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
      res.json(reservation);
    } catch (error: any) {
      console.error("Reservation update error:", error);
      if (error.message === "SLIP_UNAVAILABLE") {
        return res.status(409).json({ 
          message: "Selected slip is not available for the requested dates",
          error: "SLIP_UNAVAILABLE"
        });
      }
      res.status(400).json({ message: "Failed to update reservation" });
    }
  });

  // Cancel reservation
  app.delete("/api/reservations/:id", async (req, res) => {
    try {
      const reservation = await storage.cancelReservation(req.params.id);
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
      // TODO: Send cancellation email to customer
      // TODO: Process refund if applicable
      
      res.json(reservation);
    } catch (error) {
      console.error("Reservation cancellation error:", error);
      res.status(500).json({ message: "Failed to cancel reservation" });
    }
  });

  // Get customer's reservations
  app.get("/api/customers/:customerId/reservations", requireCustomerAuth, async (req, res) => {
    try {
      const { customerId } = req.params;
      
      // Authorization: customers can only access their own reservations
      if (process.env.NODE_ENV !== 'development' && customerId !== req.session.userId) {
        return res.status(403).json({ message: "You can only access your own reservations" });
      }
      
      const reservations = await storage.getReservationsByCustomer(customerId);
      res.json(reservations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch customer reservations" });
    }
  });

  // Pricing Rules
  app.get("/api/pricing-rules", async (_req, res) => {
    try {
      const rules = await storage.getPricingRules();
      res.json(rules);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pricing rules" });
    }
  });

  app.get("/api/pricing-rules/:id", async (req, res) => {
    try {
      const rule = await storage.getPricingRule(req.params.id);
      if (!rule) {
        return res.status(404).json({ message: "Pricing rule not found" });
      }
      res.json(rule);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pricing rule" });
    }
  });

  app.post("/api/pricing-rules", async (req, res) => {
    try {
      const validatedData = insertPricingRuleSchema.parse(req.body);
      const rule = await storage.createPricingRule(validatedData);
      res.status(201).json(rule);
    } catch (error) {
      console.error("Pricing rule creation error:", error);
      res.status(400).json({ message: "Invalid pricing rule data" });
    }
  });

  app.patch("/api/pricing-rules/:id", async (req, res) => {
    try {
      const validatedData = insertPricingRuleSchema.partial().parse(req.body);
      const rule = await storage.updatePricingRule(req.params.id, validatedData);
      if (!rule) {
        return res.status(404).json({ message: "Pricing rule not found" });
      }
      res.json(rule);
    } catch (error) {
      console.error("Pricing rule update error:", error);
      res.status(400).json({ message: "Failed to update pricing rule" });
    }
  });

  app.delete("/api/pricing-rules/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePricingRule(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Pricing rule not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Pricing rule deletion error:", error);
      res.status(500).json({ message: "Failed to delete pricing rule" });
    }
  });

  // Slip Pricing
  app.get("/api/slip-pricing", async (_req, res) => {
    try {
      const pricing = await storage.getAllSlipPricing();
      res.json(pricing);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch slip pricing" });
    }
  });

  app.get("/api/slip-pricing/:slipId", async (req, res) => {
    try {
      const pricing = await storage.getSlipPricing(req.params.slipId);
      if (!pricing) {
        return res.status(404).json({ message: "Slip pricing not found" });
      }
      res.json(pricing);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch slip pricing" });
    }
  });

  app.post("/api/slip-pricing", async (req, res) => {
    try {
      const validatedData = insertSlipPricingSchema.parse(req.body);
      const pricing = await storage.createSlipPricing(validatedData);
      res.status(201).json(pricing);
    } catch (error) {
      console.error("Slip pricing creation error:", error);
      res.status(400).json({ message: "Invalid slip pricing data" });
    }
  });

  app.patch("/api/slip-pricing/:id", async (req, res) => {
    try {
      const validatedData = insertSlipPricingSchema.partial().parse(req.body);
      const pricing = await storage.updateSlipPricing(req.params.id, validatedData);
      if (!pricing) {
        return res.status(404).json({ message: "Slip pricing not found" });
      }
      res.json(pricing);
    } catch (error) {
      console.error("Slip pricing update error:", error);
      res.status(400).json({ message: "Failed to update slip pricing" });
    }
  });

  // Payments
  app.get("/api/payments", async (_req, res) => {
    try {
      const payments = await storage.getPayments();
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.get("/api/payments/overdue", async (_req, res) => {
    try {
      const payments = await storage.getOverduePayments();
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch overdue payments" });
    }
  });

  app.post("/api/payments", async (req, res) => {
    try {
      const validatedData = insertPaymentSchema.parse(req.body);
      const payment = await storage.createPayment(validatedData);
      res.status(201).json(payment);
    } catch (error) {
      res.status(400).json({ message: "Invalid payment data" });
    }
  });

  app.put("/api/payments/:id", async (req, res) => {
    try {
      const validatedData = insertPaymentSchema.partial().parse(req.body);
      const payment = await storage.updatePayment(req.params.id, validatedData);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(payment);
    } catch (error) {
      res.status(400).json({ message: "Invalid payment data" });
    }
  });

  // Integrations
  app.get("/api/integrations", async (_req, res) => {
    try {
      const integrations = await storage.getIntegrations();
      res.json(integrations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch integrations" });
    }
  });

  app.post("/api/integrations", async (req, res) => {
    try {
      const validatedData = insertIntegrationSchema.parse(req.body);
      const integration = await storage.createIntegration(validatedData);
      res.status(201).json(integration);
    } catch (error) {
      res.status(400).json({ message: "Invalid integration data" });
    }
  });

  app.put("/api/integrations/:id", async (req, res) => {
    try {
      const validatedData = insertIntegrationSchema.partial().parse(req.body);
      const integration = await storage.updateIntegration(req.params.id, validatedData);
      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      }
      res.json(integration);
    } catch (error) {
      res.status(400).json({ message: "Invalid integration data" });
    }
  });

  // Communications
  app.get("/api/communications", async (_req, res) => {
    try {
      const communications = await storage.getCommunications();
      res.json(communications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch communications" });
    }
  });

  app.post("/api/communications", async (req, res) => {
    try {
      const validatedData = insertCommunicationSchema.parse(req.body);
      const communication = await storage.createCommunication(validatedData);
      res.status(201).json(communication);
    } catch (error) {
      res.status(400).json({ message: "Invalid communication data" });
    }
  });

  // Configure multer for file uploads
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const upload = multer({
    dest: uploadsDir,
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB limit
      files: 1 // Only allow one file per request
    },
    fileFilter: (req, file, cb) => {
      // Validate file extension (more secure than MIME type alone)
      const allowedExtensions = ['.xlsx', '.xls', '.csv'];
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv', // .csv
        'application/csv',
        'text/plain', // CSV files sometimes have text/plain MIME type
        'application/octet-stream' // CSV files can have this MIME type when detected generically
      ];
      
      console.log(`File upload attempt: ${file.originalname}, MIME: ${file.mimetype}, Extension: ${fileExtension}`);
      
      if (allowedExtensions.includes(fileExtension)) {
        // Allow based on extension if it's in the allowlist
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type. Only Excel (.xlsx, .xls) and CSV (.csv) files are allowed. Received: ${fileExtension} with MIME type: ${file.mimetype}`));
      }
    }
  });

  // Import Jobs
  app.get("/api/imports", async (_req, res) => {
    try {
      const importJobs = await storage.getRecentImportJobs(50);
      res.json(importJobs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch import jobs" });
    }
  });

  app.get("/api/imports/:id", async (req, res) => {
    try {
      const importJob = await storage.getImportJob(req.params.id);
      if (!importJob) {
        return res.status(404).json({ message: "Import job not found" });
      }
      res.json(importJob);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch import job" });
    }
  });

  app.get("/api/imports/:id/errors", async (req, res) => {
    try {
      const errors = await storage.getImportErrorsByJob(req.params.id);
      res.json(errors);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch import errors" });
    }
  });

  app.post("/api/imports/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Enhanced file validation
      const fileValidation = ImportValidator.validateImportFile(req.file.originalname, req.file.size);
      if (!fileValidation.success) {
        // Clean up uploaded file
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error('Failed to cleanup invalid file:', cleanupError);
        }
        return res.status(400).json({ 
          message: "File validation failed", 
          errors: fileValidation.errors 
        });
      }
      
      // Additional security: verify file content matches extension
      try {
        const fileBuffer = fs.readFileSync(req.file.path, { encoding: null });
        const isValidFile = validateFileSignature(fileBuffer, path.extname(req.file.originalname));
        if (!isValidFile) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({
            message: "File content does not match expected format",
            errors: ["Invalid file signature"]
          });
        }
      } catch (securityError) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          message: "File security validation failed",
          errors: ["Could not verify file integrity"]
        });
      }

      try {
        // Parse file to get headers (pass original filename for extension detection)
        console.log('UPLOAD ROUTE: About to parse file with:', {
          filePath: req.file.path,
          originalname: req.file.originalname,
          fileExists: fs.existsSync(req.file.path)
        });
        const parsedData = await FileParser.parseFile(req.file.path, {}, req.file.originalname);
        
        // Generate column mapping suggestions
        const mappingSuggestions = DataMapper.generateMappingSuggestions(parsedData.headers);

        // Create import job - store the actual file path for later processing
        const importJob = await storage.createImportJob({
          source: 'file',
          fileName: req.file.originalname,
          fileSize: req.file.size,
          totalRows: parsedData.totalRows,
          createdBy: req.session?.userId || 'anonymous',
          config: {
            columnMappings: {},
            duplicateHandling: 'skip',
            validationRules: {},
            uploadPath: req.file.path, // Store the upload path for processing
            internalFilePath: req.file.path, // Store the actual multer file path (backward compatibility)
            originalFilename: req.file.originalname // Store original filename for parsing
          }
        });

        res.status(201).json({
          job: importJob,
          preview: {
            headers: parsedData.headers,
            rows: parsedData.rows.slice(0, 5), // First 5 rows for preview
            totalRows: parsedData.totalRows
          },
          mappingSuggestions,
          validation: fileValidation
        });

      } catch (parseError) {
        console.error('Parse error details:', parseError);
        // Clean up uploaded file
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error('Failed to cleanup file after parse error:', cleanupError);
        }
        
        res.status(400).json({ 
          message: "Failed to parse file", 
          error: parseError.message || parseError.toString() || 'Unknown parsing error'
        });
      }

    } catch (error) {
      // Clean up uploaded file if it exists
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ message: "Upload failed" });
    }
  });

  app.post("/api/imports/:id/start", async (req, res) => {
    try {
      // Validate request body with Zod
      const validationResult = importStartSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: validationResult.error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
      }
      
      const { mappings, duplicateStrategy, validateOnly } = validationResult.data;

      // Get import job
      const importJob = await storage.getImportJob(req.params.id);
      if (!importJob) {
        return res.status(404).json({ message: "Import job not found" });
      }

      if (importJob.status !== 'queued') {
        return res.status(400).json({ message: "Import job is not in queued status" });
      }

      // Validate mappings
      for (const [entity, entityMappings] of Object.entries(mappings)) {
        const validation = ImportValidator.validateColumnMapping(entityMappings as any[], entity);
        if (!validation.success) {
          return res.status(400).json({ 
            message: `Invalid mappings for ${entity}`, 
            errors: validation.errors 
          });
        }
      }

      // Update job config
      await storage.updateImportJob(importJob.id, {
        config: {
          ...importJob.config,
          columnMappings: mappings,
          duplicateHandling: duplicateStrategy,
          validateOnly
        }
      });

      // Start processing asynchronously
      setImmediate(async () => {
        try {
          // Get the actual file path from the stored config
          const filePath = importJob.config?.uploadPath || importJob.config?.internalFilePath;
          if (!filePath || !fs.existsSync(filePath)) {
            await storage.updateImportJob(importJob.id, { status: 'failed' });
            throw new Error('Upload file not found or expired');
          }
          
          // Re-parse the file with full data
          const originalFilename = importJob.config?.originalFilename;
          console.log('Processing import with:', { filePath, originalFilename, jobId: importJob.id });
          const parsedData = await FileParser.parseFile(filePath, {}, originalFilename);
          
          // Process the import
          const processor = new ImportProcessor(importJob.id, {
            duplicateStrategy,
            validateOnly,
            dryRun: validateOnly
          });
          
          await processor.processData(parsedData.rows, mappings);

          // Clean up file after processing
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (cleanupError) {
              console.error('Failed to cleanup file:', cleanupError);
            }
          }

        } catch (processingError) {
          console.error('Import processing failed:', processingError);
          await storage.updateImportJob(importJob.id, {
            status: 'failed'
          });
          
          // Cleanup file on failure
          const filePath = importJob.config?.uploadPath || importJob.config?.internalFilePath;
          if (filePath && fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (cleanupError) {
              console.error('Failed to cleanup file after processing error:', cleanupError);
            }
          }
        }
      });

      res.json({ 
        message: "Import started", 
        jobId: importJob.id 
      });

    } catch (error) {
      res.status(500).json({ message: "Failed to start import" });
    }
  });

  app.delete("/api/imports/:id", async (req, res) => {
    try {
      const importJob = await storage.getImportJob(req.params.id);
      if (!importJob) {
        return res.status(404).json({ message: "Import job not found" });
      }

      // Only allow deletion of completed or failed jobs
      if (importJob.status === 'running') {
        return res.status(400).json({ message: "Cannot delete running import job" });
      }

      // Clean up associated file if it exists
      const filePath = importJob.config?.uploadPath || importJob.config?.internalFilePath;
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up file for deleted import job: ${filePath}`);
        } catch (cleanupError) {
          console.error('Failed to cleanup file during job deletion:', cleanupError);
          // Don't fail the deletion if file cleanup fails
        }
      }

      // Clear errors
      await storage.clearImportErrors(req.params.id);

      // Note: In a real implementation, you might want to soft delete
      // For now, we'll just clear the errors as the job table doesn't have a delete method
      
      res.json({ message: "Import job deleted", fileCleanedUp: !!filePath });
    } catch (error) {
      console.error('Failed to delete import job:', error);
      res.status(500).json({ message: "Failed to delete import job" });
    }
  });

  // Marina Layout Routes
  app.get("/api/marina/layouts", async (req, res) => {
    try {
      const layouts = await storage.getMarinaLayouts();
      res.json(layouts);
    } catch (error) {
      console.error('Failed to fetch marina layouts:', error);
      res.status(500).json({ message: "Failed to fetch marina layouts" });
    }
  });

  app.get("/api/marina/layouts/:id", async (req, res) => {
    try {
      const layout = await storage.getMarinaLayoutById(req.params.id);
      if (!layout) {
        return res.status(404).json({ message: "Layout not found" });
      }
      res.json(layout);
    } catch (error) {
      console.error('Failed to fetch marina layout:', error);
      res.status(500).json({ message: "Failed to fetch marina layout" });
    }
  });

  app.post("/api/marina/layouts", async (req, res) => {
    try {
      const validatedData = insertMarinaLayoutSchema.parse(req.body);
      const layout = await storage.createMarinaLayout(validatedData);
      res.status(201).json(layout);
    } catch (error) {
      console.error('Failed to create marina layout:', error);
      res.status(500).json({ message: "Failed to create marina layout" });
    }
  });

  app.put("/api/marina/layouts/:id", async (req, res) => {
    try {
      const validatedData = insertMarinaLayoutSchema.partial().parse(req.body);
      const layout = await storage.updateMarinaLayout(req.params.id, validatedData);
      res.json(layout);
    } catch (error) {
      console.error('Failed to update marina layout:', error);
      res.status(500).json({ message: "Failed to update marina layout" });
    }
  });

  app.delete("/api/marina/layouts/:id", async (req, res) => {
    try {
      await storage.deleteMarinaLayout(req.params.id);
      res.json({ message: "Layout deleted successfully" });
    } catch (error) {
      console.error('Failed to delete marina layout:', error);
      res.status(500).json({ message: "Failed to delete marina layout" });
    }
  });

  app.put("/api/marina/layouts/:id/activate", async (req, res) => {
    try {
      await storage.setActiveLayout(req.params.id);
      res.json({ message: "Layout activated successfully" });
    } catch (error) {
      console.error('Failed to activate marina layout:', error);
      res.status(500).json({ message: "Failed to activate marina layout" });
    }
  });

  // Messaging Routes - Message Threads
  app.get("/api/messages/threads", async (req, res) => {
    try {
      const marinaId = req.query.marinaId as string | undefined;
      const threads = await storage.getMessageThreads(marinaId);
      res.json(threads);
    } catch (error) {
      console.error('Failed to fetch message threads:', error);
      res.status(500).json({ message: "Failed to fetch message threads" });
    }
  });

  app.get("/api/messages/threads/customer/:customerId", async (req, res) => {
    try {
      const threads = await storage.getMessageThreadsByCustomer(req.params.customerId);
      res.json(threads);
    } catch (error) {
      console.error('Failed to fetch customer message threads:', error);
      res.status(500).json({ message: "Failed to fetch customer message threads" });
    }
  });

  app.get("/api/messages/threads/:id", async (req, res) => {
    try {
      const thread = await storage.getMessageThread(req.params.id);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }
      res.json(thread);
    } catch (error) {
      console.error('Failed to fetch message thread:', error);
      res.status(500).json({ message: "Failed to fetch message thread" });
    }
  });

  app.post("/api/messages/threads", async (req, res) => {
    try {
      const validated = insertMessageThreadSchema.parse(req.body);
      const thread = await storage.createMessageThread(validated);
      
      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.notifyThreadUpdate(thread.id, thread, [thread.customerId, thread.assignedToId].filter(Boolean) as string[]);
      }
      
      res.json(thread);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid thread data", errors: error.errors });
      }
      console.error('Failed to create message thread:', error);
      res.status(500).json({ message: "Failed to create message thread" });
    }
  });

  app.patch("/api/messages/threads/:id", async (req, res) => {
    try {
      const updateSchema = z.object({
        subject: z.string().optional(),
        status: z.enum(['active', 'resolved', 'closed']).optional(),
        priority: z.enum(['low', 'normal', 'high']).optional(),
        assignedToId: z.string().optional(),
      });
      
      const validated = updateSchema.parse(req.body);
      const thread = await storage.updateMessageThread(req.params.id, validated);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }
      
      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.notifyThreadUpdate(thread.id, thread, [thread.customerId, thread.assignedToId].filter(Boolean) as string[]);
      }
      
      res.json(thread);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid update data", errors: error.errors });
      }
      console.error('Failed to update message thread:', error);
      res.status(500).json({ message: "Failed to update message thread" });
    }
  });

  // Messaging Routes - Messages
  app.get("/api/messages/threads/:threadId/messages", async (req, res) => {
    try {
      const messages = await storage.getMessages(req.params.threadId);
      res.json(messages);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages/threads/:threadId/messages", async (req, res) => {
    try {
      const validated = insertMessageSchema.parse({
        ...req.body,
        threadId: req.params.threadId
      });
      const message = await storage.createMessage(validated);
      
      const thread = await storage.getMessageThread(req.params.threadId);
      if (thread) {
        const wsServer = getWebSocketServer();
        if (wsServer) {
          const recipientUserIds = [thread.customerId, thread.assignedToId].filter(Boolean) as string[];
          wsServer.notifyNewMessage(req.params.threadId, message, recipientUserIds);
        }
        
        await notificationService.sendMessageNotification(thread, message);
      }
      
      res.json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      console.error('Failed to create message:', error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  app.patch("/api/messages/:messageId/read", async (req, res) => {
    try {
      const message = await storage.markMessageAsRead(req.params.messageId);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.notifyReadReceipt(message.threadId, message.id, message.senderId);
      }
      
      res.json(message);
    } catch (error) {
      console.error('Failed to mark message as read:', error);
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });

  app.post("/api/messages/threads/:threadId/mark-read", async (req, res) => {
    try {
      const bodySchema = z.object({
        userId: z.string(),
      });
      
      const { userId } = bodySchema.parse(req.body);
      await storage.markThreadAsRead(req.params.threadId, userId);
      res.json({ message: "Thread marked as read" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      console.error('Failed to mark thread as read:', error);
      res.status(500).json({ message: "Failed to mark thread as read" });
    }
  });

  app.get("/api/messages/unread-count", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const userType = req.query.userType as string;
      
      if (!userId || !userType) {
        return res.status(400).json({ message: "userId and userType are required" });
      }
      
      const count = await storage.getUnreadMessageCount(userId, userType);
      res.json({ count });
    } catch (error) {
      console.error('Failed to fetch unread message count:', error);
      res.status(500).json({ message: "Failed to fetch unread message count" });
    }
  });

  // ============ STRIPE PAYMENT ROUTES ============
  
  // Get Stripe publishable key for client
  app.get("/api/stripe/config", async (_req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error('Failed to get Stripe config:', error);
      res.status(500).json({ message: "Stripe not configured" });
    }
  });

  // List available products and prices (for marina services)
  app.get("/api/stripe/products", async (_req, res) => {
    try {
      const rows = await stripeService.listProductsWithPrices();
      
      // Group prices by product
      const productsMap = new Map();
      for (const row of rows as any[]) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            active: row.product_active,
            metadata: row.product_metadata,
            prices: []
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id).prices.push({
            id: row.price_id,
            unitAmount: row.unit_amount,
            currency: row.currency,
            recurring: row.recurring,
            active: row.price_active,
            metadata: row.price_metadata,
          });
        }
      }

      res.json({ data: Array.from(productsMap.values()) });
    } catch (error) {
      console.error('Failed to list products:', error);
      res.status(500).json({ message: "Failed to list products" });
    }
  });

  // Create checkout session for subscription (slip rental, membership)
  app.post("/api/stripe/checkout", async (req, res) => {
    try {
      const { customerId, priceId, metadata } = req.body;
      
      if (!customerId || !priceId) {
        return res.status(400).json({ message: "customerId and priceId are required" });
      }

      // Get customer and ensure they have a Stripe customer ID
      const customer = await storage.getCustomer(customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      let stripeCustomerId = customer.stripeCustomerId;
      if (!stripeCustomerId) {
        // Create Stripe customer
        const stripeCustomer = await stripeService.createCustomer(
          customer.email,
          `${customer.firstName} ${customer.lastName}`,
          customer.id
        );
        stripeCustomerId = stripeCustomer.id;
        await storage.updateCustomerStripeInfo(customer.id, stripeCustomerId);
      }

      // Create checkout session
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripeService.createCheckoutSession(
        stripeCustomerId,
        priceId,
        `${baseUrl}/payment/success`,
        `${baseUrl}/payment/cancel`,
        metadata
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  // Create one-time payment session (launch fee, services, etc.)
  app.post("/api/stripe/payment", async (req, res) => {
    try {
      const { customerId, amount, description, metadata } = req.body;
      
      if (!customerId || !amount || !description) {
        return res.status(400).json({ 
          message: "customerId, amount, and description are required" 
        });
      }

      const customer = await storage.getCustomer(customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      let stripeCustomerId = customer.stripeCustomerId;
      if (!stripeCustomerId) {
        const stripeCustomer = await stripeService.createCustomer(
          customer.email,
          `${customer.firstName} ${customer.lastName}`,
          customer.id
        );
        stripeCustomerId = stripeCustomer.id;
        await storage.updateCustomerStripeInfo(customer.id, stripeCustomerId);
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripeService.createOneTimePaymentSession(
        stripeCustomerId,
        Math.round(amount * 100), // Convert to cents
        description,
        `${baseUrl}/payment/success`,
        `${baseUrl}/payment/cancel`,
        metadata
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error('Failed to create payment session:', error);
      res.status(500).json({ message: "Failed to create payment session" });
    }
  });

  // Create customer portal session for managing subscriptions
  app.post("/api/stripe/portal", async (req, res) => {
    try {
      const { customerId } = req.body;
      
      if (!customerId) {
        return res.status(400).json({ message: "customerId is required" });
      }

      const customer = await storage.getCustomer(customerId);
      if (!customer?.stripeCustomerId) {
        return res.status(400).json({ message: "Customer has no Stripe account" });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripeService.createCustomerPortalSession(
        customer.stripeCustomerId,
        `${baseUrl}/customer/billing`
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error('Failed to create portal session:', error);
      res.status(500).json({ message: "Failed to create portal session" });
    }
  });

  // Set up autopay for a customer
  app.post("/api/stripe/setup-autopay", async (req, res) => {
    try {
      const { customerId } = req.body;
      
      if (!customerId) {
        return res.status(400).json({ message: "customerId is required" });
      }

      const customer = await storage.getCustomer(customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      let stripeCustomerId = customer.stripeCustomerId;
      if (!stripeCustomerId) {
        const stripeCustomer = await stripeService.createCustomer(
          customer.email,
          `${customer.firstName} ${customer.lastName}`,
          customer.id
        );
        stripeCustomerId = stripeCustomer.id;
        await storage.updateCustomerStripeInfo(customer.id, stripeCustomerId);
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripeService.setupAutopay(
        stripeCustomerId,
        `${baseUrl}/customer/billing`
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error('Failed to setup autopay:', error);
      res.status(500).json({ message: "Failed to setup autopay" });
    }
  });

  // Get customer's payment history
  app.get("/api/stripe/customers/:customerId/payments", async (req, res) => {
    try {
      const { customerId } = req.params;
      
      const customer = await storage.getCustomer(customerId);
      if (!customer?.stripeCustomerId) {
        return res.json({ payments: [], subscriptions: [] });
      }

      const [payments, subscriptions] = await Promise.all([
        stripeService.getCustomerPaymentIntents(customer.stripeCustomerId),
        stripeService.getCustomerSubscriptions(customer.stripeCustomerId)
      ]);

      res.json({ payments, subscriptions });
    } catch (error) {
      console.error('Failed to get payment history:', error);
      res.status(500).json({ message: "Failed to get payment history" });
    }
  });

  // Create invoice for customer
  app.post("/api/stripe/invoice", async (req, res) => {
    try {
      const { customerId, items } = req.body;
      
      if (!customerId || !items || !Array.isArray(items)) {
        return res.status(400).json({ 
          message: "customerId and items array are required" 
        });
      }

      const customer = await storage.getCustomer(customerId);
      if (!customer?.stripeCustomerId) {
        return res.status(400).json({ message: "Customer has no Stripe account" });
      }

      // Convert amounts to cents
      const invoiceItems = items.map((item: any) => ({
        description: item.description,
        amount: Math.round(item.amount * 100)
      }));

      const invoice = await stripeService.createInvoice(
        customer.stripeCustomerId,
        invoiceItems
      );

      res.json({ invoice });
    } catch (error) {
      console.error('Failed to create invoice:', error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  // ============ BILLING ROUTES ============

  // Get all billing schedules (optionally filtered by marina or customer)
  app.get("/api/billing/schedules", async (req, res) => {
    try {
      const { marinaId, customerId } = req.query;
      
      if (customerId) {
        const schedules = await billingService.getBillingSchedulesByCustomer(customerId as string);
        return res.json(schedules);
      }
      
      const schedules = await billingService.getActiveBillingSchedules(marinaId as string);
      res.json(schedules);
    } catch (error) {
      console.error('Failed to get billing schedules:', error);
      res.status(500).json({ message: "Failed to get billing schedules" });
    }
  });

  // Create a new billing schedule
  app.post("/api/billing/schedules", async (req, res) => {
    try {
      const parsed = insertBillingScheduleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid billing schedule data", errors: parsed.error.errors });
      }
      
      const schedule = await billingService.createBillingSchedule(parsed.data);
      res.status(201).json(schedule);
    } catch (error) {
      console.error('Failed to create billing schedule:', error);
      res.status(500).json({ message: "Failed to create billing schedule" });
    }
  });

  // Get a specific billing schedule
  app.get("/api/billing/schedules/:id", async (req, res) => {
    try {
      const schedule = await billingService.getBillingSchedule(req.params.id);
      if (!schedule) {
        return res.status(404).json({ message: "Billing schedule not found" });
      }
      res.json(schedule);
    } catch (error) {
      console.error('Failed to get billing schedule:', error);
      res.status(500).json({ message: "Failed to get billing schedule" });
    }
  });

  // Update a billing schedule
  app.patch("/api/billing/schedules/:id", async (req, res) => {
    try {
      // Partial validation schema for updates
      const updateSchema = z.object({
        name: z.string().optional(),
        amount: z.coerce.number().positive().optional(),
        frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annually']).optional(),
        dayOfMonth: z.number().int().min(1).max(31).optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional().nullable(),
        nextBillingDate: z.coerce.date().optional(),
        status: z.enum(['active', 'paused', 'cancelled', 'completed']).optional(),
        autopayEnabled: z.boolean().optional(),
        gracePeriodDays: z.number().int().min(0).max(30).optional(),
        category: z.string().optional(),
        notes: z.string().optional(),
      });
      
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid update data", errors: parsed.error.errors });
      }
      
      const schedule = await billingService.updateBillingSchedule(req.params.id, parsed.data as any);
      if (!schedule) {
        return res.status(404).json({ message: "Billing schedule not found" });
      }
      res.json(schedule);
    } catch (error) {
      console.error('Failed to update billing schedule:', error);
      res.status(500).json({ message: "Failed to update billing schedule" });
    }
  });

  // Pause a billing schedule
  app.post("/api/billing/schedules/:id/pause", async (req, res) => {
    try {
      const schedule = await billingService.pauseBillingSchedule(req.params.id);
      if (!schedule) {
        return res.status(404).json({ message: "Billing schedule not found" });
      }
      res.json(schedule);
    } catch (error) {
      console.error('Failed to pause billing schedule:', error);
      res.status(500).json({ message: "Failed to pause billing schedule" });
    }
  });

  // Resume a billing schedule
  app.post("/api/billing/schedules/:id/resume", async (req, res) => {
    try {
      const schedule = await billingService.resumeBillingSchedule(req.params.id);
      if (!schedule) {
        return res.status(404).json({ message: "Billing schedule not found" });
      }
      res.json(schedule);
    } catch (error) {
      console.error('Failed to resume billing schedule:', error);
      res.status(500).json({ message: "Failed to resume billing schedule" });
    }
  });

  // Cancel a billing schedule
  app.post("/api/billing/schedules/:id/cancel", async (req, res) => {
    try {
      const schedule = await billingService.cancelBillingSchedule(req.params.id);
      if (!schedule) {
        return res.status(404).json({ message: "Billing schedule not found" });
      }
      res.json(schedule);
    } catch (error) {
      console.error('Failed to cancel billing schedule:', error);
      res.status(500).json({ message: "Failed to cancel billing schedule" });
    }
  });

  // Enable autopay for a customer's billing schedule
  app.post("/api/billing/schedules/:id/enable-autopay", async (req, res) => {
    try {
      const { customerId } = req.body;
      if (!customerId) {
        return res.status(400).json({ message: "customerId is required" });
      }
      
      const schedule = await billingService.enableAutopay(customerId, req.params.id);
      if (!schedule) {
        return res.status(404).json({ message: "Billing schedule not found" });
      }
      res.json(schedule);
    } catch (error) {
      console.error('Failed to enable autopay:', error);
      res.status(500).json({ message: "Failed to enable autopay" });
    }
  });

  // Disable autopay
  app.post("/api/billing/schedules/:id/disable-autopay", async (req, res) => {
    try {
      const { customerId } = req.body;
      if (!customerId) {
        return res.status(400).json({ message: "customerId is required" });
      }
      
      const schedule = await billingService.disableAutopay(customerId, req.params.id);
      if (!schedule) {
        return res.status(404).json({ message: "Billing schedule not found" });
      }
      res.json(schedule);
    } catch (error) {
      console.error('Failed to disable autopay:', error);
      res.status(500).json({ message: "Failed to disable autopay" });
    }
  });

  // Check customer service eligibility (for overdue blocking)
  app.get("/api/billing/customers/:customerId/eligibility", async (req, res) => {
    try {
      const eligibility = await billingService.checkServiceEligibility(req.params.customerId);
      res.json(eligibility);
    } catch (error) {
      console.error('Failed to check eligibility:', error);
      res.status(500).json({ message: "Failed to check eligibility" });
    }
  });

  // Get customer account status (overdue info)
  app.get("/api/billing/customers/:customerId/status", async (req, res) => {
    try {
      const status = await billingService.getCustomerAccountStatus(req.params.customerId);
      res.json(status);
    } catch (error) {
      console.error('Failed to get account status:', error);
      res.status(500).json({ message: "Failed to get account status" });
    }
  });

  // Get accounts receivable aging report
  app.get("/api/billing/aging-report", async (req, res) => {
    try {
      const { marinaId } = req.query;
      const report = await billingService.getAgingReport(marinaId as string);
      res.json(report);
    } catch (error) {
      console.error('Failed to get aging report:', error);
      res.status(500).json({ message: "Failed to get aging report" });
    }
  });

  // Get accounts receivable summary
  app.get("/api/billing/ar-summary", async (req, res) => {
    try {
      const { marinaId } = req.query;
      const summary = await billingService.getAccountsReceivableSummary(marinaId as string);
      res.json(summary);
    } catch (error) {
      console.error('Failed to get AR summary:', error);
      res.status(500).json({ message: "Failed to get AR summary" });
    }
  });

  // Trigger billing run (for testing or manual run)
  app.post("/api/billing/process", async (req, res) => {
    try {
      const result = await billingService.processRecurringBilling();
      res.json(result);
    } catch (error) {
      console.error('Failed to process billing:', error);
      res.status(500).json({ message: "Failed to process billing" });
    }
  });

  // Analytics endpoints
  app.get("/api/analytics/snapshots", isAuthenticated, async (req, res) => {
    try {
      const { marinaId, period, startDate, endDate } = req.query;
      const snapshots = await storage.getAnalyticsSnapshots(
        marinaId as string,
        period as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(snapshots);
    } catch (error) {
      console.error("Error fetching analytics snapshots:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  app.get("/api/analytics/marinas/:marinaId/latest", isAuthenticated, async (req, res) => {
    try {
      const snapshot = await storage.getLatestAnalyticsSnapshot(req.params.marinaId);
      if (!snapshot) {
        return res.status(404).json({ message: "No analytics found for this marina" });
      }
      res.json(snapshot);
    } catch (error) {
      console.error("Error fetching latest analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Get portfolio-wide financial metrics
  app.get("/api/analytics/portfolio/metrics", isAuthenticated, async (req, res) => {
    try {
      const marinas = await storage.getMarinas();
      const slips = await storage.getSlips();
      const payments = await storage.getPayments();
      const leases = await storage.getActiveLeases();

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      // Calculate portfolio-wide metrics
      const totalSlips = slips.length;
      const occupiedSlips = slips.filter(s => s.isOccupied).length;
      
      const monthlyRevenue = payments
        .filter(p => {
          const dateStr = p.paidDate || p.dueDate;
          if (!dateStr) return false;
          const date = new Date(dateStr);
          return date.getMonth() === currentMonth && 
                 date.getFullYear() === currentYear && 
                 p.status === 'paid';
        })
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

      const annualRevenue = payments
        .filter(p => {
          const dateStr = p.paidDate || p.dueDate;
          if (!dateStr) return false;
          const date = new Date(dateStr);
          return date.getFullYear() === currentYear && p.status === 'paid';
        })
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

      const overdueAmount = payments
        .filter(p => p.status === 'overdue' || (p.status === 'pending' && new Date(p.dueDate) < new Date()))
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

      // Calculate monthly revenue for last 12 months
      const monthlyTrend = [];
      for (let i = 11; i >= 0; i--) {
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() - i);
        const targetMonth = targetDate.getMonth();
        const targetYear = targetDate.getFullYear();
        
        const revenue = payments
          .filter(p => {
            const dateStr = p.paidDate || p.dueDate;
            if (!dateStr) return false;
            const date = new Date(dateStr);
            return date.getMonth() === targetMonth && 
                   date.getFullYear() === targetYear && 
                   p.status === 'paid';
          })
          .reduce((sum, p) => sum + parseFloat(p.amount), 0);

        monthlyTrend.push({
          month: targetDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          revenue,
        });
      }

      // Calculate occupancy trend (simulated for demo)
      const occupancyTrend = monthlyTrend.map((m, i) => ({
        month: m.month,
        occupancy: totalSlips > 0 ? Math.min(100, Math.max(60, (occupiedSlips / totalSlips) * 100 + (Math.random() * 10 - 5))) : 0,
      }));

      // Revenue per slip
      const revenuePerSlip = occupiedSlips > 0 ? monthlyRevenue / occupiedSlips : 0;

      // NOI calculation (simplified - assumes 40% operating expenses)
      const operatingExpenseRatio = 0.4;
      const estimatedExpenses = monthlyRevenue * operatingExpenseRatio;
      const netOperatingIncome = monthlyRevenue - estimatedExpenses;

      // Cap rate calculation (simplified - assumes 8x monthly NOI as property value proxy)
      const estimatedPropertyValue = netOperatingIncome * 12 * 8;
      const capRate = estimatedPropertyValue > 0 ? ((netOperatingIncome * 12) / estimatedPropertyValue) * 100 : 0;

      res.json({
        summary: {
          totalMarinas: marinas.length,
          totalSlips,
          occupiedSlips,
          occupancyRate: totalSlips > 0 ? (occupiedSlips / totalSlips) * 100 : 0,
          monthlyRevenue,
          annualRevenue,
          overdueAmount,
          revenuePerSlip,
          activeLeases: leases.length,
        },
        financials: {
          netOperatingIncome,
          operatingExpenseRatio: operatingExpenseRatio * 100,
          estimatedPropertyValue,
          capRate,
        },
        trends: {
          revenue: monthlyTrend,
          occupancy: occupancyTrend,
        },
      });
    } catch (error) {
      console.error("Error fetching portfolio metrics:", error);
      res.status(500).json({ message: "Failed to fetch portfolio metrics" });
    }
  });

  // Get marina-specific financial metrics
  app.get("/api/analytics/marinas/:marinaId/metrics", isAuthenticated, async (req, res) => {
    try {
      const { marinaId } = req.params;
      const marina = await storage.getMarina(marinaId);
      if (!marina) {
        return res.status(404).json({ message: "Marina not found" });
      }

      const slips = await storage.getSlips();
      const marinaSlips = slips.filter(s => s.marinaId === marinaId);
      const payments = await storage.getPayments();
      const marinaPayments = payments.filter(p => p.marinaId === marinaId);

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      const totalSlips = marinaSlips.length;
      const occupiedSlips = marinaSlips.filter(s => s.isOccupied).length;
      
      const monthlyRevenue = marinaPayments
        .filter(p => {
          const dateStr = p.paidDate || p.dueDate;
          if (!dateStr) return false;
          const date = new Date(dateStr);
          return date.getMonth() === currentMonth && 
                 date.getFullYear() === currentYear && 
                 p.status === 'paid';
        })
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

      const overdueAmount = marinaPayments
        .filter(p => p.status === 'overdue' || (p.status === 'pending' && new Date(p.dueDate) < new Date()))
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

      // Monthly trend for this marina
      const monthlyTrend = [];
      for (let i = 11; i >= 0; i--) {
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() - i);
        const targetMonth = targetDate.getMonth();
        const targetYear = targetDate.getFullYear();
        
        const revenue = marinaPayments
          .filter(p => {
            const dateStr = p.paidDate || p.dueDate;
            if (!dateStr) return false;
            const date = new Date(dateStr);
            return date.getMonth() === targetMonth && 
                   date.getFullYear() === targetYear && 
                   p.status === 'paid';
          })
          .reduce((sum, p) => sum + parseFloat(p.amount), 0);

        monthlyTrend.push({
          month: targetDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          revenue,
        });
      }

      res.json({
        marina,
        metrics: {
          totalSlips,
          occupiedSlips,
          occupancyRate: totalSlips > 0 ? (occupiedSlips / totalSlips) * 100 : 0,
          monthlyRevenue,
          overdueAmount,
          revenuePerSlip: occupiedSlips > 0 ? monthlyRevenue / occupiedSlips : 0,
        },
        trends: {
          revenue: monthlyTrend,
        },
      });
    } catch (error) {
      console.error("Error fetching marina metrics:", error);
      res.status(500).json({ message: "Failed to fetch marina metrics" });
    }
  });


  // API Keys Management
  app.get("/api/api-keys", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_ROLES), async (req, res) => {
    try {
      const organizationId = req.query.organizationId as string;
      if (!organizationId) {
        return res.status(400).json({ message: "Organization ID is required" });
      }
      
      const keys = await storage.getApiKeys(organizationId);
      // Never return the actual key hash, only metadata
      const safeKeys = keys.map(k => ({
        ...k,
        keyHash: undefined, // Remove hash from response
      }));
      res.json(safeKeys);
    } catch (error) {
      console.error("Error fetching API keys:", error);
      res.status(500).json({ message: "Failed to fetch API keys" });
    }
  });

  app.post("/api/api-keys", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_ROLES), async (req, res) => {
    try {
      const { name, organizationId, scopes, expiresAt } = req.body;
      
      if (!name || !organizationId || !scopes) {
        return res.status(400).json({ message: "Name, organization ID, and scopes are required" });
      }
      
      // Generate a secure API key
      const crypto = await import('crypto');
      const rawKey = `mk_live_${crypto.randomBytes(32).toString('hex')}`;
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
      const keyPrefix = rawKey.substring(0, 12);
      
      const apiKey = await storage.createApiKey({
        name,
        organizationId,
        keyHash,
        keyPrefix,
        scopes,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
      });
      
      // Log the API key creation
      await storage.createAuditLog({
        userId: (req as any).user?.id || 'system',
        action: 'create',
        entityType: 'api_key',
        entityId: apiKey.id,
        details: { name, scopes, keyPrefix },
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
        marinaId: null,
      });
      
      // Return the raw key ONLY on creation (never stored or returned again)
      res.status(201).json({
        ...apiKey,
        keyHash: undefined,
        rawKey, // Only returned once!
      });
    } catch (error) {
      console.error("Error creating API key:", error);
      res.status(500).json({ message: "Failed to create API key" });
    }
  });

  app.delete("/api/api-keys/:id", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_ROLES), async (req, res) => {
    try {
      const deleted = await storage.deleteApiKey(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "API key not found" });
      }
      
      // Log the deletion
      await storage.createAuditLog({
        userId: (req as any).user?.id || 'system',
        action: 'delete',
        entityType: 'api_key',
        entityId: req.params.id,
        details: { deleted: true },
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
        marinaId: null,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting API key:", error);
      res.status(500).json({ message: "Failed to delete API key" });
    }
  });

  app.post("/api/api-keys/:id/revoke", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_ROLES), async (req, res) => {
    try {
      const revoked = await storage.revokeApiKey(req.params.id);
      if (!revoked) {
        return res.status(404).json({ message: "API key not found" });
      }
      
      // Log the revocation
      await storage.createAuditLog({
        userId: (req as any).user?.id || 'system',
        action: 'update',
        entityType: 'api_key',
        entityId: req.params.id,
        details: { action: 'revoked' },
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
        marinaId: null,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error revoking API key:", error);
      res.status(500).json({ message: "Failed to revoke API key" });
    }
  });

  // Webhooks Management
  app.get("/api/webhooks", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_ROLES), async (req, res) => {
    try {
      const organizationId = req.query.organizationId as string;
      if (!organizationId) {
        return res.status(400).json({ message: "Organization ID is required" });
      }
      
      const webhooksData = await storage.getWebhooks(organizationId);
      // Remove secrets from response
      const safeWebhooks = webhooksData.map(w => ({
        ...w,
        secret: undefined,
      }));
      res.json(safeWebhooks);
    } catch (error) {
      console.error("Error fetching webhooks:", error);
      res.status(500).json({ message: "Failed to fetch webhooks" });
    }
  });

  app.get("/api/webhooks/:id", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_ROLES), async (req, res) => {
    try {
      const webhook = await storage.getWebhook(req.params.id);
      if (!webhook) {
        return res.status(404).json({ message: "Webhook not found" });
      }
      res.json({
        ...webhook,
        secret: undefined, // Never expose secret
      });
    } catch (error) {
      console.error("Error fetching webhook:", error);
      res.status(500).json({ message: "Failed to fetch webhook" });
    }
  });

  app.post("/api/webhooks", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_ROLES), async (req, res) => {
    try {
      const { name, url, organizationId, marinaId, events } = req.body;
      
      if (!name || !url || !organizationId || !events || events.length === 0) {
        return res.status(400).json({ message: "Name, URL, organization ID, and events are required" });
      }
      
      // Generate a secure webhook secret
      const crypto = await import('crypto');
      const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`;
      
      const webhook = await storage.createWebhook({
        name,
        url,
        organizationId,
        marinaId: marinaId || null,
        events,
        secret,
        isActive: true,
      });
      
      // Log webhook creation
      await storage.createAuditLog({
        userId: (req as any).user?.id || 'system',
        action: 'create',
        entityType: 'webhook',
        entityId: webhook.id,
        details: { name, url, events },
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
        marinaId: marinaId || null,
      });
      
      // Return the secret ONLY on creation
      res.status(201).json({
        ...webhook,
        secret, // Only returned once!
      });
    } catch (error) {
      console.error("Error creating webhook:", error);
      res.status(500).json({ message: "Failed to create webhook" });
    }
  });

  app.patch("/api/webhooks/:id", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_ROLES), async (req, res) => {
    try {
      const { name, url, events, isActive } = req.body;
      
      const webhook = await storage.updateWebhook(req.params.id, {
        ...(name && { name }),
        ...(url && { url }),
        ...(events && { events }),
        ...(isActive !== undefined && { isActive }),
      });
      
      if (!webhook) {
        return res.status(404).json({ message: "Webhook not found" });
      }
      
      res.json({
        ...webhook,
        secret: undefined,
      });
    } catch (error) {
      console.error("Error updating webhook:", error);
      res.status(500).json({ message: "Failed to update webhook" });
    }
  });

  app.delete("/api/webhooks/:id", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_ROLES), async (req, res) => {
    try {
      const deleted = await storage.deleteWebhook(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Webhook not found" });
      }
      
      // Log webhook deletion
      await storage.createAuditLog({
        userId: (req as any).user?.id || 'system',
        action: 'delete',
        entityType: 'webhook',
        entityId: req.params.id,
        details: { deleted: true },
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
        marinaId: null,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting webhook:", error);
      res.status(500).json({ message: "Failed to delete webhook" });
    }
  });

  // Webhook Deliveries
  app.get("/api/webhooks/:id/deliveries", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_ROLES), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const deliveries = await storage.getRecentDeliveries(req.params.id, limit);
      res.json(deliveries);
    } catch (error) {
      console.error("Error fetching webhook deliveries:", error);
      res.status(500).json({ message: "Failed to fetch webhook deliveries" });
    }
  });

  app.post("/api/webhooks/:id/test", isAuthenticated, requirePermission(PERMISSIONS.MANAGE_ROLES), async (req, res) => {
    try {
      const webhook = await storage.getWebhook(req.params.id);
      if (!webhook) {
        return res.status(404).json({ message: "Webhook not found" });
      }
      
      // Create a test delivery
      const testPayload = {
        id: `evt_test_${Date.now()}`,
        type: 'webhook.test',
        created: new Date().toISOString(),
        data: {
          message: 'This is a test webhook delivery',
          webhook_id: webhook.id,
        },
      };
      
      // Create delivery record
      const delivery = await storage.createWebhookDelivery({
        webhookId: webhook.id,
        eventType: 'webhook.test',
        payload: testPayload,
        status: 'pending',
        attempts: 0,
      });
      
      // Attempt to deliver the webhook
      try {
        const crypto = await import('crypto');
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(JSON.stringify(testPayload))
          .digest('hex');
        
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': 'webhook.test',
          },
          body: JSON.stringify(testPayload),
        });
        
        // Update delivery with result
        await storage.updateWebhookDelivery(delivery.id, {
          status: response.ok ? 'delivered' : 'failed',
          responseCode: response.status,
          responseBody: await response.text().catch(() => ''),
          attempts: 1,
        });
        
        if (response.ok) {
          await storage.resetWebhookFailures(webhook.id);
          await storage.updateWebhook(webhook.id, {
            lastDeliveryAt: new Date(),
            lastDeliveryStatus: 'success',
          });
        } else {
          await storage.incrementWebhookFailure(webhook.id);
          await storage.updateWebhook(webhook.id, {
            lastDeliveryAt: new Date(),
            lastDeliveryStatus: 'failed',
          });
        }
        
        res.json({
          success: response.ok,
          statusCode: response.status,
          deliveryId: delivery.id,
        });
      } catch (error: any) {
        await storage.updateWebhookDelivery(delivery.id, {
          status: 'failed',
          errorMessage: error.message,
          attempts: 1,
        });
        await storage.incrementWebhookFailure(webhook.id);
        
        res.json({
          success: false,
          error: error.message,
          deliveryId: delivery.id,
        });
      }
    } catch (error) {
      console.error("Error testing webhook:", error);
      res.status(500).json({ message: "Failed to test webhook" });
    }
  });

  const httpServer = createServer(app);
  initializeWebSocket(httpServer, sessionParser, sessionSecret);
  return httpServer;
}
