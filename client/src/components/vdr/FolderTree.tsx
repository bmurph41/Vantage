import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Folder, FolderOpen, FolderPlus, MoreVertical, Edit2, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type VdrFolder = {
  id: string;
  name: string;
  projectId: string;
  parentFolderId: string | null;
  children?: VdrFolder[];
};

type FolderTreeProps = {
  projectId: string;
  folders: VdrFolder[];
  isLoading: boolean;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (data: { name: string; parentFolderId?: string }) => void;
  onUpdateFolder: (data: { folderId: string; data: { name: string } }) => void;
  onDeleteFolder: (folderId: string) => void;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
};

export function FolderTree({
  projectId,
  folders,
  isLoading,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  isCreating,
  isUpdating,
  isDeleting,
}: FolderTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [creatingUnder, setCreatingUnder] = useState<string | 'root' | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);

  const toggleExpanded = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder({
        name: newFolderName.trim(),
        parentFolderId: creatingUnder && creatingUnder !== 'root' ? creatingUnder : undefined,
      });
      setNewFolderName("");
      setCreatingUnder(null);
    }
  };

  const handleUpdateFolder = (folderId: string) => {
    if (editName.trim()) {
      onUpdateFolder({
        folderId,
        data: { name: editName.trim() },
      });
      setEditingFolderId(null);
      setEditName("");
    }
  };

  const handleDeleteClick = (folderId: string) => {
    setFolderToDelete(folderId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (folderToDelete) {
      onDeleteFolder(folderToDelete);
      setDeleteDialogOpen(false);
      setFolderToDelete(null);
    }
  };

  const renderFolder = (folder: VdrFolder, level: number = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const hasChildren = folder.children && folder.children.length > 0;
    const isEditing = editingFolderId === folder.id;

    return (
      <div key={folder.id}>
        <ContextMenu>
          <ContextMenuTrigger>
            <div
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-gray-100 transition-colors",
                isSelected && "bg-blue-50 hover:bg-blue-100",
                level > 0 && "ml-4"
              )}
              onClick={() => {
                onSelectFolder(folder.id);
                if (hasChildren) toggleExpanded(folder.id);
              }}
              data-testid={`folder-${folder.id}`}
            >
              {hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded(folder.id);
                  }}
                  className="p-0.5 hover:bg-gray-200 rounded"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              )}
              {!hasChildren && <div className="w-5" />}
              {isExpanded ? <FolderOpen className="h-4 w-4 text-blue-600" /> : <Folder className="h-4 w-4 text-gray-600" />}
              {isEditing ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdateFolder(folder.id);
                    if (e.key === "Escape") {
                      setEditingFolderId(null);
                      setEditName("");
                    }
                  }}
                  onBlur={() => handleUpdateFolder(folder.id)}
                  className="h-6 text-sm"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-sm flex-1 truncate">{folder.name}</span>
              )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem
              onClick={() => setCreatingUnder(folder.id)}
              data-testid={`create-subfolder-${folder.id}`}
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              New Subfolder
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                setEditingFolderId(folder.id);
                setEditName(folder.name);
              }}
              data-testid={`rename-folder-${folder.id}`}
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Rename
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => handleDeleteClick(folder.id)}
              className="text-red-600"
              data-testid={`delete-folder-${folder.id}`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {creatingUnder === folder.id && (
          <div className="ml-8 mt-1 flex items-center gap-2" data-testid="new-folder-input">
            <FolderPlus className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") {
                  setCreatingUnder(null);
                  setNewFolderName("");
                }
              }}
              onBlur={handleCreateFolder}
              className="h-6 text-sm"
              autoFocus
            />
          </div>
        )}

        {isExpanded && hasChildren && (
          <div className="mt-0.5">
            {folder.children!.map((child) => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="h-full border-r bg-gray-50 p-4 space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full ml-4" />
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }

  return (
    <div className="h-full border-r bg-gray-50 flex flex-col">
      <div className="p-4 border-b bg-white space-y-2">
        <Button
          onClick={() => setCreatingUnder('root')}
          className="w-full"
          size="sm"
          data-testid="button-create-root-folder"
        >
          <FolderPlus className="h-4 w-4 mr-2" />
          New Folder
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {creatingUnder === 'root' && (
          <div className="mb-2 flex items-center gap-2" data-testid="new-folder-input">
            <FolderPlus className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") {
                  setNewFolderName("");
                  setCreatingUnder(null);
                }
              }}
              onBlur={() => {
                if (newFolderName.trim()) {
                  handleCreateFolder();
                } else {
                  setNewFolderName("");
                  setCreatingUnder(null);
                }
              }}
              className="h-6 text-sm"
              autoFocus
            />
          </div>
        )}

        {folders.length === 0 && creatingUnder !== 'root' ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No folders yet. Click "New Folder" to create one.
          </div>
        ) : (
          <div className="space-y-0.5">
            {folders.map((folder) => renderFolder(folder))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this folder and all its contents (subfolders and documents).
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
