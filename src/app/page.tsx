"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AddressInput } from "@/components/AddressInput";
import { compact, money } from "@/lib/format";

type Row = {
  code: string;
  issuer?: string;
  balance: number;
  unauthorised: boolean;
  name: string | null;
  kind: string | null;
  yieldBearing: boolean;
  recognised: boolean;
};

export default function BalancesPage() {
  const [address, setAddress] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    setRows(null);
    try {
      const res = await fetch(`/api/account?address=${address}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "lookup failed");
      setRows(data.balances);
    } catch (err) {
      setError(err instanceof Error ? err.message : "lookup failed");
    } finally {
      setBusy(false);
    }
  }, [address]);

  const earning = rows?.filter((r) => r.yieldBearing && r.balance > 0) ?? [];
  const idle =
    rows?.filter((r) => !r.yieldBearing && r.balance > 0 && r.code !== "XLM") ??
    [];

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section>
        <h1 style={{ fontSize: 24, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          Most wallets are a parking space
        </h1>
        <p style={{ color: "var(--muted)", margin: "0 0 18px", maxWidth: 620, lineHeight: 1.55 }}>
          Stellar carries about $3.56B of tokenised real world assets and under
          half a percent of it is used for anything. Load an account and see
          which part of it is working and which part is sitting still.
        </p>
        <AddressInput value={address} onChange={setAddress} onSubmit={load} busy={busy} />
      </section>

      {error && (
        <div className="card" style={{ padding: 14, borderColor: "var(--danger)" }}>
          <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{error}</p>
        </div>
      )}

      {rows && (
        <>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
            <Stat label="Positions" value={String(rows.filter((r) => r.balance > 0).length)} />
            <Stat label="Earning" value={String(earning.length)} tone={earning.length ? "ok" : "muted"} />
            <Stat label="Sitting idle" value={String(idle.length)} tone={idle.length ? "warn" : "ok"} />
            <Stat label="Unauthorised" value={String(rows.filter((r) => r.unauthorised).length)} />
          </div>

          <section className="card">
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
              <strong style={{ fontSize: 14 }}>Holdings</strong>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Backing</th>
                  <th className="r">Balance</th>
                  <th className="r">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) => r.balance > 0)
                  .sort((a, b) => b.balance - a.balance)
                  .map((r) => (
                    <tr key={`${r.code}:${r.issuer ?? "native"}`}>
                      <td>
                        <strong>{r.code}</strong>
                        {!r.recognised && (
                          <span className="chip chip-bad" style={{ marginLeft: 8 }}>
                            unverified issuer
                          </span>
                        )}
                      </td>
                      <td style={{ color: "var(--muted)" }}>{r.name ?? "Not in registry"}</td>
                      <td className="r num">{money(r.balance, 4)}</td>
                      <td className="r">
                        {r.unauthorised ? (
                          <span className="chip chip-bad">frozen</span>
                        ) : r.yieldBearing ? (
                          <span className="chip chip-ok">earning</span>
                        ) : (
                          <span className="chip chip-warn">idle</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>

          {idle.length > 0 && (
            <div className="card" style={{ padding: 16, display: "grid", gap: 10 }}>
              <strong style={{ fontSize: 14 }}>
                {idle.length} position{idle.length > 1 ? "s" : ""} earning nothing
              </strong>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.55 }}>
                {idle.map((r) => `${compact(r.balance)} ${r.code}`).join(", ")} could sit in a
                tokenised treasury instead and still be spendable, because Stellar converts and
                pays in one transaction.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href="/earn" className="btn" style={{ textDecoration: "none" }}>
                  See what earns
                </Link>
                <Link href="/send" className="btn btn-ghost" style={{ textDecoration: "none" }}>
                  Try the send flow
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "muted";
}) {
  const color =
    tone === "ok" ? "var(--accent)" : tone === "warn" ? "var(--warn)" : "var(--text)";
  return (
    <div className="card" style={{ padding: "12px 14px" }}>
      <div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div className="num" style={{ fontSize: 24, fontWeight: 600, color, marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}
