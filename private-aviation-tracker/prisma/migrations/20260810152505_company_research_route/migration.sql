-- CreateEnum
CREATE TYPE "FleetRole" AS ENUM ('REGISTERED_OWNER', 'BENEFICIAL_OWNER', 'OPERATOR', 'MANAGEMENT_COMPANY', 'CHARTER_OPERATOR', 'ASSOCIATED');

-- CreateEnum
CREATE TYPE "Verification" AS ENUM ('CONFIRMED', 'REPORTED', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "ResearchKind" AS ENUM ('NEWS', 'FORUM', 'COMPANY_WEBSITE', 'OFFICIAL_REGISTRY', 'AVIATION_DATABASE', 'OTHER');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('AIRCRAFT', 'COMPANY');

-- CreateEnum
CREATE TYPE "RouteSource" AS ENUM ('FLIGHT_DATA', 'OBSERVED', 'TRAJECTORY_ESTIMATE');

-- AlterTable
ALTER TABLE "FlightLeg" ADD COLUMN     "destinationConfidence" INTEGER,
ADD COLUMN     "destinationEta" TIMESTAMP(3),
ADD COLUMN     "destinationIcao" TEXT,
ADD COLUMN     "destinationLat" DOUBLE PRECISION,
ADD COLUMN     "destinationLon" DOUBLE PRECISION,
ADD COLUMN     "destinationName" TEXT,
ADD COLUMN     "destinationSource" "RouteSource",
ADD COLUMN     "destinationUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "matchKey" TEXT NOT NULL,
    "website" TEXT,
    "country" TEXT,
    "summary" TEXT,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "researchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAircraft" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "aircraftId" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "role" "FleetRole" NOT NULL,
    "source" TEXT,
    "sourceUrl" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "CompanyAircraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchItem" (
    "id" TEXT NOT NULL,
    "subjectType" "SubjectType" NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "snippet" TEXT,
    "kind" "ResearchKind" NOT NULL DEFAULT 'OTHER',
    "verification" "Verification" NOT NULL DEFAULT 'UNVERIFIED',
    "publishedAt" TIMESTAMP(3),
    "provider" TEXT,
    "query" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AircraftPhotoRecord" (
    "id" TEXT NOT NULL,
    "aircraftId" TEXT,
    "registration" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "credit" TEXT,
    "link" TEXT,
    "source" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AircraftPhotoRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Company_matchKey_idx" ON "Company"("matchKey");

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "Company"("name");

-- CreateIndex
CREATE INDEX "CompanyAircraft_registration_idx" ON "CompanyAircraft"("registration");

-- CreateIndex
CREATE INDEX "CompanyAircraft_companyId_idx" ON "CompanyAircraft"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAircraft_companyId_registration_role_key" ON "CompanyAircraft"("companyId", "registration", "role");

-- CreateIndex
CREATE INDEX "ResearchItem_subjectType_subjectKey_publishedAt_idx" ON "ResearchItem"("subjectType", "subjectKey", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchItem_subjectType_subjectKey_url_key" ON "ResearchItem"("subjectType", "subjectKey", "url");

-- CreateIndex
CREATE INDEX "AircraftPhotoRecord_registration_rank_idx" ON "AircraftPhotoRecord"("registration", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "AircraftPhotoRecord_registration_url_key" ON "AircraftPhotoRecord"("registration", "url");

-- AddForeignKey
ALTER TABLE "CompanyAircraft" ADD CONSTRAINT "CompanyAircraft_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAircraft" ADD CONSTRAINT "CompanyAircraft_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "Aircraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AircraftPhotoRecord" ADD CONSTRAINT "AircraftPhotoRecord_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "Aircraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
