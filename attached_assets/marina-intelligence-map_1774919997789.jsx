
import { useState, useRef, useEffect, useMemo } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid } from "recharts";

// ─── DATA ────────────────────────────────────────────────────────────────────

const PROPERTIES = [
  {
    id: 1, name: "Clearwater Harbor Marina", address: "900 Marina Way, Clearwater, FL 33755",
    lat: 27.965, lng: -82.800, type: "Full-Service Marina", slips: 220, status: "Active",
    askingPrice: 12400000, noi: 890000, capRate: 7.18, occupancy: 94,
    yearBuilt: 1988, acreage: 6.2, waterFrontage: 1800,
    fuelRevenue: 420000, storageRevenue: 310000, serviceRevenue: 160000,
    dockMaster: "Tom Hendricks", permits: ["FDEP Active", "Army Corps Approved"],
    amenities: ["Fuel Dock", "Dry Storage", "Ship Store", "Haul-Out"],
    demographics: { medIncome: 72400, popGrowth: 2.1, avgAge: 44, boatOwnership: 18.2 },
    market: { rentGrowth: [3.1, 4.2, 5.0, 4.8, 5.5], vacancyTrend: [8.2, 7.5, 6.8, 6.2, 6.0], compSales: 8800000 },
    score: 88, tier: "A"
  },
  {
    id: 2, name: "Palm Harbor Bay Marina", address: "2200 Bayshore Blvd, Palm Harbor, FL 34683",
    lat: 28.080, lng: -82.760, type: "Dry Storage Facility", slips: 85, status: "Active",
    askingPrice: 7200000, noi: 540000, capRate: 7.50, occupancy: 89,
    yearBuilt: 2002, acreage: 3.8, waterFrontage: 900,
    fuelRevenue: 180000, storageRevenue: 290000, serviceRevenue: 70000,
    dockMaster: "Sandra Reyes", permits: ["FDEP Active"],
    amenities: ["Dry Stack", "Forklift Launch", "Wash Bay"],
    demographics: { medIncome: 84200, popGrowth: 3.4, avgAge: 41, boatOwnership: 22.6 },
    market: { rentGrowth: [4.0, 4.5, 5.1, 5.8, 6.2], vacancyTrend: [12.0, 11.2, 10.5, 10.0, 11.2], compSales: 6900000 },
    score: 81, tier: "A"
  },
  {
    id: 3, name: "Tampa Bay Marine Center", address: "4100 Gandy Blvd, Tampa, FL 33611",
    lat: 27.870, lng: -82.570, type: "Mixed-Use Marina", slips: 310, status: "Value-Add",
    askingPrice: 18900000, noi: 1120000, capRate: 5.93, occupancy: 78,
    yearBuilt: 1975, acreage: 11.4, waterFrontage: 3100,
    fuelRevenue: 680000, storageRevenue: 220000, serviceRevenue: 220000,
    dockMaster: "Carlos Vega", permits: ["FDEP Under Review", "Expansion Pending"],
    amenities: ["Fuel Dock", "Haul-Out", "Repair Yard", "Restaurant Pad", "Brokerage"],
    demographics: { medIncome: 68900, popGrowth: 1.8, avgAge: 47, boatOwnership: 14.8 },
    market: { rentGrowth: [1.2, 2.0, 2.8, 3.1, 3.6], vacancyTrend: [24.0, 23.0, 22.5, 21.8, 22.0], compSales: 16200000 },
    score: 72, tier: "B"
  },
  {
    id: 4, name: "Tarpon Springs Anchorage", address: "610 Athens St, Tarpon Springs, FL 34689",
    lat: 28.145, lng: -82.755, type: "Wet Slip Marina", slips: 140, status: "Stabilized",
    askingPrice: 9100000, noi: 720000, capRate: 7.91, occupancy: 97,
    yearBuilt: 1994, acreage: 4.9, waterFrontage: 1400,
    fuelRevenue: 290000, storageRevenue: 195000, serviceRevenue: 235000,
    dockMaster: "Elaine Kourtis", permits: ["FDEP Active", "Army Corps Approved"],
    amenities: ["Fuel Dock", "Live Aboard Allowed", "Ship Store", "Pump-Out"],
    demographics: { medIncome: 61200, popGrowth: 1.2, avgAge: 52, boatOwnership: 20.4 },
    market: { rentGrowth: [2.8, 3.0, 3.5, 3.8, 4.0], vacancyTrend: [5.0, 4.2, 3.8, 3.2, 3.0], compSales: 8400000 },
    score: 90, tier: "A+"
  },
  {
    id: 5, name: "St. Pete Beach Marina", address: "7200 Gulf Blvd, St Pete Beach, FL 33706",
    lat: 27.720, lng: -82.740, type: "Resort Marina", slips: 195, status: "Active",
    askingPrice: 22500000, noi: 1380000, capRate: 6.13, occupancy: 91,
    yearBuilt: 2008, acreage: 8.1, waterFrontage: 2200,
    fuelRevenue: 520000, storageRevenue: 340000, serviceRevenue: 520000,
    dockMaster: "James Whitfield", permits: ["FDEP Active", "Army Corps Approved", "Hotel License"],
    amenities: ["Fuel Dock", "Hotel Integration", "Restaurant", "Yacht Charter", "Ship Store", "Pump-Out"],
    demographics: { medIncome: 91400, popGrowth: 4.1, avgAge: 38, boatOwnership: 24.8 },
    market: { rentGrowth: [5.2, 6.1, 7.0, 7.5, 8.2], vacancyTrend: [10.5, 9.8, 9.2, 9.0, 9.2], compSales: 20100000 },
    score: 85, tier: "A"
  },
  {
    id: 6, name: "Dunedin Causeway Marina", address: "1 Causeway Blvd, Dunedin, FL 34698",
    lat: 28.020, lng: -82.790, type: "Community Marina", slips: 65, status: "Distressed",
    askingPrice: 3100000, noi: 148000, capRate: 4.77, occupancy: 61,
    yearBuilt: 1969, acreage: 2.1, waterFrontage: 650,
    fuelRevenue: 48000, storageRevenue: 60000, serviceRevenue: 40000,
    dockMaster: "Unassigned", permits: ["FDEP Expired - Renewal Filed"],
    amenities: ["Basic Dockage", "Parking"],
    demographics: { medIncome: 58300, popGrowth: 0.8, avgAge: 56, boatOwnership: 16.1 },
    market: { rentGrowth: [0.5, 0.8, 1.0, 1.2, 1.5], vacancyTrend: [40.0, 42.0, 39.0, 38.5, 39.0], compSales: 2800000 },
    score: 54, tier: "C"
  },
];

