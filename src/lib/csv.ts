/**
 * Minimal RFC-4180 CSV parser. Handles:
 *  - quoted fields with embedded commas, newlines, and "" escapes
 *  - Windows (CRLF) and Unix (LF) line endings
 *  - optional trailing newline
 *
 * Returns an array of rows; each row is an array of cell strings.
 * Empty trailing rows are dropped.
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          // Escaped quote
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }

    if (ch === "\r") {
      // Swallow; \n handles the line break
      i += 1;
      continue;
    }

    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }

    cell += ch;
    i += 1;
  }

  // Flush final cell / row if file didn't end with newline
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  // Drop trailing empty row that a final newline produces
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
}

/**
 * Parse CSV into an array of objects keyed by the header row.
 * Case-insensitive header matching; whitespace in headers is trimmed.
 */
export function parseCsvToObjects(input: string): Record<string, string>[] {
  const rows = parseCsv(input);
  if (rows.length === 0) return [];
  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((h) => h.trim().toLowerCase());
  return dataRows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((key, idx) => {
      obj[key] = (row[idx] ?? "").trim();
    });
    return obj;
  });
}

/**
 * Serialize a value for a CSV cell: quote if it contains comma, quote, or newline.
 */
export function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Build a CSV string from headers + rows of objects.
 */
export function buildCsv(
  headers: string[],
  rows: Array<Record<string, unknown>>,
): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      headers
        .map((h) => {
          const v = row[h];
          if (v === null || v === undefined) return "";
          return csvCell(String(v));
        })
        .join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}
