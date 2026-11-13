import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tender",
  description:
    "A Stellar wallet where your balance earns while it sits and still pays anyone, in any asset, in one transaction.",
};

const NAV = [
  { href: "/", label: "Balances" },
  { href: "/send", label: "Send" },
  { href: "/earn", label: "Earn" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header
          style={{
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div
            style={{
              maxWidth: 1040,
              margin: "0 auto",
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              gap: 24,
              height: 56,
            }}
          >
            <Link
              href="/"
              style={{ fontWeight: 700, letterSpacing: "-0.02em", fontSize: 17 }}
            >
              Tender
            </Link>
            <nav style={{ display: "flex", gap: 4 }}>
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 7,
                    fontSize: 14,
                    color: "var(--muted)",
                  }}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <span
              className="chip chip-muted"
              style={{ marginLeft: "auto" }}
              title="This build reads Stellar mainnet and signs nothing."
            >
              mainnet · read only
            </span>
          </div>
        </header>
        <main style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 16px 64px" }}>
          {children}
        </main>
        <footer
          style={{
            maxWidth: 1040,
            margin: "0 auto",
            padding: "0 16px 48px",
            color: "var(--muted)",
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          Tender reads live Stellar mainnet data through Horizon. It holds no
          keys and signs no transactions. Quotes come from Horizon&apos;s
          strict-receive path finder, the read side of the same operation a real
          payment would use.
        </footer>
      </body>
    </html>
  );
}
