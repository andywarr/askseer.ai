/*
 * Migration Script: Migrate existing heuristics to new HeuristicFamily structure
 *
 * What it does:
 *  - Creates HeuristicFamily records for NIELSEN and TENETS
 *  - Updates existing Heuristic records to link to families (adds heuristicFamilyId)
 *  - Updates HeuristicEvaluation records to use heuristicFamilyKey instead of type
 *  - Does NOT delete existing data - preserves all heuristics and their references
 *
 * Safety:
 *  - DRY_RUN=true by default (logs actions, makes no writes)
 *  - Existing Heuristic records are updated, not deleted (preserves HEResult references)
 *
 * Usage (from apps/db-worker/):
 *   DRY_RUN=true  npm run script:migrate-heuristics
 *   DRY_RUN=false npm run script:migrate-heuristics
 */
import * as dotenv from "dotenv";
dotenv.config();

import prisma from "../src/services/db";

const DRY_RUN = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";

async function main() {
  console.log(`[HEURISTIC-MIGRATION] Starting migration: DRY_RUN=${DRY_RUN}`);

  try {
    // Step 1: Create HeuristicFamily records
    console.log("\n[STEP 1] Creating HeuristicFamily records...");

    const nielsenFamily = {
      name: "Nielsen's 10 Usability Heuristics",
      key: "NIELSEN",
      description:
        "Jakob Nielsen's 10 general principles for interaction design. They are called 'heuristics' because they are broad rules of thumb and not specific usability guidelines.",
      companyId: null, // Global family
    };

    const tenetsFamily = {
      name: "Tenets & Traps",
      key: "TENETS",
      description:
        "Core design principles (Tenets) to follow and common pitfalls (Traps) to avoid in user experience design.",
      companyId: null, // Global family
    };

    let nielsenFamilyId: string;
    let tenetsFamilyId: string;

    if (DRY_RUN) {
      console.log("[DRY-RUN] Would create Nielsen family:", nielsenFamily);
      console.log("[DRY-RUN] Would create Tenets family:", tenetsFamily);
      nielsenFamilyId = "mock-nielsen-id";
      tenetsFamilyId = "mock-tenets-id";
    } else {
      // Check if families already exist
      let nielsenFamilyRecord = await prisma.heuristicFamily.findUnique({
        where: { key: "NIELSEN" },
      });

      if (!nielsenFamilyRecord) {
        nielsenFamilyRecord = await prisma.heuristicFamily.create({
          data: nielsenFamily,
        });
        console.log(
          `[SUCCESS] Created Nielsen family: ${nielsenFamilyRecord.id}`
        );
      } else {
        console.log(
          `[INFO] Nielsen family already exists: ${nielsenFamilyRecord.id}`
        );
      }

      let tenetsFamilyRecord = await prisma.heuristicFamily.findUnique({
        where: { key: "TENETS" },
      });

      if (!tenetsFamilyRecord) {
        tenetsFamilyRecord = await prisma.heuristicFamily.create({
          data: tenetsFamily,
        });
        console.log(
          `[SUCCESS] Created Tenets family: ${tenetsFamilyRecord.id}`
        );
      } else {
        console.log(
          `[INFO] Tenets family already exists: ${tenetsFamilyRecord.id}`
        );
      }

      nielsenFamilyId = nielsenFamilyRecord.id;
      tenetsFamilyId = tenetsFamilyRecord.id;
    }

    // Step 2: Update existing heuristics to link to families
    console.log(
      "\n[STEP 2] Updating existing heuristics to link to families..."
    );

    const existingHeuristics = await prisma.heuristic.findMany({
      where: {
        type: { in: ["NIELSEN", "TENETS"] },
        heuristicFamilyId: null, // Only update those not yet linked
      },
    });

    console.log(
      `[INFO] Found ${existingHeuristics.length} heuristics to update`
    );

    let updatedNielsen = 0;
    let updatedTenets = 0;

    for (const heuristic of existingHeuristics) {
      const familyId =
        heuristic.type === "NIELSEN" ? nielsenFamilyId : tenetsFamilyId;

      if (DRY_RUN) {
        console.log(
          `[DRY-RUN] Would update heuristic ${heuristic.id} (${heuristic.label || heuristic.heuristic.substring(0, 50)}...) to link to family ${familyId}`
        );
      } else {
        await prisma.heuristic.update({
          where: { id: heuristic.id },
          data: { heuristicFamilyId: familyId },
        });

        if (heuristic.type === "NIELSEN") updatedNielsen++;
        else if (heuristic.type === "TENETS") updatedTenets++;
      }
    }

    if (!DRY_RUN) {
      console.log(`[SUCCESS] Updated ${updatedNielsen} Nielsen heuristics`);
      console.log(`[SUCCESS] Updated ${updatedTenets} Tenets heuristics`);
    }

    // Step 3: Update HeuristicEvaluation records
    console.log("\n[STEP 3] Updating HeuristicEvaluation records...");

    const evaluations = await prisma.heuristicEvaluation.findMany({
      where: {
        OR: [{ heuristicFamilyKey: null }, { heuristicFamilyKey: "" }],
      },
      select: { id: true, type: true },
    });

    console.log(`[INFO] Found ${evaluations.length} evaluations to update`);

    let updatedNielsenEval = 0;
    let updatedTenetsEval = 0;

    for (const evaluation of evaluations) {
      const familyKey =
        evaluation.type === "NIELSEN"
          ? "NIELSEN"
          : evaluation.type === "TENETS"
            ? "TENETS"
            : null;

      if (!familyKey) {
        console.log(
          `[WARN] Unknown heuristic type: ${evaluation.type} for evaluation ${evaluation.id}`
        );
        continue;
      }

      if (DRY_RUN) {
        console.log(
          `[DRY-RUN] Would update evaluation ${evaluation.id} to use familyKey: ${familyKey}`
        );
      } else {
        await prisma.heuristicEvaluation.update({
          where: { id: evaluation.id },
          data: { heuristicFamilyKey: familyKey },
        });

        if (familyKey === "NIELSEN") updatedNielsenEval++;
        else if (familyKey === "TENETS") updatedTenetsEval++;
      }
    }

    if (!DRY_RUN) {
      console.log(
        `[SUCCESS] Updated ${updatedNielsenEval} Nielsen evaluations`
      );
      console.log(`[SUCCESS] Updated ${updatedTenetsEval} Tenets evaluations`);
    }

    console.log("\n[HEURISTIC-MIGRATION] Migration completed successfully!");

    if (DRY_RUN) {
      console.log(
        "\n⚠️  This was a DRY RUN. No changes were made to the database."
      );
      console.log("Run with DRY_RUN=false to apply changes.");
    } else {
      console.log(
        "\n✅ Migration complete! Existing heuristics are now linked to families."
      );
      console.log("\nSummary:");
      console.log(`  - Created/verified NIELSEN and TENETS family records`);
      console.log(
        `  - Updated ${updatedNielsen + updatedTenets} heuristics with family links`
      );
      console.log(
        `  - Updated ${updatedNielsenEval + updatedTenetsEval} evaluations with family keys`
      );
      console.log("\nNext steps:");
      console.log("1. Verify the migration in Prisma Studio");
      console.log(
        "2. After verification, update schema to make heuristicFamilyId required"
      );
      console.log(
        "3. Create another migration to remove the old 'type' field (optional)"
      );
    }
  } catch (error) {
    console.error("[HEURISTIC-MIGRATION] Migration failed:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error("[HEURISTIC-MIGRATION][FATAL]", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
