-- CreateTable
CREATE TABLE "indicative_valuation_components" (
    "id"           SERIAL          NOT NULL,
    "valuation_id" INTEGER         NOT NULL,
    "description"  VARCHAR(100)    NOT NULL,
    "area"         DECIMAL(18, 4)  NOT NULL,
    "unit"         VARCHAR(20)     NOT NULL DEFAULT 'sqm',
    "min_rate"     DECIMAL(18, 4)  NOT NULL,
    "max_rate"     DECIMAL(18, 4)  NOT NULL,
    "min_value"    DECIMAL(18, 2)  NOT NULL,
    "max_value"    DECIMAL(18, 2)  NOT NULL,
    "created_at"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3)    NOT NULL,

    CONSTRAINT "indicative_valuation_components_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "indicative_valuation_components_valuation_id_idx"
    ON "indicative_valuation_components"("valuation_id");

-- AddForeignKey
ALTER TABLE "indicative_valuation_components"
    ADD CONSTRAINT "indicative_valuation_components_valuation_id_fkey"
    FOREIGN KEY ("valuation_id")
    REFERENCES "property_valuations"("valuation_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
