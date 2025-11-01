# Persona Versioning Implementation

## Overview

This document describes the persona versioning feature that allows users to edit personas even after they have been used in studies (evaluations or walkthroughs). When a persona is edited, a new version is created rather than modifying the original.

## Key Changes

### Schema Changes (`apps/db-worker/prisma/schema.prisma`)

Added three new fields to the `Persona` model:

- `personaGroupId`: Groups all versions of a persona together
- `version`: Version number (1, 2, 3, etc.)
- `isLatest`: Boolean flag indicating the most recent version

Added indexes for efficient querying:

- `@@index([personaGroupId])`
- `@@index([personaGroupId, version])`
- `@@index([personaGroupId, isLatest])`
- `@@unique([personaGroupId, version])`

### Migration

**Important**: Run the Prisma migration first, then run the data migration script:

```bash
# 1. Generate and apply the Prisma migration (DO NOT RUN YET per user request)
# cd apps/db-worker
# npx prisma migrate dev --name add_persona_versioning

# 2. Regenerate Prisma client
# npx prisma generate

# 3. Run the data migration script
# npx tsx apps/db-worker/scripts/migrate-persona-versioning.ts
```

The migration script (`apps/db-worker/scripts/migrate-persona-versioning.ts`) backfills existing personas:

- Sets `personaGroupId` to the persona's current `id`
- Sets `version` to `1`
- Sets `isLatest` to `true`

### Database Service Changes (`apps/db-worker/src/services/databaseService.ts`)

#### `dbPostPersona`

- Now sets `personaGroupId`, `version`, and `isLatest` when creating new personas
- For new personas: `personaGroupId` = `studyId`, `version` = 1, `isLatest` = true

#### `dbUpdatePersona`

- **Breaking change**: Now creates a new persona version instead of updating in place
- Process:
  1. Fetches the current persona
  2. Marks it as `isLatest = false`
  3. Creates a new Study for the new version
  4. Creates a new Persona with:
     - Same `personaGroupId`
     - Incremented `version`
     - `isLatest = true`
     - New data
- Returns: `{ persona, study }` instead of just persona

#### `dbListPersonas`

- Now filters to only return personas where `isLatest = true`
- This ensures dropdowns only show the latest version of each persona

#### `dbGetPersonaVersions` (new)

- New function to fetch all versions of a persona group
- Used for version history views
- Returns personas ordered by version (descending)

### Frontend Changes

#### Edit Page (`apps/nextjs-app/app/(auth)/persona/[id]/edit/page.tsx`)

- **Removed** the restriction preventing edits of personas with associated studies
- Users can now edit any persona they own

#### Update Action (`apps/nextjs-app/lib/action.ts`)

- Updated `updatePersona` to handle new response structure
- Now revalidates both old and new study paths
- Returns `newStudyId` to client

#### Persona Form (`apps/nextjs-app/components/persona-form.tsx`)

- Updated to redirect to the NEW study ID after update
- Falls back to original study ID if new one not provided

### Database Worker Controller

- No changes needed - already returns the result from `dbUpdatePersona`

## Behavior

### Creating a New Persona

1. User creates a persona
2. System creates a Study with type `PERSONA`
3. System creates a Persona with:
   - `personaGroupId` = Study ID
   - `version` = 1
   - `isLatest` = true

### Editing an Existing Persona

1. User edits a persona (any version, even if used in studies)
2. System:
   - Marks current version as `isLatest = false`
   - Creates a NEW Study
   - Creates a NEW Persona version with:
     - Same `personaGroupId` as previous version
     - `version` = previous version + 1
     - `isLatest` = true`
     - New data
3. User is redirected to the new version

### Using a Persona in a Study (Evaluation/Walkthrough)

- Studies link to the specific persona version they were created with
- This preserves the historical accuracy of studies
- The link is via `personaId` (not `personaGroupId`)

### Viewing Personas

- **Persona List/Dropdowns**: Only latest versions shown (`isLatest = true`)
- **Study Details**: Shows the specific version used (via `personaId`)
- **Persona Detail Page** (future enhancement): Can show version number and link to history

## Future Enhancements

### Persona Detail Page Updates (TODO - Requires Prisma Client Regeneration)

The persona detail page (`apps/nextjs-app/app/(auth)/persona/[id]/page.tsx`) should be enhanced to:

1. Display the current version number (e.g., "Version 3" badge next to title)
2. Show a list of previous versions with links
3. Allow viewing (read-only) of previous versions
4. When displaying a persona from a study context, optionally show "Latest version available" link if viewing an older version

**Implementation Note**: This requires:

- Accessing `study.persona.version`, `study.persona.personaGroupId`, and `study.persona.isLatest`
- Fetching persona versions using a new API endpoint that calls `dbGetPersonaVersions`
- Adding UI components for version navigation

Example additions to the persona page:

```tsx
// Add after the title
{
  study.persona.version && (
    <div className="mt-2 flex items-center gap-2">
      <span className="badge">Version {study.persona.version}</span>
      {!study.persona.isLatest && (
        <Link href={`/persona/versions/${study.persona.personaGroupId}`}>
          View latest version
        </Link>
      )}
    </div>
  );
}
```

### API Endpoints Needed

Add to `apps/db-worker/src/routes/apiRoutes.ts`:

```typescript
router.get("/persona/versions/:personaGroupId", getPersonaVersions);
```

Add controller in `apps/db-worker/src/controllers/databaseController.ts`:

```typescript
export const getPersonaVersions = async (req, res, next) => {
  const { personaGroupId } = req.params;
  const { userId } = req.query;
  const versions = await dbGetPersonaVersions(personaGroupId, userId);
  res.json({ success: true, data: versions });
};
```

### Version History UI

Consider adding:

- A version selector/dropdown in the persona header
- Diff view between versions showing what changed
- Ability to "restore" a previous version (creates new version with old data)
- Timeline view of all versions with edit dates and authors

## Notes

- TypeScript errors in database service are expected until Prisma client is regenerated
- All versions of a persona share the same `personaGroupId`
- Only one version per group should have `isLatest = true`
- Studies maintain links to the specific version they used
- The migration script is idempotent - safe to run multiple times

## Testing Checklist

After running migrations:

- [ ] Can create new personas
- [ ] Can edit personas (creates new version)
- [ ] Persona dropdowns only show latest versions
- [ ] Studies maintain correct persona links
- [ ] Edit page doesn't block editing of used personas
- [ ] Redirects work correctly after editing
- [ ] Version numbers increment correctly
- [ ] Only one version per group has `isLatest = true`
