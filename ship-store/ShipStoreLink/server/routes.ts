import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import { logAudit } from "./audit";
import { 
  exportProjectionsToExcel,
  exportHistoricalDataToExcel,
  exportTransactionsToExcel,
  exportScenarioComparisonToExcel
} from "./excel-export";
import { 
  insertProductSchema, insertCategorySchema, insertTransactionSchema, insertStoreSettingsSchema,
  insertScenarioSchema, insertAssumptionSchema, insertProjectionSchema, insertHistoricalDataSchema
} from "@shared/schema";
import { z } from "zod";
import { healthCheck, readinessCheck, livenessCheck } from "./health";
import { authenticate, requireRole, type AuthRequest } from "./middleware/auth";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-08-27.basil",
}) : null;

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoints (no auth required - used by monitoring/parent app)
  app.get("/api/health", healthCheck);
  app.get("/api/health/ready", readinessCheck);
  app.get("/api/health/live", livenessCheck);

  // Categories
  app.get("/api/categories", authenticate, async (req: AuthRequest, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Error fetching categories" });
    }
  });

  app.post("/api/categories", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const data = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(data);
      
      // Audit log
      await logAudit({
        req,
        entityType: "categories",
        entityId: category.id,
        action: "create",
        afterData: category,
      });
      
      res.json(category);
    } catch (error) {
      res.status(400).json({ message: "Error creating category" });
    }
  });

  // Products
  app.get("/api/products", authenticate, async (req: AuthRequest, res) => {
    try {
      const categoryId = req.query.categoryId as string;
      const products = await storage.getProducts(categoryId);
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Error fetching products" });
    }
  });

  app.get("/api/products/:id", authenticate, async (req: AuthRequest, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Error fetching product" });
    }
  });

  app.post("/api/products", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const data = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(data);
      
      // Audit log
      await logAudit({
        req,
        entityType: "products",
        entityId: product.id,
        action: "create",
        afterData: product,
      });
      
      res.json(product);
    } catch (error) {
      res.status(400).json({ message: "Error creating product" });
    }
  });

  app.put("/api/products/:id", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const before = await storage.getProduct(req.params.id);
      const data = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(req.params.id, data);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Audit log
      await logAudit({
        req,
        entityType: "products",
        entityId: product.id,
        action: "update",
        beforeData: before,
        afterData: product,
      });
      
      res.json(product);
    } catch (error) {
      res.status(400).json({ message: "Error updating product" });
    }
  });

  app.delete("/api/products/:id", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const before = await storage.getProduct(req.params.id);
      const success = await storage.deleteProduct(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Audit log
      if (before) {
        await logAudit({
          req,
          entityType: "products",
          entityId: req.params.id,
          action: "delete",
          beforeData: before,
        });
      }
      
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting product" });
    }
  });

  app.get("/api/products/low-stock", authenticate, async (req: AuthRequest, res) => {
    try {
      const products = await storage.getLowStockProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Error fetching low stock products" });
    }
  });

  // Transactions
  app.get("/api/transactions", authenticate, async (req: AuthRequest, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const transactions = await storage.getTransactions(limit, offset);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Error fetching transactions" });
    }
  });

  app.get("/api/transactions/count", authenticate, async (req: AuthRequest, res) => {
    try {
      const count = await storage.getTotalTransactionsCount();
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Error fetching transaction count" });
    }
  });

  app.get("/api/transactions/recent", authenticate, async (req: AuthRequest, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const transactions = await storage.getRecentTransactions(limit);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Error fetching recent transactions" });
    }
  });

  app.post("/api/transactions", authenticate, async (req: AuthRequest, res) => {
    try {
      const data = insertTransactionSchema.parse(req.body);
      
      // Update product stock levels
      for (const item of data.items) {
        await storage.updateProductStock(item.productId, item.quantity);
      }
      
      const transaction = await storage.createTransaction(data);
      
      // Audit log
      await logAudit({
        req,
        entityType: "transactions",
        entityId: transaction.id,
        action: "create",
        afterData: transaction,
        metadata: {
          itemCount: data.items.length,
          total: data.total,
          paymentMethod: data.paymentMethod,
        }
      });
      
      res.json(transaction);
    } catch (error) {
      res.status(400).json({ message: "Error creating transaction" });
    }
  });

  // Dashboard metrics
  app.get("/api/dashboard/metrics", authenticate, async (req: AuthRequest, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Error fetching dashboard metrics" });
    }
  });

  app.get("/api/dashboard/sales-data", authenticate, async (req: AuthRequest, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const salesData = await storage.getSalesData(days);
      res.json(salesData);
    } catch (error) {
      res.status(500).json({ message: "Error fetching sales data" });
    }
  });

  app.get("/api/dashboard/top-categories", authenticate, async (req: AuthRequest, res) => {
    try {
      const categories = await storage.getTopCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Error fetching top categories" });
    }
  });

  // Store Settings
  app.get("/api/settings", authenticate, async (req: AuthRequest, res) => {
    try {
      const settings = await storage.getStoreSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Error fetching store settings" });
    }
  });

  app.put("/api/settings", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const data = insertStoreSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateStoreSettings(data);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ message: "Error updating store settings" });
    }
  });

  // Stripe payment processing
  app.post("/api/create-payment-intent", authenticate, async (req: AuthRequest, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ message: "Stripe is not configured. Please add STRIPE_SECRET_KEY environment variable." });
      }
      const { amount } = req.body;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: "usd",
        metadata: {
          source: "ship-store-pos"
        }
      });
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      res.status(500).json({ message: "Error creating payment intent: " + error.message });
    }
  });

  // Barcode scanning simulation
  app.get("/api/products/barcode/:barcode", authenticate, async (req: AuthRequest, res) => {
    try {
      const product = await storage.getProductBySku(req.params.barcode);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Error scanning barcode" });
    }
  });

  // Financial Modeling - Scenarios (managers only)
  app.get("/api/scenarios", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const scenarios = await storage.getScenarios();
      res.json(scenarios);
    } catch (error) {
      res.status(500).json({ message: "Error fetching scenarios" });
    }
  });

  app.get("/api/scenarios/:id", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const scenario = await storage.getScenario(req.params.id);
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }
      res.json(scenario);
    } catch (error) {
      res.status(500).json({ message: "Error fetching scenario" });
    }
  });

  app.post("/api/scenarios", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const data = insertScenarioSchema.parse(req.body);
      const scenario = await storage.createScenario(data);
      
      // Audit log
      await logAudit({
        req,
        entityType: "scenarios",
        entityId: scenario.id,
        action: "create",
        afterData: scenario,
      });
      
      res.json(scenario);
    } catch (error) {
      res.status(400).json({ message: "Error creating scenario" });
    }
  });

  app.put("/api/scenarios/:id", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const before = await storage.getScenario(req.params.id);
      const data = insertScenarioSchema.partial().parse(req.body);
      const scenario = await storage.updateScenario(req.params.id, data);
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }
      
      // Audit log
      await logAudit({
        req,
        entityType: "scenarios",
        entityId: scenario.id,
        action: "update",
        beforeData: before,
        afterData: scenario,
      });
      
      res.json(scenario);
    } catch (error) {
      res.status(400).json({ message: "Error updating scenario" });
    }
  });

  app.delete("/api/scenarios/:id", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const before = await storage.getScenario(req.params.id);
      const success = await storage.deleteScenario(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Scenario not found" });
      }
      
      // Audit log
      if (before) {
        await logAudit({
          req,
          entityType: "scenarios",
          entityId: req.params.id,
          action: "delete",
          beforeData: before,
        });
      }
      
      res.json({ message: "Scenario deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting scenario" });
    }
  });

  // Financial Modeling - Assumptions (managers only)
  app.get("/api/scenarios/:scenarioId/assumptions", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const assumptions = await storage.getAssumptionsByScenario(req.params.scenarioId);
      res.json(assumptions);
    } catch (error) {
      res.status(500).json({ message: "Error fetching assumptions" });
    }
  });

  app.post("/api/assumptions", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const data = insertAssumptionSchema.parse(req.body);
      
      // Check if assumptions already exist for this scenario
      const existing = await storage.getAssumptionsByScenario(data.scenarioId);
      if (existing) {
        // Update existing assumptions instead of creating duplicate
        const updated = await storage.updateAssumption(existing.id, data);
        
        // Audit log
        await logAudit({
          req,
          entityType: "assumptions",
          entityId: updated!.id,
          action: "update",
          beforeData: existing,
          afterData: updated,
        });
        
        return res.json(updated);
      }
      
      const assumption = await storage.createAssumption(data);
      
      // Audit log
      await logAudit({
        req,
        entityType: "assumptions",
        entityId: assumption.id,
        action: "create",
        afterData: assumption,
      });
      
      res.json(assumption);
    } catch (error: any) {
      res.status(400).json({ message: "Error creating assumptions: " + (error.message || "Invalid data") });
    }
  });

  app.put("/api/assumptions/:id", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const data = insertAssumptionSchema.partial().parse(req.body);
      const assumption = await storage.updateAssumption(req.params.id, data);
      if (!assumption) {
        return res.status(404).json({ message: "Assumptions not found" });
      }
      res.json(assumption);
    } catch (error) {
      res.status(400).json({ message: "Error updating assumptions" });
    }
  });

  // Financial Modeling - Projections (managers only)
  app.get("/api/scenarios/:scenarioId/projections", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const projections = await storage.getProjectionsByScenario(req.params.scenarioId);
      res.json(projections);
    } catch (error) {
      res.status(500).json({ message: "Error fetching projections" });
    }
  });

  app.post("/api/projections", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const data = insertProjectionSchema.parse(req.body);
      const projection = await storage.createProjection(data);
      res.json(projection);
    } catch (error) {
      res.status(400).json({ message: "Error creating projection" });
    }
  });

  app.post("/api/projections/bulk", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const { projections } = req.body;
      if (!Array.isArray(projections)) {
        return res.status(400).json({ message: "Projections must be an array" });
      }
      // Validate each projection
      const validatedProjections = projections.map(proj => insertProjectionSchema.parse(proj));
      const created = await storage.bulkCreateProjections(validatedProjections);
      res.json(created);
    } catch (error: any) {
      res.status(400).json({ message: "Error creating projections: " + (error.message || "Invalid data") });
    }
  });

  app.delete("/api/scenarios/:scenarioId/projections", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      // Capture before data for audit trail (PE compliance requires logging ALL delete operations)
      const beforeProjections = await storage.getProjectionsByScenario(req.params.scenarioId);
      const success = await storage.deleteProjectionsByScenario(req.params.scenarioId);
      
      // Always log deletion for compliance, even if zero records deleted
      const deletedCount = beforeProjections?.length || 0;
      await logAudit({
        req,
        entityType: "projections",
        entityId: req.params.scenarioId,
        action: "delete",
        beforeData: { 
          projections: beforeProjections || [], 
          count: deletedCount 
        },
        afterData: {
          success,
          deletedCount
        },
        metadata: {
          scenarioId: req.params.scenarioId,
          deletedCount,
          operationSuccess: success
        }
      });
      
      res.json({ message: "Projections deleted successfully", success });
    } catch (error) {
      res.status(500).json({ message: "Error deleting projections" });
    }
  });

  // Financial Modeling - Historical Data (managers only)
  app.get("/api/historical-data", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const filters = {
        period: req.query.period as string | undefined,
        year: req.query.year ? parseInt(req.query.year as string) : undefined,
        dataSource: req.query.dataSource as string | undefined,
      };
      const data = await storage.getHistoricalData(filters);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Error fetching historical data" });
    }
  });

  app.post("/api/historical-data", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const data = insertHistoricalDataSchema.parse(req.body);
      const created = await storage.createHistoricalData(data);
      res.json(created);
    } catch (error) {
      res.status(400).json({ message: "Error creating historical data" });
    }
  });

  app.post("/api/historical-data/bulk", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const { data } = req.body;
      if (!Array.isArray(data)) {
        return res.status(400).json({ message: "Data must be an array" });
      }
      // Validate each historical data entry
      const validatedData = data.map(entry => insertHistoricalDataSchema.parse(entry));
      const created = await storage.bulkCreateHistoricalData(validatedData);
      res.json(created);
    } catch (error: any) {
      res.status(400).json({ message: "Error importing historical data: " + (error.message || "Invalid data") });
    }
  });

  app.post("/api/historical-data/import", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const { records } = req.body;
      
      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ message: "Records must be a non-empty array" });
      }

      // Validate each record
      const validatedRecords = records.map(record => {
        try {
          return insertHistoricalDataSchema.parse(record);
        } catch (error: any) {
          throw new Error(`Invalid record: ${error.message}`);
        }
      });

      // Bulk insert
      const imported = await storage.bulkCreateHistoricalData(validatedRecords);
      
      // Log the import operation for audit trail
      await logAudit({
        req,
        entityType: "historical_data",
        entityId: "bulk_import",
        action: "import",
        afterData: { count: imported.length, dataSource: records[0]?.dataSource },
        metadata: {
          recordCount: imported.length,
          period: records[0]?.period,
          yearRange: {
            min: Math.min(...records.map((r: any) => r.periodYear).filter(Boolean)),
            max: Math.max(...records.map((r: any) => r.periodYear).filter(Boolean)),
          }
        }
      });
      
      res.json({ 
        message: `Successfully imported ${imported.length} records`,
        count: imported.length,
        data: imported
      });
    } catch (error: any) {
      res.status(400).json({ message: "Error importing data: " + (error.message || "Invalid data format") });
    }
  });

  // Audit Logs (managers only - compliance/security requirement)
  app.get("/api/audit-logs", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const filters = {
        entityType: req.query.entityType as string | undefined,
        entityId: req.query.entityId as string | undefined,
        userId: req.query.userId as string | undefined,
        action: req.query.action as string | undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };
      
      const logs = await storage.getAuditLogs(filters);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Error fetching audit logs" });
    }
  });

  app.get("/api/audit-logs/:entityType/:entityId", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const { entityType, entityId } = req.params;
      const logs = await storage.getAuditLogsByEntity(entityType, entityId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Error fetching entity audit logs" });
    }
  });

  // Pro Forma Calculation Engine (managers only)
  app.post("/api/calculate-proforma", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const { scenarioId, startYear, endYear } = req.body;
      
      // Get scenario and assumptions
      const scenario = await storage.getScenario(scenarioId);
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }
      
      // Audit log the generation request
      await logAudit({
        req,
        entityType: "projections",
        entityId: scenarioId,
        action: "generate",
        metadata: {
          startYear,
          endYear,
          scenarioName: scenario.name,
        }
      });
      
      const assumptions = await storage.getAssumptionsByScenario(scenarioId);
      if (!assumptions) {
        return res.status(404).json({ message: "No assumptions found for this scenario" });
      }

      // Get historical data to establish baseline
      const historicalData = await storage.getHistoricalData({ period: "monthly" });
      
      // Calculate baseline from recent historical data
      let baselineRevenue = 10000; // Default
      if (historicalData.length > 0) {
        const recentData = historicalData.slice(0, 12);
        const totalRevenue = recentData.reduce((sum, d) => sum + (Number(d.revenue) || 0), 0);
        baselineRevenue = totalRevenue / recentData.length;
      }

      // Generate projections
      const projectionsList = [];
      const currentYear = new Date().getFullYear();
      const years = endYear - startYear + 1;
      
      for (let yearOffset = 0; yearOffset < years; yearOffset++) {
        const year = startYear + yearOffset;
        const annualGrowthRate = Number(assumptions.revenueGrowthRate) / 100 || 0.1;
        const monthlyGrowthRate = Number(assumptions.monthlyRevenueGrowth) / 100 || (annualGrowthRate / 12);
        const cogsPercent = Number(assumptions.cogsPercentage) / 100 || 0.6;
        const fixedCosts = Number(assumptions.fixedCosts) || 5000;

        for (let month = 1; month <= 12; month++) {
          const monthsFromStart = yearOffset * 12 + month;
          let monthlyRevenue = baselineRevenue * Math.pow(1 + monthlyGrowthRate, monthsFromStart);

          // Apply seasonality
          if (assumptions.seasonalityFactors) {
            const seasonalFactor = assumptions.seasonalityFactors[month] || 1;
            monthlyRevenue *= seasonalFactor;
          }

          // Apply new product impacts
          if (assumptions.newProductLaunchImpact) {
            for (const impact of assumptions.newProductLaunchImpact) {
              if (impact.year === year && impact.month === month) {
                monthlyRevenue += impact.revenueIncrease;
              }
            }
          }

          const cogs = monthlyRevenue * cogsPercent;
          const grossProfit = monthlyRevenue - cogs;
          const opex = fixedCosts;
          const netIncome = grossProfit - opex;

          projectionsList.push({
            scenarioId,
            period: "monthly",
            periodYear: year,
            periodMonth: month,
            periodQuarter: Math.ceil(month / 3),
            projectedRevenue: monthlyRevenue.toFixed(2),
            projectedCOGS: cogs.toFixed(2),
            projectedGrossProfit: grossProfit.toFixed(2),
            projectedOpex: opex.toFixed(2),
            projectedNetIncome: netIncome.toFixed(2),
            grossMarginPercent: ((grossProfit / monthlyRevenue) * 100).toFixed(2),
            operatingMarginPercent: ((netIncome / monthlyRevenue) * 100).toFixed(2),
            netMarginPercent: ((netIncome / monthlyRevenue) * 100).toFixed(2),
            calculationMetadata: {
              basedOnHistorical: historicalData.length > 0,
              dataPoints: historicalData.length,
              confidence: historicalData.length >= 12 ? "high" : historicalData.length >= 6 ? "medium" : "low"
            }
          });
        }
      }

      // Clear old projections and save new ones
      await storage.deleteProjectionsByScenario(scenarioId);
      const created = await storage.bulkCreateProjections(projectionsList);
      
      res.json({ 
        message: "Pro forma calculations completed", 
        projectionsCount: created.length,
        projections: created
      });
    } catch (error: any) {
      res.status(500).json({ message: "Error calculating pro forma: " + error.message });
    }
  });

  // Excel Export Routes (managers only)
  app.get("/api/export/projections/:scenarioId", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const buffer = await exportProjectionsToExcel(req.params.scenarioId);
      const scenario = await storage.getScenario(req.params.scenarioId);
      const filename = `projections-${scenario?.name.replace(/\s+/g, '-') || 'scenario'}-${new Date().toISOString().split('T')[0]}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);

      // Audit log
      const projections = await storage.getProjectionsByScenario(req.params.scenarioId);
      await logAudit({
        req,
        entityType: "projections",
        entityId: req.params.scenarioId,
        action: "export",
        metadata: { format: "excel", filename, recordCount: projections?.length || 0 }
      });
    } catch (error) {
      res.status(500).json({ message: "Error exporting projections" });
    }
  });

  app.get("/api/export/historical-data", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const filters = {
        period: req.query.period as string | undefined,
        year: req.query.year ? parseInt(req.query.year as string) : undefined,
        dataSource: req.query.dataSource as string | undefined,
      };
      const buffer = await exportHistoricalDataToExcel(filters);
      const filename = `historical-data-${new Date().toISOString().split('T')[0]}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);

      // Audit log
      const histData = await storage.getHistoricalData(filters);
      await logAudit({
        req,
        entityType: "historical_data",
        entityId: "export",
        action: "export",
        metadata: { format: "excel", filename, filters, recordCount: histData?.length || 0 }
      });
    } catch (error) {
      res.status(500).json({ message: "Error exporting historical data" });
    }
  });

  app.get("/api/export/transactions", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const buffer = await exportTransactionsToExcel();
      const filename = `transactions-${new Date().toISOString().split('T')[0]}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);

      // Audit log
      const transactions = await storage.getRecentTransactions(100);
      await logAudit({
        req,
        entityType: "transactions",
        entityId: "export",
        action: "export",
        metadata: { format: "excel", filename, recordCount: transactions?.length || 0 }
      });
    } catch (error) {
      res.status(500).json({ message: "Error exporting transactions" });
    }
  });

  app.post("/api/export/scenario-comparison", authenticate, requireRole('manager'), async (req: AuthRequest, res) => {
    try {
      const { scenarioIds } = req.body;
      if (!Array.isArray(scenarioIds) || scenarioIds.length === 0) {
        return res.status(400).json({ message: "scenarioIds must be a non-empty array" });
      }
      
      const buffer = await exportScenarioComparisonToExcel(scenarioIds);
      const filename = `scenario-comparison-${new Date().toISOString().split('T')[0]}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);

      // Audit log
      await logAudit({
        req,
        entityType: "scenarios",
        entityId: scenarioIds.join(","),
        action: "export",
        metadata: { format: "excel", filename, scenarioCount: scenarioIds.length }
      });
    } catch (error) {
      res.status(500).json({ message: "Error exporting scenario comparison" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
