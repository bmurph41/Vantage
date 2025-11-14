import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FolderLock, FileText, Users, Shield, ClipboardList, Activity } from "lucide-react";
import { DocumentsWorkspace } from "@/components/vdr/DocumentsWorkspace";
import { PermissionViewer } from "@/components/vdr/PermissionViewer";

export default function ProjectVDR() {
  const [, params] = useRoute("/vdr/projects/:id");
  const projectId = params?.id;

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: [`/api/dd/projects/${projectId}`],
    enabled: !!projectId,
  });

  const { data: folders, isLoading: foldersLoading } = useQuery({
    queryKey: [`/api/vdr/projects/${projectId}/folders`],
    enabled: !!projectId,
  });

  if (projectLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-12 text-center">
            <h3 className="text-lg font-semibold text-gray-900">Project Not Found</h3>
            <p className="text-gray-600 mt-2">The requested project could not be found.</p>
            <Link href="/vdr">
              <Button className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to VDR
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/vdr">
          <Button variant="ghost" size="icon" data-testid="button-back-to-vdr">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <FolderLock className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900" data-testid="text-project-name">{project.name}</h1>
              <p className="text-gray-600">{project.description || "No description"}</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="documents" data-testid="tab-documents">
            <FileText className="h-4 w-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="permissions" data-testid="tab-permissions">
            <Shield className="h-4 w-4 mr-2" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="external-users" data-testid="tab-external-users">
            <Users className="h-4 w-4 mr-2" />
            External Users
          </TabsTrigger>
          <TabsTrigger value="requests" data-testid="tab-requests">
            <ClipboardList className="h-4 w-4 mr-2" />
            Requests
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <Activity className="h-4 w-4 mr-2" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="h-[calc(100vh-20rem)]">
          <DocumentsWorkspace projectId={projectId!} />
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <PermissionViewer 
            resourceType="project" 
            resourceId={projectId!} 
            projectId={projectId!}
          />
        </TabsContent>

        <TabsContent value="external-users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>External Stakeholders</CardTitle>
              <CardDescription>
                Manage third-party access to this data room
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Users className="h-16 w-16 mx-auto text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 mt-4">No External Users</h3>
                <p className="text-gray-600 mt-1">Invite external stakeholders to access documents</p>
                <Button className="mt-4" data-testid="button-invite-external-user">
                  Invite User
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Diligence Requests</CardTitle>
              <CardDescription>
                Track document requests and fulfillment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <ClipboardList className="h-16 w-16 mx-auto text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 mt-4">No Requests</h3>
                <p className="text-gray-600 mt-1">Create document requests for external parties</p>
                <Button className="mt-4" data-testid="button-create-request">
                  Create Request
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>
                Comprehensive activity log for compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Activity className="h-16 w-16 mx-auto text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 mt-4">No Activity Yet</h3>
                <p className="text-gray-600 mt-1">All document activities will appear here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
