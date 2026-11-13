"use client";

import { useState } from "react";

const SAMPLES = [
  {
    label: "Etherfuse issuer",
    address: "GCRYUGD5NVARGXT56XEZI5CIFCQETYHAPQQTHO2O3IQZTHDH4LATMYWC",
  },
];

export function AddressInput({
  value,
  onChange,
  onSubmit,
  busy,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy?: boolean;
}) {
  const [touched, setTouched] = useState(false);
  const valid = /^G[A-Z2-7]{55}$/.test(value.trim());

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="mono"
          style={{ fontSize: 13 }}
          placeholder="G..."
          value={value}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value.trim())}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valid) onSubmit();
          }}
        />
        <button className="btn" disabled={!valid || busy} onClick={onSubmit}>
          {busy ? "Loading" : "Load"}
        </button>
      </div>
      {touched && value && !valid && (
        <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>
          A Stellar public key starts with G and is 56 characters long.
        </p>
      )}
      <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
        Watch any mainnet account. Nothing is signed and no key is ever
        requested. Try{" "}
        {SAMPLES.map((s) => (
          <button
            key={s.address}
            onClick={() => onChange(s.address)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              color: "var(--accent)",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {s.label}
          </button>
        ))}
      </p>
    </div>
  );
}
