CREATE TYPE "public"."garment_source" AS ENUM('video', 'photo', 'single_add');--> statement-breakpoint
CREATE TYPE "public"."garment_status" AS ENUM('active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."retire_reason" AS ENUM('dislike', 'no_longer_owned', 'other');--> statement-breakpoint
CREATE TABLE "garments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"image_key" text NOT NULL,
	"source_image_key" text,
	"category" text NOT NULL,
	"subcategory" text NOT NULL,
	"colors" text[] NOT NULL,
	"pattern" text NOT NULL,
	"material" text NOT NULL,
	"formality" integer NOT NULL,
	"seasons" text[] NOT NULL,
	"warmth" integer NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "garment_status" DEFAULT 'active' NOT NULL,
	"source" "garment_source" NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"import_id" text,
	"import_item_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone,
	"retire_reason" "retire_reason"
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"age" integer,
	"style_preference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "garments" ADD CONSTRAINT "garments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "garments_import_item" ON "garments" USING btree ("import_id","import_item_id");