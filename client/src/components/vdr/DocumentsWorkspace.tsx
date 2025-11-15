import { useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { FolderTree } from "./FolderTree";
import { DocumentList } from "./DocumentList";
import { TemplateSelector } from "./TemplateSelector";
import { useVdrProject } from "@/hooks/useVdrProject";
import { FolderTree as FolderTreeIcon } from "lucide-react";

type DocumentsWorkspaceProps = {
  projectId: string;
};

export function DocumentsWorkspace({ projectId }: DocumentsWorkspaceProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const vdr = useVdrProject(projectId);

  const hasFolders = vdr.folders.length > 0;

  return (
    <>
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
          <div className="h-full flex flex-col">
            {!vdr.foldersLoading && !hasFolders && (
              <div className="p-4 bg-blue-50 border-b border-blue-200">
                <p className="text-sm text-blue-800 mb-2">No folders yet</p>
                <Button
                  size="sm"
                  onClick={() => setTemplateSelectorOpen(true)}
                  className="w-full"
                  data-testid="button-open-template-selector"
                >
                  <FolderTreeIcon className="h-4 w-4 mr-2" />
                  Apply Folder Template
                </Button>
              </div>
            )}
            <div className="flex-1">
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
            </div>
          </div>
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        <ResizablePanel defaultSize={70}>
          <DocumentList
            folderId={selectedFolderId}
            projectId={projectId}
            uploadDocumentAsync={vdr.uploadDocumentAsync}
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

      <TemplateSelector
        projectId={projectId}
        open={templateSelectorOpen}
        onClose={() => setTemplateSelectorOpen(false)}
      />
    </>
  );
}
