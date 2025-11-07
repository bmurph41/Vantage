CREATE TYPE "public"."pending_property_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "comp_columns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" text NOT NULL,
	"options" text[],
	"required" boolean DEFAULT false,
	"visible" boolean DEFAULT true,
	"order_index" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "comp_imports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"filename" text NOT NULL,
	"status" text NOT NULL,
	"column_mapping" jsonb,
	"parsed_data" jsonb,
	"summary" jsonb
);
--> statement-breakpoint
CREATE TABLE "pending_properties" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"comp_id" varchar NOT NULL,
	"marina_name" text NOT NULL,
	"city" text,
	"state" text,
	"address" text,
	"sale_price" integer,
	"status" "pending_property_status" DEFAULT 'pending' NOT NULL,
	"comp_metadata" jsonb DEFAULT '{}'::jsonb,
	"suggested_duplicates" jsonb DEFAULT '[]'::jsonb,
	"created_property_id" varchar,
	"created_by" varchar NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_comp_columns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" text NOT NULL,
	"options" text[],
	"required" boolean DEFAULT false,
	"visible" boolean DEFAULT true,
	"order_index" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rate_comp_imports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"filename" text NOT NULL,
	"status" text NOT NULL,
	"column_mapping" jsonb,
	"parsed_data" jsonb,
	"summary" jsonb
);
--> statement-breakpoint
CREATE TABLE "rate_comps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	"marina" text NOT NULL,
	"sale_price" integer,
	"is_price_disclosed" boolean DEFAULT true,
	"cap_rate" integer,
	"is_cap_rate_disclosed" boolean DEFAULT true,
	"noi" integer,
	"is_noi_disclosed" boolean DEFAULT true,
	"sale_month" integer,
	"sale_year" integer,
	"city" text,
	"state" text,
	"wet_slips" integer,
	"dry_racks" integer,
	"inside_outside_both" text,
	"storage_types" text[] DEFAULT '{}',
	"body_of_water" text,
	"water_body_name" text,
	"waterfront" text,
	"region" text,
	"sale_condition" text,
	"days_on_market" integer,
	"broker" text,
	"address" text,
	"zip" text,
	"seller" text,
	"company" text,
	"owner" text,
	"list_price" integer,
	"acres" integer,
	"occupancy" integer,
	"year_built" integer,
	"article_urls" text[] DEFAULT '{}',
	"notes" text,
	"profit_center_storage" boolean DEFAULT false,
	"profit_center_events" boolean DEFAULT false,
	"profit_center_service" boolean DEFAULT false,
	"profit_center_third_party_leases" boolean DEFAULT false,
	"profit_center_boat_rentals" boolean DEFAULT false,
	"profit_center_boat_brokerage" boolean DEFAULT false,
	"profit_center_rv_park" boolean DEFAULT false,
	"profit_center_fuel" boolean DEFAULT false,
	"profit_center_ship_store" boolean DEFAULT false,
	"profit_center_parts" boolean DEFAULT false,
	"profit_center_boat_club" boolean DEFAULT false,
	"profit_center_boat_sales" boolean DEFAULT false,
	"profit_center_fnb" boolean DEFAULT false,
	"profit_center_hospitality" boolean DEFAULT false,
	"profit_center_boat_rentals_type" varchar(20),
	"profit_center_boat_brokerage_type" varchar(20),
	"profit_center_fuel_type" varchar(20),
	"profit_center_ship_store_type" varchar(20),
	"profit_center_parts_type" varchar(20),
	"profit_center_boat_sales_type" varchar(20),
	"profit_center_fnb_type" varchar(20),
	"profit_center_hospitality_type" varchar(20),
	"profit_center_boat_club_type" varchar(20),
	"profit_center_boat_club_company" text,
	"profit_centers" text[] DEFAULT '{}',
	"coastal_type" text,
	"water_type" text,
	"is_portfolio" boolean DEFAULT false,
	"parent_portfolio_id" varchar,
	"property_id" varchar,
	"seller_company_id" varchar,
	"seller_contact_id" varchar,
	"buyer_company_id" varchar,
	"buyer_contact_id" varchar,
	"custom" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "rc_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"entity" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rc_custom_storage_types" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"name" text NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rc_metric_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"name" text NOT NULL,
	"description" text,
	"condition" jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_triggered_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "rc_metric_points" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"timestamp" timestamp NOT NULL,
	"value" numeric(20, 2) NOT NULL,
	"sample_size" integer DEFAULT 0,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"group_value" text
);
--> statement-breakpoint
CREATE TABLE "rc_metric_series" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"name" text NOT NULL,
	"description" text,
	"metric_type" text NOT NULL,
	"aggregation_type" text NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb,
	"group_by" text,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "rc_org_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"segment_key" text NOT NULL,
	"weights" jsonb DEFAULT '{"capacity":0.4,"financial":0.35,"profitCenters":0.15,"regional":0.07,"geo":0.03}'::jsonb,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "rc_org_preferences_unique_idx" UNIQUE("org_id","segment_key")
);
--> statement-breakpoint
CREATE TABLE "rc_pending_property_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comp_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "rc_portfolio_comps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"portfolio_id" varchar NOT NULL,
	"rate_comp_id" varchar NOT NULL,
	"added_by" varchar NOT NULL,
	"added_at" timestamp DEFAULT now(),
	"order_index" integer DEFAULT 0,
	CONSTRAINT "rc_portfolio_comps_unique_idx" UNIQUE("org_id","portfolio_id","rate_comp_id")
);
--> statement-breakpoint
CREATE TABLE "rc_portfolios" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	"name" text NOT NULL,
	"description" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "rc_project_comps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"rc_project_id" varchar NOT NULL,
	"rate_comp_id" varchar NOT NULL,
	"added_by" varchar NOT NULL,
	"added_at" timestamp DEFAULT now(),
	"notes" text,
	CONSTRAINT "rc_project_comps_unique_idx" UNIQUE("org_id","rc_project_id","rate_comp_id")
);
--> statement-breakpoint
CREATE TABLE "rc_projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	"name" text NOT NULL,
	"description" text,
	"color" varchar(7),
	"profile" jsonb DEFAULT '{}'::jsonb,
	"weight_overrides" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "rc_recommendation_feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"rc_project_id" varchar NOT NULL,
	"rate_comp_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"action" text NOT NULL,
	"score_at_time" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rc_saved_searches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	"name" text NOT NULL,
	"description" text,
	"filters" jsonb DEFAULT '{}'::jsonb,
	"email_alerts_enabled" boolean DEFAULT false,
	"alert_frequency" text,
	"last_alert_sent" timestamp,
	"last_used_at" timestamp,
	"use_count" integer DEFAULT 0,
	"is_pinned" boolean DEFAULT false,
	"color" varchar(7)
);
--> statement-breakpoint
CREATE TABLE "sales_comps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	"marina" text NOT NULL,
	"sale_price" integer,
	"is_price_disclosed" boolean DEFAULT true,
	"cap_rate" integer,
	"is_cap_rate_disclosed" boolean DEFAULT true,
	"noi" integer,
	"is_noi_disclosed" boolean DEFAULT true,
	"sale_month" integer,
	"sale_year" integer,
	"city" text,
	"state" text,
	"wet_slips" integer,
	"dry_racks" integer,
	"inside_outside_both" text,
	"storage_types" text[] DEFAULT '{}',
	"body_of_water" text,
	"water_body_name" text,
	"waterfront" text,
	"region" text,
	"sale_condition" text,
	"days_on_market" integer,
	"broker" text,
	"address" text,
	"zip" text,
	"seller" text,
	"company" text,
	"owner" text,
	"list_price" integer,
	"acres" integer,
	"occupancy" integer,
	"year_built" integer,
	"article_urls" text[] DEFAULT '{}',
	"notes" text,
	"profit_center_storage" boolean DEFAULT false,
	"profit_center_events" boolean DEFAULT false,
	"profit_center_service" boolean DEFAULT false,
	"profit_center_third_party_leases" boolean DEFAULT false,
	"profit_center_boat_rentals" boolean DEFAULT false,
	"profit_center_boat_brokerage" boolean DEFAULT false,
	"profit_center_rv_park" boolean DEFAULT false,
	"profit_center_fuel" boolean DEFAULT false,
	"profit_center_ship_store" boolean DEFAULT false,
	"profit_center_parts" boolean DEFAULT false,
	"profit_center_boat_club" boolean DEFAULT false,
	"profit_center_boat_sales" boolean DEFAULT false,
	"profit_center_fnb" boolean DEFAULT false,
	"profit_center_hospitality" boolean DEFAULT false,
	"profit_center_boat_rentals_type" varchar(20),
	"profit_center_boat_brokerage_type" varchar(20),
	"profit_center_fuel_type" varchar(20),
	"profit_center_ship_store_type" varchar(20),
	"profit_center_parts_type" varchar(20),
	"profit_center_boat_sales_type" varchar(20),
	"profit_center_fnb_type" varchar(20),
	"profit_center_hospitality_type" varchar(20),
	"profit_center_boat_club_type" varchar(20),
	"profit_center_boat_club_company" text,
	"profit_centers" text[] DEFAULT '{}',
	"coastal_type" text,
	"water_type" text,
	"is_portfolio" boolean DEFAULT false,
	"parent_portfolio_id" varchar,
	"property_id" varchar,
	"seller_company_id" varchar,
	"seller_contact_id" varchar,
	"buyer_company_id" varchar,
	"buyer_contact_id" varchar,
	"custom" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "sc_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"entity" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sc_custom_storage_types" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"name" text NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sc_metric_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"name" text NOT NULL,
	"condition" text NOT NULL,
	"threshold" numeric(20, 2),
	"threshold_min" numeric(20, 2),
	"threshold_max" numeric(20, 2),
	"is_active" boolean DEFAULT true,
	"last_triggered" timestamp,
	"notification_channels" text[] DEFAULT ARRAY[]::text[]
);
--> statement-breakpoint
CREATE TABLE "sc_metric_points" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"timestamp" timestamp NOT NULL,
	"value" numeric(20, 2) NOT NULL,
	"sample_size" integer DEFAULT 0,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"group_value" text
);
--> statement-breakpoint
CREATE TABLE "sc_metric_series" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"name" text NOT NULL,
	"description" text,
	"metric_type" text NOT NULL,
	"aggregation_type" text NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb,
	"group_by" text,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "sc_org_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"segment_key" text NOT NULL,
	"weights" jsonb DEFAULT '{"capacity":0.4,"financial":0.35,"profitCenters":0.15,"regional":0.07,"geo":0.03}'::jsonb,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sc_org_preferences_unique_idx" UNIQUE("org_id","segment_key")
);
--> statement-breakpoint
CREATE TABLE "sc_pending_property_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comp_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sc_portfolio_comps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"portfolio_id" varchar NOT NULL,
	"sales_comp_id" varchar NOT NULL,
	"added_by" varchar NOT NULL,
	"added_at" timestamp DEFAULT now(),
	"order_index" integer DEFAULT 0,
	CONSTRAINT "sc_portfolio_comps_unique_idx" UNIQUE("org_id","portfolio_id","sales_comp_id")
);
--> statement-breakpoint
CREATE TABLE "sc_portfolios" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	"name" text NOT NULL,
	"description" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "sc_project_comps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"sc_project_id" varchar NOT NULL,
	"sales_comp_id" varchar NOT NULL,
	"added_by" varchar NOT NULL,
	"added_at" timestamp DEFAULT now(),
	"notes" text,
	CONSTRAINT "sc_project_comps_unique_idx" UNIQUE("org_id","sc_project_id","sales_comp_id")
);
--> statement-breakpoint
CREATE TABLE "sc_projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	"name" text NOT NULL,
	"description" text,
	"color" varchar(7),
	"profile" jsonb DEFAULT '{}'::jsonb,
	"weight_overrides" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "sc_recommendation_feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"sc_project_id" varchar NOT NULL,
	"sales_comp_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"action" text NOT NULL,
	"score_at_time" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sc_saved_searches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	"name" text NOT NULL,
	"description" text,
	"filters" jsonb DEFAULT '{}'::jsonb,
	"email_alerts_enabled" boolean DEFAULT false,
	"alert_frequency" text,
	"last_alert_sent" timestamp,
	"last_used_at" timestamp,
	"use_count" integer DEFAULT 0,
	"is_pinned" boolean DEFAULT false,
	"color" varchar(7)
);
--> statement-breakpoint
ALTER TABLE "crm_deals" ADD COLUMN "type" text;--> statement-breakpoint
ALTER TABLE "comp_columns" ADD CONSTRAINT "comp_columns_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comp_imports" ADD CONSTRAINT "comp_imports_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comp_imports" ADD CONSTRAINT "comp_imports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_properties" ADD CONSTRAINT "pending_properties_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_properties" ADD CONSTRAINT "pending_properties_comp_id_sales_comps_id_fk" FOREIGN KEY ("comp_id") REFERENCES "public"."sales_comps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_properties" ADD CONSTRAINT "pending_properties_created_property_id_crm_properties_id_fk" FOREIGN KEY ("created_property_id") REFERENCES "public"."crm_properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_properties" ADD CONSTRAINT "pending_properties_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_properties" ADD CONSTRAINT "pending_properties_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_comp_columns" ADD CONSTRAINT "rate_comp_columns_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_comp_imports" ADD CONSTRAINT "rate_comp_imports_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_comp_imports" ADD CONSTRAINT "rate_comp_imports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_comps" ADD CONSTRAINT "rate_comps_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_comps" ADD CONSTRAINT "rate_comps_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_comps" ADD CONSTRAINT "rate_comps_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_comps" ADD CONSTRAINT "rate_comps_parent_portfolio_id_rate_comps_id_fk" FOREIGN KEY ("parent_portfolio_id") REFERENCES "public"."rate_comps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_comps" ADD CONSTRAINT "rate_comps_property_id_crm_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."crm_properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_comps" ADD CONSTRAINT "rate_comps_seller_company_id_crm_companies_id_fk" FOREIGN KEY ("seller_company_id") REFERENCES "public"."crm_companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_comps" ADD CONSTRAINT "rate_comps_seller_contact_id_crm_contacts_id_fk" FOREIGN KEY ("seller_contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_comps" ADD CONSTRAINT "rate_comps_buyer_company_id_crm_companies_id_fk" FOREIGN KEY ("buyer_company_id") REFERENCES "public"."crm_companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_comps" ADD CONSTRAINT "rate_comps_buyer_contact_id_crm_contacts_id_fk" FOREIGN KEY ("buyer_contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_audit_log" ADD CONSTRAINT "rc_audit_log_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_audit_log" ADD CONSTRAINT "rc_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_custom_storage_types" ADD CONSTRAINT "rc_custom_storage_types_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_custom_storage_types" ADD CONSTRAINT "rc_custom_storage_types_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_metric_alerts" ADD CONSTRAINT "rc_metric_alerts_series_id_rc_metric_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."rc_metric_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_metric_alerts" ADD CONSTRAINT "rc_metric_alerts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_metric_alerts" ADD CONSTRAINT "rc_metric_alerts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_metric_points" ADD CONSTRAINT "rc_metric_points_series_id_rc_metric_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."rc_metric_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_metric_points" ADD CONSTRAINT "rc_metric_points_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_metric_series" ADD CONSTRAINT "rc_metric_series_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_metric_series" ADD CONSTRAINT "rc_metric_series_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_org_preferences" ADD CONSTRAINT "rc_org_preferences_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_pending_property_profiles" ADD CONSTRAINT "rc_pending_property_profiles_comp_id_rate_comps_id_fk" FOREIGN KEY ("comp_id") REFERENCES "public"."rate_comps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_pending_property_profiles" ADD CONSTRAINT "rc_pending_property_profiles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_portfolio_comps" ADD CONSTRAINT "rc_portfolio_comps_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_portfolio_comps" ADD CONSTRAINT "rc_portfolio_comps_portfolio_id_rc_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."rc_portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_portfolio_comps" ADD CONSTRAINT "rc_portfolio_comps_rate_comp_id_rate_comps_id_fk" FOREIGN KEY ("rate_comp_id") REFERENCES "public"."rate_comps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_portfolio_comps" ADD CONSTRAINT "rc_portfolio_comps_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_portfolios" ADD CONSTRAINT "rc_portfolios_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_portfolios" ADD CONSTRAINT "rc_portfolios_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_portfolios" ADD CONSTRAINT "rc_portfolios_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_project_comps" ADD CONSTRAINT "rc_project_comps_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_project_comps" ADD CONSTRAINT "rc_project_comps_rc_project_id_rc_projects_id_fk" FOREIGN KEY ("rc_project_id") REFERENCES "public"."rc_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_project_comps" ADD CONSTRAINT "rc_project_comps_rate_comp_id_rate_comps_id_fk" FOREIGN KEY ("rate_comp_id") REFERENCES "public"."rate_comps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_project_comps" ADD CONSTRAINT "rc_project_comps_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_projects" ADD CONSTRAINT "rc_projects_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_projects" ADD CONSTRAINT "rc_projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_projects" ADD CONSTRAINT "rc_projects_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_recommendation_feedback" ADD CONSTRAINT "rc_recommendation_feedback_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_recommendation_feedback" ADD CONSTRAINT "rc_recommendation_feedback_rc_project_id_rc_projects_id_fk" FOREIGN KEY ("rc_project_id") REFERENCES "public"."rc_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_recommendation_feedback" ADD CONSTRAINT "rc_recommendation_feedback_rate_comp_id_rate_comps_id_fk" FOREIGN KEY ("rate_comp_id") REFERENCES "public"."rate_comps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_recommendation_feedback" ADD CONSTRAINT "rc_recommendation_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_saved_searches" ADD CONSTRAINT "rc_saved_searches_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_saved_searches" ADD CONSTRAINT "rc_saved_searches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rc_saved_searches" ADD CONSTRAINT "rc_saved_searches_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_comps" ADD CONSTRAINT "sales_comps_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_comps" ADD CONSTRAINT "sales_comps_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_comps" ADD CONSTRAINT "sales_comps_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_comps" ADD CONSTRAINT "sales_comps_parent_portfolio_id_sales_comps_id_fk" FOREIGN KEY ("parent_portfolio_id") REFERENCES "public"."sales_comps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_comps" ADD CONSTRAINT "sales_comps_property_id_crm_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."crm_properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_comps" ADD CONSTRAINT "sales_comps_seller_company_id_crm_companies_id_fk" FOREIGN KEY ("seller_company_id") REFERENCES "public"."crm_companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_comps" ADD CONSTRAINT "sales_comps_seller_contact_id_crm_contacts_id_fk" FOREIGN KEY ("seller_contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_comps" ADD CONSTRAINT "sales_comps_buyer_company_id_crm_companies_id_fk" FOREIGN KEY ("buyer_company_id") REFERENCES "public"."crm_companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_comps" ADD CONSTRAINT "sales_comps_buyer_contact_id_crm_contacts_id_fk" FOREIGN KEY ("buyer_contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_audit_log" ADD CONSTRAINT "sc_audit_log_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_audit_log" ADD CONSTRAINT "sc_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_custom_storage_types" ADD CONSTRAINT "sc_custom_storage_types_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_custom_storage_types" ADD CONSTRAINT "sc_custom_storage_types_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_metric_alerts" ADD CONSTRAINT "sc_metric_alerts_series_id_sc_metric_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."sc_metric_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_metric_alerts" ADD CONSTRAINT "sc_metric_alerts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_metric_alerts" ADD CONSTRAINT "sc_metric_alerts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_metric_points" ADD CONSTRAINT "sc_metric_points_series_id_sc_metric_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."sc_metric_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_metric_points" ADD CONSTRAINT "sc_metric_points_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_metric_series" ADD CONSTRAINT "sc_metric_series_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_metric_series" ADD CONSTRAINT "sc_metric_series_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_org_preferences" ADD CONSTRAINT "sc_org_preferences_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_pending_property_profiles" ADD CONSTRAINT "sc_pending_property_profiles_comp_id_sales_comps_id_fk" FOREIGN KEY ("comp_id") REFERENCES "public"."sales_comps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_pending_property_profiles" ADD CONSTRAINT "sc_pending_property_profiles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_portfolio_comps" ADD CONSTRAINT "sc_portfolio_comps_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_portfolio_comps" ADD CONSTRAINT "sc_portfolio_comps_portfolio_id_sc_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."sc_portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_portfolio_comps" ADD CONSTRAINT "sc_portfolio_comps_sales_comp_id_sales_comps_id_fk" FOREIGN KEY ("sales_comp_id") REFERENCES "public"."sales_comps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_portfolio_comps" ADD CONSTRAINT "sc_portfolio_comps_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_portfolios" ADD CONSTRAINT "sc_portfolios_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_portfolios" ADD CONSTRAINT "sc_portfolios_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_portfolios" ADD CONSTRAINT "sc_portfolios_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_project_comps" ADD CONSTRAINT "sc_project_comps_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_project_comps" ADD CONSTRAINT "sc_project_comps_sc_project_id_sc_projects_id_fk" FOREIGN KEY ("sc_project_id") REFERENCES "public"."sc_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_project_comps" ADD CONSTRAINT "sc_project_comps_sales_comp_id_sales_comps_id_fk" FOREIGN KEY ("sales_comp_id") REFERENCES "public"."sales_comps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_project_comps" ADD CONSTRAINT "sc_project_comps_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_projects" ADD CONSTRAINT "sc_projects_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_projects" ADD CONSTRAINT "sc_projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_projects" ADD CONSTRAINT "sc_projects_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_recommendation_feedback" ADD CONSTRAINT "sc_recommendation_feedback_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_recommendation_feedback" ADD CONSTRAINT "sc_recommendation_feedback_sc_project_id_sc_projects_id_fk" FOREIGN KEY ("sc_project_id") REFERENCES "public"."sc_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_recommendation_feedback" ADD CONSTRAINT "sc_recommendation_feedback_sales_comp_id_sales_comps_id_fk" FOREIGN KEY ("sales_comp_id") REFERENCES "public"."sales_comps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_recommendation_feedback" ADD CONSTRAINT "sc_recommendation_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_saved_searches" ADD CONSTRAINT "sc_saved_searches_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_saved_searches" ADD CONSTRAINT "sc_saved_searches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sc_saved_searches" ADD CONSTRAINT "sc_saved_searches_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comp_columns_org_idx" ON "comp_columns" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "comp_columns_org_key_idx" ON "comp_columns" USING btree ("org_id","key");--> statement-breakpoint
CREATE INDEX "comp_imports_org_idx" ON "comp_imports" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rate_comp_columns_org_idx" ON "rate_comp_columns" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rate_comp_columns_org_key_idx" ON "rate_comp_columns" USING btree ("org_id","key");--> statement-breakpoint
CREATE INDEX "rate_comp_imports_org_idx" ON "rate_comp_imports" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rate_comps_org_idx" ON "rate_comps" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rate_comps_org_state_idx" ON "rate_comps" USING btree ("org_id","state");--> statement-breakpoint
CREATE INDEX "rate_comps_org_year_idx" ON "rate_comps" USING btree ("org_id","sale_year");--> statement-breakpoint
CREATE INDEX "rate_comps_org_price_idx" ON "rate_comps" USING btree ("org_id","sale_price");--> statement-breakpoint
CREATE INDEX "rate_comps_org_coastal_idx" ON "rate_comps" USING btree ("org_id","coastal_type");--> statement-breakpoint
CREATE INDEX "rate_comps_org_marina_idx" ON "rate_comps" USING btree ("org_id","marina");--> statement-breakpoint
CREATE INDEX "rate_comps_org_region_idx" ON "rate_comps" USING btree ("org_id","region");--> statement-breakpoint
CREATE INDEX "rc_audit_log_org_idx" ON "rc_audit_log" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rc_audit_log_entity_idx" ON "rc_audit_log" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "rc_custom_storage_types_org_idx" ON "rc_custom_storage_types" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rc_custom_storage_types_org_name_idx" ON "rc_custom_storage_types" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "rc_metric_alerts_org_idx" ON "rc_metric_alerts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rc_metric_alerts_series_idx" ON "rc_metric_alerts" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "rc_metric_alerts_active_idx" ON "rc_metric_alerts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "rc_metric_points_series_idx" ON "rc_metric_points" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "rc_metric_points_org_timestamp_idx" ON "rc_metric_points" USING btree ("org_id","timestamp");--> statement-breakpoint
CREATE INDEX "rc_metric_points_series_timestamp_idx" ON "rc_metric_points" USING btree ("series_id","timestamp");--> statement-breakpoint
CREATE INDEX "rc_metric_series_org_idx" ON "rc_metric_series" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rc_metric_series_org_metric_type_idx" ON "rc_metric_series" USING btree ("org_id","metric_type");--> statement-breakpoint
CREATE INDEX "rc_org_preferences_org_idx" ON "rc_org_preferences" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rc_pending_property_profiles_org_idx" ON "rc_pending_property_profiles" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rc_pending_property_profiles_comp_idx" ON "rc_pending_property_profiles" USING btree ("comp_id");--> statement-breakpoint
CREATE INDEX "rc_pending_property_profiles_status_idx" ON "rc_pending_property_profiles" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "rc_portfolio_comps_org_idx" ON "rc_portfolio_comps" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rc_portfolio_comps_portfolio_idx" ON "rc_portfolio_comps" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "rc_portfolio_comps_rate_comp_idx" ON "rc_portfolio_comps" USING btree ("rate_comp_id");--> statement-breakpoint
CREATE INDEX "rc_portfolios_org_idx" ON "rc_portfolios" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rc_portfolios_org_name_idx" ON "rc_portfolios" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "rc_project_comps_org_idx" ON "rc_project_comps" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rc_project_comps_project_idx" ON "rc_project_comps" USING btree ("rc_project_id");--> statement-breakpoint
CREATE INDEX "rc_project_comps_rate_comp_idx" ON "rc_project_comps" USING btree ("rate_comp_id");--> statement-breakpoint
CREATE INDEX "rc_projects_org_idx" ON "rc_projects" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rc_projects_org_name_idx" ON "rc_projects" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "rc_recommendation_feedback_org_idx" ON "rc_recommendation_feedback" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rc_recommendation_feedback_project_idx" ON "rc_recommendation_feedback" USING btree ("rc_project_id");--> statement-breakpoint
CREATE INDEX "rc_saved_searches_org_idx" ON "rc_saved_searches" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rc_saved_searches_org_created_by_idx" ON "rc_saved_searches" USING btree ("org_id","created_by");--> statement-breakpoint
CREATE INDEX "rc_saved_searches_org_pinned_idx" ON "rc_saved_searches" USING btree ("org_id","is_pinned");--> statement-breakpoint
CREATE INDEX "sales_comps_org_idx" ON "sales_comps" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sales_comps_org_state_idx" ON "sales_comps" USING btree ("org_id","state");--> statement-breakpoint
CREATE INDEX "sales_comps_org_year_idx" ON "sales_comps" USING btree ("org_id","sale_year");--> statement-breakpoint
CREATE INDEX "sales_comps_org_price_idx" ON "sales_comps" USING btree ("org_id","sale_price");--> statement-breakpoint
CREATE INDEX "sales_comps_org_coastal_idx" ON "sales_comps" USING btree ("org_id","coastal_type");--> statement-breakpoint
CREATE INDEX "sales_comps_org_marina_idx" ON "sales_comps" USING btree ("org_id","marina");--> statement-breakpoint
CREATE INDEX "sales_comps_org_region_idx" ON "sales_comps" USING btree ("org_id","region");--> statement-breakpoint
CREATE INDEX "sc_audit_log_org_idx" ON "sc_audit_log" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sc_audit_log_entity_idx" ON "sc_audit_log" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "sc_custom_storage_types_org_idx" ON "sc_custom_storage_types" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sc_custom_storage_types_org_name_idx" ON "sc_custom_storage_types" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "sc_metric_alerts_org_idx" ON "sc_metric_alerts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sc_metric_alerts_series_idx" ON "sc_metric_alerts" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "sc_metric_points_series_idx" ON "sc_metric_points" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "sc_metric_points_org_timestamp_idx" ON "sc_metric_points" USING btree ("org_id","timestamp");--> statement-breakpoint
CREATE INDEX "sc_metric_points_series_timestamp_idx" ON "sc_metric_points" USING btree ("series_id","timestamp");--> statement-breakpoint
CREATE INDEX "sc_metric_series_org_idx" ON "sc_metric_series" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sc_metric_series_org_metric_type_idx" ON "sc_metric_series" USING btree ("org_id","metric_type");--> statement-breakpoint
CREATE INDEX "sc_org_preferences_org_idx" ON "sc_org_preferences" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sc_pending_property_profiles_org_idx" ON "sc_pending_property_profiles" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sc_pending_property_profiles_comp_idx" ON "sc_pending_property_profiles" USING btree ("comp_id");--> statement-breakpoint
CREATE INDEX "sc_pending_property_profiles_status_idx" ON "sc_pending_property_profiles" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "sc_portfolio_comps_org_idx" ON "sc_portfolio_comps" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sc_portfolio_comps_portfolio_idx" ON "sc_portfolio_comps" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "sc_portfolio_comps_sales_comp_idx" ON "sc_portfolio_comps" USING btree ("sales_comp_id");--> statement-breakpoint
CREATE INDEX "sc_portfolios_org_idx" ON "sc_portfolios" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sc_portfolios_org_name_idx" ON "sc_portfolios" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "sc_project_comps_org_idx" ON "sc_project_comps" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sc_project_comps_project_idx" ON "sc_project_comps" USING btree ("sc_project_id");--> statement-breakpoint
CREATE INDEX "sc_project_comps_sales_comp_idx" ON "sc_project_comps" USING btree ("sales_comp_id");--> statement-breakpoint
CREATE INDEX "sc_projects_org_idx" ON "sc_projects" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sc_projects_org_name_idx" ON "sc_projects" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "sc_recommendation_feedback_org_idx" ON "sc_recommendation_feedback" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sc_recommendation_feedback_project_idx" ON "sc_recommendation_feedback" USING btree ("sc_project_id");--> statement-breakpoint
CREATE INDEX "sc_saved_searches_org_idx" ON "sc_saved_searches" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sc_saved_searches_org_created_by_idx" ON "sc_saved_searches" USING btree ("org_id","created_by");--> statement-breakpoint
CREATE INDEX "sc_saved_searches_org_pinned_idx" ON "sc_saved_searches" USING btree ("org_id","is_pinned");