import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { 
  Plus, 
  FileText, 
  MoreVertical, 
  Search, 
  Calendar, 
  Layout, 
  ArrowRight,
  Copy,
  Printer,
  Sparkles,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import type { Om } from "@shared/schema";

export default function ProjectOms() {
  const [, params] = useRoute("/om/projects/:projectId");
  const projectId = params?.projectId || "default-project";
  const queryClient = useQueryClient();
  
  const { data: oms = [], isLoading } = useQuery<Om[]>({
    queryKey: ['/api/om/oms/project', projectId],
  });
  
  const createOmMutation = useMutation({
    mutationFn: (data: { projectId: string; name: string; status: string }) =>
      apiRequest('/api/om/oms', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om/oms/project', projectId] });
    },
  });

  const cloneOmMutation = useMutation({
    mutationFn: (omId: string) =>
      apiRequest(`/api/om/oms/${omId}/clone`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om/oms/project', projectId] });
    },
  });

  const deleteOmMutation = useMutation({
    mutationFn: (omId: string) =>
      apiRequest(`/api/om/oms/${omId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om/oms/project', projectId] });
    },
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newOmName, setNewOmName] = useState("New Offering Memorandum");

  const handleCreateOM = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newOm = await createOmMutation.mutateAsync({
        projectId,
        name: newOmName,
        status: "draft",
      });
      setIsCreateOpen(false);
      toast({ title: "OM Created", description: "New offering memorandum created successfully." });
      setLocation(`/om/builder/${newOm.id}`);
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to create OM. Please try again.",
        variant: "destructive" 
      });
    }
  };

  const handleCloneOm = async (omId: string) => {
    try {
      const cloned = await cloneOmMutation.mutateAsync(omId);
      toast({ 
        title: "OM Cloned", 
        description: `Created new version successfully.` 
      });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to clone OM. Please try again.",
        variant: "destructive" 
      });
    }
  };

  const handleDeleteOm = async (omId: string) => {
    try {
      await deleteOmMutation.mutateAsync(omId);
      toast({ title: "OM Deleted", description: "Document deleted successfully." });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to delete OM. Please try again.",
        variant: "destructive" 
      });
    }
  };

  const filteredOms = oms.filter(om => 
    om.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full bg-background flex flex-col">
      <main className="flex-1 container mx-auto max-w-6xl py-8 px-6 overflow-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground" data-testid="text-page-title">
              Offering Memorandums
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create and manage professional investment memorandums.
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" data-testid="button-create-om">
                  <Plus className="w-4 h-4" />
                  Create New OM
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleCreateOM}>
                  <DialogHeader>
                    <DialogTitle>Create New OM</DialogTitle>
                    <DialogDescription>
                      Start a new offering memorandum from scratch or a template.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Document Name</Label>
                      <Input 
                        id="name" 
                        value={newOmName}
                        onChange={(e) => setNewOmName(e.target.value)}
                        data-testid="input-om-name"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="type">Type</Label>
                      <Select defaultValue="equity">
                        <SelectTrigger data-testid="select-om-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="equity">Equity Offering</SelectItem>
                          <SelectItem value="debt">Debt Package</SelectItem>
                          <SelectItem value="market">Market Report</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Starting Template</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="border rounded-md p-3 cursor-pointer bg-primary/5 border-primary ring-1 ring-primary/20">
                          <div className="font-medium text-sm">Standard OM</div>
                          <div className="text-xs text-muted-foreground mt-1">Best for Investors</div>
                        </div>
                        <div className="border rounded-md p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="font-medium text-sm">Blank Canvas</div>
                          <div className="text-xs text-muted-foreground mt-1">Start from scratch</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createOmMutation.isPending} data-testid="button-submit-create">
                      {createOmMutation.isPending ? "Creating..." : "Create Document"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search documents..." 
              className="pl-9 bg-background" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filteredOms.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No offering memorandums yet</h3>
            <p className="text-muted-foreground mb-4">Create your first OM to get started</p>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-first-om">
              <Plus className="w-4 h-4 mr-2" />
              Create New OM
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOms.map((om) => (
              <Card 
                key={om.id} 
                className="group hover:shadow-md transition-all cursor-pointer bg-card border-border" 
                onClick={() => setLocation(`/om/builder/${om.id}`)}
                data-testid={`card-om-${om.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="p-2 bg-primary/10 rounded-md text-primary mb-2">
                      <FileText className="w-5 h-5" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCloneOm(om.id); }}>
                          <Copy className="w-3 h-3 mr-2" /> Clone / Version
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/om/export/${om.id}`); }}>
                          <Printer className="w-3 h-3 mr-2" /> Export PDF
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive" 
                          onClick={(e) => { e.stopPropagation(); handleDeleteOm(om.id); }}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardTitle className="text-base font-semibold leading-tight group-hover:text-primary transition-colors flex items-center justify-between">
                    {om.name}
                    {om.version > 1 && <Badge variant="secondary" className="text-[10px] h-5 px-1.5">v{om.version}</Badge>}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <span className="capitalize">{om.status}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge 
                      variant={om.status === 'published' ? 'default' : om.status === 'review' ? 'secondary' : 'outline'} 
                      className="rounded-sm font-normal capitalize"
                    >
                      {om.status}
                    </Badge>
                    <span className="flex items-center gap-1 ml-auto">
                      <Calendar className="w-3 h-3" /> 
                      {formatDistanceToNow(new Date(om.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="pt-3 border-t bg-muted/5 group-hover:bg-muted/10 transition-colors">
                  <div className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground group-hover:text-foreground">
                    <span>v{om.version}</span>
                    <span className="flex items-center gap-1">
                      Open Builder <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
