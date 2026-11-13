import { NextResponse } from "next/server";
import { verifyIssuer } from "@/lib/stellar";
import { ASSETS, assetId } from "@/lib/assets";

export const revalidate = 3600;

/**
 * SEP-1 provenance for the whole registry.
 *
 * Stellar's asset namespace is heavily impersonated, so every asset is checked
 * against the stellar.toml of the domain it claims. Nothing is trusted because
 * its code looks familiar.
 */
export async function GET() {
  const rows = await Promise.all(
    ASSETS.map(async (a) => ({
      id: assetId(a),
      code: a.code,
      issuer: a.issuer,
      homeDomain: a.homeDomain,
      ...(await verifyIssuer(a)),
    })),
  );
  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    verified: rows.filter((r) => r.verified).length,
    total: rows.length,
    rows,
  });
}
