import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Building2, 
  Ship,
  Plus,
  UserPlus,
  CheckSquare,
  Mail,
  Phone
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ContextPanelProps {
  conversation: any;
}

export function ContextPanel({ conversation }: ContextPanelProps) {
  const queryClient = useQueryClient();

  const assignMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest(`/api/opssos/inbox/conversations/${conversation.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opssos/inbox/conversations"] });
    },
  });

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="font-medium mb-3">Contact Info</h3>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{conversation.contactName || "Unknown"}</p>
                <p className="text-sm text-muted-foreground">Contact</p>
              </div>
            </div>
            {conversation.contactEmail && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span>{conversation.contactEmail}</span>
              </div>
            )}
            {conversation.contactPhone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Phone className="w-4 h-4" />
                <span>{conversation.contactPhone}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {conversation.dealId && (
        <div>
          <h3 className="font-medium mb-3">Linked Deal</h3>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">{conversation.dealName || "Deal"}</p>
                  <p className="text-sm text-muted-foreground">
                    {conversation.dealStage || "Active"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {conversation.assetId && (
        <div>
          <h3 className="font-medium mb-3">Linked Asset</h3>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Ship className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">{conversation.assetName || "Marina"}</p>
                  <p className="text-sm text-muted-foreground">Asset</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Separator />

      <div>
        <h3 className="font-medium mb-3">Assignment</h3>
        {conversation.assignedUserId ? (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <UserPlus className="w-4 h-4" />
            <span className="text-sm">Assigned to {conversation.assignedUserName || "User"}</span>
          </div>
        ) : (
          <Button variant="outline" className="w-full" size="sm">
            <UserPlus className="w-4 h-4 mr-2" />
            Assign to User
          </Button>
        )}
      </div>

      <Separator />

      <div>
        <h3 className="font-medium mb-3">Quick Actions</h3>
        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-start" size="sm">
            <CheckSquare className="w-4 h-4 mr-2" />
            Create Task
          </Button>
          <Button variant="outline" className="w-full justify-start" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add to Deal
          </Button>
        </div>
      </div>
    </div>
  );
}
