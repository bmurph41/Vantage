import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, RefreshCw, Mail, Phone, Building2, Shield } from "lucide-react";

interface Props { dealId: string; }

export default function UnifiedDealTeam({ dealId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: teamData, isLoading } = useQuery<any>({
    queryKey: ["/api/dd-enhanced/team", dealId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/dd-enhanced/team/${dealId}`);
      return res.json();
    },
  });

  const syncTeam = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/dd-enhanced/team/${dealId}/sync`, { direction: "both" });
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/dd-enhanced/team"] });
      toast({ title: "Team synced", description: `${data.synced} members synchronized` });
    },
  });

  if (isLoading) return <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;

  const team = teamData?.team || [];
  const byType = teamData?.byTeamType || {};
  const typeOrder = ["owner_admin", "internal_member", "buyer", "seller", "broker", "lender", "attorney", "accountant", "consultant", "viewer"];

  const roleColor = (role: string) => {
    switch (role) {
      case "owner_admin": return "bg-purple-100 text-purple-800";
      case "buyer": return "bg-green-100 text-green-800";
      case "seller": return "bg-blue-100 text-blue-800";
      case "broker": return "bg-orange-100 text-orange-800";
      case "lender": return "bg-cyan-100 text-cyan-800";
      case "attorney": return "bg-rose-100 text-rose-800";
      default: return "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" />
          Deal Team ({teamData?.totalMembers || 0})
        </h3>
        <Button size="sm" variant="outline" onClick={() => syncTeam.mutate()} disabled={syncTeam.isPending}>
          <RefreshCw className={`h-3 w-3 mr-1 ${syncTeam.isPending ? "animate-spin" : ""}`} />
          Sync
        </Button>
      </div>

      {/* Source summary */}
      <div className="flex gap-2 text-sm">
        <Badge variant="outline">{teamData?.inWorkspace || 0} in workspace</Badge>
        <Badge variant="outline">{teamData?.inDealContacts || 0} deal contacts</Badge>
      </div>

      {/* Team grouped by type */}
      {typeOrder.map((type) => {
        const members = byType[type];
        if (!members || members.length === 0) return null;

        return (
          <Card key={type}>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Badge className={roleColor(type)}>{type.replace(/_/g, " ")}</Badge>
                <span className="text-muted-foreground font-normal">{members.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-3">
              {members.map((member: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{member.name || member.email || "Unknown"}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {member.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{member.email}</span>}
                      {member.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{member.phone}</span>}
                      {member.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{member.company}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {member.inWorkspace && (
                      <Badge variant="secondary" className="text-[10px]">
                        <Shield className="h-2.5 w-2.5 mr-0.5" />
                        {member.vdrPermission || "—"}
                      </Badge>
                    )}
                    {member.isPrimary && <Badge className="text-[10px]">Primary</Badge>}
                    {!member.inWorkspace && member.inDealContacts && (
                      <Badge variant="outline" className="text-[10px]">CRM only</Badge>
                    )}
                    {member.inviteStatus === "pending" && (
                      <Badge variant="outline" className="text-[10px] text-amber-600">Pending</Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {team.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No team members found. Add contacts to the deal or invite workspace members.</p>
      )}
    </div>
  );
}
