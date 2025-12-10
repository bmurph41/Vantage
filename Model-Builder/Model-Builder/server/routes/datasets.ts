import { Router } from "express";
import { storage } from "../storage";
import { insertDatasetSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import multer from "multer";
import * as XLSX from "xlsx";

const router = Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/csv',
    ];
    const ext = file.originalname.toLowerCase();
    if (allowedTypes.includes(file.mimetype) || ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'));
    }
  }
});

router.get("/project/:projectId", async (req, res) => {
  try {
    const datasets = await storage.getDatasetsByProjectId(req.params.projectId);
    res.json(datasets);
  } catch (error) {
    console.error("Error fetching datasets:", error);
    res.status(500).json({ error: "Failed to fetch datasets" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const dataset = await storage.getDatasetById(req.params.id);
    if (!dataset) {
      return res.status(404).json({ error: "Dataset not found" });
    }
    res.json(dataset);
  } catch (error) {
    console.error("Error fetching dataset:", error);
    res.status(500).json({ error: "Failed to fetch dataset" });
  }
});

router.post("/upload", upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { projectId, name, type } = req.body;
    if (!projectId || !name || !type) {
      return res.status(400).json({ error: "Missing required fields: projectId, name, type" });
    }

    const buffer = req.file.buffer;
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    const sheetNames = workbook.SheetNames;
    const parsedData: Record<string, any[]> = {};
    const metadata: Record<string, any> = {
      totalSheets: sheetNames.length,
      sheets: {},
    };

    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1);
      
      const dataWithHeaders = rows.map((row: any) => {
        const obj: Record<string, any> = {};
        headers.forEach((header, index) => {
          if (header) {
            obj[header] = row[index];
          }
        });
        return obj;
      }).filter((row: Record<string, any>) => Object.values(row).some(v => v !== undefined && v !== null && v !== ''));

      parsedData[sheetName] = dataWithHeaders;
      metadata.sheets[sheetName] = {
        headers,
        rowCount: dataWithHeaders.length,
      };
    }

    const dataset = await storage.createDataset({
      projectId,
      name,
      type,
      sourceFileName: req.file.originalname,
      data: parsedData,
      sheetNames,
      metadata,
    });

    res.status(201).json(dataset);
  } catch (error) {
    console.error("Error uploading dataset:", error);
    res.status(500).json({ error: "Failed to upload and parse file" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const parsed = insertDatasetSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: fromZodError(parsed.error).toString(),
      });
    }
    const dataset = await storage.updateDataset(req.params.id, parsed.data);
    if (!dataset) {
      return res.status(404).json({ error: "Dataset not found" });
    }
    res.json(dataset);
  } catch (error) {
    console.error("Error updating dataset:", error);
    res.status(500).json({ error: "Failed to update dataset" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await storage.deleteDataset(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting dataset:", error);
    res.status(500).json({ error: "Failed to delete dataset" });
  }
});

router.get("/:id/sheet/:sheetName", async (req, res) => {
  try {
    const dataset = await storage.getDatasetById(req.params.id);
    if (!dataset) {
      return res.status(404).json({ error: "Dataset not found" });
    }
    
    const data = dataset.data as Record<string, any[]>;
    const sheetData = data[req.params.sheetName];
    
    if (!sheetData) {
      return res.status(404).json({ error: "Sheet not found" });
    }
    
    res.json({
      sheetName: req.params.sheetName,
      data: sheetData,
      metadata: (dataset.metadata as any)?.sheets?.[req.params.sheetName] || {},
    });
  } catch (error) {
    console.error("Error fetching sheet data:", error);
    res.status(500).json({ error: "Failed to fetch sheet data" });
  }
});

export default router;
