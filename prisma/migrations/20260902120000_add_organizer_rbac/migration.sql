-- Additive RBAC migration. Existing ADMIN and DONOR values are preserved.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ORGANIZER_PENDING';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
