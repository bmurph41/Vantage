import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  Plus, 
  FileText, 
  MoreVertical, 
  Search, 
  ArrowLeft,
  Copy,
  Trash2,
  Layout,
  Download,
  Filter
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import type { OmTemplate } from "@shared/schema";

export default function OMTemplates() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<string>("all");

  const { data: templates = [], isLoading } = useQuery<OmTemplate[]>({
    queryKey: ['/api/om/templates'],
  });

  const seedTemplatesMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/om/seed-templates'),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/om/templates'] });
      toast({ 
        title: "Templates Seeded", 
        description: result?.message || "System templates have been loaded." 
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/om/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om/templates'] });
      toast({ title: "Template Deleted", description: "Template has been removed." });
    },
  });

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || t.category === categoryFilter;
    const matchesScope = scopeFilter === "all" || t.scope === scopeFilter;
    return matchesSearch && matchesCategory && matchesScope;
  });

  const categoryLabels: Record<string, string> = {
    om: "Offering Memorandum",
    ic_memo: "IC Memo",
    executive_summary: "Executive Summary",
    page: "Page Template",
    block: "Block Template",
  };

  const scopeLabels: Record<string, string> = {
    system: "System",
    organization: "Organization",
    user: "Personal",
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case "om": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "ic_memo": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "executive_summary": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "page": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      case "block": return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
      default: return "";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="border-b bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/om">
                <Button variant="ghost" size="sm" data-testid="link-back-om">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Document Templates</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Manage templates for OMs, IC Memos, and other documents
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => seedTemplatesMutation.mutate()}
                disabled={seedTemplatesMutation.isPending}
                data-testid="button-seed-templates"
              >
                <Download className="h-4 w-4 mr-2" />
                Load System Templates
              </Button>
              <Button data-testid="button-create-template">
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-templates"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48" data-testid="select-category-filter">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="om">Offering Memorandum</SelectItem>
              <SelectItem value="ic_memo">IC Memo</SelectItem>
              <SelectItem value="executive_summary">Executive Summary</SelectItem>
              <SelectItem value="page">Page Templates</SelectItem>
              <SelectItem value="block">Block Templates</SelectItem>
            </SelectContent>
          </Select>
          <Select value={scopeFilter} onValueChange={setScopeFilter}>
            <SelectTrigger className="w-40" data-testid="select-scope-filter">
              <SelectValue placeholder="All Scopes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Scopes</SelectItem>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="organization">Organization</SelectItem>
              <SelectItem value="user">Personal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-100 rounded w-1/2 mt-2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-gray-100 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Layout className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No templates found
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {searchQuery || categoryFilter !== "all" || scopeFilter !== "all"
                  ? "Try adjusting your filters or search query"
                  : "Get started by loading system templates or creating your own"}
              </p>
              {!searchQuery && categoryFilter === "all" && scopeFilter === "all" && (
                <Button
                  variant="outline"
                  onClick={() => seedTemplatesMutation.mutate()}
                  disabled={seedTemplatesMutation.isPending}
                  data-testid="button-seed-templates-empty"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Load System Templates
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <Card 
                key={template.id} 
                className="hover:shadow-lg transition-shadow"
                data-testid={`card-template-${template.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-template-actions-${template.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem data-testid={`menu-use-template-${template.id}`}>
                          <Layout className="h-4 w-4 mr-2" />
                          Use Template
                        </DropdownMenuItem>
                        <DropdownMenuItem data-testid={`menu-copy-template-${template.id}`}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        {template.scope !== "system" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => deleteTemplateMutation.mutate(template.id)}
                              data-testid={`menu-delete-template-${template.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Badge 
                      variant="secondary" 
                      className={getCategoryBadgeColor(template.category || "")}
                    >
                      {categoryLabels[template.category || ""] || template.category}
                    </Badge>
                    <Badge variant="outline">
                      {scopeLabels[template.scope || ""] || template.scope}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                    {template.content?.settings?.description || 
                      `${(template.content?.pages?.length || 0)} pages, ready to use`}
                  </p>
                </CardContent>
                <CardFooter className="text-xs text-gray-400">
                  Created {formatDistanceToNow(new Date(template.createdAt))} ago
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
