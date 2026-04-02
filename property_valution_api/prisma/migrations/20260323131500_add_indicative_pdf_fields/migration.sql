ALTER TABLE "property_indicative_valuations"
ADD COLUMN "indicative_pdf_storage_key" VARCHAR(500),
ADD COLUMN "indicative_pdf_file_name" VARCHAR(255),
ADD COLUMN "indicative_pdf_mime_type" VARCHAR(100),
ADD COLUMN "indicative_pdf_file_size" INTEGER,
ADD COLUMN "indicative_pdf_generated_at" TIMESTAMP(3);
