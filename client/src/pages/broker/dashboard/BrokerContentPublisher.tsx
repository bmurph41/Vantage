import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import BrokerDashboardLayout from "./BrokerDashboardLayout";
import {
  useBrokerContent,
  useCreateContent,
  useUpdateContent,
  usePublishContent,
  useUnpublishContent,
  useDeleteContent,
  type AdvisoryContentItem,
} from "@/hooks/use-broker-dashboard";

interface ContentForm {
  title: string;
  excerpt: string;
  body: string;
  contentType: string;
  visibility: string;
  teaserExcerpt: string;
}

const EMPTY: ContentForm = {
  title: "",
  excerpt: "",
  body: "",
  contentType: "note",
  visibility: "advisory_only",
  teaserExcerpt: "",
};

export default function BrokerContentPublisher() {
  const { toast } = useToast();
  const { data, isLoading } = useBrokerContent();
  const createMut = useCreateContent();
  const updateMut = useUpdateContent();
  const publishMut = usePublishContent();
  const unpublishMut = useUnpublishContent();
  const deleteMut = useDeleteContent();

  const [editing, setEditing] = useState<AdvisoryContentItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ContentForm>(EMPTY);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (c: AdvisoryContentItem) => {
    setEditing(c);
    setForm({
      title: c.title || "",
      excerpt: c.excerpt || "",
      body: c.body || "",
      contentType: c.contentType || "note",
      visibility: c.visibility || "advisory_only",
      teaserExcerpt: c.teaserExcerpt || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, data: form });
        toast({ title: "Content updated" });
      } else {
        await createMut.mutateAsync(form);
        toast({ title: "Content created" });
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "", variant: "destructive" });
    }
  };

  const handlePublishToggle = async (c: AdvisoryContentItem) => {
    try {
      if (c.publishedAt) {
        await unpublishMut.mutateAsync(c.id);
        toast({ title: "Unpublished" });
      } else {
        await publishMut.mutateAsync(c.id);
        toast({ title: "Published" });
      }
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message || "", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this content item permanently?")) return;
    try {
      await deleteMut.mutateAsync(id);
      toast({ title: "Deleted" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message || "", variant: "destructive" });
    }
  };

  const showTeaser = form.visibility === "public_teaser" || form.visibility === "advisory_only";

  return (
    <BrokerDashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Content</h1>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            New Content
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !data?.items.length ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No content yet. Create your first post.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.items.map((c) => (
              <Card key={c.id}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{c.title}</CardTitle>
                    <div className="text-xs text-muted-foreground mt-1 flex gap-2">
                      <Badge variant="outline">{c.contentType}</Badge>
                      <Badge variant="outline">{c.visibility}</Badge>
                      {c.publishedAt ? (
                        <Badge>Published</Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handlePublishToggle(c)}>
                      {c.publishedAt ? "Unpublish" : "Publish"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)}>
                      Delete
                    </Button>
                  </div>
                </CardHeader>
                {c.excerpt && (
                  <CardContent className="text-sm text-muted-foreground">{c.excerpt}</CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Content" : "New Content"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Excerpt</Label>
              <Textarea
                rows={2}
                value={form.excerpt}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              />
            </div>
            <div>
              <Label>Body (Markdown)</Label>
              <Textarea
                rows={10}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Content Type</Label>
                <Select
                  value={form.contentType}
                  onValueChange={(v) => setForm({ ...form, contentType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">Note</SelectItem>
                    <SelectItem value="market_update">Market Update</SelectItem>
                    <SelectItem value="report">Report</SelectItem>
                    <SelectItem value="listing_spotlight">Listing Spotlight</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Visibility</Label>
                <Select
                  value={form.visibility}
                  onValueChange={(v) => setForm({ ...form, visibility: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="public_teaser">Public Teaser</SelectItem>
                    <SelectItem value="advisory_only">Advisory Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {showTeaser && (
              <div>
                <Label>Teaser Excerpt</Label>
                <Textarea
                  rows={3}
                  value={form.teaserExcerpt}
                  onChange={(e) => setForm({ ...form, teaserExcerpt: e.target.value })}
                  placeholder="Shown to non-subscribers"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BrokerDashboardLayout>
  );
}
