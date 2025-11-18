import { 
  type VdrDocumentPermission,
  type VdrPermissionLevelEnum,
  vdrPermissionLevelEnum
} from "@shared/schema";
import { VdrStorage } from "./vdr-storage";

type PermissionLevel = typeof vdrPermissionLevelEnum.enumValues[number];

export interface IVdrPermissionService {
  checkUserPermission(
    userId: string,
    resourceType: 'document' | 'folder' | 'project',
    resourceId: string,
    orgId: string,
    requiredLevel: PermissionLevel
  ): Promise<boolean>;
  
  getEffectivePermission(
    userId: string,
    resourceType: 'document' | 'folder' | 'project',
    resourceId: string,
    orgId: string
  ): Promise<PermissionLevel>;
  
  checkExternalUserPermission(
    externalUserId: string,
    resourceType: 'document' | 'folder' | 'project',
    resourceId: string,
    orgId: string,
    requiredLevel: PermissionLevel
  ): Promise<boolean>;
}

export class VdrPermissionService implements IVdrPermissionService {
  private vdrStorage: VdrStorage;
  private permissionCache: Map<string, { level: PermissionLevel; expires: number }>;

  constructor(vdrStorage: VdrStorage) {
    this.vdrStorage = vdrStorage;
    this.permissionCache = new Map();
  }

  private getCacheKey(userId: string, resourceType: string, resourceId: string): string {
    return `${userId}:${resourceType}:${resourceId}`;
  }

  private isCacheValid(expires: number): boolean {
    return Date.now() < expires;
  }

  private comparePermissionLevels(level1: PermissionLevel, level2: PermissionLevel): number {
    const levels: PermissionLevel[] = ['no_access', 'view_only', 'view_download', 'view_download_print', 'full_access'];
    return levels.indexOf(level1) - levels.indexOf(level2);
  }

  private permissionLevelMeetsRequirement(userLevel: PermissionLevel, requiredLevel: PermissionLevel): boolean {
    return this.comparePermissionLevels(userLevel, requiredLevel) >= 0;
  }

  async checkUserPermission(
    userId: string,
    resourceType: 'document' | 'folder' | 'project',
    resourceId: string,
    orgId: string,
    requiredLevel: PermissionLevel
  ): Promise<boolean> {
    const effectivePermission = await this.getEffectivePermission(userId, resourceType, resourceId, orgId);
    return this.permissionLevelMeetsRequirement(effectivePermission, requiredLevel);
  }

