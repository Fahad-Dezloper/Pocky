import { AssetDef, assetId } from "./assets";

export const HORIZON =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon.stellar.org";

/** XLM has no issuer; Horizon encodes it as a "native" asset. */
export const NATIVE = "native" as const;

async function horizon<T>(path: string, revalidate = 30): Promise<T> {
  const res = await fetch(`${HORIZON}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate },
  });
  if (!res.ok) {
    throw new Error(`Horizon ${res.status} on ${path}`);
  }
  return res.json() as Promise<T>;
}

/** Horizon wants the asset split across three query params. */
function assetParams(prefix: string, a: AssetDef | "native"): string {
  if (a === NATIVE) return `${prefix}_asset_type=native`;
  const type = a.code.length <= 4 ? "credit_alphanum4" : "credit_alphanum12";
  return [
    `${prefix}_asset_type=${type}`,
    `${prefix}_asset_code=${a.code}`,
    `${prefix}_asset_issuer=${a.issuer}`,
  ].join("&");
}

export interface Balance {
  code: string;
  issuer?: string;
  balance: number;
  /** Set when the issuer requires authorisation and has not granted it. */
  unauthorised: boolean;
}

export async function getBalances(address: string): Promise<Balance[]> {
  type Raw = {
    balances: {
      asset_type: string;
      asset_code?: string;
      asset_issuer?: string;
      balance: string;
      is_authorized?: boolean;
    }[];
  };
  const acc = await horizon<Raw>(`/accounts/${address}`, 10);
  return acc.balances.map((b) => ({
    code: b.asset_type === "native" ? "XLM" : (b.asset_code ?? "?"),
    issuer: b.asset_issuer,
    balance: Number(b.balance),
    unauthorised: b.is_authorized === false,
  }));
}

export interface Quote {
  /** What the recipient receives. */
  destinationAmount: number;
  /** What it costs the sender, in the source asset. */
  sourceAmount: number;
  sourceCode: string;
  sourceIssuer?: string;
  /** Intermediate assets the conversion routes through. */
  hops: string[];
}

/**
 * Ask Horizon what it would cost to deliver an exact amount of `destination`,
 * paying from anything `address` already holds.
 *
 * This is the read side of `path_payment_strict_receive`. No keys, no
 * signature, no transaction. The same path the real operation would take.
 */
export async function getStrictReceiveQuotes(
  address: string,
  destination: AssetDef,
  destinationAmount: number,
): Promise<Quote[]> {
  type Raw = {
    _embedded: {
      records: {
        source_asset_type: string;
        source_asset_code?: string;
        source_asset_issuer?: string;
        source_amount: string;
        destination_amount: string;
        path: { asset_code?: string; asset_type: string }[];
      }[];
    };
  };
  const qs = [
    `source_account=${address}`,
    assetParams("destination", destination),
    `destination_amount=${destinationAmount}`,
  ].join("&");

  const data = await horizon<Raw>(`/paths/strict-receive?${qs}`, 5);
  return data._embedded.records.map((r) => ({
    destinationAmount: Number(r.destination_amount),
    sourceAmount: Number(r.source_amount),
    sourceCode:
      r.source_asset_type === "native" ? "XLM" : (r.source_asset_code ?? "?"),
    sourceIssuer: r.source_asset_issuer,
    hops: r.path.map((p) =>
      p.asset_type === "native" ? "XLM" : (p.asset_code ?? "?"),
    ),
  }));
}

export interface MarketDepth {
  /** Total value of resting bids, denominated in the counter asset. */
  bidDepth: number;
  bidCount: number;
  askCount: number;
  /** Best bid and ask, or null when that side of the book is empty. */
  bestBid: number | null;
  bestAsk: number | null;
  /** Spread as a fraction of the mid price, or null when uncomputable. */
  spread: number | null;
}

/**
 * Real resting liquidity for `base` against `counter`.
 *
 * This is the number that decides whether "spend it instantly" is a promise we
 * can keep. Several tokenised sovereigns on Stellar have no bids at all, and a
 * wallet that hides that breaks on first use.
 */
export async function getDepth(
  base: AssetDef,
  counter: AssetDef,
): Promise<MarketDepth> {
  type Raw = {
    bids: { price: string; amount: string }[];
    asks: { price: string; amount: string }[];
  };
  const qs = [
    assetParams("selling", base),
    assetParams("buying", counter),
    "limit=50",
  ].join("&");
  const ob = await horizon<Raw>(`/order_book?${qs}`, 15);

  const bidDepth = ob.bids.reduce(
    (sum, b) => sum + Number(b.amount) * Number(b.price),
    0,
  );
  const bestBid = ob.bids.length ? Number(ob.bids[0].price) : null;
  const bestAsk = ob.asks.length ? Number(ob.asks[0].price) : null;
  const spread =
    bestBid && bestAsk ? (bestAsk - bestBid) / ((bestAsk + bestBid) / 2) : null;

  return {
    bidDepth,
    bidCount: ob.bids.length,
    askCount: ob.asks.length,
    bestBid,
    bestAsk,
    spread,
  };
}

export interface AssetStats {
  holders: number | null;
  supply: number | null;
}

export async function getAssetStats(a: AssetDef): Promise<AssetStats> {
  type Raw = {
    _embedded: {
      records: {
        asset_issuer: string;
        amount?: string;
        accounts?: { authorized?: number };
        num_accounts?: number;
      }[];
    };
  };
  const data = await horizon<Raw>(
    `/assets?asset_code=${a.code}&asset_issuer=${a.issuer}`,
    300,
  );
  const rec = data._embedded.records[0];
  if (!rec) return { holders: null, supply: null };
  return {
    holders: rec.accounts?.authorized ?? rec.num_accounts ?? null,
    supply: rec.amount ? Number(rec.amount) : null,
  };
}

/**
 * Confirm an issuer is vouched for by the domain it claims.
 *
 * Fetches `https://<homeDomain>/.well-known/stellar.toml` and checks the
 * issuing key appears under a matching `[[CURRENCIES]]` entry. An asset that
 * fails this is an impostor regardless of how legitimate its code looks.
 */
export async function verifyIssuer(a: AssetDef): Promise<{
  verified: boolean;
  reason: string;
}> {
  try {
    const res = await fetch(`https://${a.homeDomain}/.well-known/stellar.toml`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return { verified: false, reason: `stellar.toml returned ${res.status}` };
    }
    const toml = await res.text();
    const blocks = toml.split(/\[\[CURRENCIES\]\]/).slice(1);
    for (const block of blocks) {
      const code = /^\s*code\s*=\s*"([^"]+)"/m.exec(block)?.[1];
      const issuer = /^\s*issuer\s*=\s*"([^"]+)"/m.exec(block)?.[1];
      if (code === a.code && issuer === a.issuer) {
        return { verified: true, reason: `vouched by ${a.homeDomain}` };
      }
    }
    return {
      verified: false,
      reason: `${a.homeDomain} does not list ${a.code} from this issuer`,
    };
  } catch (err) {
    return {
      verified: false,
      reason: err instanceof Error ? err.message : "lookup failed",
    };
  }
}

export { assetId };
