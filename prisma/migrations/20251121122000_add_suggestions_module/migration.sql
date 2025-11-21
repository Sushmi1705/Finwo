-- CreateTable
CREATE TABLE "suggestion_sections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "image_url" TEXT,
    "type" TEXT NOT NULL,
    "main_category_id" TEXT,
    "config" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "suggestion_sections_main_category_id_fkey" FOREIGN KEY ("main_category_id") REFERENCES "main_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "suggestion_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "section_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "image_url" TEXT,
    "shop_id" TEXT,
    "main_category_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "suggestion_items_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "suggestion_sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "suggestion_items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "suggestion_items_main_category_id_fkey" FOREIGN KEY ("main_category_id") REFERENCES "main_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "suggestion_sections_type_idx" ON "suggestion_sections"("type");

-- CreateIndex
CREATE INDEX "suggestion_sections_is_active_sort_order_idx" ON "suggestion_sections"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "suggestion_items_section_id_idx" ON "suggestion_items"("section_id");
