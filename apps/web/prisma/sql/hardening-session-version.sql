-- Required for existing databases before deploying the signed-session version
-- check (sign-out / privilege-change revocation). Fresh databases get the column
-- from prisma/sql/init.sql.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;
