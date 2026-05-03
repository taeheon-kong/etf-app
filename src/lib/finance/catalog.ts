/**
 * ETF 카탈로그.
 * 각 ETF는 primary 카테고리 1개 (카드 진열) + tags 다중 (모든 관련 분류).
 * AUM은 2025년 말~2026년 초 기준 대략값(10억 달러 단위). 정렬용.
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
  category: EtfCategory;     // 카드 진열 위치 (단일)
  tags: EtfCategory[];        // 모든 관련 분류 (복수, category 포함)
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
  // ─── S&P 500 / 미국 전체 ───
  { ticker: "VOO", name: "Vanguard S&P 500", category: "sp500", tags: ["sp500"], aum: 700 },
  { ticker: "SPY", name: "SPDR S&P 500", category: "sp500", tags: ["sp500"], aum: 690 },
  { ticker: "IVV", name: "iShares Core S&P 500", category: "sp500", tags: ["sp500"], aum: 660 },
  { ticker: "VTI", name: "Vanguard Total Stock Market", category: "sp500", tags: ["sp500"], aum: 510 },
  { ticker: "ITOT", name: "iShares Core S&P Total US Stock", category: "sp500", tags: ["sp500"], aum: 70 },
  { ticker: "SPLG", name: "SPDR Portfolio S&P 500", category: "sp500", tags: ["sp500"], aum: 70 },
  { ticker: "VV", name: "Vanguard Large-Cap", category: "sp500", tags: ["sp500"], aum: 45 },
  { ticker: "SCHB", name: "Schwab US Broad Market", category: "sp500", tags: ["sp500"], aum: 35 },
  { ticker: "SCHX", name: "Schwab US Large-Cap", category: "sp500", tags: ["sp500"], aum: 50 },
  { ticker: "IWB", name: "iShares Russell 1000", category: "sp500", tags: ["sp500"], aum: 40 },
  { ticker: "RSP", name: "Invesco S&P 500 Equal Weight", category: "sp500", tags: ["sp500"], aum: 70 },
  { ticker: "SPMO", name: "Invesco S&P 500 Momentum", category: "sp500", tags: ["sp500", "growth"], aum: 8 },
  { ticker: "MOAT", name: "VanEck Morningstar Wide Moat", category: "sp500", tags: ["sp500"], aum: 14 },

  // ─── 나스닥 ───
  { ticker: "QQQ", name: "Invesco QQQ Trust", category: "nasdaq", tags: ["nasdaq"], aum: 360 },
  { ticker: "QQQM", name: "Invesco NASDAQ 100", category: "nasdaq", tags: ["nasdaq"], aum: 50 },
  { ticker: "ONEQ", name: "Fidelity NASDAQ Composite", category: "nasdaq", tags: ["nasdaq"], aum: 7 },
  { ticker: "QTEC", name: "First Trust NASDAQ-100 Tech Sector", category: "nasdaq", tags: ["nasdaq", "tech"], aum: 4 },

  // ─── 기술주 ───
  { ticker: "VGT", name: "Vanguard Information Technology", category: "tech", tags: ["tech"], aum: 90 },
  { ticker: "XLK", name: "Technology Select Sector SPDR", category: "tech", tags: ["tech", "sector"], aum: 75 },
  { ticker: "FTEC", name: "Fidelity MSCI Information Technology", category: "tech", tags: ["tech"], aum: 12 },
  { ticker: "IYW", name: "iShares US Technology", category: "tech", tags: ["tech"], aum: 18 },
  { ticker: "SMH", name: "VanEck Semiconductor", category: "tech", tags: ["tech"], aum: 25 },
  { ticker: "SOXX", name: "iShares Semiconductor", category: "tech", tags: ["tech"], aum: 13 },
  { ticker: "IGV", name: "iShares Expanded Tech-Software", category: "tech", tags: ["tech"], aum: 11 },
  { ticker: "FDN", name: "First Trust Dow Jones Internet", category: "tech", tags: ["tech"], aum: 5 },
  { ticker: "CIBR", name: "First Trust Nasdaq Cybersecurity", category: "tech", tags: ["tech"], aum: 7 },
  { ticker: "HACK", name: "ETFMG Prime Cyber Security", category: "tech", tags: ["tech"], aum: 1.5 },
  { ticker: "DRAM", name: "Roundhill Memory & Storage", category: "tech", tags: ["tech", "sector", "leveraged"], aum: 0.05 },

  // ─── 성장주 ───
  { ticker: "VUG", name: "Vanguard Growth", category: "growth", tags: ["growth"], aum: 170 },
  { ticker: "IWF", name: "iShares Russell 1000 Growth", category: "growth", tags: ["growth"], aum: 110 },
  { ticker: "SCHG", name: "Schwab US Large-Cap Growth", category: "growth", tags: ["growth"], aum: 40 },
  { ticker: "MGK", name: "Vanguard Mega Cap Growth", category: "growth", tags: ["growth"], aum: 25 },
  { ticker: "IUSG", name: "iShares Core S&P US Growth", category: "growth", tags: ["growth"], aum: 21 },
  { ticker: "VONG", name: "Vanguard Russell 1000 Growth", category: "growth", tags: ["growth"], aum: 13 },
  { ticker: "IVW", name: "iShares S&P 500 Growth", category: "growth", tags: ["growth", "sp500"], aum: 50 },
  { ticker: "VOOG", name: "Vanguard S&P 500 Growth", category: "growth", tags: ["growth", "sp500"], aum: 14 },

  // ─── 가치주 (성장주 카테고리에 같이) ───
  { ticker: "VTV", name: "Vanguard Value", category: "growth", tags: ["growth"], aum: 130 },
  { ticker: "IWD", name: "iShares Russell 1000 Value", category: "growth", tags: ["growth"], aum: 60 },
  { ticker: "SCHV", name: "Schwab US Large-Cap Value", category: "growth", tags: ["growth"], aum: 13 },
  { ticker: "IVE", name: "iShares S&P 500 Value", category: "growth", tags: ["growth", "sp500"], aum: 36 },

  // ─── 소형주 / 중형주 ───
  { ticker: "IJR", name: "iShares Core S&P Small-Cap", category: "smallcap", tags: ["smallcap"], aum: 90 },
  { ticker: "IWM", name: "iShares Russell 2000", category: "smallcap", tags: ["smallcap"], aum: 70 },
  { ticker: "VB", name: "Vanguard Small-Cap", category: "smallcap", tags: ["smallcap"], aum: 65 },
  { ticker: "VBR", name: "Vanguard Small-Cap Value", category: "smallcap", tags: ["smallcap"], aum: 32 },
  { ticker: "VBK", name: "Vanguard Small-Cap Growth", category: "smallcap", tags: ["smallcap", "growth"], aum: 18 },
  { ticker: "IJH", name: "iShares Core S&P Mid-Cap", category: "smallcap", tags: ["smallcap"], aum: 90 },
  { ticker: "VO", name: "Vanguard Mid-Cap", category: "smallcap", tags: ["smallcap"], aum: 70 },
  { ticker: "IWR", name: "iShares Russell Mid-Cap", category: "smallcap", tags: ["smallcap"], aum: 38 },
  { ticker: "VOE", name: "Vanguard Mid-Cap Value", category: "smallcap", tags: ["smallcap"], aum: 16 },
  { ticker: "AVUV", name: "Avantis US Small Cap Value", category: "smallcap", tags: ["smallcap"], aum: 16 },

  // ─── 배당 ───
  { ticker: "VIG", name: "Vanguard Dividend Appreciation", category: "dividend", tags: ["dividend"], aum: 92 },
  { ticker: "SCHD", name: "Schwab US Dividend Equity", category: "dividend", tags: ["dividend"], aum: 67 },
  { ticker: "VYM", name: "Vanguard High Dividend Yield", category: "dividend", tags: ["dividend"], aum: 60 },
  { ticker: "DGRO", name: "iShares Core Dividend Growth", category: "dividend", tags: ["dividend"], aum: 32 },
  { ticker: "COWZ", name: "Pacer US Cash Cows 100", category: "dividend", tags: ["dividend"], aum: 25 },
  { ticker: "DVY", name: "iShares Select Dividend", category: "dividend", tags: ["dividend"], aum: 20 },
  { ticker: "NOBL", name: "ProShares S&P 500 Dividend Aristocrats", category: "dividend", tags: ["dividend"], aum: 11 },
  { ticker: "HDV", name: "iShares Core High Dividend", category: "dividend", tags: ["dividend"], aum: 11 },
  { ticker: "SDY", name: "SPDR S&P Dividend", category: "dividend", tags: ["dividend"], aum: 19 },
  { ticker: "SPYD", name: "SPDR S&P 500 High Dividend", category: "dividend", tags: ["dividend"], aum: 6 },
  { ticker: "SPHD", name: "Invesco S&P 500 High Div Low Vol", category: "dividend", tags: ["dividend"], aum: 3 },
  { ticker: "RDVY", name: "First Trust Rising Dividend Achievers", category: "dividend", tags: ["dividend"], aum: 12 },
  { ticker: "PFF", name: "iShares Preferred & Income Securities", category: "dividend", tags: ["dividend", "bond"], aum: 14 },
  { ticker: "PGX", name: "Invesco Preferred", category: "dividend", tags: ["dividend", "bond"], aum: 4 },

  // ─── 커버드콜 ───
  { ticker: "JEPI", name: "JPMorgan Equity Premium Income", category: "coveredCall", tags: ["coveredCall", "sp500"], aum: 45 },
  { ticker: "JEPQ", name: "JPMorgan Nasdaq Equity Premium", category: "coveredCall", tags: ["coveredCall", "nasdaq"], aum: 30 },
  { ticker: "QYLD", name: "Global X Nasdaq 100 Covered Call", category: "coveredCall", tags: ["coveredCall", "nasdaq"], aum: 8 },
  { ticker: "RYLD", name: "Global X Russell 2000 Covered Call", category: "coveredCall", tags: ["coveredCall", "smallcap"], aum: 1.5 },
  { ticker: "DIVO", name: "Amplify CWP Enhanced Dividend Income", category: "coveredCall", tags: ["coveredCall", "dividend"], aum: 4 },
  { ticker: "SPYI", name: "NEOS S&P 500 High Income", category: "coveredCall", tags: ["coveredCall", "sp500"], aum: 4 },
  { ticker: "XYLD", name: "Global X S&P 500 Covered Call", category: "coveredCall", tags: ["coveredCall", "sp500"], aum: 3 },
  { ticker: "QQQI", name: "NEOS Nasdaq-100 High Income", category: "coveredCall", tags: ["coveredCall", "nasdaq"], aum: 3 },
  { ticker: "QQA", name: "Invesco QQQ Income Advantage", category: "coveredCall", tags: ["coveredCall", "nasdaq"], aum: 1 },

  // ─── 채권 (대폭 확장) ───
  { ticker: "AGG", name: "iShares Core US Aggregate Bond", category: "bond", tags: ["bond"], aum: 130 },
  { ticker: "BND", name: "Vanguard Total Bond Market", category: "bond", tags: ["bond"], aum: 130 },
  { ticker: "BNDX", name: "Vanguard Total International Bond", category: "bond", tags: ["bond", "global"], aum: 65 },
  { ticker: "TLT", name: "iShares 20+ Year Treasury", category: "bond", tags: ["bond"], aum: 60 },
  { ticker: "VGLT", name: "Vanguard Long-Term Treasury", category: "bond", tags: ["bond"], aum: 14 },
  { ticker: "EDV", name: "Vanguard Extended Duration Treasury", category: "bond", tags: ["bond"], aum: 4 },
  { ticker: "ZROZ", name: "PIMCO 25+ Year Zero Coupon US Treasury", category: "bond", tags: ["bond"], aum: 2 },
  { ticker: "SGOV", name: "iShares 0-3 Month Treasury", category: "bond", tags: ["bond"], aum: 50 },
  { ticker: "BIL", name: "SPDR 1-3 Month T-Bill", category: "bond", tags: ["bond"], aum: 35 },
  { ticker: "USFR", name: "WisdomTree Floating Rate Treasury", category: "bond", tags: ["bond"], aum: 15 },
  { ticker: "TFLO", name: "iShares Treasury Floating Rate Bond", category: "bond", tags: ["bond"], aum: 8 },
  { ticker: "IEF", name: "iShares 7-10 Year Treasury", category: "bond", tags: ["bond"], aum: 35 },
  { ticker: "VGIT", name: "Vanguard Intermediate-Term Treasury", category: "bond", tags: ["bond"], aum: 30 },
  { ticker: "GOVT", name: "iShares US Treasury Bond", category: "bond", tags: ["bond"], aum: 30 },
  { ticker: "IEI", name: "iShares 3-7 Year Treasury", category: "bond", tags: ["bond"], aum: 16 },
  { ticker: "SHY", name: "iShares 1-3 Year Treasury", category: "bond", tags: ["bond"], aum: 25 },
  { ticker: "VGSH", name: "Vanguard Short-Term Treasury", category: "bond", tags: ["bond"], aum: 25 },
  { ticker: "SCHO", name: "Schwab Short-Term US Treasury", category: "bond", tags: ["bond"], aum: 12 },
  { ticker: "LQD", name: "iShares iBoxx Investment Grade Corp", category: "bond", tags: ["bond"], aum: 32 },
  { ticker: "VCIT", name: "Vanguard Intermediate-Term Corp Bond", category: "bond", tags: ["bond"], aum: 50 },
  { ticker: "VCSH", name: "Vanguard Short-Term Corp Bond", category: "bond", tags: ["bond"], aum: 35 },
  { ticker: "VCLT", name: "Vanguard Long-Term Corp Bond", category: "bond", tags: ["bond"], aum: 12 },
  { ticker: "IGSB", name: "iShares 1-5 Year Investment Grade Corp", category: "bond", tags: ["bond"], aum: 22 },
  { ticker: "IGIB", name: "iShares 5-10 Year Investment Grade Corp", category: "bond", tags: ["bond"], aum: 14 },
  { ticker: "HYG", name: "iShares iBoxx High Yield Corp", category: "bond", tags: ["bond"], aum: 17 },
  { ticker: "JNK", name: "SPDR Bloomberg High Yield Bond", category: "bond", tags: ["bond"], aum: 9 },
  { ticker: "USHY", name: "iShares Broad USD High Yield Corp", category: "bond", tags: ["bond"], aum: 21 },
  { ticker: "SHYG", name: "iShares 0-5 Year High Yield Corp", category: "bond", tags: ["bond"], aum: 6 },
  { ticker: "SCHP", name: "Schwab US TIPS", category: "bond", tags: ["bond"], aum: 16 },
  { ticker: "TIP", name: "iShares TIPS Bond", category: "bond", tags: ["bond"], aum: 14 },
  { ticker: "VTIP", name: "Vanguard Short-Term Inflation-Protected", category: "bond", tags: ["bond"], aum: 13 },
  { ticker: "STIP", name: "iShares 0-5 Year TIPS Bond", category: "bond", tags: ["bond"], aum: 12 },
  { ticker: "MUB", name: "iShares National Muni Bond", category: "bond", tags: ["bond"], aum: 38 },
  { ticker: "VTEB", name: "Vanguard Tax-Exempt Bond", category: "bond", tags: ["bond"], aum: 35 },
  { ticker: "BSV", name: "Vanguard Short-Term Bond", category: "bond", tags: ["bond"], aum: 35 },
  { ticker: "BIV", name: "Vanguard Intermediate-Term Bond", category: "bond", tags: ["bond"], aum: 18 },
  { ticker: "BLV", name: "Vanguard Long-Term Bond", category: "bond", tags: ["bond"], aum: 6 },
  { ticker: "EMB", name: "iShares JPMorgan USD Emerging Markets Bond", category: "bond", tags: ["bond", "global"], aum: 16 },

  // ─── 원자재 ───
  { ticker: "GLD", name: "SPDR Gold Shares", category: "commodity", tags: ["commodity"], aum: 100 },
  { ticker: "GLDM", name: "SPDR Gold MiniShares", category: "commodity", tags: ["commodity"], aum: 14 },
  { ticker: "IAU", name: "iShares Gold Trust", category: "commodity", tags: ["commodity"], aum: 40 },
  { ticker: "IAUM", name: "iShares Gold Trust Micro", category: "commodity", tags: ["commodity"], aum: 2 },
  { ticker: "SLV", name: "iShares Silver Trust", category: "commodity", tags: ["commodity"], aum: 20 },
  { ticker: "SIVR", name: "abrdn Physical Silver Shares", category: "commodity", tags: ["commodity"], aum: 1.6 },
  { ticker: "PPLT", name: "abrdn Physical Platinum Shares", category: "commodity", tags: ["commodity"], aum: 1.5 },
  { ticker: "PALL", name: "abrdn Physical Palladium Shares", category: "commodity", tags: ["commodity"], aum: 0.4 },
  { ticker: "DBC", name: "Invesco DB Commodity Index Tracking", category: "commodity", tags: ["commodity"], aum: 1.5 },
  { ticker: "PDBC", name: "Invesco Optimum Yield Diversified Commodity", category: "commodity", tags: ["commodity"], aum: 4 },
  { ticker: "DBA", name: "Invesco DB Agriculture", category: "commodity", tags: ["commodity"], aum: 1 },
  { ticker: "USO", name: "United States Oil Fund", category: "commodity", tags: ["commodity", "thematic"], aum: 1.5 },
  { ticker: "UNG", name: "United States Natural Gas Fund", category: "commodity", tags: ["commodity"], aum: 0.5 },
  { ticker: "URA", name: "Global X Uranium", category: "commodity", tags: ["commodity", "thematic"], aum: 4 },
  { ticker: "COPX", name: "Global X Copper Miners", category: "commodity", tags: ["commodity"], aum: 2.5 },

  // ─── 리츠 ───
  { ticker: "VNQ", name: "Vanguard Real Estate", category: "reit", tags: ["reit"], aum: 38 },
  { ticker: "SCHH", name: "Schwab US REIT", category: "reit", tags: ["reit"], aum: 8 },
  { ticker: "IYR", name: "iShares US Real Estate", category: "reit", tags: ["reit"], aum: 4 },
  { ticker: "REZ", name: "iShares Residential & Multisector Real Estate", category: "reit", tags: ["reit"], aum: 1.2 },
  { ticker: "VNQI", name: "Vanguard Global ex-US Real Estate", category: "reit", tags: ["reit", "global"], aum: 4 },
  { ticker: "REM", name: "iShares Mortgage Real Estate", category: "reit", tags: ["reit"], aum: 0.7 },

  // ─── 섹터 ───
  { ticker: "XLF", name: "Financial Select Sector SPDR", category: "sector", tags: ["sector"], aum: 55 },
  { ticker: "VFH", name: "Vanguard Financials", category: "sector", tags: ["sector"], aum: 12 },
  { ticker: "KBE", name: "SPDR S&P Bank", category: "sector", tags: ["sector"], aum: 2 },
  { ticker: "KRE", name: "SPDR S&P Regional Banking", category: "sector", tags: ["sector"], aum: 4 },
  { ticker: "XLV", name: "Health Care Select Sector SPDR", category: "sector", tags: ["sector"], aum: 35 },
  { ticker: "VHT", name: "Vanguard Health Care", category: "sector", tags: ["sector"], aum: 18 },
  { ticker: "IBB", name: "iShares Biotechnology", category: "sector", tags: ["sector"], aum: 6 },
  { ticker: "XBI", name: "SPDR S&P Biotech", category: "sector", tags: ["sector"], aum: 6 },
  { ticker: "IHI", name: "iShares US Medical Devices", category: "sector", tags: ["sector"], aum: 5 },
  { ticker: "XLE", name: "Energy Select Sector SPDR", category: "sector", tags: ["sector"], aum: 30 },
  { ticker: "VDE", name: "Vanguard Energy", category: "sector", tags: ["sector"], aum: 8 },
  { ticker: "XOP", name: "SPDR S&P Oil & Gas Exploration", category: "sector", tags: ["sector"], aum: 2.5 },
  { ticker: "OIH", name: "VanEck Oil Services", category: "sector", tags: ["sector"], aum: 1.5 },
  { ticker: "XLY", name: "Consumer Discretionary Select Sector", category: "sector", tags: ["sector"], aum: 22 },
  { ticker: "VCR", name: "Vanguard Consumer Discretionary", category: "sector", tags: ["sector"], aum: 6 },
  { ticker: "XLP", name: "Consumer Staples Select Sector SPDR", category: "sector", tags: ["sector"], aum: 16 },
  { ticker: "VDC", name: "Vanguard Consumer Staples", category: "sector", tags: ["sector"], aum: 7 },
  { ticker: "XLU", name: "Utilities Select Sector SPDR", category: "sector", tags: ["sector"], aum: 18 },
  { ticker: "VPU", name: "Vanguard Utilities", category: "sector", tags: ["sector"], aum: 7 },
  { ticker: "XLI", name: "Industrial Select Sector SPDR", category: "sector", tags: ["sector"], aum: 22 },
  { ticker: "VIS", name: "Vanguard Industrials", category: "sector", tags: ["sector"], aum: 6 },
  { ticker: "ITA", name: "iShares US Aerospace & Defense", category: "sector", tags: ["sector"], aum: 7 },
  { ticker: "XLB", name: "Materials Select Sector SPDR", category: "sector", tags: ["sector"], aum: 6 },
  { ticker: "VAW", name: "Vanguard Materials", category: "sector", tags: ["sector"], aum: 4 },
  { ticker: "XLC", name: "Communication Services Select Sector", category: "sector", tags: ["sector"], aum: 22 },
  { ticker: "VOX", name: "Vanguard Communication Services", category: "sector", tags: ["sector"], aum: 5 },
  { ticker: "XLRE", name: "Real Estate Select Sector SPDR", category: "sector", tags: ["sector", "reit"], aum: 7 },

  // ─── 글로벌 ───
  { ticker: "VEA", name: "Vanguard FTSE Developed Markets", category: "global", tags: ["global"], aum: 150 },
  { ticker: "VWO", name: "Vanguard FTSE Emerging Markets", category: "global", tags: ["global"], aum: 90 },
  { ticker: "EFA", name: "iShares MSCI EAFE", category: "global", tags: ["global"], aum: 60 },
  { ticker: "IEFA", name: "iShares Core MSCI EAFE", category: "global", tags: ["global"], aum: 130 },
  { ticker: "IEMG", name: "iShares Core MSCI Emerging Markets", category: "global", tags: ["global"], aum: 90 },
  { ticker: "VT", name: "Vanguard Total World Stock", category: "global", tags: ["global"], aum: 45 },
  { ticker: "VXUS", name: "Vanguard Total International Stock", category: "global", tags: ["global"], aum: 90 },
  { ticker: "ACWI", name: "iShares MSCI ACWI", category: "global", tags: ["global"], aum: 25 },
  { ticker: "ACWX", name: "iShares MSCI ACWI ex US", category: "global", tags: ["global"], aum: 6 },
  { ticker: "IXUS", name: "iShares Core MSCI Total International Stock", category: "global", tags: ["global"], aum: 45 },
  { ticker: "EWJ", name: "iShares MSCI Japan", category: "global", tags: ["global"], aum: 17 },
  { ticker: "DXJ", name: "WisdomTree Japan Hedged Equity", category: "global", tags: ["global"], aum: 5 },
  { ticker: "INDA", name: "iShares MSCI India", category: "global", tags: ["global"], aum: 11 },
  { ticker: "INDY", name: "iShares India 50", category: "global", tags: ["global"], aum: 1 },
  { ticker: "EWZ", name: "iShares MSCI Brazil", category: "global", tags: ["global"], aum: 5 },
  { ticker: "MCHI", name: "iShares MSCI China", category: "global", tags: ["global"], aum: 5 },
  { ticker: "FXI", name: "iShares China Large-Cap", category: "global", tags: ["global"], aum: 7 },
  { ticker: "KWEB", name: "KraneShares CSI China Internet", category: "global", tags: ["global", "thematic"], aum: 6 },
  { ticker: "EWY", name: "iShares MSCI South Korea", category: "global", tags: ["global"], aum: 3 },
  { ticker: "EWT", name: "iShares MSCI Taiwan", category: "global", tags: ["global"], aum: 5 },
  { ticker: "EWG", name: "iShares MSCI Germany", category: "global", tags: ["global"], aum: 2 },
  { ticker: "EWU", name: "iShares MSCI United Kingdom", category: "global", tags: ["global"], aum: 3 },
  { ticker: "EWC", name: "iShares MSCI Canada", category: "global", tags: ["global"], aum: 4 },
  { ticker: "EWA", name: "iShares MSCI Australia", category: "global", tags: ["global"], aum: 1.5 },
  { ticker: "EWW", name: "iShares MSCI Mexico", category: "global", tags: ["global"], aum: 1.8 },
  { ticker: "EZA", name: "iShares MSCI South Africa", category: "global", tags: ["global"], aum: 0.4 },
  { ticker: "EPI", name: "WisdomTree India Earnings", category: "global", tags: ["global"], aum: 4 },

  // ─── 테마 ───
  { ticker: "QUAL", name: "iShares MSCI USA Quality Factor", category: "thematic", tags: ["thematic"], aum: 60 },
  { ticker: "MTUM", name: "iShares MSCI USA Momentum Factor", category: "thematic", tags: ["thematic"], aum: 18 },
  { ticker: "USMV", name: "iShares MSCI USA Min Vol Factor", category: "thematic", tags: ["thematic"], aum: 26 },
  { ticker: "VLUE", name: "iShares MSCI USA Value Factor", category: "thematic", tags: ["thematic"], aum: 8 },
  { ticker: "SIZE", name: "iShares MSCI USA Size Factor", category: "thematic", tags: ["thematic"], aum: 1 },
  { ticker: "GDX", name: "VanEck Gold Miners", category: "thematic", tags: ["thematic", "commodity"], aum: 17 },
  { ticker: "GDXJ", name: "VanEck Junior Gold Miners", category: "thematic", tags: ["thematic", "commodity"], aum: 5 },
  { ticker: "PAVE", name: "Global X US Infrastructure Development", category: "thematic", tags: ["thematic"], aum: 11 },
  { ticker: "BOXX", name: "Alpha Architect 1-3 Month Box", category: "thematic", tags: ["thematic", "bond"], aum: 8 },
  { ticker: "ARKK", name: "ARK Innovation", category: "thematic", tags: ["thematic"], aum: 6 },
  { ticker: "ARKQ", name: "ARK Autonomous Tech & Robotics", category: "thematic", tags: ["thematic"], aum: 1 },
  { ticker: "ARKW", name: "ARK Next Generation Internet", category: "thematic", tags: ["thematic"], aum: 1.5 },
  { ticker: "ARKG", name: "ARK Genomic Revolution", category: "thematic", tags: ["thematic"], aum: 1.5 },
  { ticker: "ARKF", name: "ARK Fintech Innovation", category: "thematic", tags: ["thematic"], aum: 0.7 },
  { ticker: "BOTZ", name: "Global X Robotics & Artificial Intelligence", category: "thematic", tags: ["thematic", "tech"], aum: 2.5 },
  { ticker: "ROBO", name: "ROBO Global Robotics & Automation", category: "thematic", tags: ["thematic", "tech"], aum: 1.5 },
  { ticker: "ICLN", name: "iShares Global Clean Energy", category: "thematic", tags: ["thematic"], aum: 1.5 },
  { ticker: "TAN", name: "Invesco Solar", category: "thematic", tags: ["thematic"], aum: 0.7 },
  { ticker: "QGRO", name: "American Century STOXX US Quality Growth", category: "thematic", tags: ["thematic", "growth"], aum: 1.5 },
  { ticker: "LIT", name: "Global X Lithium & Battery Tech", category: "thematic", tags: ["thematic"], aum: 1.2 },
  { ticker: "DRIV", name: "Global X Autonomous & Electric Vehicles", category: "thematic", tags: ["thematic"], aum: 0.5 },
  { ticker: "JFLI", name: "JPMorgan Flexible Income", category: "thematic", tags: ["thematic", "bond"], aum: 1 },

  // ─── 레버리지 ───
  { ticker: "TQQQ", name: "ProShares UltraPro QQQ (3x)", category: "leveraged", tags: ["leveraged", "nasdaq"], aum: 23 },
  { ticker: "SOXL", name: "Direxion Daily Semiconductor Bull 3X", category: "leveraged", tags: ["leveraged", "tech"], aum: 11 },
  { ticker: "QLD", name: "ProShares Ultra QQQ (2x)", category: "leveraged", tags: ["leveraged", "nasdaq"], aum: 9 },
  { ticker: "SSO", name: "ProShares Ultra S&P500 (2x)", category: "leveraged", tags: ["leveraged", "sp500"], aum: 5 },
  { ticker: "UPRO", name: "ProShares UltraPro S&P 500 (3x)", category: "leveraged", tags: ["leveraged", "sp500"], aum: 4 },
  { ticker: "SPXL", name: "Direxion Daily S&P 500 Bull 3X", category: "leveraged", tags: ["leveraged", "sp500"], aum: 4 },
  { ticker: "USD", name: "ProShares Ultra Semiconductors (2x)", category: "leveraged", tags: ["leveraged", "tech"], aum: 1 },
  { ticker: "FAS", name: "Direxion Daily Financial Bull 3X", category: "leveraged", tags: ["leveraged", "sector"], aum: 2.5 },
  { ticker: "TNA", name: "Direxion Daily Small Cap Bull 3X", category: "leveraged", tags: ["leveraged", "smallcap"], aum: 2 },
  { ticker: "LABU", name: "Direxion Daily S&P Biotech Bull 3X", category: "leveraged", tags: ["leveraged", "sector"], aum: 1 },
  { ticker: "TMF", name: "Direxion Daily 20+ Year Treasury Bull 3X", category: "leveraged", tags: ["leveraged", "bond"], aum: 0.8 },
  { ticker: "SQQQ", name: "ProShares UltraPro Short QQQ (-3x)", category: "leveraged", tags: ["leveraged", "nasdaq"], aum: 4 },
  { ticker: "SH", name: "ProShares Short S&P500 (-1x)", category: "leveraged", tags: ["leveraged", "sp500"], aum: 1.7 },

  // ─── 가상자산 ───
  { ticker: "IBIT", name: "iShares Bitcoin Trust", category: "crypto", tags: ["crypto"], aum: 80 },
  { ticker: "FBTC", name: "Fidelity Wise Origin Bitcoin", category: "crypto", tags: ["crypto"], aum: 25 },
  { ticker: "ETHA", name: "iShares Ethereum Trust", category: "crypto", tags: ["crypto"], aum: 12 },
  { ticker: "ETH", name: "Grayscale Ethereum Mini Trust", category: "crypto", tags: ["crypto"], aum: 4 },
  { ticker: "BITO", name: "ProShares Bitcoin Strategy", category: "crypto", tags: ["crypto"], aum: 3 },
  { ticker: "BITX", name: "Volatility Shares 2x Bitcoin (2x)", category: "crypto", tags: ["crypto", "leveraged"], aum: 2 },
  { ticker: "ETHU", name: "Volatility Shares 2x Ether (2x)", category: "crypto", tags: ["crypto", "leveraged"], aum: 0.5 },
  { ticker: "BITU", name: "ProShares Ultra Bitcoin (2x)", category: "crypto", tags: ["crypto", "leveraged"], aum: 1 },
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

/** 태그 기준 필터: 어떤 태그라도 매치되면 포함. */
export function filterByTag(tag: EtfCategory): EtfMeta[] {
  return ETF_CATALOG.filter((e) => e.tags.includes(tag));
}

export function findByTicker(ticker: string): EtfMeta | undefined {
  return ETF_CATALOG.find((e) => e.ticker === ticker);
}