-- CreateEnum
CREATE TYPE "DoseStatus" AS ENUM ('TAKEN', 'DUPLICATE_WARNING', 'MANUAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoseLog" (
    "id" TEXT NOT NULL,
    "medicationName" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DoseStatus" NOT NULL DEFAULT 'TAKEN',
    "nfcTagId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "DoseLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "DoseLog_userId_timestamp_idx" ON "DoseLog"("userId", "timestamp");

-- AddForeignKey
ALTER TABLE "DoseLog" ADD CONSTRAINT "DoseLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
