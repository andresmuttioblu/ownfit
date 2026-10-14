CREATE TYPE "public"."outfit_event_kind" AS ENUM('wore', 'like', 'dislike');--> statement-breakpoint
CREATE TABLE "outfit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "outfit_event_kind" NOT NULL,
	"garment_ids" uuid[] NOT NULL,
	"activity" text NOT NULL,
	"local_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "garments" ADD COLUMN "not_today_on" date;--> statement-breakpoint
ALTER TABLE "outfit_events" ADD CONSTRAINT "outfit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outfit_events_user_date" ON "outfit_events" USING btree ("user_id","local_date");