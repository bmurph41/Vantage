import { useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { FolderTree } from "./FolderTree";
import { DocumentList } from "./DocumentList";
import { useVdrProject } from "@/hooks/useVdrProject";

type DocumentsWorkspaceProps = {
  projectId: string;
};

export function DocumentsWorkspace({ projectId }: DocumentsWorkspaceProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const vdr = useVdrProject(projectId);

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
        <FolderTree
          projectId={projectId}
          folders={vdr.folderTree}
          isLoading={vdr.foldersLoading}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
          onCreateFolder={vdr.createFolder}
          onUpdateFolder={vdr.updateFolder}
          onDeleteFolder={vdr.deleteFolder}
          isCreating={vdr.isCreatingFolder}
          isUpdating={vdr.isUpdatingFolder}
          isDeleting={vdr.isDeletingFolder}
        />
      </ResizablePanel>
      
      <ResizableHandle withHandle />
      
      <ResizablePanel defaultSize={70}>
        <DocumentList
          folderId={selectedFolderId}
          projectId={projectId}
          onUpload={(formData) => {
            if (selectedFolderId) {
              vdr.uploadDocument({ folderId: selectedFolderId, formData });
            }
          }}
          onDelete={(documentId) => {
            if (selectedFolderId) {
              vdr.deleteDocument({ documentId, folderId: selectedFolderId });
            }
          }}
          isUploading={vdr.isUploadingDocument}
          isDeleting={vdr.isDeletingDocument}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
