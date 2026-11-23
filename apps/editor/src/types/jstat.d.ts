// The few jStat functions the chart statistics use (jStat ships no types).
declare module 'jstat' {
  export const jStat: {
    centralF: { cdf(x: number, df1: number, df2: number): number }
    chisquare: { cdf(x: number, dof: number): number }
    normal: { cdf(x: number, mean: number, sd: number): number; pdf(x: number, mean: number, sd: number): number; inv(p: number, mean: number, sd: number): number }
    studentt: { cdf(x: number, dof: number): number; inv(p: number, dof: number): number }
    tukey: { cdf(q: number, nmeans: number, dof: number): number }
    gammaln(x: number): number
  }
}
