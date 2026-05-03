export type PortfolioCategory = "주식 단일" | "주식+채권" | "글로벌" | "방어·균형" | "인컴·배당";

export interface FamousPortfolio {
  id: string;
  category: PortfolioCategory;
  name: string;
  desc: string;
  holdings: { ticker: string; weight: number }[];
}

export const FAMOUS_PORTFOLIOS: FamousPortfolio[] = [
  // ─── 주식 단일 ───
  { id: "s1", category: "주식 단일", name: "미국 전체 시장", desc: "장기 성장형", holdings: [{ ticker: "VTI", weight: 100 }] },
  { id: "s2", category: "주식 단일", name: "S&P 500", desc: "장기 성장형", holdings: [{ ticker: "VOO", weight: 100 }] },
  { id: "s3", category: "주식 단일", name: "나스닥 100", desc: "공격 성장형", holdings: [{ ticker: "QQQ", weight: 100 }] },
  { id: "s4", category: "주식 단일", name: "성장주 100", desc: "공격 성장형", holdings: [{ ticker: "SCHG", weight: 100 }] },

  // ─── 주식+채권 ───
  { id: "eb1", category: "주식+채권", name: "버핏 포트폴리오", desc: "장기 성장형", holdings: [{ ticker: "SPY", weight: 90 }, { ticker: "SHY", weight: 10 }] },
  { id: "eb2", category: "주식+채권", name: "80/20 포트폴리오", desc: "안정 성장형", holdings: [{ ticker: "SPY", weight: 80 }, { ticker: "BND", weight: 20 }] },
  { id: "eb3", category: "주식+채권", name: "70/30 포트폴리오", desc: "균형형", holdings: [{ ticker: "SPY", weight: 70 }, { ticker: "IEF", weight: 30 }] },
  { id: "eb4", category: "주식+채권", name: "60/40 포트폴리오", desc: "균형형", holdings: [{ ticker: "SPY", weight: 60 }, { ticker: "TLT", weight: 40 }] },
  { id: "eb5", category: "주식+채권", name: "보글헤즈 3펀드", desc: "장기 분산형", holdings: [{ ticker: "VTI", weight: 60 }, { ticker: "VEA", weight: 20 }, { ticker: "BND", weight: 20 }] },
  { id: "eb6", category: "주식+채권", name: "번스타인 4펀드", desc: "장기 분산형", holdings: [{ ticker: "VTI", weight: 25 }, { ticker: "VEA", weight: 25 }, { ticker: "IWM", weight: 25 }, { ticker: "IEF", weight: 25 }] },

  // ─── 글로벌 ───
  { id: "g1", category: "글로벌", name: "글로벌 주식", desc: "글로벌 분산형", holdings: [{ ticker: "VTI", weight: 60 }, { ticker: "VEA", weight: 25 }, { ticker: "VWO", weight: 15 }] },
  { id: "g2", category: "글로벌", name: "아이비 포트폴리오", desc: "글로벌 분산형", holdings: [{ ticker: "VTI", weight: 20 }, { ticker: "VEA", weight: 20 }, { ticker: "VNQ", weight: 20 }, { ticker: "AGG", weight: 20 }, { ticker: "PDBC", weight: 20 }] },
  { id: "g3", category: "글로벌", name: "스웬슨 포트폴리오", desc: "기관형 분산", holdings: [{ ticker: "VTI", weight: 30 }, { ticker: "VEA", weight: 15 }, { ticker: "VWO", weight: 5 }, { ticker: "VNQ", weight: 20 }, { ticker: "TLT", weight: 15 }, { ticker: "IEF", weight: 15 }] },
  { id: "g4", category: "글로벌", name: "전세계 분산", desc: "글로벌 분산형", holdings: [{ ticker: "ACWI", weight: 50 }, { ticker: "BND", weight: 30 }, { ticker: "VNQ", weight: 10 }, { ticker: "GLD", weight: 10 }] },

  // ─── 방어·균형 ───
  { id: "d1", category: "방어·균형", name: "올웨더 포트폴리오", desc: "방어형", holdings: [{ ticker: "VTI", weight: 30 }, { ticker: "TLT", weight: 40 }, { ticker: "IEF", weight: 15 }, { ticker: "GLD", weight: 7.5 }, { ticker: "PDBC", weight: 7.5 }] },
  { id: "d2", category: "방어·균형", name: "영구 포트폴리오", desc: "방어형", holdings: [{ ticker: "SPY", weight: 25 }, { ticker: "TLT", weight: 25 }, { ticker: "GLD", weight: 25 }, { ticker: "SGOV", weight: 25 }] },
  { id: "d3", category: "방어·균형", name: "황금나비 포트폴리오", desc: "방어형", holdings: [{ ticker: "VTI", weight: 20 }, { ticker: "IWM", weight: 20 }, { ticker: "TLT", weight: 20 }, { ticker: "IEF", weight: 20 }, { ticker: "GLD", weight: 20 }] },
  { id: "d4", category: "방어·균형", name: "사막 포트폴리오", desc: "단순 해지형", holdings: [{ ticker: "VTI", weight: 60 }, { ticker: "GLD", weight: 40 }] },
  { id: "d5", category: "방어·균형", name: "리스크 패리티", desc: "안정형", holdings: [{ ticker: "SPY", weight: 33 }, { ticker: "TLT", weight: 34 }, { ticker: "GLD", weight: 33 }] },
  { id: "d6", category: "방어·균형", name: "커피하우스", desc: "장기 분산형", holdings: [{ ticker: "VTI", weight: 10 }, { ticker: "VB", weight: 10 }, { ticker: "VEA", weight: 10 }, { ticker: "VNQ", weight: 10 }, { ticker: "AGG", weight: 40 }, { ticker: "VIG", weight: 10 }, { ticker: "IWM", weight: 10 }] },

  // ─── 인컴·배당 ───
  { id: "i1", category: "인컴·배당", name: "배당 성장", desc: "배당 성장형", holdings: [{ ticker: "SCHD", weight: 50 }, { ticker: "VIG", weight: 30 }, { ticker: "DGRO", weight: 20 }] },
  { id: "i2", category: "인컴·배당", name: "고배당", desc: "인컴형", holdings: [{ ticker: "VYM", weight: 40 }, { ticker: "SCHD", weight: 40 }, { ticker: "DVY", weight: 20 }] },
  { id: "i3", category: "인컴·배당", name: "배당 귀족", desc: "배당 안정형", holdings: [{ ticker: "NOBL", weight: 40 }, { ticker: "VIG", weight: 30 }, { ticker: "SCHD", weight: 30 }] },
  { id: "i4", category: "인컴·배당", name: "커버드콜 인컴", desc: "월배당형", holdings: [{ ticker: "JEPI", weight: 40 }, { ticker: "JEPQ", weight: 30 }, { ticker: "SCHD", weight: 30 }] }
];