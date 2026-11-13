import { NextResponse } from "next/server";
import { getAssetStats, getDepth } from "@/lib/stellar";
import { USDC, YIELD_ASSETS, assetId } from "@/lib/assets";

export const revalidate = 60;

/** Minimum resting bid depth, in USDC, before instant spend is honest. */
const INSTANT_MIN = 1000;
/** Below this, a book has dust rather than a market. */
const DUST = 1;

/**
 * Measured liquidity for every yield-bearing asset in the registry.
 * Used to decide, per asset, whether instant spend is honest.
 */
export async function GET() {
  const rows = await Promise.all(
    YIELD_ASSETS.map(async (a) => {
      const [depth, stats] = await Promise.all([
        getDepth(a, USDC).catch(() => null),
        getAssetStats(a).catch(() => ({ holders: null, supply: null })),
      ]);
      return {
        id: assetId(a),
        code: a.code,
        name: a.name,
        kind: a.kind,
        backing: a.backing,
        homeDomain: a.homeDomain,
        holders: stats.holders,
        bidDepth: depth?.bidDepth ?? 0,
        bidCount: depth?.bidCount ?? 0,
        askCount: depth?.askCount ?? 0,
        spread: depth?.spread ?? null,
        /** Instant spend is only offered where the book can absorb it. */
        instantSpendable: (depth?.bidDepth ?? 0) >= INSTANT_MIN,
        /** Below DUST there is no market at all, only stray orders. */
        hasMarket: (depth?.bidDepth ?? 0) >= DUST,
      };
    }),
  );
  return NextResponse.json({
    measuredAt: new Date().toISOString(),
    counterAsset: "USDC",
    rows: rows.sort((a, b) => b.bidDepth - a.bidDepth),
  });
}
