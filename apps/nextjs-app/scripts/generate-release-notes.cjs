/* eslint-disable no-console */

const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function parseArgs(argv) {
  const args = {
    output: "app/(no-auth)/notes/release-notes.generated.json",
    maxWeeks: 52,
    maxHighlightsPerWeek: 6,
    since: null,
    includeMerges: false,
    useLlm: false,
    llmWeekly: true,
    llmCache: ".cache/release-notes-llm-cache.json",
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
    if (token === "--use-llm") {
      args.useLlm = true;
      continue;
    }
    if (token === "--no-llm-weekly") {
      args.llmWeekly = false;
      continue;
    }
    if (token === "--llm-cache") {
      args.llmCache = argv[i + 1];
      i += 1;
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

const RELEASE_NOTES_CLASSIFIER_CACHE_VERSION = 1;

function readJsonIfExists(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    async () => {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const idx = nextIndex;
        nextIndex += 1;
        if (idx >= items.length) return;
        results[idx] = await mapper(items[idx], idx);
      }
    },
  );

  await Promise.all(workers);
  return results;
}

function extractResponseOutputText(json) {
  if (json && typeof json.output_text === "string") return json.output_text;

  const output = json?.output;
  if (!Array.isArray(output)) return "";

  let text = "";
  for (const item of output) {
    const content = item?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part?.type === "output_text" && typeof part?.text === "string") {
        text += part.text;
      } else if (part?.type === "text" && typeof part?.text === "string") {
        text += part.text;
      }
    }
  }
  return String(text).trim();
}

