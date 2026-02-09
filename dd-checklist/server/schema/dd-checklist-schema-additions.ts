/**
 * DD Checklist Engine Schema Additions
 * INSTRUCTIONS: Append to the bottom of shared/schema.ts
 */

// ─── DD Checklist Enums ──────────────────────────────────────────────────────

export const ddChecklistStatusEnum = pgEnum('dd_checklist_status', ['active', 'archived']);
export const ddRequestTypeEnum = pgEnum('dd_request_type', ['document', 'data', 'answer', 'site_access', 'verification', 'other']);
export const ddRequestStatusEnum = pgEnum('dd_request_status', ['open', 'requested', 'in_progress', 'provided', 'reviewing', 'approved', 'rejected', 'waived', 'blocked']);
export const ddInternalStatusEnum = pgEnum('dd_internal_status', ['not_started', 'in_progress', 'waiting_on_seller', 'waiting_on_third_party', 'done']);
export const ddCommentVisibilityEnum = pgEnum('dd_comment_visibility', ['internal', 'external', 'all']);
export const ddHistoryActionEnum = pgEnum('dd_history_action', ['created', 'edited', 'status_changed', 'deadline_changed', 'assigned', 'file_linked', 'file_unlinked', 'commented', 'section_moved', 'item_moved']);
export const ddTemplateAssetClassEnum = pgEnum('dd_template_asset_class', ['general_cre', 'marina', 'multifamily', 'office', 'retail', 'industrial', 'hotel', 'self_storage', 'mhp_rv', 'car_wash', 'laundromat', 'business_acquisition']);
export const ddInviteScopeEnum = pgEnum('dd_invite_scope', ['data_room', 'checklist', 'both']);
export const ddPermissionPresetEnum = pgEnum('dd_permission_preset', ['seller_upload', 'broker_coordinator', 'buyer_viewer', 'lender_viewer', 'custom']);

// ─── DD Checklists ───────────────────────────────────────────────────────────

export const ddChecklists = pgTable('dd_checklists', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar('workspace_id').notNull().references(() => dealWorkspaces.id, { onDelete: 'cascade' }),
  ddProjectId: varchar('dd_project_id').references(() => projects.id),
  orgId: varchar('org_id').notNull(),
  name: text('name').notNull().default('DD Request List'),
  status: ddChecklistStatusEnum('status').notNull().default('active'),
  sellerCanMarkProvided: boolean('seller_can_mark_provided').notNull().default(true),
  sellerCanChangeStatus: boolean('seller_can_change_status').notNull().default(false),
  requireReviewerApproval: boolean('require_reviewer_approval').notNull().default(false),
  autoProvidedOnUpload: boolean('auto_provided_on_upload').notNull().default(true),
  autoReminders: boolean('auto_reminders').notNull().default(false),
  lockAfterClosing: boolean('lock_after_closing').notNull().default(false),
  caRequiredForChecklist: boolean('ca_required_for_checklist').notNull().default(false),
  createdByUserId: varchar('created_by_user_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  workspaceIdx: index('ddc_workspace_idx').on(table.workspaceId),
}));

// ─── DD Checklist Sections ───────────────────────────────────────────────────

export const ddChecklistSections = pgTable('dd_checklist_sections', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  checklistId: varchar('checklist_id').notNull().references(() => ddChecklists.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  title: text('title').notNull(),
  description: text('description'),
  isCollapsedByDefault: boolean('is_collapsed_by_default').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  checklistIdx: index('ddcs_checklist_idx').on(table.checklistId),
}));

// ─── DD Checklist Items ──────────────────────────────────────────────────────

