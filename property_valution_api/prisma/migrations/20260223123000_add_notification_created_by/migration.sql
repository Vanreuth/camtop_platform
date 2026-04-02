ALTER TABLE "public"."notifications"
ADD COLUMN "created_by" INTEGER;

CREATE INDEX "notifications_created_by_idx"
ON "public"."notifications" ("created_by");

ALTER TABLE "public"."notifications"
ADD CONSTRAINT "notifications_created_by_fkey"
FOREIGN KEY ("created_by")
REFERENCES "public"."users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
