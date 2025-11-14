import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Shield, Plus, Trash2, UserPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useVdrProject } from "@/hooks/useVdrProject";

type VdrPermission = {
  id: string;
  documentId: string | null;
  folderId: string | null;
  projectId: string | null;
  userId: string | null;
  externalUserId: string | null;
  roleEnum: string | null;
  permissionLevel: string;
  expiresAt: string | null;
  grantedBy: string;
  createdAt: string;
};

type PermissionViewerProps = {
  resourceType: 'project' | 'folder' | 'document';
  resourceId: string;
  projectId: string;
};

const PERMISSION_LEVELS = [
  { value: 'no_access', label: 'No Access', color: 'bg-red-100 text-red-800' },
  { value: 'view_only', label: 'View Only', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'view_download', label: 'View & Download', color: 'bg-blue-100 text-blue-800' },
  { value: 'view_download_print', label: 'View, Download & Print', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'full_access', label: 'Full Access', color: 'bg-green-100 text-green-800' },
];

export function PermissionViewer({ resourceType, resourceId, projectId }: PermissionViewerProps) {
  const vdr = useVdrProject(projectId);
  const { data: permissions = [], isLoading } = vdr.usePermissions(resourceType, resourceId);
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [selectedPermissionLevel, setSelectedPermissionLevel] = useState<string>('view_download');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  const handleGrantPermission = () => {
    if (!selectedUserId || !selectedPermissionLevel) return;

    vdr.grantPermission({
      resourceType,
      resourceId,
      userId: selectedUserId,
      permissionLevel: selectedPermissionLevel,
    });

    setGrantDialogOpen(false);
    setSelectedUserId('');
    setSelectedPermissionLevel('view_download');
  };

  const handleRevokePermission = (permissionId: string) => {
    vdr.revokePermission({
      permissionId,
      resourceType,
      resourceId,
    });
  };

  const getPermissionLevelBadge = (level: string) => {
    const config = PERMISSION_LEVELS.find(p => p.value === level);
    return (
      <Badge className={config?.color || 'bg-gray-100 text-gray-800'}>
        {config?.label || level}
      </Badge>
    );
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return 'Invalid Date';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissions
            </CardTitle>
            <CardDescription>
              Manage access control for this {resourceType}
            </CardDescription>
          </div>
          <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-grant-permission">
                <Plus className="h-4 w-4 mr-2" />
                Grant Access
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Grant Permission</DialogTitle>
                <DialogDescription>
                  Give a user access to this {resourceType}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="user">User</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger id="user" data-testid="select-user">
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="permission-level">Permission Level</Label>
                  <Select value={selectedPermissionLevel} onValueChange={setSelectedPermissionLevel}>
                    <SelectTrigger id="permission-level" data-testid="select-permission-level">
                      <SelectValue placeholder="Select permission level" />
                    </SelectTrigger>
                    <SelectContent>
                      {PERMISSION_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setGrantDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleGrantPermission}
                  disabled={!selectedUserId || !selectedPermissionLevel || vdr.isGrantingPermission}
                  data-testid="button-confirm-grant"
                >
                  {vdr.isGrantingPermission ? 'Granting...' : 'Grant Permission'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
        {permissions.length === 0 ? (
          <div className="text-center py-12">
            <UserPlus className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">No Permissions Set</h3>
            <p className="text-gray-600 mt-1">
              Grant access to users to share this {resourceType}
            </p>
            <Button className="mt-4" onClick={() => setGrantDialogOpen(true)} data-testid="button-grant-first-permission">
              <Plus className="h-4 w-4 mr-2" />
              Grant Permission
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Permission Level</TableHead>
                <TableHead>Granted On</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((permission) => (
                <TableRow key={permission.id} data-testid={`permission-row-${permission.id}`}>
                  <TableCell className="font-medium">
                    {permission.userId ? `User ${permission.userId}` : 
                     permission.externalUserId ? `External ${permission.externalUserId}` :
                     permission.roleEnum ? `Role: ${permission.roleEnum}` : 'Unknown'}
                  </TableCell>
                  <TableCell>
                    {getPermissionLevelBadge(permission.permissionLevel)}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {formatDate(permission.createdAt)}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {formatDate(permission.expiresAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRevokePermission(permission.id)}
                      disabled={vdr.isRevokingPermission}
                      data-testid={`button-revoke-${permission.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
