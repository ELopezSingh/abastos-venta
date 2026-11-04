/*
  Warnings:

  - The primary key for the `manifiesto_detalle` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ticket_detalle` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `tickets` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `trailers` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[folio]` on the table `tickets` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `id` on the `manifiesto_detalle` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `trailer_id` on the `manifiesto_detalle` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `ticket_detalle` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `ticket_id` on the `ticket_detalle` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `manifiesto_detalle_id` on the `ticket_detalle` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `folio` to the `tickets` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `tickets` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `trailers` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
-- IDs enteros → UUID, folio de ticket y registro de operaciones de sincronización.
-- Escrita a mano para conservar los datos existentes. NO regenerar con Prisma.
BEGIN;

-- 1. Columna UUID nueva en cada tabla (cada fila recibe un valor distinto)
ALTER TABLE "trailers"           ADD COLUMN "uuid" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "manifiesto_detalle" ADD COLUMN "uuid" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "tickets"            ADD COLUMN "uuid" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "ticket_detalle"     ADD COLUMN "uuid" UUID NOT NULL DEFAULT gen_random_uuid();

-- 2. Folio: los tickets existentes conservan su número actual
ALTER TABLE "tickets" ADD COLUMN "folio" INTEGER;
UPDATE "tickets" SET "folio" = "id";
ALTER TABLE "tickets" ALTER COLUMN "folio" SET NOT NULL;

-- 3. Foráneas nuevas, llenadas a partir de las viejas
ALTER TABLE "manifiesto_detalle" ADD COLUMN "trailer_uuid" UUID;
UPDATE "manifiesto_detalle" m
   SET "trailer_uuid" = t."uuid"
  FROM "trailers" t
 WHERE m."trailer_id" = t."id";

ALTER TABLE "ticket_detalle"
  ADD COLUMN "ticket_uuid" UUID,
  ADD COLUMN "manifiesto_detalle_uuid" UUID;
UPDATE "ticket_detalle" d
   SET "ticket_uuid" = t."uuid"
  FROM "tickets" t
 WHERE d."ticket_id" = t."id";
UPDATE "ticket_detalle" d
   SET "manifiesto_detalle_uuid" = m."uuid"
  FROM "manifiesto_detalle" m
 WHERE d."manifiesto_detalle_id" = m."id";

-- Si alguna quedó vacía, la migración falla aquí y no se pierde nada
ALTER TABLE "manifiesto_detalle" ALTER COLUMN "trailer_uuid" SET NOT NULL;
ALTER TABLE "ticket_detalle"
  ALTER COLUMN "ticket_uuid" SET NOT NULL,
  ALTER COLUMN "manifiesto_detalle_uuid" SET NOT NULL;

-- 4. Quitar columnas viejas: primero las hijas (se llevan sus FK e índices),
--    luego las llaves primarias (se llevan su secuencia)
ALTER TABLE "ticket_detalle"
  DROP COLUMN "ticket_id",
  DROP COLUMN "manifiesto_detalle_id",
  DROP COLUMN "id";
ALTER TABLE "manifiesto_detalle"
  DROP COLUMN "trailer_id",
  DROP COLUMN "id";
ALTER TABLE "tickets"  DROP COLUMN "id";
ALTER TABLE "trailers" DROP COLUMN "id";

-- 5. Renombrar y declarar llaves primarias (sin default en BD: el id lo pone la app)
ALTER TABLE "trailers" RENAME COLUMN "uuid" TO "id";
ALTER TABLE "trailers" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "trailers" ADD CONSTRAINT "trailers_pkey" PRIMARY KEY ("id");

ALTER TABLE "manifiesto_detalle" RENAME COLUMN "uuid" TO "id";
ALTER TABLE "manifiesto_detalle" RENAME COLUMN "trailer_uuid" TO "trailer_id";
ALTER TABLE "manifiesto_detalle" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "manifiesto_detalle" ADD CONSTRAINT "manifiesto_detalle_pkey" PRIMARY KEY ("id");

ALTER TABLE "tickets" RENAME COLUMN "uuid" TO "id";
ALTER TABLE "tickets" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");

ALTER TABLE "ticket_detalle" RENAME COLUMN "uuid" TO "id";
ALTER TABLE "ticket_detalle" RENAME COLUMN "ticket_uuid" TO "ticket_id";
ALTER TABLE "ticket_detalle" RENAME COLUMN "manifiesto_detalle_uuid" TO "manifiesto_detalle_id";
ALTER TABLE "ticket_detalle" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "ticket_detalle" ADD CONSTRAINT "ticket_detalle_pkey" PRIMARY KEY ("id");

-- 6. Foráneas e índices, con los nombres que Prisma espera
ALTER TABLE "manifiesto_detalle" ADD CONSTRAINT "manifiesto_detalle_trailer_id_fkey"
  FOREIGN KEY ("trailer_id") REFERENCES "trailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_detalle" ADD CONSTRAINT "ticket_detalle_ticket_id_fkey"
  FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_detalle" ADD CONSTRAINT "ticket_detalle_manifiesto_detalle_id_fkey"
  FOREIGN KEY ("manifiesto_detalle_id") REFERENCES "manifiesto_detalle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "manifiesto_detalle_trailer_id_idx" ON "manifiesto_detalle"("trailer_id");
CREATE INDEX "ticket_detalle_ticket_id_idx" ON "ticket_detalle"("ticket_id");
CREATE INDEX "ticket_detalle_manifiesto_detalle_id_idx" ON "ticket_detalle"("manifiesto_detalle_id");
CREATE UNIQUE INDEX "tickets_folio_key" ON "tickets"("folio");

-- 7. Registro de operaciones de sincronización
CREATE TABLE "operaciones_sync" (
  "id"          UUID         NOT NULL,
  "seq"         BIGSERIAL    NOT NULL,
  "tipo"        TEXT         NOT NULL,
  "datos"       JSONB        NOT NULL,
  "creada_en"   TIMESTAMP(3) NOT NULL,
  "aplicada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operaciones_sync_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "operaciones_sync_seq_key" ON "operaciones_sync"("seq");

COMMIT;
