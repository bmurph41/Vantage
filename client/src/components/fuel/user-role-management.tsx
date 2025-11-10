import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Users, Shield, CheckCircle2, XCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type UserRole = "owner" | "admin" | "editor" | "viewer" | "auditor";

type OrganizationUser = {
  id: string;
  email: string;
  username: string;
  currentRole: UserRole | null;
  isActive: boolean;
};

const ROLE_DESCRIPTIONS = {
  owner: "Full access to all features including role management and sensitive operations",
  admin: "Full access except cannot manage other admins or owners",
  editor: "Can create, read, update fuel data. Cannot delete or export",
  viewer: "Read-only access to all fuel data and reports",
  auditor: "Read-only access with special audit trail viewing permissions"
};

const ROLE_BADGES: Record<UserRole, { variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  owner: { variant: "destructive", color: "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400" },
  admin: { variant: "default", color: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" },
  editor: { variant: "secondary", color: "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400" },
  viewer: { variant: "outline", color: "bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400" },
  auditor: { variant: "outline", color: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400" },
};

export default function UserRoleManagement() {
  const { toast } = useToast();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  const { data: users = [], isLoading } = useQuery<OrganizationUser[]>({
    queryKey: ["/api/operations/fuel/users"],
  });

  const { data: currentUser } = useQuery<{ id: string; role: UserRole }>({
    queryKey: ["/api/auth/me"],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      return apiRequest(`/api/operations/fuel/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/fuel/users"] });
      toast({
        title: "Role Updated",
        description: "User role has been successfully updated.",
      });
      setEditingUserId(null);
      setSelectedRole(null);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  const canManageRoles = currentUser?.role === "owner" || currentUser?.role === "admin";

  const handleSaveRole = (userId: string) => {
    if (!selectedRole) return;
    updateRoleMutation.mutate({ userId, role: selectedRole });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Role-Based Access Control</AlertTitle>
        <AlertDescription>
          Assign roles to control what users can do in the Fuel Operations module. Only Owners and Admins can manage user roles.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Organization Users
          </CardTitle>
          <CardDescription>
            Manage user access levels and permissions for fuel operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead>Status</TableHead>
                {canManageRoles && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isEditing = editingUserId === user.id;
                const roleColor = user.currentRole ? ROLE_BADGES[user.currentRole].color : "";
                
                return (
                  <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Select
                          value={selectedRole || user.currentRole || "viewer"}
                          onValueChange={(value) => setSelectedRole(value as UserRole)}
                        >
                          <SelectTrigger className="w-[140px]" data-testid={`select-role-${user.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {/* Only Owners can assign Owner role */}
                            {currentUser?.role === 'owner' && (
                              <SelectItem value="owner">Owner</SelectItem>
                            )}
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="auditor">Auditor</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : user.currentRole ? (
                        <div className="flex items-center gap-2">
                          <Badge className={roleColor}>
                            {user.currentRole.charAt(0).toUpperCase() + user.currentRole.slice(1)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {ROLE_DESCRIPTIONS[user.currentRole].substring(0, 50)}...
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No role assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.isActive ? (
                        <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400">
                          <XCircle className="w-3 h-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    {canManageRoles && (
                      <TableCell>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveRole(user.id)}
                              disabled={updateRoleMutation.isPending}
                              data-testid={`button-save-${user.id}`}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingUserId(null);
                                setSelectedRole(null);
                              }}
                              data-testid={`button-cancel-${user.id}`}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingUserId(user.id);
                              setSelectedRole(user.currentRole);
                            }}
                            disabled={
                              !user.isActive || 
                              user.id === currentUser?.id ||
                              // Admins cannot edit Owner or Admin roles
                              (currentUser?.role === 'admin' && 
                               (user.currentRole === 'owner' || user.currentRole === 'admin'))
                            }
                            data-testid={`button-edit-${user.id}`}
                          >
                            <Shield className="w-4 h-4 mr-1" />
                            Edit Role
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {users.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No users found in this organization</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Role Permissions
          </CardTitle>
          <CardDescription>
            Understanding what each role can do
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(ROLE_DESCRIPTIONS).map(([role, description]) => (
            <div key={role} className="flex items-start gap-3 p-3 rounded-lg border">
              <div className={`px-3 py-1 rounded-md font-medium ${ROLE_BADGES[role as UserRole].color}`}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </div>
              <p className="text-sm text-muted-foreground flex-1">{description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
