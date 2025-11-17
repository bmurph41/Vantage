import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderLock, FileText, Users, Clock, Plus } from "lucide-react";

export default function VDRDashboard() {
  const { data: projects, isLoading } = useQuery({
    queryKey: ["/api/dd/projects"],
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  const activeProjects = projects?.filter((p: any) => p.status !== "completed") || [];
  const completedProjects = projects?.filter((p: any) => p.status === "completed") || [];

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="text-vdr-title">Virtual Data Room</h1>
          <p className="text-gray-600 mt-1">Secure document management for due diligence projects</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <FolderLock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProjects.length}</div>
            <p className="text-xs text-muted-foreground">
              With VDR access
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">
              Across all projects
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">External Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">
              Stakeholder access
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>
      </div>

      {activeProjects.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">Active Projects</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeProjects.map((project: any) => (
              <Card key={project.id} className="hover:shadow-lg transition-shadow flex flex-col h-full">
                <CardHeader className="flex-none">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-1">{project.name}</CardTitle>
                      <CardDescription className="mt-1 line-clamp-2 min-h-[2.5rem]">
                        {project.description || "No description"}
                      </CardDescription>
                    </div>
                    <Badge variant={project.status === "active" ? "default" : "secondary"}>
                      {project.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 justify-between space-y-4">
                  <div className="grid grid-cols-2 gap-3 py-2 px-3 bg-gray-50 rounded-md border border-gray-100">
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <FolderLock className="h-3.5 w-3.5 text-gray-400" />
                      <span className="font-medium">— Folders</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <FileText className="h-3.5 w-3.5 text-gray-400" />
                      <span className="font-medium">— Files</span>
                    </div>
                  </div>
                  <Link href={`/vdr/projects/${project.id}`}>
                    <Button className="w-full" data-testid={`button-open-vdr-${project.id}`}>
                      <FolderLock className="h-4 w-4 mr-2" />
                      Open Data Room
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {completedProjects.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">Completed Projects</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedProjects.map((project: any) => (
              <Card key={project.id} className="hover:shadow-lg transition-shadow opacity-75 flex flex-col h-full">
                <CardHeader className="flex-none">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-1">{project.name}</CardTitle>
                      <CardDescription className="mt-1 line-clamp-2 min-h-[2.5rem]">
                        {project.description || "No description"}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">completed</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 justify-between space-y-4">
                  <div className="grid grid-cols-2 gap-3 py-2 px-3 bg-gray-50 rounded-md border border-gray-100">
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <FolderLock className="h-3.5 w-3.5 text-gray-400" />
                      <span className="font-medium">— Folders</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <FileText className="h-3.5 w-3.5 text-gray-400" />
                      <span className="font-medium">— Files</span>
                    </div>
                  </div>
                  <Link href={`/vdr/projects/${project.id}`}>
                    <Button variant="outline" className="w-full" data-testid={`button-open-vdr-${project.id}`}>
                      <FolderLock className="h-4 w-4 mr-2" />
                      View Archive
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {projects?.length === 0 && (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <FolderLock className="h-16 w-16 mx-auto text-gray-400" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">No Projects Yet</h3>
              <p className="text-gray-600 mt-1">
                Create a Due Diligence project to start using the Virtual Data Room
              </p>
            </div>
            <Link href="/projects">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                View Projects
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
