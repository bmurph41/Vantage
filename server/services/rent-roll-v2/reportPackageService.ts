import { db } from "../../db";
import { eq, and, desc } from "drizzle-orm";
import {
  reportPackages,
  reportPackageSections,
  marinaLocations,
  InsertReportPackage,
  InsertReportPackageSection,
  ReportPackage,
  ReportPackageSection,
} from "@shared/schema";
import { format } from "date-fns";

export interface ReportPackageSummary {
  id: string;
  name: string;
  description: string | null;
  packageType: string;
  status: string;
  projectId: string | null;
  projectName: string | null;
  periodStartDate: string;
  periodEndDate: string;
  asOfDate: string | null;
  createdAt: Date;
  generatedAt: Date | null;
}

export interface ReportPackageWithSections extends ReportPackage {
  sections: ReportPackageSection[];
  projectName?: string | null;
}

export const DEFAULT_SECTIONS = [
  { type: "executive_summary", title: "Executive Summary", order: 1 },
  { type: "portfolio_overview", title: "Portfolio Overview", order: 2 },
  { type: "rent_roll", title: "Rent Roll", order: 3 },
  { type: "occupancy_analysis", title: "Occupancy Analysis", order: 4 },
  { type: "revenue_analysis", title: "Revenue Analysis", order: 5 },
  { type: "cash_flow_projection", title: "Cash Flow Projection", order: 6 },
  { type: "tenant_analysis", title: "Tenant Analysis", order: 7 },
  { type: "variance_analysis", title: "Budget vs. Actual Variance", order: 8 },
];

export class ReportPackageService {
  async createReportPackage(data: InsertReportPackage, userId: string): Promise<ReportPackage> {
    const [pkg] = await db.insert(reportPackages).values({
      ...data,
      createdBy: userId,
    }).returning();

    await this.initializeDefaultSections(pkg.id);

    return pkg;
  }

  private async initializeDefaultSections(reportPackageId: string): Promise<void> {
    const sections = DEFAULT_SECTIONS.map((section) => ({
      reportPackageId,
      sectionType: section.type,
      sectionOrder: section.order,
      title: section.title,
      isIncluded: true,
    }));

    await db.insert(reportPackageSections).values(sections);
  }

  async getReportPackages(organizationId: string, projectId?: string): Promise<ReportPackageSummary[]> {
    let query = db
      .select({
        id: reportPackages.id,
        name: reportPackages.name,
        description: reportPackages.description,
        packageType: reportPackages.packageType,
        status: reportPackages.status,
        projectId: reportPackages.projectId,
        projectName: marinaLocations.name,
        periodStartDate: reportPackages.periodStartDate,
        periodEndDate: reportPackages.periodEndDate,
        asOfDate: reportPackages.asOfDate,
        createdAt: reportPackages.createdAt,
        generatedAt: reportPackages.generatedAt,
      })
      .from(reportPackages)
      .leftJoin(marinaLocations, eq(reportPackages.projectId, marinaLocations.id))
      .where(
        projectId
          ? and(eq(reportPackages.organizationId, organizationId), eq(reportPackages.projectId, projectId))
          : eq(reportPackages.organizationId, organizationId)
      )
      .orderBy(desc(reportPackages.createdAt));

    return query;
  }

  async getReportPackageById(id: string, organizationId: string): Promise<ReportPackageWithSections | null> {
    const [pkg] = await db
      .select({
        package: reportPackages,
        projectName: marinaLocations.name,
      })
      .from(reportPackages)
      .leftJoin(marinaLocations, eq(reportPackages.projectId, marinaLocations.id))
      .where(
        and(
          eq(reportPackages.id, id),
          eq(reportPackages.organizationId, organizationId)
        )
      );

    if (!pkg) return null;

    const sections = await db
      .select()
      .from(reportPackageSections)
      .where(eq(reportPackageSections.reportPackageId, id))
      .orderBy(reportPackageSections.sectionOrder);

    return {
      ...pkg.package,
      projectName: pkg.projectName,
      sections,
    };
  }

  async updateReportPackage(id: string, organizationId: string, data: Partial<InsertReportPackage>): Promise<ReportPackage | null> {
    const [updated] = await db
      .update(reportPackages)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(reportPackages.id, id),
          eq(reportPackages.organizationId, organizationId)
        )
      )
      .returning();

    return updated || null;
  }

  async deleteReportPackage(id: string, organizationId: string): Promise<boolean> {
    const [pkg] = await db
      .select()
      .from(reportPackages)
      .where(
        and(
          eq(reportPackages.id, id),
          eq(reportPackages.organizationId, organizationId)
        )
      );

    if (!pkg) return false;

    if (pkg.status !== "draft") {
      throw new Error("Only draft report packages can be deleted");
    }

    await db.delete(reportPackages).where(eq(reportPackages.id, id));
    return true;
  }

  async updateSection(
    sectionId: string,
    reportPackageId: string,
    organizationId: string,
    data: Partial<InsertReportPackageSection>
  ): Promise<ReportPackageSection | null> {
    const [pkg] = await db
      .select()
      .from(reportPackages)
      .where(
        and(
          eq(reportPackages.id, reportPackageId),
          eq(reportPackages.organizationId, organizationId)
        )
      );

    if (!pkg) return null;

    const [updated] = await db
      .update(reportPackageSections)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(reportPackageSections.id, sectionId),
          eq(reportPackageSections.reportPackageId, reportPackageId)
        )
      )
      .returning();

    return updated || null;
  }

  async generateReport(id: string, organizationId: string): Promise<ReportPackage | null> {
    const [pkg] = await db
      .update(reportPackages)
      .set({
        status: "generating",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(reportPackages.id, id),
          eq(reportPackages.organizationId, organizationId)
        )
      )
      .returning();

    if (!pkg) return null;

    try {
      const [updated] = await db
        .update(reportPackages)
        .set({
          status: "ready",
          generatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(reportPackages.id, id))
        .returning();

      return updated;
    } catch (error) {
      await db
        .update(reportPackages)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(reportPackages.id, id));

      throw error;
    }
  }

  async archiveReportPackage(id: string, organizationId: string): Promise<ReportPackage | null> {
    const [updated] = await db
      .update(reportPackages)
      .set({
        status: "archived",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(reportPackages.id, id),
          eq(reportPackages.organizationId, organizationId)
        )
      )
      .returning();

    return updated || null;
  }
}

export const reportPackageService = new ReportPackageService();
