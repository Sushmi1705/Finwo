-- CreateTable
CREATE TABLE "app_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_menus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "description" TEXT,
    "price" REAL NOT NULL,
    "quantity" INTEGER,
    "image_url" TEXT,
    "category_name" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "isQuickSnack" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "menus_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_menus" ("category_name", "description", "id", "image_url", "is_available", "item_name", "price", "quantity", "shop_id") SELECT "category_name", "description", "id", "image_url", "is_available", "item_name", "price", "quantity", "shop_id" FROM "menus";
DROP TABLE "menus";
ALTER TABLE "new_menus" RENAME TO "menus";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "app_config_key_key" ON "app_config"("key");
