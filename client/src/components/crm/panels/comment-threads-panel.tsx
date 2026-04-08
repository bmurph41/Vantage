import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MessageSquare, Plus, Pin, Check, RefreshCw, AtSign, Bell, User, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface CommentThreadsPanelProps {
  entityType: string;
  entityId: string;
  entityName?: string;
}

interface Thread {
  id: string;
  subject: string | null;
  status: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  creator: { id: string; firstName: string; lastName: string; email: string } | null;
  comments: Comment[];
  commentCount: number;
}

interface Comment {
  id: string;
  content: string;
  mentions: Array<{ userId: string; displayName: string }>;
  isEdited: boolean;
  createdAt: string;
  creator: { id: string; firstName: string; lastName: string; email: string } | null;
}

interface UserResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  isRead: boolean;
  createdAt: string;
  triggerer: { id: string; firstName: string; lastName: string } | null;
}

function invalidateAllCommentQueries(entityType: string, entityId: string) {
  queryClient.invalidateQueries({ queryKey: ['/api/comments/threads', entityType, entityId] });
  queryClient.invalidateQueries({ queryKey: ['/api/comments/notifications'] });
  queryClient.invalidateQueries({ queryKey: ['/api/comments/notifications/unread-count'] });
}

export function CommentThreadsPanel({ entityType, entityId, entityName }: CommentThreadsPanelProps) {
  const [activeTab, setActiveTab] = useState('threads');
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newSubject, setNewSubject] = useState('');
  const [newThreadComment, setNewThreadComment] = useState('');
  const [replyComment, setReplyComment] = useState('');
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [newThreadMentions, setNewThreadMentions] = useState<Array<{ userId: string; displayName: string }>>([]);
  const [replyMentions, setReplyMentions] = useState<Array<{ userId: string; displayName: string }>>([]);

  const { data: threads = [], isLoading: threadsLoading } = useQuery<Thread[]>({
    queryKey: ['/api/comments/threads', entityType, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/comments/threads?entityType=${entityType}&entityId=${entityId}`);
      return res.json();
    },
  });

  const { data: threadDetail } = useQuery<Thread>({
    queryKey: ['/api/comments/threads', selectedThread],
    queryFn: async () => {
      const res = await fetch(`/api/comments/threads/${selectedThread}`);
      return res.json();
    },
    enabled: !!selectedThread,
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/comments/notifications'],
    queryFn: async () => {
      const res = await fetch('/api/comments/notifications?limit=20');
      return res.json();
    },
  });

  const { data: unreadCount = { unreadCount: 0 } } = useQuery<{ unreadCount: number }>({
    queryKey: ['/api/comments/notifications/unread-count'],
  });

  const { data: userResults = [] } = useQuery<UserResult[]>({
    queryKey: ['/api/comments/users/search', mentionSearch],
    queryFn: async () => {
      if (mentionSearch.length < 2) return [];
      const res = await fetch(`/api/comments/users/search?q=${encodeURIComponent(mentionSearch)}`);
      return res.json();
    },
    enabled: mentionSearch.length >= 2,
  });

  const createThreadMutation = useMutation({
    mutationFn: async (data: { subject: string; content: string; mentions: Array<{ userId: string; displayName: string }> }) => {
      const threadRes = await apiRequest('POST', '/api/comments/threads', {
        entityType,
        entityId,
        subject: data.subject,
      });
      const thread = await threadRes.json();
      
      await apiRequest('POST', `/api/comments/threads/${thread.id}/comments`, {
        content: data.content,
        mentions: data.mentions,
      });
      
      return thread;
    },
    onSuccess: () => {
      invalidateAllCommentQueries(entityType, entityId);
      setNewThreadOpen(false);
      setNewSubject('');
      setNewThreadComment('');
      setNewThreadMentions([]);
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (data: { threadId: string; content: string; mentions: Array<{ userId: string; displayName: string }> }) => {
      const res = await apiRequest('POST', `/api/comments/threads/${data.threadId}/comments`, {
        content: data.content,
        mentions: data.mentions,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateAllCommentQueries(entityType, entityId);
      queryClient.invalidateQueries({ queryKey: ['/api/comments/threads', selectedThread] });
      setReplyComment('');
      setReplyMentions([]);
    },
  });

  const resolveThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const res = await apiRequest('POST', `/api/comments/threads/${threadId}/resolve`, {});
      return res.json();
    },
    onSuccess: () => invalidateAllCommentQueries(entityType, entityId),
  });

  const pinThreadMutation = useMutation({
    mutationFn: async ({ threadId, isPinned }: { threadId: string; isPinned: boolean }) => {
      const res = await apiRequest('POST', `/api/comments/threads/${threadId}/pin`, { isPinned });
      return res.json();
    },
    onSuccess: () => invalidateAllCommentQueries(entityType, entityId),
  });

  const markNotificationReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await apiRequest('POST', `/api/comments/notifications/${notificationId}/read`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/comments/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/comments/notifications/unread-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/comments/notifications/mark-all-read', {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/comments/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/comments/notifications/unread-count'] });
    },
  });

  const addMentionToNewThread = (user: UserResult) => {
    const displayName = `${user.firstName} ${user.lastName}`;
    setNewThreadMentions([...newThreadMentions, { userId: user.id, displayName }]);
    setNewThreadComment((prev) => `${prev}@${displayName} `);
    setMentionSearch('');
    setShowMentionPopover(false);
  };

  const addMentionToReply = (user: UserResult) => {
    const displayName = `${user.firstName} ${user.lastName}`;
    setReplyMentions([...replyMentions, { userId: user.id, displayName }]);
    setReplyComment((prev) => `${prev}@${displayName} `);
    setMentionSearch('');
    setShowMentionPopover(false);
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
  };

  const openThreads = threads.filter((t) => t.status === 'open');
  const resolvedThreads = threads.filter((t) => t.status === 'resolved');

  return (
    <Card className="h-full" data-testid="comment-threads-panel">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Discussion
            {entityName && <span className="text-sm text-muted-foreground font-normal">- {entityName}</span>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
                  <Bell className="h-4 w-4" />
                  {unreadCount.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {unreadCount.unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Notifications</h4>
                  {notifications.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAllReadMutation.mutate()}
                      data-testid="button-mark-all-read"
                    >
                      Mark all read
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-64">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No notifications</p>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-2 rounded text-sm cursor-pointer hover:bg-muted ${!notif.isRead ? 'bg-blue-50 dark:bg-blue-950' : ''}`}
                          onClick={() => markNotificationReadMutation.mutate(notif.id)}
                          data-testid={`notification-${notif.id}`}
                        >
                          <div className="font-medium">{notif.title}</div>
                          {notif.message && <p className="text-muted-foreground text-xs">{notif.message}</p>}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
            <Dialog open={newThreadOpen} onOpenChange={setNewThreadOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-new-thread">
                  <Plus className="h-4 w-4 mr-1" />
                  New Thread
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Start New Discussion</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Subject (optional)"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    data-testid="input-thread-subject"
                  />
                  <div className="relative">
                    <Textarea
                      placeholder="Write your comment... Use @ to mention someone"
                      value={newThreadComment}
                      onChange={(e) => setNewThreadComment(e.target.value)}
                      rows={4}
                      data-testid="textarea-new-comment"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <Popover open={showMentionPopover} onOpenChange={setShowMentionPopover}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" data-testid="button-mention">
                            <AtSign className="h-4 w-4 mr-1" />
                            Mention
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64">
                          <Input
                            placeholder="Search users..."
                            value={mentionSearch}
                            onChange={(e) => setMentionSearch(e.target.value)}
                            data-testid="input-mention-search"
                          />
                          <div className="mt-2 max-h-40 overflow-auto">
                            {userResults.map((user) => (
                              <div
                                key={user.id}
                                className="p-2 hover:bg-muted rounded cursor-pointer flex items-center gap-2"
                                onClick={() => addMentionToNewThread(user)}
                                data-testid={`mention-user-${user.id}`}
                              >
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-xs">
                                    {getInitials(user.firstName, user.lastName)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm">{user.firstName} {user.lastName}</span>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      {newThreadMentions.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {newThreadMentions.map((m, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              @{m.displayName}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => createThreadMutation.mutate({ subject: newSubject, content: newThreadComment, mentions: newThreadMentions })}
                    disabled={!newThreadComment.trim() || createThreadMutation.isPending}
                    data-testid="button-create-thread"
                  >
                    {createThreadMutation.isPending ? 'Creating...' : 'Start Discussion'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2">
            <TabsTrigger value="threads" data-testid="tab-threads">
              Active ({openThreads.length})
            </TabsTrigger>
            <TabsTrigger value="resolved" data-testid="tab-resolved">
              Resolved ({resolvedThreads.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="threads" className="mt-4">
            {threadsLoading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : openThreads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No active discussions</p>
                <p className="text-sm">Start a new thread to collaborate</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {openThreads.map((thread) => (
                    <ThreadCard
                      key={thread.id}
                      thread={thread}
                      isSelected={selectedThread === thread.id}
                      onSelect={() => setSelectedThread(thread.id)}
                      onResolve={() => resolveThreadMutation.mutate(thread.id)}
                      onPin={() => pinThreadMutation.mutate({ threadId: thread.id, isPinned: !thread.isPinned })}
                      getInitials={getInitials}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="resolved" className="mt-4">
            {resolvedThreads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Check className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No resolved discussions</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {resolvedThreads.map((thread) => (
                    <ThreadCard
                      key={thread.id}
                      thread={thread}
                      isSelected={selectedThread === thread.id}
                      onSelect={() => setSelectedThread(thread.id)}
                      getInitials={getInitials}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        {selectedThread && threadDetail && (
          <Dialog open={!!selectedThread} onOpenChange={() => setSelectedThread(null)}>
            <DialogContent className="max-w-2xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {threadDetail.isPinned && <Pin className="h-4 w-4 text-yellow-500" />}
                  {threadDetail.subject || 'Discussion'}
                  <Badge variant={threadDetail.status === 'open' ? 'default' : 'secondary'}>
                    {threadDetail.status}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {threadDetail.comments?.map((comment) => (
                    <div key={comment.id} className="flex gap-3" data-testid={`comment-${comment.id}`}>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {getInitials(comment.creator?.firstName, comment.creator?.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {comment.creator?.firstName} {comment.creator?.lastName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                          </span>
                          {comment.isEdited && (
                            <span className="text-xs text-muted-foreground">(edited)</span>
                          )}
                        </div>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {threadDetail.status === 'open' && (
                <div className="flex gap-2 mt-4">
                  <Textarea
                    placeholder="Add a reply..."
                    value={replyComment}
                    onChange={(e) => setReplyComment(e.target.value)}
                    className="flex-1"
                    rows={2}
                    data-testid="textarea-reply"
                  />
                  <Button
                    onClick={() => addCommentMutation.mutate({
                      threadId: selectedThread,
                      content: replyComment,
                      mentions: replyMentions,
                    })}
                    disabled={!replyComment.trim() || addCommentMutation.isPending}
                    data-testid="button-send-reply"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}

function ThreadCard({
  thread,
  isSelected,
  onSelect,
  onResolve,
  onPin,
  getInitials,
}: {
  thread: Thread;
  isSelected: boolean;
  onSelect: () => void;
  onResolve?: () => void;
  onPin?: () => void;
  getInitials: (firstName?: string, lastName?: string) => string;
}) {
  const lastComment = thread.comments?.[0];

  return (
    <div
      className={`p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? 'border-primary' : ''}`}
      onClick={onSelect}
      data-testid={`thread-${thread.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {thread.isPinned && <Pin className="h-3 w-3 text-yellow-500" />}
          <span className="font-medium text-sm">{thread.subject || 'Discussion'}</span>
          <Badge variant="outline" className="text-xs">
            {thread.commentCount} {thread.commentCount === 1 ? 'comment' : 'comments'}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {onPin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onPin();
              }}
              data-testid={`button-pin-${thread.id}`}
            >
              <Pin className={`h-3 w-3 ${thread.isPinned ? 'text-yellow-500' : ''}`} />
            </Button>
          )}
          {onResolve && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onResolve();
              }}
              data-testid={`button-resolve-${thread.id}`}
            >
              <Check className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      {lastComment && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[10px]">
              {getInitials(lastComment.creator?.firstName, lastComment.creator?.lastName)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate max-w-[200px]">{lastComment.content}</span>
          <span>•</span>
          <span>{formatDistanceToNow(new Date(lastComment.createdAt), { addSuffix: true })}</span>
        </div>
      )}
      <div className="mt-2 text-xs text-muted-foreground">
        Started by {thread.creator?.firstName} {thread.creator?.lastName}
      </div>
    </div>
  );
}
