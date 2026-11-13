"use client";

import { useCallback, useState } from "react";
import { AddressInput } from "@/components/AddressInput";
import { SETTLEMENT_ASSETS } from "@/lib/assets";
import { money, shortKey } from "@/lib/format";

type Route = {
  destinationAmount: number;
  sourceAmount: number;
  sourceCode: string;
  sourceIssuer?: string;
  hops: string[];
};

export default function SendPage() {
  const [address, setAddress] = useState("");
  const [code, setCode] = useState(SETTLEMENT_ASSETS[0].code);
  const [amount, setAmount] = useState("25");
  const [routes, setRoutes] = useState<Route[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const quote = useCallback(async () => {
    setBusy(true);
    setError(null);
    setRoutes(null);
    const asset = SETTLEMENT_ASSETS.find((a) => a.code === code)!;
    try {
      const qs = new URLSearchParams({
        address,
        code: asset.code,
        issuer: asset.issuer,
        amount,
      });
      const res = await fetch(`/api/quote?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "quote failed");
      setRoutes(data.routes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "quote failed");
    } finally {
      setBusy(false);
    }
  }, [address, code, amount]);

  const ready = /^G[A-Z2-7]{55}$/.test(address) && Number(amount) > 0;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section>
        <h1 style={{ fontSize: 24, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          Pick what they receive, not what you spend
        </h1>
        <p style={{ color: "var(--muted)", margin: 0, maxWidth: 650, lineHeight: 1.55 }}>
          You choose the asset and the exact amount the recipient should get.
          Stellar works backwards from there, converting whatever you hold
          through the open order book. It is one operation: it either delivers
          the full amount or it does not happen at all.
        </p>
      </section>

      <section className="card" style={{ padding: 16, display: "grid", gap: 14 }}>
        <Field label="Paying from">
          <AddressInput value={address} onChange={setAddress} onSubmit={quote} busy={busy} />
        </Field>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Recipient receives">
            <select value={code} onChange={(e) => setCode(e.target.value)}>
              {SETTLEMENT_ASSETS.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Exact amount">
            <input
              className="num"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
        </div>

        <button className="btn" disabled={!ready || busy} onClick={quote}>
          {busy ? "Finding routes" : "Find routes"}
        </button>
      </section>

      {error && (
        <div className="card" style={{ padding: 14, borderColor: "var(--danger)" }}>
          <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{error}</p>
        </div>
      )}

      {routes && routes.length === 0 && (
        <div className="card" style={{ padding: 16 }}>
          <strong style={{ fontSize: 14 }}>No route found</strong>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 0", lineHeight: 1.55 }}>
            This account holds nothing that can reach {amount} {code} through the
            order book right now. That is the honest answer, and it is exactly
            what the real operation would return. A wallet that hid this would
            fail at the moment of payment instead.
          </p>
        </div>
      )}

      {routes && routes.length > 0 && (
        <section className="card">
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "baseline", gap: 8 }}>
            <strong style={{ fontSize: 14 }}>
              {routes.length} way{routes.length > 1 ? "s" : ""} to deliver {money(Number(amount))} {code}
            </strong>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>cheapest first</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Pay from</th>
                <th>Route</th>
                <th className="r">It costs you</th>
                <th className="r">Implied rate</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r, i) => (
                <tr key={`${r.sourceCode}-${i}`}>
                  <td>
                    <strong>{r.sourceCode}</strong>
                    {r.sourceIssuer && (
                      <span className="mono" style={{ color: "var(--muted)", fontSize: 11, marginLeft: 6 }}>
                        {shortKey(r.sourceIssuer)}
                      </span>
                    )}
                    {i === 0 && <span className="chip chip-ok" style={{ marginLeft: 8 }}>best</span>}
                  </td>
                  <td style={{ color: "var(--muted)", fontSize: 12 }}>
                    {r.hops.length === 0 ? "direct" : `via ${r.hops.join(" → ")}`}
                  </td>
                  <td className="r num">{money(r.sourceAmount, 4)}</td>
                  <td className="r num" style={{ color: "var(--muted)" }}>
                    {money(r.sourceAmount / r.destinationAmount, 4)} / {code}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)", color: "var(--muted)", fontSize: 12, lineHeight: 1.6 }}>
            These are live quotes from Horizon&apos;s strict-receive path finder, the
            read side of <span className="mono">path_payment_strict_receive</span>. A
            real send would submit that one operation with a send maximum. If the
            route moved against you past that ceiling it fails with{" "}
            <span className="mono">OVER_SENDMAX</span> and nothing moves. No partial
            payments, no stranded conversion.
          </div>
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
      {children}
    </label>
  );
}
