export function money(n: number, dp = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

export function compact(n: number): string {
  if (n === 0) return "0";
  if (n < 1000) return money(n, 2);
  return n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });
}

export function pct(n: number | null, dp = 2): string {
  if (n === null || !Number.isFinite(n)) return "n/a";
  return `${(n * 100).toFixed(dp)}%`;
}

export function shortKey(k: string): string {
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}
