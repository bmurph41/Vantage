CREATE TYPE "public"."embeddings_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "calendar_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"sync_enabled" boolean DEFAULT false,
	"default_calendar_id" text DEFAULT 'primary',
	"sync_activities" boolean DEFAULT true,
	"sync_tasks" boolean DEFAULT true,
	"reminder_minutes" integer DEFAULT 15,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "crm_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"parent_account_id" varchar,
	"type" text DEFAULT 'prospect' NOT NULL,
	"industry" text,
	"annual_revenue" numeric(15, 2),
	"employee_count" integer,
	"website" text,
	"phone" text,
	"billing_address" jsonb DEFAULT '{}'::jsonb,
	"shipping_address" jsonb DEFAULT '{}'::jsonb,
	"description" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"custom_fields" jsonb DEFAULT '{}'::jsonb,
	"account_score" integer DEFAULT 0,
	"territory_id" varchar,
	"owner_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"subject" text,
	"description" text NOT NULL,
	"direction" text,
	"duration" integer,
	"outcome" text,
	"status" text DEFAULT 'completed',
	"entity_type" text NOT NULL,
	"entity_id" varchar,
	"user_id" varchar NOT NULL,
	"campaign_id" varchar,
	"scheduled_at" timestamp,
	"completed_at" timestamp,
	"metadata" jsonb,
	"score" integer DEFAULT 0,
	"calendar_event_id" text,
	"synced_to_calendar" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_activity_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"subject_template" text,
	"description_template" text,
	"default_duration" integer,
	"default_direction" text,
	"is_global" boolean DEFAULT false,
	"user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_ai_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar NOT NULL,
	"title" text,
	"context_type" text,
	"context_id" varchar,
	"context_data" jsonb,
	"provider" text DEFAULT 'openai' NOT NULL,
	"model" text DEFAULT 'gpt-4o',
	"is_active" boolean DEFAULT true,
	"last_message_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_ai_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text,
	"function_call" jsonb,
	"function_result" jsonb,
	"tool_calls" jsonb,
	"tool_results" jsonb,
	"token_count" integer,
	"model" text,
	"finish_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'email' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"description" text,
	"budget" numeric(12, 2),
	"spent" numeric(12, 2) DEFAULT '0',
	"start_date" timestamp,
	"end_date" timestamp,
	"target_audience" jsonb DEFAULT '{}'::jsonb,
	"metrics" jsonb DEFAULT '{}'::jsonb,
	"created_by_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"industry" text,
	"size" text,
	"address" text,
	"phone" text,
	"website" text,
	"description" text,
	"labels" text[] DEFAULT ARRAY[]::text[],
	"owner_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_company_properties" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"property_id" varchar NOT NULL,
	"relationship" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_contact_companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" varchar NOT NULL,
	"company_id" varchar NOT NULL,
	"role" text,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_contact_properties" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" varchar NOT NULL,
	"property_id" varchar NOT NULL,
	"relationship" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_contact_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"role" text DEFAULT 'buyer' NOT NULL,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"position" text,
	"address" text,
	"unit" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"company" text,
	"role" text,
	"on_deal_team" boolean DEFAULT false,
	"deal_team_notes" text,
	"deal_assignment" varchar,
	"contact_type" text DEFAULT 'prospect',
	"photo_data_url" text,
	"lead_score" text DEFAULT 'new',
	"labels" text[] DEFAULT ARRAY[]::text[],
	"company_id" varchar,
	"owner_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_contacts_labels" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"scope" text DEFAULT 'both' NOT NULL,
	"created_by_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "crm_contacts_labels_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "crm_deal_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar NOT NULL,
	"field" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb NOT NULL,
	"change_type" text NOT NULL,
	"changed_by_id" varchar NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "crm_deal_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"discount" numeric(5, 2) DEFAULT '0',
	"total_price" numeric(12, 2) NOT NULL,
	"is_recurring" boolean DEFAULT false,
	"billing_cycle" text,
	"start_date" timestamp,
	"end_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_deals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"value" numeric(12, 2),
	"amount" numeric(12, 2),
	"pipeline_id" varchar,
	"stage_id" varchar,
	"stage_order" integer DEFAULT 0,
	"stage" text DEFAULT 'lead' NOT NULL,
	"probability" integer DEFAULT 10,
	"priority" text DEFAULT 'medium' NOT NULL,
	"expected_close_date" timestamp,
	"lead_source" text,
	"last_activity_date" timestamp,
	"days_in_current_stage" integer DEFAULT 0,
	"current_stage_entered_at" timestamp DEFAULT now(),
	"lost_reason" text,
	"competitor_id" varchar,
	"forecast_category" text,
	"commission_amount" numeric(12, 2),
	"commission_rate" numeric(5, 2),
	"commission_type" text DEFAULT 'percentage',
	"deal_source" text,
	"source_details" jsonb DEFAULT '{}'::jsonb,
	"marina_name" text,
	"slip_number" text,
	"dock_location" text,
	"boat_name" text,
	"boat_make" text,
	"boat_model" text,
	"boat_year" integer,
	"boat_length" numeric(6, 2),
	"boat_type" text,
	"property_type" text,
	"lease_term_months" integer,
	"leases" jsonb DEFAULT '[]'::jsonb,
	"property_details" jsonb DEFAULT '{}'::jsonb,
	"city" text,
	"state" text,
	"anchor_type" text DEFAULT 'psa',
	"use_business_days" boolean DEFAULT false,
	"holiday_calendar" text DEFAULT 'us_federal',
	"tz" text DEFAULT 'America/New_York',
	"psa_signed_date" timestamp,
	"dd_expiration_date" timestamp,
	"closing_date" timestamp,
	"dd_period_days" integer,
	"has_extensions" boolean DEFAULT false,
	"extension_count" integer DEFAULT 0,
	"extension_days" integer[],
	"days_to_closing" integer,
	"seller" text[],
	"our_attorney" text[],
	"title_insurance_company" text,
	"lender" text,
	"first_deposit_amount" numeric(12, 2),
	"first_deposit_days" integer,
	"first_deposit_due_date" timestamp,
	"second_deposit_amount" numeric(12, 2),
	"second_deposit_days" integer,
	"second_deposit_due_date" timestamp,
	"custom_deadlines" jsonb DEFAULT '[]'::jsonb,
	"lead_id" varchar,
	"account_id" varchar,
	"primary_contact_id" varchar,
	"campaign_id" varchar,
	"contact_id" varchar,
	"company_id" varchar,
	"referral_agent_id" varchar,
	"transaction_coordinator_id" varchar,
	"owner_id" varchar NOT NULL,
	"dd_project_id" varchar,
	"is_closed" boolean DEFAULT false,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_dedupe_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"entity_type" text NOT NULL,
	"match_fields" jsonb NOT NULL,
	"match_strategy" text DEFAULT 'exact' NOT NULL,
	"case_sensitive" boolean DEFAULT false,
	"auto_merge" boolean DEFAULT false,
	"priority_field" text,
	"priority_order" text DEFAULT 'desc',
	"is_active" boolean DEFAULT true,
	"owner_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_email_communications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"from_email" text NOT NULL,
	"to_email" text NOT NULL,
	"cc_emails" jsonb DEFAULT '[]'::jsonb,
	"bcc_emails" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'sent' NOT NULL,
	"is_template_used" boolean DEFAULT false,
	"template_id" varchar,
	"sequence_id" varchar,
	"lead_id" varchar,
	"contact_id" varchar,
	"deal_id" varchar,
	"campaign_id" varchar,
	"sent_by_id" varchar NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"bounced_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "crm_email_sequence_enrollments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" varchar NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_step" integer DEFAULT 0,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"paused_at" timestamp,
	"cancelled_at" timestamp,
	"exit_reason" text,
	"enrolled_by_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_email_sequence_step_executions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" varchar NOT NULL,
	"step_id" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"bounced_at" timestamp,
	"error_message" text,
	"email_communication_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_email_sequence_steps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" varchar NOT NULL,
	"step_order" integer NOT NULL,
	"delay_days" integer DEFAULT 0,
	"delay_hours" integer DEFAULT 0,
	"email_template_id" varchar,
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"send_time" text,
	"skip_weekends" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_email_sequences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"trigger_event" text NOT NULL,
	"delay_days" integer DEFAULT 0,
	"email_template_id" varchar,
	"created_by_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_email_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'nurture' NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_by_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"file_name" text NOT NULL,
	"size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"url" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"uploaded_by_id" varchar NOT NULL,
	"owner_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_form_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" varchar NOT NULL,
	"date" text NOT NULL,
	"views" integer DEFAULT 0,
	"unique_visitors" integer DEFAULT 0,
	"submissions" integer DEFAULT 0,
	"completed_submissions" integer DEFAULT 0,
	"conversion_rate" numeric(5, 4) DEFAULT '0',
	"average_time_on_form" integer DEFAULT 0,
	"bounce_rate" numeric(5, 4) DEFAULT '0',
	"abandonment_rate" numeric(5, 4) DEFAULT '0',
	"field_dropoff_rates" jsonb DEFAULT '{}'::jsonb,
	"field_completion_times" jsonb DEFAULT '{}'::jsonb,
	"field_error_rates" jsonb DEFAULT '{}'::jsonb,
	"source_breakdown" jsonb DEFAULT '{}'::jsonb,
	"device_breakdown" jsonb DEFAULT '{}'::jsonb,
	"location_breakdown" jsonb DEFAULT '{}'::jsonb,
	"qualified_leads" integer DEFAULT 0,
	"average_lead_score" numeric(5, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_form_fields" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" varchar NOT NULL,
	"field_type" text NOT NULL,
	"field_name" text NOT NULL,
	"label" text NOT NULL,
	"placeholder" text,
	"help_text" text,
	"default_value" text,
	"required" boolean DEFAULT false,
	"min_length" integer,
	"max_length" integer,
	"pattern" text,
	"validation_message" text,
	"options" jsonb DEFAULT '[]'::jsonb,
	"allow_other" boolean DEFAULT false,
	"field_order" integer NOT NULL,
	"width" text DEFAULT 'full',
	"css_classes" text,
	"is_conditional" boolean DEFAULT false,
	"conditional_logic" jsonb DEFAULT '{}'::jsonb,
	"score_weight" integer DEFAULT 0,
	"option_scoring" jsonb DEFAULT '{}'::jsonb,
	"boat_spec_field" text,
	"marina_spec_field" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_form_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" varchar NOT NULL,
	"submission_data" jsonb NOT NULL,
	"lead_id" varchar,
	"contact_id" varchar,
	"session_id" text,
	"ip_address" text,
	"user_agent" text,
	"device_type" text,
	"browser_info" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"referrer_url" text,
	"landing_page_url" text,
	"started_at" timestamp,
	"completion_time" integer,
	"field_interactions" jsonb DEFAULT '[]'::jsonb,
	"abandoned_at" timestamp,
	"abandoned_at_field" text,
	"calculated_score" integer DEFAULT 0,
	"qualification_status" text DEFAULT 'unqualified',
	"geolocation" jsonb DEFAULT '{}'::jsonb,
	"status" text DEFAULT 'pending',
	"processing_errors" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_form_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" varchar NOT NULL,
	"version_number" integer NOT NULL,
	"name" text,
	"description" text,
	"form_data" jsonb NOT NULL,
	"fields_data" jsonb NOT NULL,
	"test_status" text DEFAULT 'draft',
	"traffic_allocation" integer DEFAULT 50,
	"conversion_rate" numeric(5, 4),
	"submissions" integer DEFAULT 0,
	"created_by_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_forms" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'contact' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text,
	"subtitle" text,
	"thank_you_message" text DEFAULT 'Thank you for your submission!',
	"redirect_url" text,
	"submit_button_text" text DEFAULT 'Submit',
	"requires_approval" boolean DEFAULT false,
	"allow_multiple_submissions" boolean DEFAULT true,
	"captcha_enabled" boolean DEFAULT false,
	"progress_bar" boolean DEFAULT false,
	"theme" text DEFAULT 'default',
	"primary_color" text DEFAULT '#3B82F6',
	"background_color" text DEFAULT '#FFFFFF',
	"font_family" text DEFAULT 'Inter',
	"custom_css" text,
	"layout" text DEFAULT 'single_column',
	"meta_title" text,
	"meta_description" text,
	"social_image" text,
	"auto_assign_user" varchar,
	"lead_score" integer DEFAULT 0,
	"follow_up_sequence_id" varchar,
	"notification_emails" jsonb DEFAULT '[]'::jsonb,
	"is_test_variant" boolean DEFAULT false,
	"parent_form_id" varchar,
	"test_split_percentage" integer DEFAULT 50,
	"submission_count" integer DEFAULT 0,
	"conversion_rate" numeric(5, 4) DEFAULT '0',
	"average_completion_time" integer DEFAULT 0,
	"property_type" text,
	"inquiry_type" text,
	"target_budget_range" jsonb DEFAULT '{}'::jsonb,
	"created_by_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_import_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"total_rows" integer NOT NULL,
	"processed_rows" integer DEFAULT 0,
	"successful_rows" integer DEFAULT 0,
	"failed_rows" integer DEFAULT 0,
	"duplicates_found" integer DEFAULT 0,
	"import_type" text DEFAULT 'contacts' NOT NULL,
	"field_mappings" jsonb NOT NULL,
	"duplicate_strategy" text DEFAULT 'skip',
	"status" text DEFAULT 'pending' NOT NULL,
	"current_step" text,
	"progress" integer DEFAULT 0,
	"error_log" jsonb DEFAULT '[]'::jsonb,
	"validation_warnings" jsonb DEFAULT '[]'::jsonb,
	"import_summary" jsonb DEFAULT '{}'::jsonb,
	"csv_data" jsonb,
	"original_headers" jsonb DEFAULT '[]'::jsonb,
	"can_rollback" boolean DEFAULT true,
	"rolled_back_at" timestamp,
	"rolled_back_by" varchar,
	"owner_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "crm_imported_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_job_id" varchar NOT NULL,
	"record_type" text NOT NULL,
	"record_id" varchar NOT NULL,
	"action" text NOT NULL,
	"row_number" integer NOT NULL,
	"original_data" jsonb NOT NULL,
	"was_new" boolean DEFAULT true,
	"matched_by" text,
	"validation_issues" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_landing_pages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"hero_title" text,
	"hero_subtitle" text,
	"hero_image" text,
	"body_content" text,
	"meta_title" text,
	"meta_description" text,
	"meta_keywords" text,
	"og_title" text,
	"og_description" text,
	"og_image" text,
	"template" text DEFAULT 'marina' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_published" boolean DEFAULT false,
	"password_protected" boolean DEFAULT false,
	"password" text,
	"form_id" varchar,
	"form_placement" text DEFAULT 'bottom',
	"is_test_variant" boolean DEFAULT false,
	"parent_page_id" varchar,
	"test_split_percentage" integer DEFAULT 50,
	"view_count" integer DEFAULT 0,
	"unique_visitors" integer DEFAULT 0,
	"conversion_rate" numeric(5, 4) DEFAULT '0',
	"bounce_rate" numeric(5, 4) DEFAULT '0',
	"average_time_on_page" integer DEFAULT 0,
	"custom_css" text,
	"custom_js" text,
	"theme" jsonb DEFAULT '{}'::jsonb,
	"created_by_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "crm_landing_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "crm_lead_engagement_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar NOT NULL,
	"contact_id" varchar,
	"emails_sent" integer DEFAULT 0,
	"emails_opened" integer DEFAULT 0,
	"emails_clicked" integer DEFAULT 0,
	"email_open_rate" numeric(5, 4) DEFAULT '0',
	"email_click_rate" numeric(5, 4) DEFAULT '0',
	"page_visits" integer DEFAULT 0,
	"unique_page_visits" integer DEFAULT 0,
	"total_time_on_site" integer DEFAULT 0,
	"average_session_duration" integer DEFAULT 0,
	"bounce_rate" numeric(5, 4) DEFAULT '0',
	"forms_viewed" integer DEFAULT 0,
	"forms_started" integer DEFAULT 0,
	"forms_completed" integer DEFAULT 0,
	"form_completion_rate" numeric(5, 4) DEFAULT '0',
	"calls_received" integer DEFAULT 0,
	"calls_answered" integer DEFAULT 0,
	"call_answer_rate" numeric(5, 4) DEFAULT '0',
	"average_response_time" integer DEFAULT 0,
	"meetings_scheduled" integer DEFAULT 0,
	"meetings_attended" integer DEFAULT 0,
	"meeting_attendance_rate" numeric(5, 4) DEFAULT '0',
	"engagement_score" numeric(5, 2) DEFAULT '0',
	"engagement_trend" text DEFAULT 'stable',
	"last_email_open" timestamp,
	"last_website_visit" timestamp,
	"last_form_submission" timestamp,
	"last_communication" timestamp,
	"activity_level" text DEFAULT 'low',
	"days_since_last_activity" integer DEFAULT 0,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"calculation_period" integer DEFAULT 30,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_lead_scoring_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar,
	"contact_id" varchar,
	"event_type" text NOT NULL,
	"event_category" text NOT NULL,
	"event_action" text NOT NULL,
	"event_label" text,
	"event_value" integer,
	"points_awarded" integer DEFAULT 0,
	"scoring_rule_id" varchar,
	"entity_type" text,
	"entity_id" varchar,
	"session_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"boat_type" text,
	"marina_service" text,
	"price_range" text,
	"location" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_lead_scoring_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar,
	"contact_id" varchar,
	"previous_score" integer DEFAULT 0,
	"new_score" integer NOT NULL,
	"score_delta" integer NOT NULL,
	"previous_temperature" text,
	"new_temperature" text NOT NULL,
	"trigger_event_id" varchar,
	"trigger_event_type" text NOT NULL,
	"change_reason" text,
	"scoring_rule_id" varchar,
	"user_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"company" text,
	"job_title" text,
	"website" text,
	"linkedin_url" text,
	"lead_score" integer DEFAULT 0,
	"prospect_status" text DEFAULT 'active' NOT NULL,
	"lead_status" text DEFAULT 'new' NOT NULL,
	"lead_source" text DEFAULT 'unknown' NOT NULL,
	"lead_source_details" text,
	"original_source" text,
	"last_touch_source" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"landing_page_url" text,
	"referrer_url" text,
	"current_page_url" text,
	"campaign_id" varchar,
	"channel_type" text,
	"ad_group_id" text,
	"keyword_id" text,
	"session_id" text,
	"visit_count" integer DEFAULT 1,
	"first_visit_date" timestamp,
	"last_visit_date" timestamp,
	"time_to_conversion" integer,
	"touchpoints" jsonb DEFAULT '[]'::jsonb,
	"ip_address" text,
	"user_agent" text,
	"device_type" text,
	"browser_info" text,
	"geolocation" jsonb DEFAULT '{}'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"custom_fields" jsonb DEFAULT '{}'::jsonb,
	"last_activity_date" timestamp,
	"converted_contact_id" varchar,
	"converted_date" timestamp,
	"assigned_to_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_marina_lead_data" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar NOT NULL,
	"contact_id" varchar,
	"current_boat_owner" boolean DEFAULT false,
	"boat_ownership_experience" text,
	"interested_boat_types" jsonb DEFAULT '[]'::jsonb,
	"budget_range" text,
	"services_needed" jsonb DEFAULT '[]'::jsonb,
	"preferred_marina_size" text,
	"preferred_amenities" jsonb DEFAULT '[]'::jsonb,
	"preferred_regions" jsonb DEFAULT '[]'::jsonb,
	"max_distance_from_home" integer,
	"seasonal_usage" text,
	"purchase_timeline" text,
	"purchase_type" text,
	"has_financing" boolean DEFAULT false,
	"trade_in_vehicle" boolean DEFAULT false,
	"industry_role" text,
	"boating_experience" text,
	"certifications" jsonb DEFAULT '[]'::jsonb,
	"boat_show_attendance" jsonb DEFAULT '[]'::jsonb,
	"marina_event_interest" jsonb DEFAULT '[]'::jsonb,
	"referral_source" text,
	"social_proof_factors" jsonb DEFAULT '[]'::jsonb,
	"location_score_multiplier" numeric(3, 2) DEFAULT '1.0',
	"seasonality_multiplier" numeric(3, 2) DEFAULT '1.0',
	"budget_qualification_score" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_merge_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"primary_record_id" varchar NOT NULL,
	"merged_record_ids" jsonb NOT NULL,
	"fields_merged" jsonb,
	"conflict_resolutions" jsonb,
	"merged_by" varchar NOT NULL,
	"merged_at" timestamp DEFAULT now() NOT NULL,
	"dedupe_rule_id" varchar,
	"can_undo" boolean DEFAULT true,
	"undone_at" timestamp,
	"undone_by" varchar,
	"owner_id" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"is_pinned" boolean DEFAULT false,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"created_by_id" varchar NOT NULL,
	"owner_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_pipeline_stages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"stage_order" integer NOT NULL,
	"probability" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"color" text DEFAULT '#3B82F6',
	"pipeline_type" text DEFAULT 'sales' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_pipelines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"color" text DEFAULT '#3B82F6',
	"type" text DEFAULT 'sales' NOT NULL,
	"owner_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"description" text,
	"unit" text DEFAULT 'unit',
	"price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"cost" numeric(12, 2),
	"category" text,
	"is_active" boolean DEFAULT true,
	"owner_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_properties" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'marina' NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"listing_price" numeric(12, 2),
	"address" text,
	"coordinates" jsonb,
	"specifications" jsonb DEFAULT '{}'::jsonb,
	"description" text,
	"images" jsonb DEFAULT '[]'::jsonb,
	"owner_id" varchar NOT NULL,
	"listing_agent_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_prospecting_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospecting_entry_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"activity_type" text NOT NULL,
	"outcome" text NOT NULL,
	"day_of_week" text NOT NULL,
	"activity_date" timestamp NOT NULL,
	"duration" integer,
	"contact_id" varchar,
	"deal_id" varchar,
	"notes" text,
	"follow_up_required" boolean DEFAULT false,
	"follow_up_date" timestamp,
	"phone_number" text,
	"email_address" text,
	"linkedin_profile" text,
	"subject" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_prospecting_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"year" integer NOT NULL,
	"quarter" integer NOT NULL,
	"week_number" integer NOT NULL,
	"week_start_date" timestamp NOT NULL,
	"week_end_date" timestamp NOT NULL,
	"goals" jsonb DEFAULT '[]'::jsonb,
	"enabled_days" jsonb DEFAULT '["monday","tuesday","wednesday","thursday","friday"]'::jsonb,
	"daily_activities" jsonb DEFAULT '{}'::jsonb,
	"total_lead_generation" integer DEFAULT 0,
	"total_calls" integer DEFAULT 0,
	"total_emails" integer DEFAULT 0,
	"total_meetings" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_scoring_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger_event" text NOT NULL,
	"conditions" jsonb NOT NULL,
	"points" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_by_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'task' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"due_date" timestamp,
	"completed" boolean DEFAULT false NOT NULL,
	"deal_id" varchar,
	"contact_id" varchar,
	"company_id" varchar,
	"property_id" varchar,
	"assignee_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_territories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"criteria" jsonb DEFAULT '{}'::jsonb,
	"manager_id" varchar NOT NULL,
	"members" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_webhook_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" varchar NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status_code" integer,
	"response_body" text,
	"response_time" integer,
	"error_message" text,
	"success" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_webhooks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"url" text NOT NULL,
	"method" text DEFAULT 'POST' NOT NULL,
	"owner_id" varchar NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb,
	"secret" text,
	"is_active" boolean DEFAULT true,
	"total_calls" integer DEFAULT 0,
	"successful_calls" integer DEFAULT 0,
	"failed_calls" integer DEFAULT 0,
	"last_called_at" timestamp,
	"last_status" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_website_visitors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_id" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"location" jsonb DEFAULT '{}'::jsonb,
	"page_url" text NOT NULL,
	"page_title" text,
	"referrer_url" text,
	"session_duration" integer,
	"lead_id" varchar,
	"contact_id" varchar,
	"campaign_id" varchar,
	"visited_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_workflows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"owner_id" varchar NOT NULL,
	"trigger" jsonb NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb,
	"actions" jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"trigger_count" integer DEFAULT 0,
	"last_triggered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"role" "contact_role" NOT NULL,
	"custom_role" text,
	"project_notes" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_project_contact_role" UNIQUE("project_id","contact_id","role")
);
--> statement-breakpoint
ALTER TABLE "cdd_documents" ADD COLUMN "embeddings_status" "embeddings_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "cdd_documents" ADD COLUMN "embeddings_error" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "leases" jsonb DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "requires_decision" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "calendar_event_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "synced_to_calendar" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "calendar_settings" ADD CONSTRAINT "calendar_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_territory_id_crm_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."crm_territories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_campaign_id_crm_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crm_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activity_templates" ADD CONSTRAINT "crm_activity_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ai_conversations" ADD CONSTRAINT "crm_ai_conversations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ai_messages" ADD CONSTRAINT "crm_ai_messages_conversation_id_crm_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."crm_ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaigns" ADD CONSTRAINT "crm_campaigns_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_company_properties" ADD CONSTRAINT "crm_company_properties_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."crm_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_company_properties" ADD CONSTRAINT "crm_company_properties_property_id_crm_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."crm_properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_companies" ADD CONSTRAINT "crm_contact_companies_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_companies" ADD CONSTRAINT "crm_contact_companies_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."crm_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_properties" ADD CONSTRAINT "crm_contact_properties_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_properties" ADD CONSTRAINT "crm_contact_properties_property_id_crm_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."crm_properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_roles" ADD CONSTRAINT "crm_contact_roles_deal_id_crm_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."crm_deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_roles" ADD CONSTRAINT "crm_contact_roles_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_deal_assignment_crm_deals_id_fk" FOREIGN KEY ("deal_assignment") REFERENCES "public"."crm_deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."crm_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts_labels" ADD CONSTRAINT "crm_contacts_labels_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deal_history" ADD CONSTRAINT "crm_deal_history_deal_id_crm_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."crm_deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deal_history" ADD CONSTRAINT "crm_deal_history_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deal_products" ADD CONSTRAINT "crm_deal_products_deal_id_crm_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."crm_deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deal_products" ADD CONSTRAINT "crm_deal_products_product_id_crm_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."crm_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_pipeline_id_crm_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."crm_pipelines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_stage_id_crm_pipeline_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."crm_pipeline_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_referral_agent_id_crm_contacts_id_fk" FOREIGN KEY ("referral_agent_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_transaction_coordinator_id_users_id_fk" FOREIGN KEY ("transaction_coordinator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_dd_project_id_projects_id_fk" FOREIGN KEY ("dd_project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_dedupe_rules" ADD CONSTRAINT "crm_dedupe_rules_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_communications" ADD CONSTRAINT "crm_email_communications_template_id_crm_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."crm_email_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_communications" ADD CONSTRAINT "crm_email_communications_sequence_id_crm_email_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."crm_email_sequences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_communications" ADD CONSTRAINT "crm_email_communications_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_communications" ADD CONSTRAINT "crm_email_communications_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_communications" ADD CONSTRAINT "crm_email_communications_deal_id_crm_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."crm_deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_communications" ADD CONSTRAINT "crm_email_communications_campaign_id_crm_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crm_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_communications" ADD CONSTRAINT "crm_email_communications_sent_by_id_users_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_sequence_enrollments" ADD CONSTRAINT "crm_email_sequence_enrollments_sequence_id_crm_email_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."crm_email_sequences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_sequence_enrollments" ADD CONSTRAINT "crm_email_sequence_enrollments_enrolled_by_id_users_id_fk" FOREIGN KEY ("enrolled_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_sequence_step_executions" ADD CONSTRAINT "crm_email_sequence_step_executions_enrollment_id_crm_email_sequence_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."crm_email_sequence_enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_sequence_step_executions" ADD CONSTRAINT "crm_email_sequence_step_executions_step_id_crm_email_sequence_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."crm_email_sequence_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_sequence_step_executions" ADD CONSTRAINT "crm_email_sequence_step_executions_email_communication_id_crm_email_communications_id_fk" FOREIGN KEY ("email_communication_id") REFERENCES "public"."crm_email_communications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_sequence_steps" ADD CONSTRAINT "crm_email_sequence_steps_sequence_id_crm_email_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."crm_email_sequences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_sequence_steps" ADD CONSTRAINT "crm_email_sequence_steps_email_template_id_crm_email_templates_id_fk" FOREIGN KEY ("email_template_id") REFERENCES "public"."crm_email_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_sequences" ADD CONSTRAINT "crm_email_sequences_email_template_id_crm_email_templates_id_fk" FOREIGN KEY ("email_template_id") REFERENCES "public"."crm_email_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_sequences" ADD CONSTRAINT "crm_email_sequences_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_templates" ADD CONSTRAINT "crm_email_templates_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_files" ADD CONSTRAINT "crm_files_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_files" ADD CONSTRAINT "crm_files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_form_analytics" ADD CONSTRAINT "crm_form_analytics_form_id_crm_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."crm_forms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_form_fields" ADD CONSTRAINT "crm_form_fields_form_id_crm_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."crm_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_form_submissions" ADD CONSTRAINT "crm_form_submissions_form_id_crm_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."crm_forms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_form_submissions" ADD CONSTRAINT "crm_form_submissions_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_form_submissions" ADD CONSTRAINT "crm_form_submissions_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_form_versions" ADD CONSTRAINT "crm_form_versions_form_id_crm_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."crm_forms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_form_versions" ADD CONSTRAINT "crm_form_versions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_forms" ADD CONSTRAINT "crm_forms_auto_assign_user_users_id_fk" FOREIGN KEY ("auto_assign_user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_forms" ADD CONSTRAINT "crm_forms_follow_up_sequence_id_crm_email_sequences_id_fk" FOREIGN KEY ("follow_up_sequence_id") REFERENCES "public"."crm_email_sequences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_forms" ADD CONSTRAINT "crm_forms_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_import_jobs" ADD CONSTRAINT "crm_import_jobs_rolled_back_by_users_id_fk" FOREIGN KEY ("rolled_back_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_import_jobs" ADD CONSTRAINT "crm_import_jobs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_imported_records" ADD CONSTRAINT "crm_imported_records_import_job_id_crm_import_jobs_id_fk" FOREIGN KEY ("import_job_id") REFERENCES "public"."crm_import_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_landing_pages" ADD CONSTRAINT "crm_landing_pages_form_id_crm_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."crm_forms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_landing_pages" ADD CONSTRAINT "crm_landing_pages_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_engagement_metrics" ADD CONSTRAINT "crm_lead_engagement_metrics_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_engagement_metrics" ADD CONSTRAINT "crm_lead_engagement_metrics_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_scoring_events" ADD CONSTRAINT "crm_lead_scoring_events_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_scoring_events" ADD CONSTRAINT "crm_lead_scoring_events_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_scoring_events" ADD CONSTRAINT "crm_lead_scoring_events_scoring_rule_id_crm_scoring_rules_id_fk" FOREIGN KEY ("scoring_rule_id") REFERENCES "public"."crm_scoring_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_scoring_history" ADD CONSTRAINT "crm_lead_scoring_history_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_scoring_history" ADD CONSTRAINT "crm_lead_scoring_history_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_scoring_history" ADD CONSTRAINT "crm_lead_scoring_history_trigger_event_id_crm_lead_scoring_events_id_fk" FOREIGN KEY ("trigger_event_id") REFERENCES "public"."crm_lead_scoring_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_scoring_history" ADD CONSTRAINT "crm_lead_scoring_history_scoring_rule_id_crm_scoring_rules_id_fk" FOREIGN KEY ("scoring_rule_id") REFERENCES "public"."crm_scoring_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_scoring_history" ADD CONSTRAINT "crm_lead_scoring_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_campaign_id_crm_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crm_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_converted_contact_id_crm_contacts_id_fk" FOREIGN KEY ("converted_contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_marina_lead_data" ADD CONSTRAINT "crm_marina_lead_data_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_marina_lead_data" ADD CONSTRAINT "crm_marina_lead_data_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_merge_history" ADD CONSTRAINT "crm_merge_history_merged_by_users_id_fk" FOREIGN KEY ("merged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_merge_history" ADD CONSTRAINT "crm_merge_history_dedupe_rule_id_crm_dedupe_rules_id_fk" FOREIGN KEY ("dedupe_rule_id") REFERENCES "public"."crm_dedupe_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_merge_history" ADD CONSTRAINT "crm_merge_history_undone_by_users_id_fk" FOREIGN KEY ("undone_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_merge_history" ADD CONSTRAINT "crm_merge_history_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_pipeline_stages" ADD CONSTRAINT "crm_pipeline_stages_pipeline_id_crm_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."crm_pipelines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_pipelines" ADD CONSTRAINT "crm_pipelines_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_products" ADD CONSTRAINT "crm_products_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_properties" ADD CONSTRAINT "crm_properties_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_properties" ADD CONSTRAINT "crm_properties_listing_agent_id_crm_contacts_id_fk" FOREIGN KEY ("listing_agent_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_prospecting_activities" ADD CONSTRAINT "crm_prospecting_activities_prospecting_entry_id_crm_prospecting_entries_id_fk" FOREIGN KEY ("prospecting_entry_id") REFERENCES "public"."crm_prospecting_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_prospecting_activities" ADD CONSTRAINT "crm_prospecting_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_prospecting_activities" ADD CONSTRAINT "crm_prospecting_activities_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_prospecting_activities" ADD CONSTRAINT "crm_prospecting_activities_deal_id_crm_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."crm_deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_prospecting_entries" ADD CONSTRAINT "crm_prospecting_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_scoring_rules" ADD CONSTRAINT "crm_scoring_rules_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_deal_id_crm_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."crm_deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."crm_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_property_id_crm_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."crm_properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_territories" ADD CONSTRAINT "crm_territories_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_webhook_logs" ADD CONSTRAINT "crm_webhook_logs_webhook_id_crm_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."crm_webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_webhooks" ADD CONSTRAINT "crm_webhooks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_website_visitors" ADD CONSTRAINT "crm_website_visitors_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_website_visitors" ADD CONSTRAINT "crm_website_visitors_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_website_visitors" ADD CONSTRAINT "crm_website_visitors_campaign_id_crm_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crm_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_workflows" ADD CONSTRAINT "crm_workflows_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_contacts" ADD CONSTRAINT "project_contacts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_contacts" ADD CONSTRAINT "project_contacts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_contacts_project" ON "project_contacts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_contacts_contact" ON "project_contacts" USING btree ("contact_id");