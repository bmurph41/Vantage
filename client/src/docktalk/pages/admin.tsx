import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { queryClient, apiRequest } from "../lib/queryClient";
import {
  fetchRssSources,
  createRssSource,
  updateRssSource,
  deleteRssSource,
  previewRssSource,
  fetchArticles,
  updateArticleCategory,
  updateArticleRegion,
  exportTrainingData,
  removeArticle,
  type RssSource,
  type PreviewArticle,
} from "../lib/api";
import { Article } from "../types/article";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Edit, Plus, Download, Eye, Settings, X, Home, Rss, Globe } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const rssSourceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sourceType: z.enum(["rss", "web_scrape"]).default("rss"),
  url: z.string().url("Must be a valid URL"),
  minRelevanceScore: z.number().min(0).max(100).default(50),
  customKeywords: z.string().optional(),
});

type RssSourceFormData = z.infer<typeof rssSourceSchema>;

const CATEGORIES = [
  "Development",
  "Operations",
  "Regulatory",
  "Environmental",
  "Technology",
  "Macro",
  "M&A",
  "General",
  "Boat Sales",
  "Boat Show",
  "Manufacturing",
  "Industry Trends",
  "Marina Sale",
  "Education",
  "Insurance",
  "Legal",
  "People Moves",
  "Company Earnings",
  "Awards",
  "Business Planning",
] as const;

const REGIONS = [
  "US/Domestic",
  "International",
] as const;

