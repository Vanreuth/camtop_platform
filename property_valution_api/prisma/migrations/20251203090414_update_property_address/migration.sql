/*
  Warnings:

  - The primary key for the `communes` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `commune_name` on the `communes` table. All the data in the column will be lost.
  - You are about to alter the column `commune_id` on the `communes` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `VarChar(10)`.
  - You are about to alter the column `district_id` on the `communes` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `VarChar(10)`.
  - The primary key for the `districts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `district_name` on the `districts` table. All the data in the column will be lost.
  - You are about to alter the column `district_id` on the `districts` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `VarChar(10)`.
  - You are about to alter the column `province_id` on the `districts` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `VarChar(10)`.
  - You are about to drop the column `village_name` on the `property_address` table. All the data in the column will be lost.
  - You are about to alter the column `commune_id` on the `property_address` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `VarChar(10)`.
  - You are about to alter the column `district_id` on the `property_address` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `VarChar(10)`.
  - You are about to alter the column `province_id` on the `property_address` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `VarChar(10)`.
  - The primary key for the `provinces` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `province_name` on the `provinces` table. All the data in the column will be lost.
  - You are about to alter the column `province_id` on the `provinces` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `VarChar(10)`.
  - Added the required column `commune_name_en` to the `communes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `commune_name_kh` to the `communes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `district_name_en` to the `districts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `district_name_kh` to the `districts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `village_id` to the `property_address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `province_name_en` to the `provinces` table without a default value. This is not possible if the table is not empty.
  - Added the required column `province_name_kh` to the `provinces` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."communes" DROP CONSTRAINT "communes_district_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."districts" DROP CONSTRAINT "districts_province_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."property_address" DROP CONSTRAINT "property_address_commune_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."property_address" DROP CONSTRAINT "property_address_district_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."property_address" DROP CONSTRAINT "property_address_province_id_fkey";

-- DropIndex
DROP INDEX "public"."provinces_province_name_key";

-- AlterTable
ALTER TABLE "public"."communes" DROP CONSTRAINT "communes_pkey",
DROP COLUMN "commune_name",
ADD COLUMN     "commune_name_en" VARCHAR(100) NOT NULL,
ADD COLUMN     "commune_name_kh" VARCHAR(100) NOT NULL,
ALTER COLUMN "commune_id" DROP DEFAULT,
ALTER COLUMN "commune_id" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "district_id" SET DATA TYPE VARCHAR(10),
ADD CONSTRAINT "communes_pkey" PRIMARY KEY ("commune_id");
DROP SEQUENCE "communes_commune_id_seq";

-- AlterTable
ALTER TABLE "public"."districts" DROP CONSTRAINT "districts_pkey",
DROP COLUMN "district_name",
ADD COLUMN     "district_name_en" VARCHAR(100) NOT NULL,
ADD COLUMN     "district_name_kh" VARCHAR(100) NOT NULL,
ALTER COLUMN "district_id" DROP DEFAULT,
ALTER COLUMN "district_id" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "province_id" SET DATA TYPE VARCHAR(10),
ADD CONSTRAINT "districts_pkey" PRIMARY KEY ("district_id");
DROP SEQUENCE "districts_district_id_seq";

-- AlterTable
ALTER TABLE "public"."property_address" DROP COLUMN "village_name",
ADD COLUMN     "village_id" VARCHAR(20) NOT NULL,
ALTER COLUMN "commune_id" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "district_id" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "province_id" SET DATA TYPE VARCHAR(10);

-- AlterTable
ALTER TABLE "public"."provinces" DROP CONSTRAINT "provinces_pkey",
DROP COLUMN "province_name",
ADD COLUMN     "province_name_en" VARCHAR(100) NOT NULL,
ADD COLUMN     "province_name_kh" VARCHAR(100) NOT NULL,
ALTER COLUMN "province_id" DROP DEFAULT,
ALTER COLUMN "province_id" SET DATA TYPE VARCHAR(10),
ADD CONSTRAINT "provinces_pkey" PRIMARY KEY ("province_id");
DROP SEQUENCE "provinces_province_id_seq";

-- CreateTable
CREATE TABLE "public"."villages" (
    "village_id" VARCHAR(20) NOT NULL,
    "commune_id" VARCHAR(10) NOT NULL,
    "village_name_kh" VARCHAR(100) NOT NULL,
    "village_name_en" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "villages_pkey" PRIMARY KEY ("village_id")
);

-- CreateIndex
CREATE INDEX "villages_commune_id_idx" ON "public"."villages"("commune_id");

-- AddForeignKey
ALTER TABLE "public"."districts" ADD CONSTRAINT "districts_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("province_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."communes" ADD CONSTRAINT "communes_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("district_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."villages" ADD CONSTRAINT "villages_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "public"."communes"("commune_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_address" ADD CONSTRAINT "property_address_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("province_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_address" ADD CONSTRAINT "property_address_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("district_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_address" ADD CONSTRAINT "property_address_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "public"."communes"("commune_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_address" ADD CONSTRAINT "property_address_village_id_fkey" FOREIGN KEY ("village_id") REFERENCES "public"."villages"("village_id") ON DELETE RESTRICT ON UPDATE CASCADE;
