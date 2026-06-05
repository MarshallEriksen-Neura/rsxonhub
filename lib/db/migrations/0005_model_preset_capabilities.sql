ALTER TABLE "ai_model_presets" ADD COLUMN IF NOT EXISTS "supports_chat" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_model_presets" ADD COLUMN IF NOT EXISTS "supports_embedding" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "ai_model_presets" SET
  "supports_chat" = "kind" = 'chat',
  "supports_embedding" = "kind" = 'embedding';
