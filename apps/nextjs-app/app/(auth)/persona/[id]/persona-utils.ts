/**
 * Shared utility functions for persona page and components.
 */

/**
 * Normalize a value to a deduplicated, trimmed string array.
 * Handles arrays, comma-separated strings, or returns empty array.
 */
export function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value.map((s) => String(s).trim()).filter((s) => s.length > 0),
      ),
    );
  }
  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      ),
    );
  }
  return [];
}

/**
 * Convert a value to a single trimmed string.
 * Handles strings, arrays (joined with ", "), or returns empty string.
 */
export function toSingleString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return "";
}

/**
 * Format a date/time value using the user's locale.
 */
export function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

/**
 * Generate initials from a name string.
 * Takes first letter of first two words, capitalized.
 */
export function getInitials(name: string | undefined | null): string {
  return (
    (name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w: string) => w.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

/**
 * Type for demographic/firmographic items (single value items).
 */
export type SingleValueItem = {
  label: string;
  value: string;
  isList: false;
  Icon: React.ComponentType<{ className?: string }>;
};

/**
 * Type for psychographic/behavioral items (can be list or single value).
 */
export type ListValueItem = {
  label: string;
  values: string[];
  isList: true;
  Icon: React.ComponentType<{ className?: string }>;
};

export type SectionItem = SingleValueItem | ListValueItem;

/**
 * Build demographics section items from persona data.
 */
export function buildDemographicsItems(
  demographics: {
    age?: string;
    gender?: string;
    ethnicity?: string;
    location?: string;
    education?: string;
    income?: string;
    maritalStatus?: string;
    householdSize?: string;
  },
  icons: {
    Calendar: React.ComponentType<{ className?: string }>;
    GenderIcon: React.ComponentType<{ className?: string }>;
    UserIcon: React.ComponentType<{ className?: string }>;
    MapPin: React.ComponentType<{ className?: string }>;
    GraduationCap: React.ComponentType<{ className?: string }>;
    Banknote: React.ComponentType<{ className?: string }>;
    Heart: React.ComponentType<{ className?: string }>;
    Users: React.ComponentType<{ className?: string }>;
  },
): SingleValueItem[] {
  return [
    { label: "Age", value: demographics.age ?? "", Icon: icons.Calendar },
    { label: "Gender", value: demographics.gender ?? "", Icon: icons.GenderIcon },
    { label: "Ethnicity", value: demographics.ethnicity ?? "", Icon: icons.UserIcon },
    { label: "Location", value: demographics.location ?? "", Icon: icons.MapPin },
    { label: "Education", value: demographics.education ?? "", Icon: icons.GraduationCap },
    { label: "Income", value: demographics.income ?? "", Icon: icons.Banknote },
    { label: "Marital status", value: demographics.maritalStatus ?? "", Icon: icons.Heart },
    { label: "Household size", value: demographics.householdSize ?? "", Icon: icons.Users },
  ]
    .filter((i) => i.value.trim().length > 0)
    .map((i) => ({ ...i, isList: false as const }));
}

/**
 * Build psychographics section items from persona data.
 */
export function buildPsychographicsItems(
  psychographics: {
    personality?: unknown;
    interests?: unknown;
    values?: unknown;
    motivations?: unknown;
    painPoints?: unknown;
  },
  icons: {
    Brain: React.ComponentType<{ className?: string }>;
    Sparkles: React.ComponentType<{ className?: string }>;
    Gem: React.ComponentType<{ className?: string }>;
    Target: React.ComponentType<{ className?: string }>;
    AlertTriangle: React.ComponentType<{ className?: string }>;
  },
): SectionItem[] {
  const rawItems = [
    {
      label: "Personality",
      value: toSingleString(psychographics.personality),
      isList: false,
      Icon: icons.Brain,
    },
    {
      label: "Interests",
      values: normalizeList(psychographics.interests),
      isList: true,
      Icon: icons.Sparkles,
    },
    {
      label: "Values",
      values: normalizeList(psychographics.values),
      isList: true,
      Icon: icons.Gem,
    },
    {
      label: "Motivations",
      values: normalizeList(psychographics.motivations),
      isList: true,
      Icon: icons.Target,
    },
    {
      label: "Pain points",
      values: normalizeList(psychographics.painPoints),
      isList: true,
      Icon: icons.AlertTriangle,
    },
  ];

  return rawItems.filter((i) =>
    i.isList ? (i.values?.length ?? 0) > 0 : (i.value?.length ?? 0) > 0,
  ) as SectionItem[];
}

/**
 * Build behaviors section items from persona data.
 */
export function buildBehaviorsItems(
  behaviors: {
    techProficiency?: unknown;
    primaryDevices?: unknown;
    preferredChannels?: unknown;
    purchaseTriggers?: unknown;
  },
  icons: {
    Cpu: React.ComponentType<{ className?: string }>;
    Smartphone: React.ComponentType<{ className?: string }>;
    MessageSquare: React.ComponentType<{ className?: string }>;
    Zap: React.ComponentType<{ className?: string }>;
  },
): SectionItem[] {
  const rawItems = [
    {
      label: "Tech proficiency",
      value: toSingleString(behaviors.techProficiency),
      isList: false,
      Icon: icons.Cpu,
    },
    {
      label: "Primary devices",
      values: normalizeList(behaviors.primaryDevices),
      isList: true,
      Icon: icons.Smartphone,
    },
    {
      label: "Preferred channels",
      values: normalizeList(behaviors.preferredChannels),
      isList: true,
      Icon: icons.MessageSquare,
    },
    {
      label: "Purchase triggers",
      values: normalizeList(behaviors.purchaseTriggers),
      isList: true,
      Icon: icons.Zap,
    },
  ];

  return rawItems.filter((i) =>
    i.isList ? (i.values?.length ?? 0) > 0 : (i.value?.length ?? 0) > 0,
  ) as SectionItem[];
}

/**
 * Build firmographics section items from persona data.
 */
export function buildFirmographicsItems(
  firmographics: {
    employmentStatus?: string;
    jobTitle?: string;
    roleSeniority?: string;
    department?: string;
    industry?: string;
    annualRecurringRevenue?: string;
    companySize?: string;
    decisionPower?: string;
    budgetRange?: string;
  },
  icons: {
    UserIcon: React.ComponentType<{ className?: string }>;
    Briefcase: React.ComponentType<{ className?: string }>;
    Network: React.ComponentType<{ className?: string }>;
    Factory: React.ComponentType<{ className?: string }>;
    DollarSign: React.ComponentType<{ className?: string }>;
    Building2: React.ComponentType<{ className?: string }>;
    ShieldCheck: React.ComponentType<{ className?: string }>;
    Wallet: React.ComponentType<{ className?: string }>;
  },
): SingleValueItem[] {
  return [
    { label: "Employment status", value: firmographics.employmentStatus ?? "", Icon: icons.UserIcon },
    { label: "Job title", value: firmographics.jobTitle ?? "", Icon: icons.Briefcase },
    { label: "Role seniority", value: firmographics.roleSeniority ?? "", Icon: icons.Briefcase },
    { label: "Department", value: firmographics.department ?? "", Icon: icons.Network },
    { label: "Industry", value: firmographics.industry ?? "", Icon: icons.Factory },
    { label: "Annual Recurring Revenue", value: firmographics.annualRecurringRevenue ?? "", Icon: icons.DollarSign },
    { label: "Company size", value: firmographics.companySize ?? "", Icon: icons.Building2 },
    { label: "Decision power", value: firmographics.decisionPower ?? "", Icon: icons.ShieldCheck },
    { label: "Budget range", value: firmographics.budgetRange ?? "", Icon: icons.Wallet },
  ]
    .filter((i) => i.value.trim().length > 0)
    .map((i) => ({ ...i, isList: false as const }));
}

