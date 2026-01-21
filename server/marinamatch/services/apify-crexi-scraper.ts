import axios from "axios";
import { db } from "../../db";
import { eq, sql } from "drizzle-orm";
import { marinaListings, marinaScrapeources, type MarinaListing } from "@shared/schema";
import { generateDedupeHash, ListingData } from "./cre-scraper";
import { matchScoringService } from "./match-scoring-service";

const APIFY_API_BASE = "https://api.apify.com/v2";
const DEFAULT_ACTOR_ID = "crawlerbros~crexi-real-estate-scraper";
const MARINA_SEARCH_URL = "https://www.crexi.com/properties/Marinas";
const SYSTEM_ORG_ID = "system-global-sources";

function getActorId(): string {
  return process.env.APIFY_CREXI_ACTOR_ID || DEFAULT_ACTOR_ID;
}

let lastRunStatus: {
  runId: string | null;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  listingsFound: number;
  newListings: number;
  error: string | null;
} = {
  runId: null,
  status: "idle",
  startedAt: null,
  completedAt: null,
  listingsFound: 0,
  newListings: 0,
  error: null,
};

export function getApifyRunStatus() {
  return { ...lastRunStatus };
}

interface ApifyRunResponse {
  data: {
    id: string;
    actId: string;
    status: string;
    defaultDatasetId: string;
  };
}

interface ApifyDatasetResponse {
  data: CrexiListing[];
}

interface CrexiListing {
  id?: string;
  url?: string;
  title?: string;
  name?: string;
  propertyName?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  zip?: string;
  price?: number | string;
  askingPrice?: number | string;
  listPrice?: number | string;
  pricePerSqFt?: number | string;
  sqft?: number | string;
  squareFeet?: number | string;
  acres?: number | string;
  acreage?: number | string;
  propertyType?: string;
  type?: string;
  subType?: string;
  status?: string;
  description?: string;
  brokerName?: string;
  broker?: string;
  agentName?: string;
  brokerCompany?: string;
  brokerage?: string;
  brokerPhone?: string;
  brokerEmail?: string;
  images?: string[];
  imageUrl?: string;
  heroImage?: string;
  capRate?: number | string;
  noi?: number | string;
  listingDate?: string;
  createdAt?: string;
  slips?: number | string;
  wetSlips?: number | string;
  dryStorage?: number | string;
  waterFrontage?: number | string;
}

