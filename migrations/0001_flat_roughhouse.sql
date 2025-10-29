CREATE TYPE "public"."calendar_provider" AS ENUM('google', 'outlook', 'apple');--> statement-breakpoint
CREATE TYPE "public"."confidence_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."contact_role" AS ENUM('seller', 'attorney', 'lender', 'title_insurance', 'inspector', 'surveyor', 'environmental', 'appraiser', 'broker', 'insurance_agent', 'other');--> statement-breakpoint
CREATE TYPE "public"."dashboard_type" AS ENUM('default', 'investor', 'owner', 'attorney', 'lender', 'inspector', 'third_party');--> statement-breakpoint
CREATE TYPE "public"."dd_category" AS ENUM('title', 'survey', 'ESA', 'appraisal', 'inspection', 'permits', 'zoning', 'financial', 'legal', 'insurance', 'other');--> statement-breakpoint
CREATE TYPE "public"."dependency_type" AS ENUM('FS', 'SS', 'FF', 'SF');--> statement-breakpoint
CREATE TYPE "public"."email_type" AS ENUM('primary', 'additional');--> statement-breakpoint
CREATE TYPE "public"."guest_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."parse_status" AS ENUM('pending', 'parsing', 'parsed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('low', 'med', 'high', 'critical');--> statement-breakpoint
CREATE TABLE "calendar_guests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"invited_by" varchar NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"calendar_provider" "calendar_provider",
	"status" "guest_status" DEFAULT 'pending' NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_guests_unique_project_guest" UNIQUE("project_id","email")
);
--> statement-breakpoint
CREATE TABLE "cdd_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_path" text NOT NULL,
	"parse_status" "parse_status" DEFAULT 'pending' NOT NULL,
	"parse_error" text,
	"uploaded_by" varchar NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"parsed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cdd_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"title" text NOT NULL,
	"body_md" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"section" text NOT NULL,
	"item" text NOT NULL,
	"status" "status" DEFAULT 'not_started' NOT NULL,
	"owner_user_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"name" text NOT NULL,
	"asset_type" text,
	"location" text,
	"slips" integer,
	"racks" integer,
	"rate_notes" text,
	"source" text,
	"capex_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doc_pages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"page_no" integer NOT NULL,
	"text" text NOT NULL,
	"tokens" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "doc_pages_unique_document_page" UNIQUE("document_id","page_no")
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"title" text NOT NULL,
	"severity" "severity" DEFAULT 'low' NOT NULL,
	"body_md" text NOT NULL,
	"sources" jsonb DEFAULT '[]',
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"name" text NOT NULL,
	"value_text" text,
	"value_num" integer,
	"unit" text,
	"source_document_id" varchar,
	"page_hint" text,
	"confidence" "confidence_level" DEFAULT 'medium' NOT NULL,
	"category" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"title" text NOT NULL,
	"body_md" text NOT NULL,
	"priority" "priority" DEFAULT 'med' NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_dependencies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"successor_id" varchar NOT NULL,
	"predecessor_id" varchar NOT NULL,
	"type" "dependency_type" DEFAULT 'FS' NOT NULL,
	"lag_days" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_dependencies_successor_id_predecessor_id_unique" UNIQUE("successor_id","predecessor_id")
);
--> statement-breakpoint
CREATE TABLE "task_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"task_id" varchar NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_provider" text DEFAULT 'local' NOT NULL,
	"storage_path" text NOT NULL,
	"url" text,
	"uploaded_by" varchar NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"visibility" text DEFAULT 'org' NOT NULL,
	"checksum" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_emails" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"email" text NOT NULL,
	"email_type" "email_type" DEFAULT 'additional' NOT NULL,
	"calendar_provider" "calendar_provider",
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_emails_unique_user_email" UNIQUE("user_id","email")
);
--> statement-breakpoint
CREATE TABLE "vector_chunks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"source_type" text NOT NULL,
	"source_id" varchar NOT NULL,
	"content_text" text NOT NULL,
	"embedding" vector(1536),
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "org_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "ip_address" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "metadata" jsonb DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "role" "contact_role";--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "custom_role" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "company" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "on_deal_team" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "deal_team_notes" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "first_deposit_amount" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "first_deposit_days" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "first_deposit_due_date" date;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "second_deposit_amount" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "second_deposit_days" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "second_deposit_due_date" date;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "executive_notes" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "purchase_price" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "estimated_renovation_cost" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "projected_annual_revenue" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "investment_thesis" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "deal_health_score" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "health_score_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "custom_deadlines" jsonb DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "optimistic_days" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "most_likely_days" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "pessimistic_days" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "earliest_start" date;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "required_finish" date;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "is_gating" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "is_milestone" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "dd_category" "dd_category";--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_calendar_provider" "calendar_provider";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "calendar_sync_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferred_dashboard" "dashboard_type" DEFAULT 'default';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "dashboard_config" jsonb DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "calendar_guests" ADD CONSTRAINT "calendar_guests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_guests" ADD CONSTRAINT "calendar_guests_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cdd_documents" ADD CONSTRAINT "cdd_documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cdd_documents" ADD CONSTRAINT "cdd_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cdd_reports" ADD CONSTRAINT "cdd_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cdd_reports" ADD CONSTRAINT "cdd_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comps" ADD CONSTRAINT "comps_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_pages" ADD CONSTRAINT "doc_pages_document_id_cdd_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."cdd_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_source_document_id_cdd_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."cdd_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_successor_id_tasks_id_fk" FOREIGN KEY ("successor_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_predecessor_id_tasks_id_fk" FOREIGN KEY ("predecessor_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_files" ADD CONSTRAINT "task_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_files" ADD CONSTRAINT "task_files_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_files" ADD CONSTRAINT "task_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_emails" ADD CONSTRAINT "user_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vector_chunks" ADD CONSTRAINT "vector_chunks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_guests_project" ON "calendar_guests" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "calendar_guests_email" ON "calendar_guests" USING btree ("email");--> statement-breakpoint
CREATE INDEX "calendar_guests_invited_by" ON "calendar_guests" USING btree ("invited_by");--> statement-breakpoint
CREATE INDEX "cdd_documents_project" ON "cdd_documents" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "cdd_documents_parse_status" ON "cdd_documents" USING btree ("parse_status");--> statement-breakpoint
CREATE INDEX "cdd_reports_project" ON "cdd_reports" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "cdd_reports_version" ON "cdd_reports" USING btree ("project_id","version");--> statement-breakpoint
CREATE INDEX "checklist_items_project" ON "checklist_items" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "checklist_items_section" ON "checklist_items" USING btree ("project_id","section");--> statement-breakpoint
CREATE INDEX "checklist_items_status" ON "checklist_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "comps_project" ON "comps" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "doc_pages_document_page" ON "doc_pages" USING btree ("document_id","page_no");--> statement-breakpoint
CREATE INDEX "findings_project" ON "findings" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "findings_severity" ON "findings" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "findings_created_by" ON "findings" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "kpis_project" ON "kpis" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "kpis_source_document" ON "kpis" USING btree ("source_document_id");--> statement-breakpoint
CREATE INDEX "kpis_category" ON "kpis" USING btree ("category");--> statement-breakpoint
CREATE INDEX "recommendations_project" ON "recommendations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "recommendations_priority" ON "recommendations" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "user_emails_user" ON "user_emails" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_emails_email" ON "user_emails" USING btree ("email");--> statement-breakpoint
CREATE INDEX "vector_chunks_project" ON "vector_chunks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "vector_chunks_source" ON "vector_chunks" USING btree ("source_type","source_id");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_org" ON "audit_logs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "audit_logs_project" ON "audit_logs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_unique_task_event" UNIQUE("project_id","task_id","event_type");