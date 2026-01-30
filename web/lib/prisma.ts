// Prisma 7 with PrismaPg adapter
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Ensure DATABASE_URL is available
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not defined');
}

// Create adapter with connection string object (Prisma 7 style)
const adapter = new PrismaPg({ 
  connectionString: process.env.DATABASE_URL 
})

// Initialize Prisma Client with adapter
const baseClient = new PrismaClient({ 
  adapter,
})

// Use $extends to ensure proper initialization
const client = baseClient.$extends({})

// Debug: Log what properties the client has
if (process.env.NODE_ENV === 'development') {
  console.log('[Prisma] Client initialized successfully');
  // @ts-ignore
  console.log('[Prisma] Runtime data model:', JSON.stringify(baseClient._runtimeDataModel?.models ? Object.keys(baseClient._runtimeDataModel.models) : 'N/A'));
  // Check if _dmmf exists
  // @ts-ignore
  console.log('[Prisma] DMMF models:', baseClient._dmmf?.modelMap ? Object.keys(baseClient._dmmf.modelMap) : 'N/A');
}

// @ts-ignore - Type workaround for Prisma 7 adapter issues
export const prismaClient = client as unknown as PrismaClient