const TIER_COLOR = { "A+": "#00f5a0", "A": "#4ade80", "B": "#facc15", "C": "#f87171" };
const STATUS_COLOR = { "Active": "#4ade80", "Stabilized": "#00f5a0", "Value-Add": "#facc15", "Distressed": "#f87171" };

// Map canvas dimensions
const MAP_W = 800, MAP_H = 520;

// Geo bounds for Tampa Bay area
const GEO = { minLat: 27.65, maxLat: 28.25, minLng: -82.90, maxLng: -82.45 };

function latLngToXY(lat, lng) {
  const x = ((lng - GEO.minLng) / (GEO.maxLng - GEO.minLng)) * MAP_W;
  const y = MAP_H - ((lat - GEO.minLat) / (GEO.maxLat - GEO.minLat)) * MAP_H;
  return { x, y };
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function ScoreBadge({ score, tier }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 48, height: 48, borderRadius: "50%", border: `2px solid ${TIER_COLOR[tier]}`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: `${TIER_COLOR[tier]}18`
      }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: TIER_COLOR[tier], lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 9, color: TIER_COLOR[tier], letterSpacing: 1 }}>{tier}</span>
      </div>
    </div>
  );
}

function Pill({ label, color }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
      background: `${color}20`, color, border: `1px solid ${color}40`, letterSpacing: 0.5
    }}>{label}</span>
  );
}

