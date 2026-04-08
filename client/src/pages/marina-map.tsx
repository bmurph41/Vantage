import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, LineChart, Line, CartesianGrid
} from "recharts";

// ═══════════════════════════════════════════════════════════════════════════════
// ASSET CLASS REGISTRY
// Single source of truth. Adding a new entry here makes it work everywhere:
// map heat blobs, marker icons, sidebar filters, detail panel labels,
// revenue breakdown, demographic key metrics, and portfolio stats.
// ═══════════════════════════════════════════════════════════════════════════════

interface AssetRegistryEntry {
  label: string;
  icon: string;
  color: string;
  group: string;
  sizeLabel: string;
  occLabel: string;
  priceUnit: string;
  rev: [string, string, string];
  demandKey: string;
  radarLabels?: string[];
}

export const ASSET_REGISTRY: Record<string, AssetRegistryEntry> = {
  // ── WATERFRONT ──────────────────────────────────────────────────────────────
  marina:           { label:"Marina",               icon:"⚓", color:"#00d4ff", group:"Waterfront",
                      sizeLabel:"Slips",       occLabel:"Slip Occ %",    priceUnit:"Slip",
                      rev:["Fuel Revenue","Storage Revenue","Service Revenue"],
                      demandKey:"Boat Ownership %" },
  dry_stack:        { label:"Dry Stack / Boatyard",  icon:"🚢", color:"#06b6d4", group:"Waterfront",
                      sizeLabel:"Rack Units",  occLabel:"Rack Occ %",    priceUnit:"Rack",
                      rev:["Storage Fees","Launch Fees","Service Revenue"],
                      demandKey:"Boat Ownership %" },
  yacht_club:       { label:"Yacht Club",            icon:"⛵", color:"#38bdf8", group:"Waterfront",
                      sizeLabel:"Slips",       occLabel:"Membership Occ",priceUnit:"Slip",
                      rev:["Membership Dues","Slip Fees","F&B Revenue"],
                      demandKey:"HH Boat Ownership %" },
  waterfront_resort:{ label:"Waterfront Resort",     icon:"🌊", color:"#0ea5e9", group:"Waterfront",
                      sizeLabel:"Keys",        occLabel:"Occ %",         priceUnit:"Key",
                      rev:["Room Revenue","Marina Fees","F&B Revenue"],
                      demandKey:"Tourism Index" },
  boat_rental:      { label:"Boat Rental / Charter",  icon:"🛥️", color:"#22d3ee", group:"Waterfront",
                      sizeLabel:"Vessels",     occLabel:"Utilization %", priceUnit:"Vessel",
                      rev:["Charter Revenue","Rental Revenue","Fuel/Ancillary"],
                      demandKey:"Visitor Spend Index" },

  // ── HOSPITALITY ─────────────────────────────────────────────────────────────
  hotel:            { label:"Hotel",                 icon:"🏨", color:"#a78bfa", group:"Hospitality",
                      sizeLabel:"Keys",        occLabel:"Occ % / RevPAR",priceUnit:"Key",
                      rev:["Room Revenue","F&B Revenue","Ancillary"],
                      demandKey:"Tourism Index" },
  boutique_hotel:   { label:"Boutique Hotel",        icon:"🛎️", color:"#8b5cf6", group:"Hospitality",
                      sizeLabel:"Keys",        occLabel:"Occ %",         priceUnit:"Key",
                      rev:["Room Revenue","F&B Revenue","Events Revenue"],
                      demandKey:"ADR vs Market" },
  motel:            { label:"Motel / Motor Inn",      icon:"🏩", color:"#c084fc", group:"Hospitality",
                      sizeLabel:"Keys",        occLabel:"Occ %",         priceUnit:"Key",
                      rev:["Room Revenue","Vending","Ancillary"],
                      demandKey:"Drive-by Traffic" },
  extended_stay:    { label:"Extended Stay",          icon:"🏠", color:"#e879f9", group:"Hospitality",
                      sizeLabel:"Units",       occLabel:"Occ %",         priceUnit:"Unit",
                      rev:["Weekly Room Rev","Monthly Room Rev","Ancillary"],
                      demandKey:"Corporate Demand Idx" },
  rv_park:          { label:"RV Park / Campground",   icon:"🚐", color:"#f59e0b", group:"Hospitality",
                      sizeLabel:"Sites",       occLabel:"Occ %",         priceUnit:"Site",
                      rev:["Site Rental","Hook-Ups","Store/Amenity"],
                      demandKey:"Snowbird Season %" },
  glamping:         { label:"Glamping / Eco-Resort",  icon:"⛺", color:"#fbbf24", group:"Hospitality",
                      sizeLabel:"Units",       occLabel:"Occ %",         priceUnit:"Unit",
                      rev:["Accommodation Rev","Experience Rev","F&B"],
                      demandKey:"Experiential Travel Idx" },

  // ── MULTIFAMILY / RESIDENTIAL ───────────────────────────────────────────────
  multifamily:      { label:"Multifamily",            icon:"🏢", color:"#4ade80", group:"Residential",
                      sizeLabel:"Units",       occLabel:"Occ %",         priceUnit:"Unit",
                      rev:["Rental Revenue","Parking Revenue","Ancillary"],
                      demandKey:"Renter Demand Index" },
  garden_apt:       { label:"Garden Apartments",      icon:"🌿", color:"#22c55e", group:"Residential",
                      sizeLabel:"Units",       occLabel:"Occ %",         priceUnit:"Unit",
                      rev:["Rental Revenue","Laundry/Vend","Storage"],
                      demandKey:"Rent Growth YoY %" },
  senior_housing:   { label:"Senior Housing",         icon:"👴", color:"#86efac", group:"Residential",
                      sizeLabel:"Units",       occLabel:"Occ %",         priceUnit:"Unit",
                      rev:["Rent/Care Fees","Ancillary Services","Memory Care"],
                      demandKey:"65+ Population %" },
  student_housing:  { label:"Student Housing",        icon:"🎓", color:"#bbf7d0", group:"Residential",
                      sizeLabel:"Beds",        occLabel:"Bed Occ %",     priceUnit:"Bed",
                      rev:["Bed Rental","Parking","Amenity Fees"],
                      demandKey:"Enrollment Growth %" },
  mobile_home:      { label:"Mobile Home Park",       icon:"🏘️", color:"#34d399", group:"Residential",
                      sizeLabel:"Pads",        occLabel:"Pad Occ %",     priceUnit:"Pad",
                      rev:["Pad Rent","Utility Fee","Ancillary"],
                      demandKey:"Affordable Housing Gap" },
  condo:            { label:"Condo / Townhome",       icon:"🏡", color:"#6ee7b7", group:"Residential",
                      sizeLabel:"Units",       occLabel:"Sold / Leased %",priceUnit:"Unit",
                      rev:["Sale Proceeds","HOA Income","Rental Pool"],
                      demandKey:"Median Home Price Idx" },
  single_family_sfr:{ label:"SFR Portfolio",          icon:"🏠", color:"#a7f3d0", group:"Residential",
                      sizeLabel:"Homes",       occLabel:"Occ %",         priceUnit:"Home",
                      rev:["Rental Revenue","Pet Fees","Late/Other"],
                      demandKey:"SFR Rent Growth %" },

  // ── INDUSTRIAL ──────────────────────────────────────────────────────────────
  industrial:       { label:"Industrial / Flex",      icon:"🏭", color:"#fb923c", group:"Industrial",
                      sizeLabel:"Sq Ft",       occLabel:"Leased %",      priceUnit:"Sq Ft",
                      rev:["NNN Rent","Reimbursements","Other Income"],
                      demandKey:"Industrial Vacancy %" },
  warehouse:        { label:"Warehouse / Distribution",icon:"📦", color:"#f97316", group:"Industrial",
                      sizeLabel:"Sq Ft",       occLabel:"Leased %",      priceUnit:"Sq Ft",
                      rev:["Base Rent","NNN Reimb","Other"],
                      demandKey:"Port Proximity Score" },
  cold_storage:     { label:"Cold Storage",           icon:"🧊", color:"#fed7aa", group:"Industrial",
                      sizeLabel:"Sq Ft",       occLabel:"Leased %",      priceUnit:"Sq Ft",
                      rev:["Storage Fees","Handling Fees","Ancillary"],
                      demandKey:"Food Logistics Demand" },
  self_storage:     { label:"Self Storage",           icon:"🗃️", color:"#facc15", group:"Industrial",
                      sizeLabel:"Units",       occLabel:"Occ %",         priceUnit:"Unit",
                      rev:["Storage Revenue","Insurance","Truck Rental"],
                      demandKey:"Storage Units / 1K Pop" },
  data_center:      { label:"Data Center",            icon:"🖥️", color:"#fde68a", group:"Industrial",
                      sizeLabel:"MW / Cabinets",occLabel:"Power Util %", priceUnit:"Cabinet",
                      rev:["Colocation Rev","Power Revenue","Managed Svcs"],
                      demandKey:"Cloud Demand Index" },
  truck_terminal:   { label:"Truck Terminal / Logistics",icon:"🚛",color:"#fbbf24",group:"Industrial",
                      sizeLabel:"Doors / Acres",occLabel:"Utilization %",priceUnit:"Door",
                      rev:["Docking Fees","Storage","Cross-Dock"],
                      demandKey:"Freight Traffic Index" },

  // ── OFFICE ──────────────────────────────────────────────────────────────────
  office:           { label:"Office",                 icon:"🏬", color:"#60a5fa", group:"Office",
                      sizeLabel:"Sq Ft",       occLabel:"Leased %",      priceUnit:"Sq Ft",
                      rev:["Base Rent","Parking","Ancillary"],
                      demandKey:"Office Absorption Rate" },
  medical_office:   { label:"Medical Office",         icon:"🏥", color:"#93c5fd", group:"Office",
                      sizeLabel:"Sq Ft",       occLabel:"Leased %",      priceUnit:"Sq Ft",
                      rev:["NNN Rent","Reimb","Parking"],
                      demandKey:"Healthcare Demand Idx" },
  coworking:        { label:"Co-working / Flex Office",icon:"💼", color:"#bfdbfe", group:"Office",
                      sizeLabel:"Desks / Offices",occLabel:"Util %",     priceUnit:"Desk",
                      rev:["Membership Rev","Private Office","Meeting Rooms"],
                      demandKey:"Remote Work Penetration" },
  creative_office:  { label:"Creative / Loft Office", icon:"🎨", color:"#dbeafe", group:"Office",
                      sizeLabel:"Sq Ft",       occLabel:"Leased %",      priceUnit:"Sq Ft",
                      rev:["Base Rent","Event Space","Parking"],
                      demandKey:"Creative Sector Jobs %" },

  // ── RETAIL ──────────────────────────────────────────────────────────────────
  retail:           { label:"Retail Strip",           icon:"🛍️", color:"#f472b6", group:"Retail",
                      sizeLabel:"Sq Ft",       occLabel:"Leased %",      priceUnit:"Sq Ft",
                      rev:["Base Rent","NNN Reimb","Overage Rent"],
                      demandKey:"Retail Sales PSF" },
  anchored_retail:  { label:"Anchored Shopping Ctr",  icon:"🏪", color:"#f9a8d4", group:"Retail",
                      sizeLabel:"Sq Ft",       occLabel:"Leased %",      priceUnit:"Sq Ft",
                      rev:["Anchor Rent","Inline Rent","NNN Reimb"],
                      demandKey:"Trade Area Population" },
  nnn_single_tenant:{ label:"NNN Single Tenant",      icon:"🏦", color:"#fbcfe8", group:"Retail",
                      sizeLabel:"Sq Ft",       occLabel:"Lease Term Rem.",priceUnit:"Sq Ft",
                      rev:["Base Rent","NNN Reimb","Other"],
                      demandKey:"Tenant Credit Rating" },
  car_wash:         { label:"Car Wash",               icon:"🚗", color:"#22d3ee", group:"Operating Biz",
                      sizeLabel:"Bays / Tunnels",occLabel:"Util %",      priceUnit:"Bay",
                      rev:["Wash Revenue","Membership Rev","Vending"],
                      demandKey:"Vehicles / Day" },
  gas_station:      { label:"Gas Station / C-Store",  icon:"⛽", color:"#67e8f9", group:"Operating Biz",
                      sizeLabel:"Pumps / Sq Ft",occLabel:"Traffic Index", priceUnit:"Pump",
                      rev:["Fuel Margin","C-Store Revenue","Car Wash"],
                      demandKey:"Daily Traffic Count" },
  restaurant:       { label:"Restaurant / QSR",       icon:"🍽️", color:"#fdba74", group:"Operating Biz",
                      sizeLabel:"Seats",       occLabel:"Table Turn Rate",priceUnit:"Seat",
                      rev:["Food Revenue","Beverage Rev","Catering/Other"],
                      demandKey:"Daytime Population" },
  fast_food:        { label:"Fast Food / Drive-Thru",  icon:"🍔", color:"#fca5a5", group:"Operating Biz",
                      sizeLabel:"Sq Ft",       occLabel:"Drive-Thru Spd.",priceUnit:"Sq Ft",
                      rev:["Sales Revenue","Catering","Loyalty/Digital"],
                      demandKey:"Traffic Count" },

  // ── LAND / SPECIAL PURPOSE ──────────────────────────────────────────────────
  ranchland:        { label:"Ranchland / Farm",       icon:"🌾", color:"#a3e635", group:"Land",
                      sizeLabel:"Acres",       occLabel:"Utilization %", priceUnit:"Acre",
                      rev:["Grazing/Crop Lease","Hunting Lease","Timber/Other"],
                      demandKey:"Agricultural Land Value" },
  timberland:       { label:"Timberland",             icon:"🌲", color:"#84cc16", group:"Land",
                      sizeLabel:"Acres",       occLabel:"Harvest Cycle",  priceUnit:"Acre",
                      rev:["Timber Sales","Carbon Credits","Hunting Lease"],
                      demandKey:"Timber Price Index" },
  dev_land:         { label:"Development Site",       icon:"🏗️", color:"#d9f99d", group:"Land",
                      sizeLabel:"Acres",       occLabel:"Entitlement %", priceUnit:"Acre",
                      rev:["Land Lease","Billboard/Tower","Mineral Rights"],
                      demandKey:"Permit Activity Index" },
  solar_land:       { label:"Solar / Energy Land",    icon:"☀️", color:"#fef08a", group:"Land",
                      sizeLabel:"Acres / MW",  occLabel:"Capacity Util %",priceUnit:"Acre",
                      rev:["PPA Revenue","Land Lease","SREC Credits"],
                      demandKey:"Solar Irradiance Score" },

  // ── SPECIAL PURPOSE ─────────────────────────────────────────────────────────
  parking:          { label:"Parking Garage / Lot",   icon:"🅿️", color:"#94a3b8", group:"Special Purpose",
                      sizeLabel:"Spaces",      occLabel:"Occ %",         priceUnit:"Space",
                      rev:["Hourly Revenue","Monthly Permits","Event Parking"],
                      demandKey:"CBD Parking Demand" },
  car_dealership:   { label:"Auto Dealership",        icon:"🚘", color:"#64748b", group:"Special Purpose",
                      sizeLabel:"Sq Ft / Lots",occLabel:"Inventory Turn", priceUnit:"Sq Ft",
                      rev:["Vehicle Sales","F&I Income","Service/Parts"],
                      demandKey:"Auto Sales Index" },
  church:           { label:"Church / Religious",     icon:"⛪", color:"#c8a96e", group:"Special Purpose",
                      sizeLabel:"Seats / Sq Ft",occLabel:"Congregation",  priceUnit:"Seat",
                      rev:["Tithes/Donations","Event Rental","School Fees"],
                      demandKey:"Congregation Growth" },
  school:           { label:"School / Daycare",       icon:"🏫", color:"#86efac", group:"Special Purpose",
                      sizeLabel:"Seats / Sq Ft",occLabel:"Enrollment %",  priceUnit:"Seat",
                      rev:["Tuition Revenue","Subsidy/Grant","Aftercare"],
                      demandKey:"Child Pop Under 18 %" },
  theater:          { label:"Theater / Entertainment",icon:"🎭", color:"#e879f9", group:"Special Purpose",
                      sizeLabel:"Seats",       occLabel:"Occ %",         priceUnit:"Seat",
                      rev:["Ticket Revenue","Concessions","Event Rental"],
                      demandKey:"Arts & Culture Index" },
  gym_fitness:      { label:"Gym / Fitness Center",   icon:"🏋️", color:"#4ade80", group:"Operating Biz",
                      sizeLabel:"Sq Ft / Members",occLabel:"Util %",    priceUnit:"Member",
                      rev:["Membership Dues","Personal Training","Retail"],
                      demandKey:"Fitness Penetration %" },
  laundromat:       { label:"Laundromat",             icon:"🧺", color:"#67e8f9", group:"Operating Biz",
                      sizeLabel:"Machines",    occLabel:"Util %",        priceUnit:"Machine",
                      rev:["Wash Revenue","Dry Revenue","Ancillary"],
                      demandKey:"Renter Household Density" },
  car_rental:       { label:"Car Rental",             icon:"🚙", color:"#fb923c", group:"Operating Biz",
                      sizeLabel:"Vehicles",    occLabel:"Fleet Util %",  priceUnit:"Vehicle",
                      rev:["Rental Revenue","Insurance/Fees","Ancillary"],
                      demandKey:"Airport Traffic Index" },
  mini_storage_plus:{ label:"Mini Storage + Wine",    icon:"🍷", color:"#c084fc", group:"Industrial",
                      sizeLabel:"Units",       occLabel:"Occ %",         priceUnit:"Unit",
                      rev:["Storage Fees","Climate Fees","Concierge"],
                      demandKey:"HH Income > $100K %" },
  mixed_use:        { label:"Mixed-Use",              icon:"🏙️", color:"#818cf8", group:"Commercial",
                      sizeLabel:"Sq Ft",       occLabel:"Blended Occ %", priceUnit:"Sq Ft",
                      rev:["Retail Rent","Residential Rent","Parking"],
                      demandKey:"Urban Density Score" },
  life_science:     { label:"Life Science / Lab",     icon:"🔬", color:"#7dd3fc", group:"Office",
                      sizeLabel:"Sq Ft",       occLabel:"Leased %",      priceUnit:"Sq Ft",
                      rev:["Lab Rent","NNN Reimb","Shared Services"],
                      demandKey:"Bio Cluster Proximity" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PropertyData {
  id: number | string;
  assetClass: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  status: string;
  subtype: string;
  askingPrice: number;
  noi: number;
  capRate: number;
  occupancy: number;
  yearBuilt: number;
  size: number;
  acreage: number;
  waterFrontage: number;
  rev1: number;
  rev2: number;
  rev3: number;
  amenities: string[];
  permits: string[];
  demographics: { medIncome: number; popGrowth: number; avgAge: number; keyMetric: number };
  market: { rentGrowth: number[]; vacancyTrend: number[]; compSales: number };
  score: number;
  tier: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIER + STATUS COLORS
// ═══════════════════════════════════════════════════════════════════════════════
const TIER_COLOR: Record<string, string> = { "A+":"#00f5d4", A:"#4ade80", B:"#facc15", C:"#f87171", D:"#f87171" };
const STATUS_COLOR: Record<string, string> = { "Active":"#4ade80","Stabilized":"#00f5d4","Value-Add":"#facc15","Distressed":"#f87171","Under Contract":"#a78bfa","Off Market":"#94a3b8","Prospect":"#60a5fa" };

// ═══════════════════════════════════════════════════════════════════════════════
// MAP CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const MAP_W = 800, MAP_H = 520;
const GEO = { minLat:27.65, maxLat:28.22, minLng:-82.90, maxLng:-82.35 };

function geoToXY(lat: number, lng: number) {
  return {
    x: ((lng - GEO.minLng) / (GEO.maxLng - GEO.minLng)) * MAP_W,
    y: MAP_H - ((lat - GEO.minLat) / (GEO.maxLat - GEO.minLat)) * MAP_H,
  };
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════
function ScoreBadge({ score, tier }: { score: number; tier: string }) {
  const c = TIER_COLOR[tier] || "#4a7fa5";
  return (
    <div style={{ width:44,height:44,borderRadius:"50%",border:`2px solid ${c}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:`${c}18`,flexShrink:0 }}>
      <span style={{ fontSize:14,fontWeight:700,color:c,lineHeight:1 }}>{score}</span>
      <span style={{ fontSize:7,color:c,letterSpacing:1 }}>{tier}</span>
    </div>
  );
}

function Pill({ label, color="#4a7fa5" }: { label: string; color?: string }) {
  return <span style={{ padding:"2px 6px",borderRadius:3,fontSize:9,fontWeight:600,background:`${color}18`,color,border:`1px solid ${color}30`,letterSpacing:0.3,whiteSpace:"nowrap" }}>{label}</span>;
}

function StatBox({ label, value, accent, sub }: { label: string; value: string | number; accent?: string; sub?: string }) {
  return (
    <div style={{ background:"#080f1a",borderRadius:5,padding:"8px 10px",border:"1px solid #102030" }}>
      <div style={{ fontSize:8,color:"#2a5070",textTransform:"uppercase",letterSpacing:1,marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:17,fontWeight:700,color:accent||"#c0d8ee",fontFamily:"'IBM Plex Mono',monospace",lineHeight:1.1 }}>{value}</div>
      {sub && <div style={{ fontSize:8,color:"#2a5070",marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function BarGauge({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ marginBottom:7 }}>
      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:3 }}>
        <span style={{ fontSize:9,color:"#2a5070" }}>{label}</span>
        <span style={{ fontSize:9,color,fontFamily:"monospace" }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ height:3,background:"#0a1a28",borderRadius:2 }}>
        <div style={{ width:`${Math.min(100,pct)}%`,height:"100%",background:color,borderRadius:2,transition:"width 0.5s" }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAP CANVAS
// ═══════════════════════════════════════════════════════════════════════════════
function MapCanvas({ properties, selected, onSelect }: { properties: PropertyData[]; selected: PropertyData | null; onSelect: (p: PropertyData | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hoverId, setHoverId] = useState<number | string | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, MAP_W, MAP_H);

    // Background
    const bg = ctx.createLinearGradient(0,0,MAP_W,MAP_H);
    bg.addColorStop(0,"#030810"); bg.addColorStop(1,"#040c16");
    ctx.fillStyle = bg; ctx.fillRect(0,0,MAP_W,MAP_H);

    // Grid
    ctx.strokeStyle="#081826"; ctx.lineWidth=1;
    for(let x=0;x<MAP_W;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,MAP_H);ctx.stroke();}
    for(let y=0;y<MAP_H;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(MAP_W,y);ctx.stroke();}

    // Tampa Bay water fill
    ctx.fillStyle="#050e1a";
    ctx.beginPath();
    ctx.moveTo(300,160);ctx.bezierCurveTo(430,180,510,285,530,435);
    ctx.bezierCurveTo(490,462,400,468,345,438);
    ctx.bezierCurveTo(265,398,250,295,300,160);
    ctx.fill();
    ctx.strokeStyle="#0b2035"; ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.moveTo(0,55);ctx.bezierCurveTo(115,72,185,165,305,182);
    ctx.bezierCurveTo(400,196,468,348,578,386);
    ctx.bezierCurveTo(655,406,725,436,MAP_W,428);
    ctx.stroke();

    // Heat blobs
    properties.forEach(p => {
      const ac = ASSET_REGISTRY[p.assetClass];
      if (!ac) return;
      const {x,y} = geoToXY(p.lat, p.lng);
      const rgb = hexToRgb(ac.color);
      const radius = 60 + p.score * 0.6;
      const intensity = p.score / 100;
      const hg = ctx.createRadialGradient(x,y,0,x,y,radius);
      hg.addColorStop(0, `rgba(${rgb},${0.28*intensity})`);
      hg.addColorStop(0.5,`rgba(${rgb},${0.10*intensity})`);
      hg.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle=hg; ctx.beginPath(); ctx.arc(x,y,radius,0,Math.PI*2); ctx.fill();
    });

    // Markers
    properties.forEach(p => {
      const ac = ASSET_REGISTRY[p.assetClass];
      const color = ac?.color || "#4a7fa5";
      const {x,y} = geoToXY(p.lat, p.lng);
      const isSel = selected?.id===p.id;
      const isHov = hoverId===p.id;
      const r = isSel ? 13 : isHov ? 10 : 8;

      if (isSel) {
        [22,33].forEach((ring,i) => {
          ctx.strokeStyle=color; ctx.lineWidth=1;
          ctx.globalAlpha=i===0?0.45:0.15;
          ctx.beginPath(); ctx.arc(x,y,ring,0,Math.PI*2); ctx.stroke();
        });
        ctx.globalAlpha=1;
      }

      ctx.shadowColor=color; ctx.shadowBlur=isSel?20:8;
      ctx.fillStyle=isSel||isHov?color:`${color}c0`;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;

      if (isSel||isHov) {
        ctx.fillStyle="#ddeeff"; ctx.font="bold 10px 'IBM Plex Mono',monospace";
        ctx.textAlign="center";
        ctx.fillText(p.name.split(" ").slice(0,2).join(" "),x,y-r-5);
      }
      ctx.font="10px serif"; ctx.textAlign="center";
      ctx.fillText(ac?.icon||"●",x,y+3.5);
    });
  }, [properties, selected, hoverId]);

  const onClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(MAP_W/rect.width);
    const my=(e.clientY-rect.top)*(MAP_H/rect.height);
    let closest: PropertyData | null = null, minD=28;
    properties.forEach(p => {
      const {x,y}=geoToXY(p.lat,p.lng);
      const d=Math.hypot(mx-x,my-y);
      if(d<minD){minD=d;closest=p;}
    });
    onSelect(closest?.id===selected?.id?null:closest);
  }, [properties, selected, onSelect]);

  const onMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = ref.current;
    if (!canvas) return;
    const rect=canvas.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(MAP_W/rect.width);
    const my=(e.clientY-rect.top)*(MAP_H/rect.height);
    let found: number | string | null = null;
    properties.forEach(p=>{
      const {x,y}=geoToXY(p.lat,p.lng);
      if(Math.hypot(mx-x,my-y)<18) found=p.id;
    });
    setHoverId(found);
  }, [properties]);

  return (
    <canvas ref={ref} width={MAP_W} height={MAP_H}
      onClick={onClick} onMouseMove={onMove}
      style={{ width:"100%",height:"100%",cursor:hoverId?"pointer":"default",borderRadius:8 }} />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETAIL PANEL — fully driven by ASSET_REGISTRY, zero hardcoded labels
// ═══════════════════════════════════════════════════════════════════════════════
function DetailPanel({ p, onClose }: { p: PropertyData; onClose: () => void }) {
  const [tab, setTab] = useState("overview");

  const ac = ASSET_REGISTRY[p.assetClass] || { label:p.assetClass, icon:"🏢", color:"#4a7fa5", group:"Other", sizeLabel:"Units", occLabel:"Occ %", rev:["Revenue 1","Revenue 2","Revenue 3"] as [string,string,string], demandKey:"Demand Index", priceUnit:"Unit" };
  const acColor = ac.color;
  const years = ["2020","2021","2022","2023","2024"];
  const rentData = years.map((y,i)=>({year:y,growth:p.market.rentGrowth[i]||0}));
  const vacData = years.map((y,i)=>({year:y,vacancy:p.market.vacancyTrend[i]||0}));
  const radar = [
    {subject:"Occ/Util",  value:p.occupancy},
    {subject:"NOI Yield", value:Math.min(100,p.capRate*10)},
    {subject:"Mkt Growth",value:Math.min(100,(p.market.rentGrowth[4]||0)*10)},
    {subject:"Income",    value:Math.min(100,p.demographics.medIncome/1000)},
    {subject:ac.demandKey.split(" ")[0],value:Math.min(100,p.demographics.keyMetric)},
    {subject:"Score",     value:p.score},
  ];

  const sizeFormatted = p.size >= 10000 ? `${(p.size/1000).toFixed(0)}K` : p.size.toLocaleString();
  const pricePerUnit = p.size > 0 ? `$${Math.round(p.askingPrice/p.size).toLocaleString()}` : "—";

  return (
    <div style={{ background:"#050c16",border:`1px solid ${acColor}30`,borderRadius:10,height:"100%",display:"flex",flexDirection:"column",overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"11px 13px",borderBottom:"1px solid #091828",background:"#060d1a",flexShrink:0 }}>
        <div style={{ display:"flex",gap:9,alignItems:"flex-start" }}>
          <ScoreBadge score={p.score} tier={p.tier} />
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ display:"flex",alignItems:"center",gap:5 }}>
              <span style={{ fontSize:16 }}>{ac.icon}</span>
              <span style={{ fontSize:12,fontWeight:700,color:"#d8ecfc",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.name}</span>
            </div>
            <div style={{ fontSize:9,color:"#1e3858",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.address}</div>
            <div style={{ display:"flex",gap:3,flexWrap:"wrap",marginTop:5 }}>
              <Pill label={ac.label} color={acColor} />
              <Pill label={p.subtype} color="#4a7fa5" />
              <Pill label={p.status} color={STATUS_COLOR[p.status]||"#4a7fa5"} />
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#2a4a60",cursor:"pointer",fontSize:16,lineHeight:1,padding:2 }}>✕</button>
        </div>
        <div style={{ display:"flex",marginTop:9,borderBottom:"1px solid #091828" }}>
          {(["overview","financials","demographics","market"] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              background:"none",border:"none",borderBottom:`2px solid ${tab===t?acColor:"transparent"}`,
              color:tab===t?acColor:"#1e3858",padding:"5px 9px",cursor:"pointer",
              fontSize:8,fontWeight:700,textTransform:"uppercase",letterSpacing:1,transition:"all 0.15s"
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ flex:1,overflowY:"auto",padding:"11px 13px" }}>
        {/* OVERVIEW */}
        {tab==="overview" && (
          <div style={{ display:"flex",flexDirection:"column",gap:9 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6 }}>
              <StatBox label="Asking Price" value={`$${(p.askingPrice/1e6).toFixed(1)}M`} />
              <StatBox label="NOI"          value={`$${(p.noi/1000).toFixed(0)}K`} accent={acColor} />
              <StatBox label="Cap Rate"     value={`${p.capRate.toFixed(2)}%`} accent={acColor} />
              <StatBox label={ac.sizeLabel} value={sizeFormatted} />
              <StatBox label={ac.occLabel}  value={`${p.occupancy}%`} accent={p.occupancy>90?"#00f5d4":p.occupancy>75?"#facc15":"#f87171"} />
              <StatBox label="Year Built"   value={p.yearBuilt} sub={`${2026-p.yearBuilt}yr`} />
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
              <StatBox label="Acreage" value={`${p.acreage} ac`} />
              {p.waterFrontage>0 && <StatBox label="Frontage" value={`${p.waterFrontage} ft`} accent={acColor} />}
            </div>
            {p.amenities?.length>0 && (
              <div style={{ background:"#07111c",borderRadius:5,padding:"9px 11px",border:"1px solid #102030" }}>
                <div style={{ fontSize:8,color:"#2a5070",textTransform:"uppercase",letterSpacing:1,marginBottom:5 }}>Amenities & Features</div>
                <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>{p.amenities.map(a=><Pill key={a} label={a} color={acColor}/>)}</div>
              </div>
            )}
            {p.permits?.length>0 && (
              <div style={{ background:"#07111c",borderRadius:5,padding:"9px 11px",border:"1px solid #102030" }}>
                <div style={{ fontSize:8,color:"#2a5070",textTransform:"uppercase",letterSpacing:1,marginBottom:5 }}>Permits & Compliance</div>
                <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
                  {p.permits.map(pm=><Pill key={pm} label={pm} color={pm.toLowerCase().includes("expired")||pm.toLowerCase().includes("review")?"#facc15":"#4ade80"}/>)}
                </div>
              </div>
            )}
            <div style={{ background:"#07111c",borderRadius:5,padding:"9px 11px",border:"1px solid #102030" }}>
              <div style={{ fontSize:8,color:"#2a5070",textTransform:"uppercase",letterSpacing:1 }}>Performance Radar</div>
              <ResponsiveContainer width="100%" height={145}>
                <RadarChart data={radar}>
                  <PolarGrid stroke="#0a1e30"/>
                  <PolarAngleAxis dataKey="subject" tick={{fill:"#2a5070",fontSize:8}}/>
                  <Radar dataKey="value" stroke={acColor} fill={acColor} fillOpacity={0.15}/>
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* FINANCIALS */}
        {tab==="financials" && (
          <div style={{ display:"flex",flexDirection:"column",gap:9 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6 }}>
              <StatBox label={ac.rev[0]} value={`$${(p.rev1/1000).toFixed(0)}K`} />
              <StatBox label={ac.rev[1]} value={`$${(p.rev2/1000).toFixed(0)}K`} />
              <StatBox label={ac.rev[2]} value={`$${(p.rev3/1000).toFixed(0)}K`} />
            </div>
            <div style={{ background:"#07111c",borderRadius:5,padding:"9px 11px",border:"1px solid #102030" }}>
              <div style={{ fontSize:8,color:"#2a5070",textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Revenue Mix</div>
              <ResponsiveContainer width="100%" height={115}>
                <BarChart data={[{name:ac.rev[0].split("/")[0],value:p.rev1},{name:ac.rev[1].split("/")[0],value:p.rev2},{name:ac.rev[2].split("/")[0],value:p.rev3}]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0a1e30"/>
                  <XAxis dataKey="name" tick={{fill:"#2a5070",fontSize:8}}/>
                  <YAxis tick={{fill:"#2a5070",fontSize:7}} tickFormatter={(v: number)=>`$${v/1000}K`}/>
                  <ReTooltip formatter={(v: number)=>[`$${v.toLocaleString()}`,""]} contentStyle={{background:"#050d18",border:"1px solid #102030",borderRadius:4,fontSize:9}}/>
                  <Bar dataKey="value" fill={acColor} radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
              <StatBox label="Recent Comps"                value={`$${(p.market.compSales/1e6).toFixed(1)}M`} />
              <StatBox label={`Price / ${ac.priceUnit}`}  value={pricePerUnit} accent={acColor} />
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
              <StatBox label="Total Revenue (Est)"  value={`$${((p.rev1+p.rev2+p.rev3)/1000).toFixed(0)}K`} />
              <StatBox label="NOI Margin"            value={`${Math.round((p.noi/(p.rev1+p.rev2+p.rev3))*100)}%`} accent={acColor} />
            </div>
          </div>
        )}

        {/* DEMOGRAPHICS */}
        {tab==="demographics" && (
          <div style={{ display:"flex",flexDirection:"column",gap:9 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
              <StatBox label="Median Income"   value={`$${(p.demographics.medIncome/1000).toFixed(1)}K`} accent={acColor} />
              <StatBox label="Pop Growth"      value={`+${p.demographics.popGrowth}%`} />
              <StatBox label="Avg Age"         value={p.demographics.avgAge} />
              <StatBox label={ac.demandKey}    value={`${p.demographics.keyMetric}`} accent={acColor} />
            </div>
            <div style={{ background:"#07111c",borderRadius:5,padding:"9px 11px",border:"1px solid #102030" }}>
              <div style={{ fontSize:8,color:"#2a5070",textTransform:"uppercase",letterSpacing:1,marginBottom:7 }}>Demand Strength</div>
              <BarGauge label="Income vs FL State Avg"   pct={Math.min(100,(p.demographics.medIncome/65000)*75)}  color={acColor}/>
              <BarGauge label="Population Growth"        pct={Math.min(100, p.demographics.popGrowth*20)}          color={acColor}/>
              <BarGauge label="Overall Market Score"     pct={p.score}                                             color={acColor}/>
            </div>
          </div>
        )}

        {/* MARKET */}
        {tab==="market" && (
          <div style={{ display:"flex",flexDirection:"column",gap:9 }}>
            <div style={{ background:"#07111c",borderRadius:5,padding:"9px 11px",border:"1px solid #102030" }}>
              <div style={{ fontSize:8,color:"#2a5070",textTransform:"uppercase",letterSpacing:1,marginBottom:3 }}>Rate / Rent Growth YoY %</div>
              <ResponsiveContainer width="100%" height={115}>
                <LineChart data={rentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0a1e30"/>
                  <XAxis dataKey="year" tick={{fill:"#2a5070",fontSize:9}}/>
                  <YAxis tick={{fill:"#2a5070",fontSize:7}} tickFormatter={(v: number)=>`${v}%`}/>
                  <ReTooltip formatter={(v: number)=>[`${v}%`,"Growth"]} contentStyle={{background:"#050d18",border:"1px solid #102030",borderRadius:4,fontSize:9}}/>
                  <Line type="monotone" dataKey="growth" stroke={acColor} strokeWidth={2} dot={{fill:acColor,r:3}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background:"#07111c",borderRadius:5,padding:"9px 11px",border:"1px solid #102030" }}>
              <div style={{ fontSize:8,color:"#2a5070",textTransform:"uppercase",letterSpacing:1,marginBottom:3 }}>Vacancy / Availability %</div>
              <ResponsiveContainer width="100%" height={115}>
                <LineChart data={vacData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0a1e30"/>
                  <XAxis dataKey="year" tick={{fill:"#2a5070",fontSize:9}}/>
                  <YAxis tick={{fill:"#2a5070",fontSize:7}} tickFormatter={(v: number)=>`${v}%`}/>
                  <ReTooltip formatter={(v: number)=>[`${v}%`,"Vacancy"]} contentStyle={{background:"#050d18",border:"1px solid #102030",borderRadius:4,fontSize:9}}/>
                  <Line type="monotone" dataKey="vacancy" stroke="#f87171" strokeWidth={2} dot={{fill:"#f87171",r:3}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
              <StatBox label="5yr Growth"      value={`+${p.market.rentGrowth[4]}%`} accent={acColor}/>
              <StatBox label="Current Vacancy" value={`${p.market.vacancyTrend[4]}%`} accent={p.market.vacancyTrend[4]<8?"#00f5d4":p.market.vacancyTrend[4]<20?"#facc15":"#f87171"}/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function VantageIntelligenceMap() {
  const [selected,     setSelected]     = useState<PropertyData | null>(null);
  const [activeGroups, setActiveGroups] = useState<Set<string>>(()=>new Set(Object.values(ASSET_REGISTRY).map(v=>v.group)));
  const [filterTier,   setFilterTier]   = useState("ALL");
  const [searchText,   setSearchText]   = useState("");

  // Fetch from acquisition_properties table, fall back to samples
  const { data: dbProperties } = useQuery<PropertyData[]>({
    queryKey: ["/api/acquisition-properties"],
    staleTime: 60_000,
    retry: false,
  });

  const properties = dbProperties?.length ? dbProperties : [];

  // Derive all unique groups from registry
  const allGroups = useMemo(()=>[...new Set(Object.values(ASSET_REGISTRY).map(v=>v.group))], []);

  // Derive all classes per group
  const classesByGroup = useMemo(()=>{
    return allGroups.reduce<Record<string, [string, AssetRegistryEntry][]>>((acc, group)=>{
      acc[group] = Object.entries(ASSET_REGISTRY).filter(([,v])=>v.group===group);
      return acc;
    }, {});
  }, [allGroups]);

  // Active class keys = all keys whose group is active
  const activeClassKeys = useMemo(()=>{
    return new Set(
      Object.entries(ASSET_REGISTRY)
        .filter(([,v])=>activeGroups.has(v.group))
        .map(([k])=>k)
    );
  }, [activeGroups]);

  function toggleGroup(group: string) {
    setActiveGroups(prev=>{
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      return next;
    });
  }

  const filtered = useMemo(()=>{
    return properties.filter(p=>
      activeClassKeys.has(p.assetClass) &&
      (filterTier==="ALL" || p.tier===filterTier) &&
      (!searchText || p.name.toLowerCase().includes(searchText.toLowerCase()) || p.address.toLowerCase().includes(searchText.toLowerCase()))
    );
  }, [properties, activeClassKeys, filterTier, searchText]);

  const portfolioStats = useMemo(()=>({
    count:      filtered.length,
    totalValue: filtered.reduce((s,p)=>s+p.askingPrice,0),
    avgCap:     filtered.length ? filtered.reduce((s,p)=>s+p.capRate,0)/filtered.length : 0,
    avgOcc:     filtered.length ? filtered.reduce((s,p)=>s+p.occupancy,0)/filtered.length : 0,
    classCount: new Set(filtered.map(p=>p.assetClass)).size,
  }), [filtered]);

  const tiers = ["ALL","A+","A","B","C"];

  return (
    <div style={{ fontFamily:"'IBM Plex Sans','Helvetica Neue',sans-serif",background:"#030810",color:"#c0d8ee",height:"100vh",display:"flex",flexDirection:"column",overflow:"hidden" }}>

      {/* TOP BAR */}
      <div style={{ height:48,padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #081824",background:"#040a14",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <div style={{ fontSize:14,fontWeight:800,letterSpacing:2.5,color:"#00d4ff",textTransform:"uppercase" }}>◈ Vantage</div>
          <div style={{ width:1,height:16,background:"#081824" }}/>
          <div style={{ fontSize:9,color:"#1a3858",letterSpacing:1 }}>PROPERTY INTELLIGENCE MAP</div>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:7 }}>
          <input value={searchText} onChange={e=>setSearchText(e.target.value)}
            placeholder="Search properties…"
            style={{ background:"#06101c",border:"1px solid #10253a",borderRadius:4,padding:"4px 9px",color:"#c0d8ee",fontSize:9,width:160,outline:"none" }}/>
          <button style={{ background:"#073660",border:"1px solid #0f5090",borderRadius:4,padding:"4px 10px",color:"#c0d8ee",fontSize:9,fontWeight:700,cursor:"pointer",letterSpacing:0.5 }}>+ Add Property</button>
        </div>
      </div>

      {/* BODY */}
      <div style={{ flex:1,display:"flex",overflow:"hidden" }}>

        {/* LEFT SIDEBAR */}
        <div style={{ width:230,borderRight:"1px solid #081824",background:"#040a14",display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden" }}>
          {/* Group toggles */}
          <div style={{ padding:"9px 9px 7px",borderBottom:"1px solid #081824",overflowY:"auto",maxHeight:"55%" }}>
            <div style={{ fontSize:7,color:"#1a3858",letterSpacing:2,textTransform:"uppercase",marginBottom:7 }}>Asset Groups</div>
            {allGroups.map(group=>{
              const items = classesByGroup[group]||[];
              const on = activeGroups.has(group);
              const representativeColor = items[0]?.[1]?.color || "#4a7fa5";
              return (
                <div key={group} style={{ marginBottom:8 }}>
                  <button onClick={()=>toggleGroup(group)} style={{
                    width:"100%",background:on?`${representativeColor}10`:"none",
                    border:`1px solid ${on?representativeColor+"40":"#0e1e2e"}`,
                    borderRadius:4,padding:"4px 7px",cursor:"pointer",
                    display:"flex",alignItems:"center",justifyContent:"space-between",
                    transition:"all 0.15s"
                  }}>
                    <span style={{ fontSize:9,fontWeight:700,color:on?representativeColor:"#1a3858" }}>{group}</span>
                    <span style={{ fontSize:8,color:on?representativeColor+"90":"#0e1e2e" }}>{items.length} types</span>
                  </button>
                  {on && (
                    <div style={{ paddingLeft:7,paddingTop:4,display:"flex",flexWrap:"wrap",gap:3 }}>
                      {items.map(([k,v])=>(
                        <div key={k} style={{ display:"flex",alignItems:"center",gap:3,opacity:filtered.some(p=>p.assetClass===k)?1:0.4 }}>
                          <div style={{ width:5,height:5,borderRadius:"50%",background:v.color }}/>
                          <span style={{ fontSize:8,color:"#1e4060" }}>{v.icon} {v.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tier filter */}
          <div style={{ padding:"7px 9px",borderBottom:"1px solid #081824",flexShrink:0 }}>
            <div style={{ fontSize:7,color:"#1a3858",letterSpacing:2,textTransform:"uppercase",marginBottom:5 }}>Investment Grade</div>
            <div style={{ display:"flex",gap:3 }}>
              {tiers.map(t=>(
                <button key={t} onClick={()=>setFilterTier(t)} style={{
                  background:filterTier===t?`${TIER_COLOR[t]||"#073660"}20`:"none",
                  border:`1px solid ${filterTier===t?(TIER_COLOR[t]||"#073660"):"#0e1e2e"}`,
                  borderRadius:4,padding:"3px 7px",fontSize:9,fontWeight:700,
                  color:filterTier===t?(TIER_COLOR[t]||"#4a9fd5"):"#1a3858",
                  cursor:"pointer"
                }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Property list */}
          <div style={{ flex:1,overflowY:"auto",padding:"7px 7px" }}>
            <div style={{ fontSize:7,color:"#102030",letterSpacing:1.5,marginBottom:5,textTransform:"uppercase" }}>{filtered.length} Properties</div>
            {filtered.map(p=>{
              const ac=ASSET_REGISTRY[p.assetClass]||{icon:"🏢",color:"#4a7fa5",label:p.assetClass};
              const isSel=selected?.id===p.id;
              return (
                <div key={p.id} onClick={()=>setSelected(isSel?null:p)}
                  style={{ padding:"8px 9px",borderRadius:5,cursor:"pointer",marginBottom:5,
                    background:isSel?"#0a1c30":"#060f1c",
                    border:`1px solid ${isSel?ac.color+"50":"#0a1828"}`,
                    transition:"all 0.15s" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ display:"flex",alignItems:"center",gap:4,marginBottom:2 }}>
                        <span style={{ fontSize:11 }}>{ac.icon}</span>
                        <span style={{ fontSize:10,fontWeight:700,color:"#b0ccdf",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.name}</span>
                      </div>
                      <div style={{ fontSize:8,color:"#182e42",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.address}</div>
                      <div style={{ display:"flex",gap:3,marginTop:4,flexWrap:"wrap" }}>
                        <Pill label={p.status} color={STATUS_COLOR[p.status]||"#4a7fa5"}/>
                        <Pill label={`${p.capRate.toFixed(2)}% cap`} color={ac.color}/>
                      </div>
                    </div>
                    <ScoreBadge score={p.score} tier={p.tier}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MAP */}
        <div style={{ flex:1,position:"relative",overflow:"hidden" }}>
          <MapCanvas properties={filtered} selected={selected} onSelect={setSelected}/>
          {properties.length === 0 && (
            <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#030810cc",gap:12 }}>
              <span style={{ fontSize:32 }}>⚓</span>
              <span style={{ fontSize:13,color:"#4a7fa5",fontWeight:600 }}>No properties found — add properties to see them here</span>
            </div>
          )}

          {/* Legend */}
          <div style={{ position:"absolute",bottom:12,left:12,background:"#030810e8",border:"1px solid #081824",borderRadius:6,padding:"8px 11px",backdropFilter:"blur(8px)" }}>
            <div style={{ fontSize:7,color:"#1a3858",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6 }}>Investment Grade</div>
            {([["A+","90–100"],["A","80–89"],["B","65–79"],["C","below 65"]] as const).map(([t,l])=>(
              <div key={t} style={{ display:"flex",alignItems:"center",gap:5,marginBottom:3 }}>
                <div style={{ width:6,height:6,borderRadius:"50%",background:TIER_COLOR[t]}}/>
                <span style={{ fontSize:8,color:"#1a3858" }}><b style={{ color:TIER_COLOR[t] }}>{t}</b> — {l}</span>
              </div>
            ))}
            <div style={{ marginTop:6,paddingTop:6,borderTop:"1px solid #081824" }}>
              <div style={{ fontSize:7,color:"#1a3858",letterSpacing:1,marginBottom:4 }}>ACTIVE CLASSES</div>
              <div style={{ display:"flex",flexWrap:"wrap",gap:5,maxWidth:200 }}>
                {[...new Set(filtered.map(p=>p.assetClass))].map(k=>{
                  const ac=ASSET_REGISTRY[k];
                  if(!ac) return null;
                  return (
                    <div key={k} style={{ display:"flex",alignItems:"center",gap:3 }}>
                      <div style={{ width:5,height:5,borderRadius:"50%",background:ac.color}}/>
                      <span style={{ fontSize:8,color:"#1e4060" }}>{ac.icon}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Portfolio stats overlay */}
          <div style={{ position:"absolute",top:12,right:12,background:"#030810e8",border:"1px solid #081824",borderRadius:6,padding:"9px 13px",backdropFilter:"blur(8px)",minWidth:155 }}>
            <div style={{ fontSize:7,color:"#1a3858",letterSpacing:1.5,textTransform:"uppercase",marginBottom:7 }}>Portfolio Snapshot</div>
            {[
              {label:"Properties",   value:portfolioStats.count},
              {label:"Total Value",  value:`$${(portfolioStats.totalValue/1e6).toFixed(1)}M`},
              {label:"Avg Cap Rate", value:`${portfolioStats.avgCap.toFixed(2)}%`},
              {label:"Avg Occ/Util", value:`${Math.round(portfolioStats.avgOcc)}%`},
              {label:"Asset Classes",value:portfolioStats.classCount},
            ].map(row=>(
              <div key={row.label} style={{ display:"flex",justifyContent:"space-between",gap:14,marginBottom:4 }}>
                <span style={{ fontSize:9,color:"#1a3858" }}>{row.label}</span>
                <span style={{ fontSize:9,color:"#c0d8ee",fontFamily:"monospace",fontWeight:700 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT DETAIL PANEL */}
        <div style={{ width:selected?345:0,flexShrink:0,overflow:"hidden",transition:"width 0.22s",borderLeft:"1px solid #081824",background:"#050c16" }}>
          {selected && (
            <div style={{ width:345,height:"100%",padding:9 }}>
              <DetailPanel p={selected} onClose={()=>setSelected(null)}/>
            </div>
          )}
        </div>
      </div>

      {/* STATUS BAR */}
      <div style={{ height:24,borderTop:"1px solid #081824",background:"#02060f",display:"flex",alignItems:"center",padding:"0 14px",gap:14,flexShrink:0 }}>
        <span style={{ fontSize:7,color:"#0e2030" }}>Tampa Bay MSA · FL</span>
        <span style={{ fontSize:7,color:"#0e2030" }}>·</span>
        <span style={{ fontSize:7,color:"#0e2030" }}>{filtered.length}/{properties.length} Properties Visible</span>
        <span style={{ fontSize:7,color:"#0e2030" }}>·</span>
        <span style={{ fontSize:7,color:"#0e2030" }}>{portfolioStats.classCount} Asset Classes Active</span>
        <span style={{ fontSize:7,color:"#0e2030" }}>·</span>
        <span style={{ fontSize:7,color:"#0e2030" }}>{Object.keys(ASSET_REGISTRY).length} Classes in Registry</span>
        <span style={{ fontSize:7,color:"#0e2030",marginLeft:"auto" }}>Vantage Intelligence v3.0</span>
      </div>
    </div>
  );
}
