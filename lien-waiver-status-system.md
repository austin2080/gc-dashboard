# Lien Waiver Status & Labeling System

## Goals
- Keep statuses simple and intuitive for non-technical users.
- Make lien risk obvious at a glance.
- Keep this system focused only on lien waivers (not schedule, tasks, or project management progress).

## Status Set

| Status | Color Suggestion | Short Description | Lien Risk Signal |
|---|---|---|---|
| Not Requested | Gray (`#6B7280`) | No waiver has been requested yet. | Medium (unknown until requested) |
| Requested | Blue (`#2563EB`) | Waiver request has been sent and is awaiting response. | Medium |
| Received – Review Needed | Amber (`#D97706`) | Waiver has been received but still needs internal review. | Medium-High |
| Ready for Payment | Teal (`#0D9488`) | Waiver review is complete and payment can proceed. | Low |
| Paid – Waiver Pending | Orange (`#EA580C`) | Payment has been made but final waiver is still outstanding. | High |
| Complete | Green (`#16A34A`) | Payment is made and required waiver documents are complete. | Very Low |
| Rejected / Invalid | Red (`#DC2626`) | Submitted waiver is unusable and must be corrected. | High |

## Plain-Language Definitions (for tooltips/help text)
- **Not Requested:** "We have not asked for this lien waiver yet."
- **Requested:** "We asked for this lien waiver and are waiting for it."
- **Received – Review Needed:** "We got the waiver, but someone still needs to confirm it is correct."
- **Ready for Payment:** "The waiver is acceptable and payment can be released."
- **Paid – Waiver Pending:** "Payment went out, but final waiver protection is not in hand yet."
- **Complete:** "Payment and waiver documentation are complete."
- **Rejected / Invalid:** "The waiver had issues and cannot be accepted as submitted."

## Table Appearance Guidelines
Use compact, easy-to-scan status pills.

### In waiver tables (row-level)
- Show a **status pill** (label + color) in a dedicated "Waiver Status" column.
- Add an optional **risk badge** next to the pill:
  - `High Risk` (red)
  - `Medium Risk` (amber)
  - `Low Risk` (green)
- Keep wording short in cells (use full sentence only in hover tooltip).

### Suggested table label format
- `Not Requested`
- `Requested`
- `Review Needed`
- `Ready for Payment`
- `Paid, Waiver Pending`
- `Complete`
- `Invalid`

## Summary Appearance Guidelines
For summary cards, reports, and rollups:

- Group by risk-first language so leadership can scan quickly:
  - **High Risk Waivers**
  - **Medium Risk Waivers**
  - **Low Risk Waivers**
- Also provide count by status underneath (e.g., `Requested: 14`, `Complete: 62`).
- Use consistent colors between table pills and summary visuals.
- Include a short legend: "Colors show lien documentation risk, not project progress."

## Recommended Display Copy (header/subheader)
- **Header:** `Lien Waiver Status`
- **Subheader:** `Tracks waiver documentation risk for payments.`

## Design Principles to Preserve
- One status per waiver at a time.
- Avoid internal/legal jargon in primary labels.
- Prefer action clarity over document-type complexity.
- Keep this taxonomy separate from project schedule/task status systems.
