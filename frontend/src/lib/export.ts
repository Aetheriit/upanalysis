export type ExportValue = string | number | boolean | null | undefined;

export function downloadCsv(filename: string, rows: Record<string, ExportValue>[]) {
  if (!rows.length) return;
  const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  const escape = (value: ExportValue) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [
    columns.map(escape).join(","),
    ...rows.map(row => columns.map(column => escape(row[column])).join(",")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
