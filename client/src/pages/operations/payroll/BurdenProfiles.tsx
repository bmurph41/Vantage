import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBurdenProfiles } from "@/hooks/use-payroll";
import { Calculator, CheckCircle2 } from "lucide-react";

export default function BurdenProfiles() {
  const { data: profiles, isLoading } = useBurdenProfiles();

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
      <div>
        <h2 className="text-lg font-semibold">Burden Profiles</h2>
        <p className="text-sm text-muted-foreground">
          Define benefit rates, payroll taxes, workers' comp, and other burden costs applied on top of base pay
        </p>
      </div>

      {/* Profiles */}
      {!profiles || profiles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="p-4 rounded-full bg-primary/10">
              <Calculator className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">No Burden Profiles</h3>
              <p className="text-sm text-muted-foreground">
                Burden profiles will appear here once created. Run the seed script to get marina defaults.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {profiles.map((profile: any) => (
            <Card key={profile.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{profile.name}</CardTitle>
                    <CardDescription className="capitalize">
                      {profile.mode?.toLowerCase() || "simple"} mode
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {profile.isDefault && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Default
                      </Badge>
                    )}
                    <Badge variant="outline">
                      {(
                        (profile.benefitsPct || 0) +
                        (profile.taxesPct || 0) +
                        (profile.workersCompPct || 0) +
                        (profile.otherBurdenPct || 0)
                      ).toFixed(1)}
                      % total
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">On $50K Salary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Benefits (Health, Dental, Vision)</TableCell>
                      <TableCell className="text-right font-mono">
                        {(profile.benefitsPct || 0).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        ${((profile.benefitsPct || 0) * 500).toLocaleString()}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Payroll Taxes (FICA, FUTA, SUTA)</TableCell>
                      <TableCell className="text-right font-mono">
                        {(profile.taxesPct || 0).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        ${((profile.taxesPct || 0) * 500).toLocaleString()}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Workers' Compensation</TableCell>
                      <TableCell className="text-right font-mono">
                        {(profile.workersCompPct || 0).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        ${((profile.workersCompPct || 0) * 500).toLocaleString()}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Other Burden</TableCell>
                      <TableCell className="text-right font-mono">
                        {(profile.otherBurdenPct || 0).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        ${((profile.otherBurdenPct || 0) * 500).toLocaleString()}
                      </TableCell>
                    </TableRow>
                    <TableRow className="font-semibold border-t-2">
                      <TableCell>Total Burden</TableCell>
                      <TableCell className="text-right font-mono">
                        {(
                          (profile.benefitsPct || 0) +
                          (profile.taxesPct || 0) +
                          (profile.workersCompPct || 0) +
                          (profile.otherBurdenPct || 0)
                        ).toFixed(2)}
                        %
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        $
                        {(
                          ((profile.benefitsPct || 0) +
                            (profile.taxesPct || 0) +
                            (profile.workersCompPct || 0) +
                            (profile.otherBurdenPct || 0)) *
                          500
                        ).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                  Example: A $50,000 salary with this burden profile results in{" "}
                  <span className="font-semibold text-foreground">
                    $
                    {(
                      50000 *
                      (1 +
                        ((profile.benefitsPct || 0) +
                          (profile.taxesPct || 0) +
                          (profile.workersCompPct || 0) +
                          (profile.otherBurdenPct || 0)) /
                          100)
                    ).toLocaleString()}{" "}
                    total loaded cost
                  </span>
                  .
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
