import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../generated/prisma/client.js';
import { env } from '../config/env.js';

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  // Sin esto, pg espera indefinidamente y el error llega tarde como ETIMEDOUT.
  connectionTimeoutMillis: 5_000,
});

export const prisma = new PrismaClient({ adapter });

/** Cliente de Prisma o de una transacción: las funciones "aplicar" aceptan ambos. */
export type Db = Prisma.TransactionClient;
