-- CreateEnum
CREATE TYPE "public"."PropertyStatus" AS ENUM ('active', 'sold', 'rented', 'inactive');

-- CreateEnum
CREATE TYPE "public"."TitleTypeEnum" AS ENUM ('Hard_Title', 'Soft_Title', 'LMAP', 'Strata_Title');

-- CreateEnum
CREATE TYPE "public"."SourceTypeEnum" AS ENUM ('Owner', 'AgencyOrBroker', 'Authority');

-- CreateEnum
CREATE TYPE "public"."LandShapeEnum" AS ENUM ('Rectangle', 'Square', 'Triangle', 'Irregular');

-- CreateEnum
CREATE TYPE "public"."TopographyEnum" AS ENUM ('Level', 'Unlevel', 'Unfilled');

-- CreateEnum
CREATE TYPE "public"."SitePositionEnum" AS ENUM ('Intermediate', 'Corner', 'End');

-- CreateEnum
CREATE TYPE "public"."BuildingStatusEnum" AS ENUM ('Existing', 'Under_Construction');

-- CreateTable
CREATE TABLE "public"."properties" (
    "property_id" SERIAL NOT NULL,
    "property_type_id" INTEGER NOT NULL,
    "property_code" VARCHAR(50) NOT NULL,
    "status" "public"."PropertyStatus" NOT NULL DEFAULT 'active',
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("property_id")
);

-- CreateTable
CREATE TABLE "public"."record_types" (
    "record_type_id" SERIAL NOT NULL,
    "record_name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "record_types_pkey" PRIMARY KEY ("record_type_id")
);

-- CreateTable
CREATE TABLE "public"."property_types" (
    "property_type_id" SERIAL NOT NULL,
    "record_type_id" INTEGER NOT NULL,
    "property_name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_types_pkey" PRIMARY KEY ("property_type_id")
);

-- CreateTable
CREATE TABLE "public"."building_subtypes" (
    "subtype_id" SERIAL NOT NULL,
    "property_type_id" INTEGER NOT NULL,
    "subtype_name" VARCHAR(100) NOT NULL,

    CONSTRAINT "building_subtypes_pkey" PRIMARY KEY ("subtype_id")
);

-- CreateTable
CREATE TABLE "public"."title_documents" (
    "title_id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "title_deed_type" "public"."TitleTypeEnum" NOT NULL,
    "title_deed_no" VARCHAR(100),
    "issued_year" VARCHAR(50),
    "parcel_no" VARCHAR(100),
    "total_size_by_title_deed" DECIMAL(12,2),
    "stamp_date" DATE,
    "cover_photo_url" VARCHAR(500),
    "back_side_photo_url" VARCHAR(500),
    "other_photo_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "title_documents_pkey" PRIMARY KEY ("title_id")
);

-- CreateTable
CREATE TABLE "public"."data_sources" (
    "data_source_id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "source_type" "public"."SourceTypeEnum" NOT NULL,
    "contact_name" VARCHAR(255),
    "phone_number" VARCHAR(50),
    "created_by" INTEGER NOT NULL,
    "update_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("data_source_id")
);

-- CreateTable
CREATE TABLE "public"."property_photos" (
    "property_id" INTEGER NOT NULL,
    "front_side" VARCHAR(255),
    "inside" VARCHAR(255),
    "left_side" VARCHAR(255),
    "right_side" VARCHAR(255),
    "opposite" VARCHAR(255),
    "gallery" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_photos_pkey" PRIMARY KEY ("property_id")
);

-- CreateTable
CREATE TABLE "public"."building_details" (
    "building_id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "building_subtype_id" INTEGER NOT NULL,
    "width" DECIMAL(10,2),
    "length" DECIMAL(10,2),
    "number_of_storeys" INTEGER,
    "gross_floor_area_sqm" DECIMAL(12,2),
    "construction_year" INTEGER,
    "percentage_of_construction" INTEGER,
    "status" "public"."BuildingStatusEnum",
    "photos" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "building_details_pkey" PRIMARY KEY ("building_id")
);

