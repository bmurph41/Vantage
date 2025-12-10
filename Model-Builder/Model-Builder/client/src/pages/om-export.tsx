import React, { useMemo } from "react";
import { Link } from "wouter";
import { OmPage, OmBlock, OmPageLayoutConfig } from "@/lib/types";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOmContext } from "@/lib/om-context";

interface OmBrandingSettings {
  logoUrl?: string;
  primaryColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  headerHeight?: number;
  footerHeight?: number;
}

const mockPages: { id: string; title: string; orderIndex: number; layout: OmPageLayoutConfig; blocks: OmBlock[] }[] = [
  {
    id: "demo_1",
    title: "Cover Page",
    orderIndex: 0,
    layout: { layoutType: "cover", showHeader: false, showFooter: true, showPageNumber: true },
    blocks: [
      { id: "b1", type: "text", content: { markdown: "# Sunset Marina\n## Exclusive Investment Opportunity" } },
      { id: "b2", type: "text", content: { markdown: "San Diego, CA" } },
    ],
  },
  {
    id: "demo_2",
    title: "Executive Summary",
    orderIndex: 1,
    layout: { layoutType: "single-column", showHeader: true, showFooter: true, showPageNumber: true },
    blocks: [
      { id: "b3", type: "text", content: { markdown: "### Investment Highlights\n\nSunset Marina is a premier 450-slip facility located in the heart of San Diego's waterfront district. This offering represents a unique opportunity to acquire a stabilized asset with significant value-add potential." } },
      { id: "b4", type: "kpi", content: { items: [
        { label: "Purchase Price", value: "$12,500,000", subtext: "$27k per slip" },
        { label: "Cap Rate", value: "6.5%", subtext: "Pro Forma: 7.8%" },
        { label: "Occupancy", value: "94%", subtext: "Waitlist: 45 boats" },
      ] } },
    ],
  },
  {
    id: "demo_3",
    title: "Financial Projections",
    orderIndex: 2,
    layout: { layoutType: "single-column", showHeader: true, showFooter: true, showPageNumber: true },
    blocks: [
      { id: "b5", type: "chart", content: { title: "NOI Projection (5-Year)", chartType: "bar", data: [
        { name: "Yr 1", value: 812500 },
        { name: "Yr 2", value: 850000 },
        { name: "Yr 3", value: 910000 },
        { name: "Yr 4", value: 980000 },
        { name: "Yr 5", value: 1050000 },
      ] } },
    ],
  },
];

