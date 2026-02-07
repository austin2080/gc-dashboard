# Waiver Center Page Blueprint

## 1) Page Layout Sections

1. **Header / Page Identity**
   - Title: `Waiver Center`
   - Subtitle: `Compliance and waiver status across all projects`
   - Optional date context (e.g., "As of Today")

2. **Global Summary Strip (Top KPIs)**
   - High-visibility compliance counts for fast triage.
   - Suggested cards:
     - Total waiver items
     - Outstanding waivers
     - Missing waivers
     - Incomplete waivers
     - Overdue waivers
     - Ready for review

3. **Primary Work Queue (Main Table)**
   - A full-width table listing outstanding and non-compliant waiver items.
   - Default sort prioritizes highest-risk items first.

4. **Project Compliance Snapshot (Secondary Section)**
   - Compact table or cards summarizing waiver health by project.
   - Enables quick drill-in to a specific project.

5. **Contractor Compliance Snapshot (Secondary Section)**
   - Compact table ranking contractors/vendors by unresolved waiver counts.
   - Enables quick drill-in to a specific contractor.

6. **Detail Drawer / Side Panel (On Selection)**
   - Opens when a row is selected from any table.
   - Displays waiver item details and linked records for context.

---

## 2) Tables and Widgets to Include

### A) KPI Cards (Widget Group)
Each card includes a count and optional trend arrow (up/down vs prior period):
- `Outstanding`
- `Missing`
- `Incomplete`
- `Overdue`
- `Pending Review`
- `Compliant`

### B) Outstanding Waivers Table (Primary)
Recommended columns:
- Waiver ID / Reference
- Project Name
- Contractor / Vendor
- Waiver Type (Conditional Progress, Unconditional Final, etc.)
- Coverage Period
- Due Date
- Status
- Days Outstanding
- Last Updated
- Assignee / Owner (optional)
- Actions (View, Open Project, Open Contractor)

### C) Project Compliance Table
Recommended columns:
- Project Name
- Total Waiver Items
- Outstanding
- Missing
- Incomplete
- Overdue
- Compliance %
- Last Activity

### D) Contractor Compliance Table
Recommended columns:
- Contractor Name
- Projects Involved
- Total Waiver Items
- Outstanding
- Missing
- Incomplete
- Overdue
- Compliance %
- Last Submission Date

### E) Mini Trend Widget (Optional)
- 30-day unresolved waiver trend line.
- Helps users see whether backlog is improving.

---

## 3) Filters and Sorting Options

### Global Filters
- Project (single or multi-select)
- Contractor/Vendor (single or multi-select)
- Waiver Status (Outstanding, Missing, Incomplete, Overdue, Compliant)
- Waiver Type
- Due Date Range
- Coverage Period
- Compliance Risk (High/Medium/Low)
- Document Presence (Has file / No file)

### Quick Filter Chips
- `Only Missing`
- `Only Overdue`
- `Needs Review`
- `Expiring Soon`
- `No Attachment`

### Suggested Sorting (Primary Table)
- Default: Overdue first, then oldest due date
- Alternative user sorts:
  - Due Date (oldest/newest)
  - Days Outstanding (high/low)
  - Project Name (A–Z)
  - Contractor Name (A–Z)
  - Status severity (risk order)

---

## 4) Example Status Labels and Counts

### Status Labels
- `Missing`
- `Incomplete`
- `Overdue`
- `Pending Review`
- `Received`
- `Compliant`
- `Rejected`
- `Exception Requested`

### Example Top-Level Counts
- Total waiver items: **1,248**
- Outstanding: **319**
- Missing: **96**
- Incomplete: **143**
- Overdue: **80**
- Pending Review: **61**
- Compliant: **929**

### Example Severity Buckets
- High Risk (Missing + Overdue > 30 days): **44**
- Medium Risk (Overdue 1–30 days / Incomplete critical fields): **112**
- Low Risk (Pending review or recently requested): **163**

---

## 5) Drill-In Behavior (UX Expectations)

- Clicking a **project name** opens a project-specific waiver view filtered to that project.
- Clicking a **contractor name** opens a contractor-specific waiver view across relevant projects.
- Clicking a **status badge** applies that status filter immediately.
- "View Details" opens a side panel with waiver history, document presence, and submission timeline.

This structure keeps the page focused on lien waiver compliance visibility and rapid issue resolution.
