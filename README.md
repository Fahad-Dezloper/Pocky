# Tender

**A Stellar wallet where your balance earns while it sits, and still pays anyone, in any asset, in one transaction.**

> Working name. v1 reads Stellar mainnet live. It holds no keys and signs nothing.

---

## The problem

On Stellar today, money has to choose between earning and being usable. That choice is forced by the products, not by the protocol.

Real yield-bearing assets already exist on Stellar. Tokenised treasuries from Etherfuse, treasury tokens from Centrifuge, lending markets like Blend. Etherfuse's `USTRY` alone has over a thousand holders. They pay genuine yield and anyone can hold them.

Almost nobody does. Stellar carries roughly **3.56 billion dollars** of tokenised real world assets, and **under half a percent of it** is used in any on-chain contract. Meanwhile Stellar's entire DeFi TVL is around **206 million dollars**, a fraction of the value parked one step away.

The reason is not missing rails. It is that using them makes money hard to spend. The moment a balance moves into something that earns, paying someone becomes a multi-step job: leave the wallet, find a venue, sell the position, wait for settlement, come back, send. So people hold idle stablecoins and accept zero, because convenience wins.

**Stellar already solved the hard part and nobody surfaced it.** A single native operation, `path_payment_strict_receive`, lets a sender hold one asset and have the recipient receive an *exact* amount of a different one, converted through the open order book, atomically. If it cannot complete within the sender's limit it fails cleanly rather than half-executing. Stellar has had this since launch. No other major chain has it natively.

No Stellar wallet uses it as the way you send money.

There is a second problem underneath it: Stellar accounts are completely public. Receiving one payment hands that person your full balance and your entire transaction history, permanently.

---

## What v1 does

Three screens, all reading live mainnet data.

### `/` Balances
Load any mainnet account and see which positions are working and which are sitting still. Assets are matched against a verified registry; anything not in it is flagged rather than silently rendered.

### `/send` The send flow
You pick **what the recipient receives** and the exact amount. Stellar works backwards from there. The page shows every route Horizon can find from the sender's actual holdings, cheapest first, with what each one costs and the implied rate.

These are live quotes from Horizon's strict-receive path finder, which is the read side of the same operation a real payment would submit. No keys, no signature, no transaction.

### `/earn` Measured exit liquidity
Every yield-bearing asset in the registry with its **live order book depth against USDC**, holder count, spread, and a verdict on whether instant spend is honest for that asset today.

This page exists because yield is the easy half. Several tokenised sovereigns on Stellar have **no bids at all**. A wallet that hides that demos well and fails on a real payment.

---

## Two design decisions worth explaining

### Issuers are resolved from SEP-1, never from Horizon's asset list

Stellar's asset namespace is heavily impersonated. Querying Horizon for `USDC` returns impostors alongside the real one, and the commodity and fund namespaces are worse.

Every asset in [`src/lib/assets.ts`](src/lib/assets.ts) carries a `homeDomain`, and [`verifyIssuer`](src/lib/stellar.ts) fetches `https://<homeDomain>/.well-known/stellar.toml` and checks the issuing key appears under a matching `[[CURRENCIES]]` entry. SEP-1 is the only published link from an organisation to the keys it issues from.

This is not theoretical. While building the registry, Horizon's `/assets` endpoint returned a `deJTRSY` issuer that **`centrifuge.io` does not vouch for**. It was excluded.

### Liquidity is measured, not assumed

`getDepth` sums resting bids against USDC per asset. The `/earn` page renders the real number and downgrades the promise accordingly:

| Bid depth | What the wallet offers |
| --- | --- |
| 1,000 USDC or more | instant spend |
| above zero, under 1,000 | small size only |
| zero | hold only, exit via issuer redemption |

---

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3000. No API keys and no configuration required; it reads public Horizon.

To point at a different Horizon instance:

```bash
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org npm run dev
```

---

## Architecture

```
src/
  lib/
    assets.ts      verified asset registry, issuers resolved via SEP-1
    stellar.ts     Horizon client: balances, strict-receive quotes,
                   order book depth, asset stats, SEP-1 verification
    format.ts      number formatting (tabular numerals throughout)
  app/
    page.tsx       balances, working vs idle
    send/          the strict-receive send flow
    earn/          measured exit liquidity per asset
    api/
      account/     balances for an address
      quote/       strict-receive routes, cheapest per source asset
      market/      depth and holders for every yield asset
      verify/      SEP-1 provenance for the whole registry
```

Next.js 15 App Router, React 19, TypeScript, Tailwind 4. Horizon calls are server-side with per-route revalidation so the client never talks to Horizon directly.

---

## What v1 deliberately does not do

- **No key handling.** A v1 that touches private keys is a liability, not a feature. Signing comes after an external security review, through standard wallet interfaces rather than an in-app key store.
- **No fronting of liquidity.** Instant spend against an asset that needs issuer redemption requires someone's balance sheet. The router routes; it does not fund.
- **No privacy claims.** Shielded balances depend on Stellar's confidential transfer work, which is **not on mainnet yet**: Confidential Tokens are testnet-only with audits underway, Privacy Pools is a prototype, and Remura's own site states testnet live with mainnet targeted November 2026. What *is* shippable now is address hygiene through muxed accounts, so counterparties see a payment rather than a net worth. That is on the roadmap below, described accurately.

---

## Roadmap

1. **Muxed receiving addresses** so paying someone does not expose your balance and history
2. **Signing** through standard wallet interfaces, after security review
3. **Yield accounting** that reconciles to issuer statements, derived from ledger meta rather than the transaction envelope
4. **Lending positions** via Blend alongside held assets
5. **Shielded balances** as Stellar's confidential transfer standard reaches mainnet

---

## Data sources

| Figure | Source |
| --- | --- |
| 3.56B of RWA on Stellar, under 0.5% utilised | RedStone, *Next Phase for RWAs on Stellar* |
| ~206M Stellar DeFi TVL | DefiLlama |
| Holder counts, order book depth, path quotes | Horizon, live |
| Issuer provenance | each issuer's own SEP-1 `stellar.toml` |

Numbers rendered in the app are read at request time. Numbers in this README were current on 14 November 2026.

---

## Licence

MIT. See [LICENSE](LICENSE).
