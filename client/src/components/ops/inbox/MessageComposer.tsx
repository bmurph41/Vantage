import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { 
  Send, 
  Clock, 
  StickyNote,
  FileText
} from "lucide-react";

interface MessageComposerProps {
  onSend: (body: string, isNote: boolean) => void;
  isSending: boolean;
}

export function MessageComposer({ onSend, isSending }: MessageComposerProps) {
  const [body, setBody] = useState("");
  const [isNote, setIsNote] = useState(false);

  const handleSend = () => {
    if (!body.trim()) return;
    onSend(body, isNote);
    setBody("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Toggle
          pressed={isNote}
          onPressedChange={setIsNote}
          size="sm"
          className={isNote ? "bg-amber-100 text-amber-700" : ""}
        >
          <StickyNote className="w-4 h-4 mr-1" />
          Internal Note
        </Toggle>
        <Button variant="ghost" size="sm">
          <FileText className="w-4 h-4 mr-1" />
          Templates
        </Button>
        <Button variant="ghost" size="sm">
          <Clock className="w-4 h-4 mr-1" />
          Schedule
        </Button>
      </div>
      <div className="flex gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isNote ? "Add an internal note..." : "Type your message..."}
          className={`flex-1 min-h-[80px] resize-none ${
            isNote ? "border-amber-200 bg-amber-50" : ""
          }`}
        />
      </div>
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">
          Press Cmd+Enter to send
        </span>
        <Button onClick={handleSend} disabled={!body.trim() || isSending}>
          <Send className="w-4 h-4 mr-2" />
          {isNote ? "Add Note" : "Send"}
        </Button>
      </div>
    </div>
  );
}
