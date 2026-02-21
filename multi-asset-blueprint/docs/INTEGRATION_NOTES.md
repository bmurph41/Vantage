# External Data Provider Integration Notes

## 1. Zillow Bridge API

### Access
- Requires partnership agreement with Zillow Group
- Apply at: https://bridgedataoutput.com/ (now part of Zillow)
- API key provided after approval

### Endpoints Used
- `GET /reso/odata/Property` — Property search and details
- `GET /reso/odata/Property('{id}')` — Single property lookup
- Zestimate data available via property detail response
- Rental Zestimate included when available

### Rate Limits
- Typically 1,000 requests/day on standard tier
- 10 requests/second burst limit
- Batch endpoints available for bulk lookups

### Data Available
- Property details (beds, baths, sqft, lot size, year built, property type)
- Zestimate (home value estimate)
- Rental Zestimate (rent estimate)
- Tax assessment history
- Price history (sales)
- Comparable sales (within radius)
- Neighborhood data

### Authentication
- API key passed via `Authorization: Bearer <key>` header
- Server ID required for some endpoints

---

## 2. Redfin

### Access
- Redfin does NOT offer a public API
- Options:
  a) Partner data feed (requires business relationship)
  b) Redfin Estimate data via their website (terms of service apply)
  c) Third-party aggregators that include Redfin data (e.g., ATTOM, CoreLogic)

### Recommended Approach
- Use a third-party property data aggregator that normalizes Redfin alongside
  other sources (ATTOM Data, CoreLogic, HouseCanary)
- Or implement as a scraping adapter with appropriate rate limiting and caching
  (review Redfin ToS carefully)

### Alternative: ATTOM Data API (includes Redfin-comparable data)
- `GET /property/detail` — Property characteristics
- `GET /property/expandedprofile` — Extended details
- `GET /valuation/homeequity` — AVM (automated valuation model)
- `GET /sale/snapshot` — Recent sales / comps
- Rate limit: varies by plan (typically 5,000-50,000/month)

---

## 3. MLS / RESO Web API

### Access
- Requires IDX/RETS license through a local MLS board
- Increasingly, MLS boards are migrating to RESO Web API (OData-based)
- Broker license or partnership required for data access

### RESO Web API Standard
- OData v4 compliant
- OAuth 2.0 authentication (client_credentials flow)
- Standard resource types: Property, Member, Office, OpenHouse, Media

### Endpoints Used
- `GET /Property` — Search listings with OData filters
- `GET /Property('{ListingKey}')` — Single listing
- `GET /Property?$filter=StandardStatus eq 'Closed'` — Sold comps
- `GET /Property?$filter=StandardStatus eq 'Active'` — Active listings

### Authentication Flow
```
POST {token_url}
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id={client_id}
&client_secret={client_secret}
&scope=api
```

### Rate Limits
- Varies by MLS board (typically 2,000-10,000 requests/hour)
- Pagination required for large result sets (max 200 records per page)

### Data Available
- Active listings with full details
- Sold/closed transactions (comps)
- Days on market, price changes
- Agent/office information
- Property photos (via Media resource)
- Open house schedule

### Multi-Board Support
- Each MLS board has its own API endpoint and credentials
- The adapter supports multiple board configurations
- Field names are standardized via RESO Data Dictionary

---

## 4. Data Normalization Strategy

All adapters normalize data into a common `PropertyDataPayload` interface:

```typescript
{
  address: { street, city, state, zip, county, lat, lng },
  characteristics: { beds, baths, sqft, lotSize, yearBuilt, stories, garage, pool, ... },
  valuation: { estimatedValue, rentEstimate, lastSalePrice, lastSaleDate, assessedValue },
  listing: { status, listPrice, daysOnMarket, mlsNumber, agent, office },
  market: { medianRent, medianSalePrice, capRate, appreciation1yr, appreciation5yr },
  metadata: { sourceId, sourcePropertyId, fetchedAt, confidence }
}
```

This ensures CRM, SalesComps, Modeling, and other modules can consume data
from any provider without knowing which source it came from.

---

## 5. Caching & Freshness Strategy

| Data Type | Cache Duration | Refresh Trigger |
|-----------|---------------|-----------------|
| Property details | 30 days | Manual or on-access if stale |
| Valuations (Zestimate) | 7 days | Scheduled weekly sync |
| Active listings | 1 day | Daily cron |
| Sold comps | 30 days | Weekly cron |
| Market metrics | 7 days | Weekly cron |

---

## 6. Cost Considerations

| Provider | Typical Cost | Notes |
|----------|-------------|-------|
| Zillow Bridge | $500-2,000/mo | Based on usage tier |
| ATTOM Data | $300-1,500/mo | Property data + valuations |
| MLS/RESO | $50-300/mo per board | Plus broker license fees |
| CoreLogic | $1,000-5,000/mo | Enterprise pricing |
| HouseCanary | $500-3,000/mo | AVM + analytics |
