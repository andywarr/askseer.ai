# Custom Heuristics Implementation Guide

## Overview

This implementation adds the ability for company admins to create and manage custom heuristics for their company, and to hide global heuristic families (Nielsen, Tenets) from being available.

## What's Been Completed

### 1. ✅ Database Schema Updates

**Files Modified:**

- `apps/db-worker/prisma/schema.prisma`
- `apps/nextjs-app/prisma/schema.prisma`

**New Models:**

- `HeuristicFamily` - Represents a collection of heuristics (Nielsen, Tenets, or custom company sets)
- `CompanyHeuristicVisibility` - Junction table for companies to hide specific global families
- `Heuristic` - Updated to belong to a family instead of having a type
- `HeuristicExample` - Stores violation examples for each heuristic

**Key Changes:**

- `HeuristicEvaluation.type` → `HeuristicEvaluation.heuristicFamilyKey` (references family.key instead of enum)
- `Heuristic.type` removed, replaced with `Heuristic.heuristicFamilyId`
- Added `Heuristic.examples` relation
- `Company` now has `heuristicFamilies` and `heuristicVisibility` relations

### 2. ✅ Migration Script

**File:** `apps/db-worker/scripts/migrate-heuristics-to-families.ts`

This script:

- Creates HeuristicFamily records for NIELSEN and TENETS
- Migrates existing heuristics with example violations
- Updates HeuristicEvaluation records to use family keys
- Includes comprehensive example violations for each heuristic

**Run with:**

```bash
cd apps/db-worker
DRY_RUN=true npm run script:migrate-heuristics    # Preview changes
DRY_RUN=false npm run script:migrate-heuristics   # Apply migration
```

### 3. ✅ Database Service Layer

**File:** `apps/db-worker/src/services/databaseService.ts`

**New Functions:**

- `dbGetHeuristicFamilies()` - Get all available families for a company (respects visibility)
- `dbGetHeuristics()` - Updated to use family key and check visibility
- `dbGetCompanyMembership()` - Helper for authorization
- `dbCreateHeuristicFamily()` - Create custom family
- `dbUpdateHeuristicFamily()` - Update family metadata
- `dbDeleteHeuristicFamily()` - Delete custom family
- `dbToggleHeuristicFamilyVisibility()` - Show/hide global families
- `dbCreateHeuristic()` - Add heuristic to a family
- `dbUpdateHeuristic()` - Modify heuristic
- `dbDeleteHeuristic()` - Remove heuristic
- `dbCreateHeuristicExample()` - Add violation example
- `dbUpdateHeuristicExample()` - Modify example
- `dbDeleteHeuristicExample()` - Remove example

### 4. ✅ API Routes & Controllers

**Files:**

- `apps/db-worker/src/controllers/databaseController.ts`
- `apps/db-worker/src/routes/apiRoutes.ts`

**New Endpoints:**

```
GET    /api/heuristic-families                       # List available families
POST   /api/heuristic-families                       # Create family (admin only)
PATCH  /api/heuristic-families/:id                   # Update family (admin only)
DELETE /api/heuristic-families/:id                   # Delete family (admin only)
POST   /api/heuristic-families/:id/visibility        # Toggle visibility (admin only)

POST   /api/heuristics                               # Create heuristic (admin only)
PATCH  /api/heuristics/:id                           # Update heuristic (admin only)
DELETE /api/heuristics/:id                           # Delete heuristic (admin only)

POST   /api/heuristic-examples                       # Add example (admin only)
PATCH  /api/heuristic-examples/:id                   # Update example (admin only)
DELETE /api/heuristic-examples/:id                   # Delete example (admin only)
```

**Updated Endpoint:**

```
GET    /api/heuristics?type={familyKey}&companyId={companyId}
```

### 5. ✅ AI Worker Updates

**File:** `apps/ai-worker/src/heuristicEvaluation.ts`

**Changes:**

- Updated `Heuristic` interface to include examples
- Removed `type` field from result data
- Enhanced prompts to include heuristic examples for better AI evaluation
- Updated batch evaluation to format heuristics with examples

## What Needs to Be Done

### 6. ⏳ Next Steps Required

#### Step 1: Run Prisma Migrations