-- CreateTable
CREATE TABLE "public"."provinces" (
    "province_id" SERIAL NOT NULL,
    "province_name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provinces_pkey" PRIMARY KEY ("province_id")
);

-- CreateTable
CREATE TABLE "public"."districts" (
    "district_id" SERIAL NOT NULL,
    "province_id" INTEGER NOT NULL,
    "district_name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("district_id")
);

-- CreateTable
CREATE TABLE "public"."communes" (
    "commune_id" SERIAL NOT NULL,
    "district_id" INTEGER NOT NULL,
    "commune_name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communes_pkey" PRIMARY KEY ("commune_id")
);

-- CreateTable
CREATE TABLE "public"."villages" (
    "village_id" SERIAL NOT NULL,
    "commune_id" INTEGER NOT NULL,
    "village_name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "villages_pkey" PRIMARY KEY ("village_id")
);

-- CreateTable
CREATE TABLE "public"."property_address" (
    "address_id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "village_id" INTEGER NOT NULL,
    "street" VARCHAR(150),
    "house_no" VARCHAR(50),
    "title_address" VARCHAR(255),
    "access_roads" TEXT,
    "neighbor_location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_address_pkey" PRIMARY KEY ("address_id")
);

-- CreateTable
CREATE TABLE "public"."property_locations" (
    "location_id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "google_point" TEXT,
    "geolocation_link" VARCHAR(500),
    "polygon" TEXT,
    "srid" INTEGER DEFAULT 4326,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_locations_pkey" PRIMARY KEY ("location_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "properties_property_code_key" ON "public"."properties"("property_code");

-- CreateIndex
CREATE UNIQUE INDEX "building_subtypes_property_type_id_subtype_name_key" ON "public"."building_subtypes"("property_type_id", "subtype_name");

-- CreateIndex
CREATE UNIQUE INDEX "title_documents_property_id_key" ON "public"."title_documents"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "title_documents_title_deed_no_key" ON "public"."title_documents"("title_deed_no");

-- CreateIndex
CREATE UNIQUE INDEX "data_sources_property_id_key" ON "public"."data_sources"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "building_details_property_id_key" ON "public"."building_details"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "provinces_province_name_key" ON "public"."provinces"("province_name");

-- CreateIndex
CREATE UNIQUE INDEX "property_address_property_id_key" ON "public"."property_address"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "property_locations_property_id_key" ON "public"."property_locations"("property_id");

-- AddForeignKey
ALTER TABLE "public"."properties" ADD CONSTRAINT "properties_property_type_id_fkey" FOREIGN KEY ("property_type_id") REFERENCES "public"."property_types"("property_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."properties" ADD CONSTRAINT "properties_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."properties" ADD CONSTRAINT "properties_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_types" ADD CONSTRAINT "property_types_record_type_id_fkey" FOREIGN KEY ("record_type_id") REFERENCES "public"."record_types"("record_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."building_subtypes" ADD CONSTRAINT "building_subtypes_property_type_id_fkey" FOREIGN KEY ("property_type_id") REFERENCES "public"."property_types"("property_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."title_documents" ADD CONSTRAINT "title_documents_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."data_sources" ADD CONSTRAINT "data_sources_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_photos" ADD CONSTRAINT "property_photos_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."building_details" ADD CONSTRAINT "building_details_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."building_details" ADD CONSTRAINT "building_details_building_subtype_id_fkey" FOREIGN KEY ("building_subtype_id") REFERENCES "public"."building_subtypes"("subtype_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."districts" ADD CONSTRAINT "districts_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("province_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."communes" ADD CONSTRAINT "communes_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("district_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."villages" ADD CONSTRAINT "villages_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "public"."communes"("commune_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_address" ADD CONSTRAINT "property_address_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_address" ADD CONSTRAINT "property_address_village_id_fkey" FOREIGN KEY ("village_id") REFERENCES "public"."villages"("village_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_locations" ADD CONSTRAINT "property_locations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE RESTRICT ON UPDATE CASCADE;
