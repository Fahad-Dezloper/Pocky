import { getAssetStats, getDepth, verifyIssuer } from "@/lib/stellar";
import { USDC, YIELD_ASSETS } from "@/lib/assets";
import { compact, pct } from "@/lib/format";

export const revalidate = 300;

/** Minimum resting bid depth, in USDC, before instant spend is honest. */
const INSTANT_MIN = 1000;
/** Below this, a book has dust rather than a market. */
const DUST = 1;

export default async function EarnPage() {
  const rows = await Promise.all(
    YIELD_ASSETS.map(async (a) => {
      const [depth, stats, trust] = await Promise.all([
        getDepth(a, USDC).catch(() => null),
        getAssetStats(a).catch(() => ({ holders: null, supply: null })),
        verifyIssuer(a).catch(() => ({ verified: false, reason: "lookup failed" })),
      ]);
      return { asset: a, depth, stats, trust };
    }),
  );
  const sorted = rows.sort(
    (x, y) => (y.depth?.bidDepth ?? 0) - (x.depth?.bidDepth ?? 0),
  );
  const spendable = sorted.filter(
    (r) => (r.depth?.bidDepth ?? 0) >= INSTANT_MIN,
  );

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section>
        <h1 style={{ fontSize: 24, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          What actually earns, and what you can actually get out of
        </h1>
        <p
          style={{
            color: "var(--muted)",
            margin: 0,
            maxWidth: 680,
            lineHeight: 1.55,
          }}
        >
          Yield is the easy half. The half that breaks products is exit
          liquidity, so this page measures it live rather than assuming it. Only{" "}
          <strong style={{ color: "var(--text)" }}>
            {spendable.length} of {sorted.length}
          </strong>{" "}
          of these assets has enough resting demand to be spent instantly today.
          The rest are holds, and the wallet says so instead of failing at the
          moment of payment.
        </p>
      </section>

      <section className="card">
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "baseline",
            gap: 8,
          }}
        >
          <strong style={{ fontSize: 14 }}>Order book depth against USDC</strong>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>
            live from Horizon
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Backing</th>
                <th className="r">Holders</th>
                <th className="r">Bid depth</th>
                <th className="r">Bids / asks</th>
                <th className="r">Spread</th>
                <th className="r">Instant spend</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ asset, depth, stats, trust }) => {
                const bd = depth?.bidDepth ?? 0;
                const ok = bd >= INSTANT_MIN;
                const hasMarket = bd >= DUST;
                return (
                  <tr key={asset.code}>
                    <td>
                      <strong>{asset.code}</strong>
                      <div
                        style={{
                          color: "var(--muted)",
                          fontSize: 11,
                          marginTop: 1,
                        }}
                      >
                        {trust.verified ? (
                          <span className="chip chip-ok">SEP-1 verified</span>
                        ) : (
                          <span className="chip chip-bad" title={trust.reason}>
                            unverified
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ color: "var(--muted)", maxWidth: 230 }}>
                      {asset.backing}
                    </td>
                    <td className="r num">{stats.holders ?? "n/a"}</td>
                    <td
                      className="r num"
                      style={{
                        color: ok ? "var(--text)" : "var(--danger)",
                        fontWeight: 600,
                      }}
                    >
                      {hasMarket ? compact(bd) : "none"}
                    </td>
                    <td className="r num" style={{ color: "var(--muted)" }}>
                      {depth ? `${depth.bidCount} / ${depth.askCount}` : "n/a"}
                    </td>
                    <td className="r num" style={{ color: "var(--muted)" }}>
                      {pct(depth?.spread ?? null)}
                    </td>
                    <td className="r">
                      {ok ? (
                        <span className="chip chip-ok">yes</span>
                      ) : hasMarket ? (
                        <span className="chip chip-warn">small size only</span>
                      ) : (
                        <span className="chip chip-bad">hold only</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div
          style={{
            padding: "12px 14px",
            borderTop: "1px solid var(--border)",
            color: "var(--muted)",
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          Bid depth is the total value of resting buy orders against USDC, which
          is what you could sell into right now without waiting for a new
          bidder. An asset with no bids is not worthless, it simply has no
          on-chain exit, so leaving it has to go through the issuer&apos;s
          redemption window instead. Every issuer here is checked against the{" "}
          <span className="mono">stellar.toml</span> of the domain it claims,
          because Stellar&apos;s asset namespace is widely impersonated.
        </div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <strong style={{ fontSize: 14 }}>Why this page exists</strong>
        <p
          style={{
            color: "var(--muted)",
            fontSize: 13,
            margin: "6px 0 0",
            lineHeight: 1.6,
            maxWidth: 720,
          }}
        >
          Stellar holds roughly 3.56 billion dollars of tokenised real world
          assets and under half a percent of it is used in any contract.
          Headline totals suggest a deep market; the order books say otherwise.
          Building a spend-from-yield wallet without measuring this first
          produces a product that demos well and fails on a real payment, so the
          measurement is part of the product rather than a footnote.
        </p>
      </section>
    </div>
  );
}