function safeParseJsonObject(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return null;

  // Try strict JSON first.
  try {
    return JSON.parse(raw);
  } catch {
    // Try to recover when the model wraps JSON in prose.
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function redactSensitiveText(text) {
  let t = String(text ?? "");
  if (!t) return t;

  // Redact common credential/token patterns.
  t = t.replace(/\bsk-[A-Za-z0-9_-]{10,}\b/g, "[redacted]");
  t = t.replace(/\bAKIA[0-9A-Z]{16}\b/g, "[redacted]");
  t = t.replace(
    /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g,
    "[redacted]",
  );

  // Redact obvious env-style secrets if they appear.
  t = t.replace(
    /(OPENAI_API_KEY|AWS_SECRET_ACCESS_KEY|DATABASE_URL|NEXTAUTH_SECRET)\s*=\s*[^\s]+/g,
    "$1=[redacted]",
  );

  // Avoid leaking internal URLs with query params (often contain tokens).
  t = t.replace(/https?:\/\/\S+\?\S+/g, "[redacted-url]");

  return t;
}

async function classifyCommitTypeWithLlm({
  apiKey,
  model,
  subject,
  filePaths,
  additions,
  deletions,
}) {
  const trimmedSubject = String(subject ?? "").trim();
  const files = Array.isArray(filePaths) ? filePaths.slice(0, 25) : [];
  const size = (additions ?? 0) + (deletions ?? 0);

  const prompt = [
    "Classify this git commit for release notes.",
    "Return ONLY valid JSON.",
    "\nSafety:",
    "- Never include secrets, tokens, credentials, private URLs, IPs, or personal data in your output.",
    "- If the subject/files contain anything sensitive, ignore it and proceed with a generic reason.",
    "\nDefinitions:",
    '- type="feat": a user-visible feature/capability or meaningful product improvement',
    '- type="fix": a bug fix, crash fix, regression fix, or correctness issue',
    '- type="other": refactors, chores, tests, CI, formatting, dependency bumps, internal cleanup',
    "\nRules:",
    "- Be conservative: if unsure, choose other.",
    "- Tests-only changes => other.",
    "\nReturn schema:",
    '{"type":"feat"|"fix"|"other","confidence":0-1,"reason":"short"}',
    "\nCommit:",
    `Subject: ${trimmedSubject || "(empty)"}`,
    `Changed files (${files.length} shown):\n${files.map((p) => `- ${p}`).join("\n")}`,
    `Size: +${additions ?? 0} -${deletions ?? 0} (total ${size})`,
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      input: [
        {
          role: "system",
          content:
            "You are a meticulous release-notes assistant. Output STRICT JSON only.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  // Retry a couple times on transient issues / rate limits.
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    const err = new Error(
      `OpenAI classify failed: ${res.status} ${res.statusText} ${bodyText}`,
    );
    err.status = res.status;
    throw err;
  }

  const json = await res.json();
  const outputText = extractResponseOutputText(json);
  const parsed = safeParseJsonObject(outputText);
  if (!parsed) return null;

  const type = normalizeInferredType(parsed.type);
  if (type !== "feat" && type !== "fix" && type !== "other") return null;

  const confidence = Number(parsed.confidence);
  const clampedConfidence = Number.isFinite(confidence)
    ? Math.max(0, Math.min(1, confidence))
    : null;

  return {
    type,
    confidence: clampedConfidence,
    reason: typeof parsed.reason === "string" ? parsed.reason.trim() : null,
  };
}

function stableWeekSignature(commits) {
  const h = createHash("sha256");
  for (const c of commits) {
    h.update(String(c.hash ?? ""));
    h.update("|");
    h.update(String(c.subject ?? ""));
    h.update("|");
    h.update(String((c.additions ?? 0) + (c.deletions ?? 0)));
    h.update("\n");
  }
  return h.digest("hex").slice(0, 16);
}

async function generateWeekNotesWithLlm({
  apiKey,
  model,
  weekLabel,
  maxHighlights,
  commits,
}) {
  const MAX_PROMPT_CHARS = 60000;
  const chunkSize = 120;

  const all = commits
    .slice()
    // Prefer newest first to match how humans scan a git log.
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const typeCounts = all.reduce(
    (acc, c) => {
      const t = normalizeInferredType(c.type);
      if (t === "feat") acc.feat += 1;
      else if (t === "fix") acc.fix += 1;
      else acc.other += 1;
      return acc;
    },
    { feat: 0, fix: 0, other: 0 },
  );

  // Include extra context for the most "important" commits, but still pass
  // every commit subject + typeGuess so the model can reason across the whole week.
  const richCount = 30;
  const richSet = new Set(
    all
      .slice()
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, richCount)
      .map((c) => c.hash),
  );

  const commitLines = all.map((c) => {
    const subject = String(c.subject ?? "").trim() || "(empty)";
    const typeGuess = normalizeInferredType(c.type);

    // Always include subject + typeGuess for every commit.
    const lines = [`- ${subject}`, `  typeGuess: ${typeGuess}`];

    // Include richer info for the most meaningful commits.
    if (richSet.has(c.hash)) {
      const files = Array.isArray(c.filePaths) ? c.filePaths.slice(0, 8) : [];
      const size = (c.additions ?? 0) + (c.deletions ?? 0);
      lines.push(
        `  size: +${c.additions ?? 0} -${c.deletions ?? 0} (total ${size})`,
      );
      if (files.length) lines.push(`  files: ${files.join(", ")}`);
    }

    return lines.join("\n");
  });

  const basePromptParts = [
    `You are writing release notes for ${weekLabel}.`,
    "You are given ALL commits from this week.",
    "Your job is to look ACROSS commits and produce concise, user-facing release notes.",
    "\nSafety / privacy rules (must follow):",
    "- Do NOT include any secrets, API keys, tokens, credentials, private URLs (esp. with query params), internal hostnames, IPs, stack traces, or database details.",
    "- Do NOT include personally identifying information (emails, names, user IDs).",
    "- If a commit message contains sensitive info, omit it and describe the change generically.",
    "\nConstraints:",
    "- Combine features + fixes into one list called 'highlights'.",
    "- Each highlight should describe a meaningful shipped change; collapse multiple related commits into one highlight.",
    "- Treat typeGuess as a hint, not ground truth.",
    "- Ignore internal-only work (refactors, tests, lint/formatting, dependency bumps, CI) unless it clearly impacts users.",
    "- No commit hashes, no conventional prefixes, no topic labels (like 'Backend:').",
    "- Output must be ONLY valid JSON.",
    "\nReturn schema:",
    '{"summary":"1-2 sentences","highlights":[{"type":"feat"|"fix","text":"..."}]}',
    `\nHighlight count: 3 to ${Math.max(3, Math.min(8, maxHighlights ?? 6))}.`,
    `\nWeek commit counts (for context): feat=${typeCounts.feat}, fix=${typeCounts.fix}, other=${typeCounts.other}, total=${all.length}.`,
    "\nCommits (newest first):",
  ];

  async function callWeekNotesLlm(prompt) {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: false,
        input: [
          {
            role: "system",
            content:
              "You are an expert product release-notes writer. Output STRICT JSON only.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      const err = new Error(
        `OpenAI week-notes failed: ${res.status} ${res.statusText} ${bodyText}`,
      );
      err.status = res.status;
      throw err;
    }

    const json = await res.json();
    const outputText = extractResponseOutputText(json);
    const parsed = safeParseJsonObject(outputText);
    return parsed;
  }

  // Try single-shot first.
  const singlePrompt = [...basePromptParts, ...commitLines].join("\n");
  let parsed = null;
  if (singlePrompt.length <= MAX_PROMPT_CHARS) {
    parsed = await callWeekNotesLlm(singlePrompt);
  } else {
    // Token-safe fallback: summarize in chunks, then consolidate.
    const chunks = [];
    for (let start = 0; start < commitLines.length; start += chunkSize) {
      chunks.push(commitLines.slice(start, start + chunkSize));
    }

    const chunkHighlights = [];
    for (let i = 0; i < chunks.length; i += 1) {
      const chunkPrompt = [
        `You are extracting candidate release-note highlights for ${weekLabel}.`,
        "These are SOME of the commits from this week.",
        "Extract concise, user-facing candidate highlights. Collapse related commits within this chunk.",
        "Ignore internal-only work unless it clearly impacts users.",
        "Return ONLY valid JSON.",
        "Return schema:",
        '{"highlights":[{"type":"feat"|"fix","text":"..."}]}',
        `Keep 2 to ${Math.max(3, Math.min(6, maxHighlights ?? 6))} highlights.`,
        `\nChunk ${i + 1}/${chunks.length}:`,
        ...chunks[i],
      ].join("\n");

      const chunkParsed = await callWeekNotesLlm(chunkPrompt);
      const hs = Array.isArray(chunkParsed?.highlights)
        ? chunkParsed.highlights
        : [];
      for (const h of hs) chunkHighlights.push(h);
    }

    const consolidationPrompt = [
      `You are writing final release notes for ${weekLabel}.`,
      "You have candidate highlights extracted from ALL commit chunks.",
      "Deduplicate, merge, and rewrite into the final best highlights.",
      "Return ONLY valid JSON.",
      "Return schema:",
      '{"summary":"1-2 sentences","highlights":[{"type":"feat"|"fix","text":"..."}]}',
      `Highlight count: 3 to ${Math.max(3, Math.min(8, maxHighlights ?? 6))}.`,
      "\nCandidate highlights:",
      ...chunkHighlights
        .map((h) => {
          if (typeof h === "string") return `- ${h}`;
          const type = normalizeInferredType(h?.type);
          const text = String(h?.text ?? "").trim();
          if (!text) return "";
          if (type !== "feat" && type !== "fix") return `- ${text}`;
          return `- (${type}) ${text}`;
        })
        .filter(Boolean),
    ].join("\n");

    parsed = await callWeekNotesLlm(consolidationPrompt);
  }

  if (!parsed) return null;

  const summary =
    typeof parsed.summary === "string"
      ? redactSensitiveText(parsed.summary.trim())
      : "";
  const highlightsRaw = Array.isArray(parsed.highlights)
    ? parsed.highlights
    : [];
  const typedHighlights = highlightsRaw
    .map((h) => {
      if (typeof h === "string") {
        // Backwards-compatible: accept plain strings and treat as feature-ish.
        return { type: "feat", text: redactSensitiveText(h) };
      }
      if (!h || typeof h !== "object") return null;
      const type = normalizeInferredType(h.type);
      const text = redactSensitiveText(String(h.text ?? "").trim());
      if (!text) return null;
      if (type !== "feat" && type !== "fix") return null;
      return { type, text };
    })
    .filter(Boolean)
    .slice(0, Math.max(3, Math.min(12, maxHighlights ?? 6)));

  if (!summary || typedHighlights.length === 0) return null;
  return { summary, highlights: typedHighlights };
}

async function inferTypeWithOptionalLlm({
  useLlm,
  llmModel,
  llmCache,
  commit,
  fallbackType,
  metrics,
}) {
  if (!useLlm) return fallbackType;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackType;

  const cacheKey = `${RELEASE_NOTES_CLASSIFIER_CACHE_VERSION}:${commit.hash}`;
  const existing = llmCache.entries[cacheKey];
  if (existing && typeof existing.type === "string") {
    const t = normalizeInferredType(existing.type);
    if (t === "feat" || t === "fix" || t === "other") {
      if (metrics) metrics.cacheHits += 1;
      return t;
    }
  }

  const model = llmModel;
  let attempt = 0;
  while (attempt < 3) {
    try {
      attempt += 1;
      if (attempt === 1 && metrics) metrics.apiCalls += 1;
      const result = await classifyCommitTypeWithLlm({
        apiKey,
        model,
        subject: commit.subject,
        filePaths: commit.filePaths,
        additions: commit.additions,
        deletions: commit.deletions,
      });

      if (!result) {
        if (metrics) metrics.fallbackUsed += 1;
        return fallbackType;
      }

      llmCache.entries[cacheKey] = {
        type: result.type,
        confidence: result.confidence,
        reason: result.reason,
        model,
        at: new Date().toISOString(),
        subject: String(commit.subject ?? "").slice(0, 200),
      };
      return result.type;
    } catch (error) {
      const status = error?.status;
      // Back off a bit for rate limiting.
      if (status === 429) {
        if (metrics) metrics.rateLimited += 1;
        await sleep(600 * attempt);
      } else await sleep(200 * attempt);
      if (attempt >= 3) {
        if (metrics) metrics.fallbackUsed += 1;
        return fallbackType;
      }
    }
  }

  return fallbackType;
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

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(
      `Usage: node scripts/generate-release-notes.cjs [options]\n\nOptions:\n  --output <path>                 Output file (relative to apps/nextjs-app/)\n  --since <git since>             Pass-through to git --since (e.g. \"3 months ago\")\n  --max-weeks <number>            Limit number of weeks in output (most recent first)\n  --max-highlights-per-week <n>   Limit highlights per week (default: 6)\n  --include-merges                Include merge commits\n  --use-llm                       Use OpenAI (via OPENAI_API_KEY) to classify commits as feat/fix/other\n  --no-llm-weekly                 Disable week-level LLM synthesis (across-commit)\n  --llm-cache <path>              Cache file path (relative to apps/nextjs-app/; default: .cache/release-notes-llm-cache.json)\n\nEnv:\n  OPENAI_API_KEY                  Required when using --use-llm\n  RELEASE_NOTES_CLASSIFIER_MODEL  Optional model override (default: gpt-5-mini-2025-08-07)\n`,
    );
    process.exit(0);
  }

  const llmModel =
    process.env.RELEASE_NOTES_CLASSIFIER_MODEL || "gpt-5-mini-2025-08-07";
  const llmCachePath = path.resolve(__dirname, "..", args.llmCache);
  const cacheFromDisk = readJsonIfExists(llmCachePath);
  const llmCache =
    cacheFromDisk &&
    cacheFromDisk.version === RELEASE_NOTES_CLASSIFIER_CACHE_VERSION &&
    cacheFromDisk.entries &&
    typeof cacheFromDisk.entries === "object"
      ? cacheFromDisk
      : { version: RELEASE_NOTES_CLASSIFIER_CACHE_VERSION, entries: {} };

  const lines = getGitLogWithNumstat({
    since: args.since,
    includeMerges: args.includeMerges,
  });
  const rawCommits = parseGitLogWithNumstat(lines);

  // Limit work (especially LLM calls) to the same week window we intend to output.
  // This keeps progress totals intuitive and avoids classifying the entire repo history.
  const rawWeeksByStart = new Map();
  for (const c of rawCommits) {
    if (!rawWeeksByStart.has(c.weekStart)) rawWeeksByStart.set(c.weekStart, 0);
    rawWeeksByStart.set(c.weekStart, rawWeeksByStart.get(c.weekStart) + 1);
  }

  const weekStartsAll = Array.from(rawWeeksByStart.keys()).sort((a, b) =>
    a < b ? 1 : -1,
  );
  const limitedWeekStarts =
    typeof args.maxWeeks === "number" &&
    Number.isFinite(args.maxWeeks) &&
    args.maxWeeks > 0
      ? weekStartsAll.slice(0, args.maxWeeks)
      : weekStartsAll;

  const includedWeeks = new Set(limitedWeekStarts);
  const rawCommitsForProcessing = rawCommits.filter((c) =>
    includedWeeks.has(c.weekStart),
  );

  const llmEnabled = Boolean(args.useLlm);
  const llmHasKey = Boolean(process.env.OPENAI_API_KEY);

  // If we are doing the week-level across-commit synthesis, we do NOT need to
  // spend an LLM call per commit. We still compute a heuristic `typeGuess`
  // (feat/fix/other) to help scoring and to provide a hint to the weekly LLM.
  const llmCommitClassificationEnabled =
    llmEnabled && llmHasKey && !(args.useLlm && args.llmWeekly);
  const llmMetrics = {
    total: rawCommitsForProcessing.length,
    processed: 0,
    cacheHits: 0,
    apiCalls: 0,
    rateLimited: 0,
    fallbackUsed: 0,
  };

  let progressTimer = null;
  const progressStart = Date.now();

  if (llmEnabled && !llmHasKey) {
    console.warn(
      "--use-llm was set, but OPENAI_API_KEY is not set; falling back to heuristic classification.",
    );
  }

  if (llmEnabled && llmHasKey && args.llmWeekly) {
    console.log(
      `LLM weekly synthesis enabled (${llmModel}). Skipping per-commit LLM classification.`,
    );
  }

  if (llmCommitClassificationEnabled) {
    console.log(
      `LLM classification enabled (${llmModel}). Commits to classify: ${rawCommitsForProcessing.length}.`,
    );
    progressTimer = setInterval(() => {
      const elapsedSec = Math.max(
        1,
        Math.round((Date.now() - progressStart) / 1000),
      );
      const rate = (llmMetrics.processed / elapsedSec).toFixed(2);
      const pct = llmMetrics.total
        ? Math.round((llmMetrics.processed / llmMetrics.total) * 100)
        : 100;
      const line =
        `Progress: ${llmMetrics.processed}/${llmMetrics.total} (${pct}%) ` +
        `| cache ${llmMetrics.cacheHits} | api ${llmMetrics.apiCalls} | 429 ${llmMetrics.rateLimited} | fallback ${llmMetrics.fallbackUsed} ` +
        `| ${rate}/s`;

      if (process.stdout.isTTY) {
        process.stdout.write(`\r${line}`);
      } else {
        console.log(line);
      }
    }, 1000);
  }

  const commits = await mapWithConcurrency(
    rawCommitsForProcessing,
    3,
    async (c) => {
      const fallbackType = inferTypeFromMessageAndFiles({
        conventionalType: c.conventionalType,
        subject: c.subject,
        filePaths: c.filePaths,
        additions: c.additions,
        deletions: c.deletions,
      });

      const inferredType = await inferTypeWithOptionalLlm({
        useLlm: llmCommitClassificationEnabled,
        llmModel,
        llmCache,
        commit: c,
        fallbackType,
        metrics: llmCommitClassificationEnabled ? llmMetrics : null,
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
      if (llmCommitClassificationEnabled) llmMetrics.processed += 1;
      return scored;
    },
  );

  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
    if (process.stdout.isTTY) process.stdout.write("\n");
    console.log(
      `LLM classification done. cacheHits=${llmMetrics.cacheHits} apiCalls=${llmMetrics.apiCalls} rateLimited=${llmMetrics.rateLimited} fallbackUsed=${llmMetrics.fallbackUsed}`,
    );
  }

  commits.sort((a, b) => (a.date < b.date ? 1 : -1));

  const weeksByStart = new Map();
  for (const commit of commits) {
    if (!weeksByStart.has(commit.weekStart))
      weeksByStart.set(commit.weekStart, []);
    weeksByStart.get(commit.weekStart).push(commit);
  }

  const weekStarts = Array.from(weeksByStart.keys()).sort((a, b) =>
    a < b ? 1 : -1,
  );
  // Use the precomputed week window so we don't accidentally widen scope.
  // (weekStarts is still useful for validation/debugging).

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
      __itemsForLlm: items,
    };
  });

  // Optional week-level pass: generate summary + highlights by looking across commits.
  if (args.useLlm && args.llmWeekly && process.env.OPENAI_API_KEY) {
    console.log(
      `\nGenerating week-level notes with LLM (${llmModel}) for ${weeks.length} week(s)...`,
    );
    for (let i = 0; i < weeks.length; i += 1) {
      const w = weeks[i];
      const items = Array.isArray(w.__itemsForLlm) ? w.__itemsForLlm : [];
      if (items.length === 0) continue;

      const signature = stableWeekSignature(items);
      const weekKey = `week:${RELEASE_NOTES_CLASSIFIER_CACHE_VERSION}:${w.weekStart}:${signature}`;
      const cached = llmCache.entries[weekKey];
      if (
        cached &&
        typeof cached.summary === "string" &&
        Array.isArray(cached.highlights)
      ) {
        w.summary = cached.summary;
        const typed = cached.highlights
          .map((h) => {
            if (typeof h === "string") return { type: "feat", text: h };
            if (!h || typeof h !== "object") return null;
            const type = normalizeInferredType(h.type);
            const text = String(h.text ?? "").trim();
            if (!text) return null;
            if (type !== "feat" && type !== "fix") return null;
            return { type, text };
          })
          .filter(Boolean)
          .slice(0, args.maxHighlightsPerWeek);

        if (typed.length > 0) {
          w.sections = [
            { title: "Highlights", items: typed.map((h) => h.text) },
          ];
          // Update totals to reflect grouped highlights across commits.
          w.stats.totalFeatures = typed.filter((h) => h.type === "feat").length;
          w.stats.totalFixes = typed.filter((h) => h.type === "fix").length;
          w.stats.highlightItems = typed.length;
        }
        continue;
      }

      console.log(`Week ${i + 1}/${weeks.length}: ${w.label}`);

      let attempt = 0;
      while (attempt < 3) {
        try {
          attempt += 1;
          const notes = await generateWeekNotesWithLlm({
            apiKey: process.env.OPENAI_API_KEY,
            model: llmModel,
            weekLabel: w.label,
            maxHighlights: args.maxHighlightsPerWeek,
            commits: items,
          });
          if (!notes) break;

          w.summary = notes.summary;
          w.sections = [
            { title: "Highlights", items: notes.highlights.map((h) => h.text) },
          ];
          // Update totals to reflect grouped highlights across commits.
          w.stats.totalFeatures = notes.highlights.filter(
            (h) => h.type === "feat",
          ).length;
          w.stats.totalFixes = notes.highlights.filter(
            (h) => h.type === "fix",
          ).length;
          w.stats.highlightItems = notes.highlights.length;
          llmCache.entries[weekKey] = {
            summary: notes.summary,
            highlights: notes.highlights,
            model: llmModel,
            at: new Date().toISOString(),
          };
          break;
        } catch (error) {
          const status = error?.status;
          if (status === 429) await sleep(800 * attempt);
          else await sleep(250 * attempt);
          if (attempt >= 3) {
            console.warn(
              `Week-level LLM notes failed for ${w.label}; keeping heuristic summary/highlights.`,
            );
          }
        }
      }
    }
  }

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
    weeks: weeks.map((w) => {
      // Strip internal fields.
      // eslint-disable-next-line no-unused-vars
      const { __itemsForLlm, ...rest } = w;
      return rest;
    }),
  };

  const outputPath = path.resolve(__dirname, "..", args.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

  if (args.useLlm && process.env.OPENAI_API_KEY) {
    writeJson(llmCachePath, llmCache);
  }

  console.log(
    `Wrote ${weeks.length} week(s) to ${path.relative(process.cwd(), outputPath)}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
