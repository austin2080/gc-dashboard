"use client";

export const ESTIMATE_EXPORT_REQUEST_EVENT = "estimate-export-request";
export const ESTIMATE_EXPORT_SNAPSHOT_STORAGE_KEY = "estimate-export-snapshot-v1";

export type EstimateExportSnapshotLineItem = {
  costCode: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  gcMarkup: string;
  total: string;
};

export type EstimateExportSnapshotDivision = {
  divisionCode: string;
  divisionTitle: string;
  subtotal: string;
  lineItems: EstimateExportSnapshotLineItem[];
};

export type EstimateExportSnapshot = {
  projectId: string;
  projectName: string;
  generatedAt: string;
  coverFields: Record<string, string>;
  projectPlanning: Record<string, string>;
  divisions: EstimateExportSnapshotDivision[];
  markupRows: Array<{ label: string; amount: string }>;
  subtotal: string;
  markupTotal: string;
  grandTotal: string;
};

function escapePdfText(value: string) {
  return value
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function formatSnapshotTimestamp(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString();
}

function parseCurrency(value: string) {
  const parsed = Number.parseFloat(value.replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function estimateTextWidth(text: string, fontSize: number) {
  return text.length * fontSize * 0.5;
}

function wrapText(text: string, maxWidth: number, fontSize: number) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return [""];
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (estimateTextWidth(next, fontSize) <= maxWidth || !current) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

function buildPdfDocument(pageContents: string[]) {
  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const fontObjectId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontObjectId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];

  for (const content of pageContents) {
    const streamLength = new TextEncoder().encode(content).length;
    const stream = `<< /Length ${streamLength} >>\nstream\n${content}\nendstream`;
    contentObjectIds.push(addObject(stream));
    pageObjectIds.push(0);
  }

  const pagesObjectId = addObject("");

  for (let index = 0; index < pageContents.length; index += 1) {
    const pageObjectId = addObject(
      `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectId} 0 R /F2 ${boldFontObjectId} 0 R >> >> /Contents ${contentObjectIds[index]} 0 R >>`
    );
    pageObjectIds[index] = pageObjectId;
  }

  objects[pagesObjectId - 1] =
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  const catalogObjectId = addObject(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function writeEstimateExportSnapshot(snapshot: EstimateExportSnapshot) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(ESTIMATE_EXPORT_SNAPSHOT_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, EstimateExportSnapshot>) : {};
    parsed[snapshot.projectId] = snapshot;
    localStorage.setItem(ESTIMATE_EXPORT_SNAPSHOT_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore export cache failures.
  }
}

export function readEstimateExportSnapshot(projectId: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ESTIMATE_EXPORT_SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, EstimateExportSnapshot>;
    return parsed[projectId] ?? null;
  } catch {
    return null;
  }
}

export function buildEstimatePdf(snapshot: EstimateExportSnapshot) {
  const pages: string[][] = [[]];
  let pageIndex = 0;
  let y = 748;

  const ensureSpace = (requiredHeight: number) => {
    if (y - requiredHeight >= 48) return;
    pageIndex += 1;
    pages[pageIndex] = [];
    y = 748;
  };

  const push = (line: string) => {
    pages[pageIndex].push(line);
  };

  const drawText = (
    x: number,
    posY: number,
    text: string,
    fontSize = 11,
    bold = false,
    align: "left" | "right" = "left"
  ) => {
    const safeText = escapePdfText(text);
    const adjustedX =
      align === "right" ? Math.max(40, x - estimateTextWidth(text, fontSize)) : x;
    push(`BT /${bold ? "F2" : "F1"} ${fontSize} Tf 1 0 0 1 ${adjustedX.toFixed(2)} ${posY.toFixed(2)} Tm (${safeText}) Tj ET`);
  };

  const drawRule = (x1: number, y1: number, x2: number, y2: number, width = 1) => {
    push(`${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  };

  const drawWrapped = (
    x: number,
    posY: number,
    text: string,
    maxWidth: number,
    fontSize = 11,
    bold = false
  ) => {
    const lines = wrapText(text, maxWidth, fontSize);
    lines.forEach((line, index) => {
      drawText(x, posY - index * (fontSize + 3), line, fontSize, bold);
    });
    return lines.length;
  };

  const cover = snapshot.coverFields;
  const planning = snapshot.projectPlanning;

  drawText(40, y, "Preliminary Estimate", 20, true);
  drawText(572, y, snapshot.projectName || "Untitled Project", 14, true, "right");
  y -= 26;
  drawText(40, y, `Generated ${formatSnapshotTimestamp(snapshot.generatedAt)}`, 10);
  y -= 18;
  drawRule(40, y, 572, y, 1.5);
  y -= 24;

  drawText(40, y, "Project Information", 13, true);
  y -= 18;
  drawText(40, y, "Client", 11, true);
  drawText(306, y, "Contractor", 11, true);
  y -= 16;

  const coverRows: Array<[string, string, string, string]> = [
    ["Name", cover["cover-attn-name"] ?? "", "Company", cover["cover-contractor-company"] ?? ""],
    ["Address", cover["cover-attn-address"] ?? "", "Name", cover["cover-contractor-name"] ?? ""],
    ["Phone", cover["cover-attn-phone"] ?? "", "Address", cover["cover-contractor-address"] ?? ""],
    ["Email", cover["cover-attn-email"] ?? "", "City, State ZIP", cover["cover-contractor-city-state-zip"] ?? ""],
    ["Project", cover["cover-project-name"] ?? "", "Phone", cover["cover-contractor-phone"] ?? ""],
    ["Architect", cover["cover-architect"] ?? "", "Email", cover["cover-contractor-email"] ?? ""],
    ["Bid Set Date", cover["cover-bid-set-date"] ?? "", "", ""],
  ];

  for (const row of coverRows) {
    ensureSpace(28);
    drawText(40, y, row[0], 10, true);
    drawText(108, y, row[1] || "-", 10);
    if (row[2]) {
      drawText(306, y, row[2], 10, true);
      drawText(404, y, row[3] || "-", 10);
    }
    y -= 16;
  }

  y -= 6;
  drawText(40, y, "Project Planning", 13, true);
  y -= 18;
  const planningRows: Array<[string, string]> = [
    ["Project Size (SQ FT)", planning["pp-project-size"] ?? ""],
    ["Project Site Size (SQ FT)", planning["pp-project-site-size"] ?? ""],
    ["Construction Start Date", planning["pp-start-date"] ?? ""],
    ["Construction Completion Date", planning["pp-completion-date"] ?? ""],
    ["Construction Duration (Weeks)", planning["pp-construction-duration"] ?? ""],
    ["Project Duration (Weeks)", planning["pp-project-duration"] ?? ""],
  ];
  for (const [label, value] of planningRows) {
    ensureSpace(18);
    drawText(40, y, label, 10, true);
    drawText(250, y, value || "-", 10);
    y -= 14;
  }

  y -= 8;
  drawText(40, y, "Estimate Summary", 13, true);
  y -= 18;
  drawText(40, y, "Subtotal", 10, true);
  drawText(572, y, snapshot.subtotal, 10, true, "right");
  y -= 14;
  drawText(40, y, "Markups", 10, true);
  drawText(572, y, snapshot.markupTotal, 10, true, "right");
  y -= 14;
  drawText(40, y, "Grand Total", 11, true);
  drawText(572, y, snapshot.grandTotal, 11, true, "right");

  pageIndex += 1;
  pages[pageIndex] = [];
  y = 748;

  drawText(40, y, "Preliminary Estimate Worksheet", 18, true);
  drawText(572, y, snapshot.projectName || "Untitled Project", 12, false, "right");
  y -= 22;
  drawRule(40, y, 572, y, 1.5);
  y -= 22;

  const tableHeader = () => {
    drawText(40, y, "Cost Code", 9, true);
    drawText(112, y, "Description", 9, true);
    drawText(360, y, "Qty", 9, true);
    drawText(395, y, "Unit", 9, true);
    drawText(450, y, "Unit Price", 9, true);
    drawText(520, y, "GC Markup", 9, true);
    drawText(572, y, "Total", 9, true, "right");
    y -= 10;
    drawRule(40, y, 572, y);
    y -= 16;
  };

  tableHeader();

  for (const division of snapshot.divisions) {
    ensureSpace(28);
    drawText(
      40,
      y,
      `${division.divisionCode ? `Division ${division.divisionCode}` : "Division"} ${division.divisionTitle}`,
      11,
      true
    );
    drawText(572, y, division.subtotal, 11, true, "right");
    y -= 16;

    for (const item of division.lineItems) {
      const wrappedDescription = wrapText(item.description || "-", 230, 9);
      const rowHeight = Math.max(14, wrappedDescription.length * 12);
      ensureSpace(rowHeight + 10);
      drawText(40, y, item.costCode, 9);
      wrappedDescription.forEach((line, index) => {
        drawText(112, y - index * 12, line, 9);
      });
      drawText(360, y, item.quantity || "-", 9);
      drawText(395, y, item.unit || "-", 9);
      drawText(488, y, item.unitPrice || "-", 9, false, "right");
      drawText(548, y, item.gcMarkup || "-", 9, false, "right");
      drawText(572, y, item.total || "-", 9, false, "right");
      y -= rowHeight;
    }
    y -= 8;
  }

  ensureSpace(snapshot.markupRows.length * 14 + 36);
  drawRule(40, y, 572, y, 1.5);
  y -= 18;
  drawText(40, y, "Markup Summary", 11, true);
  y -= 16;
  for (const row of snapshot.markupRows) {
    drawText(40, y, row.label, 10);
    drawText(572, y, row.amount, 10, false, "right");
    y -= 14;
  }
  y -= 4;
  drawRule(40, y, 572, y);
  y -= 16;
  drawText(40, y, "Grand Total", 12, true);
  drawText(572, y, snapshot.grandTotal, 12, true, "right");

  const pageContents = pages.map((lines) => lines.join("\n"));
  return buildPdfDocument(pageContents);
}
