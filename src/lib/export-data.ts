/** Client-side export helpers: CSV, Excel, PDF, print and clipboard. */

export type ExportRow = {
  registration_number: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  registered_at: string;
  event?: { name: string } | null;
  desk?: { name: string; code?: string } | null;
  values?: { field_key: string; value: string | null }[] | null;
};

export function flattenRows(rows: ExportRow[]): Record<string, string>[] {
  return rows.map((row) => {
    const base: Record<string, string> = {
      Number: row.registration_number,
      Name: row.full_name,
      Phone: row.phone ?? "",
      Email: row.email ?? "",
      Location: row.location ?? "",
      Event: row.event?.name ?? "",
      Desk: row.desk?.name ?? "",
      Registered: new Date(row.registered_at).toLocaleString(),
    };
    for (const value of row.values ?? []) base[value.field_key] = value.value ?? "";
    return base;
  });
}

export function headersOf(rows: Record<string, string>[]): string[] {
  return [...new Set(rows.flatMap((row) => Object.keys(row)))];
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function toCsv(rows: Record<string, string>[]): string {
  if (rows.length === 0) return "";
  const headers = headersOf(rows);
  const escape = (value: string) => `"${(value ?? "").replace(/"/g, '""')}"`;
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header] ?? "")).join(",")),
  ].join("\n");
}

export function exportCsv(rows: Record<string, string>[], name: string) {
  download(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
}

export async function exportXlsx(rows: Record<string, string>[], name: string) {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Data");
  const out = XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  download(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${name}.xlsx`,
  );
}

export async function exportPdf(rows: Record<string, string>[], name: string, title: string) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape" });
  const headers = headersOf(rows);
  doc.setFontSize(14);
  doc.text(title, 14, 14);
  doc.setFontSize(9);
  doc.text(`${rows.length} record(s) · ${new Date().toLocaleString()}`, 14, 20);
  autoTable(doc, {
    startY: 25,
    head: [headers],
    body: rows.map((row) => headers.map((header) => row[header] ?? "")),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [11, 31, 58] },
  });
  doc.save(`${name}.pdf`);
}

export function printRows(rows: Record<string, string>[], title: string) {
  const headers = headersOf(rows);
  const win = window.open("", "_blank", "width=1000,height=700");
  if (!win) return;
  win.document.write(`<!doctype html><html><head><title>${title}</title><style>
    body{font-family:system-ui,sans-serif;padding:24px;color:#111}
    h1{font-size:18px;margin:0 0 4px}p{color:#555;font-size:12px;margin:0 0 16px}
    table{border-collapse:collapse;width:100%;font-size:11px}
    th,td{border:1px solid #ddd;padding:6px;text-align:left}
    th{background:#0B1F3A;color:#fff}
  </style></head><body><h1>${title}</h1><p>${rows.length} record(s) · ${new Date().toLocaleString()}</p>
  <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>
  ${rows
    .map(
      (row) => `<tr>${headers.map((h) => `<td>${(row[h] ?? "").toString()}</td>`).join("")}</tr>`,
    )
    .join("")}
  </tbody></table></body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

export async function copyTable(rows: Record<string, string>[]): Promise<void> {
  const headers = headersOf(rows);
  const text = [
    headers.join("\t"),
    ...rows.map((row) => headers.map((header) => row[header] ?? "").join("\t")),
  ].join("\n");
  await navigator.clipboard.writeText(text);
}
