CREATE TYPE "public"."anchor_type" AS ENUM('psa', 'custom');--> statement-breakpoint
CREATE TYPE "public"."calendar_event_type" AS ENUM('dd_expiration', 'closing', 'task_deadline', 'milestone', 'custom');--> statement-breakpoint
CREATE TYPE "public"."deadline_type" AS ENUM('dd_expiration', 'days_after_psa');--> statement-breakpoint
CREATE TYPE "public"."document_requirement_status" AS ENUM('requested', 'received', 'verified', 'rejected', 'outdated', 'external_unavailable');--> statement-breakpoint
CREATE TYPE "public"."holiday_calendar" AS ENUM('us_federal', 'none');--> statement-breakpoint
CREATE TYPE "public"."impact" AS ENUM('1', '2', '3', '4', '5');--> statement-breakpoint
CREATE TYPE "public"."likelihood" AS ENUM('1', '2', '3', '4', '5');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('sent', 'failed', 'pending');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('not_paid', 'paid', 'no_cost');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'med', 'high');--> statement-breakpoint
CREATE TYPE "public"."recipient_type" AS ENUM('user', 'contact');--> statement-breakpoint
CREATE TYPE "public"."risk_category" AS ENUM('technical', 'financial', 'legal', 'regulatory', 'operational', 'market', 'strategic', 'environmental', 'reputational', 'cybersecurity');--> statement-breakpoint
CREATE TYPE "public"."risk_status" AS ENUM('identified', 'analyzing', 'mitigating', 'monitoring', 'closed');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."share_access" AS ENUM('view', 'comment');--> statement-breakpoint
CREATE TYPE "public"."share_type" AS ENUM('public', 'invite', 'organization');--> statement-breakpoint
CREATE TYPE "public"."start_strategy" AS ENUM('fixed', 'offset');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('not_started', 'engaged', 'scheduled', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."subscription_event" AS ENUM('task_status', 'note_added', 'deadline_upcoming', 'deadline_today', 'overdue');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar,
	"user_id" varchar NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"task_id" varchar,
	"event_type" "calendar_event_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"is_all_day" boolean DEFAULT false NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"priority" "priority" DEFAULT 'med' NOT NULL,
	"status" "status" DEFAULT 'not_started' NOT NULL,
	"location" text,
	"ical_uid" text,
	"last_synced" timestamp,
	"is_generated" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_requirements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"task_id" varchar NOT NULL,
	"requirement_key" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"provider" text NOT NULL,
	"external_doc_id" text,
	"external_version" text,
	"status" "document_requirement_status" DEFAULT 'requested' NOT NULL,
	"received_at" timestamp,
	"verified_at" timestamp,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_requirements_task_requirement_key" UNIQUE("task_id","requirement_key")
);
--> statement-breakpoint
CREATE TABLE "notification_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"task_id" varchar,
	"recipient_type" "recipient_type" NOT NULL,
	"recipient_id" varchar NOT NULL,
	"channels" "notification_channel"[] DEFAULT '{"email"}' NOT NULL,
	"events" "subscription_event"[] DEFAULT '{"deadline_upcoming","deadline_today","overdue"}' NOT NULL,
	"lead_times_days" integer[] DEFAULT '{7,3,1,0,-1}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"task_id" varchar,
	"event" "subscription_event" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"recipient_type" "recipient_type" NOT NULL,
	"recipient_id" varchar NOT NULL,
	"recipient_email" text,
	"recipient_phone" text,
	"lead_offset_days" integer NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"sent_at" timestamp,
	"provider_message_id" text,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_notification" UNIQUE("project_id","task_id","event","channel","recipient_type","recipient_id","lead_offset_days")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_integrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"provider" text NOT NULL,
	"config" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_integrations_unique_project_provider" UNIQUE("project_id","provider")
);
--> statement-breakpoint
CREATE TABLE "project_settings" (
	"project_id" varchar PRIMARY KEY NOT NULL,
	"use_business_days" boolean DEFAULT false NOT NULL,
	"holiday_calendar" "holiday_calendar" DEFAULT 'us_federal' NOT NULL,
	"notifications_json" jsonb DEFAULT '{}' NOT NULL,
	"nda_required" boolean DEFAULT false NOT NULL,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"default_channels" "notification_channel"[] DEFAULT '{"email"}' NOT NULL,
	"default_events" "subscription_event"[] DEFAULT '{"deadline_upcoming","deadline_today","overdue"}' NOT NULL,
	"default_lead_times_days" integer[] DEFAULT '{7,3,1,0,-1}' NOT NULL,
	"email_template_id" varchar,
	"sms_template_id" varchar,
	"quiet_hours_start" text DEFAULT '22:00',
	"quiet_hours_end" text DEFAULT '08:00',
	"weekend_notifications" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_shares" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"share_type" "share_type" DEFAULT 'public' NOT NULL,
	"access_level" "share_access" DEFAULT 'view' NOT NULL,
	"share_token" varchar NOT NULL,
	"email" text,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_accessed_at" timestamp,
	CONSTRAINT "project_shares_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "project_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"tasks_blueprint" text[] DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"anchor_type" "anchor_type" DEFAULT 'psa' NOT NULL,
	"psa_signed_date" date,
	"dd_expiration_date" date,
	"closing_date" date,
	"dd_period_days" integer,
	"has_extensions" boolean DEFAULT false NOT NULL,
	"extension_count" integer DEFAULT 0,
	"extension_days" integer[] DEFAULT '{}',
	"days_to_closing" integer,
	"seller" text[] DEFAULT '{}',
	"our_attorney" text[] DEFAULT '{}',
	"title_insurance_company" text,
	"lender" text,
	"tz" text DEFAULT 'America/New_York' NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" "risk_category" DEFAULT 'operational' NOT NULL,
	"owner" text NOT NULL,
	"owner_id" varchar,
	"likelihood" "likelihood" DEFAULT '3' NOT NULL,
	"impact" "impact" DEFAULT '3' NOT NULL,
	"risk_score" integer DEFAULT 9 NOT NULL,
	"impact_cost_usd" integer DEFAULT 0,
	"impact_schedule_days" integer DEFAULT 0,
	"mitigation_plan" text,
	"mitigation_owner" text,
	"target_date" date,
	"mitigation_cost_usd" integer DEFAULT 0,
	"residual_likelihood" "likelihood",
	"residual_impact" "impact",
	"residual_score" integer,
	"status" "risk_status" DEFAULT 'identified' NOT NULL,
	"identified_date" date DEFAULT CURRENT_DATE NOT NULL,
	"last_review_date" date,
	"next_review_date" date,
	"materialized" boolean DEFAULT false NOT NULL,
	"materialized_date" date,
	"actual_cost_usd" integer,
	"actual_schedule_days" integer,
	"probability" integer,
	"confidence_level" integer DEFAULT 50,
	"risk_velocity" text DEFAULT 'stable',
	"tags" text[] DEFAULT '{}',
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_strategy" "start_strategy" DEFAULT 'offset' NOT NULL,
	"start_date" date,
	"start_offset_days" integer,
	"deadline_type" "deadline_type" DEFAULT 'days_after_psa',
	"deadline_days" integer,
	"deadline" date,
	"assignee" text,
	"company_hired" text,
	"rep_name" text,
	"rep_email" text,
	"rep_phone" text,
	"company_address" text,
	"company_suite" text,
	"company_city" text,
	"company_state" text,
	"company_zip" text,
	"priority" "priority" DEFAULT 'med' NOT NULL,
	"status" "status" DEFAULT 'not_started' NOT NULL,
	"date_engaged" date,
	"payment_status" "payment_status" DEFAULT 'not_paid' NOT NULL,
	"completed_at" timestamp,
	"date_on_site" text,
	"requires_on_site_inspection" boolean DEFAULT false NOT NULL,
	"ordered_at" date,
	"dependencies" varchar[] DEFAULT '{}',
	"baseline_start" date,
	"baseline_due" date,
	"manually_locked" boolean DEFAULT false NOT NULL,
	"cost" text,
	"notes" text,
	"show_on_timeline" boolean DEFAULT false NOT NULL,
	"sort_order" integer,
	"task_owner" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"author_id" varchar NOT NULL,
	"content" text NOT NULL,
	"note_type" text DEFAULT 'general' NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "role" DEFAULT 'viewer' NOT NULL,
	"tz" text DEFAULT 'America/New_York' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requirements" ADD CONSTRAINT "document_requirements_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requirements" ADD CONSTRAINT "document_requirements_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_subscriptions" ADD CONSTRAINT "notification_subscriptions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_subscriptions" ADD CONSTRAINT "notification_subscriptions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications_log" ADD CONSTRAINT "notifications_log_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications_log" ADD CONSTRAINT "notifications_log_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_integrations" ADD CONSTRAINT "project_integrations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_settings" ADD CONSTRAINT "project_settings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_shares" ADD CONSTRAINT "project_shares_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_shares" ADD CONSTRAINT "project_shares_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risks" ADD CONSTRAINT "risks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risks" ADD CONSTRAINT "risks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_task_owner_users_id_fk" FOREIGN KEY ("task_owner") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_notes" ADD CONSTRAINT "timeline_notes_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_notes" ADD CONSTRAINT "timeline_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_events_project_event_type" ON "calendar_events" USING btree ("project_id","event_type");--> statement-breakpoint
CREATE INDEX "calendar_events_start_date" ON "calendar_events" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "calendar_events_task" ON "calendar_events" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "document_requirements_project" ON "document_requirements" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "document_requirements_task" ON "document_requirements" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "document_requirements_requirement_key" ON "document_requirements" USING btree ("requirement_key");--> statement-breakpoint
CREATE INDEX "document_requirements_status" ON "document_requirements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "document_requirements_provider" ON "document_requirements" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "document_requirements_project_requirement_key" ON "document_requirements" USING btree ("project_id","requirement_key");--> statement-breakpoint
CREATE INDEX "document_requirements_external_doc_id" ON "document_requirements" USING btree ("external_doc_id");--> statement-breakpoint
CREATE INDEX "notification_subscriptions_project" ON "notification_subscriptions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "notification_subscriptions_project_task" ON "notification_subscriptions" USING btree ("project_id","task_id");--> statement-breakpoint
CREATE INDEX "notification_subscriptions_recipient" ON "notification_subscriptions" USING btree ("recipient_type","recipient_id");--> statement-breakpoint
CREATE INDEX "notification_subscriptions_active" ON "notification_subscriptions" USING btree ("active");--> statement-breakpoint
CREATE INDEX "notifications_log_project_task_event" ON "notifications_log" USING btree ("project_id","task_id","event");--> statement-breakpoint
CREATE INDEX "notifications_log_recipient" ON "notifications_log" USING btree ("recipient_type","recipient_id");--> statement-breakpoint
CREATE INDEX "notifications_log_scheduled_at" ON "notifications_log" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "notifications_log_sent_at" ON "notifications_log" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "notifications_log_status" ON "notifications_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_integrations_project" ON "project_integrations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_integrations_provider" ON "project_integrations" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "project_integrations_project_provider" ON "project_integrations" USING btree ("project_id","provider");