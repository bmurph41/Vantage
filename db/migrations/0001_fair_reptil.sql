CREATE TYPE "public"."asset_class_category" AS ENUM('residential', 'commercial', 'hospitality', 'specialty', 'land');--> statement-breakpoint
CREATE TYPE "public"."data_source_auth_type" AS ENUM('api_key', 'oauth2', 'basic', 'rets', 'none');--> statement-breakpoint
CREATE TYPE "public"."data_source_provider_type" AS ENUM('api', 'feed', 'aggregator', 'scraper');--> statement-breakpoint
CREATE TYPE "public"."data_source_status" AS ENUM('disconnected', 'connected', 'syncing', 'error', 'rate_limited', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."platform_asset_class" AS ENUM('sfr', 'duplex', 'triplex', 'quadplex', 'multifamily', 'str_airbnb', 'marina', 'rv_park', 'self_storage', 'mobile_home', 'hotel', 'mixed_use', 'office', 'retail', 'industrial', 'land');--> statement-breakpoint
CREATE TYPE "public"."sync_frequency" AS ENUM('realtime', 'hourly', 'daily', 'weekly', 'monthly', 'manual');--> statement-breakpoint
CREATE TYPE "public"."sync_log_status" AS ENUM('started', 'completed', 'failed', 'partial', 'cancelled');--> statement-breakpoint
CREATE TABLE "data_source_sync_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_source_id" varchar NOT NULL,
	"status" "sync_log_status" NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"records_fetched" integer DEFAULT 0,
	"records_created" integer DEFAULT 0,
	"records_updated" integer DEFAULT 0,
	"records_failed" integer DEFAULT 0,
	"error_message" text,
	"error_details" jsonb,
	"triggered_by" varchar(50),
	"triggered_by_user_id" varchar,
	"sync_params" jsonb DEFAULT '{}',
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_asset_classes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" "platform_asset_class" NOT NULL,
	"label" varchar(100) NOT NULL,
	"short_label" varchar(30),
	"category" "asset_class_category" NOT NULL,
	"description" text,
	"icon" varchar(50),
	"enabled" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}',
	"enabled_modules" jsonb DEFAULT '[]',
	"default_data_sources" jsonb DEFAULT '[]',
	"coa_taxonomy_pack_key" varchar(50),
	"dd_template_key" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_asset_classes_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "platform_data_source_mappings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_source_id" varchar NOT NULL,
	"source_entity" varchar(100) NOT NULL,
	"target_module" varchar(50) NOT NULL,
	"target_entity" varchar(100) NOT NULL,
	"field_mappings" jsonb NOT NULL,
	"transform_rules" jsonb DEFAULT '[]',
	"sync_direction" varchar(20) DEFAULT 'read' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_data_sources" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"provider_type" "data_source_provider_type" NOT NULL,
	"auth_type" "data_source_auth_type" NOT NULL,
	"base_url" varchar(500),
	"credentials" jsonb DEFAULT '{}',
	"rate_limits" jsonb DEFAULT '{}',
	"status" "data_source_status" DEFAULT 'disconnected' NOT NULL,
	"status_message" text,
	"last_tested_at" timestamp,
	"last_sync_at" timestamp,
	"sync_frequency" "sync_frequency" DEFAULT 'daily' NOT NULL,
	"sync_config" jsonb DEFAULT '{}',
	"supported_asset_classes" text[] DEFAULT '{}',
	"capabilities" jsonb DEFAULT '{}',
	"enabled" boolean DEFAULT false NOT NULL,
	"total_records_synced" integer DEFAULT 0,
	"error_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_data_sources_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "property_data_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" varchar,
	"source_property_id" varchar(200),
	"asset_class" "platform_asset_class",
	"address_street" varchar(300),
	"address_city" varchar(100),
	"address_state" varchar(10),
	"address_zip" varchar(20),
	"address_county" varchar(100),
	"latitude" real,
	"longitude" real,
	"property_data" jsonb DEFAULT '{}',
	"valuation_data" jsonb DEFAULT '{}',
	"listing_data" jsonb DEFAULT '{}',
	"market_data" jsonb DEFAULT '{}',
	"raw_payload" jsonb,
	"org_id" varchar,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"address_hash" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_deals" ADD COLUMN "asset_class" text DEFAULT 'marina';--> statement-breakpoint
ALTER TABLE "pnl_department_verifications" ADD COLUMN "file_data" text;--> statement-breakpoint
ALTER TABLE "pnl_documents" ADD COLUMN "file_data" text;--> statement-breakpoint
ALTER TABLE "pnl_facts" ADD COLUMN "file_data" text;--> statement-breakpoint
ALTER TABLE "pnl_jobs" ADD COLUMN "file_data" text;--> statement-breakpoint
ALTER TABLE "pnl_parsed_statements" ADD COLUMN "file_data" text;--> statement-breakpoint
ALTER TABLE "pnl_review_items" ADD COLUMN "file_data" text;--> statement-breakpoint
ALTER TABLE "data_source_sync_logs" ADD CONSTRAINT "data_source_sync_logs_data_source_id_platform_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."platform_data_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_data_source_mappings" ADD CONSTRAINT "platform_data_source_mappings_data_source_id_platform_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."platform_data_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_data_cache" ADD CONSTRAINT "property_data_cache_source_id_platform_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."platform_data_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dssl_source_idx" ON "data_source_sync_logs" USING btree ("data_source_id");--> statement-breakpoint
CREATE INDEX "dssl_status_idx" ON "data_source_sync_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dssl_started_idx" ON "data_source_sync_logs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "pac_category_idx" ON "platform_asset_classes" USING btree ("category");--> statement-breakpoint
CREATE INDEX "pac_enabled_idx" ON "platform_asset_classes" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "pdsm_source_idx" ON "platform_data_source_mappings" USING btree ("data_source_id");--> statement-breakpoint
CREATE INDEX "pds_status_idx" ON "platform_data_sources" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pds_enabled_idx" ON "platform_data_sources" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "pdc_source_idx" ON "property_data_cache" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "pdc_asset_class_idx" ON "property_data_cache" USING btree ("asset_class");--> statement-breakpoint
CREATE INDEX "pdc_address_hash_idx" ON "property_data_cache" USING btree ("address_hash");--> statement-breakpoint
CREATE INDEX "pdc_location_idx" ON "property_data_cache" USING btree ("address_state","address_city","address_zip");--> statement-breakpoint
CREATE INDEX "pdc_org_idx" ON "property_data_cache" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "pdc_expires_idx" ON "property_data_cache" USING btree ("expires_at");