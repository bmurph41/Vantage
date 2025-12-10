import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  Plus, 
  FileText, 
  MoreVertical, 
  Search, 
  Calendar, 
  Layout, 
  ArrowRight,
  Filter,
  Copy,
  Printer,
  Sparkles
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
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useOms, useCreateOm, useCloneOm, useDeleteOm } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { Spinner } from "@/components/ui/spinner";

export default function ProjectOms() {
  const projectId = "sunset-marina"; // In real app, this would come from route params
  const { data: oms = [], isLoading } = useOms(projectId);
  const createOmMutation = useCreateOm();
  const cloneOmMutation = useCloneOm();
  const deleteOmMutation = useDeleteOm();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  const handleCreateOM = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newOm = await createOmMutation.mutateAsync({
        projectId,
        name: "New Offering Memorandum",
        status: "draft",
        version: 1,
        settings: null,
      });
      setIsCreateOpen(false);
      toast({ title: "OM Created", description: "New offering memorandum created successfully." });
      setLocation(`/builder?id=${newOm.id}`);
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
        description: `Created version ${cloned.version} successfully.` 
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

  const handleGenerateFromAi = async () => {
    setIsAiGenerating(true);
    
    try {
      // Simulate AI generation delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const aiOm = await createOmMutation.mutateAsync({
        projectId,
        name: "AI Generated OM (Draft)",
        status: "draft",
        version: 1,
        settings: null,
      });
      
      setIsAiGenerating(false);
      toast({ title: "OM Generated", description: "AI has created a draft structure for you." });
    } catch (error) {
      setIsAiGenerating(false);
      toast({ 
        title: "Error", 
        description: "Failed to generate OM. Please try again.",
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation Header - 48px, breadcrumbs */}
      <header className="h-12 border-b border-border bg-background flex items-center px-6 justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/projects" className="hover:text-foreground transition-colors font-medium">Projects</Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-foreground font-medium">Sunset Marina</span>
        </div>
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-xs">
             AD
           </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto max-w-6xl py-8 px-6">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Offering Memorandums</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage and create investment documents for Sunset Marina.</p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* AI Generate Button */}
            <Button variant="outline" className="gap-2" onClick={handleGenerateFromAi} disabled={isAiGenerating}>
                {isAiGenerating ? <Sparkles className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isAiGenerating ? "Generating..." : "Generate with AI"}
            </Button>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                <Button className="gap-2">
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
                        <Input id="name" defaultValue="Sunset Marina – Investor OM" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="type">Type</Label>
                        <Select defaultValue="equity">
                        <SelectTrigger>
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
                            <div className="text-xs text-muted-foreground mt-1">24 Pages • Best for Investors</div>
                            </div>
                            <div className="border rounded-md p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="font-medium text-sm">Blank Canvas</div>
                            <div className="text-xs text-muted-foreground mt-1">Start from scratch</div>
                            </div>
                        </div>
                    </div>
                    </div>
                    <DialogFooter>
                    <Button type="submit">Create Document</Button>
                    </DialogFooter>
                </form>
                </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters - Search and filter controls */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search documents..." 
              className="pl-9 bg-background" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => toast({ title: "Coming Soon", description: "Filtering options will be available in a future update." })}
            data-testid="button-filter"
          >
            <Filter className="w-4 h-4" />
            Filter
          </Button>
        </div>

        {/* OM Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Spinner className="w-8 h-8" />
          </div>
        ) : oms.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No offering memorandums yet</h3>
            <p className="text-muted-foreground mb-4">Create your first OM to get started</p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create New OM
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {oms.filter(om => om.name.toLowerCase().includes(searchQuery.toLowerCase())).map((om) => (
              <Card key={om.id} className="group hover:shadow-md transition-all cursor-pointer bg-card border-border" onClick={() => setLocation(`/builder?id=${om.id}`)}>
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
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/export`); }}>
                            <Printer className="w-3 h-3 mr-2" /> Export PDF
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteOm(om.id); }}>
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
                    <span className="inline-flex items-center gap-1">
                      <Layout className="w-3 h-3" /> 0 pages
                    </span>
                    <span>•</span>
                    <span className="capitalize">{om.status}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                     <Badge variant={om.status === 'published' ? 'default' : om.status === 'review' ? 'secondary' : 'outline'} className="rounded-sm font-normal capitalize">
                        {om.status}
                     </Badge>
                     <span className="flex items-center gap-1 ml-auto">
                        <Calendar className="w-3 h-3" /> {formatDistanceToNow(new Date(om.updatedAt), { addSuffix: true })}
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