export default function AdminPage() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<RssSource | null>(null);
  const [deleteSourceId, setDeleteSourceId] = useState<number | null>(null);
  const [previewData, setPreviewData] = useState<{
    feedTitle: string;
    feedDescription: string;
    itemCount: number;
    previewArticles: PreviewArticle[];
  } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [sourceFilter, setSourceFilter] = useState<string | undefined>(undefined);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [articleToRemove, setArticleToRemove] = useState<number | null>(null);
  const [removalReason, setRemovalReason] = useState("");

  const addForm = useForm<RssSourceFormData>({
    resolver: zodResolver(rssSourceSchema),
    defaultValues: {
      name: "",
      sourceType: "rss",
      url: "",
      minRelevanceScore: 50,
      customKeywords: "",
    },
  });

  const editForm = useForm<RssSourceFormData>({
    resolver: zodResolver(rssSourceSchema),
  });

  const { data: rssSources = [], isLoading: rssSourcesLoading } = useQuery({
    queryKey: ["/api/docktalk/rss-sources"],
    queryFn: fetchRssSources,
  });

  // Filter to only active RSS sources for the dropdown
  const activeSources = rssSources.filter(source => source.isActive);

  const { data: articles = [], isLoading: articlesLoading } = useQuery({
    queryKey: ["/api/docktalk/articles", { limit: 50, offset: 0, sortBy: "newest", category: categoryFilter, source: sourceFilter }],
    queryFn: () => fetchArticles({ limit: 50, offset: 0, sortBy: "newest", category: categoryFilter, source: sourceFilter }),
  });

  const createMutation = useMutation({
    mutationFn: (data: RssSourceFormData) =>
      createRssSource({
        name: data.name,
        sourceType: data.sourceType,
        url: data.url,
        minRelevanceScore: data.minRelevanceScore,
        customKeywords: data.customKeywords
          ? data.customKeywords.split(",").map((k) => k.trim()).filter(Boolean)
          : [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docktalk/rss-sources"] });
      setIsAddDialogOpen(false);
      addForm.reset();
      setPreviewData(null);
      toast({
        title: "RSS Source Added",
        description: "The RSS source has been successfully added.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add RSS source",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<RssSourceFormData> }) =>
      updateRssSource(id, {
        name: data.name,
        sourceType: data.sourceType,
        url: data.url,
        minRelevanceScore: data.minRelevanceScore,
        customKeywords: data.customKeywords
          ? data.customKeywords.split(",").map((k) => k.trim()).filter(Boolean)
          : [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docktalk/rss-sources"] });
      setIsEditDialogOpen(false);
      setEditingSource(null);
      toast({
        title: "RSS Source Updated",
        description: "The RSS source has been successfully updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update RSS source",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRssSource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docktalk/rss-sources"] });
      setDeleteSourceId(null);
      toast({
        title: "RSS Source Deleted",
        description: "The RSS source has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete RSS source",
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      updateRssSource(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docktalk/rss-sources"] });
      toast({
        title: "Status Updated",
        description: "RSS source status has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update status",
        variant: "destructive",
      });
    },
  });

  const categoryMutation = useMutation({
    mutationFn: ({ id, categories }: { id: number; categories: string[] }) =>
      updateArticleCategory(id, categories),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docktalk/articles"] });
      toast({
        title: "Categories Updated",
        description: "Article categories have been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update categories",
        variant: "destructive",
      });
    },
  });

  const regionMutation = useMutation({
    mutationFn: ({ id, region }: { id: number; region: string | null }) =>
      updateArticleRegion(id, region),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docktalk/articles"] });
      toast({
        title: "Region Updated",
        description: "Article region has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update region",
        variant: "destructive",
      });
    },
  });

  const removeArticleMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      removeArticle(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docktalk/articles"] });
      setRemoveDialogOpen(false);
      setArticleToRemove(null);
      setRemovalReason("");
      toast({
        title: "Article Removed",
        description: "Article removed successfully. AI will learn from this pattern.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove article",
        variant: "destructive",
      });
    },
  });

  const handlePreview = async () => {
    const url = addForm.getValues("url");
    const sourceType = addForm.getValues("sourceType") || "rss";
    if (!url) {
      toast({
        title: "Error",
        description: "Please enter a URL first",
        variant: "destructive",
      });
      return;
    }

    setIsPreviewLoading(true);
    try {
      const data = await previewRssSource(url, sourceType);
      setPreviewData(data);
      toast({
        title: "Preview Loaded",
        description: `Found ${data.itemCount} ${sourceType === "web_scrape" ? "scraped articles" : "articles in feed"}`,
      });
    } catch (error) {
      toast({
        title: "Preview Failed",
        description: error instanceof Error ? error.message : `Failed to preview ${sourceType === "web_scrape" ? "web page" : "RSS feed"}`,
        variant: "destructive",
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleEdit = (source: RssSource) => {
    setEditingSource(source);
    editForm.reset({
      name: source.name,
      sourceType: source.sourceType || "rss",
      url: source.url,
      minRelevanceScore: source.minRelevanceScore,
      customKeywords: source.customKeywords?.join(", ") || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleExportTraining = async () => {
    try {
      const blob = await exportTrainingData();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `training-data-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Export Successful",
        description: "Training data has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export training data",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Settings className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            </div>
            <Link href="/docktalk">
              <Button variant="outline" data-testid="button-home">
                <Home className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                RSS Source Management
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Manage RSS feeds and their relevance settings
              </p>
            </div>
            <div className="flex gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="default" data-testid="button-backfill">
                    <Download className="h-4 w-4 mr-2" />
                    Backfill Historical Data
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Historical Data Backfill</DialogTitle>
                    <DialogDescription>
                      Fetch articles from the last 6 months from all RSS sources. This will help populate the database with historical data for manual review and AI training.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      This process will:
                    </p>
                    <ul className="text-sm space-y-1 list-disc pl-5 text-muted-foreground">
                      <li>Fetch up to 500 articles per source</li>
                      <li>Process articles from the last 6 months</li>
                      <li>Skip duplicate articles automatically</li>
                      <li>Run AI categorization and region detection</li>
                    </ul>
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                      ⚠️ This may take several minutes and will use AI credits
                    </p>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={async () => {
                        try {
                          const response = await apiRequest("/api/docktalk/admin/backfill", {
                            method: "POST",
                            body: JSON.stringify({
                              monthsBack: 6,
                              maxArticlesPerSource: 500
                            }),
                          });
                          toast({
                            title: "Backfill Complete",
                            description: response.message,
                          });
                        } catch (error) {
                          toast({
                            title: "Backfill Failed",
                            description: error instanceof Error ? error.message : "An error occurred",
                            variant: "destructive",
                          });
                        }
                      }}
                      data-testid="button-confirm-backfill"
                    >
                      Start Backfill
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary" data-testid="button-deal-backfill">
                    <Download className="h-4 w-4 mr-2" />
                    Extract Deals from Existing Articles
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Deal Extraction Backfill</DialogTitle>
                    <DialogDescription>
                      Re-process existing articles to extract deals for M&A Spotlight. This will use the enhanced entity recognition to find transactions involving major marina operators and PE firms.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Choose how far back to process articles:
                    </p>
                    <RadioGroup defaultValue="90" id="deal-backfill-days">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="30" id="days-30" />
                        <Label htmlFor="days-30">Last 30 days</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="60" id="days-60" />
                        <Label htmlFor="days-60">Last 60 days</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="90" id="days-90" />
                        <Label htmlFor="days-90">Last 90 days (recommended)</Label>
                      </div>
                    </RadioGroup>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        This process will:
                      </p>
                      <ul className="text-sm space-y-1 list-disc pl-5 text-muted-foreground">
                        <li>Scan existing articles for deal keywords</li>
                        <li>Extract transaction details (buyer, seller, deal size)</li>
                        <li>Create deal records in M&A Spotlight</li>
                        <li>Link entities like Safe Harbor, Suntex, Allied Strategic Capital</li>
                      </ul>
                    </div>
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                      ⚠️ This may take 10-15 minutes and will use AI credits
                    </p>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={async () => {
                        try {
                          const radioGroup = document.getElementById('deal-backfill-days') as HTMLElement;
                          const selectedRadio = radioGroup?.querySelector('input[type="radio"]:checked') as HTMLInputElement;
                          const daysBack = selectedRadio?.value || '90';
                          
                          const response = await apiRequest("/api/docktalk/deals/backfill-from-articles", {
                            method: "POST",
                            body: JSON.stringify({
                              daysBack: parseInt(daysBack)
                            }),
                          });
                          toast({
                            title: "Deal Extraction Complete",
                            description: `${response.dealsFound} deals found from ${response.processed} articles`,
                          });
                        } catch (error) {
                          toast({
                            title: "Deal Extraction Failed",
                            description: error instanceof Error ? error.message : "An error occurred",
                            variant: "destructive",
                          });
                        }
                      }}
                      data-testid="button-confirm-deal-backfill"
                    >
                      Extract Deals
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-source">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Source
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Source</DialogTitle>
                    <DialogDescription>
                      Add a new RSS feed source to monitor for marina industry news
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...addForm}>
                  <form onSubmit={addForm.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={addForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Marina World News" {...field} data-testid="input-source-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addForm.control}
                      name="sourceType"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>Source Type</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex flex-col space-y-1"
                            >
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="rss" data-testid="radio-source-type-rss" />
                                </FormControl>
                                <FormLabel className="font-normal flex items-center gap-2">
                                  <Rss className="h-4 w-4" />
                                  RSS Feed
                                </FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="web_scrape" data-testid="radio-source-type-web" />
                                </FormControl>
                                <FormLabel className="font-normal flex items-center gap-2">
                                  <Globe className="h-4 w-4" />
                                  Web
                                </FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormDescription>
                            RSS feeds provide structured content; web scraping extracts articles from news pages
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addForm.control}
                      name="url"
                      render={({ field }) => {
                        const sourceType = addForm.watch("sourceType");
                        return (
                          <FormItem>
                            <FormLabel>
                              {sourceType === "web_scrape" ? "News Page URL" : "RSS Feed URL"}
                            </FormLabel>
                            <FormControl>
                              <Input 
                                placeholder={sourceType === "web_scrape" ? "https://example.com/news" : "https://example.com/rss"} 
                                {...field} 
                                data-testid="input-source-url" 
                              />
                            </FormControl>
                            <FormDescription>
                              {sourceType === "web_scrape" 
                                ? "URL of the news listing page to scrape for articles" 
                                : "URL of the RSS/Atom feed"}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                    <FormField
                      control={addForm.control}
                      name="minRelevanceScore"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Minimum Relevance Score: {field.value}</FormLabel>
                          <FormControl>
                            <Slider
                              min={0}
                              max={100}
                              step={5}
                              value={[field.value]}
                              onValueChange={(vals) => field.onChange(vals[0])}
                              data-testid="slider-min-relevance"
                            />
                          </FormControl>
                          <FormDescription>
                            Articles below this score will be filtered out (0-100)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addForm.control}
                      name="customKeywords"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Custom Keywords (optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="marina, yacht, dock (comma-separated)"
                              {...field}
                              data-testid="input-custom-keywords"
                            />
                          </FormControl>
                          <FormDescription>
                            Additional keywords to boost relevance scoring
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handlePreview}
                        disabled={isPreviewLoading}
                        data-testid="button-preview-source"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        {isPreviewLoading ? "Loading..." : "Preview Feed"}
                      </Button>
                    </div>

                    {previewData && (
                      <div className="border rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
                        <div>
                          <h4 className="font-semibold text-sm">{previewData.feedTitle}</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {previewData.feedDescription}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Total items: {previewData.itemCount}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium">Sample Articles:</h5>
                          {previewData.previewArticles.map((article, idx) => (
                            <div
                              key={idx}
                              className="text-xs p-2 bg-white dark:bg-gray-800 rounded border"
                              data-testid={`preview-article-${idx}`}
                            >
                              <div className="font-medium">{article.title}</div>
                              <div className="text-gray-500 mt-1">
                                Relevance Score: {article.relevanceScore}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsAddDialogOpen(false);
                          addForm.reset();
                          setPreviewData(null);
                        }}
                        data-testid="button-cancel-add"
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-add">
                        {createMutation.isPending ? "Adding..." : "Add Source"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          </div>

          {rssSourcesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Min Relevance</TableHead>
                    <TableHead>Custom Keywords</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Last Fetched</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rssSources.map((source) => (
                    <TableRow key={source.id} data-testid={`rss-source-row-${source.id}`}>
                      <TableCell className="font-medium">{source.name}</TableCell>
                      <TableCell>
                        <Badge variant={source.sourceType === "web_scrape" ? "default" : "secondary"} className="flex items-center gap-1 w-fit">
                          {source.sourceType === "web_scrape" ? (
                            <><Globe className="h-3 w-3" /> Web</>
                          ) : (
                            <><Rss className="h-3 w-3" /> RSS</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {source.url}
                        </a>
                      </TableCell>
                      <TableCell>{source.minRelevanceScore}</TableCell>
                      <TableCell>
                        {source.customKeywords && source.customKeywords.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {source.customKeywords.map((keyword, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={source.isActive}
                          onCheckedChange={(checked) =>
                            toggleActiveMutation.mutate({ id: source.id, isActive: checked })
                          }
                          data-testid={`switch-active-${source.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        {source.lastFetched ? (
                          <span className="text-sm">
                            {formatDistanceToNow(new Date(source.lastFetched), { addSuffix: true })}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">Never</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(source)}
                            data-testid={`button-edit-${source.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteSourceId(source.id)}
                            data-testid={`button-delete-${source.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Article Category Correction
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Review and correct article categorization for ML training
              </p>
            </div>
            <div className="flex gap-2">
              <Select value={sourceFilter || "all"} onValueChange={(val) => setSourceFilter(val === "all" ? undefined : val)}>
                <SelectTrigger className="w-48" data-testid="select-source-filter">
                  <SelectValue placeholder="Filter by source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {activeSources.map((source) => (
                    <SelectItem key={source.id} value={source.name}>
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter || "all"} onValueChange={(val) => setCategoryFilter(val === "all" ? undefined : val)}>
                <SelectTrigger className="w-48" data-testid="select-category-filter">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleExportTraining} variant="outline" data-testid="button-export-training">
                <Download className="h-4 w-4 mr-2" />
                Export Training Data
              </Button>
            </div>
          </div>

          {articlesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">Title</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Categories</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Sentiment</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map((article) => (
                    <TableRow key={article.id} data-testid={`article-row-${article.id}`}>
                      <TableCell className="font-medium">
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-600 hover:underline line-clamp-2"
                        >
                          {article.title}
                        </a>
                      </TableCell>
                      <TableCell>{article.source}</TableCell>
                      <TableCell>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-fit max-w-[300px] justify-start text-left font-normal"
                              data-testid={`button-categories-${article.id}`}
                            >
                              <div className="flex flex-wrap gap-1">
                                {(article.categories && article.categories.length > 0) ? (
                                  article.categories.map((cat) => (
                                    <Badge key={cat} variant="secondary" className="text-xs">
                                      {cat}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-muted-foreground">Select categories...</span>
                                )}
                              </div>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-4" align="start">
                            <div className="space-y-4">
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-medium text-sm">Select Categories</h4>
                                  {article.categories && article.categories.length > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        categoryMutation.mutate({ id: article.id, categories: [] });
                                      }}
                                      className="h-7 text-xs"
                                      data-testid={`button-clear-categories-${article.id}`}
                                    >
                                      Clear All
                                    </Button>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                                  {CATEGORIES.map((cat) => {
                                    const isChecked = article.categories?.includes(cat) || false;
                                    
                                    return (
                                      <div key={cat} className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`${article.id}-${cat}`}
                                          checked={isChecked}
                                          onCheckedChange={(checked) => {
                                            const currentCategories = article.categories || [];
                                            
                                            // Handle boolean checked state explicitly
                                            const isAdding = checked === true;
                                            
                                            const newCategories = isAdding
                                              ? [...currentCategories, cat]
                                              : currentCategories.filter((c) => c !== cat);
                                            
                                            categoryMutation.mutate({ id: article.id, categories: newCategories });
                                          }}
                                          data-testid={`checkbox-category-${cat.toLowerCase().replace(/ /g, '-')}-${article.id}`}
                                        />
                                        <label
                                          htmlFor={`${article.id}-${cat}`}
                                          className="text-sm cursor-pointer"
                                        >
                                          {cat}
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              {article.categories && article.categories.length > 0 && (
                                <div className="pt-2 border-t">
                                  <p className="text-xs text-muted-foreground">
                                    {article.categories.length} {article.categories.length === 1 ? 'category' : 'categories'} selected
                                  </p>
                                </div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-fit max-w-[200px] justify-start text-left font-normal"
                              data-testid={`button-region-${article.id}`}
                            >
                              {article.region ? (
                                <Badge variant="secondary" className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs">
                                  {article.region}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">Select region...</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-60 p-4" align="start">
                            <div className="space-y-4">
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-medium text-sm">Select Region</h4>
                                  {article.region && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        regionMutation.mutate({ id: article.id, region: null });
                                      }}
                                      className="h-7 text-xs"
                                      data-testid={`button-clear-region-${article.id}`}
                                    >
                                      Clear
                                    </Button>
                                  )}
                                </div>
                                <RadioGroup
                                  value={article.region || ""}
                                  onValueChange={(value) => {
                                    regionMutation.mutate({ id: article.id, region: value });
                                  }}
                                  className="space-y-2 max-h-80 overflow-y-auto"
                                >
                                  {REGIONS.map((region) => (
                                    <div key={region} className="flex items-center space-x-2">
                                      <RadioGroupItem
                                        value={region}
                                        id={`${article.id}-${region}`}
                                        data-testid={`radio-region-${region.toLowerCase().replace(/\//g, '-').replace(/ /g, '-')}-${article.id}`}
                                      />
                                      <label
                                        htmlFor={`${article.id}-${region}`}
                                        className="text-sm cursor-pointer"
                                      >
                                        {region}
                                      </label>
                                    </div>
                                  ))}
                                </RadioGroup>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell>
                        {article.sentiment && (
                          <Badge
                            variant={
                              article.sentiment === "positive"
                                ? "default"
                                : article.sentiment === "negative"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {article.sentiment}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {article.publishedAt && (
                          <span className="text-sm">
                            {formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {article.manuallyReviewed && (
                          <Badge variant="outline" data-testid={`badge-reviewed-${article.id}`}>
                            Manually Reviewed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setArticleToRemove(article.id);
                            setRemoveDialogOpen(true);
                          }}
                          data-testid={`button-remove-article-${article.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Source</DialogTitle>
            <DialogDescription>Update RSS feed source settings</DialogDescription>
          </DialogHeader>
          {editingSource && (
            <Form {...editForm}>
              <form
                onSubmit={editForm.handleSubmit((data) =>
                  updateMutation.mutate({ id: editingSource.id, data })
                )}
                className="space-y-4"
              >
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-source-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="sourceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Type</FormLabel>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="flex gap-4"
                          data-testid="radio-group-edit-source-type"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="rss" id="edit-rss" data-testid="radio-edit-rss" />
                            <label htmlFor="edit-rss" className="text-sm cursor-pointer flex items-center gap-2">
                              <Rss className="h-4 w-4" />
                              RSS Feed
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="web_scrape" id="edit-web" data-testid="radio-edit-web" />
                            <label htmlFor="edit-web" className="text-sm cursor-pointer flex items-center gap-2">
                              <Globe className="h-4 w-4" />
                              Web
                            </label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {editForm.watch("sourceType") === "web_scrape" ? "News Page URL" : "RSS Feed URL"}
                      </FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-source-url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="minRelevanceScore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Relevance Score: {field.value}</FormLabel>
                      <FormControl>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[field.value]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          data-testid="slider-edit-min-relevance"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="customKeywords"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Keywords (optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="marina, yacht, dock (comma-separated)"
                          {...field}
                          data-testid="input-edit-custom-keywords"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      setEditingSource(null);
                    }}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit">
                    {updateMutation.isPending ? "Updating..." : "Update Source"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteSourceId !== null} onOpenChange={() => setDeleteSourceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this RSS source. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteSourceId) {
                  deleteMutation.mutate(deleteSourceId);
                }
              }}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Article</DialogTitle>
            <DialogDescription>
              Explain why this article should be removed. The AI will learn from your explanation to automatically filter out similar articles in the future.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="removal-reason">Removal Reason</Label>
              <Textarea
                id="removal-reason"
                placeholder="e.g., Not relevant to marina industry, contains promotional content, low quality source, etc."
                value={removalReason}
                onChange={(e) => setRemovalReason(e.target.value)}
                rows={4}
                className="mt-2"
                data-testid="input-removal-reason"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Minimum 10 characters required. Be specific to help the AI learn.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRemoveDialogOpen(false);
                setRemovalReason("");
              }}
              data-testid="button-cancel-removal"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (articleToRemove && removalReason.length >= 10) {
                  removeArticleMutation.mutate({ id: articleToRemove, reason: removalReason });
                }
              }}
              disabled={removalReason.length < 10 || removeArticleMutation.isPending}
              data-testid="button-confirm-removal"
            >
              {removeArticleMutation.isPending ? "Removing..." : "Remove Article"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
