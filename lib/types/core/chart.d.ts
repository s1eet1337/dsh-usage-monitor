/**
 * Tiny pure helpers that turn a series of numbers into SVG polyline data —
 * kept outside React so the geometry is unit-testable without a DOM.
 */
export interface SeriesGeometry {
    /** `x1,y1 x2,y2 …` point string for the polyline. */
    points: string;
    /** Y pixel of the zero baseline (for a subtle grid line). */
    zeroY: number;
    /** Nice maximum used by the y-axis labels. */
    max: number;
    /** Fractional y for a value (0 = baseline, 1 = top). */
    yOf: (value: number) => number;
}
export declare function buildLineGeometry(values: readonly number[], width: number, height: number, pad: number): SeriesGeometry;
/** Area fill path (line + down to baseline + close). */
export declare function buildAreaPath(points: string, zeroY: number): string;
/** Pick ~3 nice y-axis tick values between 0 and max. */
export declare function yTicks(max: number, count?: number): number[];
