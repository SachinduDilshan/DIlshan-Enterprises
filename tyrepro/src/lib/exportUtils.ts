import * as XLSX from "xlsx";

/* ------------------------------------------------------------------ */
/* Excel                                                               */
/* ------------------------------------------------------------------ */

function safeSheetName(name: string): string {
  return (name || "Sheet1").replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
}

export function exportToExcel(
  rows: Record<string, any>[],
  fileName: string,
  sheetName = "Sheet1"
) {
  if (!rows || rows.length === 0) return;

  const sheet = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0]);

  // Column widths follow the longest value in each column
  sheet["!cols"] = headers.map(h => {
    const longest = rows.reduce(
      (max, r) => Math.max(max, String(r[h] ?? "").length),
      h.length
    );
    return { wch: Math.min(Math.max(longest + 2, 10), 48) };
  });

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, safeSheetName(sheetName));
  XLSX.writeFile(book, `${fileName}.xlsx`);
}

/* ------------------------------------------------------------------ */
/* PDF (opens the browser print window, choose Save as PDF)            */
/* ------------------------------------------------------------------ */

export interface PdfSummaryItem {
  label: string;
  value: string;
}

type Cell = string | number | null | undefined;

const NAVY = "#15136B";
const ORANGE = "#F28B4A";

// The company mark (letter D inside a tyre), as a small inline image
const LOGO_MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="54" height="54">
<circle cx="100" cy="100" r="92" fill="none" stroke="${NAVY}" stroke-width="14" stroke-dasharray="17.23 5" stroke-dashoffset="8.6" transform="rotate(-90 100 100)"/>
<circle cx="100" cy="100" r="78" fill="none" stroke="${NAVY}" stroke-width="8"/>
<g transform="translate(100 100) scale(1.15) translate(-100 -100)">
<path fill-rule="evenodd" d="M63 58 H95 A42 42 0 0 1 95 142 H63 Z M85 78 H95 A22 22 0 0 1 95 122 H85 Z" fill="${NAVY}"/>
<circle cx="98.5" cy="100" r="8.5" fill="${ORANGE}"/>
</g></svg>`;

function esc(value: Cell): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const NUMERIC = /^(rs\.?|lkr)?\s?-?[\d,]+(\.\d+)?%?$/i;

function isNumericColumn(rows: ReadonlyArray<ReadonlyArray<Cell>>, index: number): boolean {
  const values = rows.map(r => String(r[index] ?? "").trim()).filter(Boolean);
  return values.length > 0 && values.every(v => NUMERIC.test(v));
}

export function exportToPDF(
  title: string,
  subtitle: string,
  headers: string[],
  rows: ReadonlyArray<ReadonlyArray<Cell>>,
  summary: PdfSummaryItem[] = []
) {
  if (typeof window === "undefined") return;

  const landscape = headers.length > 6;
  const right = headers.map((_, i) => isNumericColumn(rows, i));

  const generated = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const summaryHtml = summary.length
    ? `<div class="summary">${summary
        .map(
          s => `<div class="stat"><div class="stat-label">${esc(s.label)}</div><div class="stat-value">${esc(s.value)}</div></div>`
        )
        .join("")}</div>`
    : "";

  const headHtml = headers
    .map((h, i) => `<th class="${right[i] ? "num" : ""}">${esc(h)}</th>`)
    .join("");

  const bodyHtml = rows.length
    ? rows
        .map(
          r =>
            `<tr>${headers
              .map((_, i) => `<td class="${right[i] ? "num" : ""}">${esc(r[i])}</td>`)
              .join("")}</tr>`
        )
        .join("")
    : `<tr><td colspan="${headers.length}" class="empty">No records for this report.</td></tr>`;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(title)} - ${esc(subtitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;700&display=swap" rel="stylesheet">
<style>
  @page {
    size: A4 ${landscape ? "landscape" : "portrait"};
    margin: 14mm 12mm 16mm;
    @bottom-left { content: "Dilshan Enterprises"; font: 9px Arial, sans-serif; color: #6B6D80; }
    @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 9px Arial, sans-serif; color: #6B6D80; }
  }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; font-size: 11px; color: #1F2033; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding-bottom: 12px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand-name { font-family: "Poppins", Arial, sans-serif; font-weight: 700; font-size: 22px; line-height: 1; color: ${NAVY}; letter-spacing: -0.2px; }
  .brand-sub { font-family: "Poppins", Arial, sans-serif; font-weight: 500; font-size: 9px; line-height: 1; margin-top: 5px; color: ${NAVY}; letter-spacing: 0.3em; text-transform: uppercase; }
  .meta { text-align: right; }
  .doc-title { font-size: 17px; font-weight: 700; color: #1F2033; }
  .doc-sub { margin-top: 3px; font-size: 11px; color: #5B5D72; }
  .rule { height: 3px; background: ${NAVY}; position: relative; margin-bottom: 14px; }
  .rule::after { content: ""; position: absolute; left: 0; top: 0; height: 3px; width: 64px; background: ${ORANGE}; }
  .summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
  .stat { flex: 1 1 120px; border: 1px solid #E3E4EF; border-radius: 6px; padding: 8px 10px; background: #F7F7FB; }
  .stat-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #5B5D72; }
  .stat-value { margin-top: 3px; font-size: 14px; font-weight: 700; color: ${NAVY}; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { background: ${NAVY}; color: #fff; font-size: 10px; font-weight: 600; text-align: left; padding: 7px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #E3E4EF; vertical-align: top; }
  tr { page-break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #F7F7FB; }
  .num { text-align: right; white-space: nowrap; }
  .empty { text-align: center; color: #5B5D72; padding: 24px; }
  .foot { margin-top: 12px; font-size: 9px; color: #6B6D80; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <div class="head">
    <div class="brand">
      ${LOGO_MARK}
      <div>
        <div class="brand-name">DILSHAN</div>
        <div class="brand-sub">Enterprises</div>
      </div>
    </div>
    <div class="meta">
      <div class="doc-title">${esc(title)}</div>
      <div class="doc-sub">${esc(subtitle)}</div>
    </div>
  </div>
  <div class="rule"></div>
  ${summaryHtml}
  <table>
    <thead><tr>${headHtml}</tr></thead>
    <tbody>${bodyHtml}</tbody>
  </table>
  <div class="foot">
    <span>Generated ${esc(generated)}</span>
    <span>${rows.length} ${rows.length === 1 ? "record" : "records"}</span>
  </div>
  <script>
    window.addEventListener("load", function () {
      var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      ready.then(function () {
        setTimeout(function () { window.focus(); window.print(); }, 200);
      });
    });
  </script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=1000,height=800");
  if (!win) {
    window.alert("Please allow pop-ups for this site to download the PDF report.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}