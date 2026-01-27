import { storage } from "../storage";

export async function initializeVdrForProject(
  projectId: string,
  orgId: string,
  userId: string
): Promise<{ success: boolean; foldersCreated: number; error?: string }> {
  try {
    const existingFolders = await storage.vdr.folders.getFoldersForProject(projectId, orgId);
    if (existingFolders.length > 0) {
      return { success: true, foldersCreated: 0 };
    }

    const defaultTemplate = await storage.vdr.templates.getDefaultTemplate();
    if (!defaultTemplate) {
      console.log(`[VDR Init] No default template found for project ${projectId}`);
      return { success: true, foldersCreated: 0 };
    }

    const templateFolders = await storage.vdr.templates.getTemplateFolders(defaultTemplate.id);
    if (templateFolders.length === 0) {
      return { success: true, foldersCreated: 0 };
    }

    const folderMap: Record<string, string> = {};
    let foldersCreated = 0;

    const getDepth = (folderId: string | null): number => {
      if (!folderId) return 0;
      const folder = templateFolders.find(f => f.id === folderId);
      if (!folder) return 0;
      return 1 + getDepth(folder.parentFolderId);
    };

    const sortedFolders = [...templateFolders].sort((a, b) => {
      const depthA = getDepth(a.parentFolderId);
      const depthB = getDepth(b.parentFolderId);
      if (depthA !== depthB) return depthA - depthB;
      return a.displayOrder - b.displayOrder;
    });

    for (const tf of sortedFolders) {
      let parentVdrId: string | null = null;
      let basePath = "";

      if (tf.parentFolderId) {
        parentVdrId = folderMap[tf.parentFolderId] || null;
        if (!parentVdrId) {
          console.warn(`[VDR Init] Skipping folder ${tf.name}: parent not yet created`);
          continue;
        }
        const parent = await storage.vdr.folders.getFolder(parentVdrId, orgId);
        basePath = parent?.path || "";
      }

      const folder = await storage.vdr.folders.createFolder({
        projectId,
        parentFolderId: parentVdrId,
        name: tf.name,
        path: basePath ? `${basePath}/${tf.name}` : `/${tf.name}`,
        displayOrder: tf.displayOrder,
        description: tf.description,
        orgId,
        createdBy: userId,
      });
      folderMap[tf.id] = folder.id;
      foldersCreated++;
    }

    console.log(`[VDR Init] Created ${foldersCreated} folders for project ${projectId}`);
    return { success: true, foldersCreated };
  } catch (error: any) {
    console.error(`[VDR Init] Failed to initialize VDR for project ${projectId}:`, error);
    return { success: false, foldersCreated: 0, error: error.message };
  }
}
