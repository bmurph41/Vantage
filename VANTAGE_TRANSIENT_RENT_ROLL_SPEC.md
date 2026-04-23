# VANTAGE — TRANSIENT RENT ROLL SPEC

**Version:** 1.0
**Status:** Build-ready for Claude Code
**Owner:** Brett
**Integrates with:** Canonical Pro Forma, DCF Engine, Monte Carlo, Document Intelligence, Rent Roll (traditional), CRM/Deal Workspace
**Companion docs:** `MARINAMATCH_JOURNAL.md`, `VANTAGE_DOCUMENT_INTELLIGENCE_SPEC.md`, `MARINAMATCH_GAP_SPEC.md`

---

## 0. SCOPE & INTENT

### 0.1 What "Transient Rent Roll" Means in Vantage

A **traditional rent roll** in Vantage models contractual tenancy: one lease per unit at a time, fixed monthly rent, escalations, expirations, renewal options. It is the correct model for office, retail, multifamily, industrial, NNN, and most institutional CRE.

A **transient rent roll** models *utilization-based* tenancy where the same physical unit (a slip, a room, a pad, a locker, a parking stall, a desk) hosts many short, overlapping stays or usages over the underwriting period. Revenue is a function of three independent axes:

1. **Inventory available** (supply: number of units × nights available)
2. **Occupancy** (demand capture: occupied unit-nights / available unit-nights)
3. **Rate** (price realized per occupied unit-night)

The classic lodging identity `RevPAR = ADR × Occupancy` is the canonical form, but every transient asset class has an analogous identity. The purpose of this spec is to build a single canonical engine that handles all of them and plugs cleanly into the existing Pro Forma / DCF / Monte Carlo pipeline.

### 0.2 Asset Classes In Scope

- **Marinas** (wet slip, dry stack, rack storage, mooring ball, liveaboard)
- **Hotels** (limited service, full service, resort, boutique, extended stay)
- **Short-term rentals** (single-unit and portfolio STR)
- **RV parks & campgrounds** (pad rental, cabin, tent site)
- **Self-storage** (month-to-month units, transient RV/boat storage)
- **Parking** (hourly/daily/monthly stalls, valet)
- **Coworking / flex office** (day pass, dedicated desk, private office)
- **Student housing — by-the-bed** (partial, shares traits with hotel + multifamily)
- **Senior living — respite / short stay** (partial)

A pluggable asset-class registry pattern is used so additional classes can be onboarded without schema changes.

### 0.3 Non-Goals

