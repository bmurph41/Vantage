import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Send, User, Clock, CheckCheck, Circle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import type { MessageThread, Message, Customer } from "@shared/schema";

interface ExtendedMessageThread extends MessageThread {
  customer?: Customer;
  unreadCount?: number;
}

export default function MessagingPage() {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUserId = "demo-staff-1";
  const currentUserType = "staff";

  const { data: threads = [], isLoading: threadsLoading } = useQuery<ExtendedMessageThread[]>({
    queryKey: ["/api/messages/threads"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const selectedThread = threads.find(t => t.id === selectedThreadId);

  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages/threads", selectedThreadId, "messages"],
    enabled: !!selectedThreadId,
  });

  const createThreadMutation = useMutation({
    mutationFn: async (data: { customerId: string; subject: string; initialMessage: string }) => {
      const thread = await apiRequest(`/api/messages/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marinaId: "default-marina",
          customerId: data.customerId,
          subject: data.subject,
          status: "active",
          priority: "normal",
        }),
      });

      await apiRequest(`/api/messages/threads/${thread.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: currentUserId,
          senderType: currentUserType,
          content: data.initialMessage,
        }),
      });

      return thread;
    },
    onSuccess: (thread) => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/threads"] });
      setSelectedThreadId(thread.id);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { threadId: string; content: string }) => {
      return await apiRequest(`/api/messages/threads/${data.threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: currentUserId,
          senderType: currentUserType,
          content: data.content,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/threads", selectedThreadId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/threads"] });
      setMessageContent("");
    },
  });

  const updateThreadMutation = useMutation({
    mutationFn: async (data: { threadId: string; updates: Partial<MessageThread> }) => {
      return await apiRequest(`/api/messages/threads/${data.threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/threads"] });
    },
  });

  const markThreadAsReadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      return await apiRequest(`/api/messages/threads/${threadId}/mark-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/threads", selectedThreadId, "messages"] });
    },
  });

  useEffect(() => {
    if (selectedThreadId && messages.length > 0) {
      markThreadAsReadMutation.mutate(selectedThreadId);
    }
  }, [selectedThreadId, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/messages`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('WebSocket connected - session-based authentication');
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'message') {
        if (data.data.threadId === selectedThreadId) {
          queryClient.invalidateQueries({ queryKey: ["/api/messages/threads", selectedThreadId, "messages"] });
        }
        queryClient.invalidateQueries({ queryKey: ["/api/messages/threads"] });
      } else if (data.type === 'thread_update') {
        queryClient.invalidateQueries({ queryKey: ["/api/messages/threads"] });
      } else if (data.type === 'read_receipt') {
        if (data.data.threadId === selectedThreadId) {
          queryClient.invalidateQueries({ queryKey: ["/api/messages/threads", selectedThreadId, "messages"] });
        }
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [selectedThreadId]);

  const handleSendMessage = () => {
    if (!selectedThreadId || !messageContent.trim()) return;
    sendMessageMutation.mutate({
      threadId: selectedThreadId,
      content: messageContent.trim(),
    });
  };

  const handleStatusChange = (status: string) => {
    if (!selectedThreadId) return;
    updateThreadMutation.mutate({
      threadId: selectedThreadId,
      updates: { status },
    });
  };

  const handlePriorityChange = (priority: string) => {
    if (!selectedThreadId) return;
    updateThreadMutation.mutate({
      threadId: selectedThreadId,
      updates: { priority },
    });
  };

  const filteredThreads = threads.filter(thread => 
    statusFilter === "all" || thread.status === statusFilter
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "text-red-500";
      case "normal": return "text-yellow-500";
      case "low": return "text-green-500";
      default: return "text-gray-500";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge variant="default">Active</Badge>;
      case "resolved": return <Badge variant="secondary">Resolved</Badge>;
      case "closed": return <Badge variant="outline">Closed</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Thread List Sidebar */}
      <div className="w-80 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Messages
          </h2>
          <div className="mt-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Threads</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {threadsLoading ? (
            <div className="p-4 text-center text-gray-500">Loading threads...</div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No threads found</div>
          ) : (
            <div className="divide-y">
              {filteredThreads.map((thread) => {
                const customer = customers.find(c => c.id === thread.customerId);
                const isSelected = thread.id === selectedThreadId;
                
                return (
                  <div
                    key={thread.id}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                    onClick={() => setSelectedThreadId(thread.id)}
                    data-testid={`thread-item-${thread.id}`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="font-medium text-sm">
                          {customer?.name || "Unknown Customer"}
                        </span>
                      </div>
                      <Circle className={`h-3 w-3 ${getPriorityColor(thread.priority)}`} fill="currentColor" />
                    </div>
                    <div className="text-sm font-medium text-gray-900 truncate mb-1">
                      {thread.subject}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {thread.lastMessageAt ? format(new Date(thread.lastMessageAt), "MMM d, h:mm a") : "N/A"}
                      </span>
                      {getStatusBadge(thread.status)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Message View */}
      <div className="flex-1 flex flex-col">
        {selectedThreadId && selectedThread ? (
          <>
            {/* Thread Header */}
            <div className="p-4 border-b bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{selectedThread.subject}</h3>
                  <p className="text-sm text-gray-500">
                    {customers.find(c => c.id === selectedThread.customerId)?.name || "Unknown Customer"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedThread.priority} onValueChange={handlePriorityChange}>
                    <SelectTrigger className="w-32" data-testid="select-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedThread.status} onValueChange={handleStatusChange}>
                    <SelectTrigger className="w-32" data-testid="select-thread-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="text-center text-gray-500">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500">No messages yet</div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => {
                    const isOwnMessage = message.senderId === currentUserId;
                    
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                        data-testid={`message-${message.id}`}
                      >
                        <div className={`max-w-md ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                          <div
                            className={`rounded-lg p-3 ${
                              isOwnMessage
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-900'
                            }`}
                          >
                            <div className="text-xs opacity-70 mb-1">
                              {message.senderType === 'customer' ? 'Customer' : 'Staff'}
                            </div>
                            <div className="whitespace-pre-wrap">{message.content}</div>
                            <div className="flex items-center justify-between mt-2 text-xs opacity-70">
                              <span>{format(new Date(message.createdAt), "MMM d, h:mm a")}</span>
                              {isOwnMessage && message.isRead && (
                                <CheckCheck className="h-3 w-3" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t bg-white">
              <div className="flex gap-2">
                <Textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 min-h-[60px] max-h-[200px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  data-testid="input-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageContent.trim() || sendMessageMutation.isPending}
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Select a conversation</h3>
              <p className="text-gray-500">Choose a thread from the list to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
