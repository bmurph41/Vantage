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
import { vdrWatermarkService } from './services/vdr-watermark-service';

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
    
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
      || req.socket?.remoteAddress 
      || 'unknown';
    
    const watermarkResult = await vdrWatermarkService.applyWatermarkToDownload(
      documentId,
      userId,
      null,
      orgId,
      stream,
      document.mimeType,
      ipAddress
    );
    
    await vdrAuditService.logEvent({
      projectId: document.projectId,
      orgId,
      userId,
      documentId,
      eventType: 'document_downloaded',
      metadata: { 
        documentName: document.filename,
        watermarkApplied: watermarkResult.watermarkApplied,
        watermarkText: watermarkResult.watermarkText,
      },
      req,
    });

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
    
    if (watermarkResult.watermarkApplied && watermarkResult.watermarkText) {
      res.setHeader('X-Watermark-Applied', 'true');
      res.setHeader('X-Watermark-Info', encodeURIComponent(watermarkResult.watermarkText.split('\n')[0]));
    }
    
    watermarkResult.stream.pipe(res);
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

// Create a new data request item with file attachment
router.post('/projects/:projectId/data-requests-with-files', requireAuth, upload.array('files', 10), async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    const files = req.files as Express.Multer.File[];
    const { folderId, category, documentName, description, dueDate, priority, assigneeId, externalAssigneeId } = req.body;

    // Validate required fields
    if (!category || typeof category !== 'string' || category.trim() === '') {
      return res.status(400).json({ error: 'Category is required' });
    }
    if (!documentName || typeof documentName !== 'string' || documentName.trim() === '') {
      return res.status(400).json({ error: 'Document name is required' });
    }
    if (!dueDate) {
      return res.status(400).json({ error: 'Due date is required' });
    }
    if (!priority || !['low', 'medium', 'high', 'urgent'].includes(priority)) {
      return res.status(400).json({ error: 'Valid priority is required (low, medium, high, urgent)' });
    }
    if (!assigneeId && !externalAssigneeId) {
      return res.status(400).json({ error: 'An assignee is required' });
    }

    // Validate folder if files are uploaded
    if (files && files.length > 0) {
      if (!folderId) {
        return res.status(400).json({ error: 'Folder ID is required when uploading files' });
      }

      // Verify folder exists and belongs to project
      const folder = await storage.vdr.folders.getFolder(folderId, orgId);
      if (!folder) {
        return res.status(404).json({ error: 'Folder not found' });
      }
      if (folder.projectId !== projectId) {
        return res.status(400).json({ error: 'Folder does not belong to this project' });
      }
    }

    // Create the data request item first
    const itemData = {
      projectId,
      orgId,
      createdBy: userId,
      category: category.trim(),
      documentName: documentName.trim(),
      description: description ? description.trim() : null,
      dueDate: dueDate || null,
      priority: priority || 'medium',
      assigneeId: assigneeId || null,
      externalAssigneeId: externalAssigneeId || null,
    };

    const item = await storage.vdr.dataRequests.createItem(itemData);

    // Upload files and link to the data request item
    const uploadedDocuments = [];
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          const fileInfo = await vdrFileService.processUpload(
            file.path,
            file.originalname,
            file.mimetype,
            file.size,
            orgId,
            projectId
          );

          const document = await storage.vdr.documents.createDocument({
            folderId,
            projectId,
            orgId,
            filename: file.originalname,
            originalFilename: file.originalname,
            description: `Attached to data request: ${documentName}`,
            mimeType: fileInfo.mimeType,
            size: fileInfo.size,
            storagePath: fileInfo.storagePath,
            checksum: fileInfo.checksum,
            version: 1,
            isCurrentVersion: true,
            uploadedBy: userId
          });

          uploadedDocuments.push(document);

          await storage.vdr.audit.logAction({
            projectId,
            orgId,
            userId,
            action: 'document_uploaded',
            resourceType: 'document',
            resourceId: document.id,
            metadata: { 
              documentName: document.filename,
              size: document.size,
              mimeType: document.mimeType,
              linkedToDataRequest: item.id
            }
          });
        } catch (uploadError: any) {
          console.error('Error uploading file:', file.originalname, uploadError);
        }
      }

      // Link the first uploaded document to the data request item as the primary document
      // Note: Schema supports single linkedDocumentId per request. All files are uploaded
      // to the VDR folder and can be accessed there. The linked document indicates the primary attachment.
      if (uploadedDocuments.length > 0) {
        await storage.vdr.dataRequests.linkDocument(item.id, uploadedDocuments[0].id, orgId);
        // Also mark as received since we have files
        await storage.vdr.dataRequests.updateItem(item.id, { 
          status: 'received',
          isInDataRoom: true,
          receivedDate: new Date().toISOString().split('T')[0]
        }, orgId);
      }
    }

    // Return the created item with all uploaded documents for reference
    res.json({
      ...item,
      uploadedDocuments,
      uploadedCount: uploadedDocuments.length
    });
  } catch (error: any) {
    console.error('Error creating data request with files:', error);
    res.status(500).json({ error: error.message || 'Failed to create data request with files' });
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

// Get team members for assignee selection
router.get('/projects/:projectId/team-members', requireAuth, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    // Get organization users (internal team members who can be assignees)
    const orgUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      type: sql<string>`'internal'`,
    })
    .from(users)
    .where(and(
      eq(users.orgId, orgId),
      eq(users.isActive, true)
    ));

    // Get project-specific deal members
    const { projectDealMembers } = await import('@shared/schema');
    const dealMembers = await db.select({
      id: projectDealMembers.id,
      name: projectDealMembers.name,
      email: projectDealMembers.email,
      role: projectDealMembers.role,
      type: sql<string>`'deal_member'`,
    })
    .from(projectDealMembers)
    .where(and(
      eq(projectDealMembers.projectId, projectId),
      eq(projectDealMembers.orgId, orgId)
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
      internal: orgUsers,
      dealMembers: dealMembers,
      external: externalUsersData,
    });
  } catch (error: any) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Add a new deal member to a project
