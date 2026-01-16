import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

interface ConversationListProps {
  conversations: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const avatarColors = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-amber-500",
  "bg-indigo-500",
];

function getAvatarColor(id: string): string {
  const hash = id.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
}: ConversationListProps) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>No conversations found</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {conversations.map((conversation) => (
        <button
          key={conversation.id}
          onClick={() => onSelect(conversation.id)}
          className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
            selectedId === conversation.id ? "bg-muted" : ""
          }`}
        >
          <div className="flex items-start gap-3">
            <Avatar className={`${getAvatarColor(conversation.id)} text-white`}>
              <AvatarFallback className="bg-transparent">
                {getInitials(conversation.contactName || "Unknown")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">
                  {conversation.contactName || "Unknown Contact"}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {conversation.lastMessageAt
                    ? formatDistanceToNow(new Date(conversation.lastMessageAt), {
                        addSuffix: true,
                      })
                    : ""}
                </span>
              </div>
              <p className="text-sm text-muted-foreground truncate mt-1">
                {conversation.lastMessage || "No messages yet"}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  variant={
                    conversation.status === "open"
                      ? "default"
                      : conversation.status === "snoozed"
                      ? "secondary"
                      : "outline"
                  }
                  className="text-xs"
                >
                  {conversation.status}
                </Badge>
                {conversation.channel && conversation.channel !== "internal" && (
                  <Badge variant="outline" className="text-xs">
                    {conversation.channel}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
