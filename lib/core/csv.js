/**
 * Minimal dependency-free CSV writer (pure).
 * Exported rows are always full-width (all columns present) so a UTF-8 BOM is
 * added by default for Excel compatibility.
 */
function escapeField(value) {
    if (value === null || value === undefined)
        return '';
    const text = typeof value === 'string' ? value : String(value);
    if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}
export function toCsv(rows, columns, bom = true) {
    const head = columns.map((c) => escapeField(c.label)).join(',');
    const body = rows.map((row) => columns.map((c) => escapeField(row[c.key])).join(',')).join('\r\n');
    return `${bom ? '\uFEFF' : ''}${head}\r\n${body}\r\n`;
}
