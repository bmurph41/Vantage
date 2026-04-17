/**
 * LP / Investor Portal schema
 *
 * Tables in this file are used by the LP portal service and associated routes
 * for investor access, statements, distributions, and KYC.
 *
 * Promoted from db/schema-orphan-tables.ts — these are confirmed active tables.
 */

import {
  pgTable,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  date,
  numeric,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const distributionApprovals = pgTable("distribution_approvals", {
  id: varchar("id").primaryKey(),
  orgId: varchar("org_id"),
  fundId: varchar("fund_id"),
  status: varchar("status"),
  totalProceeds: numeric("total_proceeds"),
  distributionType: varchar("distribution_type"),
  dealAllocationId: varchar("deal_allocation_id"),
  notes: text("notes"),
  yearsHeld: numeric("years_held"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at"),
  submittedForApprovalAt: timestamp("submitted_for_approval_at"),
  submittedBy: varchar("submitted_by"),
  approvalsJson: jsonb("approvals_json"),
  requiredApprovals: integer("required_approvals"),
  rejectedBy: varchar("rejected_by"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  executedAt: timestamp("executed_at"),
  executedBy: varchar("executed_by"),
  waterfallResult: jsonb("waterfall_result"),
  investorAllocations: jsonb("investor_allocations"),
});

export const investorLetterTemplates = pgTable("investor_letter_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  name: varchar("name"),
  templateType: varchar("template_type"),
  subject: text("subject"),
  bodyTemplate: text("body_template"),
  tokens: jsonb("tokens"),
  isDefault: boolean("is_default"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at"),
});

export const kpiDashboards = pgTable("kpi_dashboards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  name: varchar("name"),
  description: text("description"),
  widgets: jsonb("widgets"),
  layout: jsonb("layout"),
  isDefault: boolean("is_default"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const kycVerifications = pgTable("kyc_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  investorId: varchar("investor_id"),
  verificationType: varchar("verification_type"),
  status: varchar("status"),
  provider: varchar("provider"),
  providerReference: varchar("provider_reference"),
  verificationData: jsonb("verification_data"),
  verifiedAt: timestamp("verified_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at"),
});

export const loanPackages = pgTable("loan_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  dealId: varchar("deal_id"),
  dealName: varchar("deal_name"),
  lenderName: varchar("lender_name"),
  packageType: varchar("package_type"),
  documents: jsonb("documents"),
  status: varchar("status"),
  submittedAt: timestamp("submitted_at"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const lpPortalSessions = pgTable("lp_portal_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  sessionHash: varchar("session_hash"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at"),
});

export const lpPortalUsers = pgTable("lp_portal_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  investorId: varchar("investor_id"),
  email: varchar("email"),
  name: varchar("name"),
  passwordHash: varchar("password_hash"),
  inviteTokenHash: varchar("invite_token_hash"),
  mfaEnabled: boolean("mfa_enabled"),
  mfaSecret: varchar("mfa_secret"),
  lastLogin: timestamp("last_login"),
  status: varchar("status"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const lpStatements = pgTable("lp_statements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  fundId: varchar("fund_id"),
  investorId: varchar("investor_id"),
  statementType: varchar("statement_type"),
  periodLabel: varchar("period_label"),
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  data: jsonb("data"),
  pdfUrl: text("pdf_url"),
  generatedAt: timestamp("generated_at"),
  deliveredAt: timestamp("delivered_at"),
  deliveryMethod: varchar("delivery_method"),
});
