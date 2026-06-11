/**
 * Static option arrays for persona form fields.
 * Extracted to avoid re-creation on every render.
 */

// Tech proficiency levels
export const techProficiencyOptions = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
] as const;

// Company size ranges
export const companySizeOptions = [
  "1-9",
  "10-49",
  "50-199",
  "200-499",
  "500-999",
  "1000+",
] as const;

// Role seniority levels
export const roleSeniorityOptions = [
  "Individual Contributor",
  "Manager",
  "Director",
  "VP",
  "C-Suite",
  "Owner",
] as const;

// Age ranges
export const ageOptions = [
  "Under 18",
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
] as const;

// Gender options
export const genderOptions = ["Female", "Male", "Non-binary"] as const;

// Ethnicity options
export const ethnicityOptions = [
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Hispanic or Latino",
  "Middle Eastern or North African",
  "Native Hawaiian or Other Pacific Islander",
  "White",
  "Two or More Races",
] as const;

// Education levels
export const educationOptions = [
  "High school",
  "Associate's degree",
  "Bachelor's degree",
  "Master's degree",
  "Doctorate",
  "Professional degree",
  "Bootcamp/Certification",
] as const;

// Income ranges
export const incomeOptions = [
  "Under $24,999",
  "$25,000–$49,999",
  "$50,000–$74,999",
  "$75,000–$99,999",
  "$100,000–$149,999",
  "$150,000–$199,999",
  "$200,000+",
] as const;

// Marital status options
export const maritalStatusOptions = [
  "Single",
  "Married",
  "Domestic partnership",
  "Divorced",
  "Widowed",
] as const;

// Device options
export const deviceOptions = [
  "iPhone",
  "Android phone",
  "iPad / Tablet",
  "MacBook / Mac",
  "Windows laptop / PC",
  "Linux laptop / PC",
  "Smartwatch",
] as const;

// Communication channel options
export const channelOptions = [
  "Blogs",
  "Communities / Forums",
  "Email",
  "Events / Webinars",
  "Facebook",
  "In-app notifications",
  "Instagram",
  "LinkedIn",
  "Phone call",
  "Podcasts",
  "Push notifications",
  "Reddit",
  "Search (Google/Bing)",
  "SMS",
  "TikTok",
  "Twitter / X",
  "YouTube",
] as const;

// Industry options (Bureau of Labor Statistics classifications)
export const industryOptions = [
  "Accommodation and Food Services",
  "Administrative and Support and Waste Management Services",
  "Agriculture, Forestry, Fishing and Hunting",
  "Arts, Entertainment, and Recreation",
  "Construction",
  "Educational Services",
  "Finance and Insurance",
  "Health Care and Social Assistance",
  "Information",
  "Management of Companies and Enterprises",
  "Manufacturing",
  "Mining, Quarrying, and Oil and Gas Extraction",
  "Other Services (except Public Administration)",
  "Professional, Scientific, and Technical Services",
  "Public Administration",
  "Real Estate and Rental and Leasing",
  "Retail Trade",
  "Transportation and Warehousing",
  "Utilities",
  "Wholesale Trade",
] as const;

// Department options
export const departmentOptions = [
  "Customer Support",
  "Data / Analytics",
  "Design",
  "Engineering",
  "Executive / Strategy",
  "Finance",
  "Human Resources",
  "IT",
  "Legal",
  "Marketing",
  "Operations",
  "Procurement",
  "Product",
  "Sales",
  "Security",
] as const;

// B2B purchase triggers
export const purchaseTriggersOptions = [
  "Budget cycle",
  "Compliance requirement",
  "Contract end / renewal",
  "Cost reduction initiative",
  "Deadline / time pressure",
  "Leadership change",
  "New requirement",
  "Pain point emerges",
  "Performance issue",
  "Recommendation",
] as const;

// B2C/Consumer purchase triggers
export const consumerPurchaseTriggersOptions = [
  "Advertisement",
  "Back-to-school",
  "Discount or coupon",
  "Emergency",
  "Free shipping threshold",
  "Friend or family recommendation",
  "Gift occasion",
  "Influencer recommendation",
  "Life event (moving, marriage, new job)",
  "Limited-time offer",
  "New product release",
  "Product goes viral",
  "Running out / replenishment",
  "Seasonal",
  "Seasonal/holiday sale",
  "Social media",
] as const;

// Decision power options
export const decisionPowerOptions = [
  "No influence",
  "Influencer",
  "Recommender",
  "Shared decision-maker",
  "Final decision maker",
] as const;

// Budget range options
export const budgetRangeOptions = [
  "Up to $10,000",
  "Up to $25,000",
  "Up to $50,000",
  "Up to $100,000",
  "Up to $250,000",
  "Up to $500,000",
  "Up to $1,000,000",
  "Over $1,000,000",
] as const;

// Employment status options
export const employmentStatusOptions = [
  "Full-time",
  "Part-time",
  "Contract",
  "Freelance",
  "Self-employed",
  "Unemployed",
  "Student",
  "Retired",
] as const;

// Annual Recurring Revenue options
export const annualRecurringRevenueOptions = [
  "Under $100K",
  "$100K - $500K",
  "$500K - $1M",
  "$1M - $5M",
  "$5M - $10M",
  "$10M - $50M",
  "$50M - $100M",
  "$100M - $500M",
  "$500M - $1B",
  "Over $1B",
] as const;

// Helper function to sort options with "Other" at the end
function sortWithOtherLast(options: readonly string[]): string[] {
  const rest = options
    .filter((o) => o !== "Other")
    .slice()
    .sort((a, b) => a.localeCompare(b));
  if (options.includes("Other")) {
    return [...rest, "Other"];
  }
  return rest;
}

// Pre-sorted option arrays (computed once at module load)
export const sortedIndustryOptions = [...industryOptions];
export const sortedDepartmentOptions = sortWithOtherLast(departmentOptions);
export const sortedDeviceOptions = sortWithOtherLast(deviceOptions);
export const sortedChannelOptions = sortWithOtherLast(channelOptions);
export const sortedPurchaseTriggersOptions = sortWithOtherLast(purchaseTriggersOptions);
export const sortedConsumerPurchaseTriggersOptions = sortWithOtherLast(consumerPurchaseTriggersOptions);

// Employment statuses that disable firmographic fields
export const nonEmployedStatuses = ["Unemployed", "Student", "Retired"] as const;

export const getOptionKey = (val: string): string => {
  return val
    .toLowerCase()
    .replace(/['’]/g, "-") // Convert apostrophes to dashes (e.g., associate's -> associate-s)
    .replace(/[^a-z0-9]+/g, "-") // Convert spaces/symbols to dashes
    .replace(/^-+|-+$/g, ""); // Trim leading/trailing dashes
};

