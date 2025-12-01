import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Search, Filter, Mail, Phone, Ship, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DockitAppShell from "@/components/dockit/DockitAppShell";

export default function DockitCustomers() {
  const { data: customers, isLoading } = useQuery({
    queryKey: ["/dockit/api/customers"],
    retry: false,
  });

  return (
    <DockitAppShell title="Customers" description="Manage marina customers and their boats">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search customers..." className="pl-9" data-testid="input-search-customers" />
            </div>
            <Button variant="outline" size="icon" data-testid="button-filter-customers">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
          <Button data-testid="button-add-customer">
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </div>

        {/* Customer List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Customers
            </CardTitle>
            <CardDescription>
              {isLoading ? "Loading..." : `${Array.isArray(customers) ? customers.length : 0} customers`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : !customers || (Array.isArray(customers) && customers.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No customers yet</p>
                <Button variant="link" className="mt-2" data-testid="button-add-first-customer">
                  Add your first customer
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {Array.isArray(customers) && customers.map((customer: any, index: number) => (
                  <div 
                    key={customer.id || index} 
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    data-testid={`customer-item-${index}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-medium">
                          {(customer.firstName?.[0] || '') + (customer.lastName?.[0] || '')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">
                          {customer.firstName || ''} {customer.lastName || 'Unknown'}
                        </p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {customer.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {customer.email}
                            </span>
                          )}
                          {customer.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={customer.accountStatus === 'active' ? 'default' : 'secondary'}>
                        {customer.accountStatus || 'active'}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`customer-menu-${index}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>View Boats</DropdownMenuItem>
                          <DropdownMenuItem>View Payments</DropdownMenuItem>
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
