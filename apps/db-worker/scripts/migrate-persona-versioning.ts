/**
 * Migration Script: Persona Versioning
 *
 * This script backfills existing personas with versioning fields:
 * - Sets personaGroupId to the persona's current id (each existing persona is its own group)
 * - Sets version to 1
 * - Sets isLatest to true
 *
 * Run this script AFTER applying the Prisma migration for the schema changes.
 *
 * Usage:
 *   npx tsx apps/db-worker/scripts/migrate-persona-versioning.ts
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "@/apps/shared/logger";

const prisma = new PrismaClient();

interface PersonaRow {
  id: string;
  studyId: string;
  personaGroupId: string | null;
  version: number | null;
  isLatest: boolean | null;
}

async function main() {
  logger.info("Starting persona versioning migration...");

  try {
    // Get all existing personas using raw SQL
    const personas = await prisma.$queryRaw<PersonaRow[]>`
      SELECT id, "studyId", "personaGroupId", version, "isLatest"
      FROM "Persona"
    `;

    logger.info(`Found ${personas.length} personas to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const persona of personas) {
      try {
        // Skip if already migrated (has personaGroupId set)
        if (persona.personaGroupId) {
          logger.debug(
            `Skipping persona ${persona.id} - already has personaGroupId`
          );
          skippedCount++;
          continue;
        }

        // Update the persona with versioning fields using raw SQL
        await prisma.$executeRaw`
          UPDATE "Persona"
          SET 
            "personaGroupId" = ${persona.id},
            version = 1,
            "isLatest" = true
          WHERE id = ${persona.id}
        `;

        migratedCount++;
        logger.debug(`Migrated persona ${persona.id}`);
      } catch (error) {
        errorCount++;
        logger.error(`Error migrating persona ${persona.id}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("Migration completed", {
      total: personas.length,
      migrated: migratedCount,
      skipped: skippedCount,
      errors: errorCount,
    });

    if (errorCount > 0) {
      logger.warn(
        `Migration completed with ${errorCount} errors. Please review the logs.`
      );
      process.exit(1);
    }

    logger.info("✅ All personas successfully migrated!");
  } catch (error) {
    logger.error("Fatal error during migration", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  logger.error("Migration script failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
