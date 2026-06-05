CREATE TABLE "digest_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"digest_date" text NOT NULL,
	"interest_profile_version" integer NOT NULL,
	"phase" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"job_id" text,
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "digest_runs_date_profile_phase_idx" ON "digest_runs" USING btree ("digest_date","interest_profile_version","phase");--> statement-breakpoint
CREATE INDEX "digest_runs_status_idx" ON "digest_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "digest_runs_created_idx" ON "digest_runs" USING btree ("created_at");