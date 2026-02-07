import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  usePermissionGrants,
  useCreateGrant,
  useDeleteGrant,
} from "@/hooks/use-payroll";
import { Shield, Plus, Trash2, Eye, Edit, Lock, Info } from "lucide-react";

const PERMISSION_LEVELS = [
  { value: "VIEW", label: "View Only", icon: Eye, description: "Can see payroll data" },
  { value: "EDIT", label: "Edit", icon: Edit, description: "Can modify payroll plans" },
  { value: "ADMIN", label: "Admin", icon: Lock, description: "Full control including permissions" },
];

const DETAIL_LEVELS = [
  { value: "TOTALS_ONLY", label: "Totals Only" },
  { value: "DEPT_TOTALS", label: "Department Totals" },
  { value: "POSITION_LINES", label: "Position Lines" },
  { value: "EMPLOYEE_DETAIL", label: "Employee Detail" },
];

const SCOPE_TYPES = [
  { value: "ORG", label: "Organization" },
  { value: "PORTFOLIO", label: "Portfolio" },
  { value: "ASSET", label: "Asset" },
  { value: "VALUATION_MODEL", label: "Valuation Model" },
];

export default function Permissions() {
  const { data: grants, isLoading } = usePermissionGrants({});
  const createGrant = useCreateGrant();
  const deleteGrant = useDeleteGrant();

  const getPermBadgeVariant = (level: string) => {
    switch (level) {
      case "ADMIN":
        return "destructive" as const;
      case "EDIT":
        return "default" as const;
      default:
        return "secondary" as const;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Payroll Permissions</h2>
          <p className="text-sm text-muted-foreground">
            Control who can view and edit payroll data, including sensitive fields like
            employee names and compensation rates
          </p>
        </div>
      </div>

      {/* Permission Level Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PERMISSION_LEVELS.map((level) => {
          const Icon = level.icon;
          return (
            <Card key={level.value} className="border-dashed">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{level.label}</p>
                    <p className="text-xs text-muted-foreground">{level.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detail Level Explanation */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Detail Level Controls</p>
              <p className="text-xs text-muted-foreground">
                Each permission grant has a "detail level" that limits how much data the user sees:
                <span className="font-medium"> Totals Only</span> shows just grand totals,
                <span className="font-medium"> Dept Totals</span> adds department breakdown,
                <span className="font-medium"> Position Lines</span> shows individual line items, and
                <span className="font-medium"> Employee Detail</span> includes names and individual comp.
                Additional toggles can hide specific fields like employee names, compensation rates, bonus details, and export access.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Grants */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Active Permission Grants</CardTitle>
              <CardDescription>
                {grants?.length || 0} grant{(grants?.length || 0) !== 1 ? "s" : ""} configured
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!grants || grants.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Shield className="h-10 w-10 mx-auto text-muted-foreground" />
              <div className="space-y-1">
                <p className="font-medium">No Permission Grants</p>
                <p className="text-sm text-muted-foreground">
                  Only org owners and admins can currently access payroll data.
                  Create grants to give other team members access.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Permission</TableHead>
                  <TableHead>Detail Level</TableHead>
                  <TableHead>Field Controls</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grants.map((grant: any) => (
                  <TableRow key={grant.id}>
                    <TableCell className="font-medium">
                      {grant.userId}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {grant.scopeType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPermBadgeVariant(grant.permissionLevel)}>
                        {grant.permissionLevel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">
                        {grant.detailLevelMax?.replace(/_/g, " ") || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {grant.canViewEmployeeNames && (
                          <Badge variant="outline" className="text-xs">Names</Badge>
                        )}
                        {grant.canViewCompRates && (
                          <Badge variant="outline" className="text-xs">Comp</Badge>
                        )}
                        {grant.canViewBonusDetail && (
                          <Badge variant="outline" className="text-xs">Bonus</Badge>
                        )}
                        {grant.canExport && (
                          <Badge variant="outline" className="text-xs">Export</Badge>
                        )}
                        {!grant.canViewEmployeeNames &&
                          !grant.canViewCompRates &&
                          !grant.canViewBonusDetail &&
                          !grant.canExport && (
                            <span className="text-xs text-muted-foreground">Restricted</span>
                          )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Remove this permission grant?")) {
                            deleteGrant.mutate(grant.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