```bash
cd apps/db-worker
npx prisma migrate dev --name add_custom_heuristics
npx prisma generate

cd ../nextjs-app
npx prisma generate
```

#### Step 2: Run Data Migration

```bash
cd apps/db-worker
DRY_RUN=false npm run script:migrate-heuristics
```

#### Step 3: Update jobSchema

**File:** `apps/shared/jobSchema.ts`

Change `HeuristicEvaluationPayloadV2Schema`:

```typescript
heuristic: z.enum(["NIELSEN", "TENETS"]), // Old
// Change to:
heuristic: z.string(), // Now accepts any family key
```

#### Step 4: Add Next.js Server Actions

**Create File:** `apps/nextjs-app/lib/heuristic-actions.ts`

```typescript
"use server";

import { auth } from "@/apps/nextjs-app/auth";
import { logger } from "@/apps/shared/logger";

const DB_WORKER_URL = process.env.DB_WORKER_URL;

export async function getHeuristicFamilies(companyId?: string) {
  const session = await auth();
  if (!session?.userId) throw new Error("Unauthorized");

  const url = companyId
    ? `${DB_WORKER_URL}/api/heuristic-families?companyId=${companyId}`
    : `${DB_WORKER_URL}/api/heuristic-families`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch heuristic families");
  }

  const { data } = await response.json();
  return data;
}

export async function createHeuristicFamily(params: {
  name: string;
  key: string;
  description?: string;
  companyId: string;
}) {
  const session = await auth();
  if (!session?.userId) throw new Error("Unauthorized");

  const response = await fetch(`${DB_WORKER_URL}/api/heuristic-families`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, userId: session.userId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create heuristic family");
  }

  return response.json();
}

export async function toggleHeuristicFamilyVisibility(params: {
  familyId: string;
  companyId: string;
  isHidden: boolean;
}) {
  const session = await auth();
  if (!session?.userId) throw new Error("Unauthorized");

  const response = await fetch(
    `${DB_WORKER_URL}/api/heuristic-families/${params.familyId}/visibility`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isHidden: params.isHidden,
        companyId: params.companyId,
        userId: session.userId,
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to toggle visibility");
  }

  return response.json();
}

export async function createHeuristic(params: {
  heuristicFamilyId: string;
  category?: string;
  label?: string;
  heuristic: string;
  description?: string;
  companyId: string;
}) {
  const session = await auth();
  if (!session?.userId) throw new Error("Unauthorized");

  const response = await fetch(`${DB_WORKER_URL}/api/heuristics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, userId: session.userId }),
  });

  if (!response.ok) {
    throw new Error("Failed to create heuristic");
  }

  return response.json();
}

export async function createHeuristicExample(params: {
  heuristicId: string;
  title?: string;
  description: string;
  companyId: string;
}) {
  const session = await auth();
  if (!session?.userId) throw new Error("Unauthorized");

  const response = await fetch(`${DB_WORKER_URL}/api/heuristic-examples`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, userId: session.userId }),
  });

  if (!response.ok) {
    throw new Error("Failed to create example");
  }

  return response.json();
}

// Add similar functions for update and delete operations
```

#### Step 5: Update Heuristic Evaluation Form

**File:** `apps/nextjs-app/components/heuristic-evaluation-form.tsx`

Replace the hardcoded radio buttons with dynamic family selection:

```tsx
const [heuristicFamilies, setHeuristicFamilies] = useState([]);

useEffect(() => {
  async function loadFamilies() {
    try {
      const families = await getHeuristicFamilies(selectedTeam?.companyId);
      setHeuristicFamilies(families);
    } catch (error) {
      console.error("Failed to load heuristic families:", error);
    }
  }
  loadFamilies();
}, [selectedTeam]);

