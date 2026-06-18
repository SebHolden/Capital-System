export function pearsonCorrelation(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 2) return null;

  const sliceA = a.slice(-n);
  const sliceB = b.slice(-n);
  const meanA = sliceA.reduce((s, v) => s + v, 0) / n;
  const meanB = sliceB.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = sliceA[i] - meanA;
    const db = sliceB[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }

  const den = Math.sqrt(denA * denB);
  if (den === 0) return null;
  return num / den;
}

export function correlationMatrix(
  series: Record<string, number[]>,
): Record<string, Record<string, number | null>> {
  const symbols = Object.keys(series);
  const matrix: Record<string, Record<string, number | null>> = {};

  for (const a of symbols) {
    matrix[a] = {};
    for (const b of symbols) {
      matrix[a][b] = a === b ? 1 : pearsonCorrelation(series[a], series[b]);
    }
  }

  return matrix;
}
