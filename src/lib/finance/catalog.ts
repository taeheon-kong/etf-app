/**
 * ETF 카탈로그.
 * AUM은 2025년 말 기준 대략값(10억 달러 단위). 정렬 기준용.
 */

export type EtfCategory =
  | "sp500"
  | "nasdaq"
  | "tech"
  | "growth"
  | "smallcap"
  | "dividend"
  | "coveredCall"
  | "bond"
  | "commodity"
  | "reit"
  | "sector"
  | "global"
  | "thematic"
  | "leveraged"
  | "crypto";

export type EtfMeta = {
  ticker: string;
  name: string;
  category: EtfCategory;
  aum: number;
};

export const CATEGORY_LABELS: Record<EtfCategory, string> = {
  sp500: "S&P 500",
  nasdaq: "나스닥",
  tech: "기술주",
  growth: "성장주",
  smallcap: "소형주",
  dividend: "배당",
  coveredCall: "커버드콜",
  bond: "채권",
  commodity: "원자재",
  reit: "리츠",
  sector: "섹터",
  global: "글로벌",
  thematic: "테마/대안",
  leveraged: "레버리지",
  crypto: "가상자산",
};

export const CATEGORY_ORDER: EtfCategory[] = [
  "sp500",
  "nasdaq",
  "tech",
  "growth",
  "smallcap",
  "dividend",
  "coveredCall",
  "bond",
  "commodity",
  "reit",
  "sector",
  "global",
  "thematic",
  "leveraged",
  "crypto",
];

