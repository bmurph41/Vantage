import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Users,
  Building,
  DollarSign,
  Home,
  RefreshCcw,
  GitBranch,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";

// ── Types ──────────────────────────────────────────────────────────────

interface RelationshipNode {
  id: string;
  name: string;
  type: "contact" | "company" | "deal" | "property";
  relationship?: string;
  strength?: number;
}

interface RelationshipData {
  centerNode: RelationshipNode;
  connections: RelationshipNode[];
}

interface RelationshipMapProps {
  entityId: string;
  entityType: "contact" | "company";
}

// ── Styling ────────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, { fill: string; stroke: string; text: string; bg: string }> = {
  contact: { fill: "#dbeafe", stroke: "#3b82f6", text: "#1e40af", bg: "bg-blue-100" },
  company: { fill: "#fef3c7", stroke: "#f59e0b", text: "#92400e", bg: "bg-amber-100" },
  deal: { fill: "#d1fae5", stroke: "#10b981", text: "#065f46", bg: "bg-emerald-100" },
  property: { fill: "#e0e7ff", stroke: "#6366f1", text: "#3730a3", bg: "bg-indigo-100" },
};

const NODE_ICONS: Record<string, typeof Users> = {
  contact: Users,
  company: Building,
  deal: DollarSign,
  property: Home,
};

const RELATIONSHIP_COLORS: Record<string, string> = {
  employee: "#3b82f6",
  advisor: "#8b5cf6",
  investor: "#10b981",
  broker: "#f59e0b",
  buyer: "#ef4444",
  seller: "#06b6d4",
  partner: "#ec4899",
  default: "#9ca3af",
};

// ── Layout Helpers ─────────────────────────────────────────────────────

function computeRadialLayout(
  centerNode: RelationshipNode,
  connections: RelationshipNode[],
  width: number,
  height: number
) {
  const cx = width / 2;
  const cy = height / 2;
  const radiusX = Math.min(width, height) * 0.35;
  const radiusY = Math.min(width, height) * 0.32;

  const centerPos = { x: cx, y: cy, node: centerNode };

  const connPositions = connections.map((conn, i) => {
    const angle = (2 * Math.PI * i) / connections.length - Math.PI / 2;
    return {
      x: cx + radiusX * Math.cos(angle),
      y: cy + radiusY * Math.sin(angle),
      node: conn,
    };
  });

  return { center: centerPos, connections: connPositions };
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "\u2026";
}

// ── Component ──────────────────────────────────────────────────────────

