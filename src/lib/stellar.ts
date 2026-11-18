import { AssetDef, assetId } from "./assets";

export const HORIZON =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon.stellar.org";

/** XLM has no issuer; Horizon encodes it as a "native" asset. */
export const NATIVE = "native" as const;

/**
 * Horizon's hard cap on `source_assets` for the path finder, discovered by
 * hitting it: "list of assets exceeds maximum length of 15".
 */
export const MAX_SOURCE_ASSETS = 15;

export class HorizonError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    /** Horizon's own `extras.reason`, when it supplies one. */
    readonly reason?: string,
  ) {
    super(reason ?? `Horizon ${status} on ${path}`);
    this.name = "HorizonError";
  }
}

async function horizon<T>(path: string, revalidate = 30): Promise<T> {
  const res = await fetch(`${HORIZON}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate },
  });
  if (!res.ok) {
    let reason: string | undefined;
    try {
      const body = (await res.json()) as { extras?: { reason?: string } };
      reason = body.extras?.reason;
    } catch {
      // Horizon did not return JSON; fall back to the status line.
    }
    throw new HorizonError(res.status, path, reason);
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
  const destQs = [
    assetParams("destination", destination),
    `destination_amount=${destinationAmount}`,
  ].join("&");

  let data: Raw;
  try {
    data = await horizon<Raw>(
      `/paths/strict-receive?source_account=${address}&${destQs}`,
      5,
    );
  } catch (err) {
    // Horizon refuses `source_account` for accounts with many trustlines.
    // The documented alternative is an explicit `source_assets` list, so we
    // read the balances ourselves and ask again. Same answer, more requests.
    const tooManyTrustlines =
      err instanceof HorizonError &&
      err.status === 400 &&
      /trustlines/i.test(err.reason ?? "");
    if (!tooManyTrustlines) throw err;

    const balances = await getBalances(address);
    const sourceAssets = balances
      .filter((b) => b.balance > 0 && !b.unauthorised)
      // Horizon rejects more than 15 source assets, so send the largest
      // holdings first and accept that very long tails are not quoted.
      .sort((a, b) => b.balance - a.balance)
      .slice(0, MAX_SOURCE_ASSETS)
      .map((b) => (b.code === "XLM" ? "native" : `${b.code}:${b.issuer}`))
      .join(",");

    if (!sourceAssets) return [];
    data = await horizon<Raw>(
      `/paths/strict-receive?source_assets=${encodeURIComponent(sourceAssets)}&${destQs}`,
      5,
    );
  }

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

export interface Provenance {
  /** True only when BOTH directions of the SEP-32 check pass. */
  verified: boolean;
  /** Domain's stellar.toml lists this code from this issuer. */
  forward: boolean;
  /** Issuer account's on-chain home_domain points back to that domain. */
  reverse: boolean;
  /** The issuer's actual home_domain, when it has one. */
  homeDomain?: string;
  /** Issuer's self-declared `[[CURRENCIES]].status`: live / dead / test / private. */
  declaredStatus?: string;
  reason: string;
}

/**
 * Bidirectional issuer provenance, per SEP-32.
 *
 * Resolving an issuer from a domain's `stellar.toml` alone is NOT sufficient.
 * SEP-1 says so itself: "Any website can publish Stellar network information."
 * Anyone can list anyone else's issuing key under their own `[[CURRENCIES]]`.
 *
 * SEP-32 (Draft, 2020) states the gap exactly: "the home domain field of an
 * issuer address does not provide confidence that the domain is related to the
 * issuer of the asset because any Stellar account holder can set any domain as
 * their home domain." Its fix is to check both directions and fail closed:
 *
 *   forward  domain -> stellar.toml -> [[CURRENCIES]].issuer
 *   reverse  issuer account -> home_domain -> same domain
 *
 * We fail closed on mismatch, on a missing home_domain, and on a duplicate
 * asset code within one TOML, exactly as SEP-32 prescribes. SEP-32 lists
 * "Implementations: None at this time", so this is an open standard nobody
 * had picked up.
 *
 * Honest limit: both legs reduce to DNS, TLS and web-server control. This is
 * domain-grade provenance, not cryptographic provenance.
 */
export async function verifyIssuer(a: AssetDef): Promise<Provenance> {
  const fail = (reason: string, extra: Partial<Provenance> = {}): Provenance => ({
    verified: false,
    forward: false,
    reverse: false,
    reason,
    ...extra,
  });

  let toml: string;
  try {
    const res = await fetch(`https://${a.homeDomain}/.well-known/stellar.toml`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return fail(`stellar.toml returned ${res.status}`);
    toml = await res.text();
  } catch (err) {
    return fail(err instanceof Error ? err.message : "stellar.toml unreachable");
  }

  // --- Forward leg: does the domain vouch for this issuer? ---
  const blocks = toml.split(/\[\[CURRENCIES\]\]/).slice(1);
  const matches = blocks.filter((b) => {
    const code = /^\s*code\s*=\s*"([^"]+)"/m.exec(b)?.[1];
    const issuer = /^\s*issuer\s*=\s*"([^"]+)"/m.exec(b)?.[1];
    return code === a.code && issuer === a.issuer;
  });

  if (matches.length === 0) {
    return fail(`${a.homeDomain} does not list ${a.code} from this issuer`);
  }
  // SEP-32: "If more than one is found, the client fails to resolve."
  if (matches.length > 1) {
    return fail(`${a.homeDomain} lists ${a.code} more than once; ambiguous`);
  }

  const declaredStatus = /^\s*status\s*=\s*"([^"]+)"/m.exec(matches[0])?.[1];

  // --- Reverse leg: does the issuer account point back at the domain? ---
  let homeDomain: string | undefined;
  try {
    const acc = await fetch(`${HORIZON}/accounts/${a.issuer}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!acc.ok) {
      return fail(`issuer account lookup returned ${acc.status}`, {
        forward: true,
        declaredStatus,
      });
    }
    homeDomain = ((await acc.json()) as { home_domain?: string }).home_domain;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "issuer lookup failed", {
      forward: true,
      declaredStatus,
    });
  }

  if (!homeDomain) {
    // SEP-32: "If the issuer address has no home domain reverse resolution fails."
    return fail(`issuer sets no home_domain; cannot confirm it claims ${a.homeDomain}`, {
      forward: true,
      declaredStatus,
    });
  }
  if (homeDomain.toLowerCase() !== a.homeDomain.toLowerCase()) {
    // SEP-32: "If reverse resolution results in a different domain, resolution fails."
    return fail(`issuer's home_domain is ${homeDomain}, not ${a.homeDomain}`, {
      forward: true,
      homeDomain,
      declaredStatus,
    });
  }

  return {
    verified: true,
    forward: true,
    reverse: true,
    homeDomain,
    declaredStatus,
    reason: `${a.homeDomain} and the issuer account claim each other (SEP-32)`,
  };
}

export { assetId };
