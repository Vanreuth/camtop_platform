-- AlterTable
ALTER TABLE "public"."accounts" ALTER COLUMN "refresh_token" SET DATA TYPE TEXT,
ALTER COLUMN "access_token" SET DATA TYPE TEXT,
ALTER COLUMN "id_token" SET DATA TYPE TEXT,
ALTER COLUMN "session_state" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "public"."users" ALTER COLUMN "profilePicture" SET DATA TYPE TEXT;
