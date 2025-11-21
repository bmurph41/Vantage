CREATE TYPE "public"."account_type" AS ENUM('annual', 'seasonal', 'transient', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('under_management', 'optimization', 'exit');--> statement-breakpoint
CREATE TYPE "public"."attribution_type" AS ENUM('first_touch', 'last_touch', 'assisted');--> statement-breakpoint
CREATE TYPE "public"."audit_event_type" AS ENUM('view', 'download', 'print', 'share', 'edit', 'delete', 'permission_change', 'folder_created', 'folder_updated', 'folder_deleted', 'document_uploaded', 'document_updated', 'document_deleted');--> statement-breakpoint
CREATE TYPE "public"."contact_method" AS ENUM('email', 'phone', 'sms', 'mail');--> statement-breakpoint
CREATE TYPE "public"."contact_tag" AS ENUM('lead', 'seller', 'competitor', 'broker', 'vendor', 'insurance', 'lender', 'attorney', 'other');--> statement-breakpoint
CREATE TYPE "public"."customer_status" AS ENUM('active', 'inactive', 'prospect', 'churned');--> statement-breakpoint
CREATE TYPE "public"."data_request_item_status" AS ENUM('outstanding', 'in_progress', 'received', 'n_a');--> statement-breakpoint
CREATE TYPE "public"."data_request_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."deal_origin" AS ENUM('marinaMatch', 'aiExtraction');--> statement-breakpoint
CREATE TYPE "public"."deal_outcome" AS ENUM('won', 'lost', 'passed', 'under_review', 'active');--> statement-breakpoint
CREATE TYPE "public"."docktalk_deal_status" AS ENUM('rumored', 'announced', 'pending', 'closed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."docktalk_transaction_type" AS ENUM('ma', 'financing', 'partnership', 'asset_sale', 'other');--> statement-breakpoint
CREATE TYPE "public"."email_platform" AS ENUM('mailchimp', 'constant_contact');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('advertising', 'software', 'agency_fees', 'content_creation', 'events', 'sponsorships', 'tools', 'other');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('pending', 'approved', 'paid', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."external_user_project_access_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."external_user_role" AS ENUM('seller', 'buyer', 'advisor', 'auditor', 'lender', 'attorney', 'other');--> statement-breakpoint
CREATE TYPE "public"."fuel_category" AS ENUM('regular', 'premium', 'diesel', 'ethanol');--> statement-breakpoint
CREATE TYPE "public"."fuel_type" AS ENUM('diesel', 'regular_gas', 'premium_gas', 'ethanol_free');--> statement-breakpoint
CREATE TYPE "public"."hold_strategy" AS ENUM('core', 'value_add', 'opportunistic');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('none', 'new', 'contacted', 'qualified', 'unqualified', 'converted');--> statement-breakpoint
CREATE TYPE "public"."marketing_campaign_status" AS ENUM('planning', 'active', 'paused', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."marketing_channel" AS ENUM('email', 'paid_ads', 'social_media', 'content', 'events', 'direct_mail', 'seo', 'partnerships', 'referral', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'credit_card', 'debit_card', 'account_charge', 'check');--> statement-breakpoint
CREATE TYPE "public"."persona_type" AS ENUM('pe_investor', 'broker', 'operator', 'advisor');--> statement-breakpoint
CREATE TYPE "public"."phone_type" AS ENUM('office', 'mobile', 'home');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'accepted', 'completed');--> statement-breakpoint
CREATE TYPE "public"."rent_roll_context" AS ENUM('operational', 'valuation');--> statement-breakpoint
CREATE TYPE "public"."rent_roll_entry_type" AS ENUM('slip', 'rack', 'commercial', 'seasonal');--> statement-breakpoint
CREATE TYPE "public"."request_category" AS ENUM('financial', 'legal', 'hr', 'it', 'commercial', 'environmental', 'tax', 'ip', 'regulatory', 'operational', 'other');--> statement-breakpoint
CREATE TYPE "public"."request_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'in_review', 'responded', 'completed', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('fuel', 'maintenance', 'dockage', 'storage', 'amenity', 'other');--> statement-breakpoint
CREATE TYPE "public"."slip_status" AS ENUM('active', 'expired', 'reserved', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."slip_type" AS ENUM('wet', 'dry', 'rack', 'mooring');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'completed', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'editor', 'viewer', 'auditor');--> statement-breakpoint
CREATE TYPE "public"."vdr_permission_level" AS ENUM('no_access', 'view_only', 'view_download', 'view_download_print', 'full_access');--> statement-breakpoint
CREATE TYPE "public"."watermark_type" AS ENUM('static', 'dynamic');--> statement-breakpoint
CREATE TYPE "public"."widget_category" AS ENUM('analytics', 'pipeline', 'operations', 'finance', 'tasks', 'market_intel');--> statement-breakpoint
CREATE TYPE "public"."docktalk_alert_frequency" AS ENUM('none', 'immediate', 'daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."docktalk_entity_type" AS ENUM('company', 'person', 'location', 'asset');--> statement-breakpoint
CREATE TYPE "public"."docktalk_feature_tier" AS ENUM('docktalk_free', 'docktalk_pro');--> statement-breakpoint
CREATE TYPE "public"."docktalk_notification_source" AS ENUM('saved_search', 'category_alert');--> statement-breakpoint
CREATE TYPE "public"."docktalk_region" AS ENUM('US/Domestic', 'International');--> statement-breakpoint
CREATE TYPE "public"."docktalk_source_type" AS ENUM('rss', 'web_scrape');--> statement-breakpoint
CREATE TYPE "public"."docktalk_subscription_tier" AS ENUM('free', 'pro');--> statement-breakpoint
CREATE TYPE "public"."docktalk_summary_period" AS ENUM('daily', 'weekly');--> statement-breakpoint
CREATE TABLE "asset_performance_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owned_asset_id" varchar NOT NULL,
	"snapshot_date" date NOT NULL,
	"metrics" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_performance_snapshots_owned_asset_id_snapshot_date_unique" UNIQUE("owned_asset_id","snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "ship_store_assumptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" varchar NOT NULL,
	"revenue_growth_rate" numeric(5, 2),
	"monthly_revenue_growth" numeric(5, 2),
	"seasonality_factors" jsonb,
	"cogs_percentage" numeric(5, 2),
	"opex_growth" numeric(5, 2),
	"fixed_costs" numeric(10, 2),
	"target_gross_margin" numeric(5, 2),
	"target_operating_margin" numeric(5, 2),
	"new_product_impact" jsonb,
	"category_growth_rates" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "ship_store_assumptions_scenario_id_unique" UNIQUE("scenario_id")
);
--> statement-breakpoint
CREATE TABLE "boat_registry" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"boat_name" text NOT NULL,
	"make" text,
	"model" text,
	"year" integer,
	"length" numeric(5, 2),
	"registration" text,
	"insurance_expiry" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "boat_registry_org_registration" UNIQUE("org_id","registration")
);
--> statement-breakpoint
CREATE TABLE "ship_store_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_prospecting_goal_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"frequency" text NOT NULL,
	"goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"auto_instantiate" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_prospecting_user_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"week_start_day" text DEFAULT 'monday',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "crm_prospecting_user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "dashboard_widgets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"widget_key" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" "widget_category" NOT NULL,
	"data_source" text,
	"default_size" jsonb DEFAULT '{"width": 1, "height": 1}',
	"available_to_personas" "persona_type"[] DEFAULT '{}',
	"config_schema" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dashboard_widgets_widget_key_unique" UNIQUE("widget_key")
);
--> statement-breakpoint
CREATE TABLE "debt_scenarios" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"base_rate" text NOT NULL,
	"spread_bps" integer DEFAULT 250 NOT NULL,
	"purchase_price" numeric(15, 2) NOT NULL,
	"loan_amount" numeric(15, 2) NOT NULL,
	"noi" numeric(15, 2) NOT NULL,
	"amortization_years" integer DEFAULT 25 NOT NULL,
	"loan_term_years" integer DEFAULT 10 NOT NULL,
	"interest_only_years" integer DEFAULT 0 NOT NULL,
	"deal_id" varchar,
	"project_id" varchar,
	"created_by" varchar,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diligence_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"task_id" varchar,
	"category" "request_category" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" "request_priority" DEFAULT 'medium' NOT NULL,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"assignee_id" varchar,
	"external_assignee_id" varchar,
	"external_assignee_email" text,
	"requestor_id" varchar NOT NULL,
	"due_date" date,
	"responded_at" timestamp,
	"completed_at" timestamp,
	"response_text" text,
	"sla_hours" integer,
	"is_overdue" boolean DEFAULT false NOT NULL,
	"org_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "docktalk_article_removal_patterns" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"removal_reason" text NOT NULL,
	"removal_keywords" text[],
	"removed_by" varchar,
	"article_title" text NOT NULL,
	"article_source" text NOT NULL,
	"article_categories" text[],
	"article_tags" text[],
	"article_content" text,
	"removed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "docktalk_deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"transaction_type" "docktalk_transaction_type" NOT NULL,
	"deal_status" "docktalk_deal_status" DEFAULT 'announced' NOT NULL,
	"buyer" text,
	"buyer_entity_id" integer,
	"seller" text,
	"seller_entity_id" integer,
	"transaction_size" text,
	"valuation" text,
	"equity_stake" text,
	"closing_date" timestamp,
	"announced_date" timestamp,
	"deal_summary" text,
	"confidence" integer DEFAULT 80,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "docktalk_entities" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "docktalk_entity_type" NOT NULL,
	"normalized_name" text NOT NULL,
	"aliases" text[],
	"description" text,
	"industry" text,
	"location" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "docktalk_notification_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"email_address" text NOT NULL,
	"categories" text[] DEFAULT '{}',
	"frequency" "docktalk_alert_frequency" DEFAULT 'none' NOT NULL,
	"delivery_time" text DEFAULT '09:00',
	"timezone" text DEFAULT 'America/New_York',
	"enabled" boolean DEFAULT true,
	"last_sent_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "docktalk_notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "docktalk_portfolio_companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"company_name" text NOT NULL,
	"aliases" text[],
	"sector" text,
	"region" text,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "docktalk_saved_searches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"name" text NOT NULL,
	"criteria" jsonb NOT NULL,
	"alert_frequency" text DEFAULT 'none' NOT NULL,
	"last_alert_sent" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "docktalk_user_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"default_filters" jsonb DEFAULT '{}'::jsonb,
	"favorite_categories" text[] DEFAULT '{}',
	"favorite_sources" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "docktalk_user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "docktalk_watchlist_entities" (
	"id" serial PRIMARY KEY NOT NULL,
	"watchlist_id" varchar NOT NULL,
	"entity_id" integer NOT NULL,
	"added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "docktalk_watchlists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"alert_frequency" "docktalk_alert_frequency" DEFAULT 'none' NOT NULL,
	"last_alert_sent" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"campaign_id" varchar,
	"platform" "email_platform" NOT NULL,
	"external_id" text NOT NULL,
	"list_id" text,
	"segment_id" text,
	"subject" text NOT NULL,
	"sent_date" timestamp,
	"recipient_count" integer DEFAULT 0,
	"open_rate" numeric(5, 2),
	"click_rate" numeric(5, 2),
	"conversion_rate" numeric(5, 2),
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_user_project_access" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_user_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"can_view_folders" text[] DEFAULT '{}',
	"can_view_requests" text[] DEFAULT '{}',
	"expires_at" timestamp,
	"org_id" varchar NOT NULL,
	"granted_by" varchar NOT NULL,
	"status" "external_user_project_access_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"company" text,
	"role" "external_user_role" NOT NULL,
	"invited_by" varchar NOT NULL,
	"invitation_token" text,
	"invitation_sent_at" timestamp,
	"accepted_at" timestamp,
	"last_login_at" timestamp,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"two_factor_secret" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"org_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_users_invitation_token_unique" UNIQUE("invitation_token"),
	CONSTRAINT "external_users_email_org_idx" UNIQUE("email","org_id")
);
--> statement-breakpoint
CREATE TABLE "fuel_deliveries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"fuel_type_id" varchar NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"cost" numeric(10, 2) NOT NULL,
	"price_per_gallon" numeric(10, 3),
	"supplier" text NOT NULL,
	"delivery_date" timestamp with time zone NOT NULL,
	"invoice_number" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuel_financial_projections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"projected_revenue" numeric(12, 2) NOT NULL,
	"projected_gallons" numeric(10, 2) NOT NULL,
	"projected_costs" numeric(12, 2) NOT NULL,
	"growth_rate" numeric(5, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuel_import_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"integration_id" varchar,
	"source" text NOT NULL,
	"import_type" text NOT NULL,
	"status" text NOT NULL,
	"records_processed" integer DEFAULT 0,
	"records_imported" integer DEFAULT 0,
	"records_skipped" integer DEFAULT 0,
	"records_failed" integer DEFAULT 0,
	"error_log" jsonb DEFAULT '[]',
	"import_data" jsonb DEFAULT '{}',
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuel_integrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"provider" text NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"api_url" text,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"sync_frequency" integer DEFAULT 15,
	"auto_sync_enabled" boolean DEFAULT false,
	"field_mapping" jsonb DEFAULT '{}',
	"settings" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fuel_integrations_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE "fuel_inventory" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"fuel_type_id" varchar NOT NULL,
	"current_level" numeric(10, 2) NOT NULL,
	"capacity" numeric(10, 2) NOT NULL,
	"reorder_point" numeric(10, 2) NOT NULL,
	"reorder_quantity" numeric(10, 2) NOT NULL,
	"tank_name" text,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuel_sales" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"transaction_date" timestamp with time zone DEFAULT now() NOT NULL,
	"fuel_type" "fuel_type" NOT NULL,
	"quantity_gallons" numeric(10, 2) NOT NULL,
	"price_per_gallon" numeric(10, 2) NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"customer_name" text,
	"boat_name" text,
	"slip_number" text,
	"payment_method" "payment_method",
	"processed_by" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuel_types" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"name" text NOT NULL,
	"category" "fuel_category" NOT NULL,
	"current_price" numeric(10, 3) NOT NULL,
	"cost" numeric(10, 3) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ship_store_historical_data" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_source" text NOT NULL,
	"period" text NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer,
	"period_quarter" integer,
	"revenue" numeric(12, 2),
	"cogs" numeric(12, 2),
	"gross_profit" numeric(12, 2),
	"operating_expenses" numeric(12, 2),
	"net_income" numeric(12, 2),
	"transaction_count" integer,
	"average_order_value" numeric(10, 2),
	"category_data" jsonb,
	"import_metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lead_attribution" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"campaign_id" varchar,
	"contact_id" varchar,
	"lead_id" varchar,
	"deal_id" varchar,
	"attribution_type" "attribution_type" NOT NULL,
	"touch_date" timestamp DEFAULT now() NOT NULL,
	"source" text,
	"medium" text,
	"campaign" text,
	"revenue" numeric(12, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marina_customers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"contact_id" varchar,
	"company_id" varchar,
	"customer_number" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"email" text,
	"phone" text,
	"address" jsonb DEFAULT '{}',
	"status" "customer_status" DEFAULT 'active' NOT NULL,
	"account_type" "account_type" DEFAULT 'monthly' NOT NULL,
	"join_date" date NOT NULL,
	"last_activity_date" date,
	"last_invoice_date" date,
	"preferred_contact_method" "contact_method" DEFAULT 'email',
	"primary_boat_id" varchar,
	"marketing_consent" boolean DEFAULT false,
	"notes" text,
	"custom_fields" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "marina_customers_org_customer_number" UNIQUE("org_id","customer_number")
);
--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "marketing_campaign_status" DEFAULT 'planning' NOT NULL,
	"channel" "marketing_channel" NOT NULL,
	"start_date" date,
	"end_date" date,
	"budget_planned" numeric(12, 2),
	"budget_actual" numeric(12, 2) DEFAULT '0',
	"goal_leads" integer,
	"goal_revenue" numeric(12, 2),
	"goal_roas" numeric(5, 2),
	"owner_id" varchar,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_expenses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"campaign_id" varchar,
	"vendor" text NOT NULL,
	"category" "expense_category" NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"date" date NOT NULL,
	"status" "expense_status" DEFAULT 'pending' NOT NULL,
	"invoice_url" text,
	"po_number" text,
	"gl_account" text,
	"approved_by" varchar,
	"approved_at" timestamp,
	"paid_date" date,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modeling_projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"marina_name" text NOT NULL,
	"purchase_price" numeric(15, 2),
	"year_1_cap_rate" numeric(5, 2),
	"total_storage_units" integer,
	"ebitda" numeric(15, 2),
	"deal_outcome" "deal_outcome" DEFAULT 'active' NOT NULL,
	"broker_id" varchar,
	"broker_company_id" varchar,
	"dd_project_id" varchar,
	"sales_comp_id" varchar,
	"rate_comp_id" varchar,
	"property_id" varchar,
	"company_id" varchar,
	"city" text,
	"state" text,
	"region" text,
	"custom_metrics" jsonb DEFAULT '{}',
	"notes" text,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_user_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"permissions" jsonb DEFAULT '{}',
	"is_active" boolean DEFAULT true NOT NULL,
	"assigned_by" varchar,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owned_assets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"property_id" varchar NOT NULL,
	"project_id" varchar,
	"acquisition_date" date NOT NULL,
	"acquisition_price" integer,
	"status" "asset_status" DEFAULT 'under_management' NOT NULL,
	"hold_strategy" "hold_strategy",
	"exit_target_date" date,
	"key_metrics" jsonb DEFAULT '{}',
	"notes" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"source_type" text NOT NULL,
	"source_id" varchar,
	"name" text NOT NULL,
	"website" text,
	"phone" text,
	"address" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"industry" text,
	"status" "pending_property_status" DEFAULT 'pending' NOT NULL,
	"source_metadata" jsonb DEFAULT '{}'::jsonb,
	"suggested_duplicates" jsonb DEFAULT '[]'::jsonb,
	"created_company_id" varchar,
	"created_by" varchar NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"source_type" text NOT NULL,
	"source_id" varchar,
	"first_name" text,
	"last_name" text,
	"full_name" text,
	"email" text,
	"phone" text,
	"company_id" varchar,
	"job_title" text,
	"status" "pending_property_status" DEFAULT 'pending' NOT NULL,
	"source_metadata" jsonb DEFAULT '{}'::jsonb,
	"suggested_duplicates" jsonb DEFAULT '[]'::jsonb,
	"created_contact_id" varchar,
	"created_by" varchar NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persona_feature_flags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"persona_type" "persona_type" NOT NULL,
	"feature_key" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "persona_feature_flags_persona_type_feature_key_unique" UNIQUE("persona_type","feature_key")
);
--> statement-breakpoint
CREATE TABLE "ship_store_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sku" text NOT NULL,
	"category_id" varchar,
	"price" numeric(10, 2) NOT NULL,
	"cost" numeric(10, 2),
	"stock" integer DEFAULT 0,
	"low_stock_threshold" integer DEFAULT 5,
	"barcode" text,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "ship_store_products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "project_pending_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"pending_contact_id" varchar NOT NULL,
	"role" "contact_role" NOT NULL,
	"custom_role" text,
	"project_notes" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_project_pending_contact_role" UNIQUE("project_id","pending_contact_id","role")
);
--> statement-breakpoint
CREATE TABLE "ship_store_projections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" varchar NOT NULL,
	"period" text NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer,
	"period_quarter" integer,
	"projected_revenue" numeric(12, 2),
	"projected_cogs" numeric(12, 2),
	"projected_gross_profit" numeric(12, 2),
	"projected_opex" numeric(12, 2),
	"projected_net_income" numeric(12, 2),
	"gross_margin_percent" numeric(5, 2),
	"operating_margin_percent" numeric(5, 2),
	"net_margin_percent" numeric(5, 2),
	"category_breakdown" jsonb,
	"calculation_metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rent_roll_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"rent_roll_id" varchar NOT NULL,
	"entry_type" "rent_roll_entry_type" NOT NULL,
	"unit_number" text NOT NULL,
	"tenant_name" text,
	"customer_id" varchar,
	"monthly_rate" numeric(10, 2) NOT NULL,
	"status" "slip_status" DEFAULT 'active' NOT NULL,
	"start_date" date,
	"end_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rent_rolls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"context" "rent_roll_context" DEFAULT 'operational' NOT NULL,
	"project_id" varchar,
	"facility_id" text,
	"name" text NOT NULL,
	"effective_date" date NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar NOT NULL,
	"parent_comment_id" varchar,
	"user_id" varchar,
	"external_user_id" varchar,
	"content" text NOT NULL,
	"mentions" text[] DEFAULT '{}',
	"is_answer" boolean DEFAULT false NOT NULL,
	"reactions" jsonb DEFAULT '{}',
	"org_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_documents" (
	"request_id" varchar NOT NULL,
	"document_id" varchar NOT NULL,
	"linked_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "request_documents_request_id_document_id_pk" PRIMARY KEY("request_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "request_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" "request_category" NOT NULL,
	"is_global" boolean DEFAULT false NOT NULL,
	"requests" jsonb DEFAULT '[]' NOT NULL,
	"org_id" varchar,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ship_store_scenarios" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"scenario_type" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_usage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"service_type" "service_type" NOT NULL,
	"service_name" text,
	"transaction_date" timestamp with time zone NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"quantity" numeric(10, 2),
	"reference_id" varchar,
	"reference_table" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_usage_org_reference" UNIQUE("org_id","reference_table","reference_id")
);
--> statement-breakpoint
CREATE TABLE "ship_store_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"action" text NOT NULL,
	"before_data" jsonb,
	"after_data" jsonb,
	"changed_fields" jsonb,
	"ip_address" text,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ship_store_financial_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"total_revenue" numeric(12, 2),
	"total_transactions" integer,
	"average_order_value" numeric(10, 2),
	"gross_margin" numeric(5, 2),
	"operating_costs" numeric(10, 2),
	"net_profit" numeric(10, 2),
	"top_categories" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ship_store_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_name" text DEFAULT 'Ship Store',
	"address" text,
	"phone" text,
	"tax_rate" numeric(5, 4) DEFAULT '8.25',
	"currency" text DEFAULT 'USD',
	"low_stock_threshold" integer DEFAULT 5,
	"auto_sync" boolean DEFAULT true,
	"email_receipts" boolean DEFAULT false,
	"low_stock_alerts" boolean DEFAULT true,
	"stripe_publishable_key" text,
	"stripe_secret_key" text,
	"square_application_id" text,
	"quickbooks_connected" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ship_store_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"tax" numeric(10, 2) NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"payment_intent_id" text,
	"status" text DEFAULT 'completed',
	"customer_id" varchar,
	"customer_type" text,
	"customer_name" text,
	"items" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "slip_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"slip_number" text NOT NULL,
	"slip_type" "slip_type" DEFAULT 'wet' NOT NULL,
	"status" "slip_status" DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"monthly_rate" numeric(10, 2),
	"renewal_date" date,
	"auto_renew" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_dashboard_layouts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"persona_template" "persona_type",
	"layout" jsonb DEFAULT '[]',
	"is_default" boolean DEFAULT false NOT NULL,
	"last_modified" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_dashboard_layouts_user_id_org_id_persona_template_unique" UNIQUE("user_id","org_id","persona_template")
);
--> statement-breakpoint
CREATE TABLE "user_persona_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"primary_persona" "persona_type" NOT NULL,
	"secondary_persona" "persona_type",
	"feature_overrides" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_persona_assignments_user_id_org_id_unique" UNIQUE("user_id","org_id")
);
--> statement-breakpoint
CREATE TABLE "vdr_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar,
	"folder_id" varchar,
	"user_id" varchar,
	"external_user_id" varchar,
	"event_type" "audit_event_type" NOT NULL,
	"duration" integer,
	"ip_address" text,
	"user_agent" text,
	"device_info" jsonb DEFAULT '{}',
	"metadata" jsonb DEFAULT '{}',
	"org_id" varchar NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vdr_data_request_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"template_id" varchar,
	"category" text NOT NULL,
	"document_name" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"status" "data_request_item_status" DEFAULT 'outstanding' NOT NULL,
	"priority" "data_request_priority" DEFAULT 'medium' NOT NULL,
	"assignee_id" varchar,
	"external_assignee_id" varchar,
	"linked_document_id" varchar,
	"is_in_data_room" boolean DEFAULT false NOT NULL,
	"notes" text,
	"due_date" date,
	"received_date" date,
	"org_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vdr_data_request_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'real_estate' NOT NULL,
	"is_global" boolean DEFAULT false NOT NULL,
	"org_id" varchar,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vdr_diligence_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vdr_diligence_categories_slug_org_idx" UNIQUE("slug","org_id")
);
--> statement-breakpoint
CREATE TABLE "vdr_document_permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar,
	"folder_id" varchar,
	"project_id" varchar,
	"user_id" varchar,
	"external_user_id" varchar,
	"role_enum" "role",
	"permission_level" "vdr_permission_level" NOT NULL,
	"expires_at" timestamp,
	"ip_whitelist" text[] DEFAULT '{}',
	"device_restrictions" jsonb DEFAULT '{}',
	"org_id" varchar NOT NULL,
	"granted_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vdr_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folder_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"filename" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"checksum" text NOT NULL,
	"storage_path" text NOT NULL,
	"thumbnail_path" text,
	"version" integer DEFAULT 1 NOT NULL,
	"is_current_version" boolean DEFAULT true NOT NULL,
	"parent_document_id" varchar,
	"extracted_text" text,
	"ai_category" text,
	"ai_tags" text[] DEFAULT '{}',
	"ai_summary" text,
	"ai_risk_flags" jsonb DEFAULT '[]',
	"description" text,
	"tags" text[] DEFAULT '{}',
	"org_id" varchar NOT NULL,
	"uploaded_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "vdr_due_date_presets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"days" integer NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vdr_due_date_presets_slug_org_idx" UNIQUE("slug","org_id")
);
--> statement-breakpoint
CREATE TABLE "vdr_folders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"parent_folder_id" varchar,
	"name" text NOT NULL,
	"path" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"description" text,
	"org_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "vdr_template_folders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"name" text NOT NULL,
	"parent_folder_id" varchar,
	"display_order" integer DEFAULT 0 NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vdr_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'real_estate' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"org_id" varchar,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vdr_watermarks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar,
	"folder_id" varchar,
	"project_id" varchar,
	"watermark_type" "watermark_type" NOT NULL,
	"static_text" text,
	"is_dynamic" boolean DEFAULT true NOT NULL,
	"opacity" integer DEFAULT 30 NOT NULL,
	"position" text DEFAULT 'diagonal' NOT NULL,
	"include_qr_code" boolean DEFAULT false NOT NULL,
	"org_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "docktalk_article_duplicates" (
	"id" serial PRIMARY KEY NOT NULL,
	"canonical_article_id" integer NOT NULL,
	"duplicate_title" text NOT NULL,
	"duplicate_url" text NOT NULL,
	"duplicate_source" text NOT NULL,
	"duplicate_published_at" timestamp,
	"duplicate_content" text,
	"similarity_score" integer NOT NULL,
	"suppression_reason" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "docktalk_article_entities" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"entity_id" integer NOT NULL,
	"mention_count" integer DEFAULT 1,
	"confidence" integer DEFAULT 100,
	"context" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "docktalk_article_fingerprints" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"normalized_title" text NOT NULL,
	"fingerprint_hash" text NOT NULL,
	"title_trigrams" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "docktalk_article_fingerprints_article_id_unique" UNIQUE("article_id")
);
--> statement-breakpoint
CREATE TABLE "docktalk_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"source" text NOT NULL,
	"published_at" timestamp,
	"category" text,
	"categories" text[],
	"tags" text[],
	"summary" text,
	"content" text,
	"image_url" text,
	"relevance_score" integer DEFAULT 0,
	"sentiment" text,
	"deal_metadata" jsonb,
	"geography" text[],
	"region" "docktalk_region" DEFAULT 'US/Domestic',
	"search_text" text DEFAULT '' NOT NULL,
	"is_bookmarked" boolean DEFAULT false,
	"manually_reviewed" boolean DEFAULT false,
	"original_category" text,
	"is_removed" boolean DEFAULT false,
	"removal_reason" text,
	"removed_at" timestamp,
	"removed_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "docktalk_articles_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "docktalk_category_summaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"period" "docktalk_summary_period" NOT NULL,
	"summary_text" text NOT NULL,
	"key_trends" text[],
	"article_count" integer DEFAULT 0 NOT NULL,
	"avg_relevance" integer,
	"top_sources" text[],
	"comparison_text" text,
	"previous_period_count" integer,
	"growth_percentage" integer,
	"generated_at" timestamp DEFAULT now(),
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"is_edited" boolean DEFAULT false,
	"edited_by" varchar,
	"edited_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "docktalk_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"source" "docktalk_notification_source" DEFAULT 'saved_search' NOT NULL,
	"saved_search_id" varchar,
	"categories" text[],
	"article_snapshot" jsonb,
	"article_ids" text[],
	"article_count" integer DEFAULT 0 NOT NULL,
	"frequency" text NOT NULL,
	"message" text NOT NULL,
	"delivery_method" text DEFAULT 'console' NOT NULL,
	"delivery_status" text DEFAULT 'sent' NOT NULL,
	"error_message" text,
	"sent_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_features" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"feature" text DEFAULT 'docktalk' NOT NULL,
	"tier" "docktalk_feature_tier" DEFAULT 'docktalk_free' NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"billing_metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_features_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE "docktalk_rss_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"source_type" "docktalk_source_type" DEFAULT 'rss' NOT NULL,
	"is_active" boolean DEFAULT true,
	"min_relevance_score" integer DEFAULT 50,
	"custom_keywords" text[],
	"last_fetched" timestamp,
	"last_scraped_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "docktalk_rss_sources_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "docktalk_saved_filters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"name" text NOT NULL,
	"criteria" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "docktalk_summary_edits" (
	"id" serial PRIMARY KEY NOT NULL,
	"summary_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"original_text" text NOT NULL,
	"edited_text" text NOT NULL,
	"edit_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "docktalk_system_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"total_articles" integer DEFAULT 0,
	"today_articles" integer DEFAULT 0,
	"avg_relevance" integer DEFAULT 0,
	"last_update" timestamp DEFAULT now(),
	"rss_feed_status" text DEFAULT 'online',
	"scraper_status" text DEFAULT 'active',
	"ai_status" text DEFAULT 'processing',
	"db_status" text DEFAULT 'healthy'
);
--> statement-breakpoint
CREATE TABLE "docktalk_user_article_annotations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"article_id" integer NOT NULL,
	"custom_tags" text[],
	"private_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "docktalk_user_filter_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"categories" text[],
	"sources" text[],
	"regions" text[],
	"from_date" text,
	"min_relevance" integer,
	"sort_by" text DEFAULT 'newest',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "docktalk_user_filter_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "docktalk_user_notification_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"email_address" text NOT NULL,
	"categories" text[] NOT NULL,
	"frequency" "docktalk_alert_frequency" DEFAULT 'none' NOT NULL,
	"delivery_time" text DEFAULT '09:00',
	"timezone" text DEFAULT 'America/New_York',
	"enabled" boolean DEFAULT true,
	"last_sent_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "docktalk_user_notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "crm_leads" ALTER COLUMN "lead_status" SET DATA TYPE lead_status;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD COLUMN "phones" jsonb DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD COLUMN "contact_tag" "contact_tag" DEFAULT 'lead';--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD COLUMN "lead_status" "lead_status";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "status" "project_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_comps" ADD COLUMN "rate_type" text;--> statement-breakpoint
