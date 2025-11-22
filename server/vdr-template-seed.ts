import { db } from "./db";
import { vdrTemplates, vdrTemplateFolders } from "@shared/schema";
import { eq } from "drizzle-orm";

// Default real estate deal folder structure
export async function seedDefaultVdrTemplates() {

  // Check if template already exists
  const existing = await db.select().from(vdrTemplates).where(
    eq(vdrTemplates.name, "Standard Real Estate DD")
  );

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Create the template
  const [template] = await db.insert(vdrTemplates).values({
    name: "Standard Real Estate DD",
    description: "Standard folder structure for marina and real estate due diligence",
    category: "real_estate",
    isDefault: true,
    isPublic: true,
    orgId: null, // System template
    createdBy: null,
  }).returning();


  // Define folder structure with hierarchy
  const folderDefinitions = [
    // Top level folders
    { name: "1. Financials", order: 1, parent: null, desc: "Financial statements, rent rolls, and operating data" },
    { name: "2. Legal", order: 2, parent: null, desc: "Contracts, leases, and legal documents" },
    { name: "3. Title", order: 3, parent: null, desc: "Title commitments, surveys, and easements" },
    { name: "4. Environmental", order: 4, parent: null, desc: "Phase I/II ESAs and environmental reports" },
    { name: "5. Property Information", order: 5, parent: null, desc: "Property details, permits, and specifications" },
    { name: "6. Insurance", order: 6, parent: null, desc: "Insurance policies and certificates" },
    { name: "7. Third Party Reports", order: 7, parent: null, desc: "Appraisals, inspections, and other reports" },
    { name: "8. Closing Documents", order: 8, parent: null, desc: "Purchase agreement and closing materials" },
    
    // Financials subfolders
    { name: "Historical Financials", order: 1, parent: "1. Financials" },
    { name: "Rent Rolls", order: 2, parent: "1. Financials" },
    { name: "Operating Budgets", order: 3, parent: "1. Financials" },
    { name: "Tax Returns", order: 4, parent: "1. Financials" },
    { name: "Cap Ex History", order: 5, parent: "1. Financials" },
    
    // Legal subfolders
    { name: "PSA & Amendments", order: 1, parent: "2. Legal" },
    { name: "Leases", order: 2, parent: "2. Legal" },
    { name: "Contracts & Agreements", order: 3, parent: "2. Legal" },
    { name: "Litigation", order: 4, parent: "2. Legal" },
    
    // Title subfolders
    { name: "Title Commitment", order: 1, parent: "3. Title" },
    { name: "Survey", order: 2, parent: "3. Title" },
    { name: "Easements", order: 3, parent: "3. Title" },
    { name: "Encumbrances", order: 4, parent: "3. Title" },
    
    // Environmental subfolders
    { name: "Phase I ESA", order: 1, parent: "4. Environmental" },
    { name: "Phase II ESA", order: 2, parent: "4. Environmental" },
    { name: "Environmental Permits", order: 3, parent: "4. Environmental" },
    
    // Property Information subfolders
    { name: "Property Details", order: 1, parent: "5. Property Information" },
    { name: "Permits & Licenses", order: 2, parent: "5. Property Information" },
    { name: "Zoning", order: 3, parent: "5. Property Information" },
    { name: "Building Plans", order: 4, parent: "5. Property Information" },
    { name: "Equipment List", order: 5, parent: "5. Property Information" },
    
    // Third Party Reports subfolders
    { name: "Appraisal", order: 1, parent: "7. Third Party Reports" },
    { name: "Property Inspection", order: 2, parent: "7. Third Party Reports" },
    { name: "Engineering Reports", order: 3, parent: "7. Third Party Reports" },
    { name: "Market Study", order: 4, parent: "7. Third Party Reports" },
  ];

  // Create folders with hierarchy
  const folderMap: Record<string, string> = {};

  // First pass: create root folders
  for (const def of folderDefinitions.filter(f => f.parent === null)) {
    const [folder] = await db.insert(vdrTemplateFolders).values({
      templateId: template.id,
      name: def.name,
      parentFolderId: null,
      displayOrder: def.order,
      description: def.desc || null,
    }).returning();
    
    folderMap[def.name] = folder.id;
  }

  // Second pass: create subfolders
  for (const def of folderDefinitions.filter(f => f.parent !== null)) {
    const parentId = folderMap[def.parent!];
    if (!parentId) {
      continue;
    }

    const [folder] = await db.insert(vdrTemplateFolders).values({
      templateId: template.id,
      name: def.name,
      parentFolderId: parentId,
      displayOrder: def.order,
      description: null,
    }).returning();
    
  }

  return template.id;
}
