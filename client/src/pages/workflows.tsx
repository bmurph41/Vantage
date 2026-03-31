import { useState } from "react";
import TopBar from "@/components/topbar";
import AutomationWorkflows from "@/components/automation-workflows";
import WorkflowEmailTemplateManager from "@/components/crm/workflow-email-template-manager";
import WorkflowEmailLog from "@/components/crm/workflow-email-log";

const tabs = [
  { key: 'workflows', label: 'Workflows' },
  { key: 'email-templates', label: 'Email Templates' },
  { key: 'email-log', label: 'Email Log' },
] as const;

type TabKey = typeof tabs[number]['key'];

export default function Workflows() {
  const [activeTab, setActiveTab] = useState<TabKey>('workflows');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Workflows" subtitle="Manage your automation workflows and email templates" />

      <div className="border-b px-6">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <main className="flex-1 overflow-y-auto p-6" data-testid="workflows-main">
        {activeTab === 'workflows' && <AutomationWorkflows showFullView={true} />}
        {activeTab === 'email-templates' && <WorkflowEmailTemplateManager />}
        {activeTab === 'email-log' && <WorkflowEmailLog />}
      </main>
    </div>
  );
}
