-- CreateTable
CREATE TABLE "operaciones_rechazadas" (
    "id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 1,
    "primera_vez" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_vez" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operaciones_rechazadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estado_sync" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "ultimo_contacto" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estado_sync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operaciones_rechazadas_ultima_vez_idx" ON "operaciones_rechazadas"("ultima_vez");
