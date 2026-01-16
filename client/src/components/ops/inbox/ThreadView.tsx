import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { MessageComposer } from "./MessageComposer";
import { apiRequest } from "@/lib/queryClient";

interface ThreadViewProps {
  conversation: any;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ThreadView({ conversation }: ThreadViewProps) {
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["/api/opssos/inbox/conversations", conversation.id, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/opssos/inbox/conversations/${conversation.id}`);
      const data = await res.json();
      return data.messages || [];
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { body: string; direction: string }) => {
      return apiRequest("/api/opssos/inbox/messages", {
        method: "POST",
        body: JSON.stringify({
          conversationId: conversation.id,
          ...data,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/opssos/inbox/conversations", conversation.id],
      });
    },
  });

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarFallback>
              {getInitials(conversation.contactName || "Unknown")}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-medium">{conversation.contactName || "Unknown Contact"}</h2>
            <p className="text-sm text-muted-foreground">
              {conversation.channel || "Internal"}
            </p>
          </div>
        </div>
        <Badge variant={conversation.status === "open" ? "default" : "secondary"}>
          {conversation.status}
        </Badge>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {isLoading ? (
          <div className="text-center text-muted-foreground">Loading messages...</div>
        ) : messages?.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No messages in this conversation</p>
            <p className="text-sm mt-2">Start the conversation by sending a message below</p>
          </div>
        ) : (
          messages?.map((message: any) => (
            <div
              key={message.id}
              className={`flex ${message.direction === "out" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.direction === "note"
                    ? "bg-amber-50 border border-amber-200 text-amber-900"
                    : message.direction === "out"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {message.direction === "note" && (
                  <div className="text-xs font-medium mb-1 text-amber-600">Internal Note</div>
                )}
                <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                <div
                  className={`text-xs mt-2 ${
                    message.direction === "out" ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  {message.sentAt
                    ? formatDistanceToNow(new Date(message.sentAt), { addSuffix: true })
                    : message.status === "scheduled"
                    ? `Scheduled for ${new Date(message.scheduledFor).toLocaleString()}`
                    : message.status}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t p-4">
        <MessageComposer
          onSend={(body, isNote) =>
            sendMessageMutation.mutate({
              body,
              direction: isNote ? "note" : "out",
            })
          }
          isSending={sendMessageMutation.isPending}
        />
      </div>
    </div>
  );
}
