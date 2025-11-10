import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/layout/header";
import { Settings as SettingsIcon, Users, Plug } from "lucide-react";
import IntegrationSettings from "./IntegrationSettings";
import UserRoleManagement from "@/components/fuel/user-role-management";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("roles");

  return (
    <>
      <Header 
        title="Fuel Operations Settings"
        subtitle="Manage user access, permissions, and integrations"
      />

      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="roles" className="flex items-center gap-2" data-testid="tab-user-roles">
              <Users className="w-4 h-4" />
              User Roles & Permissions
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center gap-2" data-testid="tab-integrations">
              <Plug className="w-4 h-4" />
              Software Integrations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="roles">
            <UserRoleManagement />
          </TabsContent>

          <TabsContent value="integrations">
            <IntegrationSettings />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
