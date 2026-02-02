/**
 * Axis scaling, tick generation, and data normalization utilities
 * for the Delta viz framework.
 */

/** Calculate nice axis bounds with padding */
export function niceScale(
  min: number,
  max: number,
  tickCount: number = 5
): { min: number; max: number; ticks: number[] } {
  if (min === max) {
    return { min: min - 1, max: max + 1, ticks: [min - 1, min, max + 1] };
  }

  const range = max - min;
  const roughStep = range / (tickCount - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / mag;

  let niceStep: number;
  if (residual <= 1.5) niceStep = mag;
  else if (residual <= 3) niceStep = 2 * mag;
  else if (residual <= 7) niceStep = 5 * mag;
  else niceStep = 10 * mag;

  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;

  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + niceStep * 0.5; v += niceStep) {
    ticks.push(Math.round(v * 1e10) / 1e10);
  }

  return { min: niceMin, max: niceMax, ticks };
}

/** Map a value from [min, max] to [outMin, outMax] */
export function mapRange(
  value: number,
  min: number,
  max: number,
  outMin: number,
  outMax: number
): number {
  if (max === min) return (outMin + outMax) / 2;
  return outMin + ((value - min) / (max - min)) * (outMax - outMin);
}

/** Generate evenly spaced labels for a set of data points */
export function sparseLabels(labels: string[], maxCount: number): (string | null)[] {
  if (labels.length <= maxCount) return labels;
  const step = Math.ceil(labels.length / maxCount);
  return labels.map((l, i) => (i % step === 0 || i === labels.length - 1 ? l : null));
}

/** Create bins for histogram from raw values */
export function histogram(
  values: number[],
  binCount: number = 10
): { bins: { x0: number; x1: number; count: number }[]; max: number } {
  if (values.length === 0) return { bins: [], max: 0 };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const binWidth = (max - min) / binCount || 1;

  const bins = Array.from({ length: binCount }, (_, i) => ({
    x0: min + i * binWidth,
    x1: min + (i + 1) * binWidth,
    count: 0,
  }));

  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binWidth), binCount - 1);
    bins[idx].count++;
  }

  return { bins, max: Math.max(...bins.map(b => b.count)) };
}

/** Format a number for axis labels (compact) */
export function formatAxisValue(value: number): string {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(1);
}
