# Seer Figma Plugin

This is the Figma plugin for Seer, allowing you to export frames and pages directly from Figma to your Seer account for analysis.

## Development & Build

1. **Build the plugin**:
   ```bash
   yarn workspace seer-figma-plugin build
   ```
2. **Watch for changes (recommended for development)**:
   ```bash
   yarn workspace seer-figma-plugin watch
   ```

The compiled output will be generated in the `dist` directory.

---

## Loading the Plugin in Figma

1. Open the Figma desktop app.
2. Go to **Plugins -> Development -> New Plugin...**
3. Select **Import plugin from manifest...**
4. Choose the `manifest.json` file in this directory.

---

## Important Configuration for Forked Repositories

If you are hosting your own version of Seer:
1. **Change the Plugin ID**:
   - In `manifest.json`, the `"id"` field matches the official Seer plugin ID.
   - If you want to publish or use your own version, remove or change the `"id"` field in `manifest.json` so Figma generates a unique ID for your plugin.
2. **Allowed Domains**:
   - In `manifest.json`, update `"networkAccess.allowedDomains"` to match your production domain if you are hosting Seer on a different domain.
   - Update `API_BASE_URL` in `src/ui/ui.ts` if you want to point to a different hosted domain.