export const ddChecklistItems = pgTable('dd_checklist_items', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  sectionId: varchar('section_id').notNull().references(() => ddChecklistSections.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  title: text('title').notNull(),
  requestText: text('request_text'),
  subCategory: text('sub_category'),
  priority: integer('priority').notNull().default(2),
  requestType: ddRequestTypeEnum('request_type').notNull().default('document'),
  status: ddRequestStatusEnum('status').notNull().default('open'),
  internalStatus: ddInternalStatusEnum('internal_status').notNull().default('not_started'),
  dueDate: date('due_date'),
  milestoneAnchor: varchar('milestone_anchor', { length: 30 }),
  dueOffsetDays: integer('due_offset_days'),
  customMilestoneId: varchar('custom_milestone_id').references(() => ddMilestones.id),
  assignedToMemberId: varchar('assigned_to_member_id').references(() => workspaceMembers.id),
  reviewerMemberId: varchar('reviewer_member_id').references(() => workspaceMembers.id),
  requestedFromMemberId: varchar('requested_from_member_id').references(() => workspaceMembers.id),
  tags: text('tags').array(),
  sellerNotes: text('seller_notes'),
  internalNotes: text('internal_notes'),
  templateKey: varchar('template_key', { length: 100 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  sectionIdx: index('ddci_section_idx').on(table.sectionId),
  statusIdx: index('ddci_status_idx').on(table.status),
  assignedIdx: index('ddci_assigned_idx').on(table.assignedToMemberId),
}));

// ─── DD Checklist Item Files ─────────────────────────────────────────────────

export const ddChecklistItemFiles = pgTable('dd_checklist_item_files', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  itemId: varchar('item_id').notNull().references(() => ddChecklistItems.id, { onDelete: 'cascade' }),
  documentId: varchar('document_id').notNull().references(() => vdrDocuments.id),
  addedByMemberId: varchar('added_by_member_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  itemIdx: index('ddcif_item_idx').on(table.itemId),
}));

// ─── DD Checklist Item Comments ──────────────────────────────────────────────

export const ddChecklistItemComments = pgTable('dd_checklist_item_comments', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  itemId: varchar('item_id').notNull().references(() => ddChecklistItems.id, { onDelete: 'cascade' }),
  memberId: varchar('member_id').references(() => workspaceMembers.id),
  userId: varchar('user_id'),
  visibility: ddCommentVisibilityEnum('visibility').notNull().default('all'),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  itemIdx: index('ddcic_item_idx').on(table.itemId),
}));

// ─── DD Checklist Item History ───────────────────────────────────────────────

export const ddChecklistItemHistory = pgTable('dd_checklist_item_history', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  itemId: varchar('item_id').notNull().references(() => ddChecklistItems.id, { onDelete: 'cascade' }),
  actorMemberId: varchar('actor_member_id'),
  actorUserId: varchar('actor_user_id'),
  action: ddHistoryActionEnum('action').notNull(),
  meta: jsonb('meta').default(sql`'{}'`),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  itemIdx: index('ddcih_item_idx').on(table.itemId),
  createdIdx: index('ddcih_created_idx').on(table.createdAt),
}));

// ─── DD Checklist Templates ──────────────────────────────────────────────────

export const ddChecklistTemplates = pgTable('dd_checklist_templates', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  version: text('version').notNull().default('1.0.0'),
  assetClass: ddTemplateAssetClassEnum('asset_class').notNull().default('general_cre'),
  data: jsonb('data').notNull(),
  isBuiltin: boolean('is_builtin').notNull().default(false),
  orgId: varchar('org_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  assetIdx: index('ddct_asset_idx').on(table.assetClass),
}));

// ─── Type Exports ────────────────────────────────────────────────────────────

export type DdChecklist = typeof ddChecklists.$inferSelect;
export type DdChecklistSection = typeof ddChecklistSections.$inferSelect;
export type DdChecklistItem = typeof ddChecklistItems.$inferSelect;
export type DdChecklistItemFile = typeof ddChecklistItemFiles.$inferSelect;
export type DdChecklistItemComment = typeof ddChecklistItemComments.$inferSelect;
export type DdChecklistItemHistoryEntry = typeof ddChecklistItemHistory.$inferSelect;
export type DdChecklistTemplate = typeof ddChecklistTemplates.$inferSelect;
