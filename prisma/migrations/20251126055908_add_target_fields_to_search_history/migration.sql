/*
  Warnings:

  - A unique constraint covering the columns `[category_name]` on the table `main_categories` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "app_ui_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "screen_name" TEXT NOT NULL,
    "component_type" TEXT NOT NULL,
    "component_name" TEXT NOT NULL,
    "behaviour" TEXT NOT NULL DEFAULT 'STATIC',
    "icon_url" TEXT,
    "image_url" TEXT,
    "location" TEXT,
    "main_category_id" TEXT,
    "config" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "app_ui_config_main_category_id_fkey" FOREIGN KEY ("main_category_id") REFERENCES "main_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "app_ui_config_screen_name_component_type_is_active_idx" ON "app_ui_config"("screen_name", "component_type", "is_active");

-- CreateIndex
CREATE INDEX "app_ui_config_location_idx" ON "app_ui_config"("location");

-- CreateIndex
CREATE INDEX "app_ui_config_sort_order_idx" ON "app_ui_config"("sort_order");

-- CreateIndex
CREATE INDEX "app_ui_config_main_category_id_idx" ON "app_ui_config"("main_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "main_categories_category_name_key" ON "main_categories"("category_name");
