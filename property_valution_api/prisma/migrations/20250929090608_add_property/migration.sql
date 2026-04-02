/*
  Simplified migration - avoid complex DO blocks
*/

-- Step 1: Drop dependent tables first
DROP TABLE IF EXISTS "public"."building_details" CASCADE;
DROP TABLE IF EXISTS "public"."building_subtypes" CASCADE;

-- Step 2: Drop old enum types
DROP TYPE IF EXISTS "public"."BuildingStatusEnum" CASCADE;
DROP TYPE IF EXISTS "public"."BuildingStatusEnum_old" CASCADE;
DROP TYPE IF EXISTS "public"."BuildingStatusEnum_new" CASCADE;

-- Step 3: Create new enums
CREATE TYPE "public"."TypeOfTreeEnum" AS ENUM ('MANGO', 'BANANA', 'RUBBER', 'CASHEW', 'PALM', 'PEPPER', 'LONGAN', 'RAMBUTAN', 'JACKFRUIT', 'OTHER');
CREATE TYPE "public"."WaterSourceEnum" AS ENUM ('CITY_WATER', 'WELL_WATER', 'RIVER_ACCESS', 'POND', 'NONE');
CREATE TYPE "public"."Physical_condition" AS ENUM ('MODERATE', 'WELL_MAINTENANCE', 'POOR_MAINTENANCE');
CREATE TYPE "public"."ManagementFee" AS ENUM ('ONE_DOLLAR_PER_SQM', 'TWO_DOLLAR_PER_SQM', 'THREE_DOLLAR_PER_SQM', 'FOUR_DOLLAR_PER_SQM', 'FIVE_DOLLAR_PER_SQM', 'FREE', 'NONE');
CREATE TYPE "public"."ViewType" AS ENUM ('CITY_VIEW', 'PARK_VIEW', 'RIVER_VIEW', 'MOUNTAIN_VIEW', 'NONE');
CREATE TYPE "public"."PercentageOfConstruction" AS ENUM ('TEN_PERCENT', 'TWENTY_PERCENT', 'THIRTY_PERCENT', 'FORTY_PERCENT', 'FIFTY_PERCENT', 'SIXTY_PERCENT', 'SEVENTY_PERCENT', 'EIGHTY_PERCENT', 'NINETY_PERCENT', 'FULLY_COMPLETED');
CREATE TYPE "public"."ConstructionStatus" AS ENUM ('EXISTING_CONSTRUCTION', 'UNDER_CONSTRUCTION', 'COMPLETED');

-- Step 4: Alter existing enums
-- PropertyStatus
ALTER TYPE "public"."PropertyStatus" RENAME TO "PropertyStatus_old";
CREATE TYPE "public"."PropertyStatus" AS ENUM ('ACTIVE', 'SOLD', 'RENTED', 'INACTIVE');
ALTER TABLE "public"."properties" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."properties" ALTER COLUMN "status" TYPE "public"."PropertyStatus" USING ("status"::text::"public"."PropertyStatus");
DROP TYPE "public"."PropertyStatus_old";
ALTER TABLE "public"."properties" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- SourceTypeEnum
ALTER TYPE "public"."SourceTypeEnum" RENAME TO "SourceTypeEnum_old";
CREATE TYPE "public"."SourceTypeEnum" AS ENUM ('OWNERSHIP', 'AGENCY', 'AUTHORITY', 'BANK', 'OTHER');
ALTER TABLE "public"."data_sources" ALTER COLUMN "source_type" TYPE "public"."SourceTypeEnum" USING (
    CASE 
        WHEN "source_type"::text = 'Owner' THEN 'OWNERSHIP'
        WHEN "source_type"::text = 'AgencyOrBroker' THEN 'AGENCY'
        WHEN "source_type"::text = 'Authority' THEN 'AUTHORITY'
        ELSE "source_type"::text
    END::"public"."SourceTypeEnum"
);
DROP TYPE "public"."SourceTypeEnum_old";

-- TitleTypeEnum
ALTER TYPE "public"."TitleTypeEnum" RENAME TO "TitleTypeEnum_old";
CREATE TYPE "public"."TitleTypeEnum" AS ENUM ('HARD', 'SOFT', 'LMAP', 'STRATA');
ALTER TABLE "public"."title_documents" ALTER COLUMN "title_deed_type" TYPE "public"."TitleTypeEnum" USING (
    CASE 
        WHEN "title_deed_type"::text = 'Hard_Title' THEN 'HARD'
        WHEN "title_deed_type"::text = 'Soft_Title' THEN 'SOFT'
        WHEN "title_deed_type"::text = 'Strata_Title' THEN 'STRATA'
        ELSE "title_deed_type"::text
    END::"public"."TitleTypeEnum"
);
DROP TYPE "public"."TitleTypeEnum_old";

-- Step 5: Create current_uses table first (needed for foreign key)
CREATE TABLE "public"."current_uses" (
    "use_id" SERIAL NOT NULL,
    "use_name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "current_uses_pkey" PRIMARY KEY ("use_id")
);

-- Insert a default use
INSERT INTO "public"."current_uses" ("use_id", "use_name", "updated_at")
VALUES (1, 'General Use', CURRENT_TIMESTAMP);

-- Step 6: Alter properties table
ALTER TABLE "public"."properties" 
ADD COLUMN "property_name" VARCHAR(255) DEFAULT 'Unnamed Property',
ADD COLUMN "use_id" INTEGER DEFAULT 1;

