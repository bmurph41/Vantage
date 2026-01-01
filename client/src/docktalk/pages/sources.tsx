import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient } from "../lib/queryClient";
import {
  fetchRssSources,
  createRssSource,
  updateRssSource,
  deleteRssSource,
  previewRssSource,
  type RssSource,
  type PreviewArticle,
} from "../lib/api";
import { AITraining } from "../components/AITraining";
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Trash2, Edit, Plus, Eye, Rss, Globe, Settings, ExternalLink, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const rssSourceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sourceType: z.enum(["rss", "web_scrape"]).default("rss"),
  url: z.string().url("Must be a valid URL"),
  customKeywords: z.string().optional(),
});

type RssSourceFormData = z.infer<typeof rssSourceSchema>;

export default function SourcesPage() {
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

  const addForm = useForm<RssSourceFormData>({
    resolver: zodResolver(rssSourceSchema),
    defaultValues: {
      name: "",
      sourceType: "rss",
      url: "",
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

  const createMutation = useMutation({
    mutationFn: (data: RssSourceFormData) =>
      createRssSource({
        name: data.name,
        sourceType: data.sourceType,
        url: data.url,
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
        title: "Source Added",
        description: "The source has been successfully added and will start fetching articles.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add source",
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
        customKeywords: data.customKeywords
          ? data.customKeywords.split(",").map((k) => k.trim()).filter(Boolean)
          : [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docktalk/rss-sources"] });
      setIsEditDialogOpen(false);
      setEditingSource(null);
      toast({
        title: "Source Updated",
        description: "The source has been successfully updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update source",
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
        title: "Source Deleted",
        description: "The source has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete source",
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
        description: "Source status has been updated.",
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

  const handlePreview = async (formInstance: typeof addForm | typeof editForm) => {
    const url = formInstance.getValues("url");
    const sourceType = formInstance.getValues("sourceType") || "rss";
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
      customKeywords: source.customKeywords?.join(", ") || "",
    });
    setIsEditDialogOpen(true);
  };

  const activeSources = rssSources.filter(source => source.isActive);
  const inactiveSources = rssSources.filter(source => !source.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-8 w-8 text-primary" />
            Data Sources
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage RSS feeds and web pages for data scraping
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-source">
              <Plus className="h-4 w-4 mr-2" />
              Add Source
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Source</DialogTitle>
              <DialogDescription>
                Add an RSS feed or web page to monitor for marina industry news
              </DialogDescription>
            </DialogHeader>
            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={addForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Name</FormLabel>
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
                              <Rss className="h-4 w-4 text-orange-500" />
                              RSS Feed
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="web_scrape" data-testid="radio-source-type-web" />
                            </FormControl>
                            <FormLabel className="font-normal flex items-center gap-2">
                              <Globe className="h-4 w-4 text-blue-500" />
                              Web Page Scraping
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormDescription>
                        {addForm.watch("sourceType") === "rss" 
                          ? "Standard RSS/Atom feed URL" 
                          : "Web page URL to scrape for articles"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={addForm.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input 
                            placeholder={addForm.watch("sourceType") === "rss" 
                              ? "https://example.com/feed.xml" 
                              : "https://example.com/news"} 
                            {...field} 
                            data-testid="input-source-url" 
                          />
                        </FormControl>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => handlePreview(addForm)}
                          disabled={isPreviewLoading}
                          data-testid="button-preview-source"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          {isPreviewLoading ? "Loading..." : "Preview"}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {previewData && (
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Preview Results</CardTitle>
                      <CardDescription>
                        {previewData.feedTitle || "Untitled Feed"} - {previewData.itemCount} articles found
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {previewData.previewArticles.slice(0, 5).map((article, idx) => (
                          <div key={idx} className="text-sm p-2 bg-background rounded border">
                            <p className="font-medium truncate">{article.title}</p>
                            <p className="text-xs text-muted-foreground">{article.pubDate}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <FormField
                  control={addForm.control}
                  name="customKeywords"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Keywords (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="marina, boat, dock, acquisition" 
                          {...field} 
                          data-testid="input-custom-keywords" 
                        />
                      </FormControl>
                      <FormDescription>
                        Comma-separated keywords to boost relevance scoring
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-source">
                    {createMutation.isPending ? "Adding..." : "Add Source"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        <Card data-testid="card-active-sources">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-green-500" />
              Active Sources ({activeSources.length})
            </CardTitle>
            <CardDescription>
              These sources are currently being monitored for new articles
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rssSourcesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : activeSources.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Last Fetched</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeSources.map((source) => (
                    <TableRow key={source.id} data-testid={`source-row-${source.id}`}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{source.name}</span>
                          <a 
                            href={source.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
                          >
                            {source.url.substring(0, 40)}...
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={source.sourceType === "rss" ? "default" : "secondary"}>
                          {source.sourceType === "rss" ? (
                            <><Rss className="h-3 w-3 mr-1" /> RSS</>
                          ) : (
                            <><Globe className="h-3 w-3 mr-1" /> Web</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {source.lastFetchedAt 
                          ? formatDistanceToNow(new Date(source.lastFetchedAt)) + " ago"
                          : "Never"}
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
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(source)}
                            data-testid={`button-edit-${source.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteSourceId(source.id)}
                            data-testid={`button-delete-${source.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Rss className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active sources yet.</p>
                <p className="text-sm">Add an RSS feed or web page to start monitoring for articles.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {inactiveSources.length > 0 && (
          <Card data-testid="card-inactive-sources">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-muted-foreground">
                Inactive Sources ({inactiveSources.length})
              </CardTitle>
              <CardDescription>
                These sources are paused and not being monitored
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inactiveSources.map((source) => (
                    <TableRow key={source.id} className="opacity-60" data-testid={`source-row-${source.id}`}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{source.name}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-xs">
                            {source.url}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {source.sourceType === "rss" ? "RSS" : "Web"}
                        </Badge>
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
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(source)}
                            data-testid={`button-edit-${source.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteSourceId(source.id)}
                            data-testid={`button-delete-${source.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <AITraining />

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Source</DialogTitle>
            <DialogDescription>
              Update the source settings
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => 
              editingSource && updateMutation.mutate({ id: editingSource.id, data })
            )} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source Name</FormLabel>
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
                  <FormItem className="space-y-3">
                    <FormLabel>Source Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="rss" />
                          </FormControl>
                          <FormLabel className="font-normal flex items-center gap-2">
                            <Rss className="h-4 w-4 text-orange-500" />
                            RSS Feed
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="web_scrape" />
                          </FormControl>
                          <FormLabel className="font-normal flex items-center gap-2">
                            <Globe className="h-4 w-4 text-blue-500" />
                            Web Page Scraping
                          </FormLabel>
                        </FormItem>
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
                    <FormLabel>URL</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input {...field} data-testid="input-edit-source-url" />
                      </FormControl>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => handlePreview(editForm)}
                        disabled={isPreviewLoading}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="customKeywords"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Keywords</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-keywords" />
                    </FormControl>
                    <FormDescription>Comma-separated keywords</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-source">
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteSourceId} onOpenChange={() => setDeleteSourceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Source</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this source? This will not delete any articles that have already been fetched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSourceId && deleteMutation.mutate(deleteSourceId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
