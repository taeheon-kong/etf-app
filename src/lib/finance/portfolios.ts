export type PortfolioCategory = "주식 단일" | "주식+채권" | "글로벌" | "방어·균형" | "인컴·배당" | "한국형";

export interface FamousPortfolio {
  id: string;
  category: PortfolioCategory;
  name: string;
  desc: string;
  holdings: { ticker: string; weight: number }[];
  author?: string;
  philosophy?: string;
}

export const FAMOUS_PORTFOLIOS: FamousPortfolio[] = [
  // ─── 주식 단일 ───
  { id: "s1", category: "주식 단일", name: "미국 전체 시장", desc: "장기 성장형", author: "Vanguard 클래식", philosophy: "미국 주식 전체에 한 번에 투자하는 가장 단순한 구조. 종목 선택 없이 시장 평균만 받아간다.", holdings: [{ ticker: "VTI", weight: 100 }] },
  { id: "s2", category: "주식 단일", name: "S&P 500", desc: "장기 성장형", author: "패시브 정통", philosophy: "미국 대형주 500개에만 집중. 'S&P를 못 이기면 S&P를 사라.'", holdings: [{ ticker: "VOO", weight: 100 }] },
  { id: "s3", category: "주식 단일", name: "나스닥 100", desc: "공격 성장형", author: "기술주 베팅", philosophy: "기술주 위주의 나스닥 100 종목에 100% 집중. 변동성 크지만 장기 수익률은 강함.", holdings: [{ ticker: "QQQ", weight: 100 }] },
  { id: "s4", category: "주식 단일", name: "성장주 100", desc: "공격 성장형", author: "Schwab Growth", philosophy: "성장 가속이 빠른 기업들에만 베팅. 가치주는 일부러 배제.", holdings: [{ ticker: "SCHG", weight: 100 }] },

  // ─── 주식+채권 ───
  { id: "eb1", category: "주식+채권", name: "버핏 90/10", desc: "장기 성장형", author: "Warren Buffett", philosophy: "S&P500 90% + 단기국채 10%. 워런 버핏이 아내에게 남긴 유언 포트폴리오.", holdings: [{ ticker: "SPY", weight: 90 }, { ticker: "SHY", weight: 10 }] },
  { id: "eb2", category: "주식+채권", name: "80/20 포트폴리오", desc: "안정 성장형", author: "전통적 자산배분", philosophy: "주식 80% + 채권 20%. 성장에 무게를 두지만 채권으로 약간의 방어를 끼워넣는 구조.", holdings: [{ ticker: "SPY", weight: 80 }, { ticker: "BND", weight: 20 }] },
  { id: "eb3", category: "주식+채권", name: "70/30 포트폴리오", desc: "균형형", author: "전통적 자산배분", philosophy: "주식 70% + 중기채 30%. 성장과 안정의 중간 지점.", holdings: [{ ticker: "SPY", weight: 70 }, { ticker: "IEF", weight: 30 }] },
  { id: "eb4", category: "주식+채권", name: "60/40 포트폴리오", desc: "균형형", author: "월스트리트 표준", philosophy: "주식 60% + 장기채 40%. 60년간 검증된 가장 보편적 자산배분.", holdings: [{ ticker: "SPY", weight: 60 }, { ticker: "TLT", weight: 40 }] },
  { id: "eb5", category: "주식+채권", name: "보글헤즈 3펀드", desc: "장기 분산형", author: "John Bogle", philosophy: "초저비용 인덱스 3개로 전 세계 분산. '바늘을 찾지 말고 건초더미 전체를 사라.'", holdings: [{ ticker: "VTI", weight: 60 }, { ticker: "VEA", weight: 20 }, { ticker: "BND", weight: 20 }] },
  { id: "eb6", category: "주식+채권", name: "번스타인 4펀드", desc: "장기 분산형", author: "William Bernstein", philosophy: "미국·해외·소형주·중기채 25%씩 균등. 단순 분산의 대표 모델.", holdings: [{ ticker: "VTI", weight: 25 }, { ticker: "VEA", weight: 25 }, { ticker: "IWM", weight: 25 }, { ticker: "IEF", weight: 25 }] },

  // ─── 글로벌 ───
  { id: "g1", category: "글로벌", name: "글로벌 주식", desc: "글로벌 분산형", author: "전세계 분산", philosophy: "미국·선진국·신흥국 주식만으로 채운 100% 주식 글로벌 분산.", holdings: [{ ticker: "VTI", weight: 60 }, { ticker: "VEA", weight: 25 }, { ticker: "VWO", weight: 15 }] },
  { id: "g2", category: "글로벌", name: "아이비 포트폴리오", desc: "글로벌 분산형", author: "Mebane Faber", philosophy: "주식·해외·부동산·채권·원자재 5개 자산군 균등. 'Ivy League 기금' 모방.", holdings: [{ ticker: "VTI", weight: 20 }, { ticker: "VEA", weight: 20 }, { ticker: "VNQ", weight: 20 }, { ticker: "AGG", weight: 20 }, { ticker: "PDBC", weight: 20 }] },
  { id: "g3", category: "글로벌", name: "스웬슨 (Yale)", desc: "기관형 분산", author: "David Swensen", philosophy: "예일대 기금 모델 단순화. 주식·글로벌·부동산·채권·금 분산.", holdings: [{ ticker: "VTI", weight: 30 }, { ticker: "VEA", weight: 15 }, { ticker: "VWO", weight: 5 }, { ticker: "VNQ", weight: 20 }, { ticker: "TLT", weight: 15 }, { ticker: "IEF", weight: 15 }] },
  { id: "g4", category: "글로벌", name: "전세계 분산", desc: "글로벌 분산형", author: "ACWI 기반", philosophy: "전 세계 주식 + 채권 + 부동산 + 금. 한 ETF(ACWI)로 글로벌 50%를 커버.", holdings: [{ ticker: "ACWI", weight: 50 }, { ticker: "BND", weight: 30 }, { ticker: "VNQ", weight: 10 }, { ticker: "GLD", weight: 10 }] },

  // ─── 방어·균형 ───
  { id: "d1", category: "방어·균형", name: "올웨더", desc: "방어형", author: "Ray Dalio", philosophy: "성장/침체 × 인플레/디플레 4가지 시나리오에 동등 분산. 채권 비중을 길게 잡는 구조.", holdings: [{ ticker: "VTI", weight: 30 }, { ticker: "TLT", weight: 40 }, { ticker: "IEF", weight: 15 }, { ticker: "GLD", weight: 7.5 }, { ticker: "PDBC", weight: 7.5 }] },
  { id: "d2", category: "방어·균형", name: "영구 포트폴리오", desc: "방어형", author: "Harry Browne", philosophy: "주식(번영) + 장기채(디플레) + 금(인플레) + 현금(불황) 균등 25%씩.", holdings: [{ ticker: "SPY", weight: 25 }, { ticker: "TLT", weight: 25 }, { ticker: "GLD", weight: 25 }, { ticker: "SGOV", weight: 25 }] },
  { id: "d3", category: "방어·균형", name: "황금나비", desc: "방어형", author: "Tyler / Portfolio Charts", philosophy: "5개 자산을 20%씩 동등 분배. 미국 대형·소형·장기채·중기채·금.", holdings: [{ ticker: "VTI", weight: 20 }, { ticker: "IWM", weight: 20 }, { ticker: "TLT", weight: 20 }, { ticker: "IEF", weight: 20 }, { ticker: "GLD", weight: 20 }] },
  { id: "d4", category: "방어·균형", name: "사막 포트폴리오", desc: "단순 헤지형", author: "단순 헤지", philosophy: "주식 60% + 금 40%. 채권을 빼고 금만으로 인플레 헤지.", holdings: [{ ticker: "VTI", weight: 60 }, { ticker: "GLD", weight: 40 }] },
  { id: "d5", category: "방어·균형", name: "리스크 패리티", desc: "안정형", author: "Bridgewater 변형", philosophy: "주식·채권·금에 위험 기여도가 비슷하도록 33%씩 분배. 변동성을 평탄화.", holdings: [{ ticker: "SPY", weight: 33 }, { ticker: "TLT", weight: 34 }, { ticker: "GLD", weight: 33 }] },
  { id: "d6", category: "방어·균형", name: "커피하우스", desc: "장기 분산형", author: "Bill Schultheis", philosophy: "7개 자산에 골고루. 채권 40%로 안정 위주.", holdings: [{ ticker: "VTI", weight: 10 }, { ticker: "VB", weight: 10 }, { ticker: "VEA", weight: 10 }, { ticker: "VNQ", weight: 10 }, { ticker: "AGG", weight: 40 }, { ticker: "VIG", weight: 10 }, { ticker: "IWM", weight: 10 }] },

  // ─── 인컴·배당 ───
  { id: "i1", category: "인컴·배당", name: "배당 성장", desc: "배당 성장형", author: "DGI 정통", philosophy: "배당 늘어나는 우량주 위주. SCHD·VIG·DGRO 3개로 성장 배당 분산.", holdings: [{ ticker: "SCHD", weight: 50 }, { ticker: "VIG", weight: 30 }, { ticker: "DGRO", weight: 20 }] },
  { id: "i2", category: "인컴·배당", name: "고배당", desc: "인컴형", author: "High Yield 정통", philosophy: "지금 당장 받는 배당이 높은 종목 위주. 가격 상승보다 현금흐름 우선.", holdings: [{ ticker: "VYM", weight: 40 }, { ticker: "SCHD", weight: 40 }, { ticker: "DVY", weight: 20 }] },
  { id: "i3", category: "인컴·배당", name: "배당 귀족", desc: "배당 안정형", author: "Dividend Aristocrats", philosophy: "25년 이상 배당을 늘려온 기업들에만 투자. 배당의 안정성에 무게.", holdings: [{ ticker: "NOBL", weight: 40 }, { ticker: "VIG", weight: 30 }, { ticker: "SCHD", weight: 30 }] },
  { id: "i4", category: "인컴·배당", name: "커버드콜 인컴", desc: "월배당형", author: "JEPI/JEPQ", philosophy: "옵션 매도로 매월 분배금을 짜내는 구조. 상승 여력 일부를 포기하고 인컴을 받음.", holdings: [{ ticker: "JEPI", weight: 40 }, { ticker: "JEPQ", weight: 30 }, { ticker: "SCHD", weight: 30 }] },

  // ─── 한국형 ───
  { id: "kr1", category: "한국형", name: "한국형 3펀드", desc: "한국 투자자용 변형", author: "한국형 분산", philosophy: "한국 코스피 + 미국 S&P500 + 한국 국채. 환차익까지 활용.", holdings: [{ ticker: "069500", weight: 40 }, { ticker: "360750", weight: 40 }, { ticker: "114260", weight: 20 }] },
];