// In the form:
<FormField
  control={form.control}
  name="heuristic"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Which evaluation heuristics would you like to use?</FormLabel>
      <FormControl>
        <RadioGroup
          onValueChange={field.onChange}
          defaultValue={field.value}
          className="flex flex-col space-y-1"
        >
          {heuristicFamilies.map((family) => (
            <FormItem
              key={family.id}
              className="flex items-center space-y-0 space-x-3"
            >
              <FormControl>
                <RadioGroupItem value={family.key} />
              </FormControl>
              <FormLabel>{family.name}</FormLabel>
            </FormItem>
          ))}
        </RadioGroup>
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>;
```

#### Step 6: Create Admin UI for Managing Heuristics

**Create Component:** `apps/nextjs-app/components/heuristic-family-manager.tsx`

This component should:

- List all available families (global + custom)
- Allow toggling visibility for global families
- Allow creating new custom families
- Allow editing/deleting custom families
- Show heuristics within each family
- Allow adding/editing/deleting heuristics
- Allow adding/editing/deleting violation examples

**Create Page:** `apps/nextjs-app/app/(auth)/company/[id]/heuristics/page.tsx`

This page should:

- Check if user is company admin
- Display the HeuristicFamilyManager component
- Show global families with visibility toggles
- Show company-specific families with full CRUD

#### Step 7: Update Form Schema

**File:** `apps/nextjs-app/lib/schema.ts`

```typescript
// Update createHeuristicEvaluationSchema
heuristic: z.string().min(1, { message: "Please select a heuristic family" }),
```

## Database Schema Reference

### HeuristicFamily

- `id`: Unique identifier
- `name`: Display name (e.g., "Nielsen's 10 Usability Heuristics")
- `key`: Unique key (e.g., "NIELSEN", "TENETS", "CUSTOM_ACME_123")
- `description`: Optional description
- `companyId`: NULL for global families, set for custom families
- `heuristics`: Relation to Heuristic records
- `hiddenByCompanies`: Relation to CompanyHeuristicVisibility

### Heuristic

- `id`: Unique identifier
- `heuristicFamilyId`: References HeuristicFamily
- `category`: Optional grouping (e.g., "1", "2" for Nielsen)
- `label`: Short label (e.g., "Visibility of system status")
- `heuristic`: The full heuristic text
- `description`: Additional explanation
- `examples`: Relation to HeuristicExample records

### HeuristicExample

- `id`: Unique identifier
- `heuristicId`: References Heuristic
- `title`: Optional title (e.g., "No loading indicator")
- `description`: Description of the violation

### CompanyHeuristicVisibility

- `id`: Unique identifier
- `companyId`: References Company
- `heuristicFamilyId`: References HeuristicFamily
- `isHidden`: Boolean flag

## Authorization Rules

1. **View Heuristics**: All users can view heuristics from families available to their company
2. **Create Custom Families**: Company ADMIN or OWNER only
3. **Manage Custom Heuristics**: Company ADMIN or OWNER only (for their company's families)
4. **Toggle Visibility**: Company ADMIN or OWNER only (for global families)
5. **Modify Global Families**: Not allowed (system managed)

## Testing Checklist

- [ ] Run Prisma migrations successfully
- [ ] Run data migration script
- [ ] Verify NIELSEN and TENETS families created with all heuristics and examples
- [ ] Test creating a custom heuristic family as admin
- [ ] Test adding heuristics to custom family
- [ ] Test adding examples to custom heuristics
- [ ] Test hiding a global family
- [ ] Test running heuristic evaluation with custom family
- [ ] Test that non-admins cannot manage heuristics
- [ ] Test that users only see visible families in evaluation form
- [ ] Test that AI evaluation includes examples in prompts

## Migration Notes

⚠️ **Important**: The migration script will:

1. Delete all existing `Heuristic` records (they use the old schema)
2. Create new `HeuristicFamily` records for NIELSEN and TENETS
3. Create new `Heuristic` records with the new schema and examples
4. Update all `HeuristicEvaluation` records to use `heuristicFamilyKey`

⚠️ **Backup your database before running the migration!**

## Future Enhancements

1. **Import/Export Families**: Allow exporting and importing heuristic families
2. **Family Templates**: Provide templates for common heuristic sets
3. **Heuristic Reordering**: Allow drag-and-drop reordering of heuristics
4. **Example Images**: Add support for uploading example screenshots
5. **Heuristic Categories**: Better organization within families
6. **Sharing Families**: Allow sharing custom families between companies
7. **Version Control**: Track changes to heuristics over time

## Support

If you encounter issues:

1. Check Prisma client is regenerated after schema changes
2. Verify database migrations ran successfully
3. Check server logs for authorization errors
4. Ensure company membership and roles are correct
