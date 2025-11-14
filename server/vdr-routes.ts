import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { vdrFileService } from './vdr-file-service';
import { defaultStorageProvider } from './vdr-storage-provider';
import { storage } from './storage';
import { z } from 'zod';
import { insertVdrFolderSchema, insertVdrDocumentSchema, insertVdrDocumentPermissionSchema, insertDiligenceRequestSchema, insertExternalUserSchema } from '@shared/schema';

const router = express.Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

type PermissionLevel = 'no_access' | 'view_only' | 'view_download' | 'view_download_print' | 'full_access';

function permissionMeetsRequirement(userPermission: PermissionLevel, required: PermissionLevel): boolean {
  const hierarchy: PermissionLevel[] = ['no_access', 'view_only', 'view_download', 'view_download_print', 'full_access'];
  const userLevel = hierarchy.indexOf(userPermission);
  const requiredLevel = hierarchy.indexOf(required);
  return userLevel >= requiredLevel;
}

const requireVdrAccess = (capability: 'view' | 'download' | 'print' | 'manage') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { projectId, folderId, documentId } = req.params;
    const userId = (req.user as any).id;
    const orgId = (req.user as any).orgId;

    const capabilityToPermissionLevel: Record<string, PermissionLevel> = {
      'view': 'view_only',
      'download': 'view_download',
      'print': 'view_download_print',
      'manage': 'full_access'
    };

    const requiredLevel = capabilityToPermissionLevel[capability];

    try {
      let resourceType: 'document' | 'folder' | 'project';
      let resourceId: string;

      if (documentId) {
        const doc = await storage.vdr.documents.getDocument(documentId, orgId);
        if (!doc) {
          return res.status(404).json({ error: 'Document not found' });
        }
        resourceType = 'document';
        resourceId = documentId;
      } else if (folderId) {
        const folder = await storage.vdr.folders.getFolder(folderId, orgId);
        if (!folder) {
          return res.status(404).json({ error: 'Folder not found' });
        }
        resourceType = 'folder';
        resourceId = folderId;
      } else if (projectId) {
        const project = await storage.getProject(projectId);
        if (!project || project.orgId !== orgId) {
          return res.status(404).json({ error: 'Project not found' });
        }
        resourceType = 'project';
        resourceId = projectId;
      } else {
        return res.status(400).json({ error: 'No resource specified' });
      }

      const hasAccess = await storage.vdr.permissions.checkUserPermission(
        userId,
        resourceType,
        resourceId,
        orgId,
        requiredLevel
      );

      if (!hasAccess) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (error: any) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

// Get users in organization for permission management
router.get('/users', requireAuth, async (req: Request, res: Response) => {
  const orgId = (req.user as any).orgId;

  try {
    const users = await storage.getUsersByOrganization(orgId);
    res.json(users);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/projects/:projectId/folders', requireAuth, requireVdrAccess('view'), async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const folders = await storage.vdr.folders.getFoldersByProject(projectId, orgId);
    res.json(folders);
  } catch (error: any) {
    console.error('Error fetching folders:', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

router.post('/projects/:projectId/folders', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    const validated = insertVdrFolderSchema.parse({
      ...req.body,
      projectId,
      orgId,
      createdBy: userId
    });

    const folder = await storage.vdr.folders.createFolder(validated);
    
    await storage.vdr.audit.logAction({
      projectId,
      orgId,
      userId,
      action: 'folder_created',
      resourceType: 'folder',
      resourceId: folder.id,
      metadata: { folderName: folder.name }
    });

    res.status(201).json(folder);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
    } else {
      console.error('Error creating folder:', error);
      res.status(500).json({ error: 'Failed to create folder' });
    }
  }
});

router.patch('/folders/:folderId', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { folderId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    const updateSchema = z.object({
      name: z.string().min(1).max(255).optional(),
      parentFolderId: z.string().nullable().optional(),
      displayOrder: z.number().optional(),
    });

    const validated = updateSchema.parse(req.body);

    const existingFolder = await storage.vdr.folders.getFolder(folderId, orgId);
    if (!existingFolder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    if (validated.parentFolderId !== undefined) {
      if (validated.parentFolderId === folderId) {
        return res.status(400).json({ error: 'A folder cannot be its own parent' });
      }

      if (validated.parentFolderId !== null) {
        const targetParent = await storage.vdr.folders.getFolder(validated.parentFolderId, orgId);
        if (!targetParent) {
          return res.status(404).json({ error: 'Target parent folder not found' });
        }

        const allFolders = await storage.vdr.folders.getFoldersByProject(existingFolder.projectId, orgId);
        const isDescendant = (checkId: string, ancestorId: string): boolean => {
          const folder = allFolders.find(f => f.id === checkId);
          if (!folder || !folder.parentFolderId) return false;
          if (folder.parentFolderId === ancestorId) return true;
          return isDescendant(folder.parentFolderId, ancestorId);
        };

        if (isDescendant(validated.parentFolderId, folderId)) {
          return res.status(400).json({ error: 'Cannot move folder into its own descendant' });
        }
      }
    }

    const folder = await storage.vdr.folders.updateFolder(folderId, validated, orgId);
    
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    if (validated.parentFolderId !== undefined && validated.parentFolderId !== existingFolder.parentFolderId) {
      await storage.vdr.audit.logAction({
        projectId: folder.projectId,
        orgId,
        userId,
        action: 'folder_moved',
        resourceType: 'folder',
        resourceId: folderId,
        metadata: { 
          folderName: folder.name,
          oldParentId: existingFolder.parentFolderId,
          newParentId: validated.parentFolderId
        }
      });
    }

    res.json(folder);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error updating folder:', error);
    res.status(500).json({ error: 'Failed to update folder' });
  }
});

router.delete('/folders/:folderId', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { folderId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    const folder = await storage.vdr.folders.getFolder(folderId, orgId);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    await storage.vdr.folders.deleteFolder(folderId, orgId);
    
    await storage.vdr.audit.logAction({
      projectId: folder.projectId,
      orgId,
      userId,
      action: 'folder_deleted',
      resourceType: 'folder',
      resourceId: folderId,
      metadata: { folderName: folder.name }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

const upload = multer(vdrFileService.getMulterConfig());

router.post('/folders/:folderId/documents', requireAuth, requireVdrAccess('manage'), upload.single('file'), async (req: Request, res: Response) => {
  const { folderId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const folder = await storage.vdr.folders.getFolder(folderId, orgId);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const fileInfo = await vdrFileService.processUpload(
      req.file.path,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
      orgId,
      folder.projectId
    );

    const document = await storage.vdr.documents.createDocument({
      folderId,
      projectId: folder.projectId,
      orgId,
      name: req.body.name || req.file.originalname,
      description: req.body.description || null,
      filename: fileInfo.filename,
      mimeType: fileInfo.mimeType,
      size: fileInfo.size,
      storagePath: fileInfo.storagePath,
      checksum: fileInfo.checksum,
      version: 1,
      isCurrentVersion: true,
      uploadedBy: userId
    });

    await storage.vdr.audit.logAction({
      projectId: folder.projectId,
      orgId,
      userId,
      action: 'document_uploaded',
      resourceType: 'document',
      resourceId: document.id,
      metadata: { 
        documentName: document.name,
        size: document.size,
        mimeType: document.mimeType
      }
    });

    res.status(201).json(document);
  } catch (error: any) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: error.message || 'Failed to upload document' });
  }
});

router.get('/documents/:documentId', requireAuth, requireVdrAccess('view'), async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const document = await storage.vdr.documents.getDocument(documentId, orgId);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (error: any) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

router.get('/documents/:documentId/download', requireAuth, requireVdrAccess('download'), async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    const document = await storage.vdr.documents.getDocument(documentId, orgId);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const stream = await defaultStorageProvider.download(document.storagePath);
    
    await storage.vdr.audit.logAction({
      projectId: document.projectId,
      orgId,
      userId,
      action: 'document_downloaded',
      resourceType: 'document',
      resourceId: documentId,
      metadata: { documentName: document.name }
    });

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
    res.setHeader('Content-Length', document.size);
    
    stream.pipe(res);
  } catch (error: any) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

router.patch('/documents/:documentId', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    const updateSchema = z.object({
      name: z.string().min(1).max(255).optional(),
      description: z.string().max(1000).nullable().optional(),
      folderId: z.string().optional(),
    });

    const validated = updateSchema.parse(req.body);

    const existingDocument = await storage.vdr.documents.getDocument(documentId, orgId);
    if (!existingDocument) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (validated.folderId) {
      const targetFolder = await storage.vdr.folders.getFolder(validated.folderId, orgId);
      if (!targetFolder) {
        return res.status(404).json({ error: 'Target folder not found' });
      }

      if (targetFolder.projectId !== existingDocument.projectId) {
        return res.status(400).json({ error: 'Cannot move document to a different project' });
      }
    }

    const document = await storage.vdr.documents.updateDocument(documentId, validated, orgId);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (validated.folderId && validated.folderId !== existingDocument.folderId) {
      await storage.vdr.audit.logAction({
        projectId: document.projectId,
        orgId,
        userId,
        action: 'document_moved',
        resourceType: 'document',
        resourceId: documentId,
        metadata: { 
          documentName: document.name,
          oldFolderId: existingDocument.folderId,
          newFolderId: validated.folderId
        }
      });
    }

    res.json(document);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

router.delete('/documents/:documentId', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    const document = await storage.vdr.documents.getDocument(documentId, orgId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await storage.vdr.documents.deleteDocument(documentId, orgId);
    
    await storage.vdr.audit.logAction({
      projectId: document.projectId,
      orgId,
      userId,
      action: 'document_deleted',
      resourceType: 'document',
      resourceId: documentId,
      metadata: { documentName: document.name }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

router.post('/permissions', requireAuth, async (req: Request, res: Response) => {
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    const validated = insertVdrDocumentPermissionSchema.parse({
      ...req.body,
      orgId,
      grantedBy: userId
    });

    const userPermission = await storage.vdr.permissions.getEffectivePermission(
      userId, 
      validated.resourceType, 
      validated.resourceId, 
      orgId
    );
    
    if (!permissionMeetsRequirement(userPermission, 'full_access')) {
      return res.status(403).json({ error: 'Only users with full access can grant permissions' });
    }

    const permission = await storage.vdr.permissions.grantPermission(validated);
    res.status(201).json(permission);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
    } else {
      console.error('Error granting permission:', error);
      res.status(500).json({ error: 'Failed to grant permission' });
    }
  }
});

router.delete('/permissions/:permissionId', requireAuth, async (req: Request, res: Response) => {
  const { permissionId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    const existingPermission = await storage.vdr.permissions.getPermission(permissionId, orgId);
    if (!existingPermission) {
      return res.status(404).json({ error: 'Permission not found' });
    }

    const userPermission = await storage.vdr.permissions.getEffectivePermission(
      userId, 
      existingPermission.resourceType, 
      existingPermission.resourceId, 
      orgId
    );
    
    if (!permissionMeetsRequirement(userPermission, 'full_access')) {
      return res.status(403).json({ error: 'Only users with full access can revoke permissions' });
    }

    await storage.vdr.permissions.revokePermission(permissionId, orgId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error revoking permission:', error);
    res.status(500).json({ error: 'Failed to revoke permission' });
  }
});

router.get('/resources/:resourceId/permissions', requireAuth, async (req: Request, res: Response) => {
  const { resourceId } = req.params;
  const { resourceType } = req.query;
  const orgId = (req.user as any).orgId;

  if (!resourceType || (resourceType !== 'document' && resourceType !== 'folder')) {
    return res.status(400).json({ error: 'Invalid or missing resourceType' });
  }

  try {
    const permissions = await storage.vdr.permissions.getResourcePermissions(
      resourceId, 
      resourceType as 'document' | 'folder', 
      orgId
    );
    res.json(permissions);
  } catch (error: any) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

router.get('/projects/:projectId/requests', requireAuth, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const requests = await storage.vdr.requests.getRequestsByProject(projectId, orgId);
    res.json(requests);
  } catch (error: any) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

router.post('/projects/:projectId/requests', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    const validated = insertDiligenceRequestSchema.parse({
      ...req.body,
      projectId,
      orgId,
      requestedBy: userId
    });

    const request = await storage.vdr.requests.createRequest(validated);
    res.status(201).json(request);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
    } else {
      console.error('Error creating request:', error);
      res.status(500).json({ error: 'Failed to create request' });
    }
  }
});

router.patch('/requests/:requestId', requireAuth, async (req: Request, res: Response) => {
  const { requestId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const request = await storage.vdr.requests.updateRequest(requestId, req.body, orgId);
    
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json(request);
  } catch (error: any) {
    console.error('Error updating request:', error);
    res.status(500).json({ error: 'Failed to update request' });
  }
});

router.post('/projects/:projectId/external-users', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const validated = insertExternalUserSchema.parse({
      ...req.body,
      orgId
    });

    const externalUser = await storage.vdr.externalUsers.createExternalUser(validated);
    
    await storage.vdr.externalUsers.grantProjectAccess({
      externalUserId: externalUser.id,
      projectId,
      orgId,
      accessLevel: req.body.accessLevel || 'view_only'
    });

    res.status(201).json(externalUser);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
    } else {
      console.error('Error creating external user:', error);
      res.status(500).json({ error: 'Failed to create external user' });
    }
  }
});

router.get('/projects/:projectId/audit', requireAuth, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const auditLogs = await storage.vdr.audit.getProjectAuditLogs(projectId, orgId);
    res.json(auditLogs);
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
