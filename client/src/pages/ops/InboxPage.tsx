import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Mail, 
  MessageSquare, 
  Search, 
  Filter, 
  Plus,
  User,
  Clock,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { ConversationList } from "@/components/ops/inbox/ConversationList";
import { ThreadView } from "@/components/ops/inbox/ThreadView";
import { ContextPanel } from "@/components/ops/inbox/ContextPanel";

export default function InboxPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "snoozed" | "closed">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["/api/opssos/inbox/conversations", statusFilter],
  });

  const selectedConversation = conversations?.find(
    (c: any) => c.id === selectedConversationId
  );

  return (
    <div className="h-[calc(100dvh-4rem)] flex flex-col">
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Unified Inbox</h1>
            <p className="text-sm text-muted-foreground">
              Manage all conversations in one place
            </p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Message
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r flex flex-col">
          <div className="p-4 border-b space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <TabsList className="w-full">
                <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
                <TabsTrigger value="open" className="flex-1">Open</TabsTrigger>
                <TabsTrigger value="snoozed" className="flex-1">Snoozed</TabsTrigger>
                <TabsTrigger value="closed" className="flex-1">Closed</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex-1 overflow-auto">
            <ConversationList
              conversations={conversations || []}
              selectedId={selectedConversationId}
              onSelect={setSelectedConversationId}
              isLoading={isLoading}
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <ThreadView conversation={selectedConversation} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a conversation to view</p>
              </div>
            </div>
          )}
        </div>

        <div className="w-80 border-l">
          {selectedConversation ? (
            <ContextPanel conversation={selectedConversation} />
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              <p className="text-sm">Select a conversation to see details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
