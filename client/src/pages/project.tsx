import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ProjectHeader } from "@/components/project-header";
import { ThirdPartyReports } from "@/components/third-party-reports";
import { ProjectSetup } from "@/components/project-setup";
import { TemplatesView } from "@/components/templates-view";
import { TimelineView } from "@/components/timeline-view";
import { TaskOwnersView } from "@/components/task-owners-view";
import { ProjectIntegrationSettings } from "@/components/project-integration-settings";
import { AddTaskModal } from "@/components/add-task-modal";
import NotificationSettingsPage from "@/pages/notification-settings";
import { useProject } from "@/hooks/use-project";
import { cn } from "@/lib/utils";
import type { Task } from "@shared/schema";

export default function ProjectPage() {
  const { id } = useParams();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("reports");
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
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
          <Link href="/">
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
      const taskElement = document.querySelector(`[data-testid="sortable-task-${taskId}"]`) as HTMLElement | null;
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

  const tabs = [
    { id: "reports", label: "Tasks & Timeline" },
    { id: "setup", label: "Deal Details" },
    { id: "owners", label: "Task Owners" },
    { id: "templates", label: "Templates" },
    { id: "integrations", label: "Integrations" },
    { id: "notifications", label: "Notifications" },
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="project-page">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm" data-testid="link-back-dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <h1 className="text-xl font-semibold text-primary">Due Diligence Tracker</h1>
              <span className="text-sm text-muted-foreground">MarinaMatch</span>
            </div>
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
              JD
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
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={`tab-${tab.id}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === "reports" && (
            <>
              {/* Timeline - Professional View (Only on Tasks & Timeline tab) */}
              <div className="mb-8">
                <TimelineView tasks={tasks} project={project} settings={settings} onTaskClick={handleTaskClick} />
              </div>
              <ThirdPartyReports tasks={tasks} projectId={project.id} project={project} settings={settings} />
            </>
          )}
          {activeTab === "setup" && (
            <ProjectSetup project={project} settings={settings} tasks={tasks} />
          )}
          {activeTab === "owners" && (
            <TaskOwnersView tasks={tasks} />
          )}
          {activeTab === "templates" && (
            <TemplatesView projectId={project.id} />
          )}
          {activeTab === "integrations" && (
            <ProjectIntegrationSettings projectId={project.id} />
          )}
          {activeTab === "notifications" && (
            <NotificationSettingsPage projectId={project.id} />
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
