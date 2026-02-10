import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileBarChart, Plus, FolderOpen, Briefcase } from "lucide-react";
import { ProjectHeader } from "@/components/project-header";
import { ThirdPartyReports } from "@/components/third-party-reports";
import { DocumentsWorkspace } from "@/components/vdr/DocumentsWorkspace";
import { ProjectSetup } from "@/components/project-setup";
import { TimelineView } from "@/components/timeline-view";
import { TaskOwnersView } from "@/components/task-owners-view";
import { ProjectIntegrationSettings } from "@/components/project-integration-settings";
import { AddTaskModal } from "@/components/add-task-modal";
import { KeyContactsSection } from "@/components/key-contacts-section";
import { ArchiveView } from "@/components/archive-view";
import { CddAdvisor } from "@/components/cdd-advisor";
import { FindingsManager } from "@/components/findings-manager";
import { KpisOverview } from "@/components/kpis-overview";
import { TemplatesView } from "@/components/templates-view";
import { PortfolioPropertiesView } from "@/components/portfolio-properties-view";
import NotificationSettingsPage from "@/pages/notification-settings";
import DdChecklistProjectWrapper from "@/components/workspace/DdChecklistProjectWrapper";
import { useProject } from "@/hooks/use-project";
import { cn } from "@/lib/utils";
import type { DDTask } from "@shared/schema";

export default function ProjectPage() {
  const { id } = useParams();
  const [location] = useLocation();
  const urlTab = new URLSearchParams(window.location.search).get('tab');
  const [activeTab, setActiveTab] = useState<string | null>(urlTab);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<DDTask | null>(null);
  
  const { data, isLoading, error } = useProject(id!);
  

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-64 mb-6"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Project not found</h1>
          <Link href="/dd/projects">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { project, settings, tasks } = data;

  const handleTaskClick = (taskId: string) => {
    // Ensure we're on the Tasks & Timeline tab
    setActiveTab('reports');
    
    // Use requestAnimationFrame to ensure the tab switch has been rendered
    requestAnimationFrame(() => {
      const taskElement = document.querySelector(`[data-testid="task-summary-card-${taskId}"]`) as HTMLElement | null;
      if (taskElement) {
        // Scroll to the task summary card
        taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Add highlight effect
        taskElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'transition-all', 'duration-300');
        
        // Remove highlight effect after 1200ms
        setTimeout(() => {
          taskElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'transition-all', 'duration-300');
        }, 1200);
      }
    });
  };

  const isPortfolio = project.projectType === "portfolio";
  
  const effectiveActiveTab = activeTab || (isPortfolio ? "portfolio" : "reports");

  const baseTabs = [
    { id: "reports", label: "Tasks & Timeline" },
    { id: "documents", label: "Documents" },
    { id: "ddrequest", label: "DD Request" },
    { id: "templates", label: "Templates" },
    { id: "setup", label: "Deal Details" },
    { id: "owners", label: "Task Owners" },
    { id: "contacts", label: "Key Contacts" },
    { id: "integrations", label: "Integrations" },
    { id: "notifications", label: "Notifications" },
    { id: "archive", label: "Archive" },
  ];

  const tabs = isPortfolio 
    ? [{ id: "portfolio", label: "Portfolio Properties" }, ...baseTabs]
    : baseTabs;

  return (
    <div className="min-h-screen bg-background" data-testid="project-page">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/dd/projects">
                <Button variant="ghost" size="sm" data-testid="link-back-dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <h1 className="text-xl font-semibold text-primary">Due Diligence Tracker</h1>
              <span className="text-sm text-muted-foreground">MarinaMatch</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                JD
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProjectHeader project={project} tasks={tasks} settings={settings} />

        {/* Tab Navigation */}
        <div className="mb-6">
          <nav className="flex space-x-1 bg-muted p-1 rounded-lg" data-testid="tab-navigation">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  effectiveActiveTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={`tab-${tab.id}`}
              >
                {tab.label}
              </button>
            ))}
            
            {/* Add Task Button */}
            <div className="flex-1"></div>
            <Button
              onClick={() => setIsTaskModalOpen(true)}
              variant="default"
              size="sm"
              className="ml-auto px-4 py-2 h-auto text-sm font-medium"
              data-testid="add-task-button-header"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {effectiveActiveTab === "portfolio" && isPortfolio && (
            <PortfolioPropertiesView portfolioId={project.id} portfolioName={project.name} />
          )}
          {effectiveActiveTab === "reports" && (
            <>
              {/* Timeline - Professional View (Only on Tasks & Timeline tab) */}
              <div className="mb-8">
                <TimelineView tasks={tasks} project={project} settings={settings} onTaskClick={handleTaskClick} />
              </div>
              <ThirdPartyReports tasks={tasks} projectId={project.id} project={project} settings={settings} />
            </>
          )}
          {effectiveActiveTab === "documents" && (
            <div className="h-[calc(100vh-20rem)] border rounded-lg bg-card overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold">Data Room</h2>
                </div>
                <Link href={`/vdr/projects/${project.id}`}>
                  <Button variant="outline" size="sm">
                    Open Full Data Room
                  </Button>
                </Link>
              </div>
              <div className="h-[calc(100%-4rem)]">
                <DocumentsWorkspace projectId={project.id} />
              </div>
            </div>
          )}
          {effectiveActiveTab === "ddrequest" && (
            <DdChecklistProjectWrapper projectId={project.id} projectName={project.name} />
          )}
          {effectiveActiveTab === "templates" && (
            <TemplatesView projectId={project.id} />
          )}
          {effectiveActiveTab === "setup" && (
            <ProjectSetup project={project} settings={settings} tasks={tasks} />
          )}
          {effectiveActiveTab === "owners" && (
            <TaskOwnersView tasks={tasks} projectId={project.id} />
          )}
          {effectiveActiveTab === "contacts" && (
            <KeyContactsSection projectId={project.id} />
          )}
          {effectiveActiveTab === "integrations" && (
            <ProjectIntegrationSettings projectId={project.id} />
          )}
          {effectiveActiveTab === "notifications" && (
            <NotificationSettingsPage projectId={project.id} />
          )}
          {effectiveActiveTab === "archive" && (
            <ArchiveView projectId={project.id} />
          )}
        </div>
      </div>

      {/* Task Edit Modal */}
      <AddTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        projectId={project.id}
        editingTask={editingTask}
      />
    </div>
  );
}
