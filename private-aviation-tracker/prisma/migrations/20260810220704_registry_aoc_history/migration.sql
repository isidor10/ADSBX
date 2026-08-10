-- CreateTable
CREATE TABLE "RegistryRecord" (
    "id" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "aircraftType" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "yearBuilt" INTEGER,
    "registeredHolder" TEXT,
    "holderAddress" TEXT,
    "operator" TEXT,
    "status" TEXT,
    "sourceUrl" TEXT,
    "sourceKind" TEXT NOT NULL DEFAULT 'dcv_import',
    "confidence" INTEGER NOT NULL DEFAULT 95,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB,

    CONSTRAINT "RegistryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AocRecord" (
    "id" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "matchKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aocNumber" TEXT,
    "operationType" TEXT,
    "operatingLicence" TEXT,
    "principalPlace" TEXT,
    "status" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "sourceKind" TEXT NOT NULL DEFAULT 'dcv_import',
    "confidence" INTEGER NOT NULL DEFAULT 95,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB,

    CONSTRAINT "AocRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalRole" (
    "id" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3),
    "toDate" TIMESTAMP(3),
    "current" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricalRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistryRecord_registration_idx" ON "RegistryRecord"("registration");

-- CreateIndex
CREATE INDEX "RegistryRecord_operator_idx" ON "RegistryRecord"("operator");

-- CreateIndex
CREATE UNIQUE INDEX "RegistryRecord_authority_registration_key" ON "RegistryRecord"("authority", "registration");

-- CreateIndex
CREATE INDEX "AocRecord_matchKey_idx" ON "AocRecord"("matchKey");

-- CreateIndex
CREATE INDEX "AocRecord_name_idx" ON "AocRecord"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AocRecord_authority_matchKey_key" ON "AocRecord"("authority", "matchKey");

-- CreateIndex
CREATE INDEX "HistoricalRole_registration_role_idx" ON "HistoricalRole"("registration", "role");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalRole_registration_role_name_fromDate_key" ON "HistoricalRole"("registration", "role", "name", "fromDate");