export function RelationshipMap({ entityId, entityType }: RelationshipMapProps) {
  const [, navigate] = useLocation();
  const [zoom, setZoom] = useState(1);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const endpoint = `/api/crm/${entityType === "company" ? "companies" : "contacts"}/${entityId}/relationships`;

  const { data, isLoading, isError, refetch } = useQuery<RelationshipData>({
    queryKey: [endpoint],
    enabled: !!entityId,
  });

  const WIDTH = 700;
  const HEIGHT = 500;

  const layout = useMemo(() => {
    if (!data) return null;
    return computeRadialLayout(data.centerNode, data.connections, WIDTH, HEIGHT);
  }, [data]);

  const handleNodeClick = useCallback(
    (node: RelationshipNode) => {
      const pathMap: Record<string, string> = {
        contact: `/crm/contacts`,
        company: `/crm/companies`,
        deal: `/crm/deals`,
        property: `/crm/properties`,
      };
      const basePath = pathMap[node.type];
      if (basePath) {
        navigate(basePath);
      }
    },
    [navigate]
  );

  const zoomIn = () => setZoom((z) => Math.min(z + 0.15, 2));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.15, 0.5));
  const resetZoom = () => setZoom(1);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <GitBranch className="w-4 h-4" /> Relationship Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full h-[400px] rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-gray-500 mb-3">Failed to load relationship map</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCcw className="w-3.5 h-3.5 mr-1.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data || !layout) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-blue-600" /> Relationship Map
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <GitBranch className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500">No relationships found</p>
          <p className="text-xs text-gray-400 mt-1">
            Link contacts, companies, deals, and properties to see the relationship map
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-blue-600" /> Relationship Map
            <Badge variant="secondary" className="text-xs">
              {data.connections.length} connection{data.connections.length !== 1 ? "s" : ""}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut}>
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetZoom}>
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn}>
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-3">
          {["contact", "company", "deal", "property"].map((type) => {
            const colors = NODE_COLORS[type];
            const Icon = NODE_ICONS[type];
            return (
              <div key={type} className="flex items-center gap-1.5 text-xs text-gray-600">
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: colors.fill, border: `1.5px solid ${colors.stroke}` }}
                >
                  <Icon className="w-2.5 h-2.5" style={{ color: colors.text }} />
                </div>
                <span className="capitalize">{type}</span>
              </div>
            );
          })}
        </div>

        {/* SVG Map */}
        <div className="border rounded-lg bg-gray-50/50 overflow-hidden" style={{ height: HEIGHT * 0.85 }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full h-full"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
          >
            {/* Connection lines */}
            {layout.connections.map((conn, i) => {
              const relColor =
                RELATIONSHIP_COLORS[conn.node.relationship || ""] ||
                RELATIONSHIP_COLORS.default;
              const isHovered =
                hoveredNode === conn.node.id ||
                hoveredNode === layout.center.node.id;
              return (
                <g key={`line-${i}`}>
                  <line
                    x1={layout.center.x}
                    y1={layout.center.y}
                    x2={conn.x}
                    y2={conn.y}
                    stroke={relColor}
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    strokeDasharray={conn.node.strength && conn.node.strength < 3 ? "4,4" : "none"}
                    opacity={hoveredNode && !isHovered ? 0.2 : 0.6}
                    className="transition-all duration-200"
                  />
                  {/* Relationship label on line */}
                  {conn.node.relationship && (
                    <text
                      x={(layout.center.x + conn.x) / 2}
                      y={(layout.center.y + conn.y) / 2 - 6}
                      textAnchor="middle"
                      className="text-[9px] fill-gray-500 select-none pointer-events-none"
                      opacity={hoveredNode && !isHovered ? 0.1 : 0.7}
                    >
                      {conn.node.relationship}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Connection nodes */}
            {layout.connections.map((conn, i) => {
              const colors = NODE_COLORS[conn.node.type] || NODE_COLORS.contact;
              const isHovered = hoveredNode === conn.node.id;
              const dimmed = hoveredNode && !isHovered && hoveredNode !== layout.center.node.id;
              return (
                <g
                  key={`node-${i}`}
                  className="cursor-pointer"
                  onClick={() => handleNodeClick(conn.node)}
                  onMouseEnter={() => setHoveredNode(conn.node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  opacity={dimmed ? 0.3 : 1}
                >
                  {/* Node circle */}
                  <circle
                    cx={conn.x}
                    cy={conn.y}
                    r={isHovered ? 28 : 24}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    className="transition-all duration-200"
                  />
                  {/* Node icon placeholder (SVG text) */}
                  <text
                    x={conn.x}
                    y={conn.y - 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="text-[10px] font-bold select-none pointer-events-none"
                    fill={colors.text}
                  >
                    {conn.node.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </text>
                  {/* Node label */}
                  <text
                    x={conn.x}
                    y={conn.y + 36}
                    textAnchor="middle"
                    className="text-[11px] font-medium fill-gray-700 select-none pointer-events-none"
                  >
                    {truncateText(conn.node.name, 18)}
                  </text>
                  {/* Type badge */}
                  <text
                    x={conn.x}
                    y={conn.y + 48}
                    textAnchor="middle"
                    className="text-[9px] fill-gray-400 capitalize select-none pointer-events-none"
                  >
                    {conn.node.type}
                  </text>
                </g>
              );
            })}

            {/* Center node (larger) */}
            <g
              onMouseEnter={() => setHoveredNode(layout.center.node.id)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              {/* Glow */}
              <circle
                cx={layout.center.x}
                cy={layout.center.y}
                r={42}
                fill="none"
                stroke={NODE_COLORS[layout.center.node.type]?.stroke || "#3b82f6"}
                strokeWidth={1}
                opacity={0.3}
                strokeDasharray="3,3"
              />
              {/* Node circle */}
              <circle
                cx={layout.center.x}
                cy={layout.center.y}
                r={36}
                fill={NODE_COLORS[layout.center.node.type]?.fill || "#dbeafe"}
                stroke={NODE_COLORS[layout.center.node.type]?.stroke || "#3b82f6"}
                strokeWidth={2.5}
              />
              {/* Initials */}
              <text
                x={layout.center.x}
                y={layout.center.y - 2}
                textAnchor="middle"
                dominantBaseline="central"
                className="text-sm font-bold select-none pointer-events-none"
                fill={NODE_COLORS[layout.center.node.type]?.text || "#1e40af"}
              >
                {layout.center.node.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </text>
              {/* Name below */}
              <text
                x={layout.center.x}
                y={layout.center.y + 50}
                textAnchor="middle"
                className="text-xs font-semibold fill-gray-800 select-none pointer-events-none"
              >
                {truncateText(layout.center.node.name, 24)}
              </text>
              <text
                x={layout.center.x}
                y={layout.center.y + 63}
                textAnchor="middle"
                className="text-[10px] fill-gray-400 capitalize select-none pointer-events-none"
              >
                {layout.center.node.type}
              </text>
            </g>
          </svg>
        </div>

        {/* Connection list */}
        {data.connections.length > 0 && (
          <div className="mt-3 space-y-1">
            <div className="text-xs font-medium text-gray-500 mb-2">Connections</div>
            <div className="grid grid-cols-2 gap-1.5">
              {data.connections.map((conn) => {
                const colors = NODE_COLORS[conn.type] || NODE_COLORS.contact;
                const Icon = NODE_ICONS[conn.type] || Users;
                return (
                  <button
                    key={conn.id}
                    className="flex items-center gap-2 p-2 rounded-lg border hover:bg-gray-50 transition-colors text-left"
                    onClick={() => handleNodeClick(conn)}
                    onMouseEnter={() => setHoveredNode(conn.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: colors.fill, border: `1.5px solid ${colors.stroke}` }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: colors.text }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{conn.name}</div>
                      <div className="text-[10px] text-gray-400 capitalize">
                        {conn.relationship || conn.type}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
