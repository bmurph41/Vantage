import { Router } from "express";
import { archiveService, ArchiveReason } from "../services/crm/archive-service";

const router = Router();

router.get("/archived-contacts", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { search, salesCompId, limit, offset } = req.query;
    const contacts = await archiveService.getArchivedContacts(user.orgId, {
      search: search as string,
      salesCompId: salesCompId as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json(contacts);
  } catch (error: any) {
    console.error("Error fetching archived contacts:", error);
    res.status(500).json({ error: error.message || "Failed to fetch archived contacts" });
  }
});

router.get("/archived-contacts/:id", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const contact = await archiveService.getArchivedContactById(req.params.id, user.orgId);
    if (!contact) {
      return res.status(404).json({ error: "Archived contact not found" });
    }

    res.json(contact);
  } catch (error: any) {
    console.error("Error fetching archived contact:", error);
    res.status(500).json({ error: error.message || "Failed to fetch archived contact" });
  }
});

router.get("/archived-contacts/:id/properties", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const properties = await archiveService.getArchivePropertyAssociations(
      user.orgId,
      req.params.id,
      'contact'
    );

    res.json(properties);
  } catch (error: any) {
    console.error("Error fetching archived contact properties:", error);
    res.status(500).json({ error: error.message || "Failed to fetch properties" });
  }
});

router.post("/archived-contacts/:id/restore", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId || !user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await archiveService.restoreContact(req.params.id, user.orgId, user.id);
    res.json(result);
  } catch (error: any) {
    console.error("Error restoring contact:", error);
    res.status(500).json({ error: error.message || "Failed to restore contact" });
  }
});

router.get("/archived-companies", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { search, salesCompId, limit, offset } = req.query;
    const companies = await archiveService.getArchivedCompanies(user.orgId, {
      search: search as string,
      salesCompId: salesCompId as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json(companies);
  } catch (error: any) {
    console.error("Error fetching archived companies:", error);
    res.status(500).json({ error: error.message || "Failed to fetch archived companies" });
  }
});

router.get("/archived-companies/:id", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const company = await archiveService.getArchivedCompanyById(req.params.id, user.orgId);
    if (!company) {
      return res.status(404).json({ error: "Archived company not found" });
    }

    res.json(company);
  } catch (error: any) {
    console.error("Error fetching archived company:", error);
    res.status(500).json({ error: error.message || "Failed to fetch archived company" });
  }
});

router.get("/archived-companies/:id/properties", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const properties = await archiveService.getArchivePropertyAssociations(
      user.orgId,
      req.params.id,
      'company'
    );

    res.json(properties);
  } catch (error: any) {
    console.error("Error fetching archived company properties:", error);
    res.status(500).json({ error: error.message || "Failed to fetch properties" });
  }
});

router.post("/archived-companies/:id/restore", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId || !user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await archiveService.restoreCompany(req.params.id, user.orgId, user.id);
    res.json(result);
  } catch (error: any) {
    console.error("Error restoring company:", error);
    res.status(500).json({ error: error.message || "Failed to restore company" });
  }
});

router.post("/contacts/:id/archive", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId || !user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { archiveReason, archiveNotes, salesCompId, saleDate, deleteOriginal } = req.body;

    const archived = await archiveService.archiveContact({
      contactId: req.params.id,
      orgId: user.orgId,
      userId: user.id,
      archiveReason: archiveReason as ArchiveReason || "property_sold",
      archiveNotes,
      salesCompId,
      saleDate: saleDate ? new Date(saleDate) : undefined,
      deleteOriginal: deleteOriginal !== false,
    });

    res.json(archived);
  } catch (error: any) {
    console.error("Error archiving contact:", error);
    res.status(500).json({ error: error.message || "Failed to archive contact" });
  }
});

router.post("/companies/:id/archive", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId || !user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { archiveReason, archiveNotes, salesCompId, saleDate, deleteOriginal } = req.body;

    const archived = await archiveService.archiveCompany({
      companyId: req.params.id,
      orgId: user.orgId,
      userId: user.id,
      archiveReason: archiveReason as ArchiveReason || "property_sold",
      archiveNotes,
      salesCompId,
      saleDate: saleDate ? new Date(saleDate) : undefined,
      deleteOriginal: deleteOriginal !== false,
    });

    res.json(archived);
  } catch (error: any) {
    console.error("Error archiving company:", error);
    res.status(500).json({ error: error.message || "Failed to archive company" });
  }
});

router.get("/sales-comps/:id/archive-check", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await archiveService.checkSalesCompForArchiveCandidates(req.params.id, user.orgId);
    if (!result) {
      return res.status(404).json({ error: "Sales comp not found" });
    }

    res.json(result);
  } catch (error: any) {
    console.error("Error checking sales comp for archive:", error);
    res.status(500).json({ error: error.message || "Failed to check for archive candidates" });
  }
});

router.post("/sales-comps/:id/archive-seller", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.orgId || !user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { archiveContact, archiveCompany, archiveNotes } = req.body;

    const archiveCheck = await archiveService.checkSalesCompForArchiveCandidates(req.params.id, user.orgId);
    if (!archiveCheck) {
      return res.status(404).json({ error: "Sales comp not found" });
    }

    const results: { archivedContact?: any; archivedCompany?: any } = {};

    if (archiveContact && archiveCheck.sellerContactId) {
      results.archivedContact = await archiveService.archiveContact({
        contactId: archiveCheck.sellerContactId,
        orgId: user.orgId,
        userId: user.id,
        archiveReason: "property_sold",
        archiveNotes,
        salesCompId: req.params.id,
        saleDate: archiveCheck.saleDate || undefined,
      });
    }

    if (archiveCompany && archiveCheck.sellerCompanyId) {
      results.archivedCompany = await archiveService.archiveCompany({
        companyId: archiveCheck.sellerCompanyId,
        orgId: user.orgId,
        userId: user.id,
        archiveReason: "property_sold",
        archiveNotes,
        salesCompId: req.params.id,
        saleDate: archiveCheck.saleDate || undefined,
      });
    }

    res.json(results);
  } catch (error: any) {
    console.error("Error archiving seller from sales comp:", error);
    res.status(500).json({ error: error.message || "Failed to archive seller" });
  }
});

export default router;