function parseNumber(value: number | string | undefined): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return isNaN(value) ? undefined : value;
  const cleaned = String(value).replace(/[$,\s]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

function parseCrexiListing(raw: CrexiListing): ListingData | null {
  const title = raw.title || raw.name || raw.propertyName || "";
  if (!title) return null;

  const sourceUrl = raw.url || `https://www.crexi.com/properties/${raw.id || ""}`;
  
  const price = parseNumber(raw.price) || parseNumber(raw.askingPrice) || parseNumber(raw.listPrice);
  const acreage = parseNumber(raw.acres) || parseNumber(raw.acreage);
  const slips = parseNumber(raw.slips) || parseNumber(raw.wetSlips);
  
  let images: string[] = [];
  if (raw.images && Array.isArray(raw.images)) {
    images = raw.images;
  } else if (raw.heroImage) {
    images = [raw.heroImage];
  } else if (raw.imageUrl) {
    images = [raw.imageUrl];
  }

  const listing: ListingData = {
    title,
    propertyName: raw.propertyName || raw.name || title,
    propertyAddress: raw.address,
    city: raw.city,
    state: raw.state,
    zipCode: raw.zipCode || raw.zip,
    askingPrice: price,
    totalSlips: slips ? Math.round(slips) : undefined,
    wetSlips: parseNumber(raw.wetSlips) ? Math.round(parseNumber(raw.wetSlips)!) : undefined,
    dryStorageSpaces: parseNumber(raw.dryStorage) ? Math.round(parseNumber(raw.dryStorage)!) : undefined,
    acreage,
    waterFrontage: parseNumber(raw.waterFrontage),
    capRate: parseNumber(raw.capRate),
    noi: parseNumber(raw.noi),
    marinaType: "marina",
    propertyType: raw.propertyType || raw.type || "Marina",
    dealType: "sale",
    brokerName: raw.brokerName || raw.broker || raw.agentName,
    brokerCompany: raw.brokerCompany || raw.brokerage,
    brokerPhone: raw.brokerPhone,
    brokerEmail: raw.brokerEmail,
    sourceUrl,
    sourceListingId: raw.id,
    originalDescription: raw.description,
    heroImageUrl: images[0],
    images,
    listingDate: raw.listingDate || raw.createdAt ? new Date(raw.listingDate || raw.createdAt!) : undefined,
    attributionText: "Data sourced from Crexi via Apify",
    confidence: 0.9,
  };

  return listing;
}

export async function runApifyCrexiScraper(): Promise<{
  success: boolean;
  listingsFound: number;
  newListings: number;
  errors: string[];
}> {
  const apiToken = process.env.APIFY_API_TOKEN;
  
  if (!apiToken) {
    console.error("[Apify Crexi] APIFY_API_TOKEN not configured");
    return {
      success: false,
      listingsFound: 0,
      newListings: 0,
      errors: ["APIFY_API_TOKEN not configured"],
    };
  }

  const result = {
    success: false,
    listingsFound: 0,
    newListings: 0,
    errors: [] as string[],
  };

  try {
    const actorId = getActorId();
    console.log(`[Apify Crexi] Starting Crexi marina scrape with actor: ${actorId}...`);
    
    lastRunStatus = {
      runId: null,
      status: "starting",
      startedAt: new Date(),
      completedAt: null,
      listingsFound: 0,
      newListings: 0,
      error: null,
    };

    const runResponse = await axios.post<ApifyRunResponse>(
      `${APIFY_API_BASE}/acts/${actorId}/runs?token=${apiToken}`,
      {
        startUrls: [{ url: MARINA_SEARCH_URL }],
        maxItems: 200,
        proxyConfiguration: {
          useApifyProxy: true,
        },
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );

    const runId = runResponse.data.data.id;
    console.log(`[Apify Crexi] Run started with ID: ${runId}`);
    
    lastRunStatus.runId = runId;
    lastRunStatus.status = "running";

    let status = runResponse.data.data.status;
    let datasetId = runResponse.data.data.defaultDatasetId;
    let attempts = 0;
    const maxAttempts = 60;

    while (status !== "SUCCEEDED" && status !== "FAILED" && status !== "ABORTED" && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      attempts++;

      const statusResponse = await axios.get(
        `${APIFY_API_BASE}/actor-runs/${runId}?token=${apiToken}`,
        { timeout: 10000 }
      );

      status = statusResponse.data.data.status;
      datasetId = statusResponse.data.data.defaultDatasetId;
      console.log(`[Apify Crexi] Run status: ${status} (attempt ${attempts}/${maxAttempts})`);
    }

    if (status !== "SUCCEEDED") {
      throw new Error(`Apify run failed with status: ${status}`);
    }

    console.log(`[Apify Crexi] Run completed, fetching dataset: ${datasetId}`);

    const datasetResponse = await axios.get<CrexiListing[]>(
      `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${apiToken}`,
      { timeout: 60000 }
    );

    const rawListings = datasetResponse.data;
    console.log(`[Apify Crexi] Retrieved ${rawListings.length} raw listings`);

    result.listingsFound = rawListings.length;

    for (const raw of rawListings) {
      try {
        const listing = parseCrexiListing(raw);
        if (!listing) continue;

        const dedupeHash = generateDedupeHash(listing, "Crexi");

        const existing = await db
          .select()
          .from(marinaListings)
          .where(eq(marinaListings.dedupeHash, dedupeHash))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(marinaListings)
            .set({
              askingPrice: listing.askingPrice,
              lastVerifiedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(marinaListings.id, existing[0].id));
          continue;
        }

        const [inserted] = await db
          .insert(marinaListings)
          .values({
            sourcePlatform: "Crexi",
            sourceUrl: listing.sourceUrl,
            sourceListingId: listing.sourceListingId,
            dedupeHash,
            crossplatformHash: dedupeHash,
            propertyName: listing.propertyName || listing.title,
            propertyAddress: listing.propertyAddress,
            city: listing.city,
            state: listing.state,
            zipCode: listing.zipCode,
            askingPrice: listing.askingPrice?.toString(),
            totalSlips: listing.totalSlips,
            wetSlips: listing.wetSlips,
            dryStorageSpaces: listing.dryStorageSpaces,
            acreage: listing.acreage?.toString(),
            waterFrontage: listing.waterFrontage?.toString(),
            capRate: listing.capRate?.toString(),
            noi: listing.noi?.toString(),
            marinaType: listing.marinaType,
            dealType: listing.dealType,
            brokerName: listing.brokerName,
            brokerCompany: listing.brokerCompany,
            brokerPhone: listing.brokerPhone,
            brokerEmail: listing.brokerEmail,
            originalDescription: listing.originalDescription,
            heroImageUrl: listing.heroImageUrl,
            images: listing.images,
            listingDate: listing.listingDate,
            attributionText: listing.attributionText,
            isActive: true,
            isCurated: true,
            scope: "global",
            lastVerifiedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        result.newListings++;

        try {
          await matchScoringService.scoreAndSaveListing(inserted);
        } catch (scoreError: any) {
          console.warn(`[Apify Crexi] Failed to score listing ${inserted.id}:`, scoreError.message);
        }
      } catch (listingError: any) {
        console.warn(`[Apify Crexi] Error processing listing:`, listingError.message);
        result.errors.push(listingError.message);
      }
    }

    result.success = true;
    console.log(`[Apify Crexi] Completed: ${result.newListings} new listings imported`);
    
    lastRunStatus = {
      ...lastRunStatus,
      status: result.listingsFound === 0 ? "completed_empty" : "completed",
      completedAt: new Date(),
      listingsFound: result.listingsFound,
      newListings: result.newListings,
      error: result.listingsFound === 0 ? "Dataset returned 0 listings - actor may need different configuration" : null,
    };

  } catch (error: any) {
    console.error("[Apify Crexi] Scraper error:", error.message);
    result.errors.push(error.message);
    
    lastRunStatus = {
      ...lastRunStatus,
      status: "failed",
      completedAt: new Date(),
      error: error.message,
    };
  }

  return result;
}

export async function getApifyCrexiSource(): Promise<{ id: string; name: string } | null> {
  const [source] = await db
    .select()
    .from(marinaScrapeources)
    .where(eq(marinaScrapeources.platform, "Crexi (Apify)"))
    .limit(1);

  return source ? { id: source.id, name: source.name } : null;
}

export async function ensureApifyCrexiSource(): Promise<string> {
  const existing = await getApifyCrexiSource();
  if (existing) return existing.id;

  const [source] = await db
    .insert(marinaScrapeources)
    .values({
      orgId: SYSTEM_ORG_ID,
      name: "Crexi - Marina Listings (Apify)",
      platform: "Crexi (Apify)",
      baseUrl: MARINA_SEARCH_URL,
      isActive: true,
      isGlobalSource: true,
      ingestionMethod: "api",
      healthStatus: "healthy",
      scope: "global",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return source.id;
}
