/**
 * Dockit Routes Integration
 * 
 * This file adapts the Dockit routes to work with a configurable API prefix,
 * allowing integration into the main MarinaMatch app without route collisions.
 */

import type { Express, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { 
  insertCustomerSchema, insertBoatSchema, insertSlipSchema, 
  insertLeaseSchema, insertLaunchSchema, insertPaymentSchema,
  insertIntegrationSchema, insertCommunicationSchema,
  insertImportJobSchema, insertMarinaLayoutSchema, insertReservationSchema,
  insertPricingRuleSchema, insertSlipPricingSchema,
  insertMessageThreadSchema, insertMessageSchema,
  insertOrganizationSchema, insertMarinaSchema,
  insertContractSchema, insertContractTemplateSchema,
  insertAuditLogSchema, insertBillingScheduleSchema
} from "../shared/schema";
import { z } from "zod";

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

// File upload configuration for imports
const uploadsDir = path.join(process.cwd(), 'modules', 'dockit', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  }
});

// Simple auth middleware for Dockit - checks main app session
const dockitAuth = (req: any, res: Response, next: NextFunction) => {
  // Use main app's session auth if available
  if (req.session?.userId || req.session?.user) {
    return next();
  }
  // For development, allow unauthenticated access
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  res.status(401).json({ message: "Authentication required" });
};

/**
 * Registers all Dockit routes with the specified prefix
 */
