import { ChecklistTemplate } from './types';

/**
 * Short-Term Rental DD Request List Add-On
 * Covers: STR licensing, channel mix audit, PMS/dynamic pricing, listing-level
 * performance, guest operations, STR-specific data and ownership transfer.
 */
export const STR_ADDON_TEMPLATE: ChecklistTemplate = {
  name: 'Short-Term Rental DD Add-On',
  version: '1.0.0',
  assetClass: 'str',
  sections: [
    // ═══ STR FINANCIAL / REVENUE ════════════════════════════════════════════
    {
      key: 'str_financial',
      title: 'STR Financial & Revenue Audit',
      description: 'Channel mix, ADR/occupancy/RevPAR verification, fees, and refund history',
      items: [
        { key: 'str_fin_01', title: 'Channel Revenue Breakdown (3 years)', requestText: 'Provide monthly revenue by channel (Airbnb, VRBO, Booking.com, direct, other) for the last 3 years with booking counts and gross vs. net split.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 5, defaultOwnerRole: 'seller', tags: ['str', 'financial'] },
        { key: 'str_fin_02', title: 'Channel Commission & Fee Audit', requestText: 'Provide channel commission rates by platform, host fees, payment-processing fees, and effective net-of-channel take-rate.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'str_fin_03', title: 'ADR Trends by Season', requestText: 'Provide ADR (average daily rate) trends by month and season for the last 3 years, per listing and portfolio-wide.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'str_fin_04', title: 'Occupancy by Season & Listing', requestText: 'Provide monthly occupancy rates by listing and portfolio average for the last 3 years.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'str_fin_05', title: 'RevPAR Validation', requestText: 'Provide RevPAR calculations (ADR × occupancy) by listing and verify against market benchmarks (AirDNA, Key Data).', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'str_fin_06', title: 'Cleaning Fee Structure', requestText: 'Document cleaning fee structure: amount charged to guest, amount paid to cleaning crew, retained margin, and whether passed through or retained as revenue.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'str_fin_07', title: 'Refund & Chargeback History', requestText: 'Provide 3-year history of guest refunds, chargebacks, and Resolution Center disputes by channel and listing.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'str_fin_08', title: 'Security Deposit Handling', requestText: 'Document security deposit policy, held-funds workflow, claim history, and platform-specific damage-protection programs (AirCover, etc.).', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'str_fin_09', title: 'Resort / Cleaning / Pet Fee Schedule', requestText: 'Provide complete schedule of all guest-facing fees beyond nightly rate (resort fee, pet fee, extra-guest fee, hot tub fee).', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'str_fin_10', title: 'Direct Booking Revenue Share', requestText: 'Provide percentage of revenue from direct bookings vs. OTA channels and historical trend.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
      ],
    },

    // ═══ STR REGULATORY / LEGAL ═════════════════════════════════════════════
    {
      key: 'str_regulatory',
      title: 'STR Regulatory & Legal',
      description: 'STR licenses, permits, lodging taxes, HOA rules, and STR-specific insurance',
      items: [
        { key: 'str_reg_01', title: 'STR Permit / License by Listing', requestText: 'Provide active STR permit or license for each listing with issuing jurisdiction, expiration date, renewal terms, and transferability.', priority: 1, requestType: 'document', milestoneAnchor: 'dd_start', dueOffsetDays: 7, defaultOwnerRole: 'seller', tags: ['str', 'compliance'] },
        { key: 'str_reg_02', title: 'STR Ordinance Compliance', requestText: 'Provide local STR ordinance text for each jurisdiction and confirm each listing complies (caps on night counts, primary-residence requirements, density limits).', priority: 1, requestType: 'verification', defaultOwnerRole: 'attorney' },
        { key: 'str_reg_03', title: 'HOA / Strata / Condo STR Rules', requestText: 'Provide HOA/condo association declarations and rules confirming STR is permitted for each applicable listing.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller', tags: ['compliance'] },
        { key: 'str_reg_04', title: 'Occupancy / Lodging Tax Registration', requestText: 'Provide registration with state and local tax authorities for collection of transient occupancy / lodging / sales tax.', priority: 1, requestType: 'document', defaultOwnerRole: 'accountant' },
        { key: 'str_reg_05', title: 'Lodging Tax Filing History (3 years)', requestText: 'Provide 3-year history of lodging tax filings and remittances by jurisdiction; identify any audit notices or outstanding liabilities.', priority: 1, requestType: 'document', defaultOwnerRole: 'accountant' },
        { key: 'str_reg_06', title: 'STR-Specific Insurance Riders', requestText: 'Provide property and liability insurance policies with STR-specific endorsements (commercial vs. residential, daily-rental rider, hosting coverage gaps).', priority: 1, requestType: 'document', defaultOwnerRole: 'seller', tags: ['insurance'] },
        { key: 'str_reg_07', title: 'Guest Injury / Liability History', requestText: 'Provide 5-year history of guest-injury claims, liability incidents, and any open lawsuits across the portfolio.', priority: 1, requestType: 'data', defaultOwnerRole: 'attorney' },
        { key: 'str_reg_08', title: 'ADA Accessibility Review', requestText: 'Identify listings marketed as accessible and provide ADA compliance documentation; assess Title III exposure for commercially-operated portfolios.', priority: 2, requestType: 'verification', defaultOwnerRole: 'attorney' },
        { key: 'str_reg_09', title: 'Fair Housing Compliance', requestText: 'Confirm listing descriptions, host preferences, and guest-screening practices comply with Fair Housing Act and platform policies.', priority: 2, requestType: 'verification', defaultOwnerRole: 'attorney' },
      ],
    },

    // ═══ STR OPERATIONS ═════════════════════════════════════════════════════
    {
      key: 'str_operations',
      title: 'STR Operations',
      description: 'PMS, channel manager, dynamic pricing, cleaning, smart-lock, and guest SOPs',
      items: [
        { key: 'str_ops_01', title: 'Property Management Structure', requestText: 'Document whether listings are self-managed, third-party PMS-managed, or hybrid; provide all PMS contracts and termination terms.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller', tags: ['str', 'operations'] },
        { key: 'str_ops_02', title: 'Property Management System (PMS) Audit', requestText: 'Identify PMS platform (Guesty, Hostaway, Hospitable, OwnerRez, etc.); provide subscription contract, login credentials transfer plan, and data export rights.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'str_ops_03', title: 'Channel Manager Configuration', requestText: 'Document channel manager (rate parity, calendar sync, restrictions) and channel-specific account credentials transfer paths.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'str_ops_04', title: 'Dynamic Pricing Tool', requestText: 'Identify dynamic pricing tool in use (PriceLabs, Beyond, Wheelhouse); provide subscription, rules/strategy export, and performance backtest.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'str_ops_05', title: 'Cleaning Crew Contracts', requestText: 'Provide cleaning vendor contracts or W-2 staff schedule, per-turn rate, on-call reliability metrics, and backup vendor list.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'str_ops_06', title: 'Turnover Time Metrics', requestText: 'Provide historical turnover-time metrics (checkout-to-ready), same-day turn capacity, and any double-booking incidents.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'str_ops_07', title: 'Maintenance Contracts & SLAs', requestText: 'Provide HVAC, plumbing, hot-tub, pool, lawn-care, and pest-control contracts with response-time SLAs.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'str_ops_08', title: 'Smart-Lock Infrastructure', requestText: 'Inventory smart locks, hubs, and integrations (RemoteLock, August, Schlage); document code-rotation workflow and battery-replacement protocol.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller', tags: ['technology'] },
        { key: 'str_ops_09', title: 'Guest Communication SOP', requestText: 'Provide guest communication SOP: pre-arrival, check-in, in-stay, checkout, post-stay review request; identify automation tools used.', priority: 2, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'str_ops_10', title: 'Noise / Party Monitoring', requestText: 'Document noise-monitoring devices (Minut, NoiseAware), party-prevention policies, and incident-response procedures.', priority: 3, requestType: 'data', defaultOwnerRole: 'seller' },
      ],
    },

    // ═══ PROPERTY-LEVEL CONDITION ═══════════════════════════════════════════
    {
      key: 'str_property',
      title: 'Property-Level Condition & Capex',
      description: 'Per-listing condition, recent capex, deferred maintenance, and photo/review audit',
      items: [
        { key: 'str_prop_01', title: 'Condition Report per Listing', requestText: 'Provide most recent condition report or property inspection for each listing including roof, HVAC, appliances, hot tub, pool.', priority: 1, requestType: 'document', defaultOwnerRole: 'consultant', tags: ['str', 'property'] },
        { key: 'str_prop_02', title: 'Capex History (5 years)', requestText: 'Provide 5-year capex history per listing: replacements, renovations, furniture refresh; identify items capitalized vs. expensed.', priority: 1, requestType: 'document', defaultOwnerRole: 'seller' },
        { key: 'str_prop_03', title: 'Deferred Maintenance Backlog', requestText: 'Disclose deferred maintenance items per listing with estimated cost to cure.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'str_prop_04', title: 'Furniture / Linen Replacement Schedule', requestText: 'Provide FF&E and linen replacement cadence, last refresh date per listing, and budgeted reserve.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'str_prop_05', title: 'Listing Photography Refresh History', requestText: 'Provide date of last professional photo refresh per listing and rights/license to all marketing imagery.', priority: 3, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'str_prop_06', title: 'Listing Rank & Review Score Audit', requestText: 'Provide current review score, total review count, and Superhost / Premier Partner status per channel for each listing.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'str_prop_07', title: 'Negative Review Patterns', requestText: 'Surface recurring negative-review themes (cleanliness, noise, amenity issues) and remediation plans.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
      ],
    },

    // ═══ MARKET & COMPARABLES ═══════════════════════════════════════════════
    {
      key: 'str_market',
      title: 'STR Market & Comparables',
      description: 'Submarket STR-friendliness, regulatory ban risk, and comparable portfolio benchmarks',
      items: [
        { key: 'str_mkt_01', title: 'Submarket STR-Friendliness Assessment', requestText: 'Provide assessment of submarket regulatory posture: STR-friendly, neutral, or restrictive; trend over last 3 years.', priority: 1, requestType: 'data', defaultOwnerRole: 'broker', tags: ['str', 'market'] },
        { key: 'str_mkt_02', title: 'STR Regulation Risk Inventory', requestText: 'Identify pending legislation, city-council STR-restriction proposals, and ballot initiatives in each jurisdiction.', priority: 1, requestType: 'data', defaultOwnerRole: 'attorney' },
        { key: 'str_mkt_03', title: 'AirDNA / Key Data Market Report', requestText: 'Provide AirDNA, Key Data, or equivalent submarket report with ADR, occupancy, RevPAR, supply, and demand trends.', priority: 2, requestType: 'document', defaultOwnerRole: 'broker' },
        { key: 'str_mkt_04', title: 'Comparable STR Portfolio Transactions', requestText: 'Provide 5-10 comparable STR portfolio or individual-property transactions with price per key, price per bedroom, cap rates, and RevPAR multiples.', priority: 2, requestType: 'data', defaultOwnerRole: 'broker' },
        { key: 'str_mkt_05', title: 'Hotel Competitive Set', requestText: 'Identify competing hotels and limited-service properties in the submarket; compare ADR positioning.', priority: 3, requestType: 'data', defaultOwnerRole: 'broker' },
        { key: 'str_mkt_06', title: 'Demand Driver Analysis', requestText: 'Document submarket demand drivers (leisure tourism, business travel, events, seasonality) and concentration risk.', priority: 2, requestType: 'data', defaultOwnerRole: 'broker' },
      ],
    },

    // ═══ TECHNOLOGY & DATA TRANSFER ═════════════════════════════════════════
    {
      key: 'str_technology',
      title: 'Technology & Data Transfer',
      description: 'PMS data export rights, historical bookings, guest database, and channel-account ownership',
      items: [
        { key: 'str_tech_01', title: 'PMS Data Export Rights', requestText: 'Confirm contractual rights to export all reservations, guest profiles, financials, and operational data from PMS at close.', priority: 1, requestType: 'verification', defaultOwnerRole: 'attorney', tags: ['str', 'technology'] },
        { key: 'str_tech_02', title: 'Historical Booking Data Retention', requestText: 'Provide 3-5 year historical booking dataset: reservation ID, channel, listing, dates, ADR, fees, guest geography.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'str_tech_03', title: 'Guest CRM / Database Transfer', requestText: 'Confirm rights to transfer guest CRM database (returning guests, email list, marketing opt-ins) under privacy regulations.', priority: 2, requestType: 'verification', defaultOwnerRole: 'attorney' },
        { key: 'str_tech_04', title: 'Channel Account Ownership Transfer', requestText: 'Document the transfer path for each channel account (Airbnb, VRBO, Booking.com) including listing-history preservation and review continuity.', priority: 1, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'str_tech_05', title: 'Listing Photography / Copy License', requestText: 'Confirm license and ownership of all listing photography, copywriting, and marketing assets transfer with the portfolio.', priority: 2, requestType: 'verification', defaultOwnerRole: 'attorney' },
        { key: 'str_tech_06', title: 'Smart-Home / IoT Account Transfer', requestText: 'Document transfer of smart-lock, thermostat, noise-monitor, and security-camera accounts and admin credentials.', priority: 3, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'str_tech_07', title: 'Direct-Booking Website Assets', requestText: 'Provide direct-booking website ownership, domain registration, hosting, CMS credentials, and any booking-engine integrations.', priority: 2, requestType: 'data', defaultOwnerRole: 'seller' },
        { key: 'str_tech_08', title: 'Data Privacy & PII Handling', requestText: 'Document guest PII handling practices, retention policy, and GDPR/CCPA compliance posture.', priority: 2, requestType: 'document', defaultOwnerRole: 'attorney' },
      ],
    },
  ],
};
