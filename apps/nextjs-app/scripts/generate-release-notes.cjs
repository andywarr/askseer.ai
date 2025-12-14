/* eslint-disable no-console */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function parseArgs(argv) {
  const args = {
    output: "app/(no-auth)/notes/release-notes.generated.json",
    maxWeeks: 52,
    maxHighlightsPerWeek: 6,
    since: null,
    includeMerges: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--output") {
      args.output = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--max-weeks") {
      args.maxWeeks = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (token === "--max-highlights-per-week") {
      args.maxHighlightsPerWeek = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (token === "--since") {
      args.since = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--include-merges") {
      args.includeMerges = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      return { ...args, help: true };
    }

    console.warn(`Unknown arg: ${token}`);
  }

  return args;
}

function startOfIsoWeekUtc(date) {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // getUTCDay(): 0 = Sunday, 1 = Monday, ... 6 = Saturday
  const day = d.getUTCDay();
  // ISO week starts Monday. Convert so Monday => 0, Tuesday => 1, ..., Sunday => 6
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

function addDaysUtc(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toIsoDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatWeekRange(weekStartUtc) {
  const weekEndUtc = addDaysUtc(weekStartUtc, 6);
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  return {
    label: `Week of ${fmt.format(weekStartUtc)}`,
    start: toIsoDate(weekStartUtc),
    end: toIsoDate(weekEndUtc),
  };
}

function parseConventional(subject) {
  const trimmed = String(subject ?? "").trim();
  // type(scope)!: description
  const match = /^([a-zA-Z]+)(?:\(([^)]+)\))?(!)?:\s+(.*)$/.exec(trimmed);
  if (!match) {
    return { type: "other", scope: null, description: trimmed };
  }

  return {
    type: match[1].toLowerCase(),
    scope: match[2] ? match[2].trim() : null,
    description: match[4].trim(),
  };
}

function sentenceCase(text) {
  const t = String(text ?? "").trim();
  if (!t) return "";
  const normalized = t.replace(/\s+/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function cleanBulletText(subject) {
  const { description } = parseConventional(subject);
  const base = sentenceCase(description).replace(/\.$/, "");

  // Light normalization to make bullets read more naturally.
  // Keep this conservative to avoid awkward grammar.
  return base
    .replace(/^Add\b/i, "Added")
    .replace(/^Update\b/i, "Updated")
    .replace(/^Implement\b/i, "Implemented")
    .replace(/^Fix\b/i, "Fixed")
    .replace(/^Refactor\b/i, "Refactored");
}

function normalizeInferredType(type) {
  const t = String(type ?? "").toLowerCase();
  if (t === "feat" || t === "feature") return "feat";
  if (t === "fix" || t === "bugfix") return "fix";
  if (t === "perf") return "feat";
  return "other";
}

function inferTypeFromMessageAndFiles({
  conventionalType,
  subject,
  filePaths,
  additions,
  deletions,
}) {
  const normalizedConventional = normalizeInferredType(conventionalType);
  if (normalizedConventional === "feat" || normalizedConventional === "fix")
    return normalizedConventional;

  const lower = String(subject ?? "")
    .toLowerCase()
    .trim();
  const size = (additions ?? 0) + (deletions ?? 0);

  // Ignore obvious non-product commits.
  if (
    /^(chore|docs|doc|ci|build|test|tests|release|deps|dep)(\(|:|\b)/.test(
      lower,
    ) ||
    lower.startsWith("merge ")
  ) {
    return "other";
  }

  // If the change is only tests, don’t treat it as a product highlight.
  const onlyTests =
    filePaths.length > 0 &&
    filePaths.every(
      (p) =>
        /\.(test|spec)\./i.test(p) || /__tests__|\/test\b|\/tests\b/i.test(p),
    );
  if (onlyTests) return "other";

  // Fix-like keywords.
  if (
    /\b(fix|fixed|bug|bugs|bugfix|hotfix|regression|resolve|resolved|prevent|prevented|correct|corrected)\b/.test(
      lower,
    ) ||
    /\b(null|undefined|crash|exception|error|fails?|failing|invalid)\b/.test(
      lower,
    )
  ) {
    // De-emphasize cosmetic/lint-only fixes.
    if (/\b(lint|format|prettier|typo|spelling)\b/.test(lower)) return "other";
    return "fix";
  }

  // Feature-like keywords.
  if (
    /\b(add|added|introduce|introduced|implement|implemented|enable|enabled|support|supported|allow|allowed|create|created)\b/.test(
      lower,
    ) ||
    /\b(new|launch|ship|expose|integrate)\b/.test(lower)
  ) {
    return "feat";
  }

  // Avoid treating refactors as features.
  if (
    /\b(refactor|cleanup|reformat|rename|reorg|bump|upgrade|deps|dependency)\b/.test(
      lower,
    )
  ) {
    return "other";
  }

  // Fallback: large, code-changing commits are probably feature work.
  if (size >= 200 && !onlyTests) return "feat";

  return "other";
}

function anyPathMatches(paths, re) {
  return paths.some((p) => re.test(p));
}

function inferTopicKey({ subject, scope, filePaths }) {
  const s = String(subject ?? "").toLowerCase();
  const sc = String(scope ?? "").toLowerCase();

  if (sc && sc.length >= 2 && sc !== "ui" && sc !== "web") return sc;

  // Keep "starring" unified across UI + server-side changes.
  if (
    s.includes("star") ||
    s.includes("starred") ||
    anyPathMatches(filePaths, /star-study|starred|StarredStudy/i)
  ) {
    return "stars";
  }

  if (anyPathMatches(filePaths, /auto-refill/i)) return "auto-refill";
  if (anyPathMatches(filePaths, /company-teams|company-members|invite/i))
    return "invites";
  if (anyPathMatches(filePaths, /auth\.ts/i)) return "auth";
  if (anyPathMatches(filePaths, /studies-view|study-card|\(auth\)\/studies/i))
    return "studies";
  if (
    anyPathMatches(
      filePaths,
      /upload\.(ts|test\.ts)|presigned|body size limit/i,
    )
  )
    return "uploads";
  if (anyPathMatches(filePaths, /cognitive|heuristic/i)) return "evaluations";
  if (anyPathMatches(filePaths, /sidebar|nav/i)) return "navigation";
  if (
    anyPathMatches(
      filePaths,
      /schema\.prisma|databaseService|databaseController|apiRoutes/i,
    )
  )
    return "platform";

  if (s.includes("auto-refill")) return "auto-refill";
  if (s.includes("invite") || s.includes("invitation")) return "invites";
  if (s.includes("enrollment") || s.includes("auto-enrollment"))
    return "enrollment";
  if (s.includes("role") && s.includes("member")) return "roles";
  if (s.includes("upload") || s.includes("presigned")) return "uploads";
  // stars handled above
  if (s.includes("study") || s.includes("studies")) return "studies";
  if (s.includes("sidebar") || s.includes("navigation")) return "navigation";
  if (s.includes("figma")) return "figma";

  const first = s.split(/\s+/)[0] ?? "other";
  return first.replace(/[^a-z0-9-]/g, "") || "other";
}

function topicTitle(topicKey) {
  const key = String(topicKey ?? "other").toLowerCase();
  const map = {
    "auto-refill": "Auto-refill for team credits",
    invites: "Inviting teammates",
    enrollment: "Company enrollment",
    roles: "Team member roles",
    auth: "Sign-in and access",
    studies: "Studies",
    uploads: "Uploads",
    evaluations: "Evaluations",
    navigation: "Navigation",
    stars: "Starring studies",
    figma: "Figma integrations",
    platform: "Platform",
  };

  if (map[key]) return map[key];
  return key
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function scoreCommit(commit) {
  const { type, subject, additions, deletions, filePaths } = commit;
  if (type !== "feat" && type !== "fix") return -Infinity;

  const lower = String(subject ?? "").toLowerCase();
  const size = (additions ?? 0) + (deletions ?? 0);
  const files = filePaths.length;

  let score = type === "feat" ? 10 : 8;

  if (size > 600) score += 5;
  else if (size > 200) score += 3;
  else if (size > 80) score += 2;
  else if (size > 20) score += 1;

  if (files > 8) score += 2;
  else if (files > 3) score += 1;

  if (anyPathMatches(filePaths, /schema\.prisma/i)) score += 2;
  if (anyPathMatches(filePaths, /auth\.ts/i)) score += 2;
  if (
    anyPathMatches(filePaths, /databaseService|databaseController|apiRoutes/i)
  )
    score += 2;

  if (lower.includes("test") || anyPathMatches(filePaths, /\.test\./i))
    score -= 4;
  if (
    lower.includes("style") ||
    lower.includes("class order") ||
    lower.includes("margin") ||
    lower.includes("placeholder") ||
    lower.includes("terminology") ||
    lower.includes("spelling") ||
    lower.includes("format")
  ) {
    score -= 3;
  }

  return score;
}

function buildTopicBullet({ key, commits }) {
  const sorted = commits.slice().sort((a, b) => b.score - a.score);
  const lowerAll = sorted
    .map((c) => String(c.subject ?? "").toLowerCase())
    .join("\n");

  if (key === "auto-refill") {
    const parts = [];
    if (lowerAll.includes("auto-refill feature"))
      parts.push("introduce auto-refill for team credits");
    if (lowerAll.includes("allow zero") || lowerAll.includes("amount to zero"))
      parts.push("support $0 amounts and safer defaults");
    if (lowerAll.includes("button"))
      parts.push("tighten up settings UX and button behavior");
    if (parts.length >= 2) return sentenceCase(parts.join(", "));
  }

  if (key === "invites") {
    const parts = [];
    if (lowerAll.includes("invitation") || lowerAll.includes("invite"))
      parts.push("streamline inviting teammates with clearer guidance");
    if (lowerAll.includes("teamids") || lowerAll.includes("specific teams"))
      parts.push("support inviting people into specific teams");
    if (parts.length >= 2) return sentenceCase(parts.join(", "));
  }

  if (key === "enrollment") {
    const parts = [];
    if (lowerAll.includes("pending invite"))
      parts.push("handle pending invites during sign-in");
    if (
      lowerAll.includes("domain") ||
      lowerAll.includes("auto-enrollment") ||
      lowerAll.includes("otp")
    )
      parts.push("improve domain-based auto-enrollment flows");
    if (parts.length >= 1) return sentenceCase(parts.join(", "));
  }

  if (key === "uploads") {
    const parts = [];
    if (lowerAll.includes("offline") || lowerAll.includes("retry"))
      parts.push("add offline detection and retry logic");
    if (
      lowerAll.includes("concurrency") ||
      lowerAll.includes("presigned") ||
      lowerAll.includes("body size")
    )
      parts.push(
        "improve throughput with better concurrency and upload limits",
      );
    if (parts.length >= 1) return sentenceCase(parts.join(", "));
  }

  if (key === "studies") {
    const parts = [];
    if (lowerAll.includes("star") || lowerAll.includes("starred"))
      parts.push("add starring so you can save important studies");
    if (
      lowerAll.includes("search") ||
      lowerAll.includes("filter") ||
      lowerAll.includes("sorting")
    )
      parts.push(
        "make browsing studies faster with search, filters, and sorting",
      );
    if (parts.length >= 1) return sentenceCase(parts.join(", "));
  }

  if (key === "stars") {
    const parts = [];
    if (lowerAll.includes("star") || lowerAll.includes("starred"))
      parts.push("add starring so you can save important studies");
    if (parts.length >= 1) return sentenceCase(parts.join(", "));
  }

  if (key === "auth") {
    const parts = [];
    if (lowerAll.includes("jwt") || lowerAll.includes("cookie"))
      parts.push("harden JWT and cookie error handling");
    if (parts.length >= 1) return sentenceCase(parts.join(", "));
  }

  const subjects = sorted.map((c) => cleanBulletText(c.subject));
  const unique = [];

  for (const c of sorted) {
    // Skip test-only / noisy entries when generating human-facing highlights
    const lower = String(c.subject ?? "").toLowerCase();
    if (lower.includes("test") || anyPathMatches(c.filePaths, /\.test\./i))
      continue;

    const s = cleanBulletText(c.subject);
    if (!s) continue;
    if (unique.some((u) => u.toLowerCase() === s.toLowerCase())) continue;
    unique.push(s);
    if (unique.length >= 3) break;
  }

  const detail =
    unique.length > 0 ? unique.join("; ") : "Updates and improvements";
  return detail;
}

function buildFixBulletForCommit(commit) {
  const lower = String(commit.subject ?? "").toLowerCase();

  if (commit.topicKey === "auto-refill") {
    if (lower.includes("default") && lower.includes("zero")) {
      return "Default auto-refill amount now starts at $0";
    }
  }

  if (commit.topicKey === "auth") {
    if (lower.includes("jwt") || lower.includes("cookie")) {
      return "Improve resilience when JWT/cookie access fails";
    }
  }

  return cleanBulletText(commit.subject);
}

function weekSummaryFromTopics(selectedTopics, stats) {
  const titles = selectedTopics.map((t) => topicTitle(t.key));
  const f = stats.totalFeatures;
  const x = stats.totalFixes;

  if (titles.length === 0) return "A quiet week with minor updates.";
  if (titles.length === 1) {
    return `This week focused on ${titles[0].toLowerCase()}, shipping ${f} feature${f === 1 ? "" : "s"} and ${x} fix${x === 1 ? "" : "es"}.`;
  }
  if (titles.length === 2) {
    return `This week shipped improvements to ${titles[0].toLowerCase()} and ${titles[1].toLowerCase()}, alongside ${f} feature${f === 1 ? "" : "s"} and ${x} fix${x === 1 ? "" : "es"}.`;
  }
  return `This week shipped improvements across ${titles[0].toLowerCase()}, ${titles[1].toLowerCase()}, and ${titles[2].toLowerCase()}, plus a set of targeted fixes.`;
}

function getGitLogWithNumstat({ since, includeMerges }) {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const pretty = "%H%x09%ad%x09%s%x09%an";
  const args = [
    "-C",
    repoRoot,
    "log",
    "--date=iso-strict",
    `--pretty=format:${pretty}`,
    "--numstat",
  ];

  if (!includeMerges) args.push("--no-merges");
  if (since) args.push(`--since=${since}`);

  const output = execFileSync("git", args, { encoding: "utf8" });
  return output
    .split("\n")
    .map((l) => l.trimEnd())
    .filter(Boolean);
}

function parseGitLogWithNumstat(lines) {
  const commits = [];
  let current = null;

  for (const line of lines) {
    const parts = line.split("\t");

    if (parts.length >= 4 && /^[0-9a-f]{40}$/i.test(parts[0])) {
      if (current) commits.push(current);

      const [hash, isoDate, subject, author] = parts;
      const date = new Date(isoDate);
      const conventional = parseConventional(subject);

      current = {
        hash,
        date: isoDate,
        subject,
        author,
        type: conventional.type,
        conventionalType: conventional.type,
        scope: conventional.scope,
        weekStart: toIsoDate(startOfIsoWeekUtc(date)),
        additions: 0,
        deletions: 0,
        filePaths: [],
      };
      continue;
    }

    if (current && parts.length >= 3) {
      const [addedRaw, deletedRaw, filePath] = parts;
      const added = addedRaw === "-" ? 0 : Number(addedRaw);
      const deleted = deletedRaw === "-" ? 0 : Number(deletedRaw);
      if (Number.isFinite(added)) current.additions += added;
      if (Number.isFinite(deleted)) current.deletions += deleted;
      if (filePath) current.filePaths.push(filePath);
    }
  }

  if (current) commits.push(current);
  return commits;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(
      `Usage: node scripts/generate-release-notes.cjs [options]\n\nOptions:\n  --output <path>                 Output file (relative to apps/nextjs-app/)\n  --since <git since>             Pass-through to git --since (e.g. \"3 months ago\")\n  --max-weeks <number>            Limit number of weeks in output (most recent first)\n  --max-highlights-per-week <n>   Limit highlights per week (default: 6)\n  --include-merges                Include merge commits\n`,
    );
    process.exit(0);
  }

  const lines = getGitLogWithNumstat({
    since: args.since,
    includeMerges: args.includeMerges,
  });
  const commits = parseGitLogWithNumstat(lines)
    .map((c) => {
      const inferredType = inferTypeFromMessageAndFiles({
        conventionalType: c.conventionalType,
        subject: c.subject,
        filePaths: c.filePaths,
        additions: c.additions,
        deletions: c.deletions,
      });
      const topicKey = inferTopicKey({
        subject: c.subject,
        scope: c.scope,
        filePaths: c.filePaths,
      });
      const scored = {
        ...c,
        type: inferredType,
        topicKey,
      };
      scored.score = scoreCommit(scored);
      return scored;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const weeksByStart = new Map();
  for (const commit of commits) {
    if (!weeksByStart.has(commit.weekStart))
      weeksByStart.set(commit.weekStart, []);
    weeksByStart.get(commit.weekStart).push(commit);
  }

  const weekStarts = Array.from(weeksByStart.keys()).sort((a, b) =>
    a < b ? 1 : -1,
  );
  const limitedWeekStarts =
    typeof args.maxWeeks === "number" &&
    Number.isFinite(args.maxWeeks) &&
    args.maxWeeks > 0
      ? weekStarts.slice(0, args.maxWeeks)
      : weekStarts;

  const MIN_TOPIC_SCORE = 10;
  const FALLBACK_MIN = 7;
  const MIN_FIX_SCORE = 8;

  const weeks = limitedWeekStarts.map((weekStart) => {
    const items = weeksByStart
      .get(weekStart)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const weekStartUtc = new Date(`${weekStart}T00:00:00.000Z`);
    const range = formatWeekRange(weekStartUtc);

    const topics = new Map();
    for (const c of items) {
      if (c.type !== "feat" && c.type !== "fix") continue;
      if (!topics.has(c.topicKey)) topics.set(c.topicKey, []);
      topics.get(c.topicKey).push(c);
    }

    const topicList = Array.from(topics.entries()).map(
      ([key, topicCommits]) => {
        const sorted = topicCommits.slice().sort((a, b) => b.score - a.score);
        const topicScore = (sorted[0]?.score ?? 0) + (sorted[1]?.score ?? 0);
        return {
          key,
          title: topicTitle(key),
          score: topicScore,
          commits: sorted,
          stats: {
            features: sorted.filter((c) => c.type === "feat").length,
            fixes: sorted.filter((c) => c.type === "fix").length,
          },
        };
      },
    );

    const sortedTopics = topicList.sort((a, b) => b.score - a.score);
    let selectedTopics = sortedTopics.filter((t) => t.score >= MIN_TOPIC_SCORE);
    if (selectedTopics.length < 2)
      selectedTopics = sortedTopics.filter((t) => t.score >= FALLBACK_MIN);
    if (selectedTopics.length === 0) selectedTopics = sortedTopics.slice(0, 2);

    selectedTopics = selectedTopics.slice(0, args.maxHighlightsPerWeek);

    const features = [];
    const fixes = [];
    for (const t of selectedTopics) {
      const bullet = buildTopicBullet({ key: t.key, commits: t.commits });
      if (t.stats.features > 0) features.push(bullet);
      else fixes.push(bullet);
    }

    // Pull out a small set of high-signal fix highlights even when they're embedded in feature-heavy topics.
    const bestFixByTopic = new Map();
    for (const t of selectedTopics) {
      for (const c of t.commits) {
        if (c.type !== "fix") continue;
        if (c.score < MIN_FIX_SCORE) continue;

        const existing = bestFixByTopic.get(c.topicKey);
        if (!existing || c.score > existing.score)
          bestFixByTopic.set(c.topicKey, c);
      }
    }

    const extraFixes = Array.from(bestFixByTopic.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(buildFixBulletForCommit);

    for (const fx of extraFixes) {
      if (!fixes.includes(fx)) fixes.push(fx);
    }

    const highlights = [];
    for (const text of [...features, ...fixes]) {
      if (!text) continue;
      if (
        highlights.some((h) => h.toLowerCase() === String(text).toLowerCase())
      )
        continue;
      highlights.push(text);
    }

    const totalFeatures = items.filter((c) => c.type === "feat").length;
    const totalFixes = items.filter((c) => c.type === "fix").length;
    const stats = {
      // Prefer totals for at-a-glance reporting.
      totalFeatures,
      totalFixes,
      totalCommits: items.length,
      // Keep highlight counts for optional UI usage.
      highlights: selectedTopics.length,
      featureHighlights: features.length,
      fixHighlights: fixes.length,
      highlightItems: highlights.length,
    };

    const sections = [];
    if (highlights.length > 0)
      sections.push({ title: "Highlights", items: highlights });

    return {
      weekStart: range.start,
      weekEnd: range.end,
      label: range.label,
      summary: weekSummaryFromTopics(selectedTopics, stats),
      stats,
      sections,
    };
  });

  const newest = commits[0]?.date ?? null;
  const oldest = commits[commits.length - 1]?.date ?? null;

  const payload = {
    generatedAt: new Date().toISOString(),
    source: {
      since: args.since,
      includeMerges: args.includeMerges,
      maxWeeks: args.maxWeeks,
      maxHighlightsPerWeek: args.maxHighlightsPerWeek,
    },
    range: {
      newest,
      oldest,
    },
    weeks,
  };

  const outputPath = path.resolve(__dirname, "..", args.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

  console.log(
    `Wrote ${weeks.length} week(s) to ${path.relative(process.cwd(), outputPath)}`,
  );
}

main();
