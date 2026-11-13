import { NextRequest, NextResponse } from "next/server";
import { getStrictReceiveQuotes } from "@/lib/stellar";
import { findAsset } from "@/lib/assets";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const address = p.get("address");
  const code = p.get("code");
  const issuer = p.get("issuer") ?? undefined;
  const amount = Number(p.get("amount"));

  if (!address || !/^G[A-Z2-7]{55}$/.test(address)) {
    return NextResponse.json({ error: "Invalid sender address" }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: "Missing destination asset" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
  }

  const dest = findAsset(code, issuer);
  if (!dest) {
    return NextResponse.json(
      { error: `${code} is not in the verified asset registry` },
      { status: 400 },
    );
  }

  try {
    const quotes = await getStrictReceiveQuotes(address, dest, amount);
    // Cheapest route per source asset, so the UI shows one row per holding.
    const best = new Map<string, (typeof quotes)[number]>();
    for (const q of quotes) {
      const key = `${q.sourceCode}:${q.sourceIssuer ?? "native"}`;
      const prev = best.get(key);
      if (!prev || q.sourceAmount < prev.sourceAmount) best.set(key, q);
    }
    return NextResponse.json({
      destination: { code: dest.code, issuer: dest.issuer, amount },
      routes: [...best.values()].sort((a, b) => a.sourceAmount - b.sourceAmount),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "quote failed" },
      { status: 502 },
    );
  }
}
