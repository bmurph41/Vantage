import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Clock, MessageCircle, Edit, Trash2, Plus, User, Calendar } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { TimelineNote } from "@shared/schema";

interface TimelineNotesProps {
  taskId: string;
  taskTitle: string;
}

interface NewNoteForm {
  content: string;
  noteType: string;
}

export function TimelineNotes({ taskId, taskTitle }: TimelineNotesProps) {
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState<NewNoteForm>({ content: "", noteType: "general" });
  const [editContent, setEditContent] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch timeline notes
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['/api/dd/tasks', taskId, 'timeline-notes'],
    queryFn: () => apiRequest(`/api/dd/tasks/${taskId}/timeline-notes`),
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (noteData: { content: string; noteType: string }) => {
      return apiRequest(`/api/dd/tasks/${taskId}/timeline-notes`, {
        method: "POST",
        body: JSON.stringify(noteData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/tasks', taskId, 'timeline-notes'] });
      setNewNote({ content: "", noteType: "general" });
      setIsAddingNote(false);
      toast({
        title: "Success",
        description: "Note added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    },
  });

  // Update note mutation
  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      return apiRequest(`/api/dd/timeline-notes/${id}`, {
        method: "PUT",
        body: JSON.stringify({ content }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/tasks', taskId, 'timeline-notes'] });
      setEditingNoteId(null);
      setEditContent("");
      toast({
        title: "Success",
        description: "Note updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update note",
        variant: "destructive",
      });
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/dd/timeline-notes/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/tasks', taskId, 'timeline-notes'] });
      toast({
        title: "Success",
        description: "Note deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete note",
        variant: "destructive",
      });
    },
  });

  const handleAddNote = () => {
    if (!newNote.content.trim()) return;
    createNoteMutation.mutate(newNote);
  };

  const handleEditNote = (note: TimelineNote) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  const handleSaveEdit = () => {
    if (!editContent.trim() || !editingNoteId) return;
    updateNoteMutation.mutate({ id: editingNoteId, content: editContent });
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditContent("");
  };

  const getNoteTypeColor = (type: string) => {
    switch (type) {
      case "status_update":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "contact_interaction":
        return "bg-green-100 text-green-800 border-green-200";
      case "general":
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getNoteTypeIcon = (type: string) => {
    switch (type) {
      case "status_update":
        return <Calendar className="h-3 w-3" />;
      case "contact_interaction":
        return <User className="h-3 w-3" />;
      case "general":
      default:
        return <MessageCircle className="h-3 w-3" />;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timeline Notes - {taskTitle}
          </CardTitle>
          <Button
            onClick={() => setIsAddingNote(true)}
            size="sm"
            disabled={isAddingNote}
            data-testid="button-add-note"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Note
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new note form */}
        {isAddingNote && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4 space-y-3">
              <div>
                <Label htmlFor="noteType">Note Type</Label>
                <Select value={newNote.noteType} onValueChange={(value) => setNewNote({ ...newNote, noteType: value })}>
                  <SelectTrigger data-testid="select-note-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Note</SelectItem>
                    <SelectItem value="status_update">Status Update</SelectItem>
                    <SelectItem value="contact_interaction">Contact Interaction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="noteContent">Note</Label>
                <Textarea
                  id="noteContent"
                  value={newNote.content}
                  onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                  placeholder="Enter your note..."
                  rows={3}
                  data-testid="textarea-note-content"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddingNote(false);
                    setNewNote({ content: "", noteType: "general" });
                  }}
                  data-testid="button-cancel-note"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddNote}
                  disabled={!newNote.content.trim() || createNoteMutation.isPending}
                  data-testid="button-save-note"
                >
                  {createNoteMutation.isPending ? "Saving..." : "Save Note"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <ScrollArea className="h-96">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading notes...</div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No notes yet. Add a note to start tracking timeline events.
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map((note: TimelineNote, index: number) => (
                <div key={note.id} className="relative">
                  {/* Timeline line */}
                  {index < notes.length - 1 && (
                    <div className="absolute left-4 top-12 w-px h-full bg-gray-200 -z-10" />
                  )}
                  
                  <div className="flex gap-3" data-testid={`timeline-note-${index}`}>
                    {/* Timeline dot */}
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 border-2 border-blue-300 rounded-full flex items-center justify-center mt-1">
                      {getNoteTypeIcon(note.noteType)}
                    </div>
                    
                    {/* Note content */}
                    <Card className="flex-1">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className={`text-xs ${getNoteTypeColor(note.noteType)}`}>
                              {note.noteType.replace('_', ' ').toUpperCase()}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(note.createdAt), "MMM d, yyyy 'at' h:mm a")}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditNote(note)}
                              data-testid={`button-edit-note-${index}`}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteNoteMutation.mutate(note.id)}
                              data-testid={`button-delete-note-${index}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        {editingNoteId === note.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              rows={3}
                              data-testid={`textarea-edit-note-${index}`}
                            />
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCancelEdit}
                                data-testid={`button-cancel-edit-${index}`}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleSaveEdit}
                                disabled={!editContent.trim() || updateNoteMutation.isPending}
                                data-testid={`button-save-edit-${index}`}
                              >
                                {updateNoteMutation.isPending ? "Saving..." : "Save"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}