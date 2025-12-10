import { Router } from "express";
import { storage } from "../storage";

const router = Router();

router.get("/sources/:projectId", async (req, res) => {
  try {
    const datasets = await storage.getDatasetsByProjectId(req.params.projectId);
    
    const sources = [
      ...datasets.map(d => ({
        id: d.id,
        name: d.name,
        type: d.type,
        sourceType: 'dataset',
        sheetNames: d.sheetNames,
        metadata: d.metadata,
      })),
      { id: "market-data", name: "Market Data", type: "api", sourceType: 'external' },
      { id: "demographics", name: "Demographics", type: "api", sourceType: 'external' },
    ];
    
    res.json(sources);
  } catch (error) {
    console.error("Error fetching data sources:", error);
    res.status(500).json({ error: "Failed to fetch data sources" });
  }
});

router.get("/data/:sourceId", async (req, res) => {
  try {
    const { sourceId } = req.params;
    const { sheet } = req.query;
    
    const dataset = await storage.getDatasetById(sourceId);
    if (dataset) {
      const data = dataset.data as Record<string, any[]>;
      if (sheet && typeof sheet === 'string') {
        return res.json(data[sheet] || []);
      }
      const firstSheet = dataset.sheetNames?.[0];
      return res.json(firstSheet ? data[firstSheet] : []);
    }
    
    const externalData: Record<string, any> = {
      "market-data": {
        medianRent: 2800,
        vacancyRate: 4.2,
        population: 850000,
        employmentGrowth: 3.2,
        medianIncome: 78500,
      },
      "demographics": {
        population: 850000,
        medianAge: 38.5,
        householdSize: 2.4,
        medianIncome: 78500,
        collegeEducated: 42.3,
      },
    };

    if (externalData[sourceId]) {
      return res.json(externalData[sourceId]);
    }
    
    res.status(404).json({ error: "Data source not found" });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

export default router;