- This spec does NOT replace the existing traditional rent roll. Both coexist; a property can have one, the other, or both (e.g., a mixed-use marina with retail NNN leases plus transient slips).
- This spec does NOT build a real-time booking/PMS system. That is StayMate's job. Vantage consumes historical performance data and forward assumptions — it does not take guest reservations.
- This spec does NOT build channel manager integrations. Data enters Vantage via (a) document upload/parse, (b) CSV import, (c) StayMate API sync (for Brett's own portfolio), or (d) manual entry.

### 0.4 Integration Points With Existing Vantage Systems

| Existing System | Integration |
|---|---|
| **Canonical Pro Forma** | Transient engine emits GPR / Vacancy / Concessions / Other Income lines into the Pro Forma. `getModelConfig()` returns a `transient` block when enabled. |
| **DCF Engine (Layer 2)** | Year-by-year occupancy, ADR, and seasonality feed into DCF cash flows. Terminal cap rate applied to stabilized NOI. |
| **Monte Carlo (Layer 3)** | Occupancy %, ADR growth, seasonality deviation, channel commission, and stabilization duration become sampled variables. |
| **Decision Support (Layer 4)** | Tornado charts add transient-specific sensitivities. Memo generator narrates RevPAR/ADR/Occupancy assumptions. |
| **Document Intelligence** | New extractors for STR reports, PMS night audits, marina management exports. Same confidence + cell-review UX. |
| **CRM / Deal Workspace** | Transient deal view shows RevPAR, ADR, Occupancy KPIs on the deal card; comp set overlay on deal comparison. |
| **ASSET_REGISTRY** | Each asset class declares whether it has `transient_inventory: true`, and if so, which unit-type dimensions apply (LOA for marinas, room type for hotels, etc.). |

---

## 1. CONCEPTUAL FRAMEWORK

### 1.1 Three-Layer Mental Model

Every transient rent roll must answer three questions, in order:

1. **What do you have?** → Inventory layer (units, their attributes, how they're grouped)
2. **How is it being used?** → Demand layer (bookings, stays, occupancy, seasonality, channels)
3. **What is it earning?** → Revenue layer (rate per stay, ancillaries, fees, discounts, concessions)

Vantage models these as three separate subsystems that compose into the Pro Forma. Separation of concerns is critical because underwriting often requires holding one layer constant and flexing another (e.g., "hold inventory and seasonality constant, model a 200bps occupancy lift from new branding").

### 1.2 The Universal Transient Identity

```
Revenue = Σ (Inventory_i × AvailableDays_i × Occupancy_i × ADR_i)  for each unit_type i
        + Σ Ancillary_k                                             for each ancillary stream k
        - Discounts and Concessions
        - Channel Commissions
```

In marina form:

```
Slip Revenue = Σ (Slips × DaysAvailable × OccupancyRate × AvgDailyRate_per_ft × AvgLOA)
```

In hotel form:

```
Rooms Revenue = Σ RoomsAvailable × Occupancy × ADR  =  Σ RoomNightsSold × ADR
```

Vantage stores the **decomposed form** (inventory × occupancy × rate), not just the top-line. This is what makes the output underwritable rather than a black box.

### 1.3 Transient vs. Contractual Hybrids

Many real-world assets have both:

- Marina with 200 slips: 120 annual tenants (contractual, traditional rent roll), 60 seasonal (October–April, partially transient), 20 transient (nightly/weekly)
- Hotel with 150 rooms: 145 transient + 5 long-term contracted to an airline for crew housing
- RV park with 100 pads: 40 "permanent" monthly, 60 nightly
- Self-storage: all month-to-month, but with behavioral differences (long-tenure vs. transient)

The data model supports **tenancy classification per unit per time period** so a single unit can flip between contractual and transient over the hold period.

### 1.4 Key Terminology

| Term | Definition | Notes |
|---|---|---|
| Unit-night (or slip-night, pad-night, stall-night) | One unit of inventory available for one night | Universal denominator |
| ADR | Average Daily Rate = Room Revenue / Room Nights Sold | Net of comps, gross of tax unless noted |
| Occupancy | Room Nights Sold / Room Nights Available | Stated as % |
| RevPAR | Revenue Per Available Room = ADR × Occupancy = Room Rev / Rooms Available | Room nights, not rooms |
| TRevPAR | Total RevPAR = All Revenue / Rooms Available | Includes F&B, ancillaries |
| GOPPAR | Gross Operating Profit Per Available Room | USALI line |
| LOS | Length of Stay | Avg nights per booking |
| BOB | Booking on the Books | Forward reservations already confirmed |
| Pickup | Change in bookings for a target date over a time window | Pace metric |
| Pace | Comparison of BOB today vs. BOB same time last year | Forward-looking |
| MPI / ARI / RGI | Market / ADR / RevPAR Penetration Index vs. competitive set | STR report metrics |
| Compset | Competitive set of comparable properties | 3–6 peers typical |
| Transient (hotel sense) | Non-group, short-stay, individual bookings | Distinct from "contract" and "group" |
| Transient (marina sense) | Nightly or weekly boaters | As opposed to "seasonal" or "annual" tenants |
| Liveaboard | Boater whose slip is their residence | Usually a separate fee/tier |
| $/ft/night | Marina transient rate basis | Multiplied by LOA |
| House account | Comp/owner use, zero revenue | Must be tracked to avoid skewing ADR |
| STR report | Smith Travel (CoStar) hotel benchmarking report | Canonical hotel input |

### 1.5 Underwriting Philosophy

Transient assets are underwritten on **trailing actuals + forward assumptions**, not on contractual cash flows. The typical stack:

1. **T-12 / T-6 / T-3** actual operating performance (trailing twelve / six / three months annualized)
2. **Year-over-year** growth rates for occupancy and ADR
3. **Seasonality curves** derived from 24–36 months of history
4. **Stabilization ramp** for new/repositioned assets
5. **Compset benchmarks** to sanity-check projections
6. **Sensitivity/Monte Carlo** on the three or four variables that dominate value

The spec's analytics layer produces all of these as first-class outputs.

---

## 2. ASSET CLASS DEEP DIVES

Each subsection defines: inventory characteristics, unit-type dimensions, rate structure, source documents, core KPIs, ancillary revenue streams, common gotchas, and benchmark ranges.

### 2.1 Marinas

**Inventory characteristics.** A marina's "unit" is a slip (wet storage in the water), a rack position (dry stack), or a trailer/boatyard pad. Slips are dimensioned by:

- **LOA** (length overall, in feet) — the primary pricing driver
- **Beam** (width)
- **Draft** (water depth required)
- **Power** (30A, 50A, 100A, 3-phase, none)
- **Water** (yes/no)
- **Sewage pump-out** (yes/no)
- **Covered vs. uncovered**
- **Fixed dock vs. floating dock**
- **Position** (end-tie, inside, fairway)
- **Hurricane rating / protection**

Racks are dimensioned by vessel length limit and bay height.

**Rate structure.** Marinas commonly charge `$/ft/night` (transient), `$/ft/month` (seasonal), or `$/ft/year` (annual). The fee is the LOA × per-foot rate. Examples (varies wildly by geography):

- Transient: $2.00–$6.00/ft/night in most US markets, $8+/ft/night in premium destinations
- Seasonal: $40–$120/ft/month
- Annual: $120–$400/ft/year (base), often with separate metered electric

Additional fees:
- **Liveaboard fee** (per vessel or per person)
- **Electric** (metered pass-through or flat)
- **Pump-out** (per use or included)
- **Storm/hurricane haul-out** (event-driven)
- **Short-term multiplier** (<3 nights often priced higher per-foot)
- **Peak/off-peak multipliers** (holiday weekends)

**Tenancy tiers.** The three-way split is universal:

1. **Annual** — 12-month commitments, contractual, belong in the traditional rent roll OR flagged as `tenancy_class='annual'` in the transient model
2. **Seasonal** — 3–6 month commitments (Northeast summer, Florida winter), partially transient
3. **Transient** — nightly/weekly/monthly, fully transient

Vantage treats all three through a unified `booking` table where a booking has a `tenancy_class` and a date range. An "annual" booking is just a booking that spans 365 days.

**Source documents for ingestion.**

- Marina management software exports: **Dockwa**, **Molo** (Oasis), **Marinagram**, **MarinaOffice**, **Speedydock** (dry stack), **Scribble**, **Harbor Assist**
- QuickBooks P&L (for revenue tie-out)
- Slip inventory spreadsheet (often Excel or PDF dock map)
- Wait list export
- Fuel dock sales report (if operated)
- Ship store POS report
- Utilities sub-meter report

**Core KPIs.**

- **Occupied slip-days / Available slip-days** → Occupancy
- **Slip revenue / Available slip-days** → equivalent of RevPAR
- **Revenue per foot** (`$/LOA-ft` across the period)
- **Transient % of slip nights** (mix)
- **Annual wait-list count** (demand indicator for acquisition pricing)
- **Average LOA of occupied slips** (larger boats = higher revenue per slip)

**Ancillary revenue streams (essential for marina underwriting).**

- **Fuel** — can be 20–50% of total revenue for a fuel-dock marina, with margins of 40–80 cents/gallon for gas, 30–60 cents/gallon for diesel
- **Ship store / retail** — 25–40% margin typical
- **Restaurant / bar** — if operated in-house
- **Boat rental / charter** — ancillary if offered
- **Service & repair** — labor + parts; often highest-margin stream
- **Haul-out / launch / block & storage** — yard operations
- **Winterization packages**
- **Detail / wash**
- **Pump-out**
- **Dockage ancillaries** — ice, bait, laundry, showers
- **Parking / trailer storage**
- **Brokerage commissions** (if licensed broker on premises)

Fuel margin reporting must be handled specifically: fuel gross revenue is huge but fuel gross margin is what flows to NOI. The Pro Forma roll-up must pull **gross profit**, not gross revenue, for fuel to avoid grossly over-stating NOI.

**Common gotchas.**

- **LOA vs. slip length.** A 40-foot slip can hold a 38' boat; always price on vessel LOA, not slip length. Historical records often report both.
- **Overhang fees.** Vessels >slip length incur overhang surcharges — a separate line item.
- **Metered electric.** Pass-through vs. profit center. Must be classified correctly in the P&L or NOI is distorted.
- **Storm events.** Revenue loss during named storms. Historical T-12 may be materially distorted.
- **Submerged land lease.** Many marinas pay a state/municipal submerged-land lease — an OpEx line often mis-classified as "rent" by naive parsers.
- **DNR/Army Corps permits.** Dock permit count caps inventory. A "potential" slip added via permit modification is speculative until permitted.
- **Dock age / condition.** Not a revenue item but drives cap-ex reserve assumptions.

**Benchmark ranges (rule-of-thumb, verify by market).**

- Cap rates (stabilized marina, 2024–2026 range): 6.5%–9.5% depending on location, amenities, earnings mix
- Per-slip sale price: $25K–$150K+ per slip depending on location and draft
- NOI margins: 35%–55% (ex-fuel); 15%–25% including pass-through fuel revenue
- Occupancy target (annual tenancy): 90%+ for stable marinas with waitlists

### 2.2 Hotels

**Inventory characteristics.** The "unit" is a guest room, classified into **room types** (sometimes called *room classes* or *room categories*):

- Standard King / Standard Queen / Standard Double Queen
- Deluxe / Premium / Executive
- Suite tiers (Junior Suite, Executive Suite, Presidential Suite)
- View/aspect distinctions (Ocean View, City View, Interior)
- ADA/accessible variants
- Connecting rooms

Each room type has:

- **Inventory count**
- **Base rate (rack rate)**
- **Max occupancy** (persons)
- **Bed configuration**
- **Square footage** (relevant for resort fee math and luxury segmentation)

**Rate structure — multidimensional.**

Hotel rates are not a single number. They are a **rate matrix** indexed by:

- **Date** (day of week, season, special event)
- **Room type**
- **Rate plan** (BAR — Best Available Rate, AAA, Government, Corporate, Group, Wholesale, Opaque/Priceline, Loyalty)
- **Channel** (direct, brand.com, OTA, GDS, wholesale)
- **Length-of-stay restriction** (LOS minimums, closed-to-arrival)

Rate plans typically derive from the **BAR** via fixed discounts or markups. Vantage stores BAR plus derivation rules, not every permutation.

**Source documents.**

- **STR report (Smith Travel / CoStar)** — the canonical benchmarking document. Contains property performance vs. compset for Occupancy, ADR, RevPAR with MPI, ARI, RGI indices. Usually 3 tabs: monthly, weekly (DOW), segment.
- **PMS night audit reports** — daily transcript of rooms sold, revenue, occupancy, ADR by segment. Opera, StayNTouch, Cloudbeds, Mews, innRoad, RoomRaccoon.
- **Rate shop reports** — rate-parity snapshots from tools like OTA Insight/Lighthouse, Rate Gain, Kalibri
- **Forecast/budget** — typically Excel, month × segment
- **Franchise reports** — brand-specific P&L reconciled to franchise standards
- **USALI P&L** — hotels use the **Uniform System of Accounts for the Lodging Industry (USALI, 11th edition revised)**. P&Ls map to specific USALI schedules (Rooms, F&B, Minor Operated Departments, Rentals & Other Income, A&G, Sales & Marketing, IT, POMEC, Utilities, Fixed Charges, Management Fees, FF&E Reserve).
- **Group block reports** — pace of group bookings
- **PIP (Property Improvement Plan)** — for franchised properties, required cap-ex; critical underwriting input
- **Franchise agreement** — royalty %, marketing fee %, reservation fee, loyalty costs
- **Management agreement** — base fee (2–4% of revenue), incentive fee (typically % of GOP or NOI above threshold)

**Core KPIs.**

- **Occupancy** = Room Nights Sold ÷ Rooms Available
- **ADR** = Rooms Revenue ÷ Room Nights Sold
- **RevPAR** = Rooms Revenue ÷ Rooms Available = Occ × ADR
- **TRevPAR** = Total Revenue ÷ Rooms Available
- **GOPPAR** = Gross Operating Profit ÷ Rooms Available
- **Flow-through** = Δ GOP ÷ Δ Revenue (year over year, month over month)
- **Cost per Occupied Room (CPOR)** — by department
- **Labor cost per Occupied Room**
- **Index metrics (STR):** MPI (occupancy index), ARI (rate index), RGI (RevPAR index). 100 = parity with compset.
- **Booking window** / pace
- **Segment mix** (Transient / Group / Contract; or Leisure / Business / Government)

**Ancillary revenue streams.**

- **F&B** — restaurant, bar, banquet, room service, minibar; often with captive ratios (% of guests using)
- **Resort fee / destination fee** — near-ubiquitous for resort properties; must be booked as separate revenue category
- **Parking** (valet vs. self-park, $/day)
- **Spa / fitness** — often outsourced with revenue share
- **Telephone / internet / in-room entertainment** — largely dead revenue streams
- **Laundry / dry-cleaning**
- **Gift shop / retail**
- **Rentals** — cabana, banquet space, A/V
- **Commission income** — for on-property tour desk, brokerage

**Expense structure (USALI-aware).**

Must model expenses by **department**, not as a single blob:

- **Rooms Department** — housekeeping labor, linen, amenities, front desk
- **F&B Department** — food cost, beverage cost, F&B labor
- **Minor Operated Departments**
- **Undistributed Operating Expenses** — A&G, Sales & Marketing (including franchise marketing/royalty if applicable), IT, POMEC (Property Operations, Maintenance, Energy), Utilities
- **Fixed Charges** — property tax, insurance, rent/ground lease
- **Management Fees** — base + incentive
- **FF&E Reserve** — 3–5% of total revenue (franchise brands often require 4%)

**Common gotchas.**

- **Resort fee accounting.** Is it in ADR or broken out? Brand standards vary. If broken out, ADR understates effective rate.
- **Comp rooms / house use.** Must be tracked to calculate correct ADR. Most PMSs treat these as zero-revenue but occupied.
- **Group vs. Transient mix.** Group rooms often carry food & beverage spend that is the actual profit driver.
- **FF&E reserve understatement.** Brokers frequently model 2–3%; franchise standards are 4%+ with a mandatory replacement cycle.
- **Franchise fee layering.** Royalty (5–6%), marketing (3–4%), loyalty (varies), reservation (varies) — can stack to 12%+ of Rooms Revenue.
- **Loyalty redemption.** Revenue is reimbursed by program but often below fair market value. Must be modeled or ADR is inflated.
- **Management fee cascade.** Base fee on revenue, incentive fee on GOP — don't double-count.
- **PIP liability.** An un-executed PIP is often the largest variance between ask price and fair value.

**Benchmark ranges.**

- Cap rates 2024–2026: 7.5%–10%+ for limited service, 6.5%–9% for full service, 5.5%–8% for luxury/resort in prime markets
- RevPAR: varies 10x+ by market tier
- GOP margin: 25–35% limited service, 30–40% full service, 35–45% luxury
- NOI margin (after FF&E reserve and management): 20–30%

### 2.3 Short-Term Rentals (STR / Vacation Rentals)

**Inventory characteristics.** Each unit is a standalone rental property (house, condo, cabin). Dimensions:

- Bedrooms, bathrooms, sleeps-N
- Property type (house, condo, cabin, apartment)
- Location/sub-market
- Amenities (pool, hot tub, water access, pet-friendly, etc.)
- Parking spaces

**Rate structure.**

- **Base nightly rate** (varies by day-of-week, season, and dynamic pricing algorithms)
- **Cleaning fee** (per stay)
- **Resort/amenity fee** (sometimes)
- **Pet fee**
- **Extra guest fee**
- **Minimum length of stay (MLOS)** — seasonal; often 2–3 nights in shoulder, 5–7 nights in peak
- **Weekly / monthly discounts**
- **Early-bird / last-minute discounts**

Rates are usually set by a dynamic pricing tool: **PriceLabs**, **Wheelhouse**, **Beyond**, **AirDNA Smart Rates**, or built-in Airbnb Smart Pricing.

**Source documents.**

- PMS / channel manager exports: **Hostaway**, **Guesty**, **Lodgify**, **OwnerRez**, **Escapia**, **Streamline**, **Hospitable** (formerly Smartbnb), **Track**
- **Airbnb transaction history** (CSV export)
- **Vrbo earnings report**
- **Booking.com statement**
- **AirDNA market reports** (comp set)
- **Cleaning fee and cleaner invoicing** (if reconciling to property costs)
- **Smart lock access logs** (not typically financial)

**Core KPIs.**

- **Occupancy** (calendar days booked ÷ days available; note: some operators report "paid occupancy" excluding owner/maintenance blocks, others include)
- **ADR** (often reported ex-cleaning-fee, sometimes all-in)
- **RevPAN / RevPAR** (Revenue Per Available Night)
- **Nights booked**
- **Average booking value**
- **Channel mix** (Airbnb vs. Vrbo vs. direct vs. Booking.com)
- **Booking window / lead time**
- **Cancellation rate**
- **Repeat guest rate** (direct channel only)
- **Review score** (financial proxy)
- **AirDNA market percentile** (for comp set)

**Ancillary revenue streams.**

- Cleaning fee (usually pass-through but sometimes profit center)
- Damage waiver / damage protection fee
- Mid-stay cleaning (extended stays)
- Package add-ons (groceries, airport transfer, tours)
- Pet fee
- Early check-in / late check-out fee

**Common gotchas.**

- **Cleaning fee classification.** Some operators book this as revenue, some as pass-through. Net effect on NOI is the same, but ADR reporting is distorted.
- **Channel commissions.** Airbnb (~3% host, plus optional guest fees); Vrbo (~5%); Booking.com (15–17%). Revenue reported on the statement is *net* on some platforms and *gross* on others. Must normalize.
- **Occupancy taxes.** Often collected-and-remitted by the platform — not revenue. Often mis-imported as revenue.
- **Owner blocks / maintenance blocks.** Must be excluded from "nights available" in the denominator or occupancy is understated.
- **Seasonality skew.** STR seasonality is often more extreme than hotels; a T-12 that starts in peak and ends in shoulder will not annualize cleanly.
- **Regulation risk.** STR bans, caps, and permit requirements — not revenue but a discount-rate/terminal-value consideration.
- **HOA/condo rules.** May cap minimum stay or ban STR entirely; some properties run "gray market."
- **Platform data fragmentation.** A full-picture export usually requires 3–5 separate sources.

**Benchmark ranges.** Extremely market-specific. Use AirDNA or local MLS short-term rental data.

### 2.4 RV Parks & Campgrounds

**Inventory characteristics.**

- **Pads** (RV sites) dimensioned by length, width, levelness, pull-through vs. back-in, full hookup (water/sewer/electric) vs. partial vs. primitive
- **Amperage** — 30A, 50A, dual
- **Cabins** (small / large / deluxe / glamping tents)
- **Tent sites**
- **Group sites**

**Tenancy tiers** (like marinas):

- **Annual** (sometimes called "park model" or "seasonal-annual")
- **Seasonal** (3–6 months)
- **Monthly**
- **Weekly**
- **Nightly**

**Rate structure.**

- `$/night`, `$/week`, `$/month`, `$/year`
- Premium for full-hookup vs. partial
- Premium for pull-through
- Holiday surcharges, event surcharges

**Source documents.**

- **Campspot** (largest campground PMS)
- **Newbook / RMS**
- **CampLife**
- **Thousand Trails** / **Encore / ELS** (if corporate-branded)
- **ReservePro**
- **KOA KampSight** (KOA-branded parks)

**Core KPIs.** Same as marina (occupied pad-nights, ADR per pad, mix by tenancy tier).

**Ancillary streams.** Camp store, firewood, propane, laundry, cabin rentals, boat/kayak rental, activities (mini-golf, arcades), event fees (weddings).

**Gotchas.** Metered electric (often pass-through), water/sewer hookups (sometimes separate), seasonal closures (a 7-month operating season means divide by 7, not 12).

**Benchmarks.** Cap rates 6%–9% (class-dependent), per-site value $15K–$60K.

### 2.5 Self-Storage

Self-storage is a **hybrid**: units are month-to-month (transient-ish) but tenure averages 1.5–3+ years (contractual-ish). Vantage models storage primarily as traditional rent roll but adds transient-style **vacancy and rate** analytics because MTM dynamics are what drive value.

**Inventory dimensions.** Unit size (e.g., 5×5, 5×10, 10×10, 10×15, 10×20, 10×30), climate control, floor, drive-up access.

**Rate structure.** `$/month` per unit. **Street rate** (advertised to new customers) vs. **in-place rate** (what existing tenants pay after ECRIs — Existing Customer Rate Increases). The **rate gap** between in-place and street is one of the most important underwriting variables.

**Source documents.** **SiteLink / storEDGE / Storable**, **Easy Storage Solutions**, **Sentinel**, **Web Self Storage**.

**Core KPIs.** Economic occupancy (revenue), physical occupancy (units), square-foot occupancy, average rate per sq ft, ECRI cadence and average magnitude, tenant tenure distribution, delinquency rate, auction frequency.

**Ancillary.** Insurance/tenant protection (major — high margin), locks, boxes/packing supplies, truck rental commissions, administrative fees, late fees.

**Gotchas.** Rate gap; promotional "first month free"; delinquency and auction revenue; climate control pricing premium 20–35%.

### 2.6 Parking

**Inventory.** Stalls, classified by:

- **Type** — self-park, valet, reserved, oversized, EV-charging
- **Level** — surface, garage, subterranean
- **Tenancy** — hourly, daily, monthly (reserved), event

**Rate structure.** Hourly (tiered), daily max, overnight, monthly reserved ($100–$600/month depending on market), event flat rate. Validation/discount agreements with nearby businesses.

**Source docs.** **Flash Parking**, **SpotHero**, **ParkMobile**, **T2 Systems**, **ABM/SP+ management reports**, **Skidata / Amano** gate system exports.

**KPIs.** Turn (transactions per stall per day), revenue per stall, daily yield, monthly contract count, %-transient vs. %-monthly.

**Ancillary.** Storage fees, retail (car wash partnerships), EV charging revenue.

**Gotchas.** Gross vs. net revenue reporting under management contracts (many garages are third-party managed and the owner sees net, after operator fee); event spike revenue; city parking tax pass-through.

### 2.7 Coworking / Flex Office

**Inventory.** Day-pass seats, dedicated desks, private offices (by headcount), conference rooms, event space.

**Tenancy.** Month-to-month for most; some 6–12 month terms for private offices (contractual — traditional rent roll).

**Rate structure.** $/day (day pass), $/month (desk or office), $/hour (conference room), $/event (event space).

**Source docs.** **Nexudus**, **OfficeRnD**, **Cobot**, **WUN**, **Essensys**.

**KPIs.** Desk utilization %, private office occupancy %, membership churn, ARPU (avg revenue per user), event revenue contribution.

**Ancillary.** Mail handling, printing, phone booths, event hosting, coffee/F&B.

**Gotchas.** Membership vs. desk occupancy distinction; churn calculation method (gross vs. net); "phantom" memberships that don't show up physically but pay.

### 2.8 Unified Asset Class Registry Entry

Each class declares its transient behavior in `ASSET_REGISTRY`:

```ts
// Example entry for marina
{
  id: 'marina',
  name: 'Marina',
  group: 'specialty',
  transient: {
    enabled: true,
    inventoryUnit: 'slip',               // noun used in UI
    inventoryUnitPlural: 'slips',
    primaryRateBasis: 'per_foot_per_night',  // or 'flat_per_night' for hotels
    unitTypeDimensions: [
      { key: 'loa_ft',      label: 'LOA (ft)',   type: 'number',  required: true },
      { key: 'beam_ft',     label: 'Beam (ft)',  type: 'number',  required: false },
      { key: 'draft_ft',    label: 'Draft (ft)', type: 'number',  required: false },
      { key: 'power',       label: 'Power',      type: 'enum',    required: true, values: ['none','30A','50A','100A','3-phase'] },
      { key: 'covered',     label: 'Covered',    type: 'boolean' },
      { key: 'dock_type',   label: 'Dock Type',  type: 'enum',    values: ['fixed','floating'] },
      { key: 'position',    label: 'Position',   type: 'enum',    values: ['end_tie','inside','fairway'] },
    ],
    tenancyClasses: ['annual','seasonal','transient'],
    ancillaryStreams: ['fuel','ship_store','restaurant','service','haulout','pumpout','detail','brokerage','launch','storage'],
    kpiSet: 'marina',
    parsers: ['dockwa','molo','marinagram','marinaoffice','generic_csv'],
  },
},
// Example entry for hotel
{
  id: 'hotel_limited_service',
  name: 'Hotel — Limited Service',
  group: 'hospitality',
  transient: {
    enabled: true,
    inventoryUnit: 'room',
    inventoryUnitPlural: 'rooms',
    primaryRateBasis: 'flat_per_night',
    unitTypeDimensions: [
      { key: 'bed_config',  label: 'Bed Config', type: 'enum', required: true,
        values: ['King','Queen','Double Queen','Double Double','Twin','Suite','Bunk'] },
      { key: 'view',        label: 'View',       type: 'enum',
        values: ['Standard','Premium','Ocean','City','Courtyard','Interior'] },
      { key: 'sqft',        label: 'Square Feet', type: 'number' },
      { key: 'ada',         label: 'ADA',         type: 'boolean' },
      { key: 'connecting',  label: 'Connecting',  type: 'boolean' },
    ],
    tenancyClasses: ['transient','group','contract'],
    ancillaryStreams: ['fnb','resort_fee','parking','spa','retail','rentals','telecom','other'],
    kpiSet: 'hotel',
    parsers: ['str_report','opera_night_audit','cloudbeds','mews','innroad','generic_csv'],
    usali: true,
  },
},
```

The registry is the single source of truth; UIs, parsers, and KPI cards all read from it.

---

## 3. CANONICAL DATA MODEL

All tables use existing Vantage conventions:
- UUID PKs (`gen_random_uuid()`)
- `org_id UUID NOT NULL` with RLS policy tied to `current_setting('app.current_org_id')`
- `property_id UUID NOT NULL REFERENCES properties(id)`
- `created_at`, `updated_at`, `created_by`, `updated_by` audit columns
- `deleted_at` soft-delete
- Imports use `pool.query()` directly — **never** `npm run db:push` (Drizzle migrations are generated manually with `drizzle-kit generate` and applied via raw SQL, consistent with existing `modeling_project_config` and `modeling_scenario_versions` patterns)

### 3.1 Entity-Relationship Overview

```
property
  ├── transient_inventory_group              (a marina, a hotel block, a campground loop)
  │     ├── transient_unit_type              (slip class, room type, pad class)
  │     │     ├── transient_inventory_unit   (the physical slip #A-12, Room 304)
  │     │     └── rate_plan
  │     │           └── rate_calendar_day    (date × unit_type × rate plan → rate)
  │     ├── booking                          (a stay, reservation, dock visit)
  │     │     ├── booking_night              (one unit × one night, denormalized)
  │     │     └── booking_charge_line        (room, tax, cleaning, etc.)
  │     ├── availability_hold                (owner block, maintenance, group hold)
  │     └── seasonality_curve
  ├── ancillary_revenue_stream               (fuel, F&B, resort fee, etc.)
  │     └── ancillary_revenue_line           (daily or monthly record)
  ├── transient_channel                      (Airbnb, Dockwa, brand.com, direct)
  ├── compset_property
  │     └── compset_snapshot                 (STR report monthly rows)
  ├── transient_kpi_snapshot                 (materialized monthly roll-ups)
  └── transient_uw_assumption_set            (forward underwriting assumptions by scenario)
```

### 3.2 Drizzle Schema (TypeScript)

All ESM with `.js` imports (existing Vantage rule):

```ts
// server/db/schema/transient.ts
import { pgTable, uuid, text, integer, decimal, boolean, timestamp, date, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { properties } from './properties.js';
import { organizations } from './organizations.js';

// ——————————————————————————————————————————————————————————
// INVENTORY
// ——————————————————————————————————————————————————————————

export const transientInventoryGroup = pgTable('transient_inventory_group', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  assetClassId: text('asset_class_id').notNull(),  // FK into ASSET_REGISTRY id
  name: text('name').notNull(),                    // "Main Basin", "Tower", "North Loop"
  description: text('description'),
  sortOrder: integer('sort_order').default(0),
  meta: jsonb('meta').default({}),                 // asset-class-specific: hurricane rating, dock type, floor
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  orgPropIdx: index('tig_org_prop_idx').on(t.orgId, t.propertyId),
}));

export const transientUnitType = pgTable('transient_unit_type', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  groupId: uuid('group_id').references(() => transientInventoryGroup.id),
  code: text('code').notNull(),                    // "40FT-50A-COV", "KING-OV"
  name: text('name').notNull(),                    // "40ft Covered 50A", "King Ocean View"
  description: text('description'),
  dimensions: jsonb('dimensions').notNull(),       // keyed by unitTypeDimensions from registry
  baseRate: decimal('base_rate', { precision: 14, scale: 4 }),  // "rack rate" or "base per foot per night"
  rateBasis: text('rate_basis').notNull(),         // 'per_foot_per_night' | 'flat_per_night' | 'per_month' | 'per_year'
  maxOccupancy: integer('max_occupancy'),
  inventoryCount: integer('inventory_count').notNull(),  // convenience cache of count(units)
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  propCodeUq: uniqueIndex('tut_prop_code_uq').on(t.propertyId, t.code),
}));

export const transientInventoryUnit = pgTable('transient_inventory_unit', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  groupId: uuid('group_id').references(() => transientInventoryGroup.id),
  unitTypeId: uuid('unit_type_id').notNull().references(() => transientUnitType.id),
  identifier: text('identifier').notNull(),        // "A-12", "Room 304", "Pad 27"
  status: text('status').notNull().default('active'),  // 'active' | 'ooo' | 'decommissioned'
  activationDate: date('activation_date'),
  decommissionDate: date('decommission_date'),
  attributes: jsonb('attributes').default({}),     // unit-specific overrides of unit_type dimensions
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  propIdentUq: uniqueIndex('tiu_prop_ident_uq').on(t.propertyId, t.identifier),
  unitTypeIdx: index('tiu_unit_type_idx').on(t.unitTypeId),
}));

// ——————————————————————————————————————————————————————————
// RATE PLANS & RATE CALENDAR
// ——————————————————————————————————————————————————————————

export const ratePlan = pgTable('transient_rate_plan', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  code: text('code').notNull(),                    // "BAR", "AAA", "TRANSIENT_NIGHTLY", "SEASONAL_WINTER"
  name: text('name').notNull(),
  type: text('type').notNull(),                    // 'bar' | 'discounted' | 'corporate' | 'group' | 'seasonal' | 'transient' | 'annual'
  derivationRule: jsonb('derivation_rule'),        // e.g. { mode:'percent_off_bar', value: 0.10 }
  channelIds: jsonb('channel_ids').default([]),    // UUIDs of channels this plan sells through
  isActive: boolean('is_active').notNull().default(true),
  effectiveFrom: date('effective_from'),
  effectiveTo: date('effective_to'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  propCodeUq: uniqueIndex('rp_prop_code_uq').on(t.propertyId, t.code),
}));

export const rateCalendarDay = pgTable('transient_rate_calendar_day', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  unitTypeId: uuid('unit_type_id').notNull().references(() => transientUnitType.id),
  ratePlanId: uuid('rate_plan_id').notNull().references(() => ratePlan.id),
  date: date('date').notNull(),
  rate: decimal('rate', { precision: 14, scale: 4 }).notNull(),
  minLos: integer('min_los'),
  maxLos: integer('max_los'),
  closedToArrival: boolean('closed_to_arrival').default(false),
  closedToDeparture: boolean('closed_to_departure').default(false),
  source: text('source').default('manual'),        // 'manual' | 'parsed' | 'dynamic_pricing' | 'derived_from_bar'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  uniq: uniqueIndex('rcd_uq').on(t.propertyId, t.unitTypeId, t.ratePlanId, t.date),
  propDateIdx: index('rcd_prop_date_idx').on(t.propertyId, t.date),
}));

// ——————————————————————————————————————————————————————————
// CHANNELS
// ——————————————————————————————————————————————————————————

export const transientChannel = pgTable('transient_channel', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  code: text('code').notNull(),                    // 'airbnb' | 'vrbo' | 'booking_com' | 'brand_com' | 'direct' | 'dockwa' | 'walk_in'
  name: text('name').notNull(),
  kind: text('kind').notNull(),                    // 'ota' | 'direct' | 'gds' | 'wholesaler' | 'group' | 'walk_in'
  commissionPct: decimal('commission_pct', { precision: 5, scale: 4 }),  // 0.15 = 15%
  commissionFlat: decimal('commission_flat', { precision: 14, scale: 4 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  propCodeUq: uniqueIndex('ch_prop_code_uq').on(t.propertyId, t.code),
}));

// ——————————————————————————————————————————————————————————
// BOOKINGS (THE CORE FACT TABLE)
// ——————————————————————————————————————————————————————————

export const booking = pgTable('transient_booking', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  externalId: text('external_id'),                 // confirmation code from source system
  externalSource: text('external_source'),         // 'hostaway' | 'airbnb' | 'dockwa' | etc.
  unitId: uuid('unit_id').references(() => transientInventoryUnit.id),
  unitTypeId: uuid('unit_type_id').notNull().references(() => transientUnitType.id),
  channelId: uuid('channel_id').references(() => transientChannel.id),
  ratePlanId: uuid('rate_plan_id').references(() => ratePlan.id),

  tenancyClass: text('tenancy_class').notNull(),   // 'transient' | 'seasonal' | 'annual' | 'group' | 'contract' | 'house_use' | 'comp'
  status: text('status').notNull(),                // 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show' | 'comp'

  checkIn: date('check_in').notNull(),
  checkOut: date('check_out').notNull(),
  nights: integer('nights').notNull(),             // precomputed checkout - checkin
  adultCount: integer('adult_count'),
  childCount: integer('child_count'),
  vesselLoaFt: decimal('vessel_loa_ft', { precision: 6, scale: 2 }),  // marina-specific, nullable
  vesselInfo: jsonb('vessel_info'),                 // make/model/draft/beam for marina

  grossRevenue: decimal('gross_revenue', { precision: 14, scale: 2 }).notNull(),
  roomRevenue: decimal('room_revenue', { precision: 14, scale: 2 }),    // base rate revenue only
  fees: decimal('fees', { precision: 14, scale: 2 }),                   // cleaning, resort, pet, extra guest
  taxes: decimal('taxes', { precision: 14, scale: 2 }),
  discount: decimal('discount', { precision: 14, scale: 2 }),
  commission: decimal('commission', { precision: 14, scale: 2 }),       // channel commission
  netRevenue: decimal('net_revenue', { precision: 14, scale: 2 }),      // after commission and refunds
  adr: decimal('adr', { precision: 14, scale: 4 }),                     // precomputed roomRevenue / nights

  guestName: text('guest_name'),                   // may be null if PII-suppressed
  guestEmail: text('guest_email'),                 // optional
  bookedAt: timestamp('booked_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  leadTimeDays: integer('lead_time_days'),         // bookedAt to checkIn

  meta: jsonb('meta').default({}),                 // raw source row for audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  propCheckInIdx: index('bk_prop_checkin_idx').on(t.propertyId, t.checkIn),
  unitCheckInIdx: index('bk_unit_checkin_idx').on(t.unitId, t.checkIn),
  unitTypeCheckInIdx: index('bk_ut_checkin_idx').on(t.unitTypeId, t.checkIn),
  extUq: uniqueIndex('bk_ext_uq').on(t.propertyId, t.externalSource, t.externalId),
}));

// Denormalized "exploded" booking for fast night-level aggregation.
// Written at booking insert/update time via a trigger or application logic.
export const bookingNight = pgTable('transient_booking_night', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  bookingId: uuid('booking_id').notNull().references(() => booking.id, { onDelete: 'cascade' }),
  unitId: uuid('unit_id').references(() => transientInventoryUnit.id),
  unitTypeId: uuid('unit_type_id').notNull().references(() => transientUnitType.id),
  stayDate: date('stay_date').notNull(),
  tenancyClass: text('tenancy_class').notNull(),
  channelId: uuid('channel_id'),
  nightlyRate: decimal('nightly_rate', { precision: 14, scale: 4 }).notNull(),
  nightlyFees: decimal('nightly_fees', { precision: 14, scale: 4 }),
  isComp: boolean('is_comp').default(false),
}, (t) => ({
  propDateIdx: index('bn_prop_date_idx').on(t.propertyId, t.stayDate),
  unitDateIdx: index('bn_unit_date_idx').on(t.unitId, t.stayDate),
  utDateIdx: index('bn_ut_date_idx').on(t.unitTypeId, t.stayDate),
}));

export const bookingChargeLine = pgTable('transient_booking_charge_line', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  bookingId: uuid('booking_id').notNull().references(() => booking.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),            // 'room' | 'cleaning' | 'resort_fee' | 'pet_fee' | 'parking' | 'tax' | 'discount' | 'commission' | 'misc'
  description: text('description'),
  amount: decimal('amount', { precision: 14, scale: 4 }).notNull(),
  chargedOn: date('charged_on'),
  meta: jsonb('meta').default({}),
});

// ——————————————————————————————————————————————————————————
// AVAILABILITY HOLDS (OOO, OWNER BLOCKS, GROUP HOLDS)
// ——————————————————————————————————————————————————————————

export const availabilityHold = pgTable('transient_availability_hold', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  unitId: uuid('unit_id').references(() => transientInventoryUnit.id),
  unitTypeId: uuid('unit_type_id').references(() => transientUnitType.id),
  kind: text('kind').notNull(),                    // 'ooo' | 'owner_block' | 'maintenance' | 'group_hold' | 'renovation' | 'seasonal_closure'
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  note: text('note'),
  excludeFromOccupancyDenominator: boolean('exclude_from_occupancy_denominator').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ——————————————————————————————————————————————————————————
// ANCILLARY REVENUE
// ——————————————————————————————————————————————————————————

export const ancillaryStream = pgTable('transient_ancillary_stream', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  code: text('code').notNull(),                    // 'fuel' | 'fnb' | 'resort_fee' | 'service' | 'retail' | 'parking'
  name: text('name').notNull(),
  category: text('category').notNull(),            // 'revenue' | 'pass_through' | 'tax' | 'deposit'
  marginMode: text('margin_mode'),                 // 'gross' | 'net_only' | 'cogs_pct' | 'flat_margin'
  defaultMarginPct: decimal('default_margin_pct', { precision: 5, scale: 4 }),
  linkedDepartmentCode: text('linked_department_code'),  // 'fuel_dept', 'fnb_dept' — for P&L mapping
  isActive: boolean('is_active').default(true),
  meta: jsonb('meta').default({}),
}, (t) => ({
  propCodeUq: uniqueIndex('anc_prop_code_uq').on(t.propertyId, t.code),
}));

export const ancillaryRevenueLine = pgTable('transient_ancillary_revenue_line', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  streamId: uuid('stream_id').notNull().references(() => ancillaryStream.id),
  period: date('period').notNull(),                // first-of-month convention for monthly rollups, or exact date for daily
  periodGranularity: text('period_granularity').notNull(),  // 'day' | 'week' | 'month'
  grossRevenue: decimal('gross_revenue', { precision: 14, scale: 2 }),
  cogs: decimal('cogs', { precision: 14, scale: 2 }),
  netRevenue: decimal('net_revenue', { precision: 14, scale: 2 }),
  unitsSold: decimal('units_sold', { precision: 14, scale: 4 }),   // gallons of fuel, covers of F&B, etc.
  source: text('source').default('manual'),
  meta: jsonb('meta').default({}),
}, (t) => ({
  streamPeriodIdx: index('arl_stream_period_idx').on(t.streamId, t.period),
}));

// ——————————————————————————————————————————————————————————
// SEASONALITY
// ——————————————————————————————————————————————————————————

export const seasonalityCurve = pgTable('transient_seasonality_curve', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  unitTypeId: uuid('unit_type_id').references(() => transientUnitType.id),  // null = property-wide
  metric: text('metric').notNull(),                // 'occupancy' | 'adr' | 'revenue'
  source: text('source').notNull(),                // 'historical_derived' | 'manual' | 'compset_overlay'
  monthIndices: jsonb('month_indices').notNull(),  // [1.00, 0.85, ..., 1.20]  — 12 monthly multipliers where 1.0 = annual avg
  dowIndices: jsonb('dow_indices'),                // [0.80, 0.75, 0.85, 0.90, 1.10, 1.35, 1.25] Mon–Sun
  derivedFromYears: jsonb('derived_from_years'),   // ['2023','2024']
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ——————————————————————————————————————————————————————————
// COMP SET
// ——————————————————————————————————————————————————————————

export const compsetProperty = pgTable('transient_compset_property', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  compName: text('comp_name').notNull(),
  addressLine: text('address_line'),
  lat: decimal('lat', { precision: 9, scale: 6 }),
  lng: decimal('lng', { precision: 9, scale: 6 }),
  inventoryCount: integer('inventory_count'),
  yearBuilt: integer('year_built'),
  yearRenovated: integer('year_renovated'),
  brandAffiliation: text('brand_affiliation'),
  classTier: text('class_tier'),                   // 'luxury' | 'upper_upscale' | 'upscale' | 'midscale' | 'economy'
  notes: text('notes'),
});

export const compsetSnapshot = pgTable('transient_compset_snapshot', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  period: date('period').notNull(),
  occupancy: decimal('occupancy', { precision: 5, scale: 4 }),
  adr: decimal('adr', { precision: 14, scale: 4 }),
  revpar: decimal('revpar', { precision: 14, scale: 4 }),
  mpi: decimal('mpi', { precision: 7, scale: 3 }),  // market penetration index
  ari: decimal('ari', { precision: 7, scale: 3 }),  // ADR index
  rgi: decimal('rgi', { precision: 7, scale: 3 }),  // RevPAR index
  source: text('source').notNull(),                 // 'str_report' | 'airdna' | 'manual'
});

// ——————————————————————————————————————————————————————————
// KPI MATERIALIZATION (for dashboard performance)
// ——————————————————————————————————————————————————————————

export const kpiSnapshot = pgTable('transient_kpi_snapshot', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  unitTypeId: uuid('unit_type_id'),                // null = property-wide
  period: date('period').notNull(),                // first-of-month
  granularity: text('granularity').notNull(),      // 'day' | 'week' | 'month' | 'year'
  inventoryNights: integer('inventory_nights'),    // denominator
  soldNights: integer('sold_nights'),              // numerator (excluding comps / OOO per policy)
  compNights: integer('comp_nights'),
  oooNights: integer('ooo_nights'),
  grossRoomRevenue: decimal('gross_room_revenue', { precision: 14, scale: 2 }),
  netRoomRevenue: decimal('net_room_revenue', { precision: 14, scale: 2 }),
  ancillaryRevenue: decimal('ancillary_revenue', { precision: 14, scale: 2 }),
  totalRevenue: decimal('total_revenue', { precision: 14, scale: 2 }),
  occupancy: decimal('occupancy', { precision: 5, scale: 4 }),
  adr: decimal('adr', { precision: 14, scale: 4 }),
  revpar: decimal('revpar', { precision: 14, scale: 4 }),
  trevpar: decimal('trevpar', { precision: 14, scale: 4 }),
  avgLos: decimal('avg_los', { precision: 5, scale: 2 }),
  computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  propPeriodGranUtUq: uniqueIndex('kpi_prop_period_gran_ut_uq').on(t.propertyId, t.period, t.granularity, t.unitTypeId),
}));

// ——————————————————————————————————————————————————————————
// UNDERWRITING ASSUMPTIONS (SCENARIO-AWARE, RLS-PROTECTED)
// ——————————————————————————————————————————————————————————
// NOTE: This table is RLS-protected — use raw pool.query() to read/write,
// following the existing pattern from modeling_project_config and modeling_scenario_versions.

export const transientUwAssumptionSet = pgTable('transient_uw_assumption_set', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  projectId: uuid('project_id').notNull(),         // ties to modeling project
  scenarioVersionId: uuid('scenario_version_id'),  // ties to modeling_scenario_versions
  label: text('label').notNull(),                  // 'Base Case', 'Upside', 'Downside'
  assumptions: jsonb('assumptions').notNull(),     // see structure below
  derivedFrom: jsonb('derived_from'),              // which history was used
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

/* Shape of `assumptions` JSONB:
{
  horizon: { years: 10, startDate: '2026-01-01' },
  inventory: [
    {
      unitTypeId: '...',
      count: 40,
      yearOneAvailableNights: 14600,
      stabilizedYear: 2,
      rampCurve: [0.60, 0.85, 1.00, ...]   // % of stabilized occupancy by year
    }
  ],
  occupancyByYear: [0.62, 0.68, 0.72, 0.74, 0.75, ...],
  adrByYear: [185, 192, 198, 203, 207, ...],
  adrGrowth: 0.03,
  occupancyGrowth: 0.01,
  seasonalityCurveId: '...',
  channelMix: { airbnb: 0.45, vrbo: 0.25, direct: 0.20, bookingCom: 0.10 },
  avgCommissionPct: 0.08,
  ancillaryGrowth: 0.03,
  otherIncomePctRoomRev: 0.05,
  managementFeeBase: 0.03,
  managementFeeIncentive: { thresholdGopMargin: 0.30, aboveThresholdPct: 0.15 },
  franchiseFee: { royaltyPct: 0.05, marketingPct: 0.04, reservationPct: 0.02, loyaltyPctRoomRev: 0.035 },
  ffeReservePct: 0.04,
  stabilizationMonths: 24,
  terminalCapRate: 0.075,
  exitCostPct: 0.02,
  // Monte Carlo overlay
  mcVariables: {
    occupancyRange: { min: 0.55, mode: 0.70, max: 0.80, distribution: 'triangular' },
    adrRange:       { min: 170, mode: 195, max: 215, distribution: 'triangular' },
    seasonalityDeviationStdev: 0.08,
    commissionPctRange: { min: 0.05, max: 0.12, distribution: 'uniform' }
  }
}
*/
```

### 3.3 RLS Policies (Raw SQL)

```sql
ALTER TABLE transient_uw_assumption_set ENABLE ROW LEVEL SECURITY;

CREATE POLICY tuas_org_isolation ON transient_uw_assumption_set
  USING (org_id::text = current_setting('app.current_org_id', true));

CREATE POLICY tuas_org_isolation_write ON transient_uw_assumption_set
  FOR ALL
  TO application_role
  USING (org_id::text = current_setting('app.current_org_id', true))
  WITH CHECK (org_id::text = current_setting('app.current_org_id', true));
```

Apply equivalent RLS policies to every `transient_*` table. **Reads and writes to `transient_uw_assumption_set` must use `pool.query()`** — not Drizzle — because of the existing Vantage pattern where RLS-sensitive scenario tables are not accessed through the ORM (to preserve the per-request `app.current_org_id` setting applied by auth middleware).

### 3.4 Polymorphic Attributes — Validation

A single `dimensions` JSONB column on `transient_unit_type` holds asset-class-specific attributes (LOA for marinas, bed config for hotels, pad type for RV parks). Validation is done at the application layer using the asset class's `unitTypeDimensions` contract in `ASSET_REGISTRY`:

```ts
// server/transient/validation.ts
import { ASSET_REGISTRY } from '../registry/assetRegistry.js';

export function validateUnitTypeDimensions(assetClassId: string, dims: Record<string, unknown>) {
  const cls = ASSET_REGISTRY[assetClassId];
  if (!cls?.transient?.enabled) throw new Error('Not transient-enabled');
  const spec = cls.transient.unitTypeDimensions;
  for (const d of spec) {
    const v = dims[d.key];
    if (d.required && (v === undefined || v === null || v === ''))
      throw new Error(`Missing required dimension: ${d.key}`);
    if (v !== undefined && v !== null) {
      if (d.type === 'number' && typeof v !== 'number') throw new Error(`${d.key} must be number`);
      if (d.type === 'boolean' && typeof v !== 'boolean') throw new Error(`${d.key} must be boolean`);
      if (d.type === 'enum' && !d.values.includes(v)) throw new Error(`${d.key} must be one of ${d.values.join(',')}`);
    }
  }
  return true;
}
```

### 3.5 Exploded Bookings — Why and How

`booking_night` is **denormalized** (one row per unit-night) because:

1. Aggregations like "Occupancy in March 2025" become a trivial COUNT/SUM on a single indexed table, avoiding range-expand joins.
2. Ancillary reporting (per-night RevPAR by day of week) is a GROUP BY.
3. Seasonality derivation, MC sampling, and KPI snapshot generation all consume this table.

Write pattern:

- On `INSERT` or `UPDATE` of `booking`, application logic expands the date range into `booking_night` rows (or updates existing rows for the delta).
- On `DELETE`/`CANCEL`, the child rows cascade-delete.
- Nightly rate is derived from: `grossRevenue - fees - taxes` ÷ `nights`, OR explicitly from parser when source provides it.
- Implement as a PostgreSQL trigger OR a well-tested application service. **Trigger is preferred** to guarantee consistency. Provide both for testability.

```sql
CREATE OR REPLACE FUNCTION explode_booking_nights()
RETURNS TRIGGER AS $$
DECLARE
  d DATE;
  nightly_rate NUMERIC;
  nightly_fees NUMERIC;
BEGIN
  -- Remove existing nights for this booking
  DELETE FROM transient_booking_night WHERE booking_id = NEW.id;
  IF NEW.status IN ('cancelled','no_show') THEN
    RETURN NEW;
  END IF;

  nightly_rate := COALESCE(NEW.room_revenue, NEW.gross_revenue - COALESCE(NEW.fees,0) - COALESCE(NEW.taxes,0))
                  / GREATEST(NEW.nights, 1);
  nightly_fees := COALESCE(NEW.fees,0) / GREATEST(NEW.nights, 1);

  d := NEW.check_in;
  WHILE d < NEW.check_out LOOP
    INSERT INTO transient_booking_night (
      org_id, property_id, booking_id, unit_id, unit_type_id, stay_date,
      tenancy_class, channel_id, nightly_rate, nightly_fees, is_comp
    ) VALUES (
      NEW.org_id, NEW.property_id, NEW.id, NEW.unit_id, NEW.unit_type_id, d,
      NEW.tenancy_class, NEW.channel_id, nightly_rate, nightly_fees,
      NEW.tenancy_class IN ('comp','house_use')
    );
    d := d + INTERVAL '1 day';
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_explode_booking_nights
  AFTER INSERT OR UPDATE ON transient_booking
  FOR EACH ROW EXECUTE FUNCTION explode_booking_nights();
```

---

## 4. DOCUMENT INGESTION PIPELINE

This section extends the existing `VANTAGE_DOCUMENT_INTELLIGENCE_SPEC.md`. Reuse the same architecture (claude-opus-4-6 extraction, confidence scoring, cell-by-cell review UI, commit-to-canonical). This section describes the **transient-specific extractors**.

### 4.1 Source Document Catalog

| Asset Class | Source System | Common Formats | Primary Extraction Target |
|---|---|---|---|
| Marina | Dockwa | CSV export, PDF statement | Bookings + inventory + rate cards |
| Marina | Molo / Oasis | CSV, XLSX | Bookings + tenancy classification |
| Marina | Marinagram | XLSX | Inventory + annual tenant roll |
| Marina | MarinaOffice / MarinaGO | XLSX | Bookings + fuel sales |
| Marina | Speedydock (dry stack) | CSV | Rack bookings + launch requests |
| Hotel | STR / CoStar | PDF, XLSX | Compset metrics (Occ/ADR/RevPAR, MPI/ARI/RGI) |
| Hotel | Opera Cloud night audit | PDF, XLSX | Daily segment detail |
| Hotel | Cloudbeds | CSV, PDF | Bookings + rate plans |
| Hotel | Mews | CSV export | Bookings |
| Hotel | innRoad | XLSX | Bookings + night audit |
| STR | Hostaway | CSV, XLSX | Bookings + channel breakdown |
| STR | Guesty | CSV, XLSX | Bookings |
| STR | Airbnb | CSV (transaction history) | Bookings (net of commission) |
| STR | Vrbo | CSV | Bookings |
| STR | Booking.com | XLSX statement | Bookings |
| STR | OwnerRez | CSV | Bookings |
| RV Park | Campspot | CSV | Bookings + pad inventory |
| RV Park | Newbook | CSV | Bookings |
| Self-Storage | SiteLink / storEDGE | CSV | Unit inventory + in-place rates |
| Parking | Flash Parking | CSV | Transaction log |
| Coworking | Nexudus / OfficeRnD | CSV | Members + usage |
| Any | QuickBooks P&L | PDF, XLSX | Revenue tie-out to parsed room revenue |

### 4.2 Parser Architecture

A single pipeline with swappable extractors. Reuse the existing Vantage doc intelligence flow:

```
Upload → Classify → Route → Extract → Validate → Score → Review UI → Commit → Reconcile
```

**Step 1 — Classify.** A lightweight classifier (also claude-opus-4-6 but cheaper prompt) reads the first 2–3 pages/rows and returns:

```json
{
  "docType": "marina_dockwa_booking_export",
  "confidence": 0.94,
  "alternativeCandidates": [
    { "docType": "generic_csv_booking", "confidence": 0.35 }
  ]
}
```

Classifier prompt includes known document fingerprints (column headers, title strings, format signatures). Maintain a fingerprints registry:

```ts
// server/transient/ingestion/fingerprints.ts
export const DOC_FINGERPRINTS = [
  {
    docType: 'marina_dockwa_booking_export',
    signals: {
      headerMatches: ['Reservation ID', 'Vessel Name', 'LOA', 'Arrival', 'Departure', 'Total Paid'],
      filenamePatterns: [/dockwa.*\.csv/i, /reservations.*\.xlsx/i],
    },
  },
  {
    docType: 'hotel_str_report',
    signals: {
      headerMatches: ['Occ %', 'ADR', 'RevPAR', 'MPI', 'ARI', 'RGI'],
      contentKeywords: ['Smith Travel', 'STR', 'Competitive Set', 'Subject Property'],
    },
  },
  // ... etc
];
```

**Step 2 — Route.** Each `docType` maps to an extractor module.

**Step 3 — Extract.** Two strategies composed:

- **Deterministic first:** For well-structured CSVs with stable column names, use a hand-written parser. Fast and free.
- **LLM fallback:** For PDFs, inconsistent XLSXs, or when deterministic parser fails validation, invoke `claude-opus-4-6` with a structured-output prompt.

The LLM prompt template:

```
You are extracting booking records from a {docType} document.

REQUIRED FIELDS (per booking):
- confirmation_code (string, from source)
- check_in (YYYY-MM-DD)
- check_out (YYYY-MM-DD)
- nights (integer)
- unit_type_name (string)
- unit_identifier (string, nullable)
- tenancy_class (one of: transient|seasonal|annual|group|contract|house_use|comp)
- channel_name (string, nullable)
- gross_revenue (decimal, currency USD)
- room_revenue (decimal, nullable)
- fees (decimal, nullable)
- taxes (decimal, nullable)
- discount (decimal, nullable)
- commission (decimal, nullable)
- vessel_loa_ft (decimal, nullable — marina only)
- guest_name (string, nullable)
- booked_at (ISO timestamp, nullable)

Return STRICT JSON matching the schema below. For each field, also return a confidence
score (0–1) and the source cell reference (sheet/row/col for XLSX, page/bbox for PDF).

{schema…}

DOCUMENT CONTENT:
{doc_content_or_chunks}
```

For large documents, chunk the content and merge results. For PDFs, pre-process with the existing `pdfjs-dist` geometry-based pipeline (see existing P&L Parser v2 in Vantage).

**Step 4 — Validate.** The deterministic validator runs after either extraction method:

- Dates parse correctly, check_in < check_out, nights = checkOut − checkIn
- Revenue sanity: grossRevenue ≈ roomRevenue + fees + taxes (within $1 tolerance)
- If roomRevenue null, infer = grossRevenue − fees − taxes
- Tenancy class mapped to allowed enum
- Channel name mapped to existing `transient_channel` or queued for creation
- Unit type name mapped to existing `transient_unit_type` or queued for creation
- External ID deduped within property

Each validation issue is logged with severity (`error`, `warning`, `info`) and attached to the row for the review UI.

**Step 5 — Score.** Per-row confidence = min of per-field confidences, weighted by criticality (dates and revenue are critical; guest name is not). Aggregate per-document confidence = weighted average.

Thresholds (configurable):

- `>= 0.95`: Auto-accept all rows
- `0.80 – 0.95`: Present for spot-check review (sample 10% highlighted)
- `< 0.80`: Full manual review required

**Step 6 — Review UI.** The existing Vantage cell-by-cell review UI is extended with a "Transient Booking Review" tab:

- Grid view with all parsed bookings, confidence badges
- Side panel showing source evidence (PDF page thumbnail with bounding box OR Excel source cell range)
- Inline edit for corrected values
- Bulk-apply corrections for systemic issues ("all channel='Air BnB' → 'airbnb'")
- "Ignore" rows that are obvious duplicates or non-data rows

**Step 7 — Commit.** On commit:

1. Upsert `transient_channel` rows for any new channel_name values encountered (with a default commission from the lookup table)
2. Upsert `transient_unit_type` rows for any new unit types (with default dimensions — flagged for later completion)
3. Insert `booking` rows with `external_source` = the parser's docType
4. Trigger fires to populate `booking_night`
5. Recompute affected `transient_kpi_snapshot` rows for the periods covered

**Step 8 — Reconcile.** After commit, run the **G/L tie-out**:

- Aggregate parsed `room_revenue` by month
- Pull the corresponding revenue account from the property's P&L (if the P&L Parser v2 output is available)
- Compute variance %
- If variance > 2% tolerance (configurable per asset class), surface a reconciliation warning on the property dashboard

```ts
interface ReconciliationReport {
  month: string;
  parsedRoomRevenue: number;
  glRoomRevenue: number | null;
  varianceAbs: number;
  variancePct: number | null;
  status: 'match' | 'within_tolerance' | 'warning' | 'missing_gl';
}
```

### 4.3 Asset-Class-Specific Extraction Notes

**Marina — Dockwa CSV.** Typical columns include: `Reservation ID, Status, Check-in, Check-out, Vessel, LOA, Beam, Slip, Total Paid, Deposit, Balance, Source`. The `Source` column often contains `'Dockwa Marketplace' | 'Reservation' | 'Walk-in' | 'Owner'` — map these to channel codes. Rate is implied from `Total Paid / Nights / LOA` for per-foot marinas.

**Marina — Molo export.** Molo exports tenancy classification explicitly (`Annual`, `Seasonal`, `Transient`) in a separate column. Respect it as source of truth. Molo also exports submeter reads for metered electric — should feed the electric pass-through line.

**STR report (hotel).** Parse monthly rows for: Subject property Occ/ADR/RevPAR + Competitive Set Occ/ADR/RevPAR + Index values. Populate `compset_snapshot` rows. **Do not parse as bookings** — STR is a benchmark document, not a booking ledger.

**Opera night audit.** The daily "Manager's Flash" or "Daily Summary" report contains segment-level occupancy and ADR. Parse into daily KPI rows; segment detail goes into `booking_night` at an aggregate level (no individual confirmation codes). Treat as a "synthetic booking" per segment per day when confirmation-level detail is not available.

**Hostaway CSV.** Ubiquitous for Brett's own StayMate integration. Columns: `Reservation ID, Listing Name, Channel, Check-in, Check-out, Nights, Adults, Children, Guest Name, Base Rate, Cleaning Fee, Host Fee, Channel Fee, Total, Currency, Status`. Channel names come in as 'airbnbOfficial', 'homeaway', 'bookingEngine', 'direct' — normalize.

**Airbnb transaction history.** Reports payouts **net of service fees**. A common trap: the "Amount" column is already minus Airbnb's host service fee. For ADR reporting, must use "Gross Earnings" or compute from nightly rate × nights. Also note: Airbnb lumps cleaning fees into the listing sub-total in some exports — parser must detect format version.

**Vrbo earnings.** Reports gross guest payment and Vrbo service fee separately. Tax is often embedded; verify against jurisdiction.

**Booking.com statement.** Reports commission-inclusive revenue and deducts commission in a separate line. Parser must map both to get net revenue correctly.

**Campspot.** CSV with clear headers; tenancy class field `'Nightly' | 'Weekly' | 'Monthly' | 'Seasonal' | 'Annual'`.

**SiteLink / Storable.** Monthly roll-up format is preferred for storage: unit count, occupancy, in-place rent, street rate. Individual move-in/move-out logs are useful for churn analytics but not required for Pro Forma.

### 4.4 Direct StayMate Sync (Brett's Portfolio)

For Brett's own STR portfolio, Vantage has a direct API sync option:

```ts
// server/transient/ingestion/staymateSync.ts
import { getStayMateClient } from '../../integrations/staymate.js';

export async function syncStayMateProperty(opts: { propertyId: string; stayMateOrgSlug: string; startDate: string; endDate: string; }) {
  const client = getStayMateClient();
  const reservations = await client.listReservations({ orgSlug: opts.stayMateOrgSlug, from: opts.startDate, to: opts.endDate });
  // Map StayMate reservation shape → Vantage booking shape
  // Upsert via existing ingestion commit path
}
```

StayMate is the source of truth for Brett's Palm Paradise, Harbor Hideaway, The Palm Retreat — direct sync eliminates the parse step for those properties. Same canonical commit path is used.


---

## 5. ANALYSIS & UNDERWRITING ENGINE

### 5.1 KPI Calculation Definitions

All KPI calculations must use **inclusive/exclusive policies** that the user can toggle. Defaults align with industry standards (USALI for hotels, marina industry norms, STR industry norms).

```ts
// server/transient/kpi/policies.ts
export interface KpiPolicy {
  includeCompsInOccupancy: boolean;       // default: true (USALI: include comps)
  includeCompsInAdr: boolean;             // default: false (exclude $0 rooms from ADR denominator)
  includeHouseUseInOccupancy: boolean;    // default: true
  includeHouseUseInAdr: boolean;          // default: false
  includeOooInDenominator: boolean;       // default: true for short OOO, false for multi-day closures
  oooExclusionThresholdDays: number;      // default: 7 (> this many consecutive days → exclude)
  includeOwnerBlocksInDenominator: boolean;  // default: false for STR
  cleaningFeeInAdr: boolean;              // default: false (ADR is typically room-only)
  resortFeeInAdr: boolean;                // default: false (resort fee separate)
  taxInRevenue: boolean;                  // default: false (revenue is pre-tax)
}
```

Core formulas (pseudocode):

```ts
function computeKpis(propertyId: string, period: { start: Date; end: Date }, policy: KpiPolicy) {
  const availableNights = computeAvailableNights(propertyId, period, policy);
  const occupiedNights = countBookingNights(propertyId, period, {
    excludeComps: !policy.includeCompsInOccupancy,
    excludeHouseUse: !policy.includeHouseUseInOccupancy,
  });
  const roomRevenue = sumRoomRevenue(propertyId, period, {
    excludeComps: !policy.includeCompsInAdr,
    excludeHouseUse: !policy.includeHouseUseInAdr,
  });
  const revenueDenomNights = countBookingNights(propertyId, period, {
    excludeComps: !policy.includeCompsInAdr,
    excludeHouseUse: !policy.includeHouseUseInAdr,
  });
  const occupancy = availableNights > 0 ? occupiedNights / availableNights : 0;
  const adr = revenueDenomNights > 0 ? roomRevenue / revenueDenomNights : 0;
  const revpar = availableNights > 0 ? roomRevenue / availableNights : 0;
  // ...
}
```

**Marina analog:** replace "rooms" with "slips" or "slip-feet" — RevPAR becomes "revenue per available slip-night" or (more meaningfully) "revenue per available foot-night" when LOA-normalized.

### 5.2 Segmentation Cuts

The analytics engine must produce every KPI sliced by:

- **Time** — day, week, month, quarter, year; year-over-year overlay
- **Unit type** — and group
- **Tenancy class** — transient / seasonal / annual / group / contract / comp
- **Channel** — individual channels plus a direct/OTA/wholesale grouping
- **LOS bucket** — 1 night, 2–3, 4–6, 7–13, 14–29, 30+ (for STR/marina; hotels usually tighter buckets 1/2–4/5+)
- **Day-of-week** — Sun–Sat

Each KPI endpoint accepts a `groupBy` parameter:

```
GET /api/v1/transient/kpis?propertyId=...&from=2024-01-01&to=2024-12-31&groupBy=month,unitType
```

### 5.3 Seasonality Auto-Derivation

Given 12+ months of history, derive monthly indices:

```ts
// For each unit type (or property-wide):
// 1. Sum monthly room nights sold for each of the last N full calendar months
// 2. Compute annual mean
// 3. monthIndex_i = monthValue_i / annualMean
// 4. Apply Laplace smoothing if any month has zero activity (new asset)
```

DOW indices are derived similarly from daily data. Both are stored in `seasonality_curve` with `source='historical_derived'`.

Smoothing strategy: if < 24 months available, auto-blend with compset or asset-class benchmark curve. The benchmark curves are stored as static data in `ASSET_REGISTRY`:

```ts
// Marina (Northeast US)
seasonalityBenchmark: {
  monthIndices: [0.15, 0.15, 0.20, 0.50, 1.10, 1.70, 2.10, 2.00, 1.50, 0.75, 0.25, 0.20],
  // low in winter, peak July/Aug
},
// Marina (Florida / Gulf Coast)
seasonalityBenchmark: {
  monthIndices: [1.30, 1.35, 1.40, 1.20, 0.90, 0.65, 0.55, 0.55, 0.65, 0.90, 1.20, 1.35],
  // inverse — winter peak, summer trough
},
// Hotel — leisure beach market
seasonalityBenchmark: {
  monthIndices: [0.70, 0.75, 0.95, 1.10, 1.15, 1.25, 1.30, 1.25, 1.05, 0.95, 0.75, 0.80],
},
```

### 5.4 Stabilization Modeling

Three stabilization archetypes:

1. **Mature asset** — no ramp. Year 1 = stabilized.
2. **New construction / redevelopment** — 18–36 month ramp from opening day to stabilization. Typical curves:
   - Hotel limited service: `[0.50, 0.75, 0.95, 1.00]` by year
   - Hotel full service: `[0.45, 0.70, 0.90, 1.00]`
   - Marina (new dock): `[0.30, 0.60, 0.85, 1.00]` — waitlist fills gradually
   - STR (new market entry): `[0.40, 0.70, 0.90, 1.00]` — Airbnb algorithm favors established listings
3. **Repositioning** — 12–24 month disruption + recovery. A V-curve: first year dips below stabilized, then recovers above.

Ramp applied **to both occupancy and ADR independently**, because a new property often hits occupancy first (discount-led) and ADR second (reputation-led).

### 5.5 Pro Forma Roll-Up (The Critical Integration)

The transient engine must emit canonical Pro Forma rows. The roll-up logic:

```ts
// server/transient/rollup/proForma.ts
import { getProFormaSchema } from '../../proForma/schema.js';

export interface TransientProFormaRow {
  year: number;
  month: number;  // 1-12
  lineItem: string;     // 'gross_potential_revenue' | 'vacancy_loss' | 'concessions' | ...
  subLineItem?: string; // 'rooms' | 'fuel' | 'fnb' | ...
  amount: number;
}

export function rollUpTransientToProForma(args: {
  propertyId: string;
  assumptionSetId: string;
  scenarioVersionId: string;
}): TransientProFormaRow[] {
  // 1. Pull inventory × available-nights by unit_type
  // 2. For each year in horizon:
  //    a. Apply occupancy curve × ADR curve × seasonality
  //    b. Compute per-month room revenue
  //    c. Compute gross potential = inventory × nights × ADR at 100% occupancy
  //    d. Vacancy loss = gross potential − actual
  //    e. Concessions = sum of modeled discounts
  //    f. Channel commission as separate line
  //    g. Cleaning / resort / parking / ancillary streams as Other Income
  //    h. Fuel gross profit (not gross revenue) as Other Income line
  // 3. Return one row per (year, month, lineItem)
}
```

Pro Forma emits in **canonical form** — matching the existing `pro_forma_line_items` schema used by the DCF. No parallel data structure. The existing Pro Forma already knows how to:

- Sum gross potential → subtract vacancy → subtract concessions → add other income = EGI
- Deduct operating expenses → NOI
- Apply reserves → cash flow
- Feed DCF

The transient engine is *one of several* possible GPR/OtherIncome producers; it sits alongside the traditional rent-roll producer in a strategy pattern:

```ts
// Abstract interface
interface RevenueModel {
  emitProForma(year: number): ProFormaRow[];
}
class TraditionalRentRollModel implements RevenueModel { /* existing */ }
class TransientRentRollModel implements RevenueModel { /* new */ }
class MixedModel implements RevenueModel {
  // For properties with BOTH (e.g., marina with annual + transient)
  constructor(private components: RevenueModel[]) {}
  emitProForma(year: number) { return this.components.flatMap(c => c.emitProForma(year)); }
}
```

### 5.6 Expense Modeling

Transient expenses are **not** a flat % of revenue. Model them as a matrix:

- **Fixed** (not variable with occupancy) — property tax, insurance, ground rent, base management fee minimums
- **Semi-variable** (steps) — A&G, Sales & Marketing, IT, POMEC, utilities (base + variable)
- **Variable** (per-occupied-unit) — housekeeping, linen, guest amenities, F&B cost of sales, channel commission, credit card fees, loyalty costs
- **Revenue-% based** — franchise royalty, franchise marketing, management fee (% of revenue), FF&E reserve, sales tax rebates

```ts
// server/transient/expense/model.ts
export interface ExpenseDriver {
  category: string;             // 'housekeeping' | 'franchise_royalty' | 'insurance' | etc.
  basis: 'fixed' | 'per_occupied_unit' | 'per_available_unit' | 'pct_room_revenue' | 'pct_total_revenue' | 'stepped';
  amount: number;                // flat $ or rate
  steps?: { threshold: number; amount: number }[];  // for stepped
  growthRate?: number;
  flowThroughPct?: number;       // for semi-variable
}
```

USALI-aware hotel expense template ships pre-populated. Marina expense template ships pre-populated (dockmaster salary as fixed, fuel COGS as % of fuel revenue, insurance fixed, dredging reserve as $/ft/year).

### 5.7 DCF Integration (Layer 2)

The DCF consumes the transient engine's Pro Forma emission. No changes to DCF core logic — it already consumes the canonical Pro Forma. New UI additions:

- **Transient Assumptions panel** in the DCF screen, showing occupancy/ADR curves by year
- Toggle to switch between **"Flat year-over-year growth"** and **"Explicit year-by-year override"**
- Seasonality preview overlay

### 5.8 Monte Carlo Integration (Layer 3)

Add to the existing Monte Carlo variable registry:

```ts
// server/transient/montecarlo/variables.ts
export const TRANSIENT_MC_VARIABLES = [
  {
    key: 'stabilized_occupancy',
    label: 'Stabilized Occupancy %',
    defaultDistribution: 'triangular',
    defaultParams: { min: 0.55, mode: 0.70, max: 0.80 },
    impactPath: 'revenue.occupancyByYear[stabilized:]',
  },
  {
    key: 'stabilized_adr',
    label: 'Stabilized ADR',
    defaultDistribution: 'triangular',
    defaultParams: { min: 0.85, mode: 1.00, max: 1.15 },  // multiplier on base ADR
    impactPath: 'revenue.adrByYear[stabilized:]',
  },
  {
    key: 'adr_growth',
    label: 'ADR Growth Rate',
    defaultDistribution: 'normal',
    defaultParams: { mean: 0.03, stdev: 0.015 },
  },
  {
    key: 'stabilization_duration',
    label: 'Stabilization Duration (months)',
    defaultDistribution: 'triangular',
    defaultParams: { min: 18, mode: 24, max: 36 },
  },
  {
    key: 'channel_commission_pct',
    label: 'Blended Channel Commission %',
    defaultDistribution: 'uniform',
    defaultParams: { min: 0.05, max: 0.12 },
  },
  {
    key: 'seasonality_deviation',
    label: 'Seasonality Deviation σ',
    defaultDistribution: 'normal',
    defaultParams: { mean: 0, stdev: 0.08 },
  },
  // Marina-specific
  {
    key: 'fuel_margin_per_gallon',
    label: 'Fuel Margin $/gallon',
    defaultDistribution: 'triangular',
    defaultParams: { min: 0.40, mode: 0.60, max: 0.85 },
  },
  {
    key: 'transient_share_of_slip_nights',
    label: 'Transient Share of Slip-Nights',
    defaultDistribution: 'triangular',
    defaultParams: { min: 0.10, mode: 0.20, max: 0.35 },
  },
  // Hotel-specific
  {
    key: 'rgi',
    label: 'RevPAR Penetration Index (RGI)',
    defaultDistribution: 'triangular',
    defaultParams: { min: 0.90, mode: 1.00, max: 1.12 },
  },
];
```

Each variable provides an `impactPath` that the MC engine uses to mutate the assumption set before recomputing the DCF.

### 5.9 Decision Support (Layer 4)

The tornado chart automatically sensitizes the top variables by $-impact on IRR. For transient assets, expect the top 3–5 to include: occupancy, ADR, channel commission (or cap rate, always).

The memo generator narrates transient-specific assumptions in prose:

> "The Base Case assumes stabilized occupancy of 72% and ADR of $195, implying a stabilized RevPAR of $140 versus the compset's $128 (RGI 109). ADR is projected to grow at 3.0% annually, in line with the 5-year CPI-adjusted compset trend of 2.9%. The property stabilizes in month 24 following completion of the PIP in month 9."

---

## 6. API SURFACE

All endpoints under `/api/v1/transient/`. Auth middleware sets `req.currentHost` and `app.current_org_id` (existing pattern).

### 6.1 Inventory

```
GET    /api/v1/transient/properties/:propertyId/groups
POST   /api/v1/transient/properties/:propertyId/groups
PATCH  /api/v1/transient/groups/:groupId
DELETE /api/v1/transient/groups/:groupId

GET    /api/v1/transient/properties/:propertyId/unit-types
POST   /api/v1/transient/properties/:propertyId/unit-types
PATCH  /api/v1/transient/unit-types/:id
DELETE /api/v1/transient/unit-types/:id
POST   /api/v1/transient/unit-types/:id/validate-dimensions

GET    /api/v1/transient/properties/:propertyId/units
POST   /api/v1/transient/properties/:propertyId/units
POST   /api/v1/transient/properties/:propertyId/units/bulk
PATCH  /api/v1/transient/units/:id
DELETE /api/v1/transient/units/:id
```

### 6.2 Rate Plans & Calendar

```
GET    /api/v1/transient/properties/:propertyId/rate-plans
POST   /api/v1/transient/properties/:propertyId/rate-plans
PATCH  /api/v1/transient/rate-plans/:id
DELETE /api/v1/transient/rate-plans/:id

GET    /api/v1/transient/properties/:propertyId/rate-calendar
         ?from=YYYY-MM-DD&to=YYYY-MM-DD&unitTypeId=...&ratePlanId=...
POST   /api/v1/transient/properties/:propertyId/rate-calendar/bulk
DELETE /api/v1/transient/properties/:propertyId/rate-calendar
         ?from=YYYY-MM-DD&to=YYYY-MM-DD&unitTypeId=...&ratePlanId=...
```

### 6.3 Channels

```
GET    /api/v1/transient/properties/:propertyId/channels
POST   /api/v1/transient/properties/:propertyId/channels
PATCH  /api/v1/transient/channels/:id
```

### 6.4 Bookings

```
GET    /api/v1/transient/properties/:propertyId/bookings
         ?from=...&to=...&unitTypeId=...&tenancyClass=...&status=...&channelId=...&page=...
POST   /api/v1/transient/properties/:propertyId/bookings
POST   /api/v1/transient/properties/:propertyId/bookings/bulk
GET    /api/v1/transient/bookings/:id
PATCH  /api/v1/transient/bookings/:id
POST   /api/v1/transient/bookings/:id/cancel

GET    /api/v1/transient/properties/:propertyId/booking-nights
         ?from=...&to=...&unitTypeId=...
```

### 6.5 Analytics / KPIs

```
GET  /api/v1/transient/properties/:propertyId/kpis
       ?from=...&to=...&granularity=day|week|month|year
       &groupBy=unitType|channel|tenancyClass|dow|los
       &policy=...     (JSON or policyId)
GET  /api/v1/transient/properties/:propertyId/kpis/yoy
       ?period=YYYY-MM&lookback=1y|2y|3y
GET  /api/v1/transient/properties/:propertyId/seasonality
GET  /api/v1/transient/properties/:propertyId/los-distribution
GET  /api/v1/transient/properties/:propertyId/booking-window-distribution
GET  /api/v1/transient/properties/:propertyId/channel-mix
GET  /api/v1/transient/properties/:propertyId/compset-comparison
       ?period=YYYY-MM

POST /api/v1/transient/properties/:propertyId/kpi-snapshots/recompute
```

### 6.6 Ingestion

```
POST /api/v1/transient/ingestion/classify
       body: { fileId }  → { docType, confidence, candidates[] }
POST /api/v1/transient/ingestion/extract
       body: { fileId, docType }  → { extractionId, rowCount, avgConfidence }
GET  /api/v1/transient/ingestion/extractions/:extractionId
       → { rows, issues, summary }
PATCH /api/v1/transient/ingestion/extractions/:extractionId
       body: { rowEdits: {...} }
POST /api/v1/transient/ingestion/extractions/:extractionId/commit
POST /api/v1/transient/ingestion/extractions/:extractionId/reject
POST /api/v1/transient/properties/:propertyId/staymate-sync
       body: { stayMateOrgSlug, startDate, endDate }
GET  /api/v1/transient/properties/:propertyId/reconciliation
       ?period=YYYY-MM → { parsed, gl, variance }[]
```

### 6.7 Underwriting / Pro Forma

```
GET    /api/v1/transient/properties/:propertyId/assumption-sets
POST   /api/v1/transient/properties/:propertyId/assumption-sets
GET    /api/v1/transient/assumption-sets/:id
PATCH  /api/v1/transient/assumption-sets/:id
POST   /api/v1/transient/assumption-sets/:id/clone
DELETE /api/v1/transient/assumption-sets/:id

POST   /api/v1/transient/assumption-sets/:id/derive-from-history
         body: { historyYears: 2, includeStabilizationRamp: true }
POST   /api/v1/transient/assumption-sets/:id/emit-pro-forma
         → Array of ProFormaRow (matches canonical schema)
POST   /api/v1/transient/assumption-sets/:id/run-dcf
         → Existing DCF endpoint, pre-wired with transient emitter
```

### 6.8 Compset

```
GET    /api/v1/transient/properties/:propertyId/compset
POST   /api/v1/transient/properties/:propertyId/compset
PATCH  /api/v1/transient/compset/:id
DELETE /api/v1/transient/compset/:id

POST   /api/v1/transient/properties/:propertyId/compset/snapshots
         body: { period, data[] }  // or parsed from STR report
GET    /api/v1/transient/properties/:propertyId/compset/snapshots
         ?from=...&to=...
```

---

## 7. UI / UX SPEC

### 7.1 Navigation

Within the existing Property / Deal screen in Vantage, add a **"Rent Roll"** top-level tab that has two sub-modes: **Traditional** (existing) and **Transient** (new). The mode is determined by the property's asset class and the presence of transient inventory; properties with both show both sub-tabs.

```
Property › Financial Analysis › Rent Roll
  ├── Traditional (leases)    ← existing
  └── Transient (bookings)    ← new
```

### 7.2 Transient Rent Roll Page — Layout

Four panels arranged as a responsive grid:

1. **Top strip: KPI cards**
   - Occupancy (T12, T3, T1)
   - ADR
   - RevPAR
   - Total Revenue
   - YoY deltas as micro-sparklines
   - Marina variant swaps in: Occupancy (slip-nights), $/ft/night, Fuel Revenue, Annual Tenant Count
   - Policy toggle (include/exclude comps, OOO, etc.) — tucked into an overflow menu

2. **Left rail: Filters**
   - Date range picker (with T12/T6/T3/T1/YTD quick-picks)
   - Unit type multiselect
   - Tenancy class multiselect
   - Channel multiselect
   - Group by (unitType, channel, tenancyClass, dow, los, none)
   - Granularity (day/week/month/year)

3. **Main area: Three views via tabs**
   - **Calendar** — a Gantt-style grid with units on Y-axis and dates on X-axis; each booking rendered as a bar with color by tenancy class; hover for detail; click to edit
   - **Bookings table** — paginated list with sortable columns
   - **Analytics** — charts (occupancy line + ADR bar combo, channel mix pie, LOS histogram, booking-window histogram, YoY overlay, compset overlay)

4. **Right rail: Inventory summary** — unit types with inventory counts and occupancy badges

### 7.3 Inventory Management

A dedicated page under **Property › Settings › Transient Inventory**:

- **Groups** — accordion list of inventory groups, add/edit/delete
- **Unit Types** — grid with dimensions columns dynamically rendered from `ASSET_REGISTRY`; inline edit
- **Units** — full table with identifier, group, unit type, status, attributes; bulk CSV upload; bulk tag editor

### 7.4 Document Upload & Review

Extends the existing Document Intelligence upload flow. A user drags a file onto the property's Documents tab; the classifier runs; if it comes back with a transient docType, the file is routed to the **Transient Ingestion Review** screen:

1. **Summary card** — document type, row count, avg confidence, issues count
2. **Bookings grid** — full list with confidence badges, status (new/duplicate/invalid), and inline edit
3. **Side pane** — click a row to see the source evidence (PDF thumbnail with bbox highlight OR XLSX cell range screenshot)
4. **Systemic fix tools** — "Apply to all": e.g., map 'AirBnB'→'airbnb' across the whole import
5. **Commit button** — disabled until confidence gate passes; shows expected insert counts

### 7.5 Rate Plan & Calendar Editor

Calendar view with unit-type tabs across the top; days as columns; rate plans as rows; editable cells. Supports range selection + bulk rate update. Copy-paste from Excel. Import CSV.

A "derive from BAR" wizard for discount plans: select base plan, define rule ("20% off BAR on weekdays, 10% off weekends").

### 7.6 Seasonality Editor

A 12-bar chart where users can drag monthly indices. "Auto-derive from 24 months of history" button. Benchmark overlay (greyed bars show asset-class-default for region).

### 7.7 Underwriting Assumptions Panel

Single page with collapsible sections:

1. **Horizon** — hold period in years, start date
2. **Inventory** — per unit type: count, available nights, ramp curve
3. **Occupancy projections** — year-by-year table with sliders, "flat growth" and "explicit" toggle
4. **ADR projections** — same structure
5. **Seasonality** — inherits from curve, overridable
6. **Channel mix & commission** — pie chart editor + blended commission
7. **Ancillary growth**
8. **Management & franchise fees** (hotel-specific)
9. **FF&E reserve**
10. **Stabilization**
11. **Monte Carlo variables** — each MC variable shows a distribution sparkline; click to edit parameters

Save creates/updates a `transient_uw_assumption_set` tied to a scenario version. "Promote to DCF" button pushes the assumption set into the canonical DCF engine.

### 7.8 Compset View

Table of compset properties plus a month-by-month comparison chart. Upload STR report button parses into `compset_snapshot`. Index metrics (MPI/ARI/RGI) prominently displayed.

### 7.9 Mobile Considerations

KPI cards and the Bookings table must be mobile-usable. Calendar Gantt view is desktop-only with a "Day view" fallback on mobile (list of today's bookings).

---

## 8. PHASED IMPLEMENTATION PLAN

Order of build, sized in typical engineering weeks assuming one engineer + Claude Code. Each phase ends with a working, mergeable increment.

### Phase 1 — Schema & Core CRUD (1–2 weeks)

**Deliverables:**
- All Drizzle schema tables from Section 3.2
- Migrations generated and applied (raw SQL)
- RLS policies on all `transient_*` tables
- `booking_night` explosion trigger
- CRUD endpoints for groups, unit-types, units, rate plans, channels (Sections 6.1–6.3)
- `ASSET_REGISTRY` extended with the transient block for marinas, hotels (limited/full service), STR, RV parks
- `validateUnitTypeDimensions()` helper
- Unit tests: explosion trigger correctness, validation, RLS isolation

**Acceptance gate:**
- Can POST a unit type and units via API
- Can POST a booking via API and see rows appear in `booking_night`
- Unit tests pass, 0 TS errors, no `npm run db:push` in the diff

### Phase 2 — Analytics Engine (1–2 weeks)

**Deliverables:**
- KPI calculation module with policy system
- All analytics endpoints (Section 6.5)
- `kpi_snapshot` materialization job (nightly cron + on-demand recompute)
- Seasonality auto-derivation
- LOS and booking-window distribution endpoints
- Compset CRUD + snapshot endpoints

**Acceptance gate:**
- Given seed data of 1000 bookings across 1 year, KPI endpoint returns monthly Occ/ADR/RevPAR within 0.1% of hand-calculated values
- Policy toggles produce expected deltas (comp inclusion test)

### Phase 3 — Ingestion Pipeline (2–3 weeks)

**Deliverables:**
- Classifier + fingerprint registry
- Deterministic parsers for: Hostaway, Dockwa, generic-CSV
- LLM parser using claude-opus-4-6 with chunked PDF support
- Extraction validation + scoring
- Review UI (cell-by-cell) for transient bookings
- Commit flow that upserts channels, unit types, bookings
- Reconciliation vs. P&L room revenue
- StayMate direct sync (Brett's portfolio) — optional if StayMate API is ready

**Acceptance gate:**
- Upload a sample Hostaway CSV → 95%+ auto-accept at first pass
- Upload a sample Dockwa CSV → same
- Upload a sample STR report PDF → compset snapshots created
- G/L variance report surfaces correctly on a property with both parsed bookings and parsed P&L

### Phase 4 — Pro Forma & DCF Integration (1–2 weeks)

**Deliverables:**
- `TransientRentRollModel` implementing `RevenueModel` interface
- `MixedModel` for properties with both transient and traditional
- `emit-pro-forma` endpoint returning canonical Pro Forma rows
- Wire into existing DCF so transient properties produce a full DCF with no extra user steps
- Expense template library (USALI hotel, marina, RV park, STR)
- Stabilization ramp application

**Acceptance gate:**
- A transient-enabled property with a populated assumption set produces a DCF identical to one hand-computed in Excel (±0.5%)
- Existing traditional rent-roll properties produce identical DCFs before/after the refactor — **zero regression**

### Phase 5 — Monte Carlo & Decision Support (1 week)

**Deliverables:**
- Transient MC variables registered
- Tornado chart includes transient variables
- Memo generator includes transient narrative
- UI slider panel in the assumption-set editor

**Acceptance gate:**
- 10,000-draw MC run on a sample hotel deal completes in <15s
- Tornado identifies top 5 variables with $-impact signed correctly

### Phase 6 — UI Polish (2–3 weeks)

**Deliverables:**
- Transient rent roll page (calendar, table, analytics)
- Inventory management page
- Document upload & review screen
- Rate plan / calendar editor
- Seasonality editor
- Underwriting assumptions panel
- Compset view

**Acceptance gate:**
- All pages functional on desktop at 1440px
- Calendar renders 50 units × 90 days in <300ms
- Mobile fallback present (table view)

### Phase 7 — Advanced (1–2 weeks)

**Deliverables:**
- YoY overlay on charts
- Pace / pickup analytics (forward BOB)
- Channel-commission optimizer ("what if we shift 10% from OTA to direct")
- Rate-recommendation sidebar using compset benchmarks
- Export: rent roll to Excel, assumptions to PDF

**Acceptance gate:**
- Pace chart renders
- Excel export contains all bookings with channel mix summary

### Total estimate: 9–14 weeks at 1 developer + Claude Code.

Parallelizable work items that shorten calendar time: Phase 3 (ingestion) can start in parallel with Phase 2 (analytics) once Phase 1 is done. Phase 6 (UI) can start as soon as Phase 2 ships endpoints.

---

## 9. TESTING STRATEGY

### 9.1 Unit Tests

- Dimension validation (all enum / required cases)
- Booking-night explosion (N-night stays produce N rows; cancellation deletes all)
- KPI formulas with every policy combination
- Seasonality derivation with edge cases (partial years, zero months, single year)
- Stabilization ramp application
- Pro Forma emitter round-trip

### 9.2 Integration Tests

- Full ingestion pipeline: fixture file → classify → extract → commit → KPI
- One fixture file per supported source system, each checked into `test/fixtures/transient/`
- Reconciliation to a known-good P&L fixture
- RLS isolation: org A cannot read org B's bookings

### 9.3 Regression Tests

- **Canonical Pro Forma parity**: the existing 154 DCF tests must still pass with 0 TS errors (the transient engine must not disturb the traditional rent-roll path)
- Snapshot tests on DCF outputs for a known transient property so future changes surface diffs

### 9.4 Performance Targets

- KPI endpoint: P95 < 400ms for 1 year of data at monthly granularity
- Booking query with filters: P95 < 300ms
- Ingestion commit for 500 rows: P95 < 10s
- MC run 10k draws: P95 < 20s

### 9.5 Test Data Scripts

Provide a seeding script that generates synthetic transient data for the test org/project (`cd3719c3-ef82-4ccc-acb9-261c80fb64b4` / `6b3a9021-f393-489d-9274-321ac76eae08`):

- 1 marina with 60 slips, 3 unit types, 24 months of history
- 1 hotel with 120 rooms, 4 room types, 24 months of history
- 1 STR portfolio with 5 units, 18 months of history

Script: `scripts/seed-transient-fixtures.ts` — idempotent, clearly commented, explicitly sets `org_id` via `app.current_org_id`.

---

## 10. EDGE CASES & GOTCHAS — CHECKLIST

The following edge cases must each have explicit handling and a test:

**Booking-level**
- Same-day check-in and check-out (day-use) — nights = 0, handle as separate "day_use" tenancy class or explicit flag
- Over-midnight check-in (arrives 2am on day X) — honor the check-in date as recorded
- Multi-unit stays (group books 3 rooms on one reservation) — split into N bookings or use a `parent_booking_id`
- Move-room mid-stay — two consecutive bookings with a `moved_from_booking_id` link
- Cancellation with partial revenue (non-refundable fees) — `status='cancelled'` but `gross_revenue > 0`
- No-show with charge — `status='no_show'` but `gross_revenue > 0`
- House use / comp rooms — `tenancy_class='house_use'|'comp'`, `room_revenue=0`, excluded from ADR per policy
- Overbooked night (2 confirmed bookings for same unit same night) — flag as `conflict`, surface on dashboard, do not silently merge
- Negative revenue (refunds, chargebacks) — booking with negative `gross_revenue` is allowed; never drops `nights` below 0

**Rate / Revenue**
- Currency (multi-property portfolios) — all revenue stored in `USD`; conversions applied on ingest with `fx_rate` on the meta blob
- Tax-inclusive vs tax-exclusive — policy flag; ingestion normalizes to tax-exclusive
- Resort fee included vs. separate — parser strips resort fee into its own charge line
- Cleaning fee pass-through vs. revenue — asset-class-default, per-property overridable
- Channel commission net vs. gross — parser normalizes to gross, commission as separate line

**Inventory**
- Unit decommission mid-period — exclude from denominator after `decommission_date`
- New unit added mid-period — include in denominator from `activation_date`
- Seasonal closure (marina closes Nov–Mar) — represented as a multi-month `availability_hold` with `kind='seasonal_closure'`
- Renovation — `availability_hold` with `kind='renovation'` and `excludeFromOccupancyDenominator=true`
- Unit temporarily reassigned to a different unit type — historical bookings keep original unit type; new ones use new

**Marina-specific**
- Overhang fees (vessel > slip length) — separate `booking_charge_line` category `'overhang'`
- Metered electric passthrough — separate ancillary stream with `category='pass_through'`; excluded from NOI
- Submerged land lease — classify as OpEx `ground_rent`, not revenue deduction
- Waitlist — not a booking; store in `transient_waitlist` table (optional Phase 7)
- Named storm event — bookings in the event window can be tagged `meta.storm_event='Ian 2022'` for exclusion/smoothing in seasonality derivation

**Hotel-specific**
- USALI department mapping must be correct for franchise reporting
- Brand loyalty revenue reimbursement vs. ADR (loyalty redemptions booked at brand-set rate, often below fair market)
- Group block attrition (committed rooms not sold) — handled in group pickup analytics, not bookings
- Contract rooms (crew housing, long-term) — `tenancy_class='contract'`, excluded from transient KPIs
- Complimentary upgrade — booking retains original rate plan / ADR; upgrade flag in meta
- Sister-property transfer (guest moved to nearby sibling hotel) — handled as cancellation + rebooking at the receiving property

**STR-specific**
- Cleaning fee classification (per property default)
- Owner stays — `tenancy_class='house_use'`, zero revenue
- Maintenance blocks — `availability_hold`
- HOA / condo regulation flag (informational; drives discount rate not revenue)
- Platform occupancy tax collected-and-remitted — NOT revenue; strip on import

**General**
- Time zone — all dates stored as local `DATE` (not `TIMESTAMP WITH TZ`), calendar-day semantics
- Daylight savings — irrelevant at day granularity
- Currency — USD only in v1 (add multi-currency in Phase 7 if needed)
- Leap year — `nights` math handles it naturally
- Bookings spanning year boundaries — split correctly in YoY reports

---

## 11. VANTAGE DEV RULES REMINDER

Consistent with the `MARINAMATCH_JOURNAL.md` contract, every session on this feature must:

- `cat ~/workspace/MARINAMATCH_JOURNAL.md` at the start
- **Never** run `npm run db:push`. Use raw `pool.query()` for:
  - `modeling_project_config` (existing)
  - `modeling_scenario_versions` (existing)
  - `transient_uw_assumption_set` (new — RLS-protected)
- All API routes under `/api/v1/`
- All imports `.js` (ESM)
- Auth middleware sets `req.currentHost` — respect it in every endpoint
- Test org: `cd3719c3-ef82-4ccc-acb9-261c80fb64b4`
- Test project: `6b3a9021-f393-489d-9274-321ac76eae08`
- Run `npx tsc --noEmit` before commit — 0 TS errors required
- Run existing 154 DCF tests before commit — 154/154 required

When Claude Code is implementing against this spec, it should:

1. Update `MARINAMATCH_JOURNAL.md` with session-start state and session-end state
2. Reference the specific section of this spec it is implementing (e.g., "Phase 1, Section 3.2 — creating `transient_inventory_group` table")
3. Surface any deviations from this spec as explicit TODOs in the journal

---

## 12. OPEN QUESTIONS / DECISIONS FOR BRETT

These are intentionally surfaced for Brett to resolve before Phase 1 kickoff:

1. **StayMate API maturity** — is the StayMate reservation-listing endpoint ready for the direct sync in Phase 3, or should Phase 3 focus only on file-based ingestion? (If StayMate V2 is still in multi-agent build, recommend file-based first, StayMate sync in a follow-up sprint.)

2. **Compset data source** — will Vantage purchase a CoStar/STR Share feed, or rely on user-uploaded STR reports? (Spec currently assumes upload-only.)

3. **Billing gating** — which subscription tier gates the transient module? Recommend: Marina/Hospitality sub-module requires Operator ($499/mo) or higher; Institutional tier always included.

4. **Multi-currency** — any near-term need? Currently USD-only; can add without schema change (meta.fx_rate is already there).

5. **Waitlist module** — Phase 7 or out of scope? Brett's marina users often cite waitlist as a #1 feature.

6. **Historical booking-level PII retention** — for Hostaway imports, store guest emails? Recommend: redact by default, keep hash for dedup.

7. **Rate recommendation engine** — is a built-in dynamic-pricing suggestion in scope, or always deferred to PriceLabs/Wheelhouse integration? Recommend: defer, surface compset rate benchmarks only.

---

## 13. DELIVERABLES CHECKLIST (FOR CLAUDE CODE)

- [ ] Drizzle schema (`server/db/schema/transient.ts`)
- [ ] Raw SQL migrations file (`migrations/NNN_transient_rent_roll.sql`)
- [ ] RLS policies applied
- [ ] Booking-night trigger function
- [ ] `ASSET_REGISTRY` updated with transient blocks
- [ ] Dimension validation helper
- [ ] API routes under `server/routes/transient/`
- [ ] KPI calculation module (`server/transient/kpi/`)
- [ ] Ingestion pipeline (`server/transient/ingestion/`)
- [ ] Pro Forma emitter (`server/transient/rollup/`)
- [ ] MC variables registered
- [ ] UI pages (`client/src/pages/property/transient-rent-roll/`, `client/src/pages/property/settings/transient-inventory/`, etc.)
- [ ] Seed script (`scripts/seed-transient-fixtures.ts`)
- [ ] Test suites (`test/transient/`)
- [ ] Journal updates for every session
- [ ] All existing DCF tests still pass (154/154, 0 TS errors)

---

*End of spec. Pair this document with `MARINAMATCH_JOURNAL.md`, `VANTAGE_DOCUMENT_INTELLIGENCE_SPEC.md`, and `MARINAMATCH_GAP_SPEC.md` when briefing Claude Code. Begin with Phase 1; do not skip ahead.*
