/**
 * Minimal dependency-free CSV writer (pure).
 * Exported rows are always full-width (all columns present) so a UTF-8 BOM is
 * added by default for Excel compatibility.
 */
export interface CsvColumn {
    key: string;
    label: string;
}
export declare function toCsv(rows: readonly Record<string, unknown>[], columns: readonly CsvColumn[], bom?: boolean): string;
