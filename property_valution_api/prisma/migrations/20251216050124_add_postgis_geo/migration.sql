-- CreateIndex
CREATE INDEX "communes_commune_name_en_idx" ON "public"."communes"("commune_name_en");

-- CreateIndex
CREATE INDEX "communes_commune_name_kh_idx" ON "public"."communes"("commune_name_kh");

-- CreateIndex
CREATE INDEX "communes_district_id_commune_name_en_idx" ON "public"."communes"("district_id", "commune_name_en");

-- CreateIndex
CREATE INDEX "districts_district_name_en_idx" ON "public"."districts"("district_name_en");

-- CreateIndex
CREATE INDEX "districts_district_name_kh_idx" ON "public"."districts"("district_name_kh");

-- CreateIndex
CREATE INDEX "districts_province_id_district_name_en_idx" ON "public"."districts"("province_id", "district_name_en");

-- CreateIndex
CREATE INDEX "property_address_province_id_district_id_idx" ON "public"."property_address"("province_id", "district_id");

-- CreateIndex
CREATE INDEX "property_address_province_id_district_id_commune_id_idx" ON "public"."property_address"("province_id", "district_id", "commune_id");

-- CreateIndex
CREATE INDEX "property_address_province_id_district_id_commune_id_village_idx" ON "public"."property_address"("province_id", "district_id", "commune_id", "village_id");

-- CreateIndex
CREATE INDEX "property_locations_latitude_longitude_idx" ON "public"."property_locations"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "property_locations_place_id_idx" ON "public"."property_locations"("place_id");

-- CreateIndex
CREATE INDEX "provinces_province_name_en_idx" ON "public"."provinces"("province_name_en");

-- CreateIndex
CREATE INDEX "provinces_province_name_kh_idx" ON "public"."provinces"("province_name_kh");

-- CreateIndex
CREATE INDEX "villages_village_name_en_idx" ON "public"."villages"("village_name_en");

-- CreateIndex
CREATE INDEX "villages_village_name_kh_idx" ON "public"."villages"("village_name_kh");

-- CreateIndex
CREATE INDEX "villages_commune_id_village_name_en_idx" ON "public"."villages"("commune_id", "village_name_en");
