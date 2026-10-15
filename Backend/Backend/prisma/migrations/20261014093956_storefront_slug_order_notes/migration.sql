-- Contract v2: public restaurant slug (storefront URLs) and order-level notes.
-- Existing restaurants get a slug backfilled: the demo restaurant r-001 becomes "spice-route", others use their id.
-- AlterTable
ALTER TABLE "Order" ADD COLUMN "notes" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Restaurant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branches" JSONB NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'Free',
    "nextOrderNo" INTEGER NOT NULL DEFAULT 1001
);
INSERT INTO "new_Restaurant" ("branches", "id", "slug", "name", "nextOrderNo", "plan") SELECT "branches", "id", CASE WHEN "id" = 'r-001' THEN 'spice-route' ELSE "id" END, "name", "nextOrderNo", "plan" FROM "Restaurant";
DROP TABLE "Restaurant";
ALTER TABLE "new_Restaurant" RENAME TO "Restaurant";
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