const addDealMemberSchema = z.object({
  name: z.string().min(1, 'Name is required').transform(s => s.trim()),
  email: z.string().email().optional().nullable().transform(val => val?.trim() || null),
  phone: z.string().optional().nullable().transform(val => val?.trim() || null),
  role: z.string().optional().nullable().transform(val => val?.trim() || null),
});

router.post('/projects/:projectId/deal-members', requireAuth, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;
  
  const parseResult = addDealMemberSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.errors[0].message });
  }
  
  const { name, email, phone, role } = parseResult.data;

  try {
    const { projectDealMembers, pendingContacts } = await import('@shared/schema');
    
    // First create a pending contact in CRM for review
    const [pendingContact] = await db.insert(pendingContacts)
      .values({
        orgId,
        fullName: name,
        email,
        phone,
        sourceType: 'deal_member',
        sourceId: projectId,
        sourceMetadata: { projectId, role },
        status: 'pending',
        createdBy: userId,
      })
      .returning();
    
    // Create the project deal member with link to pending contact
    const [dealMember] = await db.insert(projectDealMembers)
      .values({
        projectId,
        orgId,
        name,
        email,
        phone,
        role,
        pendingContactId: pendingContact.id,
        createdBy: userId,
      })
      .returning();

    res.json(dealMember);
  } catch (error: any) {
    console.error('Error adding deal member:', error);
    res.status(500).json({ error: 'Failed to add deal member' });
  }
});

// Get deal members for a project
router.get('/projects/:projectId/deal-members', requireAuth, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const { projectDealMembers } = await import('@shared/schema');
    const dealMembers = await db.select()
      .from(projectDealMembers)
      .where(and(
        eq(projectDealMembers.projectId, projectId),
        eq(projectDealMembers.orgId, orgId)
      ));

    res.json(dealMembers);
  } catch (error: any) {
    console.error('Error fetching deal members:', error);
    res.status(500).json({ error: 'Failed to fetch deal members' });
  }
});

