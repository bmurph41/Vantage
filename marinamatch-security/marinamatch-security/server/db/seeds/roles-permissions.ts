/**
 * MarinaMatch Roles & Permissions Seed Script
 * 
 * Run this after migrations to set up system roles and permissions.
 * 
 * USAGE:
 * npx tsx server/db/seeds/roles-permissions.ts
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { roles, permissions, rolePermissions } from '../security-schema';
import { eq, and } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

// ============================================================================
// PERMISSION DEFINITIONS
// ============================================================================

const PERMISSIONS = [
  // Documents
  { name: 'documents:read', resource: 'documents', action: 'read', description: 'View documents' },
  { name: 'documents:upload', resource: 'documents', action: 'upload', description: 'Upload new documents' },
  { name: 'documents:delete', resource: 'documents', action: 'delete', description: 'Delete documents' },
  { name: 'documents:download', resource: 'documents', action: 'download', description: 'Download documents' },
  { name: 'documents:approve', resource: 'documents', action: 'approve', description: 'Approve/reject quarantined documents' },
  
  // Models (Valuations)
  { name: 'model:read', resource: 'model', action: 'read', description: 'View valuation models' },
  { name: 'model:write', resource: 'model', action: 'write', description: 'Create/edit valuation models' },
  { name: 'model:apply', resource: 'model', action: 'apply', description: 'Apply data to models' },
  { name: 'model:export', resource: 'model', action: 'export', description: 'Export models' },
  
  // Users
  { name: 'users:read', resource: 'users', action: 'read', description: 'View user list' },
  { name: 'users:invite', resource: 'users', action: 'invite', description: 'Invite new users' },
  { name: 'users:manage', resource: 'users', action: 'manage', description: 'Edit/deactivate users' },
  { name: 'users:assign_roles', resource: 'users', action: 'assign_roles', description: 'Assign roles to users' },
  
  // Integrations
  { name: 'integrations:read', resource: 'integrations', action: 'read', description: 'View integrations' },
  { name: 'integrations:connect', resource: 'integrations', action: 'connect', description: 'Connect new integrations' },
  { name: 'integrations:disconnect', resource: 'integrations', action: 'disconnect', description: 'Disconnect integrations' },
  { name: 'integrations:sync', resource: 'integrations', action: 'sync', description: 'Trigger integration sync' },
  
  // Organization Settings
  { name: 'org:read', resource: 'org', action: 'read', description: 'View organization settings' },
  { name: 'org:manage', resource: 'org', action: 'manage', description: 'Edit organization settings' },
  { name: 'org:billing', resource: 'org', action: 'billing', description: 'Manage billing' },
  
  // Audit Logs
  { name: 'audit:read', resource: 'audit', action: 'read', description: 'View audit logs' },
  
  // CRM (Deals/Contacts)
  { name: 'crm:read', resource: 'crm', action: 'read', description: 'View CRM data' },
  { name: 'crm:write', resource: 'crm', action: 'write', description: 'Create/edit CRM data' },
  { name: 'crm:delete', resource: 'crm', action: 'delete', description: 'Delete CRM data' },
  
  // Reports
  { name: 'reports:read', resource: 'reports', action: 'read', description: 'View reports' },
  { name: 'reports:create', resource: 'reports', action: 'create', description: 'Create reports' },
  { name: 'reports:share', resource: 'reports', action: 'share', description: 'Share reports externally' },
];

// ============================================================================
// ROLE DEFINITIONS (System Roles - org_id = null)
// ============================================================================

interface RoleDefinition {
  name: string;
  description: string;
  permissions: string[];
}

const SYSTEM_ROLES: RoleDefinition[] = [
  {
    name: 'Admin',
    description: 'Full access to all organization features',
    permissions: [
      'documents:read', 'documents:upload', 'documents:delete', 'documents:download', 'documents:approve',
      'model:read', 'model:write', 'model:apply', 'model:export',
      'users:read', 'users:invite', 'users:manage', 'users:assign_roles',
      'integrations:read', 'integrations:connect', 'integrations:disconnect', 'integrations:sync',
      'org:read', 'org:manage', 'org:billing',
      'audit:read',
      'crm:read', 'crm:write', 'crm:delete',
      'reports:read', 'reports:create', 'reports:share',
    ],
  },
  {
    name: 'Owner',
    description: 'Organization owner with full access including billing',
    permissions: [
      'documents:read', 'documents:upload', 'documents:delete', 'documents:download', 'documents:approve',
      'model:read', 'model:write', 'model:apply', 'model:export',
      'users:read', 'users:invite', 'users:manage', 'users:assign_roles',
      'integrations:read', 'integrations:connect', 'integrations:disconnect', 'integrations:sync',
      'org:read', 'org:manage', 'org:billing',
      'audit:read',
      'crm:read', 'crm:write', 'crm:delete',
      'reports:read', 'reports:create', 'reports:share',
    ],
  },
  {
    name: 'Analyst',
    description: 'Access to documents, models, and reports for analysis',
    permissions: [
      'documents:read', 'documents:upload', 'documents:download',
      'model:read', 'model:write', 'model:apply', 'model:export',
      'crm:read',
      'reports:read', 'reports:create',
      'integrations:read',
    ],
  },
  {
    name: 'Investor',
    description: 'Read-only access to reports and key documents',
    permissions: [
      'documents:read', 'documents:download',
      'model:read',
      'reports:read',
    ],
  },
  {
    name: 'Broker',
    description: 'Access to CRM, documents, and deal-related features',
    permissions: [
      'documents:read', 'documents:upload', 'documents:download',
      'model:read',
      'crm:read', 'crm:write',
      'reports:read',
    ],
  },
  {
    name: 'Accountant',
    description: 'Access to financial documents and integrations',
    permissions: [
      'documents:read', 'documents:upload', 'documents:download',
      'model:read',
      'integrations:read', 'integrations:sync',
      'reports:read', 'reports:create',
    ],
  },
  {
    name: 'Attorney',
    description: 'Access to documents for legal review',
    permissions: [
      'documents:read', 'documents:download',
      'reports:read',
    ],
  },
  {
    name: 'Viewer',
    description: 'Minimal read-only access',
    permissions: [
      'documents:read',
      'model:read',
      'reports:read',
    ],
  },
];

// ============================================================================
// SEED FUNCTION
// ============================================================================

async function seed() {
  console.log('🌱 Seeding roles and permissions...\n');

  try {
    // Seed permissions
    console.log('📝 Inserting permissions...');
    for (const perm of PERMISSIONS) {
      await db
        .insert(permissions)
        .values(perm)
        .onConflictDoNothing({ target: permissions.name });
    }
    console.log(`   ✓ ${PERMISSIONS.length} permissions configured\n`);

    // Get all permission IDs
    const allPermissions = await db.select().from(permissions);
    const permissionMap = new Map(allPermissions.map(p => [p.name, p.id]));

    // Seed system roles (org_id = null)
    console.log('👥 Inserting system roles...');
    for (const roleDef of SYSTEM_ROLES) {
      // Insert or get role
      const existingRole = await db
        .select()
        .from(roles)
        .where(and(eq(roles.name, roleDef.name), eq(roles.orgId, null as any)))
        .limit(1);

      let roleId: string;
      if (existingRole.length === 0) {
        const [newRole] = await db
          .insert(roles)
          .values({
            name: roleDef.name,
            description: roleDef.description,
            orgId: null, // System role
            isSystem: true,
          })
          .returning({ id: roles.id });
        roleId = newRole.id;
        console.log(`   ✓ Created role: ${roleDef.name}`);
      } else {
        roleId = existingRole[0].id;
        console.log(`   - Role exists: ${roleDef.name}`);
      }

      // Assign permissions to role
      for (const permName of roleDef.permissions) {
        const permId = permissionMap.get(permName);
        if (permId) {
          await db
            .insert(rolePermissions)
            .values({ roleId, permissionId: permId })
            .onConflictDoNothing();
        } else {
          console.warn(`   ⚠ Permission not found: ${permName}`);
        }
      }
    }

    console.log('\n✅ Seed completed successfully!');
    console.log('\nRole Summary:');
    console.log('─'.repeat(50));
    for (const role of SYSTEM_ROLES) {
      console.log(`  ${role.name.padEnd(12)} │ ${role.permissions.length} permissions`);
    }
    console.log('─'.repeat(50));

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

// Run if executed directly
seed().catch(console.error);

export { seed, PERMISSIONS, SYSTEM_ROLES };