  async getEffectivePermission(
    userId: string,
    resourceType: 'document' | 'folder' | 'project',
    resourceId: string,
    orgId: string
  ): Promise<PermissionLevel> {
    const cacheKey = this.getCacheKey(userId, resourceType, resourceId);
    const cached = this.permissionCache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.expires)) {
      return cached.level;
    }

    let effectivePermission: PermissionLevel = 'no_access';

    if (resourceType === 'document') {
      const document = await this.vdrStorage.documents.getDocument(resourceId, orgId);
      if (!document) return 'no_access';

      const docPermissions = await this.vdrStorage.permissions.getPermissionsForDocument(resourceId, orgId);
      const directPermission = docPermissions.find(p => p.userId === userId);
      
      if (directPermission) {
        effectivePermission = directPermission.permissionLevel;
      } else {
        const folderPermission = await this.getEffectivePermission(userId, 'folder', document.folderId, orgId);
        effectivePermission = folderPermission;
      }
    } else if (resourceType === 'folder') {
      const folder = await this.vdrStorage.folders.getFolder(resourceId, orgId);
      if (!folder) return 'no_access';

      const folderPermissions = await this.vdrStorage.permissions.getPermissionsForFolder(resourceId, orgId);
      const directPermission = folderPermissions.find(p => p.userId === userId);
      
      if (directPermission) {
        effectivePermission = directPermission.permissionLevel;
      } else if (folder.parentFolderId) {
        const parentPermission = await this.getEffectivePermission(userId, 'folder', folder.parentFolderId, orgId);
        effectivePermission = parentPermission;
      } else {
        const projectPermission = await this.getEffectivePermission(userId, 'project', folder.projectId, orgId);
        effectivePermission = projectPermission;
      }
    } else if (resourceType === 'project') {
      const projectPermissions = await this.vdrStorage.permissions.getPermissionsForProject(resourceId, orgId);
      const directPermission = projectPermissions.find(p => p.userId === userId);
      
      if (directPermission) {
        effectivePermission = directPermission.permissionLevel;
      } else {
        const rootFolders = await this.vdrStorage.folders.getFoldersForProject(resourceId, orgId);
        const rootFoldersWithoutParent = rootFolders.filter(f => !f.parentFolderId);
        
        let maxPermission: PermissionLevel = 'no_access';
        for (const folder of rootFoldersWithoutParent) {
          const folderPermissions = await this.vdrStorage.permissions.getPermissionsForFolder(folder.id, orgId);
          const folderUserPermission = folderPermissions.find(p => p.userId === userId);
          if (folderUserPermission) {
            if (this.permissionLevelMeetsRequirement(folderUserPermission.permissionLevel, maxPermission)) {
              maxPermission = folderUserPermission.permissionLevel;
            }
          }
        }
        
        if (maxPermission !== 'no_access') {
          effectivePermission = maxPermission;
        } else {
          effectivePermission = 'full_access';
        }
      }
    }

    this.permissionCache.set(cacheKey, {
      level: effectivePermission,
      expires: Date.now() + 60000
    });

    return effectivePermission;
  }

  async checkExternalUserPermission(
    externalUserId: string,
    resourceType: 'document' | 'folder' | 'project',
    resourceId: string,
    orgId: string,
    requiredLevel: PermissionLevel
  ): Promise<boolean> {
    const effectivePermission = await this.getExternalUserEffectivePermission(externalUserId, resourceType, resourceId, orgId);
    return this.permissionLevelMeetsRequirement(effectivePermission, requiredLevel);
  }

  private async getExternalUserEffectivePermission(
    externalUserId: string,
    resourceType: 'document' | 'folder' | 'project',
    resourceId: string,
    orgId: string
  ): Promise<PermissionLevel> {
    const cacheKey = this.getCacheKey(`ext:${externalUserId}`, resourceType, resourceId);
    const cached = this.permissionCache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.expires)) {
      return cached.level;
    }

    let effectivePermission: PermissionLevel = 'no_access';

    if (resourceType === 'document') {
      const document = await this.vdrStorage.documents.getDocument(resourceId, orgId);
      if (!document) return 'no_access';

      const docPermissions = await this.vdrStorage.permissions.getPermissionsForDocument(resourceId, orgId);
      const directPermission = docPermissions.find(p => p.externalUserId === externalUserId);
      
      if (directPermission) {
        effectivePermission = directPermission.permissionLevel;
      } else {
        const folderPermission = await this.getExternalUserEffectivePermission(externalUserId, 'folder', document.folderId, orgId);
        effectivePermission = folderPermission;
      }
    } else if (resourceType === 'folder') {
      const folder = await this.vdrStorage.folders.getFolder(resourceId, orgId);
      if (!folder) return 'no_access';

      const folderPermissions = await this.vdrStorage.permissions.getPermissionsForFolder(resourceId, orgId);
      const directPermission = folderPermissions.find(p => p.externalUserId === externalUserId);
      
      if (directPermission) {
        effectivePermission = directPermission.permissionLevel;
      } else if (folder.parentFolderId) {
        const parentPermission = await this.getExternalUserEffectivePermission(externalUserId, 'folder', folder.parentFolderId, orgId);
        effectivePermission = parentPermission;
      } else {
        const projectAccess = await this.vdrStorage.externalUsers.getProjectAccessForUser(externalUserId, orgId);
        const access = projectAccess.find(a => a.projectId === folder.projectId);
        if (access && access.canViewFolders && access.canViewFolders.includes(resourceId)) {
          effectivePermission = 'view_only';
        } else {
          effectivePermission = 'no_access';
        }
      }
    } else if (resourceType === 'project') {
      const projectPermissions = await this.vdrStorage.permissions.getPermissionsForProject(resourceId, orgId);
      const directPermission = projectPermissions.find(p => p.externalUserId === externalUserId);
      
      if (directPermission) {
        effectivePermission = directPermission.permissionLevel;
      } else {
        effectivePermission = 'no_access';
      }
    }

    this.permissionCache.set(cacheKey, {
      level: effectivePermission,
      expires: Date.now() + 60000
    });

    return effectivePermission;
  }

  clearCache(): void {
    this.permissionCache.clear();
  }

  clearCacheForUser(userId: string): void {
    const keysToDelete: string[] = [];
    this.permissionCache.forEach((_, key) => {
      if (key.startsWith(`${userId}:`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.permissionCache.delete(key));
  }

  clearCacheForResource(resourceType: string, resourceId: string): void {
    const keysToDelete: string[] = [];
    this.permissionCache.forEach((_, key) => {
      if (key.includes(`${resourceType}:${resourceId}`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.permissionCache.delete(key));
  }
}