export const ETF_CATALOG: EtfMeta[] = [
  // S&P 500
  { ticker: "VOO", name: "Vanguard S&P 500", category: "sp500", aum: 700 },
  { ticker: "SPY", name: "SPDR S&P 500", category: "sp500", aum: 690 },
  { ticker: "IVV", name: "iShares Core S&P 500", category: "sp500", aum: 660 },
  { ticker: "VTI", name: "Vanguard Total Stock Market", category: "sp500", aum: 510 },
  { ticker: "SPLG", name: "SPDR Portfolio S&P 500", category: "sp500", aum: 70 },
  { ticker: "JEPI", name: "JPMorgan Equity Premium Income", category: "sp500", aum: 45 },
  { ticker: "SCHB", name: "Schwab US Broad Market", category: "sp500", aum: 35 },
  { ticker: "SPMO", name: "Invesco S&P 500 Momentum", category: "sp500", aum: 8 },
  { ticker: "SPYI", name: "NEOS S&P 500 High Income", category: "sp500", aum: 4 },
  { ticker: "XYLD", name: "Global X S&P 500 Covered Call", category: "sp500", aum: 3 },

  // 나스닥
  { ticker: "QQQ", name: "Invesco QQQ Trust", category: "nasdaq", aum: 360 },
  { ticker: "QQQM", name: "Invesco NASDAQ 100", category: "nasdaq", aum: 50 },
  { ticker: "JEPQ", name: "JPMorgan Nasdaq Equity Premium", category: "nasdaq", aum: 30 },
  { ticker: "QYLD", name: "Global X Nasdaq 100 Covered Call", category: "nasdaq", aum: 8 },
  { ticker: "QQQI", name: "NEOS Nasdaq-100 High Income", category: "nasdaq", aum: 3 },
  { ticker: "QQA", name: "Invesco QQQ Income Advantage", category: "nasdaq", aum: 1 },

  // 기술주
  { ticker: "VGT", name: "Vanguard Information Technology", category: "tech", aum: 90 },
  { ticker: "XLK", name: "Technology Select Sector SPDR", category: "tech", aum: 75 },
  { ticker: "SMH", name: "VanEck Semiconductor", category: "tech", aum: 25 },
  { ticker: "SOXX", name: "iShares Semiconductor", category: "tech", aum: 13 },

  // 성장주
  { ticker: "VUG", name: "Vanguard Growth", category: "growth", aum: 170 },
  { ticker: "IWF", name: "iShares Russell 1000 Growth", category: "growth", aum: 110 },
  { ticker: "SCHG", name: "Schwab US Large-Cap Growth", category: "growth", aum: 40 },
  { ticker: "MGK", name: "Vanguard Mega Cap Growth", category: "growth", aum: 25 },

  // 소형주
  { ticker: "IJR", name: "iShares Core S&P Small-Cap", category: "smallcap", aum: 90 },
  { ticker: "IWM", name: "iShares Russell 2000", category: "smallcap", aum: 70 },
  { ticker: "VB", name: "Vanguard Small-Cap", category: "smallcap", aum: 65 },
  { ticker: "VBR", name: "Vanguard Small-Cap Value", category: "smallcap", aum: 32 },

  // 배당
  { ticker: "VIG", name: "Vanguard Dividend Appreciation", category: "dividend", aum: 92 },
  { ticker: "SCHD", name: "Schwab US Dividend Equity", category: "dividend", aum: 67 },
  { ticker: "VYM", name: "Vanguard High Dividend Yield", category: "dividend", aum: 60 },
  { ticker: "DGRO", name: "iShares Core Dividend Growth", category: "dividend", aum: 32 },
  { ticker: "COWZ", name: "Pacer US Cash Cows 100", category: "dividend", aum: 25 },
  { ticker: "DVY", name: "iShares Select Dividend", category: "dividend", aum: 20 },
  { ticker: "NOBL", name: "ProShares S&P 500 Dividend Aristocrats", category: "dividend", aum: 11 },
  { ticker: "HDV", name: "iShares Core High Dividend", category: "dividend", aum: 11 },
  { ticker: "SPYD", name: "SPDR S&P 500 High Dividend", category: "dividend", aum: 6 },
  { ticker: "DIVO", name: "Amplify CWP Enhanced Dividend Income", category: "dividend", aum: 4 },
  { ticker: "SPHD", name: "Invesco S&P 500 High Div Low Vol", category: "dividend", aum: 3 },

  // 채권
  { ticker: "AGG", name: "iShares Core US Aggregate Bond", category: "bond", aum: 130 },
  { ticker: "BND", name: "Vanguard Total Bond Market", category: "bond", aum: 130 },
  { ticker: "TLT", name: "iShares 20+ Year Treasury", category: "bond", aum: 60 },
  { ticker: "SGOV", name: "iShares 0-3 Month Treasury", category: "bond", aum: 50 },
  { ticker: "BIL", name: "SPDR 1-3 Month T-Bill", category: "bond", aum: 35 },
  { ticker: "IEF", name: "iShares 7-10 Year Treasury", category: "bond", aum: 35 },
  { ticker: "LQD", name: "iShares iBoxx Investment Grade Corp", category: "bond", aum: 32 },
  { ticker: "SHY", name: "iShares 1-3 Year Treasury", category: "bond", aum: 25 },
  { ticker: "HYG", name: "iShares iBoxx High Yield Corp", category: "bond", aum: 17 },
  { ticker: "SCHP", name: "Schwab US TIPS", category: "bond", aum: 16 },
  { ticker: "BOXX", name: "Alpha Architect 1-3 Month Box", category: "bond", aum: 8 },
  { ticker: "JFLI", name: "JPMorgan Flexible Income", category: "bond", aum: 1 },

  // 원자재
  { ticker: "GLD", name: "SPDR Gold Shares", category: "commodity", aum: 100 },
  { ticker: "IAU", name: "iShares Gold Trust", category: "commodity", aum: 40 },
  { ticker: "SLV", name: "iShares Silver Trust", category: "commodity", aum: 20 },
  { ticker: "PDBC", name: "Invesco Optimum Yield Diversified Commodity", category: "commodity", aum: 4 },
  { ticker: "USO", name: "United States Oil Fund", category: "commodity", aum: 1.5 },

  // 리츠
  { ticker: "VNQ", name: "Vanguard Real Estate", category: "reit", aum: 38 },
  { ticker: "SCHH", name: "Schwab US REIT", category: "reit", aum: 8 },

  // 섹터
  { ticker: "XLF", name: "Financial Select Sector SPDR", category: "sector", aum: 55 },
  { ticker: "XLV", name: "Health Care Select Sector SPDR", category: "sector", aum: 35 },
  { ticker: "XLE", name: "Energy Select Sector SPDR", category: "sector", aum: 30 },
  { ticker: "XLY", name: "Consumer Discretionary Select Sector", category: "sector", aum: 22 },
  { ticker: "XLU", name: "Utilities Select Sector SPDR", category: "sector", aum: 18 },
  { ticker: "XLRE", name: "Real Estate Select Sector SPDR", category: "sector", aum: 7 },
  { ticker: "XBI", name: "SPDR S&P Biotech", category: "sector", aum: 6 },

  // 글로벌
  { ticker: "VEA", name: "Vanguard FTSE Developed Markets", category: "global", aum: 150 },
  { ticker: "VWO", name: "Vanguard FTSE Emerging Markets", category: "global", aum: 90 },
  { ticker: "EFA", name: "iShares MSCI EAFE", category: "global", aum: 60 },
  { ticker: "VT", name: "Vanguard Total World Stock", category: "global", aum: 45 },
  { ticker: "ACWI", name: "iShares MSCI ACWI", category: "global", aum: 25 },
  { ticker: "EWJ", name: "iShares MSCI Japan", category: "global", aum: 17 },
  { ticker: "INDA", name: "iShares MSCI India", category: "global", aum: 11 },
  { ticker: "EWZ", name: "iShares MSCI Brazil", category: "global", aum: 5 },
  { ticker: "MCHI", name: "iShares MSCI China", category: "global", aum: 5 },
  { ticker: "EWY", name: "iShares MSCI South Korea", category: "global", aum: 3 },

  // 테마/대안
  { ticker: "QUAL", name: "iShares MSCI USA Quality Factor", category: "thematic", aum: 60 },
  { ticker: "GDX", name: "VanEck Gold Miners", category: "thematic", aum: 17 },
  { ticker: "PAVE", name: "Global X US Infrastructure Development", category: "thematic", aum: 11 },
  { ticker: "ARKK", name: "ARK Innovation", category: "thematic", aum: 6 },
  { ticker: "ICLN", name: "iShares Global Clean Energy", category: "thematic", aum: 1.5 },
  { ticker: "QGRO", name: "American Century STOXX US Quality Growth", category: "thematic", aum: 1.5 },
  { ticker: "LIT", name: "Global X Lithium & Battery Tech", category: "thematic", aum: 1.2 },

  // 레버리지
  { ticker: "TQQQ", name: "ProShares UltraPro QQQ (3x)", category: "leveraged", aum: 23 },
  { ticker: "SOXL", name: "Direxion Daily Semiconductor Bull 3X", category: "leveraged", aum: 11 },
  { ticker: "QLD", name: "ProShares Ultra QQQ (2x)", category: "leveraged", aum: 9 },
  { ticker: "SSO", name: "ProShares Ultra S&P500 (2x)", category: "leveraged", aum: 5 },
  { ticker: "UPRO", name: "ProShares UltraPro S&P 500 (3x)", category: "leveraged", aum: 4 },
  { ticker: "SPXL", name: "Direxion Daily S&P 500 Bull 3X", category: "leveraged", aum: 4 },
  { ticker: "USD", name: "ProShares Ultra Semiconductors (2x)", category: "leveraged", aum: 1 },

  // 가상자산
  { ticker: "IBIT", name: "iShares Bitcoin Trust", category: "crypto", aum: 80 },
  { ticker: "ETHA", name: "iShares Ethereum Trust", category: "crypto", aum: 12 },
  { ticker: "BITO", name: "ProShares Bitcoin Strategy", category: "crypto", aum: 3 },
  { ticker: "BITX", name: "Volatility Shares 2x Bitcoin (2x)", category: "crypto", aum: 2 },
  { ticker: "BITU", name: "ProShares Ultra Bitcoin (2x)", category: "crypto", aum: 1 },
];

export const ALL_TICKERS = ETF_CATALOG.map((e) => e.ticker);

export function groupByCategory(): Map<EtfCategory, EtfMeta[]> {
  const map = new Map<EtfCategory, EtfMeta[]>();
  for (const cat of CATEGORY_ORDER) map.set(cat, []);
  for (const etf of ETF_CATALOG) {
    const arr = map.get(etf.category) ?? [];
    arr.push(etf);
    map.set(etf.category, arr);
  }
  for (const cat of CATEGORY_ORDER) {
    const arr = map.get(cat)!;
    arr.sort((a, b) => b.aum - a.aum);
  }
  return map;
}

export function findByTicker(ticker: string): EtfMeta | undefined {
  return ETF_CATALOG.find((e) => e.ticker === ticker);
}