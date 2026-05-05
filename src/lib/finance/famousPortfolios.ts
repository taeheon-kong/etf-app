/**
 * 유명 투자 포트폴리오 정의.
 * 추천 포트폴리오와 비교용.
 */

export type FamousPortfolioDef = {
  id: string;
  name: string;
  author: string;
  description: string;
  philosophy: string;
  holdings: Array<{ ticker: string; weight: number }>;
};

export const FAMOUS_PORTFOLIOS: FamousPortfolioDef[] = [
  {
    id: "all_weather",
    name: "All Weather",
    author: "Ray Dalio (Bridgewater)",
    description: "어떤 경제 환경에서도 견디는 균형 포트폴리오",
    philosophy: "성장/침체 × 인플레/디플레 4가지 시나리오에 동등 분산. 듀레이션 리스크 가중.",
    holdings: [
      { ticker: "VTI", weight: 30 },
      { ticker: "TLT", weight: 40 },
      { ticker: "IEF", weight: 15 },
      { ticker: "GLD", weight: 7.5 },
      { ticker: "DBC", weight: 7.5 },
    ],
  },
  {
    id: "bogleheads_3fund",
    name: "Bogleheads 3펀드",
    author: "John Bogle (Vanguard 창립자)",
    description: "세계에서 가장 단순하고 효율적인 패시브 포트폴리오",
    philosophy: "초저비용 인덱스 3개로 전 세계 분산. 'Don't look for the needle, buy the haystack.'",
    holdings: [
      { ticker: "VTI", weight: 60 },
      { ticker: "VXUS", weight: 20 },
      { ticker: "BND", weight: 20 },
    ],
  },
  {
    id: "classic_60_40",
    name: "Classic 60/40",
    author: "전통적 자산배분",
    description: "월스트리트 표준 60% 주식 + 40% 채권",
    philosophy: "주식 성장 + 채권 안정. 60년간 검증된 가장 보편적 배분.",
    holdings: [
      { ticker: "VOO", weight: 60 },
      { ticker: "AGG", weight: 40 },
    ],
  },
  {
    id: "permanent",
    name: "Permanent Portfolio",
    author: "Harry Browne",
    description: "어떤 경제 상황에서도 한 자산은 항상 빛난다",
    philosophy: "주식(번영) + 장기채(디플레) + 금(인플레) + 현금(불황) 균등 배분.",
    holdings: [
      { ticker: "VTI", weight: 25 },
      { ticker: "TLT", weight: 25 },
      { ticker: "GLD", weight: 25 },
      { ticker: "BIL", weight: 25 },
    ],
  },
  {
    id: "buffett_90_10",
    name: "Buffett 90/10",
    author: "Warren Buffett",
    description: "워런 버핏이 아내에게 남긴 유언 포트폴리오",
    philosophy: "S&P500 90% + 단기국채 10%. 단순함의 극치.",
    holdings: [
      { ticker: "VOO", weight: 90 },
      { ticker: "BIL", weight: 10 },
    ],
  },
  {
    id: "yale_endowment",
    name: "Yale Endowment Style",
    author: "David Swensen",
    description: "예일대 기금 모델의 단순화 버전",
    philosophy: "주식 + 글로벌 + 부동산 + 채권 + 원자재 분산. 기관급 분산 전략.",
    holdings: [
      { ticker: "VTI", weight: 30 },
      { ticker: "VEA", weight: 15 },
      { ticker: "VWO", weight: 10 },
      { ticker: "VNQ", weight: 20 },
      { ticker: "TLT", weight: 15 },
      { ticker: "GLD", weight: 10 },
    ],
  },
  {
    id: "korea_3fund",
    name: "한국형 3펀드",
    author: "한국 투자자용 변형",
    description: "한국 + 미국 + 채권의 단순 분산",
    philosophy: "한국 코스피 + 미국 S&P500 + 한국 국채. 환차익까지 활용.",
    holdings: [
      { ticker: "069500", weight: 40 }, // KODEX 200
      { ticker: "360750", weight: 40 }, // TIGER 미국S&P500
      { ticker: "114260", weight: 20 }, // KODEX 국고채3년
    ],
  },
];