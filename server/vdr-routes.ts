import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import archiver from 'archiver';
import { vdrFileService } from './vdr-file-service';
import { defaultStorageProvider } from './vdr-storage-provider';
import { storage } from './storage';
import { z } from 'zod';
import { insertVdrFolderSchema, insertVdrDocumentSchema, insertVdrDocumentPermissionSchema, insertDiligenceRequestSchema, insertExternalUserSchema, vdrDocuments, vdrAuditLogs, projects, externalUsers, users, externalUserProjectAccess, vdrDiligenceCategories, vdrDueDatePresets, projectContacts, contacts } from '@shared/schema';
import { db } from './db';
import { eq, and, desc, sql, isNotNull, inArray } from 'drizzle-orm';
import { ensureDefaultCategories } from './vdr-diligence-category-service';
import { ensureDefaultDueDatePresets } from './vdr-due-date-preset-service';
import { vdrAuditService } from './services/vdr-audit-service';

const router = express.Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
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
        const [project] = await db.select()
          .from(projects)
          .where(and(
            eq(projects.id, projectId),
            eq(projects.orgId, orgId)
          ))
          .limit(1);
        if (!project) {
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
    const folders = await storage.vdr.folders.getFoldersForProject(projectId, orgId);
    
    // Fetch document counts for each folder
    const foldersWithCounts = await Promise.all(
      folders.map(async (folder) => {
        const documents = await storage.vdr.documents.getDocumentsForFolder(folder.id, orgId);
        return {
          ...folder,
          documentCount: documents.length
        };
      })
    );
    
    res.json(foldersWithCounts);
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
    const { name, parentFolderId } = req.body;
    
    // Check for duplicate folder name under same parent
    const existingFolders = await storage.vdr.folders.getFoldersForProject(projectId, orgId);
    const duplicate = existingFolders.find(f => 
      f.name.toLowerCase() === name.toLowerCase() && 
      f.parentFolderId === (parentFolderId || null)
    );

    if (duplicate) {
      // Build path to show where duplicate exists
      const buildPath = (folderId: string | null): string => {
        if (!folderId) return '/';
        const folder = existingFolders.find(f => f.id === folderId);
        if (!folder) return '/';
        const parentPath = folder.parentFolderId ? buildPath(folder.parentFolderId) : '';
        return `${parentPath}/${folder.name}`;
      };

      const duplicatePath = buildPath(duplicate.id);
      return res.status(409).json({ 
        error: 'Duplicate folder name',
        message: `A folder named "${name}" already exists at this location`,
        duplicateLocation: duplicatePath,
        duplicateId: duplicate.id
      });
    }

    // Build the path for the new folder
    let path = '/';
    if (parentFolderId) {
      const parentFolder = existingFolders.find(f => f.id === parentFolderId);
      if (parentFolder) {
        path = `${parentFolder.path}/${name}`;
      } else {
        path = `/${name}`;
      }
    } else {
      path = `/${name}`;
    }

    // Validate the input
    const validated = insertVdrFolderSchema.parse({
      name,
      parentFolderId,
      path,
      projectId,
    });

    // Add the fields that are auto-filled and omitted from schema
    const folderData = {
      ...validated,
      orgId,
      createdBy: userId
    };

    const folder = await storage.vdr.folders.createFolder(folderData as any);
    
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

        const allFolders = await storage.vdr.folders.getFoldersForProject(existingFolder.projectId, orgId);
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

// Get documents for a folder
router.get('/folders/:folderId/documents', requireAuth, requireVdrAccess('view'), async (req: Request, res: Response) => {
  const { folderId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const folder = await storage.vdr.folders.getFolder(folderId, orgId);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const documents = await storage.vdr.documents.getDocumentsForFolder(folderId, orgId);
    res.json(documents);
  } catch (error: any) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

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

    // Check for duplicate document name in same folder
    const documentName = req.body.name || req.file.originalname;
    const existingDocuments = await storage.vdr.documents.getDocumentsForFolder(folderId, orgId);
    const duplicate = existingDocuments.find(d => 
      d.filename.toLowerCase() === documentName.toLowerCase()
    );

    if (duplicate) {
      // Build folder path for error message
      const buildFolderPath = async (fId: string): Promise<string> => {
        const f = await storage.vdr.folders.getFolder(fId, orgId);
        if (!f) return '/';
        if (!f.parentFolderId) return `/${f.name}`;
        const parentPath = await buildFolderPath(f.parentFolderId);
        return `${parentPath}/${f.name}`;
      };

      const folderPath = await buildFolderPath(folderId);
      return res.status(409).json({
        error: 'Duplicate document name',
        message: `A document named "${documentName}" already exists in this folder`,
        duplicateLocation: folderPath,
        duplicateId: duplicate.id,
        duplicateName: duplicate.filename
      });
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
      filename: documentName,
      originalFilename: req.file.originalname,
      description: req.body.description || null,
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
        documentName: document.filename,
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

router.get('/documents/:documentId/preview', requireAuth, requireVdrAccess('view'), async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    const document = await storage.vdr.documents.getDocument(documentId, orgId);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const stream = await defaultStorageProvider.download(document.storagePath);
    
    await vdrAuditService.logEvent({
      projectId: document.projectId,
      orgId,
      userId,
      documentId,
      eventType: 'document_viewed',
      metadata: { documentName: document.filename, previewMode: true },
      req,
    });

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${document.filename}"`);
    res.setHeader('Content-Length', document.size);
    res.setHeader('Cache-Control', 'private, max-age=300');
    
    stream.pipe(res);
  } catch (error: any) {
    console.error('Error previewing document:', error);
    res.status(500).json({ error: 'Failed to preview document' });
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
    
    await vdrAuditService.logEvent({
      projectId: document.projectId,
      orgId,
      userId,
      documentId,
      eventType: 'document_downloaded',
      metadata: { documentName: document.filename },
      req,
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
          documentName: document.filename,
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
      metadata: { documentName: document.filename }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

router.get('/documents/:documentId/versions', requireAuth, requireVdrAccess('view'), async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const document = await storage.vdr.documents.getDocument(documentId, orgId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const rootDocumentId = document.parentDocumentId || documentId;
    const versions = await storage.vdr.documents.getDocumentVersions(rootDocumentId, orgId);
    
    const currentVersion = await storage.vdr.documents.getDocument(rootDocumentId, orgId);
    const allVersions = currentVersion ? [currentVersion, ...versions] : versions;

    res.json(allVersions);
  } catch (error: any) {
    console.error('Error fetching document versions:', error);
    res.status(500).json({ error: 'Failed to fetch document versions' });
  }
});

router.post('/documents/:documentId/versions', requireAuth, requireVdrAccess('manage'), upload.single('file'), async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const existingDocument = await storage.vdr.documents.getDocument(documentId, orgId);
    if (!existingDocument) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const fileInfo = await vdrFileService.processUpload(
      req.file.path,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
      orgId,
      existingDocument.projectId
    );

    const rootDocumentId = existingDocument.parentDocumentId || documentId;
    const newVersion = await storage.vdr.documents.createDocumentVersion(rootDocumentId, {
      name: req.body.name || existingDocument.name,
      description: req.body.description || existingDocument.description,
      filename: fileInfo.filename,
      originalFilename: req.file.originalname,
      mimeType: fileInfo.mimeType,
      size: fileInfo.size,
      storagePath: fileInfo.storagePath,
      checksum: fileInfo.checksum,
      uploadedBy: userId,
      orgId
    }, orgId);

    await storage.vdr.audit.logAction({
      projectId: existingDocument.projectId,
      orgId,
      userId,
      action: 'document_version_created',
      resourceType: 'document',
      resourceId: newVersion.id,
      metadata: { 
        documentName: newVersion.name,
        version: newVersion.version,
        size: newVersion.size
      }
    });

    res.status(201).json(newVersion);
  } catch (error: any) {
    console.error('Error creating document version:', error);
    res.status(500).json({ error: error.message || 'Failed to create document version' });
  }
});

router.post('/documents/:documentId/versions/:versionId/restore', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { documentId, versionId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    const currentDocument = await storage.vdr.documents.getDocument(documentId, orgId);
    if (!currentDocument) {
      return res.status(404).json({ error: 'Current document not found' });
    }

    const versionToRestore = await storage.vdr.documents.getDocument(versionId, orgId);
    if (!versionToRestore) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const rootDocumentId = currentDocument.parentDocumentId || documentId;
    
    const restoredVersion = await storage.vdr.documents.createDocumentVersion(rootDocumentId, {
      name: versionToRestore.name,
      description: versionToRestore.description,
      filename: versionToRestore.filename,
      originalFilename: versionToRestore.originalFilename,
      mimeType: versionToRestore.mimeType,
      size: versionToRestore.size,
      storagePath: versionToRestore.storagePath,
      checksum: versionToRestore.checksum,
      uploadedBy: userId,
      orgId
    }, orgId);

    await storage.vdr.audit.logAction({
      projectId: currentDocument.projectId,
      orgId,
      userId,
      action: 'document_version_restored',
      resourceType: 'document',
      resourceId: restoredVersion.id,
      metadata: { 
        documentName: restoredVersion.name,
        restoredFromVersion: versionToRestore.version,
        newVersion: restoredVersion.version
      }
    });

    res.status(201).json(restoredVersion);
  } catch (error: any) {
    console.error('Error restoring document version:', error);
    res.status(500).json({ error: error.message || 'Failed to restore document version' });
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

router.get('/projects/:projectId/external-users', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const externalUsers = await storage.vdr.externalUsers.getExternalUsersForProject(projectId, orgId);
    res.json(externalUsers);
  } catch (error: any) {
    console.error('Error fetching external users:', error);
    res.status(500).json({ error: 'Failed to fetch external users' });
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
    const auditLogs = await storage.vdr.audit.getAuditLogsForProject(projectId, orgId);
    res.json(auditLogs);
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get organization-wide VDR statistics
router.get('/statistics', requireAuth, async (req: Request, res: Response) => {
  const orgId = (req.user as any).orgId;

  try {
    // Count total documents across all projects using direct database query
    const documentCount = await db.select({ count: sql<number>`count(*)::int` })
      .from(vdrDocuments)
      .where(eq(vdrDocuments.orgId, orgId));

    // Count external users (active only)
    const activeExternalUsers = await db.select({ count: sql<number>`count(*)::int` })
      .from(externalUsers)
      .where(and(
        eq(externalUsers.orgId, orgId),
        eq(externalUsers.isActive, true)
      ));

    // Count recent activity (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentActivity = await db.select({ count: sql<number>`count(*)::int` })
      .from(vdrAuditLogs)
      .where(and(
        eq(vdrAuditLogs.orgId, orgId),
        sql`${vdrAuditLogs.timestamp} >= ${twentyFourHoursAgo}`
      ));

    res.json({
      totalDocuments: documentCount[0]?.count || 0,
      externalUsers: activeExternalUsers[0]?.count || 0,
      recentActivity: recentActivity[0]?.count || 0,
    });
  } catch (error: any) {
    console.error('Error fetching VDR statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get project statistics (folder and document counts)
router.get('/projects/:projectId/statistics', requireAuth, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const folders = await storage.vdr.folders.getFoldersForProject(projectId, orgId);
    
    // Get total document count across all folders
    let totalDocuments = 0;
    for (const folder of folders) {
      const documents = await storage.vdr.documents.getDocumentsForFolder(folder.id, orgId);
      totalDocuments += documents.length;
    }

    res.json({
      folderCount: folders.length,
      documentCount: totalDocuments,
    });
  } catch (error: any) {
    console.error('Error fetching project statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

router.get('/projects/:projectId/analytics', requireAuth, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const documents = await storage.vdr.documents.getDocumentsForProject(projectId, orgId);
    const auditLogs = await storage.vdr.audit.getAuditLogsForProject(projectId, orgId);

    const documentStats = await db.select({
      documentId: vdrAuditLogs.documentId,
      documentName: vdrDocuments.filename,
      viewCount: sql<number>`COUNT(CASE WHEN ${vdrAuditLogs.eventType} IN ('document_viewed', 'document_downloaded') THEN 1 END)`.as('view_count'),
      downloadCount: sql<number>`COUNT(CASE WHEN ${vdrAuditLogs.eventType} = 'document_downloaded' THEN 1 END)`.as('download_count'),
      lastAccessed: sql<Date>`MAX(${vdrAuditLogs.timestamp})`.as('last_accessed')
    })
      .from(vdrAuditLogs)
      .leftJoin(vdrDocuments, eq(vdrAuditLogs.documentId, vdrDocuments.id))
      .where(and(
        eq(vdrDocuments.projectId, projectId),
        eq(vdrAuditLogs.orgId, orgId),
        isNotNull(vdrAuditLogs.documentId)
      ))
      .groupBy(vdrAuditLogs.documentId, vdrDocuments.filename)
      .orderBy(desc(sql`view_count`))
      .limit(10);

    const activityByDay = await db.select({
      date: sql<string>`DATE(${vdrAuditLogs.timestamp})`.as('date'),
      views: sql<number>`COUNT(CASE WHEN ${vdrAuditLogs.eventType} IN ('document_viewed', 'document_downloaded') THEN 1 END)`.as('views'),
      downloads: sql<number>`COUNT(CASE WHEN ${vdrAuditLogs.eventType} = 'document_downloaded' THEN 1 END)`.as('downloads'),
      uploads: sql<number>`COUNT(CASE WHEN ${vdrAuditLogs.eventType} IN ('document_uploaded', 'document_version_created') THEN 1 END)`.as('uploads')
    })
      .from(vdrAuditLogs)
      .leftJoin(vdrDocuments, eq(vdrAuditLogs.documentId, vdrDocuments.id))
      .where(and(
        eq(vdrDocuments.projectId, projectId),
        eq(vdrAuditLogs.orgId, orgId),
        sql`${vdrAuditLogs.timestamp} >= CURRENT_DATE - INTERVAL '30 days'`
      ))
      .groupBy(sql`DATE(${vdrAuditLogs.timestamp})`)
      .orderBy(sql`date DESC`);

    const userEngagement = await storage.vdr.audit.getUserEngagementMetrics(projectId, orgId);

    const totalViews = auditLogs.filter(log => 
      log.eventType === 'document_viewed' || log.eventType === 'document_downloaded'
    ).length;
    const totalDownloads = auditLogs.filter(log => log.eventType === 'document_downloaded').length;
    const totalUploads = auditLogs.filter(log => 
      log.eventType === 'document_uploaded' || log.eventType === 'document_version_created'
    ).length;
    const uniqueUsers = new Set([
      ...auditLogs.filter(log => log.userId).map(log => log.userId),
      ...auditLogs.filter(log => log.externalUserId).map(log => log.externalUserId)
    ]).size;

    res.json({
      summary: {
        totalDocuments: documents.length,
        totalViews,
        totalDownloads,
        totalUploads,
        uniqueUsers,
      },
      topDocuments: documentStats,
      activityByDay,
      userEngagement,
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

router.get('/projects/:projectId/documents/search', requireAuth, requireVdrAccess('view'), async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { q } = req.query;
  const orgId = (req.user as any).orgId;

  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const searchTerm = `%${q.trim()}%`;
    
    const documents = await db.select()
      .from(vdrDocuments)
      .where(and(
        eq(vdrDocuments.projectId, projectId),
        eq(vdrDocuments.orgId, orgId),
        sql`(
          ${vdrDocuments.name} ILIKE ${searchTerm} OR
          ${vdrDocuments.originalName} ILIKE ${searchTerm} OR
          COALESCE(${vdrDocuments.description}, '') ILIKE ${searchTerm} OR
          ${vdrDocuments.fileType} ILIKE ${searchTerm}
        )`
      ))
      .orderBy(vdrDocuments.name);

    res.json(documents);
  } catch (error: any) {
    console.error('Error searching documents:', error);
    res.status(500).json({ error: 'Failed to search documents' });
  }
});

router.post('/documents/bulk-download', requireAuth, async (req: Request, res: Response) => {
  const { documentIds } = req.body;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return res.status(400).json({ error: 'Document IDs array is required' });
  }

  try {
    const documents = await Promise.all(
      documentIds.map(id => storage.vdr.documents.getDocument(id, orgId))
    );

    const validDocuments = documents.filter(doc => doc !== undefined);
    
    if (validDocuments.length === 0) {
      return res.status(404).json({ error: 'No valid documents found' });
    }

    for (const doc of validDocuments) {
      const hasAccess = await storage.vdr.permissions.checkUserPermission(
        userId,
        'document',
        doc.id,
        orgId,
        'view_download'
      );
      
      if (!hasAccess) {
        return res.status(403).json({ error: `Insufficient permissions for document: ${doc.name}` });
      }
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('error', (err) => {
      throw err;
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="documents_${Date.now()}.zip"`);

    archive.pipe(res);

    for (const doc of validDocuments) {
      try {
        const stream = await defaultStorageProvider.download(doc.storagePath);
        archive.append(stream, { name: doc.filename });

        await storage.vdr.audit.logAction({
          projectId: doc.projectId,
          orgId,
          userId,
          action: 'document_downloaded',
          resourceType: 'document',
          resourceId: doc.id,
          metadata: { documentName: doc.name, bulkDownload: true }
        });
      } catch (error) {
        console.error(`Error adding ${doc.filename} to archive:`, error);
      }
    }

    await archive.finalize();
  } catch (error: any) {
    console.error('Error creating bulk download:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create download archive' });
    }
  }
});

// ============================================================================
// VDR Templates - Folder structure templates
// ============================================================================

// List available templates
// Get duplicate detection report for a project
router.get('/projects/:projectId/duplicates', requireAuth, requireVdrAccess('view'), async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const folders = await storage.vdr.folders.getFoldersForProject(projectId, orgId);
    
    // Build folder path helper
    const buildPath = (folderId: string | null): string => {
      if (!folderId) return '/';
      const folder = folders.find(f => f.id === folderId);
      if (!folder) return '/';
      const parentPath = folder.parentFolderId ? buildPath(folder.parentFolderId) : '';
      return `${parentPath}/${folder.name}`;
    };

    // Find duplicate folders (same name under same parent)
    const folderDuplicates: any[] = [];
    const foldersByParent = new Map<string | null, typeof folders>();
    
    folders.forEach(folder => {
      const parentKey = folder.parentFolderId || null;
      if (!foldersByParent.has(parentKey)) {
        foldersByParent.set(parentKey, []);
      }
      foldersByParent.get(parentKey)!.push(folder);
    });

    foldersByParent.forEach((siblings, parentId) => {
      const nameMap = new Map<string, typeof folders>();
      siblings.forEach(folder => {
        const normalizedName = folder.name.toLowerCase();
        if (!nameMap.has(normalizedName)) {
          nameMap.set(normalizedName, []);
        }
        nameMap.get(normalizedName)!.push(folder);
      });

      nameMap.forEach((duplicates, name) => {
        if (duplicates.length > 1) {
          folderDuplicates.push({
            type: 'folder',
            name: duplicates[0].name,
            count: duplicates.length,
            items: duplicates.map(f => ({
              id: f.id,
              path: buildPath(f.id),
              createdAt: f.createdAt
            }))
          });
        }
      });
    });

    // Find duplicate documents (same name in same folder)
    const documentDuplicates: any[] = [];
    
    for (const folder of folders) {
      const documents = await storage.vdr.documents.getDocumentsForFolder(folder.id, orgId);
      const nameMap = new Map<string, typeof documents>();
      
      documents.forEach(doc => {
        const normalizedName = doc.name.toLowerCase();
        if (!nameMap.has(normalizedName)) {
          nameMap.set(normalizedName, []);
        }
        nameMap.get(normalizedName)!.push(doc);
      });

      nameMap.forEach((duplicates, name) => {
        if (duplicates.length > 1) {
          documentDuplicates.push({
            type: 'document',
            name: duplicates[0].name,
            folderPath: buildPath(folder.id),
            folderId: folder.id,
            count: duplicates.length,
            items: duplicates.map(d => ({
              id: d.id,
              name: d.name,
              size: d.size,
              uploadedAt: d.uploadedAt
            }))
          });
        }
      });
    }

    res.json({
      folders: folderDuplicates,
      documents: documentDuplicates,
      totalFolderDuplicates: folderDuplicates.length,
      totalDocumentDuplicates: documentDuplicates.length
    });
  } catch (error: any) {
    console.error('Error detecting duplicates:', error);
    res.status(500).json({ error: 'Failed to detect duplicates' });
  }
});

router.get('/templates', requireAuth, async (req: Request, res: Response) => {
  const orgId = (req.user as any).orgId;

  try {
    // Get system templates (public) and org-specific templates
    const templates = await storage.vdr.templates.listTemplates(orgId);
    res.json(templates);
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get template with folders
router.get('/templates/:templateId', requireAuth, async (req: Request, res: Response) => {
  const { templateId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const template = await storage.vdr.templates.getTemplate(templateId, orgId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const folders = await storage.vdr.templates.getTemplateFolders(templateId);
    res.json({ ...template, folders });
  } catch (error: any) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Apply template to project
router.post('/projects/:projectId/apply-template', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { templateId } = req.body;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    // Verify project access
    const project = await storage.getProject(projectId);
    if (!project || project.orgId !== orgId) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify template exists
    const template = await storage.vdr.templates.getTemplate(templateId, orgId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Get template folders
    const templateFolders = await storage.vdr.templates.getTemplateFolders(templateId);

    // Apply template: create folders in project
    const folderMap: Record<string, string> = {};

    // First pass: create root folders (no parent)
    for (const tf of templateFolders.filter(f => !f.parentFolderId)) {
      const folder = await storage.vdr.folders.createFolder({
        projectId,
        parentFolderId: null,
        name: tf.name,
        path: `/${tf.name}`,
        displayOrder: tf.displayOrder,
        description: tf.description,
        orgId,
        createdBy: userId,
      });
      folderMap[tf.id] = folder.id;
    }

    // Second pass: create child folders
    for (const tf of templateFolders.filter(f => f.parentFolderId)) {
      const parentId = folderMap[tf.parentFolderId!];
      if (!parentId) {
        continue;
      }

      const parent = await storage.vdr.folders.getFolder(parentId, orgId);
      const folder = await storage.vdr.folders.createFolder({
        projectId,
        parentFolderId: parentId,
        name: tf.name,
        path: `${parent?.path}/${tf.name}`,
        displayOrder: tf.displayOrder,
        description: tf.description,
        orgId,
        createdBy: userId,
      });
      folderMap[tf.id] = folder.id;
    }

    // Log template application
    await storage.vdr.audit.logAction({
      projectId,
      orgId,
      userId,
      action: 'template_applied',
      resourceType: 'project',
      resourceId: projectId,
      metadata: { templateId, templateName: template.name, folderCount: templateFolders.length }
    });

    res.json({ success: true, foldersCreated: Object.keys(folderMap).length });
  } catch (error: any) {
    console.error('Error applying template:', error);
    res.status(500).json({ error: 'Failed to apply template' });
  }
});

// ============================================================================
// DATA REQUEST ROUTES - Document checklist and status tracking
// ============================================================================

// Get all data request items for a project
router.get('/projects/:projectId/data-requests', requireAuth, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const items = await storage.vdr.dataRequests.getItemsByProject(projectId, orgId);
    res.json(items);
  } catch (error: any) {
    console.error('Error fetching data request items:', error);
    res.status(500).json({ error: 'Failed to fetch data request items' });
  }
});

// Create a new data request item
router.post('/projects/:projectId/data-requests', requireAuth, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    const itemData = {
      ...req.body,
      projectId,
      orgId,
      createdBy: userId,
      assigneeId: req.body.assigneeId || null,
      externalAssigneeId: req.body.externalAssigneeId || null,
      dueDate: req.body.dueDate || null,
    };

    const item = await storage.vdr.dataRequests.createItem(itemData);
    res.json(item);
  } catch (error: any) {
    console.error('Error creating data request item:', error);
    res.status(500).json({ error: 'Failed to create data request item' });
  }
});

// Update a data request item
router.patch('/data-requests/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const updateData = {
      ...req.body,
      assigneeId: req.body.assigneeId || null,
      externalAssigneeId: req.body.externalAssigneeId || null,
      dueDate: req.body.dueDate || null,
    };
    const item = await storage.vdr.dataRequests.updateItem(id, updateData, orgId);
    res.json(item);
  } catch (error: any) {
    console.error('Error updating data request item:', error);
    res.status(500).json({ error: 'Failed to update data request item' });
  }
});

// Delete a data request item
router.delete('/data-requests/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    await storage.vdr.dataRequests.deleteItem(id, orgId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting data request item:', error);
    res.status(500).json({ error: 'Failed to delete data request item' });
  }
});

// Link a document to a data request item
router.post('/data-requests/:id/link-document', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { documentId } = req.body;
  const orgId = (req.user as any).orgId;

  try {
    const item = await storage.vdr.dataRequests.linkDocument(id, documentId, orgId);
    res.json(item);
  } catch (error: any) {
    console.error('Error linking document:', error);
    res.status(500).json({ error: 'Failed to link document' });
  }
});

// Unlink a document from a data request item
router.post('/data-requests/:id/unlink-document', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const item = await storage.vdr.dataRequests.unlinkDocument(id, orgId);
    res.json(item);
  } catch (error: any) {
    console.error('Error unlinking document:', error);
    res.status(500).json({ error: 'Failed to unlink document' });
  }
});

// Get data request templates
router.get('/data-request-templates', requireAuth, async (req: Request, res: Response) => {
  const orgId = (req.user as any).orgId;

  try {
    const templates = await storage.vdr.dataRequests.getTemplates(orgId);
    res.json(templates);
  } catch (error: any) {
    console.error('Error fetching data request templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Apply a template to a project
router.post('/projects/:projectId/apply-data-request-template/:templateId', requireAuth, async (req: Request, res: Response) => {
  const { projectId, templateId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    const items = await storage.vdr.dataRequests.applyTemplate(projectId, templateId, orgId, userId);
    res.json({ success: true, itemsCreated: items.length, items });
  } catch (error: any) {
    console.error('Error applying template:', error);
    res.status(500).json({ error: 'Failed to apply template' });
  }
});

// Bulk update data request items
router.post('/projects/:projectId/data-requests/bulk-update', requireAuth, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { itemIds, updates } = req.body;
  const orgId = (req.user as any).orgId;

  try {
    const results = await Promise.all(
      itemIds.map(async (id: string) => {
        return await storage.vdr.dataRequests.updateItem(id, updates, orgId);
      })
    );
    res.json({ success: true, updated: results.length, items: results });
  } catch (error: any) {
    console.error('Error bulk updating data request items:', error);
    res.status(500).json({ error: 'Failed to bulk update items' });
  }
});

// Get team members for assignee selection (Deal Team only)
router.get('/projects/:projectId/team-members', requireAuth, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    // Get internal users from projectContacts who are on the deal team
    const dealTeamContacts = await db.select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      role: projectContacts.role,
      customRole: projectContacts.customRole,
      type: sql<string>`'internal'`,
    })
    .from(projectContacts)
    .innerJoin(contacts, eq(projectContacts.contactId, contacts.id))
    .where(and(
      eq(projectContacts.projectId, projectId),
      eq(contacts.orgId, orgId),
      eq(contacts.onDealTeam, true)
    ));

    // Get external users with access to this project
    const externalUsersData = await db.select({
      id: externalUsers.id,
      name: externalUsers.name,
      email: externalUsers.email,
      role: externalUsers.role,
      type: sql<string>`'external'`,
    })
    .from(externalUsers)
    .innerJoin(
      externalUserProjectAccess,
      eq(externalUserProjectAccess.externalUserId, externalUsers.id)
    )
    .where(and(
      eq(externalUserProjectAccess.projectId, projectId),
      eq(externalUsers.orgId, orgId),
      eq(externalUsers.isActive, true)
    ));

    res.json({
      internal: dealTeamContacts,
      external: externalUsersData,
    });
  } catch (error: any) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Get diligence categories for the organization
router.get('/diligence-categories', requireAuth, async (req: Request, res: Response) => {
  const orgId = (req.user as any).orgId;

  try {
    let categories = await db.select()
      .from(vdrDiligenceCategories)
      .where(and(
        eq(vdrDiligenceCategories.orgId, orgId),
        eq(vdrDiligenceCategories.isActive, true)
      ))
      .orderBy(vdrDiligenceCategories.displayOrder);

    if (categories.length === 0) {
      await ensureDefaultCategories(orgId);
      categories = await db.select()
        .from(vdrDiligenceCategories)
        .where(and(
          eq(vdrDiligenceCategories.orgId, orgId),
          eq(vdrDiligenceCategories.isActive, true)
        ))
        .orderBy(vdrDiligenceCategories.displayOrder);
    }

    res.json(categories);
  } catch (error: any) {
    console.error('Error fetching diligence categories:', error);
    res.status(500).json({ error: 'Failed to fetch diligence categories' });
  }
});

// Get due date presets for the organization
router.get('/due-date-presets', requireAuth, async (req: Request, res: Response) => {
  const orgId = (req.user as any).orgId;

  try {
    let presets = await db.select()
      .from(vdrDueDatePresets)
      .where(and(
        eq(vdrDueDatePresets.orgId, orgId),
        eq(vdrDueDatePresets.isActive, true)
      ))
      .orderBy(vdrDueDatePresets.displayOrder);

    if (presets.length === 0) {
      await ensureDefaultDueDatePresets(orgId);
      presets = await db.select()
        .from(vdrDueDatePresets)
        .where(and(
          eq(vdrDueDatePresets.orgId, orgId),
          eq(vdrDueDatePresets.isActive, true)
        ))
        .orderBy(vdrDueDatePresets.displayOrder);
    }

    res.json(presets);
  } catch (error: any) {
    console.error('Error fetching due date presets:', error);
    res.status(500).json({ error: 'Failed to fetch due date presets' });
  }
});

// ============================================================================
// COMPREHENSIVE AUDIT REPORTING ENDPOINTS
// ============================================================================

router.get('/projects/:projectId/audit-report', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const {
      userId,
      externalUserId,
      eventTypes,
      startDate,
      endDate,
      documentId,
      folderId,
      limit = '100',
      offset = '0',
    } = req.query;

    const filters = {
      projectId,
      userId: userId as string | undefined,
      externalUserId: externalUserId as string | undefined,
      eventTypes: eventTypes ? (eventTypes as string).split(',') as any : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      documentId: documentId as string | undefined,
      folderId: folderId as string | undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    };

    const logs = await vdrAuditService.getAuditReport(orgId, filters);
    res.json(logs);
  } catch (error: any) {
    console.error('Error fetching audit report:', error);
    res.status(500).json({ error: 'Failed to fetch audit report' });
  }
});

router.get('/projects/:projectId/engagement-metrics', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const metrics = await vdrAuditService.getEngagementMetrics(orgId, projectId);
    res.json(metrics);
  } catch (error: any) {
    console.error('Error fetching engagement metrics:', error);
    res.status(500).json({ error: 'Failed to fetch engagement metrics' });
  }
});

router.get('/documents/:documentId/access-summary', requireAuth, requireVdrAccess('view'), async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const summary = await vdrAuditService.getAccessSummary(orgId, documentId);
    res.json(summary);
  } catch (error: any) {
    console.error('Error fetching access summary:', error);
    res.status(500).json({ error: 'Failed to fetch access summary' });
  }
});

router.get('/documents/:documentId/permission-history', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const limit = parseInt(req.query.limit as string || '100', 10);
    const history = await vdrAuditService.getPermissionHistory(orgId, 'document', documentId, limit);
    res.json(history);
  } catch (error: any) {
    console.error('Error fetching permission history:', error);
    res.status(500).json({ error: 'Failed to fetch permission history' });
  }
});

router.get('/folders/:folderId/permission-history', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { folderId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const limit = parseInt(req.query.limit as string || '100', 10);
    const history = await vdrAuditService.getPermissionHistory(orgId, 'folder', folderId, limit);
    res.json(history);
  } catch (error: any) {
    console.error('Error fetching permission history:', error);
    res.status(500).json({ error: 'Failed to fetch permission history' });
  }
});

router.get('/projects/:projectId/audit-export', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const {
      userId,
      externalUserId,
      eventTypes,
      startDate,
      endDate,
    } = req.query;

    const filters = {
      projectId,
      userId: userId as string | undefined,
      externalUserId: externalUserId as string | undefined,
      eventTypes: eventTypes ? (eventTypes as string).split(',') as any : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    };

    const csv = await vdrAuditService.exportAuditLog(orgId, filters);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="vdr-audit-${projectId}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error: any) {
    console.error('Error exporting audit log:', error);
    res.status(500).json({ error: 'Failed to export audit log' });
  }
});

export default router;
