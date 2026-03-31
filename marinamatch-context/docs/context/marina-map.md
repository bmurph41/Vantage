# MarinaMatch — Marina Property Intelligence Map

## Overview

The Marina Property Intelligence Map is a full React component providing:
- Canvas-based heat map overlay
- Investment grade markers (A+ through C)
- Left sidebar: property list with filtering
- Right detail panel: 4-tab property deep-dive
- Data sources: Census ACS, HUD, Google Maps geocoding, Mapbox GL JS

---

## Component Structure

```
MarinaPropertyMap.tsx
├── Left Sidebar (~280px)
│   ├── Search / filter controls
│   ├── Grade filter (A+, A, B+, B, C)
│   ├── Property list (scrollable)
│   └── Each item: name, grade badge, NOI, location
├── Map Canvas (flex-1)
│   ├── Mapbox GL JS base map
│   ├── Heat map layer (investment density)
│   └── Grade markers (clickable pins)
└── Right Detail Panel (~380px)
    ├── Tab 1: Overview
    ├── Tab 2: Financials
    ├── Tab 3: Demographics
    └── Tab 4: Market
```

---

## Database Table

```sql
CREATE TABLE marina_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  investment_grade VARCHAR(5),   -- 'A+' | 'A' | 'B+' | 'B' | 'C'
  total_slips INTEGER,
  dry_storage_units INTEGER,
  year_built INTEGER,
  total_acres DECIMAL(8, 2),
  asking_price DECIMAL(15, 2),
  noi_annual DECIMAL(15, 2),
  cap_rate DECIMAL(5, 4),
  occupancy_rate DECIMAL(5, 4),
  water_depth_ft DECIMAL(6, 2),
  amenities JSONB DEFAULT '[]',
  market_data JSONB DEFAULT '{}',   -- Census/HUD data cache
  modeling_project_id UUID,          -- link to modeling_projects
  source VARCHAR(100),               -- 'scraped' | 'manual' | 'imported'
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_marina_properties_org ON marina_properties(org_id);
CREATE INDEX idx_marina_properties_grade ON marina_properties(investment_grade);
CREATE INDEX idx_marina_properties_location ON marina_properties(latitude, longitude);
```

### Linking to Modeling Projects
```typescript
// Always use pool.query — modeling_projects may be RLS-affected
const result = await pool.query(
  `SELECT mp.*, mpc.noi_year_1, mpc.cap_rate, mpc.irr
   FROM marina_properties mp
   LEFT JOIN modeling_projects proj ON proj.id = mp.modeling_project_id
   LEFT JOIN modeling_project_config mpc ON mpc.project_id = proj.id
   WHERE mp.org_id = $1`,
  [orgId]
);
```

---

## Investment Grade System

```typescript
type InvestmentGrade = 'A+' | 'A' | 'B+' | 'B' | 'C';

interface GradeConfig {
  grade: InvestmentGrade;
  color: string;       // marker color
  minScore: number;    // composite score threshold
  label: string;
}

const GRADE_CONFIG: GradeConfig[] = [
  { grade: 'A+', color: '#0A2342', minScore: 90, label: 'Institutional Grade' },
  { grade: 'A',  color: '#1B6CA8', minScore: 75, label: 'Investment Grade' },
  { grade: 'B+', color: '#2E86AB', minScore: 60, label: 'Value-Add' },
  { grade: 'B',  color: '#4ECDC4', minScore: 45, label: 'Opportunistic' },
  { grade: 'C',  color: '#95A5A6', minScore: 0,  label: 'Speculative' },
];

function calculateGrade(property: MarinaProperty): InvestmentGrade {
  // Composite scoring:
  // - Cap rate vs market benchmark (25%)
  // - Occupancy rate (20%)
  // - Water depth / physical quality (15%)
  // - Location demographics (20%)
  // - NOI growth trend (20%)
  const score = computeCompositeScore(property);
  return GRADE_CONFIG.find(g => score >= g.minScore)?.grade ?? 'C';
}
```

---

## Mapbox GL JS Setup

```typescript
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Initialize map
mapboxgl.accessToken = process.env.VITE_MAPBOX_TOKEN!;

const map = new mapboxgl.Map({
  container: mapContainerRef.current!,
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-95.7129, 37.0902],  // US center default
  zoom: 4
});
```

