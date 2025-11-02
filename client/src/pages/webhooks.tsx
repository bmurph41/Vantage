import TopBar from "@/components/topbar";
import WebhooksManager from "@/components/webhooks-manager";

export default function Webhooks() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Webhooks" subtitle="Manage your webhook integrations" />
      
      <main className="flex-1 overflow-y-auto p-6" data-testid="webhooks-main">
        <WebhooksManager />
      </main>
    </div>
  );
}