function StatBlock({ label, value, sub, accent }) {
  return (
    <div style={{ background: "#0d1b2a", borderRadius: 6, padding: "10px 14px", border: "1px solid #1e3a5f" }}>
      <div style={{ fontSize: 10, color: "#4a7fa5", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent || "#e8f4fd", fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#4a7fa5", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function HeatMapCanvas({ properties, selected, onSelect }) {
  const canvasRef = useRef(null);
  const [hoverId, setHoverId] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, MAP_W, MAP_H);

    // Background - stylized water
    const grad = ctx.createLinearGradient(0, 0, MAP_W, MAP_H);
    grad.addColorStop(0, "#060f1a");
    grad.addColorStop(1, "#071828");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // Grid lines
    ctx.strokeStyle = "#0e2338";
    ctx.lineWidth = 1;
    for (let x = 0; x < MAP_W; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MAP_H); ctx.stroke(); }
    for (let y = 0; y < MAP_H; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MAP_W, y); ctx.stroke(); }

    // Coastline suggestion
    ctx.strokeStyle = "#0e3a5c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 80); ctx.bezierCurveTo(150, 100, 200, 180, 320, 200);
    ctx.bezierCurveTo(420, 215, 480, 380, 600, 400);
    ctx.bezierCurveTo(680, 415, 740, 450, MAP_W, 440);
    ctx.stroke();

    // Tampa Bay shape
    ctx.fillStyle = "#071e30";
    ctx.beginPath();
    ctx.moveTo(300, 180); ctx.bezierCurveTo(400, 200, 500, 300, 520, 420);
    ctx.bezierCurveTo(480, 450, 400, 460, 350, 430);
    ctx.bezierCurveTo(280, 390, 260, 300, 300, 180);
    ctx.fill();

    // Heat map blobs
    properties.forEach(p => {
      const { x, y } = latLngToXY(p.lat, p.lng);
      const radius = 80 + p.slips * 0.2;
      const intensity = p.score / 100;
      const heatGrad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const color = intensity > 0.85 ? "0,245,160" : intensity > 0.75 ? "74,222,128" : intensity > 0.65 ? "250,204,21" : "248,113,113";
      heatGrad.addColorStop(0, `rgba(${color},${0.28 * intensity})`);
      heatGrad.addColorStop(0.5, `rgba(${color},${0.12 * intensity})`);
      heatGrad.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = heatGrad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Property markers
    properties.forEach(p => {
      const { x, y } = latLngToXY(p.lat, p.lng);
      const isSelected = selected?.id === p.id;
      const isHovered = hoverId === p.id;
      const color = TIER_COLOR[p.tier];
      const r = isSelected ? 12 : isHovered ? 10 : 8;

      // Pulse ring for selected
      if (isSelected) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.2;
        ctx.beginPath(); ctx.arc(x, y, 32, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Marker
      ctx.fillStyle = isSelected || isHovered ? color : `${color}cc`;
      ctx.shadowColor = color;
      ctx.shadowBlur = isSelected ? 16 : 8;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // Label
      if (isSelected || isHovered) {
        ctx.fillStyle = "#e8f4fd";
        ctx.font = "bold 11px 'IBM Plex Mono', monospace";
        ctx.textAlign = "center";
        const nameShort = p.name.split(" ").slice(0, 2).join(" ");
        ctx.fillText(nameShort, x, y - r - 6);
      }
    });
  }, [properties, selected, hoverId]);

  function handleCanvasClick(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (MAP_W / rect.width);
    const my = (e.clientY - rect.top) * (MAP_H / rect.height);
    let closest = null, minDist = 30;
    properties.forEach(p => {
      const { x, y } = latLngToXY(p.lat, p.lng);
      const d = Math.hypot(mx - x, my - y);
      if (d < minDist) { minDist = d; closest = p; }
    });
    onSelect(closest);
  }

  function handleMouseMove(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (MAP_W / rect.width);
    const my = (e.clientY - rect.top) * (MAP_H / rect.height);
    let found = null;
    properties.forEach(p => {
      const { x, y } = latLngToXY(p.lat, p.lng);
      if (Math.hypot(mx - x, my - y) < 20) found = p.id;
    });
    setHoverId(found);
  }

  return (
    <canvas
      ref={canvasRef} width={MAP_W} height={MAP_H}
      onClick={handleCanvasClick} onMouseMove={handleMouseMove}
      style={{ width: "100%", height: "100%", cursor: hoverId ? "pointer" : "default", borderRadius: 8 }}
    />
  );
}

function PropertyList({ properties, selected, onSelect, filterTier }) {
  const filtered = filterTier === "ALL" ? properties : properties.filter(p => p.tier === filterTier);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", flex: 1 }}>
      {filtered.map(p => (
        <div key={p.id} onClick={() => onSelect(p.id === selected?.id ? null : p)}
          style={{
            padding: "10px 12px", borderRadius: 6, cursor: "pointer",
            background: selected?.id === p.id ? "#0e2a42" : "#0a1a2a",
            border: `1px solid ${selected?.id === p.id ? TIER_COLOR[p.tier] + "80" : "#1a3050"}`,
            transition: "all 0.15s"
          }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#c8e6f7", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
              <div style={{ fontSize: 10, color: "#3a6080", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.address}</div>
              <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                <Pill label={p.type} color="#4a7fa5" />
                <Pill label={p.status} color={STATUS_COLOR[p.status]} />
              </div>
            </div>
            <div style={{ marginLeft: 8, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <ScoreBadge score={p.score} tier={p.tier} />
              <div style={{ fontSize: 10, color: "#4a7fa5", fontFamily: "monospace" }}>{p.capRate.toFixed(2)}% cap</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PropertyDetail({ property: p, onClose }) {
  const [tab, setTab] = useState("overview");
  if (!p) return null;
  const color = TIER_COLOR[p.tier];

  const radarData = [
    { subject: "Occupancy", value: p.occupancy },
    { subject: "NOI Yield", value: Math.min(100, p.capRate * 12) },
    { subject: "Mkt Growth", value: p.market.rentGrowth[4] * 10 },
    { subject: "Demographics", value: Math.min(100, p.demographics.medIncome / 1000) },
    { subject: "Boat Ownership", value: p.demographics.boatOwnership * 4 },
    { subject: "Score", value: p.score },
  ];

  const years = ["2020", "2021", "2022", "2023", "2024"];
  const rentData = years.map((y, i) => ({ year: y, growth: p.market.rentGrowth[i] }));
  const vacData = years.map((y, i) => ({ year: y, vacancy: p.market.vacancyTrend[i] }));

  return (
    <div style={{
      background: "#070f1a", border: `1px solid ${color}40`, borderRadius: 10,
      display: "flex", flexDirection: "column", height: "100%", overflow: "hidden"
    }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #0e2338", background: "#08141f" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <ScoreBadge score={p.score} tier={p.tier} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#e8f4fd" }}>{p.name}</div>
                <div style={{ fontSize: 10, color: "#3a6080" }}>{p.address}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
              <Pill label={p.type} color="#4a7fa5" />
              <Pill label={p.status} color={STATUS_COLOR[p.status]} />
              {p.permits.map(pm => <Pill key={pm} label={pm} color={pm.includes("Expired") ? "#f87171" : pm.includes("Review") ? "#facc15" : "#4ade80"} />)}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#3a6080", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>
        {/* Tab bar */}
        <div style={{ display: "flex", gap: 0, marginTop: 12, borderBottom: "1px solid #0e2338" }}>
          {["overview", "financials", "demographics", "market"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: "none", border: "none", borderBottom: `2px solid ${tab === t ? color : "transparent"}`,
              color: tab === t ? color : "#3a6080", padding: "6px 12px", cursor: "pointer",
              fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, transition: "all 0.15s"
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <StatBlock label="Asking Price" value={`$${(p.askingPrice / 1e6).toFixed(1)}M`} sub="Listed" />
              <StatBlock label="NOI" value={`$${(p.noi / 1000).toFixed(0)}K`} sub="Annual" accent={color} />
              <StatBlock label="Cap Rate" value={`${p.capRate.toFixed(2)}%`} sub="Going-in" accent={color} />
              <StatBlock label="Slips" value={p.slips} sub="Total" />
              <StatBlock label="Occupancy" value={`${p.occupancy}%`} sub="Current" accent={p.occupancy > 90 ? "#00f5a0" : p.occupancy > 75 ? "#facc15" : "#f87171"} />
              <StatBlock label="Year Built" value={p.yearBuilt} sub={`${2025 - p.yearBuilt}yr old`} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <StatBlock label="Acreage" value={`${p.acreage} ac`} />
              <StatBlock label="Water Frontage" value={`${p.waterFrontage} ft`} />
            </div>
            <div style={{ background: "#0a1a2a", borderRadius: 6, padding: 12, border: "1px solid #1e3a5f" }}>
              <div style={{ fontSize: 10, color: "#4a7fa5", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Amenities</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {p.amenities.map(a => <Pill key={a} label={a} color="#4a7fa5" />)}
              </div>
            </div>
            <div style={{ background: "#0a1a2a", borderRadius: 6, padding: 12, border: "1px solid #1e3a5f" }}>
              <div style={{ fontSize: 10, color: "#4a7fa5", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Performance Radar</div>
              <ResponsiveContainer width="100%" height={160}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#1e3a5f" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#4a7fa5", fontSize: 9 }} />
                  <Radar name={p.name} dataKey="value" stroke={color} fill={color} fillOpacity={0.15} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {tab === "financials" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <StatBlock label="Fuel Revenue" value={`$${(p.fuelRevenue / 1000).toFixed(0)}K`} />
              <StatBlock label="Storage Rev" value={`$${(p.storageRevenue / 1000).toFixed(0)}K`} />
              <StatBlock label="Service Rev" value={`$${(p.serviceRevenue / 1000).toFixed(0)}K`} />
            </div>
            <div style={{ background: "#0a1a2a", borderRadius: 6, padding: 12, border: "1px solid #1e3a5f" }}>
              <div style={{ fontSize: 10, color: "#4a7fa5", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Revenue Breakdown</div>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={[
                  { name: "Fuel", value: p.fuelRevenue },
                  { name: "Storage", value: p.storageRevenue },
                  { name: "Service", value: p.serviceRevenue },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0e2338" />
                  <XAxis dataKey="name" tick={{ fill: "#4a7fa5", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#4a7fa5", fontSize: 9 }} tickFormatter={v => `$${v/1000}K`} />
                  <Tooltip formatter={v => [`$${v.toLocaleString()}`, ""]} contentStyle={{ background: "#07111c", border: "1px solid #1e3a5f", borderRadius: 4 }} />
                  <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <StatBlock label="Comp Sales" value={`$${(p.market.compSales / 1e6).toFixed(1)}M`} sub="Recent Comps" />
              <StatBlock label="Price/Slip" value={`$${Math.round(p.askingPrice / p.slips).toLocaleString()}`} sub="Per Slip" accent={color} />
            </div>
            <div style={{ background: "#0a1a2a", borderRadius: 6, padding: 10, border: "1px solid #1e3a5f" }}>
              <div style={{ fontSize: 10, color: "#4a7fa5", marginBottom: 4 }}>Dock Master</div>
              <div style={{ fontSize: 12, color: "#c8e6f7", fontWeight: 600 }}>{p.dockMaster}</div>
            </div>
          </div>
        )}

        {tab === "demographics" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <StatBlock label="Median Income" value={`$${(p.demographics.medIncome / 1000).toFixed(1)}K`} sub="Household" accent={color} />
              <StatBlock label="Pop Growth" value={`+${p.demographics.popGrowth}%`} sub="Annual" />
              <StatBlock label="Avg Age" value={p.demographics.avgAge} sub="Resident" />
              <StatBlock label="Boat Ownership" value={`${p.demographics.boatOwnership}%`} sub="of Households" accent={color} />
            </div>
            <div style={{ background: "#0a1a2a", borderRadius: 6, padding: 12, border: "1px solid #1e3a5f" }}>
              <div style={{ fontSize: 10, color: "#4a7fa5", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Addressable Market Strength</div>
              {[
                { label: "Income vs State Avg", pct: Math.min(100, (p.demographics.medIncome / 65000) * 75) },
                { label: "Boating Affinity", pct: Math.min(100, p.demographics.boatOwnership * 4) },
                { label: "Population Growth", pct: Math.min(100, p.demographics.popGrowth * 20) },
              ].map(item => (
                <div key={item.label} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: "#4a7fa5" }}>{item.label}</span>
                    <span style={{ fontSize: 10, color: color, fontFamily: "monospace" }}>{item.pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 4, background: "#0e2338", borderRadius: 2 }}>
                    <div style={{ width: `${item.pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.5s" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "market" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "#0a1a2a", borderRadius: 6, padding: 12, border: "1px solid #1e3a5f" }}>
              <div style={{ fontSize: 10, color: "#4a7fa5", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Rent Growth YoY %</div>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart data={rentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0e2338" />
                  <XAxis dataKey="year" tick={{ fill: "#4a7fa5", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#4a7fa5", fontSize: 9 }} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={v => [`${v}%`, "Growth"]} contentStyle={{ background: "#07111c", border: "1px solid #1e3a5f", borderRadius: 4 }} />
                  <Line type="monotone" dataKey="growth" stroke={color} strokeWidth={2} dot={{ fill: color, r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: "#0a1a2a", borderRadius: 6, padding: 12, border: "1px solid #1e3a5f" }}>
              <div style={{ fontSize: 10, color: "#4a7fa5", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Vacancy Trend %</div>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart data={vacData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0e2338" />
                  <XAxis dataKey="year" tick={{ fill: "#4a7fa5", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#4a7fa5", fontSize: 9 }} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={v => [`${v}%`, "Vacancy"]} contentStyle={{ background: "#07111c", border: "1px solid #1e3a5f", borderRadius: 4 }} />
                  <Line type="monotone" dataKey="vacancy" stroke="#f87171" strokeWidth={2} dot={{ fill: "#f87171", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <StatBlock label="5yr Rent Growth" value={`+${p.market.rentGrowth[4]}%`} accent={color} />
              <StatBlock label="Current Vacancy" value={`${p.market.vacancyTrend[4]}%`} accent={p.market.vacancyTrend[4] < 10 ? "#00f5a0" : "#facc15"} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function MarinaIntelligenceMap() {
  const [selected, setSelected] = useState(null);
  const [filterTier, setFilterTier] = useState("ALL");
  const [addAddress, setAddAddress] = useState("");
  const [mapView, setMapView] = useState("heat"); // heat | satellite

  const tiers = ["ALL", "A+", "A", "B", "C"];
  const filtered = filterTier === "ALL" ? PROPERTIES : PROPERTIES.filter(p => p.tier === filterTier);

  return (
    <div style={{
      fontFamily: "'IBM Plex Sans', 'Helvetica Neue', sans-serif",
      background: "#040d16", color: "#c8e6f7", height: "100vh", display: "flex", flexDirection: "column",
      overflow: "hidden"
    }}>
      {/* Top bar */}
      <div style={{
        padding: "0 20px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid #0e2338", background: "#050e1b", flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#4a9fd5", textTransform: "uppercase" }}>
            ⚓ MarinaMatch
          </div>
          <div style={{ width: 1, height: 20, background: "#0e2338" }} />
          <div style={{ fontSize: 12, color: "#4a7fa5", letterSpacing: 1 }}>Property Intelligence</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            value={addAddress}
            onChange={e => setAddAddress(e.target.value)}
            placeholder="Enter property address…"
            style={{
              background: "#0a1a2a", border: "1px solid #1a3050", borderRadius: 5, padding: "5px 10px",
              color: "#c8e6f7", fontSize: 11, width: 220, outline: "none"
            }}
          />
          <button style={{
            background: "#0e4f8a", border: "1px solid #1a6dbf", borderRadius: 5, padding: "5px 12px",
            color: "#c8e6f7", fontSize: 11, fontWeight: 600, cursor: "pointer", letterSpacing: 0.5
          }}>+ Add Property</button>
          <div style={{ display: "flex", gap: 1, background: "#0a1a2a", border: "1px solid #1a3050", borderRadius: 5, overflow: "hidden" }}>
            {["heat", "markers"].map(v => (
              <button key={v} onClick={() => setMapView(v)} style={{
                background: mapView === v ? "#0e2a42" : "none", border: "none", padding: "5px 10px",
                color: mapView === v ? "#4a9fd5" : "#3a6080", cursor: "pointer", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5
              }}>{v}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left sidebar — property list */}
        <div style={{ width: 280, borderRight: "1px solid #0e2338", display: "flex", flexDirection: "column", background: "#050e1b", flexShrink: 0 }}>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #0e2338" }}>
            <div style={{ fontSize: 9, color: "#4a7fa5", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Filter by Tier</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {tiers.map(t => (
                <button key={t} onClick={() => setFilterTier(t)} style={{
                  background: filterTier === t ? (TIER_COLOR[t] ? `${TIER_COLOR[t]}20` : "#0e2a42") : "none",
                  border: `1px solid ${filterTier === t ? (TIER_COLOR[t] || "#4a9fd5") : "#1a3050"}`,
                  borderRadius: 4, padding: "3px 8px", fontSize: 10, fontWeight: 600,
                  color: filterTier === t ? (TIER_COLOR[t] || "#4a9fd5") : "#3a6080",
                  cursor: "pointer"
                }}>{t}</button>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: "#2a5070" }}>
              {filtered.length} propert{filtered.length !== 1 ? "ies" : "y"} · {
                filtered.reduce((s, p) => s + p.slips, 0).toLocaleString()} total slips
            </div>
          </div>
          <div style={{ flex: 1, padding: "8px 10px", overflowY: "auto" }}>
            <PropertyList properties={filtered} selected={selected} onSelect={setSelected} filterTier={filterTier} />
          </div>
        </div>

        {/* Center — map */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <HeatMapCanvas properties={filtered} selected={selected} onSelect={setSelected} />

          {/* Map legend */}
          <div style={{
            position: "absolute", bottom: 14, left: 14, background: "#05101edd",
            border: "1px solid #0e2338", borderRadius: 6, padding: "8px 12px", backdropFilter: "blur(8px)"
          }}>
            <div style={{ fontSize: 9, color: "#4a7fa5", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Investment Grade</div>
            {[["A+", "Top Tier · 90–100"], ["A", "Strong · 80–89"], ["B", "Value-Add · 65–79"], ["C", "Distressed · 0–64"]].map(([t, l]) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: TIER_COLOR[t] }} />
                <span style={{ fontSize: 10, color: "#4a7fa5" }}><b style={{ color: TIER_COLOR[t] }}>{t}</b> — {l}</span>
              </div>
            ))}
          </div>

          {/* Market summary */}
          <div style={{
            position: "absolute", top: 14, right: 14, background: "#05101edd",
            border: "1px solid #0e2338", borderRadius: 6, padding: "10px 14px", backdropFilter: "blur(8px)", minWidth: 160
          }}>
            <div style={{ fontSize: 9, color: "#4a7fa5", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Market Overview</div>
            {[
              { label: "Avg Cap Rate", value: `${(PROPERTIES.reduce((s, p) => s + p.capRate, 0) / PROPERTIES.length).toFixed(2)}%` },
              { label: "Avg Occupancy", value: `${Math.round(PROPERTIES.reduce((s, p) => s + p.occupancy, 0) / PROPERTIES.length)}%` },
              { label: "Total Portfolio", value: `$${(PROPERTIES.reduce((s, p) => s + p.askingPrice, 0) / 1e6).toFixed(1)}M` },
              { label: "Total Slips", value: PROPERTIES.reduce((s, p) => s + p.slips, 0).toLocaleString() },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: "#3a6080" }}>{row.label}</span>
                <span style={{ fontSize: 10, color: "#c8e6f7", fontFamily: "monospace", fontWeight: 700 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — property detail */}
        <div style={{
          width: selected ? 360 : 0, flexShrink: 0, overflow: "hidden",
          transition: "width 0.25s", borderLeft: "1px solid #0e2338", background: "#070f1a"
        }}>
          {selected && (
            <div style={{ width: 360, height: "100%", padding: 10 }}>
              <PropertyDetail property={selected} onClose={() => setSelected(null)} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom status bar */}
      <div style={{
        height: 28, borderTop: "1px solid #0e2338", background: "#040b13",
        display: "flex", alignItems: "center", padding: "0 16px", gap: 20, flexShrink: 0
      }}>
        <span style={{ fontSize: 9, color: "#2a5070", letterSpacing: 0.5 }}>Tampa Bay MSA · FL</span>
        <span style={{ fontSize: 9, color: "#2a5070" }}>·</span>
        <span style={{ fontSize: 9, color: "#2a5070" }}>6 Properties Indexed</span>
        <span style={{ fontSize: 9, color: "#2a5070" }}>·</span>
        <span style={{ fontSize: 9, color: "#2a5070" }}>Heat Map: Concentration by Score × Slip Count</span>
        <span style={{ fontSize: 9, color: "#2a5070", marginLeft: "auto" }}>MarinaMatch Intelligence v1.0</span>
      </div>
    </div>
  );
}
