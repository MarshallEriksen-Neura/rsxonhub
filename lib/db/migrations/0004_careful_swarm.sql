CREATE TABLE "ai_model_presets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"base_url" text NOT NULL,
	"model" text NOT NULL,
	"last_fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_model_presets_kind_base_model_idx" ON "ai_model_presets" USING btree ("kind","base_url","model");--> statement-breakpoint
CREATE INDEX "ai_model_presets_kind_base_idx" ON "ai_model_presets" USING btree ("kind","base_url");