// Delete a deal member from a project
router.delete('/projects/:projectId/deal-members/:memberId', requireAuth, async (req: Request, res: Response) => {
  const { projectId, memberId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const { projectDealMembers } = await import('@shared/schema');
    await db.delete(projectDealMembers)
      .where(and(
        eq(projectDealMembers.id, memberId),
        eq(projectDealMembers.projectId, projectId),
        eq(projectDealMembers.orgId, orgId)
      ));

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting deal member:', error);
    res.status(500).json({ error: 'Failed to delete deal member' });
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

// ============================================================================
// WATERMARK MANAGEMENT ENDPOINTS
// ============================================================================

router.get('/projects/:projectId/watermark-settings', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;

  try {
    const settings = await vdrWatermarkService.getProjectWatermarkSettings(projectId, orgId);
    res.json(settings);
  } catch (error: any) {
    console.error('Error fetching watermark settings:', error);
    res.status(500).json({ error: 'Failed to fetch watermark settings' });
  }
});

router.post('/projects/:projectId/watermark', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    const { watermarkType, staticText, isDynamic, opacity, position, includeQrCode } = req.body;

    const watermark = await vdrWatermarkService.setWatermarkConfig(orgId, userId, {
      projectId,
      watermarkType: watermarkType || 'dynamic',
      staticText,
      isDynamic: isDynamic ?? true,
      opacity: opacity ?? 30,
      position: position ?? 'diagonal',
      includeQrCode: includeQrCode ?? false,
    });

    await vdrAuditService.logEvent({
      projectId,
      orgId,
      userId,
      eventType: 'watermark_applied',
      metadata: { scope: 'project', watermarkType },
      req,
    });

    res.json(watermark);
  } catch (error: any) {
    console.error('Error setting project watermark:', error);
    res.status(500).json({ error: 'Failed to set project watermark' });
  }
});

router.delete('/projects/:projectId/watermark', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    await vdrWatermarkService.removeWatermarkConfig(orgId, undefined, undefined, projectId);

    await vdrAuditService.logEvent({
      projectId,
      orgId,
      userId,
      eventType: 'watermark_removed',
      metadata: { scope: 'project' },
      req,
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing project watermark:', error);
    res.status(500).json({ error: 'Failed to remove project watermark' });
  }
});

router.post('/folders/:folderId/watermark', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { folderId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    const folder = await storage.vdr.folders.getFolder(folderId, orgId);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const { watermarkType, staticText, isDynamic, opacity, position, includeQrCode } = req.body;

    const watermark = await vdrWatermarkService.setWatermarkConfig(orgId, userId, {
      folderId,
      watermarkType: watermarkType || 'dynamic',
      staticText,
      isDynamic: isDynamic ?? true,
      opacity: opacity ?? 30,
      position: position ?? 'diagonal',
      includeQrCode: includeQrCode ?? false,
    });

    await vdrAuditService.logEvent({
      projectId: folder.projectId,
      orgId,
      userId,
      folderId,
      eventType: 'watermark_applied',
      metadata: { scope: 'folder', folderName: folder.name, watermarkType },
      req,
    });

    res.json(watermark);
  } catch (error: any) {
    console.error('Error setting folder watermark:', error);
    res.status(500).json({ error: 'Failed to set folder watermark' });
  }
});

router.delete('/folders/:folderId/watermark', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { folderId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    const folder = await storage.vdr.folders.getFolder(folderId, orgId);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    await vdrWatermarkService.removeWatermarkConfig(orgId, undefined, folderId, undefined);

    await vdrAuditService.logEvent({
      projectId: folder.projectId,
      orgId,
      userId,
      folderId,
      eventType: 'watermark_removed',
      metadata: { scope: 'folder', folderName: folder.name },
      req,
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing folder watermark:', error);
    res.status(500).json({ error: 'Failed to remove folder watermark' });
  }
});

router.post('/documents/:documentId/watermark', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    const document = await storage.vdr.documents.getDocument(documentId, orgId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const { watermarkType, staticText, isDynamic, opacity, position, includeQrCode } = req.body;

    const watermark = await vdrWatermarkService.setWatermarkConfig(orgId, userId, {
      documentId,
      watermarkType: watermarkType || 'dynamic',
      staticText,
      isDynamic: isDynamic ?? true,
      opacity: opacity ?? 30,
      position: position ?? 'diagonal',
      includeQrCode: includeQrCode ?? false,
    });

    await vdrAuditService.logEvent({
      projectId: document.projectId,
      orgId,
      userId,
      documentId,
      eventType: 'watermark_applied',
      metadata: { scope: 'document', documentName: document.filename, watermarkType },
      req,
    });

    res.json(watermark);
  } catch (error: any) {
    console.error('Error setting document watermark:', error);
    res.status(500).json({ error: 'Failed to set document watermark' });
  }
});