### Heat Map Layer
```typescript
map.on('load', () => {
  // Add data source
  map.addSource('marina-heat', {
    type: 'geojson',
    data: buildGeoJSON(properties)
  });

  // Heat map layer
  map.addLayer({
    id: 'marina-heat-layer',
    type: 'heatmap',
    source: 'marina-heat',
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['get', 'noi'], 0, 0, 1000000, 1],
      'heatmap-intensity': 1,
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(10,35,66,0)',
        0.5, 'rgba(27,108,168,0.5)',
        1, 'rgba(46,134,171,0.9)'
      ],
      'heatmap-radius': 30,
      'heatmap-opacity': 0.7
    }
  });
});
```

### Grade Markers
```typescript
properties.forEach(property => {
  const gradeConfig = GRADE_CONFIG.find(g => g.grade === property.investmentGrade)!;

  const el = document.createElement('div');
  el.className = 'marina-marker';
  el.style.backgroundColor = gradeConfig.color;
  el.textContent = property.investmentGrade;

  new mapboxgl.Marker(el)
    .setLngLat([property.longitude, property.latitude])
    .setPopup(new mapboxgl.Popup().setHTML(`
      <strong>${property.name}</strong><br/>
      Grade: ${property.investmentGrade}<br/>
      NOI: ${formatCurrency(property.noiAnnual)}
    `))
    .addTo(map);
});
```

---

## Google Maps Geocoding

```typescript
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const encoded = encodeURIComponent(address);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status === 'OK' && data.results.length > 0) {
    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lng };
  }
  return null;
}
```

---

## Census ACS / HUD Data Integration

Cached in the `market_data` JSONB column on `marina_properties`.

```typescript
interface MarketData {
  // Census ACS (American Community Survey)
  population1mi: number;
  population3mi: number;
  population5mi: number;
  medianHHI3mi: number;
  medianAge3mi: number;
  ownerOccupancyRate: number;

  // HUD data
  fairMarketRent: number;
  housingVacancyRate: number;

  // Derived
  affluenceScore: number;     // composite of income + home values
  growthScore: number;        // population growth trend
  lastUpdated: string;        // ISO date
}

// Census ACS API call
async function fetchCensusData(lat: number, lng: number): Promise<Partial<MarketData>> {
  // Uses Census Geocoder + ACS 5-year estimates API
  const censusUrl = `https://api.census.gov/data/2022/acs/acs5?get=B19013_001E,B01003_001E&for=tract:*&in=state:*&key=${process.env.CENSUS_API_KEY}`;
  // ... implementation
}
```

---

## Detail Panel Tabs

### Tab 1: Overview
- Property photo (if available)
- Address, grade badge, status
- Key stats: slips, dry storage, acreage, year built, water depth
- Amenities chips
- Source and last updated

### Tab 2: Financials
- Asking price, NOI, cap rate, occupancy
- Link to full modeling project (if `modeling_project_id` set)
- Key financial ratios
- Estimated returns at current ask

### Tab 3: Demographics
- Population rings (1mi, 3mi, 5mi)
- Median HHI, median age
- Owner occupancy rate
- Affluence score
- Source: Census ACS (displayed)

### Tab 4: Market
- Submarket cap rate range
- Comparable sales (if available)
- Market rent growth
- HUD fair market rents
- Supply pipeline

---

## API Routes

```typescript
GET    /api/marinamatch/marina-map/properties
POST   /api/marinamatch/marina-map/properties
GET    /api/marinamatch/marina-map/properties/:id
PUT    /api/marinamatch/marina-map/properties/:id
DELETE /api/marinamatch/marina-map/properties/:id

// Geocode a new address
POST   /api/marinamatch/marina-map/geocode
Body:  { address: string }

// Refresh market data for a property
POST   /api/marinamatch/marina-map/properties/:id/refresh-market-data

// Bulk import from scraper/marketplace
POST   /api/marinamatch/marina-map/import
```

---

## Environment Variables Needed

```bash
VITE_MAPBOX_TOKEN=           # Mapbox public token (client-side)
MAPBOX_SECRET_TOKEN=         # Mapbox secret (server-side, if needed)
GOOGLE_MAPS_API_KEY=         # Geocoding
CENSUS_API_KEY=              # Census ACS data (free, register at census.gov)
```
