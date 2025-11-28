-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "review_notifications" BOOLEAN NOT NULL DEFAULT true,
    "payment_notifications" BOOLEAN NOT NULL DEFAULT true,
    "dark_mode" BOOLEAN NOT NULL DEFAULT false,
    "app_language" TEXT NOT NULL DEFAULT 'en',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_settings" ("app_language", "created_at", "dark_mode", "id", "notifications_enabled", "user_id") SELECT "app_language", "created_at", "dark_mode", "id", "notifications_enabled", "user_id" FROM "settings";
DROP TABLE "settings";
ALTER TABLE "new_settings" RENAME TO "settings";
CREATE UNIQUE INDEX "settings_user_id_key" ON "settings"("user_id");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "mobile" TEXT NOT NULL,
    "password" TEXT,
    "otp_code" TEXT,
    "security_pin" TEXT,
    "profile_image_url" TEXT,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" DATETIME,
    "phoneAuthEnabled" BOOLEAN NOT NULL DEFAULT false,
    "upi_id" TEXT,
    "security_pin_hash" TEXT,
    "security_pin_set" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_users" ("created_at", "email", "id", "is_admin", "last_login", "mobile", "name", "otp_code", "password", "phoneAuthEnabled", "profile_image_url", "security_pin", "status") SELECT "created_at", "email", "id", "is_admin", "last_login", "mobile", "name", "otp_code", "password", "phoneAuthEnabled", "profile_image_url", "security_pin", "status" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_mobile_key" ON "users"("mobile");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
