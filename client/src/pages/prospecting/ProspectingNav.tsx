import { Link, useLocation } from "wouter";

const PROSPECTING_TABS = [
  { label: "Overview",  href: "/prospecting" },
  { label: "Workroom",  href: "/prospecting/workroom" },
  { label: "Markets",   href: "/prospecting/markets" },
  { label: "Campaigns", href: "/prospecting/campaigns" },
  { label: "Schedule",  href: "/prospecting/schedule" },
];

export function ProspectingNav() {
  const [location] = useLocation();

  return (
    <div className="flex gap-1 border-b mb-6">
      {PROSPECTING_TABS.map((t) => {
        const isActive =
          t.href === "/prospecting"
            ? location === "/prospecting" || location === "/prospecting/"
            : location.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href}>
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          </Link>
        );
      })}
    </div>
  );
}