router.delete('/documents/:documentId/watermark', requireAuth, requireVdrAccess('manage'), async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    const document = await storage.vdr.documents.getDocument(documentId, orgId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await vdrWatermarkService.removeWatermarkConfig(orgId, documentId, undefined, undefined);

    await vdrAuditService.logEvent({
      projectId: document.projectId,
      orgId,
      userId,
      documentId,
      eventType: 'watermark_removed',
      metadata: { scope: 'document', documentName: document.filename },
      req,
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing document watermark:', error);
    res.status(500).json({ error: 'Failed to remove document watermark' });
  }
});

// ============================================================================
// EXTERNAL USER ACCESS CONTROL ENDPOINTS
// ============================================================================

function validateIpAddress(clientIp: string, ipWhitelist: string[]): boolean {
  if (!ipWhitelist || ipWhitelist.length === 0) {
    return true;
  }
  
  const normalizeIp = (ip: string) => {
    if (ip.startsWith('::ffff:')) {
      return ip.substring(7);
    }
    return ip;
  };
  
  const normalizedClientIp = normalizeIp(clientIp);
  
  for (const allowedIp of ipWhitelist) {
    const normalizedAllowed = normalizeIp(allowedIp.trim());
    
    if (normalizedAllowed.includes('/')) {
      const [subnet, bits] = normalizedAllowed.split('/');
      const mask = parseInt(bits, 10);
      const subnetParts = subnet.split('.').map(Number);
      const clientParts = normalizedClientIp.split('.').map(Number);
      
      if (subnetParts.length === 4 && clientParts.length === 4) {
        const subnetNum = (subnetParts[0] << 24) | (subnetParts[1] << 16) | (subnetParts[2] << 8) | subnetParts[3];
        const clientNum = (clientParts[0] << 24) | (clientParts[1] << 16) | (clientParts[2] << 8) | clientParts[3];
        const maskBits = ~((1 << (32 - mask)) - 1);
        
        if ((subnetNum & maskBits) === (clientNum & maskBits)) {
          return true;
        }
      }
    } else if (normalizedClientIp === normalizedAllowed) {
      return true;
    }
  }
  
  return false;
}

router.post('/documents/:documentId/download-watermarked', async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const { accessToken } = req.body;
  
  if (!accessToken) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const [access] = await db.select()
      .from(externalUserProjectAccess)
      .where(eq(externalUserProjectAccess.accessToken, accessToken))
      .limit(1);
    
    if (!access) {
      return res.status(401).json({ error: 'Invalid access token' });
    }
    
    const now = new Date();
    if (access.expiresAt && access.expiresAt < now) {
      return res.status(403).json({ error: 'Access has expired' });
    }
    if (access.tokenExpiresAt && access.tokenExpiresAt < now) {
      return res.status(403).json({ error: 'Access token has expired' });
    }
    if (access.status !== 'active') {
      return res.status(403).json({ error: 'Access has been revoked' });
    }
    
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
      || req.socket?.remoteAddress 
      || 'unknown';
    
    if (access.ipWhitelist && access.ipWhitelist.length > 0) {
      if (!validateIpAddress(clientIp, access.ipWhitelist)) {
        await vdrAuditService.logEvent({
          projectId: access.projectId,
          orgId: access.orgId,
          externalUserId: access.externalUserId,
          eventType: 'access_denied',
          metadata: { 
            reason: 'ip_restriction',
            clientIp,
            documentId,
          },
          req,
        });
        return res.status(403).json({ error: 'Access denied from this IP address' });
      }
    }
    
    if (access.downloadLimit !== null && access.downloadCount >= access.downloadLimit) {
      return res.status(403).json({ error: 'Download limit exceeded' });
    }
    
    const document = await storage.vdr.documents.getDocument(documentId, access.orgId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    if (document.projectId !== access.projectId) {
      return res.status(403).json({ error: 'Document not accessible with this token' });
    }
    
    const stream = await defaultStorageProvider.download(document.storagePath);
    
    const watermarkResult = await vdrWatermarkService.applyWatermarkToDownload(
      documentId,
      null,
      access.externalUserId,
      access.orgId,
      stream,
      document.mimeType,
      clientIp
    );
    
    await db.update(externalUserProjectAccess)
      .set({
        downloadCount: sql`${externalUserProjectAccess.downloadCount} + 1`,
        lastAccessAt: now,
        lastAccessIp: clientIp,
      })
      .where(eq(externalUserProjectAccess.id, access.id));
    
    await vdrAuditService.logEvent({
      projectId: document.projectId,
      orgId: access.orgId,
      externalUserId: access.externalUserId,
      documentId,
      eventType: 'download',
      metadata: { 
        documentName: document.filename,
        watermarkApplied: watermarkResult.watermarkApplied,
        watermarkText: watermarkResult.watermarkText,
        downloadType: 'external_watermarked',
        clientIp,
      },
      req,
    });

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
    
    if (watermarkResult.watermarkApplied && watermarkResult.watermarkText) {
      res.setHeader('X-Watermark-Applied', 'true');
      res.setHeader('X-Watermark-Info', encodeURIComponent(watermarkResult.watermarkText.split('\n')[0]));
    }
    
    watermarkResult.stream.pipe(res);
  } catch (error: any) {
    console.error('Error downloading watermarked document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

router.patch('/external-access/:accessId', requireAuth, async (req: Request, res: Response) => {
  const { accessId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    const [existingAccess] = await db.select()
      .from(externalUserProjectAccess)
      .where(and(
        eq(externalUserProjectAccess.id, accessId),
        eq(externalUserProjectAccess.orgId, orgId)
      ))
      .limit(1);
    
    if (!existingAccess) {
      return res.status(404).json({ error: 'External access not found' });
    }

    const updateSchema = z.object({
      expiresAt: z.string().datetime().nullable().optional(),
      tokenExpiresAt: z.string().datetime().nullable().optional(),
      ipWhitelist: z.array(z.string()).optional(),
      downloadLimit: z.number().min(0).nullable().optional(),
      status: z.enum(['active', 'revoked', 'expired']).optional(),
      canViewFolders: z.array(z.string()).optional(),
      canViewRequests: z.array(z.string()).optional(),
    });

    const validated = updateSchema.parse(req.body);
    
    const updateData: Record<string, any> = {};
    
    if (validated.expiresAt !== undefined) {
      updateData.expiresAt = validated.expiresAt ? new Date(validated.expiresAt) : null;
    }
    if (validated.tokenExpiresAt !== undefined) {
      updateData.tokenExpiresAt = validated.tokenExpiresAt ? new Date(validated.tokenExpiresAt) : null;
    }
    if (validated.ipWhitelist !== undefined) {
      updateData.ipWhitelist = validated.ipWhitelist;
    }
    if (validated.downloadLimit !== undefined) {
      updateData.downloadLimit = validated.downloadLimit;
    }
    if (validated.status !== undefined) {
      updateData.status = validated.status;
    }
    if (validated.canViewFolders !== undefined) {
      updateData.canViewFolders = validated.canViewFolders;
    }
    if (validated.canViewRequests !== undefined) {
      updateData.canViewRequests = validated.canViewRequests;
    }
    
    const [updatedAccess] = await db.update(externalUserProjectAccess)
      .set(updateData)
      .where(eq(externalUserProjectAccess.id, accessId))
      .returning();
    
    await vdrAuditService.logEvent({
      projectId: updatedAccess.projectId,
      orgId,
      userId,
      externalUserId: updatedAccess.externalUserId,
      eventType: 'permission_change',
      metadata: { 
        accessId,
        changes: validated,
        updatedBy: userId,
      },
      req,
    });

    res.json(updatedAccess);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
    } else {
      console.error('Error updating external access:', error);
      res.status(500).json({ error: 'Failed to update external access' });
    }
  }
});

router.get('/external-access/:accessId/audit', requireAuth, async (req: Request, res: Response) => {
  const { accessId } = req.params;
  const orgId = (req.user as any).orgId;
  const { limit = '50', offset = '0' } = req.query;

  try {
    const [access] = await db.select()
      .from(externalUserProjectAccess)
      .where(and(
        eq(externalUserProjectAccess.id, accessId),
        eq(externalUserProjectAccess.orgId, orgId)
      ))
      .limit(1);
    
    if (!access) {
      return res.status(404).json({ error: 'External access not found' });
    }
    
    const [externalUser] = await db.select()
      .from(externalUsers)
      .where(eq(externalUsers.id, access.externalUserId))
      .limit(1);
    
    const auditLogs = await db.select({
      id: vdrAuditLogs.id,
      eventType: vdrAuditLogs.eventType,
      documentId: vdrAuditLogs.documentId,
      folderId: vdrAuditLogs.folderId,
      ipAddress: vdrAuditLogs.ipAddress,
      userAgent: vdrAuditLogs.userAgent,
      metadata: vdrAuditLogs.metadata,
      timestamp: vdrAuditLogs.timestamp,
      documentName: vdrDocuments.filename,
    })
      .from(vdrAuditLogs)
      .leftJoin(vdrDocuments, eq(vdrAuditLogs.documentId, vdrDocuments.id))
      .where(and(
        eq(vdrAuditLogs.externalUserId, access.externalUserId),
        eq(vdrAuditLogs.orgId, orgId)
      ))
      .orderBy(desc(vdrAuditLogs.timestamp))
      .limit(parseInt(limit as string, 10))
      .offset(parseInt(offset as string, 10));
    
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(vdrAuditLogs)
      .where(and(
        eq(vdrAuditLogs.externalUserId, access.externalUserId),
        eq(vdrAuditLogs.orgId, orgId)
      ));
    
    res.json({
      access: {
        ...access,
        externalUser: externalUser ? {
          id: externalUser.id,
          email: externalUser.email,
          name: externalUser.name,
          company: externalUser.company,
          role: externalUser.role,
        } : null,
      },
      auditLogs,
      total: countResult?.count || 0,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error: any) {
    console.error('Error fetching external access audit:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

router.post('/external-access/:accessId/regenerate-token', requireAuth, async (req: Request, res: Response) => {
  const { accessId } = req.params;
  const orgId = (req.user as any).orgId;
  const userId = (req.user as any).id;

  try {
    const [existingAccess] = await db.select()
      .from(externalUserProjectAccess)
      .where(and(
        eq(externalUserProjectAccess.id, accessId),
        eq(externalUserProjectAccess.orgId, orgId)
      ))
      .limit(1);
    
    if (!existingAccess) {
      return res.status(404).json({ error: 'External access not found' });
    }
    
    const crypto = await import('crypto');
    const newToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = req.body.expiresInDays 
      ? new Date(Date.now() + req.body.expiresInDays * 24 * 60 * 60 * 1000)
      : null;
    
    const [updatedAccess] = await db.update(externalUserProjectAccess)
      .set({
        accessToken: newToken,
        tokenExpiresAt,
      })
      .where(eq(externalUserProjectAccess.id, accessId))
      .returning();
    
    await vdrAuditService.logEvent({
      projectId: updatedAccess.projectId,
      orgId,
      userId,
      externalUserId: updatedAccess.externalUserId,
      eventType: 'permission_change',
      metadata: { 
        accessId,
        action: 'token_regenerated',
        tokenExpiresAt,
      },
      req,
    });

    res.json({
      accessToken: newToken,
      tokenExpiresAt,
    });
  } catch (error: any) {
    console.error('Error regenerating access token:', error);
    res.status(500).json({ error: 'Failed to regenerate access token' });
  }
});

router.get('/external-access', requireAuth, async (req: Request, res: Response) => {
  const orgId = (req.user as any).orgId;
  const { projectId, status } = req.query;

  try {
    let query = db.select({
      access: externalUserProjectAccess,
      externalUser: {
        id: externalUsers.id,
        email: externalUsers.email,
        name: externalUsers.name,
        company: externalUsers.company,
        role: externalUsers.role,
      },
    })
      .from(externalUserProjectAccess)
      .leftJoin(externalUsers, eq(externalUserProjectAccess.externalUserId, externalUsers.id))
      .where(eq(externalUserProjectAccess.orgId, orgId));
    
    const results = await query;
    
    let filteredResults = results;
    
    if (projectId) {
      filteredResults = filteredResults.filter(r => r.access.projectId === projectId);
    }
    if (status) {
      filteredResults = filteredResults.filter(r => r.access.status === status);
    }
    
    res.json(filteredResults.map(r => ({
      ...r.access,
      externalUser: r.externalUser,
    })));
  } catch (error: any) {
    console.error('Error fetching external access list:', error);
    res.status(500).json({ error: 'Failed to fetch external access list' });
  }
});

export default router;