ALTER TABLE "rate_comps" ADD COLUMN "seasonality" text;--> statement-breakpoint
ALTER TABLE "rate_comps" ADD COLUMN "boat_length_min" integer;--> statement-breakpoint
ALTER TABLE "rate_comps" ADD COLUMN "boat_length_max" integer;--> statement-breakpoint
ALTER TABLE "rate_comps" ADD COLUMN "lat" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "rate_comps" ADD COLUMN "lng" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "sales_comps" ADD COLUMN "brokerage" text;--> statement-breakpoint
ALTER TABLE "sales_comps" ADD COLUMN "agent_first_name" text;--> statement-breakpoint
ALTER TABLE "sales_comps" ADD COLUMN "agent_last_name" text;--> statement-breakpoint
ALTER TABLE "sales_comps" ADD COLUMN "agent_contact_id" varchar;--> statement-breakpoint
ALTER TABLE "sales_comps" ADD COLUMN "lat" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "sales_comps" ADD COLUMN "lng" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "sales_comps" ADD COLUMN "owner_company_id" varchar;--> statement-breakpoint
ALTER TABLE "sales_comps" ADD COLUMN "ownership_role" varchar(20);--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "company_id" varchar;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "contact_id" varchar;--> statement-breakpoint
ALTER TABLE "asset_performance_snapshots" ADD CONSTRAINT "asset_performance_snapshots_owned_asset_id_owned_assets_id_fk" FOREIGN KEY ("owned_asset_id") REFERENCES "public"."owned_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ship_store_assumptions" ADD CONSTRAINT "ship_store_assumptions_scenario_id_ship_store_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."ship_store_scenarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boat_registry" ADD CONSTRAINT "boat_registry_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boat_registry" ADD CONSTRAINT "boat_registry_customer_id_marina_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."marina_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_prospecting_goal_templates" ADD CONSTRAINT "crm_prospecting_goal_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_prospecting_goal_templates" ADD CONSTRAINT "crm_prospecting_goal_templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_prospecting_user_settings" ADD CONSTRAINT "crm_prospecting_user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_prospecting_user_settings" ADD CONSTRAINT "crm_prospecting_user_settings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_scenarios" ADD CONSTRAINT "debt_scenarios_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_scenarios" ADD CONSTRAINT "debt_scenarios_deal_id_crm_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."crm_deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_scenarios" ADD CONSTRAINT "debt_scenarios_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_scenarios" ADD CONSTRAINT "debt_scenarios_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_scenarios" ADD CONSTRAINT "debt_scenarios_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_requests" ADD CONSTRAINT "diligence_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_requests" ADD CONSTRAINT "diligence_requests_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_requests" ADD CONSTRAINT "diligence_requests_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_requests" ADD CONSTRAINT "diligence_requests_requestor_id_users_id_fk" FOREIGN KEY ("requestor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_requests" ADD CONSTRAINT "diligence_requests_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_requests" ADD CONSTRAINT "diligence_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_article_removal_patterns" ADD CONSTRAINT "docktalk_article_removal_patterns_article_id_docktalk_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."docktalk_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_article_removal_patterns" ADD CONSTRAINT "docktalk_article_removal_patterns_removed_by_docktalk_users_id_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."docktalk_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_deals" ADD CONSTRAINT "docktalk_deals_article_id_docktalk_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."docktalk_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_deals" ADD CONSTRAINT "docktalk_deals_buyer_entity_id_docktalk_entities_id_fk" FOREIGN KEY ("buyer_entity_id") REFERENCES "public"."docktalk_entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_deals" ADD CONSTRAINT "docktalk_deals_seller_entity_id_docktalk_entities_id_fk" FOREIGN KEY ("seller_entity_id") REFERENCES "public"."docktalk_entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_notification_preferences" ADD CONSTRAINT "docktalk_notification_preferences_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_notification_preferences" ADD CONSTRAINT "docktalk_notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_portfolio_companies" ADD CONSTRAINT "docktalk_portfolio_companies_user_id_docktalk_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."docktalk_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_saved_searches" ADD CONSTRAINT "docktalk_saved_searches_user_id_docktalk_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."docktalk_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_user_preferences" ADD CONSTRAINT "docktalk_user_preferences_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_user_preferences" ADD CONSTRAINT "docktalk_user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_watchlist_entities" ADD CONSTRAINT "docktalk_watchlist_entities_watchlist_id_docktalk_watchlists_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."docktalk_watchlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_watchlist_entities" ADD CONSTRAINT "docktalk_watchlist_entities_entity_id_docktalk_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."docktalk_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_watchlists" ADD CONSTRAINT "docktalk_watchlists_user_id_docktalk_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."docktalk_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_user_project_access" ADD CONSTRAINT "external_user_project_access_external_user_id_external_users_id_fk" FOREIGN KEY ("external_user_id") REFERENCES "public"."external_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_user_project_access" ADD CONSTRAINT "external_user_project_access_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_user_project_access" ADD CONSTRAINT "external_user_project_access_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_user_project_access" ADD CONSTRAINT "external_user_project_access_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_users" ADD CONSTRAINT "external_users_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_users" ADD CONSTRAINT "external_users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_deliveries" ADD CONSTRAINT "fuel_deliveries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_deliveries" ADD CONSTRAINT "fuel_deliveries_fuel_type_id_fuel_types_id_fk" FOREIGN KEY ("fuel_type_id") REFERENCES "public"."fuel_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_financial_projections" ADD CONSTRAINT "fuel_financial_projections_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_import_logs" ADD CONSTRAINT "fuel_import_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_import_logs" ADD CONSTRAINT "fuel_import_logs_integration_id_fuel_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."fuel_integrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_import_logs" ADD CONSTRAINT "fuel_import_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_integrations" ADD CONSTRAINT "fuel_integrations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_inventory" ADD CONSTRAINT "fuel_inventory_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_inventory" ADD CONSTRAINT "fuel_inventory_fuel_type_id_fuel_types_id_fk" FOREIGN KEY ("fuel_type_id") REFERENCES "public"."fuel_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_sales" ADD CONSTRAINT "fuel_sales_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_sales" ADD CONSTRAINT "fuel_sales_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_types" ADD CONSTRAINT "fuel_types_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_attribution" ADD CONSTRAINT "lead_attribution_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_attribution" ADD CONSTRAINT "lead_attribution_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_attribution" ADD CONSTRAINT "lead_attribution_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_attribution" ADD CONSTRAINT "lead_attribution_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_attribution" ADD CONSTRAINT "lead_attribution_deal_id_crm_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."crm_deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marina_customers" ADD CONSTRAINT "marina_customers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marina_customers" ADD CONSTRAINT "marina_customers_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marina_customers" ADD CONSTRAINT "marina_customers_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."crm_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marina_customers" ADD CONSTRAINT "marina_customers_primary_boat_id_boat_registry_id_fk" FOREIGN KEY ("primary_boat_id") REFERENCES "public"."boat_registry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_expenses" ADD CONSTRAINT "marketing_expenses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_expenses" ADD CONSTRAINT "marketing_expenses_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_expenses" ADD CONSTRAINT "marketing_expenses_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_expenses" ADD CONSTRAINT "marketing_expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modeling_projects" ADD CONSTRAINT "modeling_projects_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modeling_projects" ADD CONSTRAINT "modeling_projects_broker_id_crm_contacts_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modeling_projects" ADD CONSTRAINT "modeling_projects_broker_company_id_crm_companies_id_fk" FOREIGN KEY ("broker_company_id") REFERENCES "public"."crm_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modeling_projects" ADD CONSTRAINT "modeling_projects_dd_project_id_projects_id_fk" FOREIGN KEY ("dd_project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modeling_projects" ADD CONSTRAINT "modeling_projects_sales_comp_id_sales_comps_id_fk" FOREIGN KEY ("sales_comp_id") REFERENCES "public"."sales_comps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modeling_projects" ADD CONSTRAINT "modeling_projects_rate_comp_id_rate_comps_id_fk" FOREIGN KEY ("rate_comp_id") REFERENCES "public"."rate_comps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modeling_projects" ADD CONSTRAINT "modeling_projects_property_id_crm_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."crm_properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modeling_projects" ADD CONSTRAINT "modeling_projects_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."crm_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modeling_projects" ADD CONSTRAINT "modeling_projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modeling_projects" ADD CONSTRAINT "modeling_projects_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_user_roles" ADD CONSTRAINT "organization_user_roles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_user_roles" ADD CONSTRAINT "organization_user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_user_roles" ADD CONSTRAINT "organization_user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owned_assets" ADD CONSTRAINT "owned_assets_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owned_assets" ADD CONSTRAINT "owned_assets_property_id_crm_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."crm_properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owned_assets" ADD CONSTRAINT "owned_assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owned_assets" ADD CONSTRAINT "owned_assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_companies" ADD CONSTRAINT "pending_companies_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_companies" ADD CONSTRAINT "pending_companies_created_company_id_crm_companies_id_fk" FOREIGN KEY ("created_company_id") REFERENCES "public"."crm_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_companies" ADD CONSTRAINT "pending_companies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_companies" ADD CONSTRAINT "pending_companies_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_contacts" ADD CONSTRAINT "pending_contacts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_contacts" ADD CONSTRAINT "pending_contacts_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."crm_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_contacts" ADD CONSTRAINT "pending_contacts_created_contact_id_crm_contacts_id_fk" FOREIGN KEY ("created_contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_contacts" ADD CONSTRAINT "pending_contacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_contacts" ADD CONSTRAINT "pending_contacts_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ship_store_products" ADD CONSTRAINT "ship_store_products_category_id_ship_store_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ship_store_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_pending_contacts" ADD CONSTRAINT "project_pending_contacts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_pending_contacts" ADD CONSTRAINT "project_pending_contacts_pending_contact_id_pending_contacts_id_fk" FOREIGN KEY ("pending_contact_id") REFERENCES "public"."pending_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_pending_contacts" ADD CONSTRAINT "project_pending_contacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ship_store_projections" ADD CONSTRAINT "ship_store_projections_scenario_id_ship_store_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."ship_store_scenarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_roll_entries" ADD CONSTRAINT "rent_roll_entries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_roll_entries" ADD CONSTRAINT "rent_roll_entries_rent_roll_id_rent_rolls_id_fk" FOREIGN KEY ("rent_roll_id") REFERENCES "public"."rent_rolls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_roll_entries" ADD CONSTRAINT "rent_roll_entries_customer_id_marina_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."marina_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_rolls" ADD CONSTRAINT "rent_rolls_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_rolls" ADD CONSTRAINT "rent_rolls_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_comments" ADD CONSTRAINT "request_comments_request_id_diligence_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."diligence_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_comments" ADD CONSTRAINT "request_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_comments" ADD CONSTRAINT "request_comments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_documents" ADD CONSTRAINT "request_documents_request_id_diligence_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."diligence_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_documents" ADD CONSTRAINT "request_documents_document_id_vdr_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."vdr_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_documents" ADD CONSTRAINT "request_documents_linked_by_users_id_fk" FOREIGN KEY ("linked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_templates" ADD CONSTRAINT "request_templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_templates" ADD CONSTRAINT "request_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_usage" ADD CONSTRAINT "service_usage_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_usage" ADD CONSTRAINT "service_usage_customer_id_marina_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."marina_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slip_assignments" ADD CONSTRAINT "slip_assignments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slip_assignments" ADD CONSTRAINT "slip_assignments_customer_id_marina_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."marina_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_dashboard_layouts" ADD CONSTRAINT "user_dashboard_layouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_dashboard_layouts" ADD CONSTRAINT "user_dashboard_layouts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_persona_assignments" ADD CONSTRAINT "user_persona_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_persona_assignments" ADD CONSTRAINT "user_persona_assignments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_audit_logs" ADD CONSTRAINT "vdr_audit_logs_document_id_vdr_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."vdr_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_audit_logs" ADD CONSTRAINT "vdr_audit_logs_folder_id_vdr_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."vdr_folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_audit_logs" ADD CONSTRAINT "vdr_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_audit_logs" ADD CONSTRAINT "vdr_audit_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_data_request_items" ADD CONSTRAINT "vdr_data_request_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_data_request_items" ADD CONSTRAINT "vdr_data_request_items_template_id_vdr_data_request_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."vdr_data_request_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_data_request_items" ADD CONSTRAINT "vdr_data_request_items_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_data_request_items" ADD CONSTRAINT "vdr_data_request_items_external_assignee_id_external_users_id_fk" FOREIGN KEY ("external_assignee_id") REFERENCES "public"."external_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_data_request_items" ADD CONSTRAINT "vdr_data_request_items_linked_document_id_vdr_documents_id_fk" FOREIGN KEY ("linked_document_id") REFERENCES "public"."vdr_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_data_request_items" ADD CONSTRAINT "vdr_data_request_items_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_data_request_items" ADD CONSTRAINT "vdr_data_request_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_data_request_templates" ADD CONSTRAINT "vdr_data_request_templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_data_request_templates" ADD CONSTRAINT "vdr_data_request_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_diligence_categories" ADD CONSTRAINT "vdr_diligence_categories_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_diligence_categories" ADD CONSTRAINT "vdr_diligence_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_document_permissions" ADD CONSTRAINT "vdr_document_permissions_document_id_vdr_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."vdr_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_document_permissions" ADD CONSTRAINT "vdr_document_permissions_folder_id_vdr_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."vdr_folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_document_permissions" ADD CONSTRAINT "vdr_document_permissions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_document_permissions" ADD CONSTRAINT "vdr_document_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_document_permissions" ADD CONSTRAINT "vdr_document_permissions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_document_permissions" ADD CONSTRAINT "vdr_document_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_documents" ADD CONSTRAINT "vdr_documents_folder_id_vdr_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."vdr_folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_documents" ADD CONSTRAINT "vdr_documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_documents" ADD CONSTRAINT "vdr_documents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_documents" ADD CONSTRAINT "vdr_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_due_date_presets" ADD CONSTRAINT "vdr_due_date_presets_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_due_date_presets" ADD CONSTRAINT "vdr_due_date_presets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_folders" ADD CONSTRAINT "vdr_folders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_folders" ADD CONSTRAINT "vdr_folders_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_folders" ADD CONSTRAINT "vdr_folders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_template_folders" ADD CONSTRAINT "vdr_template_folders_template_id_vdr_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."vdr_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_templates" ADD CONSTRAINT "vdr_templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_templates" ADD CONSTRAINT "vdr_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_watermarks" ADD CONSTRAINT "vdr_watermarks_document_id_vdr_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."vdr_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_watermarks" ADD CONSTRAINT "vdr_watermarks_folder_id_vdr_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."vdr_folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_watermarks" ADD CONSTRAINT "vdr_watermarks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_watermarks" ADD CONSTRAINT "vdr_watermarks_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vdr_watermarks" ADD CONSTRAINT "vdr_watermarks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_article_duplicates" ADD CONSTRAINT "docktalk_article_duplicates_canonical_article_id_docktalk_articles_id_fk" FOREIGN KEY ("canonical_article_id") REFERENCES "public"."docktalk_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_article_entities" ADD CONSTRAINT "docktalk_article_entities_article_id_docktalk_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."docktalk_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_article_entities" ADD CONSTRAINT "docktalk_article_entities_entity_id_docktalk_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."docktalk_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_article_fingerprints" ADD CONSTRAINT "docktalk_article_fingerprints_article_id_docktalk_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."docktalk_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_articles" ADD CONSTRAINT "docktalk_articles_removed_by_docktalk_users_id_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."docktalk_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_category_summaries" ADD CONSTRAINT "docktalk_category_summaries_edited_by_docktalk_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."docktalk_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_notifications" ADD CONSTRAINT "docktalk_notifications_user_id_docktalk_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."docktalk_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_notifications" ADD CONSTRAINT "docktalk_notifications_saved_search_id_docktalk_saved_searches_id_fk" FOREIGN KEY ("saved_search_id") REFERENCES "public"."docktalk_saved_searches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_saved_filters" ADD CONSTRAINT "docktalk_saved_filters_user_id_docktalk_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."docktalk_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_summary_edits" ADD CONSTRAINT "docktalk_summary_edits_summary_id_docktalk_category_summaries_id_fk" FOREIGN KEY ("summary_id") REFERENCES "public"."docktalk_category_summaries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_summary_edits" ADD CONSTRAINT "docktalk_summary_edits_user_id_docktalk_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."docktalk_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_user_article_annotations" ADD CONSTRAINT "docktalk_user_article_annotations_user_id_docktalk_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."docktalk_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_user_article_annotations" ADD CONSTRAINT "docktalk_user_article_annotations_article_id_docktalk_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."docktalk_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_user_filter_preferences" ADD CONSTRAINT "docktalk_user_filter_preferences_user_id_docktalk_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."docktalk_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docktalk_user_notification_preferences" ADD CONSTRAINT "docktalk_user_notification_preferences_user_id_docktalk_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."docktalk_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_snapshots_asset_date_idx" ON "asset_performance_snapshots" USING btree ("owned_asset_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "boat_registry_org_idx" ON "boat_registry" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "boat_registry_customer_idx" ON "boat_registry" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "boat_registry_active_idx" ON "boat_registry" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "boat_registry_registration_idx" ON "boat_registry" USING btree ("registration");--> statement-breakpoint
CREATE INDEX "debt_scenarios_org_idx" ON "debt_scenarios" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "debt_scenarios_deal_idx" ON "debt_scenarios" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "debt_scenarios_project_idx" ON "debt_scenarios" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "debt_scenarios_created_by_idx" ON "debt_scenarios" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "diligence_requests_project_idx" ON "diligence_requests" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "diligence_requests_assignee_idx" ON "diligence_requests" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "diligence_requests_status_idx" ON "diligence_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "diligence_requests_org_idx" ON "diligence_requests" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_removal_patterns_article" ON "docktalk_article_removal_patterns" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_removal_patterns_user" ON "docktalk_article_removal_patterns" USING btree ("removed_by");--> statement-breakpoint
CREATE INDEX "idx_docktalk_removal_patterns_date" ON "docktalk_article_removal_patterns" USING btree ("removed_at");--> statement-breakpoint
CREATE INDEX "idx_docktalk_deals_article" ON "docktalk_deals" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_deals_type" ON "docktalk_deals" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "idx_docktalk_deals_status" ON "docktalk_deals" USING btree ("deal_status");--> statement-breakpoint
CREATE INDEX "idx_docktalk_deals_buyer_entity" ON "docktalk_deals" USING btree ("buyer_entity_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_deals_seller_entity" ON "docktalk_deals" USING btree ("seller_entity_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_deals_closing_date" ON "docktalk_deals" USING btree ("closing_date");--> statement-breakpoint
CREATE INDEX "idx_docktalk_deals_announced_date" ON "docktalk_deals" USING btree ("announced_date");--> statement-breakpoint
CREATE INDEX "idx_docktalk_entities_name" ON "docktalk_entities" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_docktalk_entities_normalized" ON "docktalk_entities" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "idx_docktalk_entities_type" ON "docktalk_entities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "docktalk_notification_preferences_org_idx" ON "docktalk_notification_preferences" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "docktalk_notification_preferences_user_idx" ON "docktalk_notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "docktalk_notification_preferences_frequency_idx" ON "docktalk_notification_preferences" USING btree ("frequency");--> statement-breakpoint
CREATE INDEX "idx_docktalk_portfolio_user" ON "docktalk_portfolio_companies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_portfolio_company" ON "docktalk_portfolio_companies" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "idx_docktalk_portfolio_org" ON "docktalk_portfolio_companies" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_saved_searches_user" ON "docktalk_saved_searches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_saved_searches_org" ON "docktalk_saved_searches" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "docktalk_user_preferences_org_idx" ON "docktalk_user_preferences" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "docktalk_user_preferences_user_idx" ON "docktalk_user_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_watchlist_entities_watchlist" ON "docktalk_watchlist_entities" USING btree ("watchlist_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_watchlist_entities_entity" ON "docktalk_watchlist_entities" USING btree ("entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_docktalk_watchlist_entities_unique" ON "docktalk_watchlist_entities" USING btree ("watchlist_id","entity_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_watchlists_user" ON "docktalk_watchlists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_watchlists_org" ON "docktalk_watchlists" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "email_campaigns_org_idx" ON "email_campaigns" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "email_campaigns_campaign_idx" ON "email_campaigns" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "email_campaigns_platform_idx" ON "email_campaigns" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "email_campaigns_external_idx" ON "email_campaigns" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "external_project_access_user_idx" ON "external_user_project_access" USING btree ("external_user_id");--> statement-breakpoint
CREATE INDEX "external_project_access_project_idx" ON "external_user_project_access" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "external_users_token_idx" ON "external_users" USING btree ("invitation_token");--> statement-breakpoint
CREATE INDEX "external_users_org_idx" ON "external_users" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "fuel_deliveries_org_idx" ON "fuel_deliveries" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "fuel_deliveries_fuel_type_idx" ON "fuel_deliveries" USING btree ("fuel_type_id");--> statement-breakpoint
CREATE INDEX "fuel_deliveries_date_idx" ON "fuel_deliveries" USING btree ("delivery_date");--> statement-breakpoint
CREATE INDEX "fuel_projections_org_idx" ON "fuel_financial_projections" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "fuel_projections_period_idx" ON "fuel_financial_projections" USING btree ("year","month");--> statement-breakpoint
CREATE INDEX "fuel_import_logs_org_idx" ON "fuel_import_logs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "fuel_import_logs_integration_idx" ON "fuel_import_logs" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX "fuel_import_logs_status_idx" ON "fuel_import_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fuel_import_logs_date_idx" ON "fuel_import_logs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "fuel_integrations_org_idx" ON "fuel_integrations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "fuel_integrations_provider_idx" ON "fuel_integrations" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "fuel_inventory_org_idx" ON "fuel_inventory" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "fuel_inventory_fuel_type_idx" ON "fuel_inventory" USING btree ("fuel_type_id");--> statement-breakpoint
CREATE INDEX "fuel_sales_org_idx" ON "fuel_sales" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "fuel_sales_date_idx" ON "fuel_sales" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "fuel_sales_fuel_type_idx" ON "fuel_sales" USING btree ("fuel_type");--> statement-breakpoint
CREATE INDEX "fuel_sales_processed_by_idx" ON "fuel_sales" USING btree ("processed_by");--> statement-breakpoint
CREATE INDEX "fuel_types_org_idx" ON "fuel_types" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "fuel_types_category_idx" ON "fuel_types" USING btree ("category");--> statement-breakpoint
CREATE INDEX "fuel_types_active_idx" ON "fuel_types" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "lead_attribution_org_idx" ON "lead_attribution" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "lead_attribution_campaign_idx" ON "lead_attribution" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "lead_attribution_contact_idx" ON "lead_attribution" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "lead_attribution_lead_idx" ON "lead_attribution" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_attribution_deal_idx" ON "lead_attribution" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "lead_attribution_type_idx" ON "lead_attribution" USING btree ("attribution_type");--> statement-breakpoint
CREATE INDEX "marina_customers_org_idx" ON "marina_customers" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "marina_customers_status_idx" ON "marina_customers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "marina_customers_join_date_idx" ON "marina_customers" USING btree ("join_date");--> statement-breakpoint
CREATE INDEX "marina_customers_last_activity_idx" ON "marina_customers" USING btree ("last_activity_date");--> statement-breakpoint
CREATE INDEX "marina_customers_email_idx" ON "marina_customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "marketing_campaigns_org_idx" ON "marketing_campaigns" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "marketing_campaigns_status_idx" ON "marketing_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "marketing_campaigns_channel_idx" ON "marketing_campaigns" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "marketing_campaigns_owner_idx" ON "marketing_campaigns" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "marketing_campaigns_date_idx" ON "marketing_campaigns" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "marketing_expenses_org_idx" ON "marketing_expenses" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "marketing_expenses_campaign_idx" ON "marketing_expenses" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "marketing_expenses_status_idx" ON "marketing_expenses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "marketing_expenses_category_idx" ON "marketing_expenses" USING btree ("category");--> statement-breakpoint
CREATE INDEX "marketing_expenses_date_idx" ON "marketing_expenses" USING btree ("date");--> statement-breakpoint
CREATE INDEX "modeling_projects_org_idx" ON "modeling_projects" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "modeling_projects_outcome_idx" ON "modeling_projects" USING btree ("deal_outcome");--> statement-breakpoint
CREATE INDEX "modeling_projects_broker_idx" ON "modeling_projects" USING btree ("broker_id");--> statement-breakpoint
CREATE INDEX "modeling_projects_dd_project_idx" ON "modeling_projects" USING btree ("dd_project_id");--> statement-breakpoint
CREATE INDEX "modeling_projects_property_idx" ON "modeling_projects" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "modeling_projects_state_idx" ON "modeling_projects" USING btree ("state");--> statement-breakpoint
CREATE INDEX "modeling_projects_region_idx" ON "modeling_projects" USING btree ("region");--> statement-breakpoint
CREATE INDEX "org_user_roles_org_idx" ON "organization_user_roles" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "org_user_roles_user_idx" ON "organization_user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "org_user_roles_role_idx" ON "organization_user_roles" USING btree ("role");--> statement-breakpoint
CREATE INDEX "org_user_roles_active_idx" ON "organization_user_roles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "org_user_roles_unique" ON "organization_user_roles" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "owned_assets_org_status_idx" ON "owned_assets" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "owned_assets_org_property_idx" ON "owned_assets" USING btree ("org_id","property_id");--> statement-breakpoint
CREATE INDEX "project_pending_contacts_project" ON "project_pending_contacts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_pending_contacts_pending_contact" ON "project_pending_contacts" USING btree ("pending_contact_id");--> statement-breakpoint
CREATE INDEX "rent_roll_entries_org_idx" ON "rent_roll_entries" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rent_roll_entries_rent_roll_idx" ON "rent_roll_entries" USING btree ("rent_roll_id");--> statement-breakpoint
CREATE INDEX "rent_roll_entries_customer_idx" ON "rent_roll_entries" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "rent_roll_entries_status_idx" ON "rent_roll_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rent_roll_entries_entry_type_idx" ON "rent_roll_entries" USING btree ("entry_type");--> statement-breakpoint
CREATE INDEX "rent_rolls_org_idx" ON "rent_rolls" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rent_rolls_context_idx" ON "rent_rolls" USING btree ("context");--> statement-breakpoint
CREATE INDEX "rent_rolls_project_idx" ON "rent_rolls" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "rent_rolls_effective_date_idx" ON "rent_rolls" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "request_comments_request_idx" ON "request_comments" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "request_comments_parent_idx" ON "request_comments" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE INDEX "request_documents_request_idx" ON "request_documents" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "request_documents_document_idx" ON "request_documents" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "request_templates_category_idx" ON "request_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "request_templates_org_idx" ON "request_templates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "service_usage_org_idx" ON "service_usage" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "service_usage_customer_idx" ON "service_usage" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "service_usage_service_type_idx" ON "service_usage" USING btree ("service_type");--> statement-breakpoint
CREATE INDEX "service_usage_transaction_date_idx" ON "service_usage" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "service_usage_reference_idx" ON "service_usage" USING btree ("reference_table","reference_id");--> statement-breakpoint
CREATE INDEX "slip_assignments_org_idx" ON "slip_assignments" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "slip_assignments_customer_idx" ON "slip_assignments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "slip_assignments_slip_number_idx" ON "slip_assignments" USING btree ("slip_number");--> statement-breakpoint
CREATE INDEX "slip_assignments_status_idx" ON "slip_assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "slip_assignments_renewal_date_idx" ON "slip_assignments" USING btree ("renewal_date");--> statement-breakpoint
CREATE INDEX "user_dashboard_user_org_idx" ON "user_dashboard_layouts" USING btree ("user_id","org_id");--> statement-breakpoint
CREATE INDEX "user_persona_user_org_idx" ON "user_persona_assignments" USING btree ("user_id","org_id");--> statement-breakpoint
CREATE INDEX "vdr_audit_logs_document_idx" ON "vdr_audit_logs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "vdr_audit_logs_user_idx" ON "vdr_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vdr_audit_logs_external_user_idx" ON "vdr_audit_logs" USING btree ("external_user_id");--> statement-breakpoint
CREATE INDEX "vdr_audit_logs_timestamp_idx" ON "vdr_audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "vdr_audit_logs_org_idx" ON "vdr_audit_logs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "vdr_data_request_items_project_idx" ON "vdr_data_request_items" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "vdr_data_request_items_status_idx" ON "vdr_data_request_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vdr_data_request_items_category_idx" ON "vdr_data_request_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "vdr_data_request_items_assignee_idx" ON "vdr_data_request_items" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "vdr_data_request_items_priority_idx" ON "vdr_data_request_items" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "vdr_data_request_items_org_idx" ON "vdr_data_request_items" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "vdr_data_request_templates_category_idx" ON "vdr_data_request_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "vdr_data_request_templates_org_idx" ON "vdr_data_request_templates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "vdr_diligence_categories_org_idx" ON "vdr_diligence_categories" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "vdr_permissions_document_idx" ON "vdr_document_permissions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "vdr_permissions_folder_idx" ON "vdr_document_permissions" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "vdr_permissions_user_idx" ON "vdr_document_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vdr_permissions_external_user_idx" ON "vdr_document_permissions" USING btree ("external_user_id");--> statement-breakpoint
CREATE INDEX "vdr_document_permissions_org_idx" ON "vdr_document_permissions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "vdr_documents_folder_idx" ON "vdr_documents" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "vdr_documents_project_idx" ON "vdr_documents" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "vdr_documents_version_idx" ON "vdr_documents" USING btree ("parent_document_id","version");--> statement-breakpoint
CREATE INDEX "vdr_documents_org_idx" ON "vdr_documents" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "vdr_due_date_presets_org_idx" ON "vdr_due_date_presets" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "vdr_folders_project_idx" ON "vdr_folders" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "vdr_folders_parent_idx" ON "vdr_folders" USING btree ("parent_folder_id");--> statement-breakpoint
CREATE INDEX "vdr_folders_org_idx" ON "vdr_folders" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "vdr_template_folders_template_idx" ON "vdr_template_folders" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "vdr_template_folders_parent_idx" ON "vdr_template_folders" USING btree ("parent_folder_id");--> statement-breakpoint
CREATE INDEX "vdr_templates_category_idx" ON "vdr_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "vdr_templates_org_idx" ON "vdr_templates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "vdr_watermarks_document_idx" ON "vdr_watermarks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "vdr_watermarks_folder_idx" ON "vdr_watermarks" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "vdr_watermarks_project_idx" ON "vdr_watermarks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_duplicates_canonical" ON "docktalk_article_duplicates" USING btree ("canonical_article_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_duplicates_date" ON "docktalk_article_duplicates" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_docktalk_article_entities_article" ON "docktalk_article_entities" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_article_entities_entity" ON "docktalk_article_entities" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_article_entities_unique" ON "docktalk_article_entities" USING btree ("article_id","entity_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_fingerprints_article" ON "docktalk_article_fingerprints" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_fingerprints_hash" ON "docktalk_article_fingerprints" USING btree ("fingerprint_hash");--> statement-breakpoint
CREATE INDEX "idx_docktalk_fingerprints_title" ON "docktalk_article_fingerprints" USING btree ("normalized_title");--> statement-breakpoint
CREATE INDEX "idx_docktalk_articles_published" ON "docktalk_articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_docktalk_articles_score" ON "docktalk_articles" USING btree ("relevance_score");--> statement-breakpoint
CREATE INDEX "idx_docktalk_articles_search" ON "docktalk_articles" USING btree ("search_text");--> statement-breakpoint
CREATE INDEX "idx_docktalk_articles_url" ON "docktalk_articles" USING btree ("url");--> statement-breakpoint
CREATE INDEX "idx_docktalk_articles_category" ON "docktalk_articles" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_docktalk_articles_sentiment" ON "docktalk_articles" USING btree ("sentiment");--> statement-breakpoint
CREATE INDEX "idx_docktalk_articles_region" ON "docktalk_articles" USING btree ("region");--> statement-breakpoint
CREATE INDEX "idx_docktalk_summaries_category" ON "docktalk_category_summaries" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_docktalk_summaries_period" ON "docktalk_category_summaries" USING btree ("period");--> statement-breakpoint
CREATE INDEX "idx_docktalk_summaries_generated" ON "docktalk_category_summaries" USING btree ("generated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_docktalk_summaries_unique" ON "docktalk_category_summaries" USING btree ("category","period","period_start");--> statement-breakpoint
CREATE INDEX "idx_docktalk_notifications_user" ON "docktalk_notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_notifications_org" ON "docktalk_notifications" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_notifications_search" ON "docktalk_notifications" USING btree ("saved_search_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_notifications_source" ON "docktalk_notifications" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_docktalk_notifications_sent_at" ON "docktalk_notifications" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_org_features_org" ON "organization_features" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_org_features_feature" ON "organization_features" USING btree ("feature");--> statement-breakpoint
CREATE INDEX "idx_docktalk_saved_filters_user" ON "docktalk_saved_filters" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_saved_filters_org" ON "docktalk_saved_filters" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_edits_summary" ON "docktalk_summary_edits" USING btree ("summary_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_edits_user" ON "docktalk_summary_edits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_edits_created" ON "docktalk_summary_edits" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_docktalk_annotations_user" ON "docktalk_user_article_annotations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_annotations_article" ON "docktalk_user_article_annotations" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_annotations_org" ON "docktalk_user_article_annotations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_annotations_user_article" ON "docktalk_user_article_annotations" USING btree ("user_id","article_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_filter_prefs_user" ON "docktalk_user_filter_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_filter_prefs_org" ON "docktalk_user_filter_preferences" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_notification_prefs_user" ON "docktalk_user_notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_docktalk_notification_prefs_frequency" ON "docktalk_user_notification_preferences" USING btree ("frequency");--> statement-breakpoint
CREATE INDEX "idx_docktalk_notification_prefs_org" ON "docktalk_user_notification_preferences" USING btree ("org_id");--> statement-breakpoint
ALTER TABLE "sales_comps" ADD CONSTRAINT "sales_comps_agent_contact_id_crm_contacts_id_fk" FOREIGN KEY ("agent_contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_comps" ADD CONSTRAINT "sales_comps_owner_company_id_crm_companies_id_fk" FOREIGN KEY ("owner_company_id") REFERENCES "public"."crm_companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."crm_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_comps_org_owner_portfolio_idx" ON "sales_comps" USING btree ("org_id","owner_company_id","is_portfolio");