import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Plus, Trash2, FileText, Bell, BellOff, ChevronDown, ChevronRight } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface PortfolioCompany {
  id: string;
  companyName: string;
  aliases: string[];
  sector: string | null;
  region: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Article {
  id: number;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  categories: string[];
}

export default function PortfolioCompaniesPage() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [aliases, setAliases] = useState("");
  const [sector, setSector] = useState("");
  const [region, setRegion] = useState("");
  const [notes, setNotes] = useState("");
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  // Fetch portfolio companies
  const { data: companies = [], isLoading } = useQuery<PortfolioCompany[]>({
    queryKey: ['/api/docktalk/portfolio-companies'],
  });

  // Fetch articles for expanded company
  const { data: companyArticles = [] } = useQuery<Article[]>({
    queryKey: ['/api/docktalk/portfolio-companies', expandedCompany, 'articles'],
    queryFn: async () => {
      if (!expandedCompany) return [];
      const response = await fetch(`/api/docktalk/portfolio-companies/${expandedCompany}/articles?limit=20`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch articles');
      return response.json();
    },
    enabled: !!expandedCompany,
  });

  // Create portfolio company mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      companyName: string;
      aliases?: string[];
      sector?: string;
      region?: string;
      notes?: string;
    }) => {
      const response = await fetch('/api/docktalk/portfolio-companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create portfolio company');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/portfolio-companies'] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "Portfolio Company Added",
        description: "Company has been added to your portfolio tracking list.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update portfolio company mutation (for alert toggle)
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PortfolioCompany> }) => {
      const response = await fetch(`/api/docktalk/portfolio-companies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to update portfolio company');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/portfolio-companies'] });
      toast({
        title: "Settings Updated",
        description: "Portfolio company alert settings have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update portfolio company",
        variant: "destructive",
      });
    },
  });

  // Delete portfolio company mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/docktalk/portfolio-companies/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to delete portfolio company');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/portfolio-companies'] });
      toast({
        title: "Company Removed",
        description: "Portfolio company has been removed from tracking.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove portfolio company",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setCompanyName("");
    setAliases("");
    setSector("");
    setRegion("");
    setNotes("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!companyName.trim()) {
      toast({
        title: "Validation Error",
        description: "Company name is required",
        variant: "destructive",
      });
      return;
    }

    const aliasesArray = aliases
      .split(',')
      .map(a => a.trim())
      .filter(Boolean);

    createMutation.mutate({
      companyName: companyName.trim(),
      aliases: aliasesArray.length > 0 ? aliasesArray : undefined,
      sector: sector.trim() ? sector.trim() : null,
      region: region.trim() ? region.trim() : null,
      notes: notes.trim() ? notes.trim() : null,
    });
  };

  const handleDelete = (company: PortfolioCompany) => {
    if (window.confirm(`Are you sure you want to remove ${company.companyName} from your portfolio tracking?`)) {
      deleteMutation.mutate(company.id);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            Portfolio Companies
          </h1>
          <p className="text-muted-foreground mt-2">
            Track marina companies in your investment portfolio and receive alerts when they appear in news
          </p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-portfolio-company">
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Add Portfolio Company</DialogTitle>
              <DialogDescription>
                Add a marina company to your portfolio tracking list. You'll receive alerts when this company appears in industry news.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="companyName">
                    Company Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="companyName"
                    data-testid="input-company-name"
                    placeholder="e.g., Safe Harbor Marinas"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="aliases">
                    Aliases (comma-separated)
                  </Label>
                  <Input
                    id="aliases"
                    data-testid="input-aliases"
                    placeholder="e.g., Safe Harbor, SHM"
                    value={aliases}
                    onChange={(e) => setAliases(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Add alternative names or abbreviations to improve article matching
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="sector">Sector</Label>
                    <Input
                      id="sector"
                      data-testid="input-sector"
                      placeholder="e.g., Marina Operations"
                      value={sector}
                      onChange={(e) => setSector(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="region">Region</Label>
                    <Input
                      id="region"
                      data-testid="input-region"
                      placeholder="e.g., US Southeast"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    data-testid="input-notes"
                    placeholder="Internal notes about this portfolio company..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    resetForm();
                  }}
                  data-testid="button-cancel-add"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-add"
                >
                  {createMutation.isPending ? "Adding..." : "Add Company"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : companies.length === 0 ? (
        <Card>
          <CardHeader className="text-center py-12">
            <div className="flex justify-center mb-4">
              <Building2 className="h-16 w-16 text-muted-foreground/50" />
            </div>
            <CardTitle className="text-2xl">No Portfolio Companies Yet</CardTitle>
            <CardDescription className="text-base mt-2">
              Start tracking marina companies in your investment portfolio to receive automated alerts when they appear in industry news.
            </CardDescription>
            <div className="mt-6">
              <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-company">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Company
              </Button>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {companies.map((company) => (
            <Card key={company.id} data-testid={`card-company-${company.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      {company.companyName}
                    </CardTitle>
                    <div className="flex items-center gap-4 mt-2">
                      {company.sector && (
                        <Badge variant="secondary" data-testid={`badge-sector-${company.id}`}>
                          {company.sector}
                        </Badge>
                      )}
                      {company.region && (
                        <Badge variant="outline" data-testid={`badge-region-${company.id}`}>
                          {company.region}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2" data-testid={`alert-toggle-${company.id}`}>
                      <Label htmlFor={`alert-${company.id}`} className="text-sm cursor-pointer">
                        {company.isActive ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
                      </Label>
                      <Switch
                        id={`alert-${company.id}`}
                        checked={company.isActive}
                        onCheckedChange={(checked) => {
                          updateMutation.mutate({
                            id: company.id,
                            data: { isActive: checked },
                          });
                        }}
                        disabled={updateMutation.isPending}
                        data-testid={`switch-alert-${company.id}`}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(company)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${company.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {company.aliases.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Aliases:</p>
                    <div className="flex flex-wrap gap-2">
                      {company.aliases.map((alias, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs" data-testid={`badge-alias-${company.id}-${idx}`}>
                          {alias}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {company.notes && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Notes:</p>
                    <p className="text-sm text-foreground" data-testid={`text-notes-${company.id}`}>
                      {company.notes}
                    </p>
                  </div>
                )}

                <div className="border-t pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedCompany(expandedCompany === company.id ? null : company.id)}
                    className="w-full justify-start text-sm font-medium text-muted-foreground hover:text-foreground"
                    data-testid={`button-toggle-articles-${company.id}`}
                  >
                    {expandedCompany === company.id ? (
                      <ChevronDown className="h-4 w-4 mr-2" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-2" />
                    )}
                    <FileText className="h-4 w-4 mr-2" />
                    Related Articles ({expandedCompany === company.id ? companyArticles.length : '...'})
                  </Button>

                  {expandedCompany === company.id && (
                    <div className="mt-3 space-y-2" data-testid={`articles-list-${company.id}`}>
                      {companyArticles.length === 0 ? (
                        <p className="text-sm text-muted-foreground px-4 py-2">
                          No articles mentioning this company yet
                        </p>
                      ) : (
                        companyArticles.map((article) => (
                          <a
                            key={article.id}
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-3 rounded-md border hover:bg-muted/50 transition-colors"
                            data-testid={`article-${article.id}`}
                          >
                            <h4 className="text-sm font-medium text-foreground line-clamp-2">
                              {article.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>{article.source}</span>
                              <span>•</span>
                              <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                              {article.categories.length > 0 && (
                                <>
                                  <span>•</span>
                                  <span>{article.categories[0]}</span>
                                </>
                              )}
                            </div>
                          </a>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {companies.length > 0 && (
        <div className="mt-8 p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-sm">Alert Notifications</h3>
              <p className="text-sm text-muted-foreground mt-1">
                You'll receive alerts when any of your tracked companies are mentioned in DockTalk articles. 
                Configure your notification preferences in Settings to control alert frequency and delivery method.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
