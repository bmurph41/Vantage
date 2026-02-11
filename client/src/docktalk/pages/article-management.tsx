import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { fetchArticles, updateArticleCategory, removeArticle, deleteArticle, fetchSystemStats, fetchCategoryDistribution, fetchSourceDistribution, fetchAllCategories } from "../lib/api";
import { Article, ArticleFilters, CategoryDistribution, SourceDistribution } from "../types/article";
import DockTalkHeader from "../components/DockTalkHeader";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Brain, 
  Trash2, 
  Edit, 
  Search, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Filter,
  CheckCircle2,
  XCircle,
  RefreshCw
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

const FALLBACK_CATEGORIES = [
  "Macro",
  "M&A",
  "Development", 
  "Operations",
  "Regulatory",
  "Environmental",
  "Technology",
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
  "International",
  "Interview"
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Macro": { bg: "bg-blue-100", text: "text-blue-700" },
  "M&A": { bg: "bg-orange-100", text: "text-orange-700" },
  "Development": { bg: "bg-purple-100", text: "text-purple-700" },
  "Operations": { bg: "bg-slate-100", text: "text-slate-700" },
  "Regulatory": { bg: "bg-red-100", text: "text-red-700" },
  "Environmental": { bg: "bg-green-100", text: "text-green-700" },
  "Technology": { bg: "bg-indigo-100", text: "text-indigo-700" },
  "General": { bg: "bg-gray-100", text: "text-gray-700" },
  "Boat Sales": { bg: "bg-cyan-100", text: "text-cyan-700" },
  "Boat Show": { bg: "bg-pink-100", text: "text-pink-700" },
  "Manufacturing": { bg: "bg-stone-100", text: "text-stone-700" },
  "Industry Trends": { bg: "bg-amber-100", text: "text-amber-700" },
  "Marina Sale": { bg: "bg-rose-100", text: "text-rose-700" },
  "Education": { bg: "bg-emerald-100", text: "text-emerald-700" },
  "Insurance": { bg: "bg-yellow-100", text: "text-yellow-700" },
  "Legal": { bg: "bg-fuchsia-100", text: "text-fuchsia-700" },
  "People Moves": { bg: "bg-teal-100", text: "text-teal-700" },
  "Company Earnings": { bg: "bg-lime-100", text: "text-lime-700" },
  "Awards": { bg: "bg-amber-100", text: "text-amber-700" },
  "Business Planning": { bg: "bg-violet-100", text: "text-violet-700" },
  "International": { bg: "bg-sky-100", text: "text-sky-700" },
  "Interview": { bg: "bg-orange-100", text: "text-orange-800" }
};

const PAGE_SIZE = 25;

