import { apiRequest } from "./queryClient";
import type { Project, ProjectSettings, Task, TaskTemplate, ProjectTemplate } from "@shared/schema";
import type { ProjectWithDetails } from "@/types/dd";

export const ddClient = {
  // Projects
  async getProjects(): Promise<Project[]> {
    const response = await apiRequest('GET', '/api/dd/projects');
    return response.json();
  },

  async getProject(id: string): Promise<ProjectWithDetails> {
    const response = await apiRequest('GET', `/api/dd/projects/${id}`);
    return response.json();
  },

  async createProject(project: Partial<Project>): Promise<Project> {
    const response = await apiRequest('POST', '/api/dd/projects', project);
    return response.json();
  },

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const response = await apiRequest('PATCH', `/api/dd/projects/${id}`, updates);
    return response.json();
  },

  // Project Settings
  async updateProjectSettings(projectId: string, settings: Partial<ProjectSettings>): Promise<ProjectSettings> {
    const response = await apiRequest('PATCH', `/api/dd/projects/${projectId}/settings`, settings);
    return response.json();
  },

  // Tasks
  async getTasks(projectId: string): Promise<Task[]> {
    const response = await apiRequest('GET', `/api/dd/projects/${projectId}/tasks`);
    return response.json();
  },

  async createTask(projectId: string, task: Partial<Task>): Promise<Task> {
    const response = await apiRequest('POST', `/api/dd/projects/${projectId}/tasks`, task);
    return response.json();
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const response = await apiRequest('PATCH', `/api/dd/tasks/${id}`, updates);
    return response.json();
  },

  async deleteTask(id: string): Promise<void> {
    await apiRequest('DELETE', `/api/dd/tasks/${id}`);
  },

  // Templates
  async getTaskTemplates(): Promise<TaskTemplate[]> {
    const response = await apiRequest('GET', '/api/dd/task-templates');
    return response.json();
  },

  async createTaskTemplate(template: Partial<TaskTemplate>): Promise<TaskTemplate> {
    const response = await apiRequest('POST', '/api/dd/task-templates', template);
    return response.json();
  },

  async getProjectTemplates(): Promise<ProjectTemplate[]> {
    const response = await apiRequest('GET', '/api/dd/project-templates');
    return response.json();
  },

  async createProjectTemplate(template: Partial<ProjectTemplate>): Promise<ProjectTemplate> {
    const response = await apiRequest('POST', '/api/dd/project-templates', template);
    return response.json();
  },

  async applyTemplate(projectId: string, templateId: string): Promise<void> {
    await apiRequest('POST', `/api/dd/projects/${projectId}/apply-template/${templateId}`);
  },

  // Export
  async exportCSV(projectId: string): Promise<string> {
    const response = await apiRequest('GET', `/api/dd/projects/${projectId}/export.csv`);
    return response.text();
  },

  async exportICS(projectId: string): Promise<string> {
    const response = await apiRequest('GET', `/api/dd/projects/${projectId}/export.ics`);
    return response.text();
  },
};
