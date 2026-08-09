-- CreateEnum
CREATE TYPE "OwnershipStatus" AS ENUM ('PENDING', 'RESOLVED', 'NOT_FOUND', 'BLOCKED', 'ERROR');

-- CreateEnum
CREATE TYPE "OwnerKind" AS ENUM ('REGISTERED_OWNER', 'OPERATOR', 'MANAGEMENT_COMPANY', 'CHARTER_OPERATOR', 'TRUSTEE', 'BENEFICIAL_OWNER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FlightStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'STALE');

-- CreateTable
CREATE TABLE "Aircraft" (
    "id" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "icao24" TEXT,
    "typeCode" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "category" TEXT,
    "serialNumber" TEXT,
    "yearBuilt" INTEGER,
    "engineCount" INTEGER,
    "registryCountry" TEXT,
    "identitySource" TEXT,
    "photoUrl" TEXT,
    "photoCredit" TEXT,
    "photoLink" TEXT,
    "photoCheckedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Aircraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnershipRecord" (
    "id" TEXT NOT NULL,
    "aircraftId" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "owner" TEXT,
    "ownerKind" "OwnerKind" NOT NULL DEFAULT 'UNKNOWN',
    "operator" TEXT,
    "managementCompany" TEXT,
    "charterOperator" TEXT,
    "status" "OwnershipStatus" NOT NULL DEFAULT 'PENDING',
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "confidenceBand" TEXT NOT NULL DEFAULT 'none',
    "beneficialOwnerConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "evidence" TEXT,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "queries" JSONB NOT NULL DEFAULT '[]',
    "searchProvider" TEXT,
    "analyzer" TEXT,
    "errorMessage" TEXT,
    "searchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVerifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnershipRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "aircraftId" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "icao24" TEXT,
    "callsign" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "altBaroFt" INTEGER,
    "altGeomFt" INTEGER,
    "groundSpeedKt" DOUBLE PRECISION,
    "trackDeg" DOUBLE PRECISION,
    "verticalRateFpm" INTEGER,
    "squawk" TEXT,
    "onGround" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "seenAt" TIMESTAMP(3) NOT NULL,
    "flightLegId" TEXT,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightLeg" (
    "id" TEXT NOT NULL,
    "aircraftId" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "callsign" TEXT,
    "status" "FlightStatus" NOT NULL DEFAULT 'ACTIVE',
    "departureIcao" TEXT,
    "departureName" TEXT,
    "departureLat" DOUBLE PRECISION,
    "departureLon" DOUBLE PRECISION,
    "departedAt" TIMESTAMP(3),
    "arrivalIcao" TEXT,
    "arrivalName" TEXT,
    "arrivalLat" DOUBLE PRECISION,
    "arrivalLon" DOUBLE PRECISION,
    "arrivedAt" TIMESTAMP(3),
    "maxAltitudeFt" INTEGER,
    "maxGroundSpeedKt" DOUBLE PRECISION,
    "distanceNm" DOUBLE PRECISION,
    "durationSec" INTEGER,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlightLeg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaaRegistration" (
    "nNumber" TEXT NOT NULL,
    "serialNumber" TEXT,
    "mfrMdlCode" TEXT,
    "engMfrMdlCode" TEXT,
    "yearMfr" INTEGER,
    "registrantType" TEXT,
    "registrantName" TEXT,
    "street" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "lastActionDate" TIMESTAMP(3),
    "certIssueDate" TIMESTAMP(3),
    "statusCode" TEXT,
    "modeSHex" TEXT,
    "fractionalOwner" BOOLEAN NOT NULL DEFAULT false,
    "expirationDate" TIMESTAMP(3),
    "manufacturer" TEXT,
    "model" TEXT,
    "aircraftType" TEXT,
    "engineType" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaaRegistration_pkey" PRIMARY KEY ("nNumber")
);

-- CreateTable
CREATE TABLE "Airport" (
    "icao" TEXT NOT NULL,
    "iata" TEXT,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "country" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "elevationFt" INTEGER,
    "type" TEXT,

    CONSTRAINT "Airport_pkey" PRIMARY KEY ("icao")
);

-- CreateIndex
CREATE UNIQUE INDEX "Aircraft_registration_key" ON "Aircraft"("registration");

-- CreateIndex
CREATE UNIQUE INDEX "Aircraft_icao24_key" ON "Aircraft"("icao24");

-- CreateIndex
CREATE INDEX "Aircraft_typeCode_idx" ON "Aircraft"("typeCode");

-- CreateIndex
CREATE INDEX "Aircraft_category_idx" ON "Aircraft"("category");

-- CreateIndex
CREATE INDEX "Aircraft_lastSeenAt_idx" ON "Aircraft"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "OwnershipRecord_aircraftId_key" ON "OwnershipRecord"("aircraftId");

-- CreateIndex
CREATE UNIQUE INDEX "OwnershipRecord_registration_key" ON "OwnershipRecord"("registration");

-- CreateIndex
CREATE INDEX "OwnershipRecord_expiresAt_idx" ON "OwnershipRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "OwnershipRecord_owner_idx" ON "OwnershipRecord"("owner");

-- CreateIndex
CREATE INDEX "OwnershipRecord_operator_idx" ON "OwnershipRecord"("operator");

-- CreateIndex
CREATE INDEX "Position_registration_seenAt_idx" ON "Position"("registration", "seenAt");

-- CreateIndex
CREATE INDEX "Position_flightLegId_seenAt_idx" ON "Position"("flightLegId", "seenAt");

-- CreateIndex
CREATE INDEX "Position_seenAt_idx" ON "Position"("seenAt");

-- CreateIndex
CREATE INDEX "FlightLeg_registration_firstSeenAt_idx" ON "FlightLeg"("registration", "firstSeenAt");

-- CreateIndex
CREATE INDEX "FlightLeg_status_idx" ON "FlightLeg"("status");

-- CreateIndex
CREATE INDEX "FaaRegistration_registrantName_idx" ON "FaaRegistration"("registrantName");

-- CreateIndex
CREATE INDEX "FaaRegistration_modeSHex_idx" ON "FaaRegistration"("modeSHex");

-- CreateIndex
CREATE INDEX "Airport_iata_idx" ON "Airport"("iata");

-- CreateIndex
CREATE INDEX "Airport_lat_lon_idx" ON "Airport"("lat", "lon");

-- AddForeignKey
ALTER TABLE "OwnershipRecord" ADD CONSTRAINT "OwnershipRecord_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "Aircraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "Aircraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_flightLegId_fkey" FOREIGN KEY ("flightLegId") REFERENCES "FlightLeg"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightLeg" ADD CONSTRAINT "FlightLeg_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "Aircraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
