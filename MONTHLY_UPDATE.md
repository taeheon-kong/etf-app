## 분석 프롬프트 (그대로 복사해서 사용)

너는 글로벌 매크로 애널리스트야. ETF 추천 시스템의 월간 분석 데이터를 만들어줘.

[첨부 데이터]
1. 글로벌 거시 지표 JSON (yfinance 29개, 1개월/3개월/6개월/1년 변화율)
2. 5개 지역 뉴스 헤드라인 (한국/미국/유럽/일본/중국, 200~250개)

[작업]

# Part 1. 핵심 한 줄 진단 (headline)

이번 달 시장의 핵심을 한 문장으로. 25자 내외. 뉴스/데이터 종합한 시장의 본질.

예시:
- "위험자산 랠리 지속, 인플레·지정학 리스크 누적"
- "AI 광풍 식는 사이 채권·금 매력 부각"
- "강달러 약화 + 미·중 갈등 완화로 신흥국 회복"

# Part 2. 시장 환경 종합 (summary, 줄글)

3~4문장. 데이터에서 가장 중요한 신호 + 뉴스 큰 흐름 통합. 구체적 수치 인용 필수.

# Part 3. 카테고리 환경 점수 (categoryScores, 20개)

20개 카테고리에 0~100점.
us_large, us_tech, us_small, korea_stock, europe_stock, japan_stock, china_stock,
emerging_stock, bond, dividend, commodity, gold, realestate, healthcare,
finance, infra, clean_energy, thematic, crypto, global

점수 기준: 80~100 매우우호, 65~79 우호, 50~64 중립, 35~49 비우호, 0~34 매우비우호

# Part 4. 카테고리 한 줄 코멘트 (categoryNotes, 20개)

각 카테고리 20자 내외. 핵심 신호 1개만.

# Part 5. 자산군 단위 포트폴리오 narrative

성향 3종(방어/균형/공격)에 대해, **자산군 단위**로 narrative 작성.
ETF 이름이 아니라 자산군(예: "선진국 주식", "미국 반도체", "단기채")을 언급.

⚠️ 비중 명시는 시스템 기본값을 정확히 따라야 함 (다른 비중 제시하지 말 것):
- 방어형: 주식 25% + 채권 55% + 대체(금/원자재/리츠) 15% + 현금 5%
- 균형형: 주식 50% + 채권 25% + 대체 15% + 현금 10%
- 공격형: 주식 75% + 채권 0% + 대체 15% + 현금 10%

각 narrative 구조 (450~550자):
(1) 현재 시장 환경 진단 — 거시 수치 2~3개 + 뉴스 사건 1~2개 구체 인용
(2) 이런 환경에서 왜 위 자산군 비중이 적합한지 인과 설명 (위 기본 비중 그대로 인용)
(3) 구체적 리스크 시나리오 1~2개 — "X가 발생하면 Y 자산이 Z% 영향" 식
(4) 어떤 투자자에게 적합한지 한 문장

⚠️ 작성 원칙:
- AI스러운 일반론 금지 ("균형 잡힌", "분산 투자를 통해")
- 데이터 수치 반드시 구체 인용
- 자산군 비중은 위 기본값을 그대로 사용 (변경 금지)
- 리스크는 "코스피 -20% 시나리오 시 6개월 내" 같이 시점·강도 포함

# Part 6. 사용자 프로필별 추가 코멘트 (profileHints)

다음 4가지 사용자 유형에 대해 각 100~150자로 짧은 추가 가이드:

1. "young_aggressive" — 20~30대 공격적 투자자
2. "midage_balanced" — 30~50대 안정+성장 추구
3. "retirement_defensive" — 은퇴 준비 또는 은퇴자
4. "theme_focused" — 특정 테마(AI/배당 등) 집중 관심

각 유형별로:
- 이 시장 환경에서 이런 사람이 특히 주의할 점 또는 기회
- 위 자산군 비중에서 어떤 것을 추가/제외해야 할지

[출력 형식]

순수 JSON만. 코드 블록 없이. 다른 설명 없이 객체 하나만.

{
  "asOf": "YYYY-MM-DD",
  "headline": "Part 1 한 줄 진단",
  "summary": "Part 2 줄글",
  "categoryScores": {
    "us_large": 점수, "us_tech": 점수, "us_small": 점수, "korea_stock": 점수,
    "europe_stock": 점수, "japan_stock": 점수, "china_stock": 점수,
    "emerging_stock": 점수, "bond": 점수, "dividend": 점수, "commodity": 점수,
    "gold": 점수, "realestate": 점수, "healthcare": 점수, "finance": 점수,
    "infra": 점수, "clean_energy": 점수, "thematic": 점수, "crypto": 점수,
    "global": 점수
  },
  "categoryNotes": {
    "us_large": "코멘트", "us_tech": "코멘트", "us_small": "코멘트",
    "korea_stock": "코멘트", "europe_stock": "코멘트", "japan_stock": "코멘트",
    "china_stock": "코멘트", "emerging_stock": "코멘트", "bond": "코멘트",
    "dividend": "코멘트", "commodity": "코멘트", "gold": "코멘트",
    "realestate": "코멘트", "healthcare": "코멘트", "finance": "코멘트",
    "infra": "코멘트", "clean_energy": "코멘트", "thematic": "코멘트",
    "crypto": "코멘트", "global": "코멘트"
  },
  "portfolioNarratives": {
    "defensive": "방어형 자산군 단위 줄글 (450~550자)",
    "balanced": "균형형 자산군 단위 줄글 (450~550자)",
    "aggressive": "공격형 자산군 단위 줄글 (450~550자)"
  },
  "profileHints": {
    "young_aggressive": "20~30대 공격투자자 가이드 (100~150자)",
    "midage_balanced": "30~50대 안정성장 가이드 (100~150자)",
    "retirement_defensive": "은퇴 준비 가이드 (100~150자)",
    "theme_focused": "테마 집중 가이드 (100~150자)"
  }
}

[주의사항]
- 한국 사용자용. 한국+미국 비중 정확히
- 정치적 편향 배제, 시장 영향만
- 데이터 수치 필수 인용
- 점수 보수적으로 (90+ 진짜 강한 호재만)
- 한국어로 자연스럽게