export default function OmExportPage() {
  const { project } = useOmContext();

  const sortedPages = useMemo(() => {
    if (!project || project.pages.length === 0) return mockPages;
    return [...project.pages];
  }, [project]);

  const omName = project?.name || "Demo Offering Memorandum";

  const branding: OmBrandingSettings = useMemo(() => {
    const settings = project?.settings;
    return settings?.branding || {
      primaryColor: "#0f766e",
      backgroundColor: "#ffffff",
      headerHeight: 64,
      footerHeight: 40,
    };
  }, [project]);

  return (
    <div
      className="min-h-screen bg-slate-100 text-slate-900 print:bg-white"
      style={{
        fontFamily: branding.fontFamily || "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
      data-testid="export-page-container"
    >
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-300 bg-white shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/builder" className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            Back to Builder
          </Link>
          <span className="text-sm text-slate-400">|</span>
          <span className="text-sm font-medium text-slate-700" data-testid="text-om-name">
            Preview & Export: {omName}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="gap-2"
            data-testid="button-print"
          >
            <Printer className="w-4 h-4" />
            Print / Save as PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-col items-center py-6 space-y-6 print:py-0 print:space-y-0">
        {sortedPages.length === 0 ? (
          <div className="text-center py-12 text-slate-500" data-testid="empty-pages">
            No pages to export. Add pages in the builder first.
          </div>
        ) : (
          sortedPages.map((page, index) => (
            <ExportPageView
              key={page.id}
              page={page}
              branding={branding}
              pageNumber={index + 1}
              totalPages={sortedPages.length}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ExportPageViewProps {
  page: any;
  branding: OmBrandingSettings;
  pageNumber: number;
  totalPages: number;
}

function ExportPageView({ page, branding, pageNumber, totalPages }: ExportPageViewProps) {
  const pageBlocks = page.blocks || [];

  const layout: OmPageLayoutConfig = page.layout || {
    layoutType: "single-column",
    showHeader: true,
    showFooter: true,
    showPageNumber: true,
  };

  const sortedBlocks = useMemo(() => {
    return [...pageBlocks].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  }, [pageBlocks]);

  const { leftColumnBlocks, rightColumnBlocks, fullWidthBlocks } = useMemo(() => {
    const left: any[] = [];
    const right: any[] = [];
    const full: any[] = [];

    sortedBlocks.forEach((block) => {
      const column = (block.style as any)?.column || "auto";
      if (layout.layoutType === "two-column") {
        if (column === "right") {
          right.push(block);
        } else if (column === "full") {
          full.push(block);
        } else {
          left.push(block);
        }
      } else {
        full.push(block);
      }
    });

    return { leftColumnBlocks: left, rightColumnBlocks: right, fullWidthBlocks: full };
  }, [sortedBlocks, layout.layoutType]);

  const headerHeight = branding.headerHeight ?? 64;
  const footerHeight = branding.footerHeight ?? 40;

  return (
    <div
      className="mm-print-page bg-white shadow print:shadow-none border border-slate-200 w-[8.5in] min-h-[11in] flex flex-col overflow-hidden print:w-auto print:border-0 print:m-0 print:rounded-none"
      data-testid={`export-page-${page.id}`}
    >
      {layout.showHeader !== false && (
        <div
          className="flex items-center justify-between px-6 border-b border-slate-100"
          style={{ height: headerHeight }}
        >
          {branding.logoUrl ? (
            <div className="flex items-center gap-2">
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="h-8 max-w-[160px] object-contain"
              />
              <span className="text-xs text-slate-400">{page.title}</span>
            </div>
          ) : (
            <div className="text-xs font-semibold text-slate-500">{page.title}</div>
          )}
          <div
            className="h-6 w-24 rounded-full"
            style={{ backgroundColor: branding.primaryColor || "#0f766e" }}
          />
        </div>
      )}

      <div
        className="flex-1 px-6 pb-4 pt-4"
        style={{ backgroundColor: branding.backgroundColor || "#ffffff" }}
      >
        <h2 className="text-lg font-semibold text-slate-800 mb-4">{page.title}</h2>

        {layout.layoutType === "cover" ? (
          <CoverLayout blocks={sortedBlocks} branding={branding} />
        ) : layout.layoutType === "hero-with-body" ? (
          <HeroWithBodyLayout blocks={sortedBlocks} branding={branding} />
        ) : layout.layoutType === "two-column" ? (
          <TwoColumnLayout
            leftBlocks={leftColumnBlocks}
            rightBlocks={rightColumnBlocks}
            fullWidthBlocks={fullWidthBlocks}
            branding={branding}
          />
        ) : (
          <SingleColumnLayout blocks={fullWidthBlocks} branding={branding} />
        )}
      </div>

      {layout.showFooter !== false && (
        <div
          className="flex items-center justify-between px-6 text-[10px] text-slate-400 border-t border-slate-200"
          style={{ height: footerHeight }}
        >
          <span>MarinaMatch - Confidential Offering Memorandum</span>
          {layout.showPageNumber !== false && (
            <span>Page {pageNumber} of {totalPages}</span>
          )}
        </div>
      )}
    </div>
  );
}

interface LayoutProps {
  branding: OmBrandingSettings;
}

function SingleColumnLayout({ blocks, branding }: { blocks: any[] } & LayoutProps) {
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block) => (
        <ExportBlockRenderer key={block.id} block={block} branding={branding} />
      ))}
    </div>
  );
}

function TwoColumnLayout({
  leftBlocks,
  rightBlocks,
  fullWidthBlocks,
  branding,
}: {
  leftBlocks: any[];
  rightBlocks: any[];
  fullWidthBlocks: any[];
} & LayoutProps) {
  return (
    <div className="flex flex-col gap-4">
      {fullWidthBlocks.map((block) => (
        <ExportBlockRenderer key={block.id} block={block} branding={branding} />
      ))}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-4">
          {leftBlocks.map((block) => (
            <ExportBlockRenderer key={block.id} block={block} branding={branding} />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          {rightBlocks.map((block) => (
            <ExportBlockRenderer key={block.id} block={block} branding={branding} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CoverLayout({ blocks, branding }: { blocks: any[] } & LayoutProps) {
  const textBlocks = blocks.filter((b) => b.type === "text");
  const otherBlocks = blocks.filter((b) => b.type !== "text");
  const titleBlock = textBlocks[0];
  const subtitleBlock = textBlocks[1];
  const remainingBlocks = [...textBlocks.slice(2), ...otherBlocks];

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-1 rounded-lg mb-4 flex flex-col justify-center items-center px-8 py-12 min-h-[400px]"
        style={{
          backgroundColor: branding.primaryColor || "#0f766e",
          color: "white",
        }}
      >
        <h1 className="text-3xl font-bold mb-2 text-center">
          {titleBlock?.content?.markdown || "Offering Memorandum"}
        </h1>
        {subtitleBlock && (
          <p className="text-sm max-w-md opacity-90 text-center">
            {subtitleBlock.content?.markdown}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {remainingBlocks.map((block) => (
          <ExportBlockRenderer key={block.id} block={block} branding={branding} />
        ))}
      </div>
    </div>
  );
}

function HeroWithBodyLayout({ blocks, branding }: { blocks: any[] } & LayoutProps) {
  const heroBlocks = blocks.slice(0, 1);
  const bodyBlocks = blocks.slice(1);

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-lg px-6 py-6 flex flex-col justify-center"
        style={{
          backgroundColor: branding.primaryColor || "#0f766e",
          color: "white",
        }}
      >
        {heroBlocks.map((block) => (
          <ExportBlockRenderer key={block.id} block={block} branding={branding} isHero />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        {bodyBlocks.map((block) => (
          <ExportBlockRenderer key={block.id} block={block} branding={branding} />
        ))}
      </div>
    </div>
  );
}

function ExportBlockRenderer({ block, branding, isHero = false }: { block: any; branding: OmBrandingSettings; isHero?: boolean }) {
  const content = block.content || {};

  switch (block.type) {
    case "text":
      return (
        <div className={`prose prose-sm max-w-none ${isHero ? "text-white" : ""}`}>
          <div dangerouslySetInnerHTML={{ __html: formatMarkdown(content.markdown || "") }} />
        </div>
      );

    case "kpi":
      return (
        <div className="grid grid-cols-3 gap-4">
          {(content.items || []).map((item: any, idx: number) => (
            <div key={idx} className="bg-slate-50 rounded-lg p-4 text-center border border-slate-200">
              <div className="text-2xl font-bold text-slate-900">{item.value}</div>
              <div className="text-xs font-medium text-slate-600 mt-1">{item.label}</div>
              {item.subtext && (
                <div className="text-[10px] text-slate-400 mt-0.5">{item.subtext}</div>
              )}
            </div>
          ))}
        </div>
      );

    case "chart":
      return (
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <div className="text-sm font-medium text-slate-700 mb-2">{content.title || "Chart"}</div>
          <div className="h-48 flex items-end gap-2 justify-around">
            {(content.data || []).map((item: any, idx: number) => (
              <div key={idx} className="flex flex-col items-center gap-1">
                <div
                  className="w-12 rounded-t"
                  style={{
                    height: `${Math.min((item.value / 1200000) * 150, 150)}px`,
                    backgroundColor: branding.primaryColor || "#0f766e",
                  }}
                />
                <span className="text-[10px] text-slate-500">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case "table":
      return (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                {(content.columns || [{ id: "col1", label: "Category" }, { id: "col2", label: "Value" }]).map((col: any) => (
                  <th key={col.id} className="px-3 py-2 text-left text-xs font-medium text-slate-600">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(content.rows || []).map((row: any, idx: number) => (
                <tr key={idx} className="border-t border-slate-200">
                  {Object.values(row).map((val: any, i: number) => (
                    <td key={i} className="px-3 py-2 text-slate-700">{val}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "image":
      return (
        <div className="rounded-lg overflow-hidden">
          <img
            src={content.url || "https://via.placeholder.com/800x400"}
            alt={content.alt || ""}
            className="w-full h-auto object-cover"
          />
        </div>
      );

    default:
      return (
        <div className="bg-slate-100 rounded p-4 text-slate-500 text-sm">
          Block type: {block.type}
        </div>
      );
  }
}

function formatMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br />");
}
