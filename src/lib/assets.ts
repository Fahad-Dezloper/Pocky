/**
 * Curated asset registry.
 *
 * Issuers here were resolved from each organisation's own SEP-1 `stellar.toml`
 * at `https://<home_domain>/.well-known/stellar.toml`, never from Horizon's
 * `/assets` listing. That matters: Horizon will happily return impostor assets
 * sharing a well-known code, and on Stellar the commodity and fund namespaces
 * are heavily squatted. SEP-1 is the only published link from an organisation
 * to the keys it actually issues from.
 */

export type AssetKind = "cash" | "treasury" | "sovereign" | "fund";

export interface AssetDef {
  code: string;
  issuer: string;
  /** Domain whose stellar.toml vouches for this issuer. */
  homeDomain: string;
  name: string;
  kind: AssetKind;
  /** Short description of what backs it. */
  backing: string;
  /** True when the asset is expected to accrue yield to the holder. */
  yieldBearing: boolean;
}

export const USDC: AssetDef = {
  code: "USDC",
  issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  homeDomain: "circle.com",
  name: "USD Coin",
  kind: "cash",
  backing: "Cash and short-dated US Treasuries held by Circle",
  yieldBearing: false,
};

export const EURC: AssetDef = {
  code: "EURC",
  issuer: "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
  homeDomain: "circle.com",
  name: "Euro Coin",
  kind: "cash",
  backing: "Euro reserves held by Circle",
  yieldBearing: false,
};

const ETHERFUSE = "GCRYUGD5NVARGXT56XEZI5CIFCQETYHAPQQTHO2O3IQZTHDH4LATMYWC";

export const ASSETS: AssetDef[] = [
  USDC,
  EURC,
  {
    code: "USTRY",
    issuer: ETHERFUSE,
    homeDomain: "etherfuse.com",
    name: "US Treasury Stablebond",
    kind: "treasury",
    backing: "US Treasury notes",
    yieldBearing: true,
  },
  {
    code: "CETES",
    issuer: ETHERFUSE,
    homeDomain: "etherfuse.com",
    name: "Mexican CETES Stablebond",
    kind: "sovereign",
    backing: "Mexican government bills (Certificados de la Tesoreria)",
    yieldBearing: true,
  },
  {
    code: "TESOURO",
    issuer: ETHERFUSE,
    homeDomain: "etherfuse.com",
    name: "Brazilian Tesouro Stablebond",
    kind: "sovereign",
    backing: "Brazilian government bonds",
    yieldBearing: true,
  },
  {
    code: "EUROB",
    issuer: ETHERFUSE,
    homeDomain: "etherfuse.com",
    name: "European Government Bonds",
    kind: "sovereign",
    backing: "A basket of European sovereign debt",
    yieldBearing: true,
  },
  {
    code: "GILTS",
    issuer: ETHERFUSE,
    homeDomain: "etherfuse.com",
    name: "UK Gilts Stablebond",
    kind: "sovereign",
    backing: "UK sovereign debt",
    yieldBearing: true,
  },
  {
    code: "KTB",
    issuer: ETHERFUSE,
    homeDomain: "etherfuse.com",
    name: "Korean Treasury Stablebond",
    kind: "sovereign",
    backing: "Korean treasury bonds",
    yieldBearing: true,
  },
  {
    code: "USDY",
    issuer: "GAJMPX5NBOG6TQFPQGRABJEEB2YE7RFRLUKJDZAZGAD5GFX4J7TADAZ6",
    homeDomain: "ondo.finance",
    name: "Ondo US Dollar Yield",
    kind: "treasury",
    backing: "Short-term US Treasuries and bank deposits",
    yieldBearing: true,
  },
];

export const BY_ID = new Map(ASSETS.map((a) => [assetId(a), a]));

export function assetId(a: Pick<AssetDef, "code" | "issuer">): string {
  return `${a.code}:${a.issuer}`;
}

export function findAsset(code: string, issuer?: string): AssetDef | undefined {
  if (issuer) return BY_ID.get(`${code}:${issuer}`);
  return ASSETS.find((a) => a.code === code);
}

/** Assets we treat as a place to park value rather than spend it. */
export const YIELD_ASSETS = ASSETS.filter((a) => a.yieldBearing);

/** Assets a recipient is plausibly willing to receive. */
export const SETTLEMENT_ASSETS = [USDC, EURC];
