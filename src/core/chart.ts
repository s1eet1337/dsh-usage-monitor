/**
 * Tiny pure helpers that turn a series of numbers into SVG polyline data —
 * kept outside React so the geometry is unit-testable without a DOM.
 */

export interface SeriesGeometry {
  /** `x1,y1 x2,y2 …` point string for the polyline. */
  points: string
  /** Y pixel of the zero baseline (for a subtle grid line). */
  zeroY: number
  /** Nice maximum used by the y-axis labels. */
  max: number
  /** Fractional y for a value (0 = baseline, 1 = top). */
  yOf: (value: number) => number
}

export function buildLineGeometry(
  values: readonly number[],
  width: number,
  height: number,
  pad: number,
): SeriesGeometry {
  const count = values.length
  const innerW = Math.max(width - pad * 2, 1)
  const innerH = Math.max(height - pad * 2, 1)
  const max = values.reduce((m, v) => Math.max(m, Number.isFinite(v) ? v : 0), 0)
  const top = max > 0 ? max : 1
  const yOf = (value: number): number => pad + innerH - (Math.max(0, value) / top) * innerH
  const step = count > 1 ? innerW / (count - 1) : 0
  const parts: string[] = []
  for (let i = 0; i < count; i++) {
    const x = pad + i * step
    const y = yOf(values[i] ?? 0)
    parts.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return {
    points: parts.join(' '),
    zeroY: yOf(0),
    max: top,
    yOf,
  }
}

/** Area fill path (line + down to baseline + close). */
export function buildAreaPath(points: string, zeroY: number): string {
  if (points === '') return ''
  const last = points.split(' ').pop() ?? ''
  return `M ${points} L ${last} L 0,0 L 0,${zeroY.toFixed(2)} Z`
}

/** Pick ~3 nice y-axis tick values between 0 and max. */
export function yTicks(max: number, count = 3): number[] {
  if (max <= 0) return [0]
  const rough = max / count
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / mag
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  const step = nice * mag
  const ticks: number[] = []
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(v)
  if (ticks.length === 0) ticks.push(0)
  return ticks
}
