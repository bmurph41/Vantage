import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText, ArrowLeft, Calendar, Tag } from "lucide-react";
import { useLocation, Link } from "wouter";

const TITLES: Record<string, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  benchmarking: "Benchmarking Policy",
};

function renderMarkdown(md: string): string {
  return md
    .split("\n\n")
    .map((block) => {
      block = block.trim();
      if (!block) return "";

      if (block.startsWith("### ")) {
        return `<h3>${block.slice(4)}</h3>`;
      }
      if (block.startsWith("## ")) {
        return `<h2>${block.slice(3)}</h2>`;
      }
      if (block.startsWith("# ")) {
        return `<h1>${block.slice(2)}</h1>`;
      }

      if (block === "---") {
        return "<hr />";
      }

      const lines = block.split("\n");
      if (lines.every((l) => l.startsWith("- "))) {
        const items = lines.map((l) => `<li>${l.slice(2)}</li>`).join("");
        return `<ul>${items}</ul>`;
      }

      let html = block
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/\n/g, "<br />");

      return `<p>${html}</p>`;
    })
    .join("\n");
}

export default function LegalPage({ docType }: { docType: 'terms' | 'privacy' | 'benchmarking' }) {
  const [, setLocation] = useLocation();
  const title = TITLES[docType];

  const { data, isLoading, error } = useQuery<{
    contentMd: string;
    effectiveAt: string;
    version: string;
    docType: string;
  }>({
    queryKey: [`/api/legal/${docType}`],
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground">Document Not Found</h2>
            <p className="text-muted-foreground">
              The requested legal document could not be loaded. Please try again later.
            </p>
            <Link href="/" className="text-primary hover:underline text-sm">
              Return to Dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <button
        onClick={() => setLocation("/")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="space-y-3">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <FileText className="h-8 w-8" />
          {title}
        </h1>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Effective: {new Date(data.effectiveAt).toLocaleDateString()}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Tag className="h-3 w-3" />
            Version {data.version}
          </Badge>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div
            className="prose dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(data.contentMd) }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
