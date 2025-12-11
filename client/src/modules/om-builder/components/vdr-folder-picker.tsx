import { useState } from "react";
import { FolderOpen, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import type { VdrFolder } from "@shared/schema";

interface VdrFolderPickerProps {
  projectId: string | null;
  onSelect: (folder: VdrFolder) => void;
  selectedFolderId?: string;
  trigger?: React.ReactNode;
}

interface FolderTreeItemProps {
  folder: VdrFolder;
  allFolders: VdrFolder[];
  selectedId?: string;
  onSelect: (folder: VdrFolder) => void;
  level?: number;
}

function FolderTreeItem({ folder, allFolders, selectedId, onSelect, level = 0 }: FolderTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const children = allFolders.filter(f => f.parentFolderId === folder.id);
  const hasChildren = children.length > 0;
  const isSelected = selectedId === folder.id;

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors ${
          isSelected 
            ? 'bg-primary text-primary-foreground' 
            : 'hover:bg-muted'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(folder)}
        data-testid={`folder-item-${folder.id}`}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-0.5 hover:bg-muted-foreground/20 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <FolderOpen className={`w-4 h-4 ${isSelected ? '' : 'text-amber-500'}`} />
        <span className="text-sm truncate">{folder.name}</span>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {children
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map(child => (
              <FolderTreeItem
                key={child.id}
                folder={child}
                allFolders={allFolders}
                selectedId={selectedId}
                onSelect={onSelect}
                level={level + 1}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export function VdrFolderPicker({ projectId, onSelect, selectedFolderId, trigger }: VdrFolderPickerProps) {
  const [open, setOpen] = useState(false);
  const [localSelectedId, setLocalSelectedId] = useState<string | undefined>(selectedFolderId);
  const [localSelectedFolder, setLocalSelectedFolder] = useState<VdrFolder | null>(null);

  const { data: folders = [], isLoading } = useQuery<VdrFolder[]>({
    queryKey: ['/api/vdr/projects', projectId, 'folders'],
    enabled: !!projectId && open,
  });

  const rootFolders = folders.filter(f => !f.parentFolderId);

  const handleFolderClick = (folder: VdrFolder) => {
    setLocalSelectedId(folder.id);
    setLocalSelectedFolder(folder);
  };

  const handleConfirm = () => {
    if (localSelectedFolder) {
      onSelect(localSelectedFolder);
      setOpen(false);
    }
  };

  if (!projectId) {
    return (
      <Button variant="outline" disabled className="w-full justify-start text-muted-foreground">
        <FolderOpen className="w-4 h-4 mr-2" />
        No project linked
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="w-full justify-start" data-testid="button-select-vdr-folder">
            <FolderOpen className="w-4 h-4 mr-2" />
            {selectedFolderId ? 'Change folder...' : 'Select VDR folder...'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Data Room Folder</DialogTitle>
          <DialogDescription>
            Choose where to save the exported document
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : folders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No folders found in this project's data room</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px] border rounded-md p-2">
              {rootFolders
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map(folder => (
                  <FolderTreeItem
                    key={folder.id}
                    folder={folder}
                    allFolders={folders}
                    selectedId={localSelectedId}
                    onSelect={handleFolderClick}
                  />
                ))}
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!localSelectedFolder}
            data-testid="button-confirm-folder"
          >
            Select Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
