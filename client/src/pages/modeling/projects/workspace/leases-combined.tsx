import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  Anchor,
  RefreshCw
} from 'lucide-react';
import LeaseListPage from '@/components/leases/LeaseListPage';
import RentRollDataTab from './rent-roll-data';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface LeasesCombinedProps {
  projectId: string;
  projectName?: string;
}

export default function LeasesCombined({ projectId, projectName }: LeasesCombinedProps) {
  const [activeSection, setActiveSection] = useState<'commercial' | 'storage'>('commercial');
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const handleSyncToProForma = async () => {
    setSyncing(true);
    try {
      const result = await apiRequest(`/api/commercial-leases/projects/${projectId}/sync-to-proforma`, {
        method: 'POST',
      });
      toast({ title: 'Synced', description: `${(result as any).synced} months synced to Pro Forma` });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to sync lease data', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Leases</h2>
          <p className="text-muted-foreground">
            Manage commercial tenant and storage leases for your marina property
          </p>
        </div>
      </div>

      <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as 'commercial' | 'storage')} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="commercial" className="gap-2">
            <Building2 className="h-4 w-4" />
            Commercial Tenants
          </TabsTrigger>
          <TabsTrigger value="storage" className="gap-2">
            <Anchor className="h-4 w-4" />
            Storage Leases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="commercial" className="space-y-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Commercial Tenant Leases</CardTitle>
                  <CardDescription>
                    Retail, restaurant, office, and other commercial space tenants
                  </CardDescription>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSyncToProForma}
                    disabled={syncing}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Sync to Pro Forma'}
                  </Button>
                  <Badge variant="outline">Commercial</Badge>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              <LeaseListPage projectId={projectId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="space-y-6">
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Anchor className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Storage Leases</CardTitle>
                  <CardDescription>
                    Wet slips, dry storage, boat racks, and marina storage units
                  </CardDescription>
                </div>
                <Badge variant="outline" className="ml-auto">Storage</Badge>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              <RentRollDataTab projectId={projectId} projectName={projectName} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
