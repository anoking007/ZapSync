/*
  Warnings:

  - Made the column `metadata` on table `Action` required. This step will fail if there are existing NULL values in that column.
  - Made the column `metadata` on table `Trigger` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Action" ALTER COLUMN "metadata" SET NOT NULL,
ALTER COLUMN "metadata" SET DEFAULT '{}';

-- AlterTable
ALTER TABLE "Trigger" ALTER COLUMN "metadata" SET NOT NULL,
ALTER COLUMN "metadata" SET DEFAULT '{}';
