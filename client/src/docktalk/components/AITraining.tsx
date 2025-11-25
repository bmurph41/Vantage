import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient as dockTalkQueryClient } from "../lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Tags, 
  Plus, 
  Edit, 
  Trash2, 
  Brain, 
  ThumbsDown, 
  Copy, 
  AlertTriangle,
  Sparkles,
  MoreHorizontal,
  ThumbsUp
} from "lucide-react";

interface UserTag {
  id: number;
  userId: string;
  orgId: string;
  name: string;
  description: string | null;
  color: string;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface FeedbackStats {
  totalFeedback: number;
  irrelevantCount: number;
  duplicateCount: number;
  lowQualityCount: number;
  helpfulCount: number;
}

const tagFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name too long"),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
});

type TagFormData = z.infer<typeof tagFormSchema>;

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

export function AITraining() {
  const { toast } = useToast();
  const [isAddTagOpen, setIsAddTagOpen] = useState(false);
  const [isEditTagOpen, setIsEditTagOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<UserTag | null>(null);
  const [deleteTagId, setDeleteTagId] = useState<number | null>(null);

  const form = useForm<TagFormData>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: {
      name: "",
      description: "",
      color: "#6366f1",
    },
  });

  const editForm = useForm<TagFormData>({
    resolver: zodResolver(tagFormSchema),
  });

  const { data: tags = [], isLoading: tagsLoading } = useQuery<UserTag[]>({
    queryKey: ["/api/docktalk/tags"],
  });

  const { data: feedbackStats } = useQuery<FeedbackStats>({
    queryKey: ["/api/docktalk/feedback/stats"],
  });

  const createTagMutation = useMutation({
    mutationFn: async (data: TagFormData) => {
      const res = await fetch("/api/docktalk/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create tag");
      }
      return res.json();
    },
    onSuccess: () => {
      dockTalkQueryClient.invalidateQueries({ queryKey: ["/api/docktalk/tags"] });
      setIsAddTagOpen(false);
      form.reset();
      toast({
        title: "Tag Created",
        description: "Your tag has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create tag",
        variant: "destructive",
      });
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<TagFormData> }) => {
      const res = await fetch(`/api/docktalk/tags/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update tag");
      }
      return res.json();
    },
    onSuccess: () => {
      dockTalkQueryClient.invalidateQueries({ queryKey: ["/api/docktalk/tags"] });
      setIsEditTagOpen(false);
      setEditingTag(null);
      toast({
        title: "Tag Updated",
        description: "Your tag has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update tag",
        variant: "destructive",
      });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/docktalk/tags/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete tag");
      }
      return res.json();
    },
    onSuccess: () => {
      dockTalkQueryClient.invalidateQueries({ queryKey: ["/api/docktalk/tags"] });
      setDeleteTagId(null);
      toast({
        title: "Tag Deleted",
        description: "Your tag has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete tag",
        variant: "destructive",
      });
    },
  });

  const handleEditTag = (tag: UserTag) => {
    setEditingTag(tag);
    editForm.reset({
      name: tag.name,
      description: tag.description || "",
      color: tag.color,
    });
    setIsEditTagOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card data-testid="card-ai-training">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            AI Training
          </CardTitle>
          <CardDescription>
            Help train DockTalk's AI by tagging articles and providing feedback. Your input improves content relevance for everyone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Tags className="h-4 w-4" />
                  Your Tag Library ({tags.length}/20)
                </CardTitle>
                <CardDescription className="text-xs">
                  Create custom tags to organize and train the AI on content categories
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tagsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-3/4" />
                  </div>
                ) : tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {tags.map((tag) => (
                      <div key={tag.id} className="group relative">
                        <Badge
                          style={{ backgroundColor: tag.color }}
                          className="text-white pr-8 cursor-default"
                          data-testid={`tag-${tag.id}`}
                        >
                          {tag.name}
                          {tag.usageCount > 0 && (
                            <span className="ml-1 opacity-75">({tag.usageCount})</span>
                          )}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              data-testid={`tag-menu-${tag.id}`}
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditTag(tag)}>
                              <Edit className="h-3 w-3 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteTagId(tag.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-3 w-3 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    <Tags className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No tags yet</p>
                    <p className="text-xs">Create tags to organize articles</p>
                  </div>
                )}

                <Dialog open={isAddTagOpen} onOpenChange={setIsAddTagOpen}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={tags.length >= 20}
                      data-testid="button-add-tag"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Tag
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Tag</DialogTitle>
                      <DialogDescription>
                        Create a custom tag to categorize articles
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit((data) => createTagMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tag Name</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., M&A Deals" {...field} data-testid="input-tag-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description (Optional)</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Brief description of what this tag covers" 
                                  {...field} 
                                  data-testid="input-tag-description"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="color"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Color</FormLabel>
                              <FormControl>
                                <div className="flex gap-2 flex-wrap">
                                  {PRESET_COLORS.map((color) => (
                                    <button
                                      key={color}
                                      type="button"
                                      className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                                        field.value === color ? "border-foreground scale-110" : "border-transparent"
                                      }`}
                                      style={{ backgroundColor: color }}
                                      onClick={() => field.onChange(color)}
                                      data-testid={`color-${color}`}
                                    />
                                  ))}
                                </div>
                              </FormControl>
                              <FormDescription>
                                Selected: <span style={{ color: field.value }}>{field.value}</span>
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setIsAddTagOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createTagMutation.isPending} data-testid="button-create-tag">
                            {createTagMutation.isPending ? "Creating..." : "Create Tag"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Your AI Training Stats
                </CardTitle>
                <CardDescription className="text-xs">
                  Your contributions help improve content relevance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-purple-600">
                      {feedbackStats?.totalFeedback || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Total Feedback</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-green-600">
                      {feedbackStats?.helpfulCount || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Helpful Articles</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-orange-600">
                      {feedbackStats?.irrelevantCount || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Marked Irrelevant</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-blue-600">
                      {feedbackStats?.duplicateCount || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Duplicates Found</div>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-start gap-2">
                    <Brain className="h-4 w-4 mt-0.5 text-primary" />
                    <div className="text-xs">
                      <p className="font-medium text-primary">How to Train the AI</p>
                      <p className="text-muted-foreground mt-1">
                        When viewing articles, use the feedback buttons to:
                      </p>
                      <ul className="mt-1 space-y-0.5 text-muted-foreground">
                        <li className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3 text-green-500" /> Mark helpful content
                        </li>
                        <li className="flex items-center gap-1">
                          <ThumbsDown className="h-3 w-3 text-orange-500" /> Flag irrelevant articles
                        </li>
                        <li className="flex items-center gap-1">
                          <Copy className="h-3 w-3 text-blue-500" /> Report duplicates
                        </li>
                        <li className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-yellow-500" /> Flag low-quality content
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditTagOpen} onOpenChange={setIsEditTagOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>
              Update your tag settings
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => 
              editingTag && updateTagMutation.mutate({ id: editingTag.id, data })
            )} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tag Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-tag-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-edit-tag-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <div className="flex gap-2 flex-wrap">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                              field.value === color ? "border-foreground scale-110" : "border-transparent"
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => field.onChange(color)}
                          />
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditTagOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateTagMutation.isPending} data-testid="button-update-tag">
                  {updateTagMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTagId} onOpenChange={() => setDeleteTagId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this tag? This will remove it from all articles you've tagged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTagId && deleteTagMutation.mutate(deleteTagId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-tag"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
