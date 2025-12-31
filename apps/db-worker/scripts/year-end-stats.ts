/*
 * Script: Year-End Stats for LinkedIn Post
 *
 * PURPOSE
 *   - Compute growth and adoption metrics comparing 2024 to 2025
 *   - Output stats for use in year-end LinkedIn posts
 *
 * USAGE
 *   npm run script:year-end-stats
 *
 * ENVIRONMENT VARIABLES
 *   DATABASE_URL       Required - Prisma database connection
 */
import * as dotenv from "dotenv";
dotenv.config();

import prisma from "../src/services/db";

// Date ranges
const YEAR_2024_START = new Date("2024-01-01T00:00:00.000Z");
const YEAR_2024_END = new Date("2024-12-31T23:59:59.999Z");
const YEAR_2025_START = new Date("2025-01-01T00:00:00.000Z");
const YEAR_2025_END = new Date("2025-12-31T23:59:59.999Z");

function percentChange(oldVal: number, newVal: number): string {
  if (oldVal === 0) {
    return newVal > 0 ? "+∞%" : "0%";
  }
  const change = ((newVal - oldVal) / oldVal) * 100;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

async function computeGrowthMetrics() {
  console.log("\n📈 GROWTH & ADOPTION METRICS");
  console.log("═".repeat(50));

  // Studies created
  const studies2024 = await prisma.study.count({
    where: { createdAt: { gte: YEAR_2024_START, lte: YEAR_2024_END } },
  });
  const studies2025 = await prisma.study.count({
    where: { createdAt: { gte: YEAR_2025_START, lte: YEAR_2025_END } },
  });

  console.log(`\n📊 Studies Created`);
  console.log(`   2024: ${formatNumber(studies2024)}`);
  console.log(`   2025: ${formatNumber(studies2025)}`);
  console.log(`   Change: ${percentChange(studies2024, studies2025)}`);

  // Studies by type
  const studiesByType2024 = await prisma.study.groupBy({
    by: ["type"],
    where: { createdAt: { gte: YEAR_2024_START, lte: YEAR_2024_END } },
    _count: true,
  });
  const studiesByType2025 = await prisma.study.groupBy({
    by: ["type"],
    where: { createdAt: { gte: YEAR_2025_START, lte: YEAR_2025_END } },
    _count: true,
  });

  console.log(`\n📋 Studies by Type (2025):`);
  for (const s of studiesByType2025) {
    const prev = studiesByType2024.find((p) => p.type === s.type)?._count || 0;
    console.log(
      `   ${s.type}: ${formatNumber(s._count)} (${percentChange(prev, s._count)})`
    );
  }

  // Users created
  const users2024 = await prisma.user.count({
    where: { createdAt: { gte: YEAR_2024_START, lte: YEAR_2024_END } },
  });
  const users2025 = await prisma.user.count({
    where: { createdAt: { gte: YEAR_2025_START, lte: YEAR_2025_END } },
  });

  console.log(`\n👥 Users Registered`);
  console.log(`   2024: ${formatNumber(users2024)}`);
  console.log(`   2025: ${formatNumber(users2025)}`);
  console.log(`   Change: ${percentChange(users2024, users2025)}`);

  // Teams created
  const teams2024 = await prisma.team.count({
    where: {
      createdAt: { gte: YEAR_2024_START, lte: YEAR_2024_END },
      isPersonal: false,
    },
  });
  const teams2025 = await prisma.team.count({
    where: {
      createdAt: { gte: YEAR_2025_START, lte: YEAR_2025_END },
      isPersonal: false,
    },
  });

  console.log(`\n🏢 Teams Created (non-personal)`);
  console.log(`   2024: ${formatNumber(teams2024)}`);
  console.log(`   2025: ${formatNumber(teams2025)}`);
  console.log(`   Change: ${percentChange(teams2024, teams2025)}`);

  // Companies created
  const companies2024 = await prisma.company.count({
    where: {
      createdAt: { gte: YEAR_2024_START, lte: YEAR_2024_END },
      status: "ACTIVE",
    },
  });
  const companies2025 = await prisma.company.count({
    where: {
      createdAt: { gte: YEAR_2025_START, lte: YEAR_2025_END },
      status: "ACTIVE",
    },
  });

  console.log(`\n🏛️ Companies Onboarded (Active)`);
  console.log(`   2024: ${formatNumber(companies2024)}`);
  console.log(`   2025: ${formatNumber(companies2025)}`);
  console.log(`   Change: ${percentChange(companies2024, companies2025)}`);

  // Monthly growth rate for 2025
  const monthlyStudies2025: number[] = [];
  for (let month = 0; month < 12; month++) {
    const startOfMonth = new Date(2025, month, 1);
    const endOfMonth = new Date(2025, month + 1, 0, 23, 59, 59, 999);
    if (startOfMonth > new Date()) break; // Don't count future months

    const count = await prisma.study.count({
      where: {
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
    });
    monthlyStudies2025.push(count);
  }

  if (monthlyStudies2025.length > 1) {
    let totalGrowth = 0;
    let growthPeriods = 0;
    for (let i = 1; i < monthlyStudies2025.length; i++) {
      if (monthlyStudies2025[i - 1] > 0) {
        totalGrowth +=
          (monthlyStudies2025[i] - monthlyStudies2025[i - 1]) /
          monthlyStudies2025[i - 1];
        growthPeriods++;
      }
    }
    const avgMoMGrowth =
      growthPeriods > 0 ? (totalGrowth / growthPeriods) * 100 : 0;
    console.log(`\n📅 Average Month-over-Month Growth (2025)`);
    console.log(`   ${avgMoMGrowth.toFixed(1)}%`);
  }

  return { studies2024, studies2025, users2024, users2025 };
}

async function computeMonetizationMetrics() {
  console.log("\n\n💰 MONETIZATION / VALUE METRICS");
  console.log("═".repeat(50));

  // Total studies vs paid studies (studies with credit transactions)
  const totalStudies2025 = await prisma.study.count({
    where: { createdAt: { gte: YEAR_2025_START, lte: YEAR_2025_END } },
  });

  const paidStudies2025 = await prisma.study.count({
    where: {
      createdAt: { gte: YEAR_2025_START, lte: YEAR_2025_END },
      creditTransactions: { some: {} },
    },
  });

  const paidPercentage2025 =
    totalStudies2025 > 0 ? (paidStudies2025 / totalStudies2025) * 100 : 0;

  console.log(`\n💳 Paid Studies (2025)`);
  console.log(
    `   ${formatNumber(paidStudies2025)} / ${formatNumber(totalStudies2025)} studies used credits`
  );
  console.log(`   ${paidPercentage2025.toFixed(1)}% of studies are paid`);

  // Teams using auto-refill
  const teamsWithAutoRefill = await prisma.team.count({
    where: { autoRefillEnabled: true },
  });
  const totalTeams = await prisma.team.count({
    where: { isPersonal: false },
  });

  const autoRefillPercentage =
    totalTeams > 0 ? (teamsWithAutoRefill / totalTeams) * 100 : 0;

  console.log(`\n🔄 Teams with Auto-Refill Enabled`);
  console.log(`   ${formatNumber(teamsWithAutoRefill)} / ${formatNumber(totalTeams)} teams`);
  console.log(`   ${autoRefillPercentage.toFixed(1)}% adoption rate`);

  // Credits consumed
  const credits2024 = await prisma.creditLedger.aggregate({
    where: {
      createdAt: { gte: YEAR_2024_START, lte: YEAR_2024_END },
      delta: { lt: 0 }, // Only count consumption (negative deltas)
    },
    _sum: { delta: true },
  });
  const credits2025 = await prisma.creditLedger.aggregate({
    where: {
      createdAt: { gte: YEAR_2025_START, lte: YEAR_2025_END },
      delta: { lt: 0 },
    },
    _sum: { delta: true },
  });

  const consumed2024 = Math.abs(credits2024._sum.delta || 0);
  const consumed2025 = Math.abs(credits2025._sum.delta || 0);

  console.log(`\n💎 Credits Consumed`);
  console.log(`   2024: ${formatNumber(consumed2024)}`);
  console.log(`   2025: ${formatNumber(consumed2025)}`);
  console.log(`   Change: ${percentChange(consumed2024, consumed2025)}`);

  // Study completion rate
  const completedStudies2025 = await prisma.study.count({
    where: {
      createdAt: { gte: YEAR_2025_START, lte: YEAR_2025_END },
      status: "COMPLETED",
    },
  });
  const failedStudies2025 = await prisma.study.count({
    where: {
      createdAt: { gte: YEAR_2025_START, lte: YEAR_2025_END },
      status: "FAILED",
    },
  });

  const completionRate =
    completedStudies2025 + failedStudies2025 > 0
      ? (completedStudies2025 / (completedStudies2025 + failedStudies2025)) *
        100
      : 0;

  console.log(`\n✅ Study Completion Rate (2025)`);
  console.log(`   Completed: ${formatNumber(completedStudies2025)}`);
  console.log(`   Failed: ${formatNumber(failedStudies2025)}`);
  console.log(`   Success Rate: ${completionRate.toFixed(1)}%`);

  return { paidPercentage2025, completionRate };
}

async function computeRetentionMetrics() {
  console.log("\n\n🔄 RETENTION / STICKINESS METRICS");
  console.log("═".repeat(50));

  // Users with multiple studies
  const usersWithStudies = await prisma.user.findMany({
    where: {
      createdStudies: {
        some: { createdAt: { gte: YEAR_2025_START, lte: YEAR_2025_END } },
      },
    },
    select: {
      id: true,
      _count: { select: { createdStudies: true } },
    },
  });

  const totalUsersWithStudies = usersWithStudies.length;
  const usersWithMultipleStudies = usersWithStudies.filter(
    (u) => u._count.createdStudies > 1
  ).length;

  const repeatUserRate =
    totalUsersWithStudies > 0
      ? (usersWithMultipleStudies / totalUsersWithStudies) * 100
      : 0;

  console.log(`\n👤 Repeat Users (2025)`);
  console.log(`   Users with studies: ${formatNumber(totalUsersWithStudies)}`);
  console.log(
    `   Users with 2+ studies: ${formatNumber(usersWithMultipleStudies)}`
  );
  console.log(`   Repeat Rate: ${repeatUserRate.toFixed(1)}%`);

  // Average studies per active user
  const totalStudiesForActiveUsers = usersWithStudies.reduce(
    (sum, u) => sum + u._count.createdStudies,
    0
  );
  const avgStudiesPerUser =
    totalUsersWithStudies > 0
      ? totalStudiesForActiveUsers / totalUsersWithStudies
      : 0;

  console.log(`\n📈 Average Studies per Active User (2025)`);
  console.log(`   ${avgStudiesPerUser.toFixed(2)} studies/user`);

  // Studies using personas
  const heStudiesWithPersona2025 = await prisma.heuristicEvaluation.count({
    where: {
      personaId: { not: null },
      study: { createdAt: { gte: YEAR_2025_START, lte: YEAR_2025_END } },
    },
  });
  const cwStudiesWithPersona2025 = await prisma.cognitiveWalkthrough.count({
    where: {
      personaId: { not: null },
      study: { createdAt: { gte: YEAR_2025_START, lte: YEAR_2025_END } },
    },
  });
  const totalHEStudies2025 = await prisma.heuristicEvaluation.count({
    where: {
      study: { createdAt: { gte: YEAR_2025_START, lte: YEAR_2025_END } },
    },
  });
  const totalCWStudies2025 = await prisma.cognitiveWalkthrough.count({
    where: {
      study: { createdAt: { gte: YEAR_2025_START, lte: YEAR_2025_END } },
    },
  });

  const personaAdoptionHE =
    totalHEStudies2025 > 0
      ? (heStudiesWithPersona2025 / totalHEStudies2025) * 100
      : 0;
  const personaAdoptionCW =
    totalCWStudies2025 > 0
      ? (cwStudiesWithPersona2025 / totalCWStudies2025) * 100
      : 0;

  console.log(`\n🎭 Persona Feature Adoption (2025)`);
  console.log(
    `   Heuristic Evaluations: ${personaAdoptionHE.toFixed(1)}% using personas`
  );
  console.log(
    `   Cognitive Walkthroughs: ${personaAdoptionCW.toFixed(1)}% using personas`
  );

  // Bookmark rate
  const totalBookmarks2025 = await prisma.bookmarkedStudy.count({
    where: { createdAt: { gte: YEAR_2025_START, lte: YEAR_2025_END } },
  });
  const studiesBookmarked2025 = await prisma.bookmarkedStudy.groupBy({
    by: ["studyId"],
    where: { createdAt: { gte: YEAR_2025_START, lte: YEAR_2025_END } },
  });

  console.log(`\n⭐ Bookmarks (2025)`);
  console.log(`   Total bookmarks: ${formatNumber(totalBookmarks2025)}`);
  console.log(
    `   Unique studies bookmarked: ${formatNumber(studiesBookmarked2025.length)}`
  );

  // Users in companies (enterprise adoption)
  const usersInCompanies = await prisma.companyMembership.count({
    where: { status: "ACTIVE" },
  });
  const totalActiveUsers = await prisma.user.count({
    where: { status: "ACTIVE" },
  });

  const enterpriseAdoption =
    totalActiveUsers > 0 ? (usersInCompanies / totalActiveUsers) * 100 : 0;

  console.log(`\n🏢 Enterprise Adoption`);
  console.log(
    `   Users in companies: ${formatNumber(usersInCompanies)} / ${formatNumber(totalActiveUsers)}`
  );
  console.log(`   Enterprise rate: ${enterpriseAdoption.toFixed(1)}%`);

  return { repeatUserRate, avgStudiesPerUser, enterpriseAdoption };
}

async function computeSummary() {
  console.log("\n\n✨ SUMMARY FOR LINKEDIN POST");
  console.log("═".repeat(50));

  const totalStudies = await prisma.study.count();
  const totalUsers = await prisma.user.count();
  const totalFindings =
    (await prisma.hEResult.count({ where: { violated: true } })) +
    (await prisma.cWIssue.count());
  const totalRecommendations =
    (await prisma.hERecommendation.count()) +
    (await prisma.cWRecommendation.count());

  console.log(`\n📊 All-Time Totals`);
  console.log(`   Total Studies: ${formatNumber(totalStudies)}`);
  console.log(`   Total Users: ${formatNumber(totalUsers)}`);
  console.log(`   UX Issues Identified: ${formatNumber(totalFindings)}`);
  console.log(
    `   Recommendations Generated: ${formatNumber(totalRecommendations)}`
  );

  // Files analyzed (screens reviewed)
  const totalFiles = await prisma.file.count({
    where: { fileType: "IMAGE" },
  });
  console.log(`   Screens Analyzed: ${formatNumber(totalFiles)}`);

  // Figma integrations
  const figmaFiles = await prisma.file.count({
    where: { figmaFileKey: { not: null } },
  });
  console.log(`   Figma Frames Imported: ${formatNumber(figmaFiles)}`);
}

async function run() {
  console.log("\n🎊 SEER YEAR-END STATS REPORT 🎊");
  console.log("════════════════════════════════════════════════════════");
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log(`Comparing: 2024 vs 2025`);

  await computeGrowthMetrics();
  await computeMonetizationMetrics();
  await computeRetentionMetrics();
  await computeSummary();

  console.log("\n════════════════════════════════════════════════════════");
  console.log("✅ Report complete!\n");
}

run()
  .catch((e) => {
    console.error("[FATAL] Script aborted:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
