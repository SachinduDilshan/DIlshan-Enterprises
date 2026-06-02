/**
 * Export utilities for reports
 * PDF uses browser print API (no extra library needed)
 * Excel uses SheetJS (xlsx) which is already in package.json
 */

// ── Excel export ──────────────────────────────────────────

export async function exportToExcel(
  rows:     Record<string, string | number>[],
  filename: string,
  sheetName = "Report"
) {
  const XLSX = await import("xlsx");
  const ws   = XLSX.utils.json_to_sheet(rows);
  const wb   = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Auto column widths
  const colWidths = Object.keys(rows[0] ?? {}).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? "").length)) + 2,
  }));
  ws["!cols"] = colWidths;

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ── PDF export ────────────────────────────────────────────
// Opens a print-ready HTML page in a new tab → user saves as PDF

export function exportToPDF(
  title:    string,
  subtitle: string,
  headers:  string[],
  rows:     (string | number)[][],
  summaryRows?: { label: string; value: string }[]
) {
  const tableRows = rows.map(row =>
    `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`
  ).join("");

  const summaryHtml = summaryRows
    ? `<div class="summary">
        ${summaryRows.map(s => `
          <div class="summary-row">
            <span class="summary-label">${s.label}</span>
            <span class="summary-value">${s.value}</span>
          </div>`).join("")}
       </div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
    .header { margin-bottom: 20px; border-bottom: 2px solid #534AB7; padding-bottom: 12px; }
    .company { font-size: 18px; font-weight: bold; color: #534AB7; }
    .subtitle { font-size: 12px; color: #666; margin-top: 2px; }
    .report-title { font-size: 15px; font-weight: bold; margin-top: 8px; }
    .generated { font-size: 11px; color: #999; margin-top: 4px; }
    .summary { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
    .summary-row { background: #f4f3ff; border-radius: 6px; padding: 8px 14px; min-width: 140px; }
    .summary-label { display: block; font-size: 10px; color: #666; }
    .summary-value { display: block; font-size: 16px; font-weight: bold; color: #534AB7; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #534AB7; color: white; padding: 8px 10px; text-align: left; font-size: 11px; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .footer { margin-top: 20px; font-size: 10px; color: #aaa; text-align: center; }
    @media print {
      body { padding: 0; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">Dilshan Enterprises</div>
    <div class="subtitle">Tire Distributors — Anuradhapura District</div>
    <div class="report-title">${title}</div>
    <div class="generated">Generated: ${new Date().toLocaleString("en-LK")} · ${subtitle}</div>
  </div>
  ${summaryHtml}
  <table>
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="footer">Dilshan Enterprises — Confidential · Page 1</div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}