export async function registerDockitRoutes(
  app: Express,
  prefix: string,
  _sessionParser: any,
  _sessionSecret: string
): Promise<void> {
  
  // ==========================================
  // Dashboard Stats
  // ==========================================
  app.get(`${prefix}/dashboard/stats`, async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // ==========================================
  // Organizations
  // ==========================================
  app.get(`${prefix}/organizations`, dockitAuth, async (_req, res) => {
    try {
      const organizations = await storage.getOrganizations();
      res.json(organizations);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      res.status(500).json({ message: "Failed to fetch organizations" });
    }
  });

  app.get(`${prefix}/organizations/:id`, dockitAuth, async (req, res) => {
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

  app.post(`${prefix}/organizations`, dockitAuth, async (req, res) => {
    try {
      const validatedData = insertOrganizationSchema.parse(req.body);
      const organization = await storage.createOrganization(validatedData);
      res.status(201).json(organization);
    } catch (error: any) {
      console.error("Error creating organization:", error);
      res.status(400).json({ message: error.message || "Failed to create organization" });
    }
  });

  // ==========================================
  // Marinas
  // ==========================================
  app.get(`${prefix}/marinas`, async (_req, res) => {
    try {
      const marinas = await storage.getMarinas();
      res.json(marinas);
    } catch (error) {
      console.error("Error fetching marinas:", error);
      res.status(500).json({ message: "Failed to fetch marinas" });
    }
  });

  app.get(`${prefix}/marinas/:id`, async (req, res) => {
    try {
      const marina = await storage.getMarina(req.params.id);
      if (!marina) {
        return res.status(404).json({ message: "Marina not found" });
      }
      res.json(marina);
    } catch (error) {
      console.error("Error fetching marina:", error);
      res.status(500).json({ message: "Failed to fetch marina" });
    }
  });

  app.post(`${prefix}/marinas`, dockitAuth, async (req, res) => {
    try {
      const validatedData = insertMarinaSchema.parse(req.body);
      const marina = await storage.createMarina(validatedData);
      res.status(201).json(marina);
    } catch (error: any) {
      console.error("Error creating marina:", error);
      res.status(400).json({ message: error.message || "Failed to create marina" });
    }
  });

  // ==========================================
  // Customers
  // ==========================================
  app.get(`${prefix}/customers`, async (_req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.get(`${prefix}/customers/:id`, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  app.post(`${prefix}/customers`, async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error: any) {
      console.error("Error creating customer:", error);
      res.status(400).json({ message: error.message || "Failed to create customer" });
    }
  });

  app.put(`${prefix}/customers/:id`, async (req, res) => {
    try {
      const customer = await storage.updateCustomer(req.params.id, req.body);
      res.json(customer);
    } catch (error: any) {
      console.error("Error updating customer:", error);
      res.status(400).json({ message: error.message || "Failed to update customer" });
    }
  });

  // ==========================================
  // Boats
  // ==========================================
  app.get(`${prefix}/boats`, async (_req, res) => {
    try {
      const boats = await storage.getBoats();
      res.json(boats);
    } catch (error) {
      console.error("Error fetching boats:", error);
      res.status(500).json({ message: "Failed to fetch boats" });
    }
  });

  app.get(`${prefix}/customers/:customerId/boats`, async (req, res) => {
    try {
      const boats = await storage.getBoatsByCustomer(req.params.customerId);
      res.json(boats);
    } catch (error) {
      console.error("Error fetching customer boats:", error);
      res.status(500).json({ message: "Failed to fetch customer boats" });
    }
  });

  app.post(`${prefix}/boats`, async (req, res) => {
    try {
      const validatedData = insertBoatSchema.parse(req.body);
      const boat = await storage.createBoat(validatedData);
      res.status(201).json(boat);
    } catch (error: any) {
      console.error("Error creating boat:", error);
      res.status(400).json({ message: error.message || "Failed to create boat" });
    }
  });

  // ==========================================
  // Slips
  // ==========================================
  app.get(`${prefix}/slips`, async (_req, res) => {
    try {
      const slips = await storage.getSlips();
      res.json(slips);
    } catch (error) {
      console.error("Error fetching slips:", error);
      res.status(500).json({ message: "Failed to fetch slips" });
    }
  });

  app.get(`${prefix}/slips/available`, async (_req, res) => {
    try {
      const slips = await storage.getAvailableSlips();
      res.json(slips);
    } catch (error) {
      console.error("Error fetching available slips:", error);
      res.status(500).json({ message: "Failed to fetch available slips" });
    }
  });

  app.post(`${prefix}/slips`, async (req, res) => {
    try {
      const validatedData = insertSlipSchema.parse(req.body);
      const slip = await storage.createSlip(validatedData);
      res.status(201).json(slip);
    } catch (error: any) {
      console.error("Error creating slip:", error);
      res.status(400).json({ message: error.message || "Failed to create slip" });
    }
  });

  // ==========================================
  // Leases
  // ==========================================
  app.get(`${prefix}/leases`, async (_req, res) => {
    try {
      const leases = await storage.getLeases();
      res.json(leases);
    } catch (error) {
      console.error("Error fetching leases:", error);
      res.status(500).json({ message: "Failed to fetch leases" });
    }
  });

  app.get(`${prefix}/leases/active`, async (_req, res) => {
    try {
      const leases = await storage.getActiveLeases();
      res.json(leases);
    } catch (error) {
      console.error("Error fetching active leases:", error);
      res.status(500).json({ message: "Failed to fetch active leases" });
    }
  });

  app.post(`${prefix}/leases`, async (req, res) => {
    try {
      const validatedData = insertLeaseSchema.parse(req.body);
      const lease = await storage.createLease(validatedData);
      res.status(201).json(lease);
    } catch (error: any) {
      console.error("Error creating lease:", error);
      res.status(400).json({ message: error.message || "Failed to create lease" });
    }
  });

  // ==========================================
  // Launches (SpeedyDock-style)
  // ==========================================
  app.get(`${prefix}/launches`, async (_req, res) => {
    try {
      const launches = await storage.getLaunches();
      res.json(launches);
    } catch (error) {
      console.error("Error fetching launches:", error);
      res.status(500).json({ message: "Failed to fetch launches" });
    }
  });

  app.get(`${prefix}/launches/today`, async (_req, res) => {
    try {
      const launches = await storage.getTodaysLaunches();
      res.json(launches);
    } catch (error) {
      console.error("Error fetching today's launches:", error);
      res.status(500).json({ message: "Failed to fetch today's launches" });
    }
  });

  app.get(`${prefix}/launches/queue`, async (_req, res) => {
    try {
      const queue = await storage.getLaunchQueue();
      res.json(queue);
    } catch (error) {
      console.error("Error fetching launch queue:", error);
      res.status(500).json({ message: "Failed to fetch launch queue" });
    }
  });

  app.post(`${prefix}/launches`, async (req, res) => {
    try {
      const validatedData = insertLaunchSchema.parse(req.body);
      const launch = await storage.createLaunch(validatedData);
      res.status(201).json(launch);
    } catch (error: any) {
      console.error("Error creating launch:", error);
      res.status(400).json({ message: error.message || "Failed to create launch" });
    }
  });

  app.patch(`${prefix}/launches/:id/status`, async (req, res) => {
    try {
      const { status, staffAssigned } = req.body;
      const launch = await storage.updateLaunchStatus(req.params.id, status, staffAssigned);
      res.json(launch);
    } catch (error: any) {
      console.error("Error updating launch status:", error);
      res.status(400).json({ message: error.message || "Failed to update launch status" });
    }
  });

  // ==========================================
  // Payments
  // ==========================================
  app.get(`${prefix}/payments`, async (_req, res) => {
    try {
      const payments = await storage.getPayments();
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.get(`${prefix}/payments/pending`, async (_req, res) => {
    try {
      const payments = await storage.getPendingPayments();
      res.json(payments);
    } catch (error) {
      console.error("Error fetching pending payments:", error);
      res.status(500).json({ message: "Failed to fetch pending payments" });
    }
  });

  app.post(`${prefix}/payments`, async (req, res) => {
    try {
      const validatedData = insertPaymentSchema.parse(req.body);
      const payment = await storage.createPayment(validatedData);
      res.status(201).json(payment);
    } catch (error: any) {
      console.error("Error creating payment:", error);
      res.status(400).json({ message: error.message || "Failed to create payment" });
    }
  });

  // ==========================================
  // Integrations
  // ==========================================
  app.get(`${prefix}/integrations`, async (_req, res) => {
    try {
      const integrations = await storage.getIntegrations();
      res.json(integrations);
    } catch (error) {
      console.error("Error fetching integrations:", error);
      res.status(500).json({ message: "Failed to fetch integrations" });
    }
  });

  app.post(`${prefix}/integrations`, async (req, res) => {
    try {
      const validatedData = insertIntegrationSchema.parse(req.body);
      const integration = await storage.createIntegration(validatedData);
      res.status(201).json(integration);
    } catch (error: any) {
      console.error("Error creating integration:", error);
      res.status(400).json({ message: error.message || "Failed to create integration" });
    }
  });

  // ==========================================
  // Import Jobs (Data Import Pipeline)
  // ==========================================
  app.get(`${prefix}/imports`, async (_req, res) => {
    try {
      const jobs = await storage.getImportJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching import jobs:", error);
      res.status(500).json({ message: "Failed to fetch import jobs" });
    }
  });

  app.get(`${prefix}/imports/:id`, async (req, res) => {
    try {
      const job = await storage.getImportJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Import job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error fetching import job:", error);
      res.status(500).json({ message: "Failed to fetch import job" });
    }
  });

  app.post(`${prefix}/imports/upload`, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const job = await storage.createImportJob({
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileType: path.extname(req.file.originalname).toLowerCase().slice(1),
        status: 'pending',
        entityType: req.body.entityType || 'customers',
      });
      
      res.status(201).json(job);
    } catch (error: any) {
      console.error("Error uploading import file:", error);
      res.status(400).json({ message: error.message || "Failed to upload file" });
    }
  });

  app.get(`${prefix}/imports/:id/errors`, async (req, res) => {
    try {
      const errors = await storage.getImportErrors(req.params.id);
      res.json(errors);
    } catch (error) {
      console.error("Error fetching import errors:", error);
      res.status(500).json({ message: "Failed to fetch import errors" });
    }
  });

  // ==========================================
  // Rent Roll (Financial)
  // ==========================================
  app.get(`${prefix}/rent-roll`, async (_req, res) => {
    try {
      const rentRoll = await storage.getRentRoll();
      res.json(rentRoll);
    } catch (error) {
      console.error("Error fetching rent roll:", error);
      res.status(500).json({ message: "Failed to fetch rent roll" });
    }
  });

  app.get(`${prefix}/rent-roll/summary`, async (_req, res) => {
    try {
      const summary = await storage.getRentRollSummary();
      res.json(summary);
    } catch (error) {
      console.error("Error fetching rent roll summary:", error);
      res.status(500).json({ message: "Failed to fetch rent roll summary" });
    }
  });

  // ==========================================
  // Financial Reports
  // ==========================================
  app.get(`${prefix}/financial/summary`, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const summary = await storage.getFinancialSummary(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(summary);
    } catch (error) {
      console.error("Error fetching financial summary:", error);
      res.status(500).json({ message: "Failed to fetch financial summary" });
    }
  });

  app.get(`${prefix}/financial/revenue`, async (req, res) => {
    try {
      const { period } = req.query;
      const revenue = await storage.getRevenueData(period as string || 'monthly');
      res.json(revenue);
    } catch (error) {
      console.error("Error fetching revenue data:", error);
      res.status(500).json({ message: "Failed to fetch revenue data" });
    }
  });

  // ==========================================
  // Messages & Communications
  // ==========================================
  app.get(`${prefix}/messages/threads`, dockitAuth, async (req: any, res) => {
    try {
      const threads = await storage.getMessageThreads(req.session?.userId);
      res.json(threads);
    } catch (error) {
      console.error("Error fetching message threads:", error);
      res.status(500).json({ message: "Failed to fetch message threads" });
    }
  });

  app.get(`${prefix}/messages/threads/:threadId`, dockitAuth, async (req, res) => {
    try {
      const messages = await storage.getThreadMessages(req.params.threadId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching thread messages:", error);
      res.status(500).json({ message: "Failed to fetch thread messages" });
    }
  });

  app.post(`${prefix}/messages`, dockitAuth, async (req: any, res) => {
    try {
      const validatedData = insertMessageSchema.parse({
        ...req.body,
        senderId: req.session?.userId || 'system'
      });
      const message = await storage.createMessage(validatedData);
      res.status(201).json(message);
    } catch (error: any) {
      console.error("Error creating message:", error);
      res.status(400).json({ message: error.message || "Failed to create message" });
    }
  });

  // ==========================================
  // Audit Trail
  // ==========================================
  app.get(`${prefix}/audit-logs`, dockitAuth, async (req, res) => {
    try {
      const { limit, offset, entityType } = req.query;
      const logs = await storage.getAuditLogs({
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
        entityType: entityType as string
      });
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // ==========================================
  // Contracts
  // ==========================================
  app.get(`${prefix}/contracts`, dockitAuth, async (_req, res) => {
    try {
      const contracts = await storage.getContracts();
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ message: "Failed to fetch contracts" });
    }
  });

  app.get(`${prefix}/contracts/:id`, dockitAuth, async (req, res) => {
    try {
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      console.error("Error fetching contract:", error);
      res.status(500).json({ message: "Failed to fetch contract" });
    }
  });

  app.post(`${prefix}/contracts`, dockitAuth, async (req, res) => {
    try {
      const validatedData = insertContractSchema.parse(req.body);
      const contract = await storage.createContract(validatedData);
      res.status(201).json(contract);
    } catch (error: any) {
      console.error("Error creating contract:", error);
      res.status(400).json({ message: error.message || "Failed to create contract" });
    }
  });

  // ==========================================
  // Contract Templates
  // ==========================================
  app.get(`${prefix}/contract-templates`, dockitAuth, async (_req, res) => {
    try {
      const templates = await storage.getContractTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching contract templates:", error);
      res.status(500).json({ message: "Failed to fetch contract templates" });
    }
  });

  app.post(`${prefix}/contract-templates`, dockitAuth, async (req, res) => {
    try {
      const validatedData = insertContractTemplateSchema.parse(req.body);
      const template = await storage.createContractTemplate(validatedData);
      res.status(201).json(template);
    } catch (error: any) {
      console.error("Error creating contract template:", error);
      res.status(400).json({ message: error.message || "Failed to create contract template" });
    }
  });

  // ==========================================
  // Reservations
  // ==========================================
  app.get(`${prefix}/reservations`, async (_req, res) => {
    try {
      const reservations = await storage.getReservations();
      res.json(reservations);
    } catch (error) {
      console.error("Error fetching reservations:", error);
      res.status(500).json({ message: "Failed to fetch reservations" });
    }
  });

  app.post(`${prefix}/reservations`, async (req, res) => {
    try {
      const validatedData = insertReservationSchema.parse(req.body);
      const reservation = await storage.createReservation(validatedData);
      res.status(201).json(reservation);
    } catch (error: any) {
      console.error("Error creating reservation:", error);
      res.status(400).json({ message: error.message || "Failed to create reservation" });
    }
  });

  // ==========================================
  // Waitlist
  // ==========================================
  app.get(`${prefix}/waitlist`, async (_req, res) => {
    try {
      const waitlist = await storage.getWaitlist();
      res.json(waitlist);
    } catch (error) {
      console.error("Error fetching waitlist:", error);
      res.status(500).json({ message: "Failed to fetch waitlist" });
    }
  });

  // ==========================================
  // Pricing
  // ==========================================
  app.get(`${prefix}/pricing/rules`, async (_req, res) => {
    try {
      const rules = await storage.getPricingRules();
      res.json(rules);
    } catch (error) {
      console.error("Error fetching pricing rules:", error);
      res.status(500).json({ message: "Failed to fetch pricing rules" });
    }
  });

  app.post(`${prefix}/pricing/rules`, dockitAuth, async (req, res) => {
    try {
      const validatedData = insertPricingRuleSchema.parse(req.body);
      const rule = await storage.createPricingRule(validatedData);
      res.status(201).json(rule);
    } catch (error: any) {
      console.error("Error creating pricing rule:", error);
      res.status(400).json({ message: error.message || "Failed to create pricing rule" });
    }
  });

  console.log(`[Dockit] Registered core API routes under ${prefix}`);
}
