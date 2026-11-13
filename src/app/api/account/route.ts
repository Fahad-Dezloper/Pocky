import { NextRequest, NextResponse } from "next/server";
import { getBalances } from "@/lib/stellar";
import { ASSETS, assetId } from "@/lib/assets";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address || !/^G[A-Z2-7]{55}$/.test(address)) {
    return NextResponse.json(
      { error: "Provide a valid Stellar public key (G...)" },
      { status: 400 },
    );
  }
  try {
    const balances = await getBalances(address);
    const known = new Map(ASSETS.map((a) => [assetId(a), a]));
    const enriched = balances.map((b) => {
      const def = b.issuer ? known.get(`${b.code}:${b.issuer}`) : undefined;
      return {
        ...b,
        name: def?.name ?? null,
        kind: def?.kind ?? (b.code === "XLM" ? "cash" : null),
        yieldBearing: def?.yieldBearing ?? false,
        recognised: Boolean(def) || b.code === "XLM",
      };
    });
    return NextResponse.json({ address, balances: enriched });
  } catch (err) {
    const message = err instanceof Error ? err.message : "lookup failed";
    const notFound = message.includes("404");
    return NextResponse.json(
      {
        error: notFound
          ? "That account does not exist on Stellar mainnet yet."
          : message,
      },
      { status: notFound ? 404 : 502 },
    );
  }
}
