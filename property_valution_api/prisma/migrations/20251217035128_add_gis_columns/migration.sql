-- AlterTable
ALTER TABLE "public"."communes" ADD COLUMN     "geom" geometry(MultiPolygon, 4326);

-- AlterTable
ALTER TABLE "public"."districts" ADD COLUMN     "geom" geometry(MultiPolygon, 4326);

-- AlterTable
ALTER TABLE "public"."provinces" ADD COLUMN     "geom" geometry(MultiPolygon, 4326);

-- AlterTable
ALTER TABLE "public"."villages" ADD COLUMN     "geom" geometry(MultiPolygon, 4326);

-- CreateIndex
CREATE INDEX "idx_communes_geom" ON "public"."communes" USING GIST ("geom");

-- CreateIndex
CREATE INDEX "idx_districts_geom" ON "public"."districts" USING GIST ("geom");

-- CreateIndex
CREATE INDEX "idx_provinces_geom" ON "public"."provinces" USING GIST ("geom");

-- CreateIndex
CREATE INDEX "idx_villages_geom" ON "public"."villages" USING GIST ("geom");
