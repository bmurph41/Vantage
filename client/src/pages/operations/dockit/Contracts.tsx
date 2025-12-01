import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Search, Filter, MoreHorizontal, Send, CheckCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DockitAppShell from "@/components/dockit/DockitAppShell";

export default function DockitContracts() {
  const { data: contracts, isLoading } = useQuery({
    queryKey: ["/dockit/api/contracts"],
    retry: false,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'signed':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Signed</Badge>;
      case 'sent':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Sent</Badge>;
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DockitAppShell title="Contracts" description="Manage slip agreements and service contracts">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search contracts..." className="pl-9" data-testid="input-search-contracts" />
            </div>
            <Button variant="outline" size="icon" data-testid="button-filter-contracts">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
          <Button data-testid="button-create-contract">
            <Plus className="h-4 w-4 mr-2" />
            Create Contract
          </Button>
        </div>

        {/* Contract Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Signed</p>
                  <p className="text-xl font-bold">0</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Send className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Awaiting Signature</p>
                  <p className="text-xl font-bold">0</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <FileText className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Drafts</p>
                  <p className="text-xl font-bold">0</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <FileText className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expired</p>
                  <p className="text-xl font-bold">0</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contracts List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              All Contracts
            </CardTitle>
            <CardDescription>
              {isLoading ? "Loading..." : `${Array.isArray(contracts) ? contracts.length : 0} contracts`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : !contracts || (Array.isArray(contracts) && contracts.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No contracts yet</p>
                <Button variant="link" className="mt-2" data-testid="button-create-first-contract">
                  Create your first contract
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {Array.isArray(contracts) && contracts.map((contract: any, index: number) => (
                  <div 
                    key={contract.id || index} 
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    data-testid={`contract-item-${index}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <FileText className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium">{contract.title || 'Untitled Contract'}</p>
                        <p className="text-sm text-muted-foreground">
                          {contract.customerName || 'Unknown Customer'} • {contract.type || 'Slip Agreement'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(contract.status || 'draft')}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Contract</DropdownMenuItem>
                          <DropdownMenuItem>Send for Signature</DropdownMenuItem>
                          <DropdownMenuItem>Download PDF</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DockitAppShell>
  );
}
