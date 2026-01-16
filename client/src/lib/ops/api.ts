import { apiRequest } from "@/lib/queryClient";

export const opsApi = {
  inbox: {
    getConversations: (params?: { status?: string }) => 
      apiRequest(`/api/opssos/inbox/conversations${params?.status ? `?status=${params.status}` : ""}`),
    getConversation: (id: string) => 
      apiRequest(`/api/opssos/inbox/conversations/${id}`),
    assignConversation: (id: string, userId: string) =>
      apiRequest(`/api/opssos/inbox/conversations/${id}/assign`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      }),
    sendMessage: (data: { conversationId: string; body: string; direction: string }) =>
      apiRequest("/api/opssos/inbox/messages", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    scheduleMessage: (data: { conversationId: string; body: string; scheduledFor: string }) =>
      apiRequest("/api/opssos/inbox/messages/schedule", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getTemplates: () => apiRequest("/api/opssos/inbox/templates"),
    createTemplate: (data: { groupName: string; title: string; body: string }) =>
      apiRequest("/api/opssos/inbox/templates", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  automations: {
    getRules: () => apiRequest("/api/opssos/automations/rules"),
    createRule: (data: any) =>
      apiRequest("/api/opssos/automations/rules", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    toggleRule: (id: string) =>
      apiRequest(`/api/opssos/automations/rules/${id}/toggle`, { method: "POST" }),
    getRuns: () => apiRequest("/api/opssos/automations/runs"),
    getScheduledJobs: () => apiRequest("/api/opssos/automations/scheduled"),
  },

  tasks: {
    getTasks: () => apiRequest("/api/opssos/tasks"),
    createTask: (data: any) =>
      apiRequest("/api/opssos/tasks", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateTask: (id: string, data: any) =>
      apiRequest(`/api/opssos/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    applyChecklistTemplate: (taskId: string, templateId: string) =>
      apiRequest(`/api/opssos/tasks/${taskId}/apply-checklist-template`, {
        method: "POST",
        body: JSON.stringify({ templateId }),
      }),
  },

  statements: {
    getTemplates: () => apiRequest("/api/opssos/statements/templates"),
    createTemplate: (data: any) =>
      apiRequest("/api/opssos/statements/templates", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    generate: (data: { templateId: string; periodStart: string; periodEnd: string }) =>
      apiRequest("/api/opssos/statements/generate", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getStatement: (id: string) => apiRequest(`/api/opssos/statements/${id}`),
    getExports: (id: string) => apiRequest(`/api/opssos/statements/${id}/exports`),
  },

  integrations: {
    getIntegrations: () => apiRequest("/api/opssos/integrations"),
    createIntegration: (data: any) =>
      apiRequest("/api/opssos/integrations", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  webhooks: {
    getWebhooks: () => apiRequest("/api/opssos/webhooks"),
    createWebhook: (data: any) =>
      apiRequest("/api/opssos/webhooks", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getDeliveries: () => apiRequest("/api/opssos/webhooks/deliveries"),
  },
};
