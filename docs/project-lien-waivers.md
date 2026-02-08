# Project-level Lien Waivers Page

## Layout
1. **Project Waivers Overview strip**
   - Missing waivers
   - Awaiting upload
   - Awaiting approval
   - Approved
   - Total exposure (all non-approved waiver amounts)
   - Vendors at risk
2. **Add / Generate Expected Waivers**
   - Select a pay app
   - Select waiver types
   - Generate missing rows for all vendors in the project
3. **Primary Waiver Table**
   - Columns: Vendor, Pay App #, Waiver Type, Amount, Status, Last updated, Actions
   - Actions (UI-only): View, Upload, Request
   - Filters: vendor, pay app, status, search
   - Sorting: amount, status, last updated
   - View mode toggle: flat list or grouped by pay app
4. **Vendor Focus mode**
   - Click vendor in table to focus on that vendor
   - Shows vendor-specific summary and exposure for this project

## Component breakdown
- `ProjectLienWaiversWorkspace`
  - Top-level project workspace for all waiver operations.
- `SummaryCard`
  - Compact metric card for overview strip values.
- `StatusPill` (shared)
  - Reused for waiver status rendering in row status cells.

## Data model / types
The page uses existing shared pay-app store types from `src/lib/pay-apps/types.ts`:
- `WaiverRecord`
  - `projectId`, `contractorId`, `payAppId`, `waiverType`, `status`, `amount`, `updatedAt`
- `Contractor`
  - vendor identity within project context
- `PayApp`
  - pay app identity and number for grouping/filtering
- `PayAppsData`
  - collection of pay apps, contractors, and waiver records

## Example mock data (single project)
Project: `default`
- Vendors: Atlas Concrete, Pioneer Mechanical, Summit Electrical
- Pay Apps: `PA-001`, `PA-002`
- Waivers include statuses across:
  - `conditional_progress`
  - `unconditional_progress`
  - `conditional_final`
  - `unconditional_final`

Seed source: `src/lib/pay-apps/mock-data.ts`.

## Update flow to Waiver Center
1. Project page updates waiver records through `upsertWaiverRecord(projectId, record)`.
2. Store writes to localStorage key `gc-dashboard.pay-apps` by project.
3. Waiver Center reads from the same store (`getProjectPayAppsData(projectId)`).
4. Waiver Center summary and rows are computed from that same record set.

This keeps project metrics and Waiver Center metrics aligned for the same project.