export default function ArticleManagementPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState("");
  const [page, setPage] = useState(0);
  const [selectedArticles, setSelectedArticles] = useState<number[]>([]);
  
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const [removeArticleId, setRemoveArticleId] = useState<number | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [deleteArticleId, setDeleteArticleId] = useState<number | null>(null);

  const { data: systemStats } = useQuery({
    queryKey: ['/api/docktalk/analytics/stats'],
    queryFn: fetchSystemStats,
    refetchInterval: 60 * 1000,
  });

  // Fetch categories from backend
  const { data: categoryDistribution = [] } = useQuery<CategoryDistribution[]>({
    queryKey: ['/api/docktalk/analytics/categories'],
    queryFn: fetchCategoryDistribution,
  });

  // Fetch sources from backend
  const { data: sourceDistribution = [] } = useQuery<SourceDistribution[]>({
    queryKey: ['/api/docktalk/analytics/sources'],
    queryFn: fetchSourceDistribution,
  });

  // Fetch ALL valid categories for editing (not just ones with articles)
  const { data: allCategories = FALLBACK_CATEGORIES } = useQuery<string[]>({
    queryKey: ['/api/docktalk/categories/all'],
    queryFn: fetchAllCategories,
  });

  // Get available categories from backend for filtering (only categories with articles)
  const filterCategories = categoryDistribution.length > 0 
    ? categoryDistribution.map(c => c.category).sort()
    : FALLBACK_CATEGORIES;

  // Use all categories for editing dialog
  const availableCategories = allCategories.length > 0 ? allCategories : FALLBACK_CATEGORIES;

  // Get available sources from backend
  const availableSources = sourceDistribution.map(s => s.source).filter(Boolean).sort();

  const handleArticlesClick = () => setLocation('/docktalk');
  const handleNotificationClick = () => setLocation('/docktalk/notifications');
  const handleSettingsClick = () => setLocation('/docktalk/sources');
  const handleArticleManagementClick = () => {}; // Already on this page

  const filters: ArticleFilters = {
    search: search || undefined,
    categories: categoryFilter.length > 0 ? categoryFilter : undefined,
    source: sourceFilter || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    sortBy: 'newest'
  };

  const { data: articles = [], isLoading, refetch } = useQuery<Article[]>({
    queryKey: ['/api/docktalk/articles', filters],
    queryFn: () => fetchArticles(filters),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, categories }: { id: number; categories: string[] }) =>
      updateArticleCategory(id, categories),
    onMutate: async ({ id, categories }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/docktalk/articles'] });
      
      // Snapshot the previous value for rollback
      const previousArticles = queryClient.getQueryData<Article[]>(['/api/docktalk/articles', filters]);
      
      // Optimistically update the article in the cache
      if (previousArticles) {
        queryClient.setQueryData<Article[]>(['/api/docktalk/articles', filters], (old) =>
          old?.map(article => 
            article.id === id 
              ? { ...article, categories, manuallyReviewed: true }
              : article
          )
        );
      }
      
      return { previousArticles };
    },
    onSuccess: (_data, { id, categories }) => {
      // Invalidate all related queries for real-time updates across the app
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/articles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/articles/trending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/analytics/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/analytics/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/training/review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/training/analytics'] });
      
      // Update local editing state to reflect saved changes
      if (editingArticle && editingArticle.id === id) {
        setEditingArticle({ ...editingArticle, categories, manuallyReviewed: true });
      }
      
      setIsEditDialogOpen(false);
      setEditingArticle(null);
      toast({
        title: "Categories Updated",
        description: "Article categories saved. This helps train the AI.",
      });
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousArticles) {
        queryClient.setQueryData(['/api/docktalk/articles', filters], context.previousArticles);
      }
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update categories",
        variant: "destructive",
      });
    },
  });

  const removeArticleMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      removeArticle(id, reason),
    onMutate: async ({ id }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/docktalk/articles'] });
      
      // Snapshot the previous value for rollback
      const previousArticles = queryClient.getQueryData<Article[]>(['/api/docktalk/articles', filters]);
      
      // Optimistically remove the article from the cache
      if (previousArticles) {
        queryClient.setQueryData<Article[]>(['/api/docktalk/articles', filters], (old) =>
          old?.filter(article => article.id !== id)
        );
      }
      
      return { previousArticles };
    },
    onSuccess: () => {
      // Invalidate all related queries for real-time updates
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/articles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/articles/trending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/analytics/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/analytics/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/training/review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/training/analytics'] });
      setRemoveArticleId(null);
      setRemoveReason("");
      toast({
        title: "Article Removed",
        description: "Article has been removed from the feed. This helps train the AI.",
      });
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousArticles) {
        queryClient.setQueryData(['/api/docktalk/articles', filters], context.previousArticles);
      }
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove article",
        variant: "destructive",
      });
    },
  });

  const deleteArticleMutation = useMutation({
    mutationFn: (id: number) => deleteArticle(id),
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/docktalk/articles'] });
      
      // Snapshot the previous value for rollback
      const previousArticles = queryClient.getQueryData<Article[]>(['/api/docktalk/articles', filters]);
      
      // Optimistically remove the article from the cache
      if (previousArticles) {
        queryClient.setQueryData<Article[]>(['/api/docktalk/articles', filters], (old) =>
          old?.filter(article => article.id !== id)
        );
      }
      
      return { previousArticles };
    },
    onSuccess: () => {
      // Invalidate all related queries for real-time updates
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/articles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/articles/trending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/analytics/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/analytics/stats'] });
      setDeleteArticleId(null);
      toast({
        title: "Article Deleted",
        description: "Article has been permanently deleted.",
      });
    },
    onError: (error, _id, context) => {
      // Rollback on error
      if (context?.previousArticles) {
        queryClient.setQueryData(['/api/docktalk/articles', filters], context.previousArticles);
      }
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete article",
        variant: "destructive",
      });
    },
  });

  const handleEditCategories = (article: Article) => {
    setEditingArticle(article);
    // Filter to only include valid categories (removes legacy categories like "Investment")
    const validCategories = (article.categories || []).filter(cat => 
      availableCategories.includes(cat)
    );
    setEditCategories(validCategories);
    setIsEditDialogOpen(true);
  };

  // Toggle category in dialog (local state only until Save is clicked)
  const toggleCategory = (category: string) => {
    setEditCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Save all category changes when user clicks Save
  const handleSaveCategories = () => {
    if (editingArticle) {
      updateCategoryMutation.mutate({ 
        id: editingArticle.id, 
        categories: editCategories 
      });
    }
  };

  const handleRemoveArticle = () => {
    if (removeArticleId && removeReason.trim()) {
      removeArticleMutation.mutate({ 
        id: removeArticleId, 
        reason: removeReason 
      });
    }
  };

  const handleDeleteArticle = () => {
    if (deleteArticleId) {
      deleteArticleMutation.mutate(deleteArticleId);
    }
  };

  const toggleSelectArticle = (id: number) => {
    setSelectedArticles(prev =>
      prev.includes(id)
        ? prev.filter(a => a !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedArticles.length === articles.length) {
      setSelectedArticles([]);
    } else {
      setSelectedArticles(articles.map(a => a.id));
    }
  };

  // Use backend sources, or fallback to unique sources from current articles
  const displaySources = availableSources.length > 0 
    ? availableSources 
    : [...new Set(articles.map(a => a.source))].filter(Boolean);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
      <DockTalkHeader
        newArticlesCount={systemStats?.newArticlesToday || 0}
        onArticlesClick={handleArticlesClick}
        onNotificationClick={handleNotificationClick}
        onSettingsClick={handleSettingsClick}
        onArticleManagementClick={handleArticleManagementClick}
        showArticlesButton={true}
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Brain className="h-8 w-8 text-purple-500" />
                Article Management
              </h1>
              <p className="text-muted-foreground mt-1">
                Review, categorize, and remove articles to train the AI
              </p>
            </div>
            <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search articles by title or content..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full md:w-auto">
                  <Filter className="h-4 w-4 mr-2" />
                  Categories ({categoryFilter.length || "All"})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {filterCategories.map((cat) => (
                  <DropdownMenuCheckboxItem
                    key={cat}
                    checked={categoryFilter.includes(cat)}
                    onCheckedChange={(checked) => {
                      setCategoryFilter(prev =>
                        checked 
                          ? [...prev, cat]
                          : prev.filter(c => c !== cat)
                      );
                      setPage(0);
                    }}
                  >
                    {cat}
                  </DropdownMenuCheckboxItem>
                ))}
                {categoryFilter.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={false}
                      onCheckedChange={() => setCategoryFilter([])}
                    >
                      Clear All
                    </DropdownMenuCheckboxItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v === "all" ? "" : v); setPage(0); }}>
              <SelectTrigger className="w-full md:w-[180px]" data-testid="select-source">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {displaySources.map((source) => (
                  <SelectItem key={source} value={source}>{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : articles.length > 0 ? (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedArticles.length === articles.length && articles.length > 0}
                          onCheckedChange={toggleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead className="min-w-[300px]">Article</TableHead>
                      <TableHead>Categories</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Published</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {articles.map((article) => (
                      <TableRow key={article.id} data-testid={`article-row-${article.id}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedArticles.includes(article.id)}
                            onCheckedChange={() => toggleSelectArticle(article.id)}
                            data-testid={`checkbox-article-${article.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="max-w-md">
                            <a 
                              href={article.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium hover:underline flex items-center gap-1 line-clamp-2"
                            >
                              {article.title}
                              <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-50" />
                            </a>
                            {article.summary && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {article.summary}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {article.categories && article.categories.length > 0 ? (
                              article.categories.map((cat) => {
                                const style = CATEGORY_COLORS[cat] || CATEGORY_COLORS["General"];
                                return (
                                  <Badge 
                                    key={cat} 
                                    className={cn("text-xs", style.bg, style.text)}
                                    variant="secondary"
                                  >
                                    {cat}
                                  </Badge>
                                );
                              })
                            ) : (
                              <span className="text-xs text-muted-foreground">Uncategorized</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{article.source}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {article.publishedAt 
                              ? formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })
                              : "Unknown"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {article.manuallyReviewed ? (
                            <Badge variant="outline" className="text-green-600 border-green-300">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Reviewed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-500">
                              AI Assigned
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCategories(article)}
                              data-testid={`button-edit-${article.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  data-testid={`button-article-actions-${article.id}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  onClick={() => setRemoveArticleId(article.id)}
                                  data-testid={`button-remove-${article.id}`}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Remove (trains AI)
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start text-destructive hover:text-destructive hover:bg-red-50"
                                  onClick={() => setDeleteArticleId(article.id)}
                                  data-testid={`button-delete-${article.id}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete permanently
                                </Button>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1} - {page * PAGE_SIZE + articles.length} articles
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={articles.length < PAGE_SIZE}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-medium mb-1">No Articles Found</h3>
              <p className="text-sm text-muted-foreground">
                {search || categoryFilter.length > 0 || sourceFilter
                  ? "Try adjusting your filters"
                  : "Articles will appear here once RSS feeds are fetched"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Categories</DialogTitle>
            <DialogDescription>
              {editingArticle && (
                <span className="line-clamp-2">{editingArticle.title}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm font-medium mb-3">Select Categories:</p>
            <div className="flex flex-wrap gap-2">
              {availableCategories.map((cat) => {
                const isSelected = editCategories.includes(cat);
                const style = CATEGORY_COLORS[cat] || CATEGORY_COLORS["General"];
                return (
                  <Badge
                    key={cat}
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-all",
                      isSelected ? cn(style.bg, style.text) : "hover:bg-muted"
                    )}
                    onClick={() => toggleCategory(cat)}
                    data-testid={`category-toggle-${cat.toLowerCase().replace(/ /g, '-')}`}
                  >
                    {isSelected && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {cat}
                  </Badge>
                );
              })}
            </div>
            
            {editingArticle?.originalCategory && editingArticle.originalCategory !== (editingArticle.categories?.[0] || '') && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">
                  <strong>Original AI Category:</strong> {editingArticle.originalCategory}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveCategories}
              disabled={updateCategoryMutation.isPending || editCategories.length === 0}
              data-testid="button-save-categories"
            >
              {updateCategoryMutation.isPending ? "Saving..." : "Save Categories"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeArticleId} onOpenChange={() => setRemoveArticleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Article</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the article from the feed and help train the AI to avoid similar content. 
              Please provide a reason for removal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Why should this article be removed? (e.g., not relevant, duplicate, spam, low quality)"
            value={removeReason}
            onChange={(e) => setRemoveReason(e.target.value)}
            className="min-h-[80px]"
            data-testid="input-remove-reason"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRemoveReason("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveArticle}
              disabled={!removeReason.trim() || removeArticleMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-remove"
            >
              {removeArticleMutation.isPending ? "Removing..." : "Remove Article"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteArticleId} onOpenChange={() => setDeleteArticleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Article Permanently</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the article from the database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteArticle}
              disabled={deleteArticleMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteArticleMutation.isPending ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </div>
      </div>
    </div>
  );
}
