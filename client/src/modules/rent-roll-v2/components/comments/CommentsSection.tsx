import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  Send, 
  Pin,
  PinOff,
  Trash2,
  MoreVertical,
  Pencil
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
  userName: string;
}

interface CommentsSectionProps {
  entityType: "lease" | "tenant" | "project" | "storage_location";
  entityId: string;
  title?: string;
  compact?: boolean;
}

export function CommentsSection({ 
  entityType, 
  entityId, 
  title = "Notes",
  compact = false 
}: CommentsSectionProps) {
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const { data: comments, isLoading } = useQuery<Comment[]>({
    queryKey: ['/api/comments', entityType, entityId],
    queryFn: async () => {
      const response = await fetch(`/api/comments/${entityType}/${entityId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
    },
    enabled: !!entityId,
  });

  const createMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest('POST', '/api/comments', { entityType, entityId, content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/comments', entityType, entityId] });
      setNewComment("");
      toast({ title: "Note added" });
    },
    onError: () => {
      toast({ title: "Failed to add note", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, content, isPinned }: { id: string; content?: string; isPinned?: boolean }) => {
      return apiRequest('PATCH', `/api/comments/${id}`, { content, isPinned });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/comments', entityType, entityId] });
      setEditingId(null);
      setEditContent("");
    },
    onError: () => {
      toast({ title: "Failed to update note", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/comments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/comments', entityType, entityId] });
      toast({ title: "Note deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete note", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (newComment.trim()) {
      createMutation.mutate(newComment.trim());
    }
  };

  const handleEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleSaveEdit = () => {
    if (editingId && editContent.trim()) {
      updateMutation.mutate({ id: editingId, content: editContent.trim() });
    }
  };

  const handleTogglePin = (comment: Comment) => {
    updateMutation.mutate({ id: comment.id, isPinned: !comment.isPinned });
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (compact) {
    return (
      <div className="space-y-3" data-testid="comments-section-compact">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
          {comments && comments.length > 0 && (
            <Badge variant="secondary" className="text-xs">{comments.length}</Badge>
          )}
        </div>
        
        <div className="flex gap-2">
          <Textarea
            placeholder="Add a note..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[60px] text-sm resize-none"
            data-testid="input-comment-compact"
          />
          <Button 
            size="icon" 
            onClick={handleSubmit}
            disabled={!newComment.trim() || createMutation.isPending}
            data-testid="button-add-comment-compact"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-16" />
        ) : comments?.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-xs">No notes yet</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {comments?.map((comment) => (
              <div 
                key={comment.id} 
                className={`flex gap-2 p-2 rounded-md text-sm ${comment.isPinned ? 'bg-primary/10' : 'bg-muted/50'}`}
                data-testid={`comment-item-${comment.id}`}
              >
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarFallback className="text-xs">{getInitials(comment.userName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-xs">{comment.userName}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                      </span>
                      {comment.isPinned && <Pin className="h-3 w-3 text-primary" />}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5" data-testid={`button-comment-menu-${comment.id}`} aria-label="Comment actions">
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(comment)} data-testid={`button-edit-comment-${comment.id}`}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTogglePin(comment)} data-testid={`button-pin-comment-${comment.id}`}>
                          {comment.isPinned ? (
                            <>
                              <PinOff className="h-4 w-4 mr-2" />
                              Unpin
                            </>
                          ) : (
                            <>
                              <Pin className="h-4 w-4 mr-2" />
                              Pin
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => deleteMutation.mutate(comment.id)}
                          className="text-destructive"
                          data-testid={`button-delete-comment-${comment.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  {editingId === comment.id ? (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[40px] text-sm resize-none"
                        data-testid={`input-edit-comment-${comment.id}`}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending} data-testid={`button-save-edit-${comment.id}`}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)} data-testid={`button-cancel-edit-${comment.id}`}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground break-words text-xs">{comment.content}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card data-testid="comments-section">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          {title}
          {comments && comments.length > 0 && (
            <Badge variant="secondary">{comments.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Textarea
            placeholder="Add a note..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[80px] resize-none"
            data-testid="input-comment"
          />
        </div>
        <div className="flex justify-end">
          <Button 
            onClick={handleSubmit}
            disabled={!newComment.trim() || createMutation.isPending}
            data-testid="button-add-comment"
          >
            <Send className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : comments?.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground" data-testid="status-no-comments">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No notes yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments?.map((comment) => (
              <div 
                key={comment.id} 
                className={`flex gap-3 p-3 rounded-lg border ${comment.isPinned ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'}`}
                data-testid={`comment-item-${comment.id}`}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback>{getInitials(comment.userName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm" data-testid={`text-comment-author-${comment.id}`}>{comment.userName}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                      </span>
                      {comment.isPinned && (
                        <Badge variant="outline" className="text-xs" data-testid={`badge-pinned-${comment.id}`}>
                          <Pin className="h-3 w-3 mr-1" />
                          Pinned
                        </Badge>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-comment-menu-${comment.id}`} aria-label="Comment actions">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(comment)} data-testid={`button-edit-comment-${comment.id}`}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTogglePin(comment)} data-testid={`button-pin-comment-${comment.id}`}>
                          {comment.isPinned ? (
                            <>
                              <PinOff className="h-4 w-4 mr-2" />
                              Unpin
                            </>
                          ) : (
                            <>
                              <Pin className="h-4 w-4 mr-2" />
                              Pin
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => deleteMutation.mutate(comment.id)}
                          className="text-destructive"
                          data-testid={`button-delete-comment-${comment.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  {editingId === comment.id ? (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[60px] resize-none"
                        data-testid={`input-edit-comment-${comment.id}`}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending} data-testid={`button-save-edit-${comment.id}`}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)} data-testid={`button-cancel-edit-${comment.id}`}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1 break-words whitespace-pre-wrap" data-testid={`text-comment-content-${comment.id}`}>
                      {comment.content}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}