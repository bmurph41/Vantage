import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import TopBar from "@/components/topbar";
import AutomationWorkflows from "@/components/automation-workflows";

export default function Workflows() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Workflows" subtitle="Manage your automation workflows" />
      
      <main className="flex-1 overflow-y-auto p-6" data-testid="workflows-main">
        <AutomationWorkflows showFullView={true} />
      </main>
    </div>
  );
}
