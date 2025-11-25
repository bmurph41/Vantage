import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, Pencil, Trash2, TrendingUp, BarChart3, FileSpreadsheet, Settings } from 'lucide-react';
import { Link } from 'wouter';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import ModelingProjectFormDialog from './form-dialog';
import ModelingAnalytics from './analytics';

type ModelingProject = {
  id: string;
  orgId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  marinaName: string;
  city: string | null;
  state: string | null;
  region: string | null;
  purchasePrice: number | null;
  year1CapRate: number | null;
  totalStorageUnits: number | null;
  ebitda: number | null;
  dealOutcome: string;
  ddProjectId: string | null;
  salesCompId: string | null;
  rateCompId: string | null;
  propertyId: string | null;
  brokerId: string | null;
  companyId: string | null;
  customMetrics: Record<string, any> | null;
  notes: string | null;
};

export default function ModelingProjectsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<ModelingProject | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');

  const { data: projects = [], isLoading } = useQuery<ModelingProject[]>({
    queryKey: ['/api/modeling/projects'],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/modeling/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects'] });
      toast({ title: 'Success', description: 'Modeling project deleted successfully' });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete modeling project',
        variant: 'destructive',
      });
    },
  });

  const handleCreate = () => {
    setSelectedProject(null);
    setFormMode('create');
    setIsFormOpen(true);
  };

  const handleEdit = (project: ModelingProject) => {
    setSelectedProject(project);
    setFormMode('edit');
    setIsFormOpen(true);
  };

  const handleDelete = async (project: ModelingProject) => {
    if (confirm(`Are you sure you want to delete "${project.marinaName}"?`)) {
      deleteMutation.mutate(project.id);
    }
  };

  const filteredProjects = projects.filter((project) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      project.marinaName.toLowerCase().includes(searchLower) ||
      project.city?.toLowerCase().includes(searchLower) ||
      project.state?.toLowerCase().includes(searchLower) ||
      project.region?.toLowerCase().includes(searchLower)
    );
  });

  const getOutcomeBadgeColor = (outcome: string) => {
    switch (outcome) {
      case 'won':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'lost':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'passed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'active':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return `${value.toFixed(2)}%`;
  };

  const formatNumber = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US').format(value);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Modeling Projects</h1>
          <p className="text-muted-foreground mt-1">
            Track valuation and financial modeling projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/modeling/settings">
            <Button variant="outline" data-testid="button-settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </Link>
          <Button onClick={handleCreate} data-testid="button-create-project">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      <Tabs defaultValue="projects" className="space-y-6">
        <TabsList>
          <TabsTrigger value="projects" data-testid="tab-projects">
            Projects
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            <TrendingUp className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects by marina name, city, state, or region..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
                data-testid="input-search"
              />
            </div>
          </Card>

          <Card>
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading projects...</div>
            ) : filteredProjects.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {searchTerm ? 'No projects match your search.' : 'No projects yet. Create your first project to get started!'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marina Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Purchase Price</TableHead>
                      <TableHead className="text-right">Year 1 Cap Rate</TableHead>
                      <TableHead className="text-right">Size (Units)</TableHead>
                      <TableHead className="text-right">EBITDA</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map((project) => (
                      <TableRow key={project.id} data-testid={`row-project-${project.id}`}>
                        <TableCell className="font-medium" data-testid={`text-marina-name-${project.id}`}>
                          {project.marinaName}
                        </TableCell>
                        <TableCell data-testid={`text-location-${project.id}`}>
                          {[project.city, project.state].filter(Boolean).join(', ') || '-'}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-price-${project.id}`}>
                          {formatCurrency(project.purchasePrice)}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-cap-rate-${project.id}`}>
                          {formatPercent(project.year1CapRate)}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-units-${project.id}`}>
                          {formatNumber(project.totalStorageUnits)}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-ebitda-${project.id}`}>
                          {formatCurrency(project.ebitda)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getOutcomeBadgeColor(project.dealOutcome)}`}
                            data-testid={`badge-outcome-${project.id}`}
                          >
                            {project.dealOutcome.replace('_', ' ')}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLocation(`/modeling/projects/${project.id}/doc-intel`)}
                              title="Document Intelligence"
                              data-testid={`button-doc-intel-${project.id}`}
                            >
                              <FileSpreadsheet className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLocation(`/modeling/projects/${project.id}/exit`)}
                              title="Exit Strategy Suite"
                              data-testid={`button-exit-strategy-${project.id}`}
                            >
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(project)}
                              data-testid={`button-edit-${project.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(project)}
                              data-testid={`button-delete-${project.id}`}
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
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <ModelingAnalytics />
        </TabsContent>
      </Tabs>

      <ModelingProjectFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        mode={formMode}
        project={selectedProject}
      />
    </div>
  );
}
