// primary-backend/src/db/index.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma; // Export a single instance of PrismaClient