UPDATE "public"."properties" 
SET "property_name" = 'Unnamed Property',
    "use_id" = 1
WHERE "property_name" IS NULL OR "use_id" IS NULL;

ALTER TABLE "public"."properties" 
ALTER COLUMN "property_name" SET NOT NULL,
ALTER COLUMN "use_id" SET NOT NULL,
ALTER COLUMN "property_name" DROP DEFAULT,
ALTER COLUMN "use_id" DROP DEFAULT;

-- Step 7: Create other tables
CREATE TABLE "public"."construction_types" (
    "construction_type_id" SERIAL NOT NULL,
    "construction_name" VARCHAR(100) NOT NULL,
    "property_type_id" INTEGER NOT NULL,
    CONSTRAINT "construction_types_pkey" PRIMARY KEY ("construction_type_id"),
    CONSTRAINT "construction_types_property_type_id_construction_name_key" UNIQUE ("property_type_id", "construction_name")
);

CREATE TABLE "public"."property_type_current_uses" (
    "property_type_id" INTEGER NOT NULL,
    "use_id" INTEGER NOT NULL,
    CONSTRAINT "property_type_current_uses_pkey" PRIMARY KEY ("property_type_id","use_id")
);

CREATE TABLE "public"."lands" (
    "land_id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "width_meters" DECIMAL(10,2),
    "length_meters" DECIMAL(10,2),
    "land_area_sqm" DECIMAL(12,2),
    "landShape" "public"."LandShapeEnum",
    "topography" "public"."TopographyEnum",
    "sitePosition" "public"."SitePositionEnum",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lands_pkey" PRIMARY KEY ("land_id"),
    CONSTRAINT "lands_property_id_key" UNIQUE ("property_id")
);

CREATE TABLE "public"."agriculture_lands" (
    "agri_land_id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "typeofTree" "public"."TypeOfTreeEnum",
    "number_of_trees" INTEGER,
    "age_of_trees" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agriculture_lands_pkey" PRIMARY KEY ("agri_land_id"),
    CONSTRAINT "agriculture_lands_property_id_key" UNIQUE ("property_id")
);

CREATE TABLE "public"."building" (
    "building_id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "building_subtype_id" INTEGER NOT NULL,
    "construction_type_id" INTEGER NOT NULL,
    "width" DECIMAL(10,2),
    "length" DECIMAL(10,2),
    "number_of_storeys" INTEGER,
    "gross_area_sqm" DECIMAL(12,2),
    "construction_year" INTEGER,
    "percentageOfConstruction" "public"."PercentageOfConstruction",
    "status" "public"."ConstructionStatus",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "building_pkey" PRIMARY KEY ("building_id"),
    CONSTRAINT "building_property_id_key" UNIQUE ("property_id")
);

CREATE TABLE "public"."building_photos" (
    "id" SERIAL NOT NULL,
    "building_id" INTEGER NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "viewType" VARCHAR(50),
    "caption" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "building_photos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."building_units" (
    "building_unit_id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "construction_type_id" INTEGER NOT NULL,
    "unit_no" VARCHAR(50),
    "floor_no" INTEGER,
    "floor_area_sqm" DECIMAL(12,2),
    "physical_condition" "public"."Physical_condition",
    "managementFee" "public"."ManagementFee",
    "viewType" "public"."ViewType",
    "constructed_year" INTEGER,
    "number_of_bedrooms" INTEGER,
    "number_of_bathrooms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "building_units_pkey" PRIMARY KEY ("building_unit_id"),
    CONSTRAINT "building_units_property_id_key" UNIQUE ("property_id")
);

-- Step 8: Add foreign keys
ALTER TABLE "public"."properties" 
ADD CONSTRAINT "properties_use_id_fkey" 
FOREIGN KEY ("use_id") REFERENCES "public"."current_uses"("use_id") 
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."construction_types" 
ADD CONSTRAINT "construction_types_property_type_id_fkey" 
FOREIGN KEY ("property_type_id") REFERENCES "public"."property_types"("property_type_id") 
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."property_type_current_uses" 
ADD CONSTRAINT "property_type_current_uses_property_type_id_fkey" 
FOREIGN KEY ("property_type_id") REFERENCES "public"."property_types"("property_type_id") 
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."property_type_current_uses" 
ADD CONSTRAINT "property_type_current_uses_use_id_fkey" 
FOREIGN KEY ("use_id") REFERENCES "public"."current_uses"("use_id") 
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."building_photos" 
ADD CONSTRAINT "building_photos_building_id_fkey" 
FOREIGN KEY ("building_id") REFERENCES "public"."building"("building_id") 
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."lands" 
ADD CONSTRAINT "lands_property_id_fkey" 
FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") 
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."agriculture_lands" 
ADD CONSTRAINT "agriculture_lands_property_id_fkey" 
FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") 
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."building_units" 
ADD CONSTRAINT "building_units_property_id_fkey" 
FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") 
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."building_units" 
ADD CONSTRAINT "building_units_construction_type_id_fkey" 
FOREIGN KEY ("construction_type_id") REFERENCES "public"."construction_types"("construction_type_id") 
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."building" 
ADD CONSTRAINT "building_property_id_fkey" 
FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") 
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."building" 
ADD CONSTRAINT "building_construction_type_id_fkey" 
FOREIGN KEY ("construction_type_id") REFERENCES "public"."construction_types"("construction_type_id") 
ON DELETE RESTRICT ON UPDATE CASCADE;