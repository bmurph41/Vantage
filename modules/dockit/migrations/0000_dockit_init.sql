CREATE TABLE "dockit_analytics_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"marina_id" varchar NOT NULL,
	"snapshot_date" timestamp NOT NULL,
	"period" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dockit_api_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar,
	"marina_id" varchar,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"permissions" text[],
	"rate_limit" integer DEFAULT 1000,
	"is_active" boolean DEFAULT true,
	"expires_at" timestamp,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dockit_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"marina_id" varchar,
	"user_id" varchar,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"details" jsonb,
	"ip_address" text,
	"user_agent" text,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dockit_billing_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"marina_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"lease_id" varchar,
	"name" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"frequency" text NOT NULL,
	"day_of_month" integer DEFAULT 1,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"next_billing_date" timestamp NOT NULL,
	"last_billed_date" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"autopay_enabled" boolean DEFAULT false,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"payment_method" text,
	"grace_period_days" integer DEFAULT 5,
	"category" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dockit_boats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar NOT NULL,
	"name" text NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"year" integer NOT NULL,
	"length" numeric(5, 2) NOT NULL,
	"beam" numeric(5, 2) NOT NULL,
	"draft" numeric(5, 2),
	"hull_id" text,
	"registration_number" text,
	"insurance_info" jsonb
);
--> statement-breakpoint
CREATE TABLE "dockit_communications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar NOT NULL,
	"type" text NOT NULL,
	"subject" text,
	"message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"scheduled_for" timestamp
);
--> statement-breakpoint
CREATE TABLE "dockit_contract_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"marina_id" varchar,
	"name" text NOT NULL,
	"contract_type" text NOT NULL,
	"version" text DEFAULT '1.0',
	"template" text NOT NULL,
	"fields" jsonb,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dockit_contracts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"marina_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"reservation_id" varchar,
	"lease_id" varchar,
	"contract_type" text NOT NULL,
	"template_id" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"contract_data" jsonb,
	"document_url" text,
	"signature_data" jsonb,
	"external_envelope_id" text,
	"expires_at" timestamp,
	"sent_at" timestamp,
	"signed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dockit_customers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"address" text,
	"emergency_contact" jsonb,
	"last_launch_date" timestamp,
	"stripe_customer_id" text,
	"autopay_enabled" boolean DEFAULT false,
	"account_status" text DEFAULT 'active',
	"crm_contact_id" integer,
	"crm_company_id" integer,
	"synced_from_crm" boolean DEFAULT false,
	"last_crm_sync" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "dockit_customers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "dockit_sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dockit_import_errors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"entity" text NOT NULL,
	"row_index" integer NOT NULL,
	"code" text NOT NULL,
	"message" text NOT NULL,
	"raw_data" jsonb,
	"suggestion" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dockit_import_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"file_name" text,
	"file_size" integer,
	"status" text DEFAULT 'queued' NOT NULL,
	"total_rows" integer,
	"processed_rows" integer DEFAULT 0,
	"success_count" integer DEFAULT 0,
	"error_count" integer DEFAULT 0,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"created_by" text,
	"config" jsonb,
	"summary" jsonb
);
--> statement-breakpoint
CREATE TABLE "dockit_integrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text NOT NULL,
	"is_enabled" boolean DEFAULT false,
	"credentials" jsonb,
	"last_sync" timestamp,
	"sync_status" text DEFAULT 'disconnected',
	"config" jsonb
);
--> statement-breakpoint
CREATE TABLE "dockit_launches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"marina_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"boat_id" varchar NOT NULL,
	"scheduled_time" timestamp NOT NULL,
	"actual_launch_time" timestamp,
	"retrieval_time" timestamp,
	"checked_in_at" timestamp,
	"queue_position" integer,
	"estimated_wait_time" integer,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"staff_assigned" text,
	"fuel_requested" boolean DEFAULT false,
	"fuel_amount" numeric(5, 2),
	"supplies_requested" jsonb,
	"notification_preference" text DEFAULT 'sms',
	"customer_location" jsonb,
	"assigned_staff_id" varchar,
	"priority_level" text DEFAULT 'normal',
	"last_status_update" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dockit_leases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"marina_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"boat_id" varchar NOT NULL,
	"slip_id" varchar NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"monthly_rate" numeric(10, 2) NOT NULL,
	"deposit_amount" numeric(10, 2),
	"status" text DEFAULT 'active' NOT NULL,
	"auto_renew" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "dockit_marina_layouts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"marina_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT false,
	"layout" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dockit_marinas" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"address" text,
	"coordinates" jsonb,
	"amenities" text[],
	"description" text,
	"capacity" jsonb,
	"operating_hours" jsonb,
	"contact_info" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dockit_message_threads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"marina_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"subject" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"assigned_to_id" varchar,
	"related_reservation_id" varchar,
	"related_lease_id" varchar,
	"priority" text DEFAULT 'normal',
	"last_message_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dockit_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"sender_type" text NOT NULL,
	"content" text NOT NULL,
	"attachments" jsonb,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dockit_notification_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"notification_type" text NOT NULL,
	"channels" jsonb,
	"is_enabled" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dockit_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"marina_id" varchar,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"priority" text DEFAULT 'normal',
	"channels" text[],
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"action_url" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dockit_organizations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"phone" text,
	"email" text,
	"website" text,
	"logo" text,
	"settings" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dockit_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"marina_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"lease_id" varchar,
	"amount" numeric(10, 2) NOT NULL,
	"due_date" timestamp NOT NULL,
	"paid_date" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_method" text,
	"transaction_id" text,
	"stripe_payment_intent_id" text,
	"stripe_invoice_id" text,
	"description" text,
	"category" text,
	"billing_schedule_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dockit_pricing_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"marina_id" varchar NOT NULL,
	"name" text NOT NULL,
	"rule_type" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"priority" integer DEFAULT 1,
	"conditions" jsonb,
	"adjustment" jsonb,
	"description" text,
	"valid_from" timestamp NOT NULL,
	"valid_to" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dockit_reservations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"marina_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"boat_id" varchar NOT NULL,
	"slip_id" varchar,
	"type" text DEFAULT 'transient' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"check_in_date" timestamp NOT NULL,
	"check_out_date" timestamp NOT NULL,
	"actual_check_in" timestamp,
	"actual_check_out" timestamp,
	"number_of_nights" integer NOT NULL,
	"base_rate" numeric(10, 2) NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"deposit_amount" numeric(10, 2),
	"paid_amount" numeric(10, 2) DEFAULT '0',
	"source" text DEFAULT 'direct',
	"special_requests" text,
	"guest_preferences" jsonb,
	"cancellation_policy" text,
	"cancellation_deadline" timestamp,
	"confirmation_code" text,
	"external_reservation_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "dockit_reservations_confirmation_code_unique" UNIQUE("confirmation_code")
);
--> statement-breakpoint
CREATE TABLE "dockit_slip_pricing" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slip_id" varchar NOT NULL,
	"base_rate" numeric(10, 2) NOT NULL,
	"desirability_score" integer DEFAULT 5,
	"seasonal_rates" jsonb,
	"minimum_stay" integer DEFAULT 1,
	"maximum_stay" integer,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dockit_slips" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"marina_id" varchar NOT NULL,
	"number" text NOT NULL,
	"type" text NOT NULL,
	"section" text NOT NULL,
	"max_length" numeric(5, 2) NOT NULL,
	"max_beam" numeric(5, 2) NOT NULL,
	"max_draft" numeric(5, 2),
	"utilities" text[],
	"monthly_rate" numeric(10, 2) NOT NULL,
	"is_occupied" boolean DEFAULT false,
	"current_boat_id" varchar
);
--> statement-breakpoint
CREATE TABLE "dockit_user_marina_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"marina_id" varchar NOT NULL,
	"role" text NOT NULL,
	"permissions" text[],
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dockit_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"password_hash" text,
	"first_name" text,
	"last_name" text,
	"phone" text,
	"profile_image_url" text,
	"role" text DEFAULT 'customer' NOT NULL,
	"organization_id" varchar,
	"is_active" boolean DEFAULT true,
	"email_verified" boolean DEFAULT false,
	"last_login" timestamp,
	"preferences" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "dockit_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "dockit_waitlist" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"marina_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"boat_id" varchar NOT NULL,
	"requested_check_in" timestamp NOT NULL,
	"requested_check_out" timestamp NOT NULL,
	"flexible_dates" boolean DEFAULT false,
	"max_rate" numeric(10, 2),
	"slip_preferences" jsonb,
	"priority" integer DEFAULT 1,
	"status" text DEFAULT 'active' NOT NULL,
	"notifications_sent" integer DEFAULT 0,
	"last_notified" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dockit_webhook_deliveries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" varchar NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb,
	"status" text NOT NULL,
	"status_code" integer,
	"response_body" text,
	"attempts" integer DEFAULT 0,
	"next_retry_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dockit_webhooks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar,
	"marina_id" varchar,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" text[] NOT NULL,
	"is_active" boolean DEFAULT true,
	"description" text,
	"failure_count" integer DEFAULT 0,
	"last_delivery_at" timestamp,
	"last_delivery_status" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "dockit_analytics_snapshots" ADD CONSTRAINT "dockit_analytics_snapshots_marina_id_dockit_marinas_id_fk" FOREIGN KEY ("marina_id") REFERENCES "public"."dockit_marinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_api_keys" ADD CONSTRAINT "dockit_api_keys_organization_id_dockit_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."dockit_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_api_keys" ADD CONSTRAINT "dockit_api_keys_marina_id_dockit_marinas_id_fk" FOREIGN KEY ("marina_id") REFERENCES "public"."dockit_marinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_audit_logs" ADD CONSTRAINT "dockit_audit_logs_marina_id_dockit_marinas_id_fk" FOREIGN KEY ("marina_id") REFERENCES "public"."dockit_marinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_audit_logs" ADD CONSTRAINT "dockit_audit_logs_user_id_dockit_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."dockit_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_billing_schedules" ADD CONSTRAINT "dockit_billing_schedules_marina_id_dockit_marinas_id_fk" FOREIGN KEY ("marina_id") REFERENCES "public"."dockit_marinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_billing_schedules" ADD CONSTRAINT "dockit_billing_schedules_customer_id_dockit_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."dockit_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_billing_schedules" ADD CONSTRAINT "dockit_billing_schedules_lease_id_dockit_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."dockit_leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_boats" ADD CONSTRAINT "dockit_boats_customer_id_dockit_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."dockit_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_communications" ADD CONSTRAINT "dockit_communications_customer_id_dockit_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."dockit_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_contract_templates" ADD CONSTRAINT "dockit_contract_templates_marina_id_dockit_marinas_id_fk" FOREIGN KEY ("marina_id") REFERENCES "public"."dockit_marinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_contracts" ADD CONSTRAINT "dockit_contracts_marina_id_dockit_marinas_id_fk" FOREIGN KEY ("marina_id") REFERENCES "public"."dockit_marinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_contracts" ADD CONSTRAINT "dockit_contracts_customer_id_dockit_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."dockit_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_contracts" ADD CONSTRAINT "dockit_contracts_reservation_id_dockit_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."dockit_reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_contracts" ADD CONSTRAINT "dockit_contracts_lease_id_dockit_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."dockit_leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_import_errors" ADD CONSTRAINT "dockit_import_errors_job_id_dockit_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."dockit_import_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_launches" ADD CONSTRAINT "dockit_launches_marina_id_dockit_marinas_id_fk" FOREIGN KEY ("marina_id") REFERENCES "public"."dockit_marinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_launches" ADD CONSTRAINT "dockit_launches_customer_id_dockit_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."dockit_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_launches" ADD CONSTRAINT "dockit_launches_boat_id_dockit_boats_id_fk" FOREIGN KEY ("boat_id") REFERENCES "public"."dockit_boats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_leases" ADD CONSTRAINT "dockit_leases_marina_id_dockit_marinas_id_fk" FOREIGN KEY ("marina_id") REFERENCES "public"."dockit_marinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_leases" ADD CONSTRAINT "dockit_leases_customer_id_dockit_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."dockit_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_leases" ADD CONSTRAINT "dockit_leases_boat_id_dockit_boats_id_fk" FOREIGN KEY ("boat_id") REFERENCES "public"."dockit_boats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_leases" ADD CONSTRAINT "dockit_leases_slip_id_dockit_slips_id_fk" FOREIGN KEY ("slip_id") REFERENCES "public"."dockit_slips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_marina_layouts" ADD CONSTRAINT "dockit_marina_layouts_marina_id_dockit_marinas_id_fk" FOREIGN KEY ("marina_id") REFERENCES "public"."dockit_marinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_marinas" ADD CONSTRAINT "dockit_marinas_organization_id_dockit_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."dockit_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_message_threads" ADD CONSTRAINT "dockit_message_threads_marina_id_dockit_marinas_id_fk" FOREIGN KEY ("marina_id") REFERENCES "public"."dockit_marinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_message_threads" ADD CONSTRAINT "dockit_message_threads_customer_id_dockit_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."dockit_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_message_threads" ADD CONSTRAINT "dockit_message_threads_assigned_to_id_dockit_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."dockit_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_message_threads" ADD CONSTRAINT "dockit_message_threads_related_reservation_id_dockit_reservations_id_fk" FOREIGN KEY ("related_reservation_id") REFERENCES "public"."dockit_reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_message_threads" ADD CONSTRAINT "dockit_message_threads_related_lease_id_dockit_leases_id_fk" FOREIGN KEY ("related_lease_id") REFERENCES "public"."dockit_leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_messages" ADD CONSTRAINT "dockit_messages_thread_id_dockit_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."dockit_message_threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_notification_preferences" ADD CONSTRAINT "dockit_notification_preferences_user_id_dockit_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."dockit_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_notifications" ADD CONSTRAINT "dockit_notifications_user_id_dockit_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."dockit_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_notifications" ADD CONSTRAINT "dockit_notifications_marina_id_dockit_marinas_id_fk" FOREIGN KEY ("marina_id") REFERENCES "public"."dockit_marinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_payments" ADD CONSTRAINT "dockit_payments_marina_id_dockit_marinas_id_fk" FOREIGN KEY ("marina_id") REFERENCES "public"."dockit_marinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_payments" ADD CONSTRAINT "dockit_payments_customer_id_dockit_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."dockit_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_payments" ADD CONSTRAINT "dockit_payments_lease_id_dockit_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."dockit_leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_pricing_rules" ADD CONSTRAINT "dockit_pricing_rules_marina_id_dockit_marinas_id_fk" FOREIGN KEY ("marina_id") REFERENCES "public"."dockit_marinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_reservations" ADD CONSTRAINT "dockit_reservations_marina_id_dockit_marinas_id_fk" FOREIGN KEY ("marina_id") REFERENCES "public"."dockit_marinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_reservations" ADD CONSTRAINT "dockit_reservations_customer_id_dockit_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."dockit_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_reservations" ADD CONSTRAINT "dockit_reservations_boat_id_dockit_boats_id_fk" FOREIGN KEY ("boat_id") REFERENCES "public"."dockit_boats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_reservations" ADD CONSTRAINT "dockit_reservations_slip_id_dockit_slips_id_fk" FOREIGN KEY ("slip_id") REFERENCES "public"."dockit_slips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_slip_pricing" ADD CONSTRAINT "dockit_slip_pricing_slip_id_dockit_slips_id_fk" FOREIGN KEY ("slip_id") REFERENCES "public"."dockit_slips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_slips" ADD CONSTRAINT "dockit_slips_marina_id_dockit_marinas_id_fk" FOREIGN KEY ("marina_id") REFERENCES "public"."dockit_marinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_slips" ADD CONSTRAINT "dockit_slips_current_boat_id_dockit_boats_id_fk" FOREIGN KEY ("current_boat_id") REFERENCES "public"."dockit_boats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_user_marina_roles" ADD CONSTRAINT "dockit_user_marina_roles_user_id_dockit_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."dockit_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_user_marina_roles" ADD CONSTRAINT "dockit_user_marina_roles_marina_id_dockit_marinas_id_fk" FOREIGN KEY ("marina_id") REFERENCES "public"."dockit_marinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_users" ADD CONSTRAINT "dockit_users_organization_id_dockit_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."dockit_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_waitlist" ADD CONSTRAINT "dockit_waitlist_marina_id_dockit_marinas_id_fk" FOREIGN KEY ("marina_id") REFERENCES "public"."dockit_marinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_waitlist" ADD CONSTRAINT "dockit_waitlist_customer_id_dockit_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."dockit_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_waitlist" ADD CONSTRAINT "dockit_waitlist_boat_id_dockit_boats_id_fk" FOREIGN KEY ("boat_id") REFERENCES "public"."dockit_boats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_webhook_deliveries" ADD CONSTRAINT "dockit_webhook_deliveries_webhook_id_dockit_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."dockit_webhooks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_webhooks" ADD CONSTRAINT "dockit_webhooks_organization_id_dockit_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."dockit_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dockit_webhooks" ADD CONSTRAINT "dockit_webhooks_marina_id_dockit_marinas_id_fk" FOREIGN KEY ("marina_id") REFERENCES "public"."dockit_marinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_dockit_session_expire" ON "dockit_sessions" USING btree ("expire");--> statement-breakpoint
CREATE UNIQUE INDEX "slips_marina_number_unique" ON "dockit_slips" USING btree ("marina_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "user_marina_roles_unique" ON "dockit_user_marina_roles" USING btree ("user_id","marina_id");