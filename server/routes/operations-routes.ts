import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, or, sql, desc } from "drizzle-orm";
import { requirePermission, requireRole } from "../middleware/rbac";
import { FuelSyncService } from "../services/fuel/fuel-sync-service";
import { requireApprovalCheck } from "../services/fuel/fuel-route-utils";
import { requirePack } from "../middleware/pack-guard";
import { z } from "zod";
import multer from "multer";
import { validateFileUpload } from "../middleware/file-upload-security";
import {
  fuelSales,
  insertFuelSaleSchema,
  updateFuelSaleSchema,
  fuelTypes,
  insertFuelTypeSchema,
  updateFuelTypeSchema,
  fuelInventory,
  insertFuelInventorySchema,
  updateFuelInventorySchema,
  fuelDeliveries,
  insertFuelDeliverySchema,
  updateFuelDeliverySchema,
  fuelFinancialProjections,
  insertFuelProjectionSchema,
  updateFuelProjectionSchema,
  fuelImportLogs,
  fuelIntegrations,
  insertFuelIntegrationSchema,
  updateFuelIntegrationSchema,
} from "@shared/schema";

export function registerOperationsRoutes(
  app: Express,
  authenticateUser: any
) {
  // ==================== OPERATIONS - FUEL SALES ROUTES ====================

  // Get all fuel sales for organization
  app.get("/api/operations/fuel-sales", authenticateUser, requirePermission('fuel:read'), async (req, res) => {
    try {
      const sales = await db.query.fuelSales.findMany({
        where: eq(fuelSales.orgId, req.user!.orgId),
        orderBy: desc(fuelSales.transactionDate),
        with: {
          processedByUser: {
            columns: {
              id: true,
              name: true,
              email: true,
            }
          },
        },
      });
      res.json(sales);
    } catch (error: any) {
      console.error("Error fetching fuel sales:", error);
      res.status(500).json({ message: "Failed to fetch fuel sales" });
    }
  });

  // Create a new fuel sale
  app.post("/api/operations/fuel-sales", authenticateUser, requirePermission('fuel:create'), async (req, res) => {
    try {
      const saleData = insertFuelSaleSchema.parse(req.body);
      const [sale] = await db.insert(fuelSales).values({
        ...saleData,
        orgId: req.user!.orgId,
      }).returning();

      await AuditService.logFuelTransaction(
        req,
        'create',
        sale.id,
        null,
        sale,
        { source: 'manual_entry' }
      );

      res.json(sale);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating fuel sale:", error);
      res.status(500).json({ message: "Failed to create fuel sale" });
    }
  });

  // Get a specific fuel sale
  app.get("/api/operations/fuel-sales/:id", authenticateUser, requirePermission('fuel:read'), async (req, res) => {
    try {
      const sale = await db.query.fuelSales.findFirst({
        where: and(
          eq(fuelSales.id, req.params.id),
          eq(fuelSales.orgId, req.user!.orgId)
        ),
        with: {
          processedByUser: {
            columns: {
              id: true,
              name: true,
              email: true,
            }
          },
        },
      });

      if (!sale) {
        return res.status(404).json({ message: "Fuel sale not found" });
      }

      res.json(sale);
    } catch (error: any) {
      console.error("Error fetching fuel sale:", error);
      res.status(500).json({ message: "Failed to fetch fuel sale" });
    }
  });

  // Update a fuel sale
  app.patch("/api/operations/fuel-sales/:id", authenticateUser, requirePermission('fuel:update'), async (req, res) => {
    try {
      const updateData = updateFuelSaleSchema.parse(req.body);
      
      // Get existing record for audit trail
      const [existing] = await db.select().from(fuelSales)
        .where(and(
          eq(fuelSales.id, req.params.id),
          eq(fuelSales.orgId, req.user!.orgId)
        ));

      if (!existing) {
        return res.status(404).json({ message: "Fuel sale not found" });
      }

      const [updated] = await db.update(fuelSales)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(and(
          eq(fuelSales.id, req.params.id),
          eq(fuelSales.orgId, req.user!.orgId)
        ))
        .returning();

      await AuditService.logFuelTransaction(
        req,
        'update',
        req.params.id,
        existing,
        updated,
        { modifiedFields: Object.keys(updateData) }
      );

      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error updating fuel sale:", error);
      res.status(500).json({ message: "Failed to update fuel sale" });
    }
  });

  // Delete a fuel sale
  app.delete("/api/operations/fuel-sales/:id", authenticateUser, requirePermission('fuel:delete'), async (req, res) => {
    try {
      const [deleted] = await db.delete(fuelSales)
        .where(and(
          eq(fuelSales.id, req.params.id),
          eq(fuelSales.orgId, req.user!.orgId)
        ))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "Fuel sale not found" });
      }

      await AuditService.logFuelTransaction(
        req,
        'delete',
        req.params.id,
        deleted,
        null,
        { deletionReason: req.body?.reason || 'Not specified' }
      );

      res.json({ message: "Fuel sale deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting fuel sale:", error);
      res.status(500).json({ message: "Failed to delete fuel sale" });
    }
  });

  // Get fuel sales summary/stats
  app.get("/api/operations/fuel-sales/stats/summary", authenticateUser, requirePermission('fuel:read', 'analytics:read'), async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      let conditions = [eq(fuelSales.orgId, req.user!.orgId)];
      
      if (startDate) {
        conditions.push(gte(fuelSales.transactionDate, new Date(startDate as string)));
      }
      if (endDate) {
        conditions.push(lte(fuelSales.transactionDate, new Date(endDate as string)));
      }

      const sales = await db.query.fuelSales.findMany({
        where: and(...conditions),
      });

      const stats = {
        totalSales: sales.length,
        totalRevenue: sales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0),
        totalGallons: sales.reduce((sum, sale) => sum + Number(sale.quantityGallons), 0),
        byFuelType: sales.reduce((acc: Record<string, any>, sale) => {
          if (!acc[sale.fuelType]) {
            acc[sale.fuelType] = {
              count: 0,
              gallons: 0,
              revenue: 0,
            };
          }
          acc[sale.fuelType].count++;
          acc[sale.fuelType].gallons += Number(sale.quantityGallons);
          acc[sale.fuelType].revenue += Number(sale.totalAmount);
          return acc;
        }, {}),
        byPaymentMethod: sales.reduce((acc: Record<string, number>, sale) => {
          if (sale.paymentMethod) {
            acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + 1;
          }
          return acc;
        }, {}),
      };

      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching fuel sales stats:", error);
      res.status(500).json({ message: "Failed to fetch fuel sales stats" });
    }
  });

  // Import fuel sales from CSV
  app.post("/api/operations/fuel-sales/import-csv", authenticateUser, requirePermission('fuel:import'), async (req, res) => {
    const startTime = new Date();
    const errorLog: string[] = [];
    let recordsProcessed = 0;
    let recordsImported = 0;
    let recordsSkipped = 0;
    let recordsFailed = 0;

    try {
      const { data } = req.body;
      
      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ message: "Invalid request: 'data' array is required" });
      }

      recordsProcessed = data.length;

      // Check for duplicates within the CSV data
      const seen = new Set<string>();
      const duplicateIndices = new Set<number>();

      data.forEach((row, index) => {
        const duplicateKey = `${row.transactionDate}|${row.customerName || ''}|${row.quantityGallons}`;
        if (seen.has(duplicateKey)) {
          duplicateIndices.add(index);
        }
        seen.add(duplicateKey);
      });

      // Process each row
      const importPromises = data.map(async (row, index) => {
        try {
          // Skip duplicates
          if (duplicateIndices.has(index)) {
            recordsSkipped++;
            return null;
          }

          // Validate and insert
          const saleData = insertFuelSaleSchema.parse({
            transactionDate: new Date(row.transactionDate),
            fuelType: row.fuelType,
            quantityGallons: row.quantityGallons,
            pricePerGallon: row.pricePerGallon,
            totalAmount: row.totalAmount,
            customerName: row.customerName || null,
            boatName: row.boatName || null,
            slipNumber: row.slipNumber || null,
            paymentMethod: row.paymentMethod || null,
            processedBy: req.user!.id,
            notes: row.notes || null,
          });

          const [sale] = await db.insert(fuelSales).values({
            ...saleData,
            orgId: req.user!.orgId,
          }).returning();

          recordsImported++;
          return sale;
        } catch (error: any) {
          recordsFailed++;
          errorLog.push(`Row ${index + 1}: ${error.message}`);
          return null;
        }
      });

      await Promise.all(importPromises);

      // Create import log
      await db.insert(fuelImportLogs).values({
        orgId: req.user!.orgId,
        source: 'csv_upload',
        importType: 'manual_upload',
        status: recordsFailed > 0 ? 'partial' : 'completed',
        recordsProcessed,
        recordsImported,
        recordsSkipped,
        recordsFailed,
        errorLog: errorLog,
        importData: {
          fileName: 'manual_csv_upload',
          totalRows: recordsProcessed,
        },
        startedAt: startTime,
        completedAt: new Date(),
        createdBy: req.user!.id,
      });

      // Audit log the import
      await AuditService.logFuelTransaction(
        req,
        'import',
        null,
        null,
        null,
        { 
          source: 'csv_upload',
          recordsProcessed,
          recordsImported,
          recordsSkipped,
          recordsFailed,
          status: recordsFailed > 0 ? 'partial' : 'completed',
          duration: new Date().getTime() - startTime.getTime()
        }
      );

      res.json({
        imported: recordsImported,
        skipped: recordsSkipped,
        errors: errorLog,
      });
    } catch (error: any) {
      console.error("Error importing fuel sales:", error);
      
      // Log failed import
      try {
        await db.insert(fuelImportLogs).values({
          orgId: req.user!.orgId,
          source: 'csv_upload',
          importType: 'manual_upload',
          status: 'failed',
          recordsProcessed,
          recordsImported,
          recordsSkipped,
          recordsFailed,
          errorLog: [...errorLog, error.message],
          importData: {},
          startedAt: startTime,
          completedAt: new Date(),
          createdBy: req.user!.id,
        });
      } catch (logError) {
        console.error("Error creating import log:", logError);
      }

      res.status(500).json({ message: "Failed to import fuel sales", error: error.message });
    }
  });

  // ==================== OPERATIONS - FUEL TYPES ROUTES ====================

  // Get all fuel types for organization
  app.get("/api/operations/fuel-types", authenticateUser, requirePermission('fuel:read'), async (req, res) => {
    try {
      const types = await db.query.fuelTypes.findMany({
        where: eq(fuelTypes.orgId, req.user!.orgId),
        orderBy: [fuelTypes.category, fuelTypes.name],
      });
      res.json(types);
    } catch (error: any) {
      console.error("Error fetching fuel types:", error);
      res.status(500).json({ message: "Failed to fetch fuel types" });
    }
  });

  // Create a new fuel type
  app.post("/api/operations/fuel-types", authenticateUser, requirePermission('fuel:create'), async (req, res) => {
    try {
      const typeData = insertFuelTypeSchema.parse(req.body);
      const [type] = await db.insert(fuelTypes).values({
        ...typeData,
        orgId: req.user!.orgId,
      }).returning();

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'create',
        entityType: 'fuel_type',
        entityId: type.id,
        action: 'Create fuel type',
        afterData: type,
        metadata: { name: type.name, category: type.category },
        isSuccess: true,
      });

      res.json(type);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating fuel type:", error);
      res.status(500).json({ message: "Failed to create fuel type" });
    }
  });

  // Update a fuel type
  app.patch("/api/operations/fuel-types/:id", authenticateUser, requirePermission('fuel:update'), async (req, res) => {
    try {
      const updateData = updateFuelTypeSchema.parse(req.body);
      
      // Get existing record for audit trail
      const [existing] = await db.select().from(fuelTypes)
        .where(and(eq(fuelTypes.id, req.params.id), eq(fuelTypes.orgId, req.user!.orgId)));

      if (!existing) {
        return res.status(404).json({ message: "Fuel type not found" });
      }

      const [updated] = await db.update(fuelTypes)
        .set({ ...updateData, updatedAt: new Date() })
        .where(and(eq(fuelTypes.id, req.params.id), eq(fuelTypes.orgId, req.user!.orgId)))
        .returning();

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'update',
        entityType: 'fuel_type',
        entityId: req.params.id,
        action: 'Update fuel type',
        beforeData: existing,
        afterData: updated,
        metadata: { modifiedFields: Object.keys(updateData) },
        isSuccess: true,
      });

      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error updating fuel type:", error);
      res.status(500).json({ message: "Failed to update fuel type" });
    }
  });

  // Delete a fuel type
  app.delete("/api/operations/fuel-types/:id", authenticateUser, requirePermission('fuel:delete'), async (req, res) => {
    try {
      const [deleted] = await db.delete(fuelTypes)
        .where(and(eq(fuelTypes.id, req.params.id), eq(fuelTypes.orgId, req.user!.orgId)))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "Fuel type not found" });
      }

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'delete',
        entityType: 'fuel_type',
        entityId: req.params.id,
        action: 'Delete fuel type',
        beforeData: deleted,
        metadata: { deletionReason: req.body?.reason || 'Not specified' },
        isSuccess: true,
      });

      res.json({ message: "Fuel type deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting fuel type:", error);
      res.status(500).json({ message: "Failed to delete fuel type" });
    }
  });

  // ==================== OPERATIONS - FUEL INVENTORY ROUTES ====================

  // Get all fuel inventory for organization
  app.get("/api/operations/fuel-inventory", authenticateUser, requirePermission('fuel:read'), async (req, res) => {
    try {
      const inventory = await db.query.fuelInventory.findMany({
        where: eq(fuelInventory.orgId, req.user!.orgId),
        with: {
          fuelType: true,
        },
      });
      res.json(inventory);
    } catch (error: any) {
      console.error("Error fetching fuel inventory:", error);
      res.status(500).json({ message: "Failed to fetch fuel inventory" });
    }
  });

  // Create a new fuel inventory record
  app.post("/api/operations/fuel-inventory", authenticateUser, requirePermission('fuel:create'), async (req, res) => {
    try {
      const inventoryData = insertFuelInventorySchema.parse(req.body);
      const [inventory] = await db.insert(fuelInventory).values({
        ...inventoryData,
        orgId: req.user!.orgId,
      }).returning();

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'create',
        entityType: 'fuel_inventory',
        entityId: inventory.id,
        action: 'Create fuel inventory',
        afterData: inventory,
        metadata: { fuelTypeId: inventory.fuelTypeId, location: inventory.location },
        isSuccess: true,
      });

      res.json(inventory);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating fuel inventory:", error);
      res.status(500).json({ message: "Failed to create fuel inventory" });
    }
  });

  // Update fuel inventory
  app.patch("/api/operations/fuel-inventory/:id", authenticateUser, requirePermission('fuel:update'), async (req, res) => {
    try {
      const updateData = updateFuelInventorySchema.parse(req.body);
      
      // Get existing record for audit trail
      const [existing] = await db.select().from(fuelInventory)
        .where(and(eq(fuelInventory.id, req.params.id), eq(fuelInventory.orgId, req.user!.orgId)));

      if (!existing) {
        return res.status(404).json({ message: "Fuel inventory not found" });
      }

      const [updated] = await db.update(fuelInventory)
        .set({ ...updateData, lastUpdated: new Date() })
        .where(and(eq(fuelInventory.id, req.params.id), eq(fuelInventory.orgId, req.user!.orgId)))
        .returning();

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'update',
        entityType: 'fuel_inventory',
        entityId: req.params.id,
        action: 'Update fuel inventory',
        beforeData: existing,
        afterData: updated,
        metadata: { modifiedFields: Object.keys(updateData) },
        isSuccess: true,
      });

      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error updating fuel inventory:", error);
      res.status(500).json({ message: "Failed to update fuel inventory" });
    }
  });

  // Delete fuel inventory
  app.delete("/api/operations/fuel-inventory/:id", authenticateUser, requirePermission('fuel:delete'), async (req, res) => {
    try {
      const [deleted] = await db.delete(fuelInventory)
        .where(and(eq(fuelInventory.id, req.params.id), eq(fuelInventory.orgId, req.user!.orgId)))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "Fuel inventory not found" });
      }

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'delete',
        entityType: 'fuel_inventory',
        entityId: req.params.id,
        action: 'Delete fuel inventory',
        beforeData: deleted,
        metadata: { deletionReason: req.body?.reason || 'Not specified' },
        isSuccess: true,
      });

      res.json({ message: "Fuel inventory deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting fuel inventory:", error);
      res.status(500).json({ message: "Failed to delete fuel inventory" });
    }
  });

  // ==================== OPERATIONS - FUEL DELIVERIES ROUTES ====================

  // Get all fuel deliveries for organization
  app.get("/api/operations/fuel-deliveries", authenticateUser, requirePermission('fuel:read'), async (req, res) => {
    try {
      const deliveries = await db.query.fuelDeliveries.findMany({
        where: eq(fuelDeliveries.orgId, req.user!.orgId),
        orderBy: desc(fuelDeliveries.deliveryDate),
        with: {
          fuelType: true,
        },
      });
      res.json(deliveries);
    } catch (error: any) {
      console.error("Error fetching fuel deliveries:", error);
      res.status(500).json({ message: "Failed to fetch fuel deliveries" });
    }
  });

  // Create a new fuel delivery
  app.post("/api/operations/fuel-deliveries", authenticateUser, requirePermission('fuel:create'), async (req, res) => {
    try {
      const deliveryData = insertFuelDeliverySchema.parse(req.body);
      const [delivery] = await db.insert(fuelDeliveries).values({
        ...deliveryData,
        orgId: req.user!.orgId,
      }).returning();

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'create',
        entityType: 'fuel_delivery',
        entityId: delivery.id,
        action: 'Create fuel delivery',
        afterData: delivery,
        metadata: { fuelTypeId: delivery.fuelTypeId, quantity: delivery.quantity },
        isSuccess: true,
      });

      res.json(delivery);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating fuel delivery:", error);
      res.status(500).json({ message: "Failed to create fuel delivery" });
    }
  });

  // Update a fuel delivery
  app.patch("/api/operations/fuel-deliveries/:id", authenticateUser, requirePermission('fuel:update'), async (req, res) => {
    try {
      const updateData = updateFuelDeliverySchema.parse(req.body);
      
      // Get existing record for audit trail
      const [existing] = await db.select().from(fuelDeliveries)
        .where(and(eq(fuelDeliveries.id, req.params.id), eq(fuelDeliveries.orgId, req.user!.orgId)));

      if (!existing) {
        return res.status(404).json({ message: "Fuel delivery not found" });
      }

      const [updated] = await db.update(fuelDeliveries)
        .set({ ...updateData, updatedAt: new Date() })
        .where(and(eq(fuelDeliveries.id, req.params.id), eq(fuelDeliveries.orgId, req.user!.orgId)))
        .returning();

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'update',
        entityType: 'fuel_delivery',
        entityId: req.params.id,
        action: 'Update fuel delivery',
        beforeData: existing,
        afterData: updated,
        metadata: { modifiedFields: Object.keys(updateData) },
        isSuccess: true,
      });

      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error updating fuel delivery:", error);
      res.status(500).json({ message: "Failed to update fuel delivery" });
    }
  });

  // Delete a fuel delivery
  app.delete("/api/operations/fuel-deliveries/:id", authenticateUser, requirePermission('fuel:delete'), async (req, res) => {
    try {
      const [deleted] = await db.delete(fuelDeliveries)
        .where(and(eq(fuelDeliveries.id, req.params.id), eq(fuelDeliveries.orgId, req.user!.orgId)))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "Fuel delivery not found" });
      }

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'delete',
        entityType: 'fuel_delivery',
        entityId: req.params.id,
        action: 'Delete fuel delivery',
        beforeData: deleted,
        metadata: { deletionReason: req.body?.reason || 'Not specified' },
        isSuccess: true,
      });

      res.json({ message: "Fuel delivery deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting fuel delivery:", error);
      res.status(500).json({ message: "Failed to delete fuel delivery" });
    }
  });

  // ==================== OPERATIONS - FUEL PROJECTIONS ROUTES ====================

  // Get all fuel financial projections for organization
  app.get("/api/operations/fuel-projections", authenticateUser, requirePermission('fuel:read'), async (req, res) => {
    try {
      const projections = await db.query.fuelFinancialProjections.findMany({
        where: eq(fuelFinancialProjections.orgId, req.user!.orgId),
        orderBy: [fuelFinancialProjections.year, fuelFinancialProjections.month],
      });
      res.json(projections);
    } catch (error: any) {
      console.error("Error fetching fuel projections:", error);
      res.status(500).json({ message: "Failed to fetch fuel projections" });
    }
  });

  // Create a new fuel projection
  app.post("/api/operations/fuel-projections", authenticateUser, requirePermission('fuel:create'), async (req, res) => {
    try {
      const projectionData = insertFuelProjectionSchema.parse(req.body);
      const [projection] = await db.insert(fuelFinancialProjections).values({
        ...projectionData,
        orgId: req.user!.orgId,
      }).returning();

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'create',
        entityType: 'fuel_projection',
        entityId: projection.id,
        action: 'Create fuel projection',
        afterData: projection,
        metadata: { year: projection.year, month: projection.month },
        isSuccess: true,
      });

      res.json(projection);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating fuel projection:", error);
      res.status(500).json({ message: "Failed to create fuel projection" });
    }
  });

  // Update a fuel projection
  app.patch("/api/operations/fuel-projections/:id", authenticateUser, requirePermission('fuel:update'), async (req, res) => {
    try {
      const updateData = updateFuelProjectionSchema.parse(req.body);
      
      // Get existing record for audit trail
      const [existing] = await db.select().from(fuelFinancialProjections)
        .where(and(eq(fuelFinancialProjections.id, req.params.id), eq(fuelFinancialProjections.orgId, req.user!.orgId)));

      if (!existing) {
        return res.status(404).json({ message: "Fuel projection not found" });
      }

      const [updated] = await db.update(fuelFinancialProjections)
        .set({ ...updateData, updatedAt: new Date() })
        .where(and(eq(fuelFinancialProjections.id, req.params.id), eq(fuelFinancialProjections.orgId, req.user!.orgId)))
        .returning();

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'update',
        entityType: 'fuel_projection',
        entityId: req.params.id,
        action: 'Update fuel projection',
        beforeData: existing,
        afterData: updated,
        metadata: { modifiedFields: Object.keys(updateData) },
        isSuccess: true,
      });

      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error updating fuel projection:", error);
      res.status(500).json({ message: "Failed to update fuel projection" });
    }
  });

  // Delete a fuel projection
  app.delete("/api/operations/fuel-projections/:id", authenticateUser, requirePermission('fuel:delete'), async (req, res) => {
    try {
      const [deleted] = await db.delete(fuelFinancialProjections)
        .where(and(eq(fuelFinancialProjections.id, req.params.id), eq(fuelFinancialProjections.orgId, req.user!.orgId)))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "Fuel projection not found" });
      }

      // Add audit logging
      const context = AuditService.extractContext(req);
      await AuditService.log(context, {
        eventType: 'delete',
        entityType: 'fuel_projection',
        entityId: req.params.id,
        action: 'Delete fuel projection',
        beforeData: deleted,
        metadata: { deletionReason: req.body?.reason || 'Not specified' },
        isSuccess: true,
      });

      res.json({ message: "Fuel projection deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting fuel projection:", error);
      res.status(500).json({ message: "Failed to delete fuel projection" });
    }
  });

  // ==================== OPERATIONS - FUEL IMPORT LOGS ROUTES ====================

  // Get all fuel import logs for organization with filters
  app.get("/api/operations/fuel-import-logs", authenticateUser, requirePermission('fuel:read'), async (req, res) => {
    try {
      const { startDate, endDate, source, status, limit = '100', offset = '0' } = req.query;
      
      let query = db.select()
        .from(fuelImportLogs)
        .where(eq(fuelImportLogs.orgId, req.user!.orgId))
        .$dynamic();

      // Apply filters
      const conditions = [eq(fuelImportLogs.orgId, req.user!.orgId)];
      
      if (startDate) {
        conditions.push(gte(fuelImportLogs.startedAt, new Date(startDate as string)));
      }
      if (endDate) {
        conditions.push(lte(fuelImportLogs.startedAt, new Date(endDate as string)));
      }
      if (source) {
        conditions.push(eq(fuelImportLogs.source, source as string));
      }
      if (status) {
        conditions.push(eq(fuelImportLogs.status, status as string));
      }

      const logs = await db.select()
        .from(fuelImportLogs)
        .where(and(...conditions))
        .orderBy(desc(fuelImportLogs.startedAt))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));

      res.json(logs);
    } catch (error: any) {
      console.error("Error fetching fuel import logs:", error);
      res.status(500).json({ message: "Failed to fetch fuel import logs" });
    }
  });

  // Get a single fuel import log by ID
  app.get("/api/operations/fuel-import-logs/:id", authenticateUser, async (req, res) => {
    try {
      const [log] = await db.select()
        .from(fuelImportLogs)
        .where(and(
          eq(fuelImportLogs.id, req.params.id),
          eq(fuelImportLogs.orgId, req.user!.orgId)
        ));

      if (!log) {
        return res.status(404).json({ message: "Import log not found" });
      }

      res.json(log);
    } catch (error: any) {
      console.error("Error fetching fuel import log:", error);
      res.status(500).json({ message: "Failed to fetch fuel import log" });
    }
  });

  // Get fuel import logs statistics
  app.get("/api/operations/fuel-import-logs/stats", authenticateUser, async (req, res) => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get all logs from last 30 days
      const logs = await db.select()
        .from(fuelImportLogs)
        .where(and(
          eq(fuelImportLogs.orgId, req.user!.orgId),
          gte(fuelImportLogs.startedAt, thirtyDaysAgo)
        ));

      // Get latest log
      const [latestLog] = await db.select()
        .from(fuelImportLogs)
        .where(eq(fuelImportLogs.orgId, req.user!.orgId))
        .orderBy(desc(fuelImportLogs.startedAt))
        .limit(1);

      const totalImports = logs.length;
      const successfulImports = logs.filter(l => l.status === 'completed').length;
      const successRate = totalImports > 0 ? (successfulImports / totalImports) * 100 : 0;
      const totalRecordsImported = logs.reduce((sum, l) => sum + (l.recordsImported || 0), 0);

      res.json({
        totalImports,
        successRate: Math.round(successRate * 10) / 10,
        totalRecordsImported,
        latestSyncStatus: latestLog?.status || null,
        latestSyncTime: latestLog?.startedAt || null,
      });
    } catch (error: any) {
      console.error("Error fetching fuel import log stats:", error);
      res.status(500).json({ message: "Failed to fetch fuel import log statistics" });
    }
  });

  // ===== Fuel Integrations Routes =====

  app.use("/api/operations/fuel-integrations", authenticateUser, requirePack("operations"));

  // Get organization's fuel integration settings
  app.get("/api/operations/fuel-integrations", requirePermission('fuel:read'), async (req: any, res) => {
    try {
      const integration = await storage.getFuelIntegration(req.user.orgId);
      
      if (!integration) {
        return res.json(null);
      }
      
      res.json(integration);
    } catch (error: any) {
      console.error("Error fetching fuel integration:", error);
      res.status(500).json({ message: "Failed to fetch fuel integration" });
    }
  });

  // Get fuel import logs for org
  app.get("/api/operations/fuel-integrations/import-logs", async (req: any, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const logs = await storage.getFuelImportLogs(req.user.orgId, limit);
      res.json(logs);
    } catch (error: any) {
      console.error("Error fetching fuel import logs:", error);
      res.status(500).json({ message: "Failed to fetch import logs" });
    }
  });

  // Create new fuel integration
  app.post("/api/operations/fuel-integrations", requirePermission('fuel:integration:manage'), async (req: any, res) => {
    try {
      const data = insertFuelIntegrationSchema.parse({
        ...req.body,
        orgId: req.user.orgId
      });

      const existing = await storage.getFuelIntegration(req.user.orgId);
      if (existing) {
        return res.status(400).json({ 
          message: "Integration already exists for this organization. Please update or delete the existing integration first." 
        });
      }

      const integration = await storage.createFuelIntegration(data);

      // Add audit logging using logFuelIntegration
      await AuditService.logFuelIntegration(
        req,
        'create',
        integration.id,
        null,
        integration,
        { provider: integration.provider }
      );

      res.status(201).json(integration);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating fuel integration:", error);
      res.status(500).json({ message: "Failed to create fuel integration" });
    }
  });

  // Update fuel integration settings
  app.patch("/api/operations/fuel-integrations/:id", requirePermission('fuel:integration:manage'), async (req: any, res) => {
    try {
      const integration = await storage.getFuelIntegrationById(req.params.id);
      
      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      }

      if (integration.orgId !== req.user.orgId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updateData = updateFuelIntegrationSchema.parse(req.body);
      const updated = await storage.updateFuelIntegration(req.params.id, updateData);

      if (!updated) {
        return res.status(404).json({ message: "Integration not found" });
      }

      // Add audit logging using logFuelIntegration
      await AuditService.logFuelIntegration(
        req,
        'update',
        updated.id,
        integration,
        updated,
        { provider: updated.provider, modifiedFields: Object.keys(updateData) }
      );

      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error updating fuel integration:", error);
      res.status(500).json({ message: "Failed to update fuel integration" });
    }
  });

  // Delete fuel integration (requires manager approval for non-manager roles)
  app.delete("/api/operations/fuel-integrations/:id", requirePermission('fuel:integration:manage'), requireApprovalCheck('deleteIntegration'), async (req: any, res) => {
    try {
      const integration = await storage.getFuelIntegrationById(req.params.id);
      
      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      }

      if (integration.orgId !== req.user.orgId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const deleted = await storage.deleteFuelIntegration(req.params.id);

      if (!deleted) {
        return res.status(404).json({ message: "Integration not found" });
      }

      // Add audit logging using logFuelIntegration
      await AuditService.logFuelIntegration(
        req,
        'delete',
        integration.id,
        integration,
        null,
        { provider: integration.provider, deletionReason: req.body?.reason || 'Not specified' }
      );

      res.json({ message: "Integration disconnected successfully" });
    } catch (error: any) {
      console.error("Error deleting fuel integration:", error);
      res.status(500).json({ message: "Failed to disconnect integration" });
    }
  });

  // Test fuel integration connection
  app.post("/api/operations/fuel-integrations/:id/test", requirePermission('fuel:integration:manage'), async (req: any, res) => {
    try {
      const integration = await storage.getFuelIntegrationById(req.params.id);
      
      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      }

      if (integration.orgId !== req.user.orgId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const fuelSyncService = new FuelSyncService(storage);
      const result = await fuelSyncService.testConnection(req.params.id);

      res.json({ 
        ...result,
        provider: integration.provider,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Error testing fuel integration:", error);
      res.status(500).json({ 
        success: false,
        message: "Connection test failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Trigger manual sync (requires manager approval for non-manager roles)
  app.post("/api/operations/fuel-integrations/:id/sync", requirePermission('fuel:integration:manage'), requireApprovalCheck('syncIntegration'), async (req: any, res) => {
    try {
      const integration = await storage.getFuelIntegrationById(req.params.id);
      
      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      }

      if (integration.orgId !== req.user.orgId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Add audit logging using logFuelIntegration
      await AuditService.logFuelIntegration(
        req,
        'sync',
        integration.id,
        null,
        null,
        { provider: integration.provider, syncInitiated: true }
      );

      // Start sync asynchronously - don't wait for completion
      const fuelSyncService = new FuelSyncService(storage);
      
      // Run sync in background
      fuelSyncService.syncIntegration(integration.id, req.user.id)
        .then(result => {
        })
        .catch(error => {
          console.error('Sync failed:', error);
        });

      res.json({ 
        success: true,
        message: "Sync initiated successfully. Check Import History for progress."
      });
    } catch (error: any) {
      console.error("Error initiating fuel sync:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to initiate sync",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ===== FRED API Routes (Financial Benchmarks) =====

  // Get current and historical FRED data
  app.get("/api/benchmarks/fred/:seriesId", authenticateUser, async (req: any, res) => {
    try {
      const { seriesId } = req.params;
      const { startDate } = req.query;

      const FRED_API_KEY = process.env.FRED_API_KEY;
      if (!FRED_API_KEY) {
        return res.status(500).json({ error: "FRED API key not configured" });
      }

      const baseUrl = 'https://api.stlouisfed.org/fred';
      const params = new URLSearchParams({
        series_id: seriesId,
        api_key: FRED_API_KEY,
        file_type: 'json',
        sort_order: 'asc'
      });

      if (startDate) {
        params.append('observation_start', startDate);
      }

      const response = await fetch(`${baseUrl}/series/observations?${params}`);
      
      if (!response.ok) {
        throw new Error(`FRED API error: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching FRED data:", error);
      res.status(500).json({ error: "Failed to fetch FRED data" });
    }
  });

  // ===== QuickBooks Export Routes =====

  // Preview QuickBooks export data
  app.post("/api/operations/fuel-sales/export-quickbooks/preview", authenticateUser, requirePermission('fuel:export'), async (req: any, res) => {
    try {
      const { startDate, endDate, accountMappings, format } = req.body;

      if (!startDate || !endDate || !accountMappings) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const sales = await db.select()
        .from(fuelSales)
        .where(
          and(
            eq(fuelSales.orgId, req.user.orgId),
            and(
              gte(fuelSales.transactionDate, new Date(startDate)),
              lte(fuelSales.transactionDate, new Date(endDate + 'T23:59:59'))
            )
          )
        )
        .orderBy(fuelSales.transactionDate);

      const preview = generateQuickBooksPreview(sales, accountMappings, format);
      res.json({ preview: preview.slice(0, 10) });
    } catch (error: any) {
      console.error("Error generating QuickBooks preview:", error);
      res.status(500).json({ error: "Failed to generate preview" });
    }
  });

  // Export QuickBooks CSV
  app.post("/api/operations/fuel-sales/export-quickbooks", authenticateUser, requirePermission('fuel:export'), async (req: any, res) => {
    try {
      const { startDate, endDate, accountMappings, format, saveSettings } = req.body;

      if (!startDate || !endDate || !accountMappings) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const sales = await db.select()
        .from(fuelSales)
        .where(
          and(
            eq(fuelSales.orgId, req.user.orgId),
            and(
              gte(fuelSales.transactionDate, new Date(startDate)),
              lte(fuelSales.transactionDate, new Date(endDate + 'T23:59:59'))
            )
          )
        )
        .orderBy(fuelSales.transactionDate);

      if (sales.length === 0) {
        return res.status(404).json({ error: "No sales data found for the selected date range" });
      }

      if (saveSettings) {
        const existingIntegration = await storage.getFuelIntegration(req.user.orgId);
        
        if (existingIntegration) {
          await storage.updateFuelIntegration(existingIntegration.id, {
            settings: {
              ...existingIntegration.settings,
              accountMappings
            }
          });
        } else {
          await storage.createFuelIntegration({
            orgId: req.user.orgId,
            provider: 'quickbooks',
            isEnabled: true,
            settings: { accountMappings }
          });
        }
      }

      const csv = generateQuickBooksCSV(sales, accountMappings, format);
      const filename = `fuel-sales-quickbooks-${new Date().toISOString().split('T')[0]}.csv`;

      // Audit log the export
      await AuditService.logExport(
        req,
        'quickbooks',
        sales.length,
        { startDate, endDate, format, accountMappings }
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error: any) {
      console.error("Error exporting QuickBooks data:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // ===== Audit Trail Routes =====

  // Get audit logs with filters
  app.get("/api/operations/fuel/audit-logs", authenticateUser, requirePermission('fuel:read', 'audit:read'), async (req: any, res) => {
    try {
      const { 
        entityType, 
        userId, 
        action, 
        startDate, 
        endDate,
        limit = 100,
        offset = 0 
      } = req.query;

      // Validate limit and offset
      const validLimit = Math.min(Math.max(parseInt(limit as string) || 100, 1), 500);
      const validOffset = Math.max(parseInt(offset as string) || 0, 0);

      let query = db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          userId: auditLogs.userId,
          username: users.username,
          userEmail: users.email,
          beforeState: auditLogs.beforeState,
          afterState: auditLogs.afterState,
          metadata: auditLogs.metadata,
          ipAddress: auditLogs.ipAddress,
          timestamp: auditLogs.timestamp,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(eq(auditLogs.orgId, req.user.orgId))
        .orderBy(desc(auditLogs.timestamp))
        .$dynamic();

      // Apply filters
      const conditions = [eq(auditLogs.orgId, req.user.orgId)];
      
      if (entityType) {
        conditions.push(eq(auditLogs.entityType, entityType as string));
      }
      
      if (userId) {
        conditions.push(eq(auditLogs.userId, userId as string));
      }
      
      if (action) {
        conditions.push(eq(auditLogs.action, action as string));
      }
      
      if (startDate) {
        conditions.push(gte(auditLogs.timestamp, new Date(startDate as string)));
      }
      
      if (endDate) {
        const endDateTime = new Date(endDate as string);
        endDateTime.setHours(23, 59, 59, 999);
        conditions.push(lte(auditLogs.timestamp, endDateTime));
      }

      if (conditions.length > 1) {
        query = query.where(and(...conditions));
      }

      const logs = await query
        .limit(validLimit)
        .offset(validOffset);

      // Get total count for pagination
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(auditLogs)
        .where(conditions.length > 1 ? and(...conditions) : conditions[0]);

      res.json({
        logs,
        total: Number(countResult[0]?.count || 0),
        limit: validLimit,
        offset: validOffset,
      });
    } catch (error: any) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // ===== Debt Scenarios Routes (Modeling Module) =====

  // Get all debt scenarios for organization
  app.get("/api/modeling/debt-scenarios", authenticateUser, async (req: any, res) => {
    try {
      const scenarios = await storage.getDebtScenariosForOrg(req.user.orgId);
      res.json(scenarios);
    } catch (error: any) {
      console.error("Failed to fetch debt scenarios:", error);
      res.status(500).json({ error: "Failed to fetch debt scenarios" });
    }
  });

  // Get single debt scenario by ID
  app.get("/api/modeling/debt-scenarios/:id", authenticateUser, async (req: any, res) => {
    try {
      const scenario = await storage.getDebtScenario(req.params.id);
      
      if (!scenario) {
        return res.status(404).json({ error: "Scenario not found" });
      }

      // Verify org ownership
      if (scenario.orgId !== req.user.orgId) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(scenario);
    } catch (error: any) {
      console.error("Failed to fetch debt scenario:", error);
      res.status(500).json({ error: "Failed to fetch debt scenario" });
    }
  });

  // Create new debt scenario
  app.post("/api/modeling/debt-scenarios", authenticateUser, async (req: any, res) => {
    try {
      // Parse and validate request body
      const validatedData = insertDebtScenarioSchema.parse(req.body);

      // Normalize numeric fields (convert strings to numbers)
      const scenarioData = {
        ...validatedData,
        purchasePrice: typeof validatedData.purchasePrice === 'string' 
          ? parseFloat(validatedData.purchasePrice) 
          : validatedData.purchasePrice,
        loanAmount: typeof validatedData.loanAmount === 'string' 
          ? parseFloat(validatedData.loanAmount) 
          : validatedData.loanAmount,
        noi: typeof validatedData.noi === 'string' 
          ? parseFloat(validatedData.noi) 
          : validatedData.noi,
        orgId: req.user.orgId,
        createdBy: req.user.id,
        updatedBy: req.user.id,
      };

      const scenario = await storage.createDebtScenario(scenarioData);

      // Audit logging
      await AuditService.logChange({
        orgId: req.user.orgId,
        userId: req.user.id,
        entityType: 'debt_scenario',
        entityId: scenario.id,
        action: 'created',
        changes: {},
        before: null,
        after: scenario,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json(scenario);
    } catch (error: any) {
      console.error("Failed to create debt scenario:", error);
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid scenario data", details: error });
      }
      res.status(500).json({ error: "Failed to create debt scenario" });
    }
  });

  // Update debt scenario
  app.put("/api/modeling/debt-scenarios/:id", authenticateUser, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Check if scenario exists and belongs to user's org
      const existing = await storage.getDebtScenario(id);
      if (!existing) {
        return res.status(404).json({ error: "Scenario not found" });
      }
      if (existing.orgId !== req.user.orgId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Parse and validate updates
      const validatedData = updateDebtScenarioSchema.parse(req.body);

      // Normalize numeric fields
      const updates: any = { ...validatedData };
      if (updates.purchasePrice !== undefined) {
        updates.purchasePrice = typeof updates.purchasePrice === 'string' 
          ? parseFloat(updates.purchasePrice) 
          : updates.purchasePrice;
      }
      if (updates.loanAmount !== undefined) {
        updates.loanAmount = typeof updates.loanAmount === 'string' 
          ? parseFloat(updates.loanAmount) 
          : updates.loanAmount;
      }
      if (updates.noi !== undefined) {
        updates.noi = typeof updates.noi === 'string' 
          ? parseFloat(updates.noi) 
          : updates.noi;
      }
      updates.updatedBy = req.user.id;

      const updated = await storage.updateDebtScenario(id, updates);

      // Audit logging
      await AuditService.logChange({
        orgId: req.user.orgId,
        userId: req.user.id,
        entityType: 'debt_scenario',
        entityId: id,
        action: 'updated',
        changes: updates,
        before: existing,
        after: updated,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Failed to update debt scenario:", error);
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid scenario data", details: error });
      }
      res.status(500).json({ error: "Failed to update debt scenario" });
    }
  });

  // Delete debt scenario
  app.delete("/api/modeling/debt-scenarios/:id", authenticateUser, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Check if scenario exists and belongs to user's org
      const existing = await storage.getDebtScenario(id);
      if (!existing) {
        return res.status(404).json({ error: "Scenario not found" });
      }
      if (existing.orgId !== req.user.orgId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteDebtScenario(id);

      // Audit logging
      await AuditService.logChange({
        orgId: req.user.orgId,
        userId: req.user.id,
        entityType: 'debt_scenario',
        entityId: id,
        action: 'deleted',
        changes: {},
        before: existing,
        after: null,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete debt scenario:", error);
      res.status(500).json({ error: "Failed to delete debt scenario" });
    }
  });

  // ===== User Role Management Routes =====

  // Get all users in the organization with their current roles
  app.get("/api/operations/fuel/users", authenticateUser, requireRole('owner', 'admin'), async (req: any, res) => {
    try {
      // Get all users in the organization using LEFT JOIN to include users without roles
      // In production, this would query an organization_members table
      // For demo purposes, we'll show all users and their roles if they have them
      const orgUsers = await db
        .select({
          userId: users.id,
          email: users.email,
          username: users.username,
          role: organizationUserRoles.role,
          isActive: organizationUserRoles.isActive,
        })
        .from(users)
        .leftJoin(
          organizationUserRoles, 
          and(
            eq(users.id, organizationUserRoles.userId),
            eq(organizationUserRoles.orgId, req.user.orgId)
          )
        )
        // For demo, show all users. In production, add WHERE clause for org membership
        .orderBy(users.username);

      // Transform to expected format
      const result = orgUsers.map(u => ({
        id: u.userId,
        email: u.email,
        username: u.username,
        currentRole: u.role || null,
        isActive: u.isActive ?? true,
      }));

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching organization users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Update a user's role
  app.patch("/api/operations/fuel/users/:userId/role", authenticateUser, requireRole('owner', 'admin'), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!role || !['owner', 'admin', 'editor', 'viewer', 'auditor'].includes(role)) {
        return res.status(400).json({ error: "Invalid role specified" });
      }

      // Prevent users from changing their own role
      if (userId === req.user.id) {
        return res.status(403).json({ error: "Cannot change your own role" });
      }

      // Verify target user exists and belongs to the organization
      const targetUser = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (targetUser.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get the current role assignment
      const existingRole = await db
        .select()
        .from(organizationUserRoles)
        .where(
          and(
            eq(organizationUserRoles.userId, userId),
            eq(organizationUserRoles.orgId, req.user.orgId)
          )
        )
        .limit(1);

      const oldRole = existingRole.length > 0 ? existingRole[0] : null;
      
      // Security: Admins cannot manage Owners or other Admins
      if (req.user.role === 'admin') {
        // Check if target user is Owner or Admin
        if (oldRole && (oldRole.role === 'owner' || oldRole.role === 'admin')) {
          return res.status(403).json({ 
            error: "Admins cannot modify Owner or Admin roles" 
          });
        }
        
        // Prevent Admins from assigning Owner role
        if (role === 'owner') {
          return res.status(403).json({ 
            error: "Admins cannot assign Owner role" 
          });
        }
      }

      if (existingRole.length > 0) {
        // Update existing role
        await db
          .update(organizationUserRoles)
          .set({
            role: role,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(organizationUserRoles.userId, userId),
              eq(organizationUserRoles.orgId, req.user.orgId)
            )
          );
      } else {
        // Create new role assignment - verify user belongs to organization first
        // In production, this would check organization membership table
        // For now, we'll create the role assignment
        await db.insert(organizationUserRoles).values({
          userId: userId,
          orgId: req.user.orgId,
          role: role,
          isActive: true,
        });
      }

      // Audit log the role change
      await AuditService.logAuditEvent(
        req,
        'role_change',
        'user',
        userId,
        oldRole ? { role: oldRole.role } : null,
        { role },
        { targetUserId: userId, oldRole: oldRole?.role, newRole: role }
      );

      res.json({ success: true, message: "Role updated successfully" });
    } catch (error: any) {
      console.error("Error updating user role:", error);
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  // ============================================================================
  // DATA IMPORT WIZARD ROUTES
  // ============================================================================

  // Configure multer for import wizard file uploads
  const importWizardUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
      const allowedMimes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(csv|xls|xlsx)$/)) {
        cb(null, true);
      } else {
        cb(new Error('Only CSV and Excel files are allowed'));
      }
    },
  });

  // Parse uploaded file and return headers, sample rows, and suggested mappings
  app.post('/api/import/parse', importWizardUpload.single('file'), validateFileUpload({ maxSize: 25 * 1024 * 1024 }), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const targetModule = req.body.targetModule as 'salesComps' | 'rateComps' | 'marinaDatabase';
      const fileBuffer = req.file.buffer;
      const fileName = req.file.originalname.toLowerCase();

      let headers: string[] = [];
      let rows: Record<string, any>[] = [];

      // Parse based on file type
      if (fileName.endsWith('.csv')) {
        const content = fileBuffer.toString('utf-8');
        const lines = content.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length > 0) {
          headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
          
          for (let i = 1; i < lines.length && rows.length < 1000; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            const row: Record<string, any> = {};
            headers.forEach((header, idx) => {
              row[header] = values[idx] || '';
            });
            rows.push(row);
          }
        }
      } else {
        // Excel parsing using xlsx package
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
        
        if (jsonData.length > 0) {
          headers = jsonData[0].map((h: any) => String(h || '').trim());
          
          for (let i = 1; i < jsonData.length && rows.length < 1000; i++) {
            const row: Record<string, any> = {};
            headers.forEach((header, idx) => {
              row[header] = String(jsonData[i][idx] ?? '');
            });
            rows.push(row);
          }
        }
      }

      // Detect column types based on sample values
      const columnTypes: Record<string, string> = {};
      for (const header of headers) {
        const sampleValues = rows.slice(0, 10).map(r => r[header]).filter(Boolean);
        
        if (sampleValues.every(v => /^\d{4}-\d{2}-\d{2}/.test(String(v)) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(String(v)))) {
          columnTypes[header] = 'date';
        } else if (sampleValues.every(v => /^\$?[\d,]+\.?\d*$/.test(String(v).replace(/,/g, '')))) {
          columnTypes[header] = 'currency';
        } else if (sampleValues.every(v => /^\d+\.?\d*%?$/.test(String(v)))) {
          columnTypes[header] = 'number';
        } else {
          columnTypes[header] = 'text';
        }
      }

      // Generate suggested mappings based on header names
      const suggestedMappings = generateSuggestedMappings(headers, targetModule);

      res.json({
        headers,
        rows,
        rowCount: rows.length,
        columnTypes,
        suggestedMappings,
      });
    } catch (error: any) {
      console.error('Error parsing import file:', error);
      res.status(500).json({ error: 'Failed to parse file' });
    }
  });

  // Check for potential conflicts/matches with existing records
  app.post('/api/import/check-conflicts', async (req: any, res) => {
    try {
      const { targetModule, mappings, rows } = req.body;
      const orgId = req.user?.orgId;
      
      const conflicts: Array<{
        rowIndex: number;
        sourceData: Record<string, any>;
        existingRecord: Record<string, any> | null;
        matchField: string;
        matchValue: string;
        action: 'skip' | 'update' | 'add';
      }> = [];

      // Find the marina/name field mapping
      const nameMapping = mappings.find((m: any) => m.targetField === 'marina' || m.targetField === 'name');
      if (!nameMapping) {
        return res.json({ conflicts: [] });
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const marinaName = row[nameMapping.sourceColumn];
        
        if (!marinaName) continue;

        let existingRecord = null;
        
        // Check for existing records based on target module
        if (targetModule === 'salesComps') {
          const existing = await storage.getSalesCompsByMarinaName(orgId, marinaName);
          if (existing.length > 0) {
            existingRecord = existing[0];
          }
        } else if (targetModule === 'rateComps') {
          const existing = await storage.getRateCompsByMarinaName(orgId, marinaName);
          if (existing.length > 0) {
            existingRecord = existing[0];
          }
        } else if (targetModule === 'marinaDatabase') {
          const existing = await storage.getMarinasByName(orgId, marinaName);
          if (existing.length > 0) {
            existingRecord = existing[0];
          }
        }

        if (existingRecord) {
          conflicts.push({
            rowIndex: i,
            sourceData: row,
            existingRecord,
            matchField: nameMapping.targetField,
            matchValue: marinaName,
            action: 'update', // Default to update
          });
        }
      }

      res.json({ conflicts });
    } catch (error: any) {
      console.error('Error checking conflicts:', error);
      res.status(500).json({ error: 'Failed to check conflicts' });
    }
  });

  // Execute the import
  app.post('/api/import/execute', async (req: any, res) => {
    try {
      const { targetModule, mappings, rows, conflicts } = req.body;
      const orgId = req.user?.orgId;
      const userId = req.user?.id;

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      let errors = 0;

      // Build conflict action map for quick lookup
      const conflictActions = new Map<number, string>();
      for (const conflict of (conflicts || [])) {
        conflictActions.set(conflict.rowIndex, conflict.action);
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const action = conflictActions.get(i) || 'add';

        if (action === 'skip') {
          skipped++;
          continue;
        }

        try {
          // Transform row data according to mappings
          const transformedData: Record<string, any> = {
            organizationId: orgId,
          };

          // Field name mapping: convert user-friendly names to database column names
          const fieldNameMap: Record<string, string> = {
            sellerCompany: 'seller',
            sellerPrincipal: 'owner',
            buyerCompany: 'company',
            buyerPrincipal: 'buyer',
          };

          for (const mapping of mappings) {
            const value = row[mapping.sourceColumn];
            if (value !== undefined && value !== '') {
              // Convert field name if mapping exists, otherwise use as-is
              const dbFieldName = fieldNameMap[mapping.targetField] || mapping.targetField;
              transformedData[dbFieldName] = transformValue(value, mapping.targetField);
            }
          }

          // Execute import based on target module
          if (targetModule === 'salesComps') {
            if (action === 'update') {
              const conflict = conflicts?.find((c: any) => c.rowIndex === i);
              if (conflict?.existingRecord?.id) {
                await storage.updateSalesComp(conflict.existingRecord.id, transformedData);
                updated++;
              }
            } else {
              await storage.createSalesComp(transformedData);
              imported++;
            }
          } else if (targetModule === 'rateComps') {
            if (action === 'update') {
              const conflict = conflicts?.find((c: any) => c.rowIndex === i);
              if (conflict?.existingRecord?.id) {
                await storage.updateRateComp(conflict.existingRecord.id, transformedData);
                updated++;
              }
            } else {
              await storage.createRateComp(transformedData);
              imported++;
            }
          } else if (targetModule === 'marinaDatabase') {
            if (action === 'update') {
              const conflict = conflicts?.find((c: any) => c.rowIndex === i);
              if (conflict?.existingRecord?.id) {
                await storage.updateMarinaRate(conflict.existingRecord.id, transformedData);
                updated++;
              }
            } else {
              await storage.createMarinaRate(transformedData);
              imported++;
            }
          }
        } catch (rowError) {
          console.error(`Error importing row ${i}:`, rowError);
          errors++;
        }
      }

      res.json({
        imported,
        updated,
        skipped,
        errors,
        total: rows.length,
      });
    } catch (error: any) {
      console.error('Error executing import:', error);
      res.status(500).json({ error: 'Failed to execute import' });
    }
  });

}
