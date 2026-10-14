ALTER TABLE "users" ADD COLUMN "conventions" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "style_profile" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "activities" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarded_at" timestamp with time zone;