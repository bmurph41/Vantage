/**
 * Seed data for Payroll module — Marina templates
 * Run after migration; requires an org_id parameter.
 */

import { db } from "../server/db";
import {
  payrollDepartments,
  payrollPositions,
  payrollBurdenProfiles,
  seasonalityTemplates,
  pnlCategories,
  pnlLineItems,
} from "../shared/payroll-schema";

export async function seedPayrollDefaults(orgId: string) {
  // ─── DEPARTMENTS ──────────────────────────────────────────────────────────
  const deptData = [
    { name: "Marina Operations", code: "MARINA-OPS", sortOrder: 1 },
    { name: "Fuel Dock", code: "FUEL", sortOrder: 2 },
    { name: "Ship Store / Retail", code: "STORE", sortOrder: 3 },
    { name: "Service / Repair", code: "SERVICE", sortOrder: 4 },
    { name: "Maintenance", code: "MAINT", sortOrder: 5 },
    { name: "Administration", code: "ADMIN", sortOrder: 6 },
    { name: "Management", code: "MGMT", sortOrder: 7 },
    { name: "Food & Beverage", code: "FNB", sortOrder: 8 },
    { name: "Seasonal / Temp", code: "SEASONAL", sortOrder: 9 },
  ];

  const insertedDepts = await db
    .insert(payrollDepartments)
    .values(deptData.map((d) => ({ ...d, orgId })))
    .returning();

  const deptMap = Object.fromEntries(insertedDepts.map((d) => [d.code, d.id]));

  // ─── POSITION TEMPLATES ──────────────────────────────────────────────────
  const positions = [
    { title: "General Manager", roleGroup: "MGMT" as const, deptCode: "MGMT" },
    { title: "Assistant General Manager", roleGroup: "MGMT" as const, deptCode: "MGMT" },
    { title: "Harbormaster", roleGroup: "OPS" as const, deptCode: "MARINA-OPS" },
    { title: "Assistant Harbormaster", roleGroup: "OPS" as const, deptCode: "MARINA-OPS" },
    { title: "Dockhand", roleGroup: "OPS" as const, deptCode: "MARINA-OPS" },
    { title: "Dockhand (Seasonal)", roleGroup: "SEASONAL" as const, deptCode: "SEASONAL" },
    { title: "Fuel Dock Attendant", roleGroup: "OPS" as const, deptCode: "FUEL" },
    { title: "Ship Store Associate", roleGroup: "OPS" as const, deptCode: "STORE" },
    { title: "Ship Store Manager", roleGroup: "MGMT" as const, deptCode: "STORE" },
    { title: "Service Technician", roleGroup: "MAINT" as const, deptCode: "SERVICE" },
    { title: "Lead Service Technician", roleGroup: "MAINT" as const, deptCode: "SERVICE" },
    { title: "Maintenance Technician", roleGroup: "MAINT" as const, deptCode: "MAINT" },
    { title: "Office Administrator", roleGroup: "ADMIN" as const, deptCode: "ADMIN" },
    { title: "Bookkeeper / Accountant", roleGroup: "ADMIN" as const, deptCode: "ADMIN" },
    { title: "Receptionist", roleGroup: "ADMIN" as const, deptCode: "ADMIN" },
  ];

  await db.insert(payrollPositions).values(
    positions.map((p) => ({
      orgId,
      title: p.title,
      defaultDepartmentId: deptMap[p.deptCode] ?? null,
      roleGroup: p.roleGroup,
      isTemplate: true,
      assetClass: "marina" as const,
    }))
  );

  // ─── DEFAULT BURDEN PROFILE ──────────────────────────────────────────────
  await db.insert(payrollBurdenProfiles).values({
    orgId,
    name: "Standard Marina Burden (Simple)",
    mode: "SIMPLE_PCT",
    benefitsPct: "0.15", // 15%
    taxesPct: "0.0765", // 7.65% employer FICA
    workersCompPct: "0.02", // 2%
    otherBurdenPct: "0.01", // 1% (SUTA, etc.)
    isDefault: true,
  });

  // ─── SEASONALITY TEMPLATES ───────────────────────────────────────────────
  // 52 weeks: weeks 1-13 winter, 14-21 shoulder spring, 22-39 summer, 40-47 shoulder fall, 48-52 winter
  const summerHigh = Array.from({ length: 52 }, (_, i) => {
    const wk = i + 1;
    if (wk <= 13 || wk >= 48) return 20; // winter: 20 hrs
    if ((wk >= 14 && wk <= 21) || (wk >= 40 && wk <= 47)) return 32; // shoulder
    return 45; // summer peak
  });

  const fullYear = Array.from({ length: 52 }, () => 40);

  const winterLow = Array.from({ length: 52 }, (_, i) => {
    const wk = i + 1;
    if (wk <= 13 || wk >= 48) return 40;
    if ((wk >= 14 && wk <= 21) || (wk >= 40 && wk <= 47)) return 32;
    return 20;
  });

  await db.insert(seasonalityTemplates).values([
    {
      orgId,
      name: "Marina Summer Peak (Seasonal Staff)",
      seasonType: "SUMMER_HIGH" as const,
      weeklyHoursPattern: summerHigh,
      description:
        "Peak hours May-Sep (45h), shoulder spring/fall (32h), winter (20h). Typical for seasonal dockhands.",
    },
    {
      orgId,
      name: "Full-Year Staff (40h/wk)",
      seasonType: "CUSTOM" as const,
      weeklyHoursPattern: fullYear,
      description: "Year-round 40 hours/week for salaried or full-time hourly staff.",
    },
    {
      orgId,
      name: "Winter Heavy (Maintenance)",
      seasonType: "WINTER_LOW" as const,
      weeklyHoursPattern: winterLow,
      description:
        "Heavier hours in winter for haul-out and maintenance, lighter in summer when docks are full.",
    },
  ]);

  // ─── P&L CATEGORY SEED (MARINA) ─────────────────────────────────────────
  const categories = [
    // Revenue
    { section: "REVENUE" as const, name: "Wet Slip Revenue", order: 1 },
    { section: "REVENUE" as const, name: "Dry Storage Revenue", order: 2 },
    { section: "REVENUE" as const, name: "Fuel Sales", order: 3 },
    { section: "REVENUE" as const, name: "Ship Store Revenue", order: 4 },
    { section: "REVENUE" as const, name: "Service / Repair Revenue", order: 5 },
    { section: "REVENUE" as const, name: "Transient Dockage", order: 6 },
    { section: "REVENUE" as const, name: "Winter Storage", order: 7 },
    { section: "REVENUE" as const, name: "Other Revenue", order: 8 },
    // COGS
    { section: "COGS" as const, name: "Fuel Cost", order: 1 },
    { section: "COGS" as const, name: "Ship Store COGS", order: 2 },
    { section: "COGS" as const, name: "Service Parts / Materials", order: 3 },
    { section: "COGS" as const, name: "F&B COGS", order: 4 },
    // OpEx
    { section: "OPEX" as const, name: "Payroll & Benefits", order: 1 },
    { section: "OPEX" as const, name: "Utilities", order: 2 },
    { section: "OPEX" as const, name: "Insurance", order: 3 },
    { section: "OPEX" as const, name: "Property Taxes", order: 4 },
    { section: "OPEX" as const, name: "Repairs & Maintenance", order: 5 },
    { section: "OPEX" as const, name: "Marketing", order: 6 },
    { section: "OPEX" as const, name: "Professional Fees", order: 7 },
    { section: "OPEX" as const, name: "Office / Admin", order: 8 },
    { section: "OPEX" as const, name: "Dredging", order: 9 },
    { section: "OPEX" as const, name: "Environmental / Compliance", order: 10 },
    { section: "OPEX" as const, name: "Other Operating Expense", order: 11 },
  ];

  await db.insert(pnlCategories).values(
    categories.map((c) => ({
      orgId,
      statementSection: c.section,
      categoryName: c.name,
      sortOrder: c.order,
    }))
  );

  console.log(`✅ Payroll seed data created for org ${orgId}`);
}

seedPayrollDefaults("cd3719c3-ef82-4ccc-acb9-261c80fb64b4").then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
