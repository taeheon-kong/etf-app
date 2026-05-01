"""한국 ETF 카탈로그 자동 생성 (v2 - 한국 시장 카테고리 체계).

카테고리 체계:
1. kospi      코스피 (KOSPI200, KOSDAQ150, KRX300 등 국내지수)
2. kosdaq     코스닥
3. usIndex    미국지수 (S&P500, 나스닥, 다우, 러셀)
4. global     글로벌 (선진국, 신흥국, 일본, 중국, 인도, 베트남)
5. sector     섹터 (반도체, 2차전지, 바이오, 방산, AI, 자동차 등 업종)
6. thematic   테마 (메타버스, ESG, 친환경, 인프라 등 컨셉)
7. dividend   배당
8. coveredCall 커버드콜 (TR 포함)
9. bond       채권 (국고채, 회사채, 단기, CD, MMF)
10. commodity 원자재 (금, 은, 원유)
11. realEstate 리츠
12. leveraged 레버리지/인버스
13. crypto    가상자산
"""

from __future__ import annotations

import sys
from pathlib import Path

import FinanceDataReader as fdr


CATALOG_PATH = Path(__file__).resolve().parent.parent / "src" / "lib" / "finance" / "catalogKr.ts"
TARGET_COUNT = 200


# 카테고리 매칭 규칙: (카테고리, 키워드 리스트) — 위에서부터 우선 매칭.
# 키워드는 종목명 대문자 변환 후 검색.
CATEGORY_RULES: list[tuple[str, list[str]]] = [
    # 1. 레버리지/인버스 (먼저 잡아야 다른 데로 안 빠짐)
    ("leveraged", ["레버리지", "인버스", "곱버스", "2X", "3X", "선물인버스"]),

    # 2. 가상자산
    ("crypto", ["비트코인", "이더리움", "BTC", "ETH"]),

    # 3. 커버드콜 (미국지수·코스피보다 먼저)
    ("coveredCall", ["커버드콜", "타겟프리미엄", "프리미엄인컴", "프리미엄데일리",
                     "데일리인컴", "월배당프리미엄"]),

    # 4. 리츠 (배당보다 먼저)
    ("realEstate", ["리츠", "REITs", "REIT", "부동산", "오피스"]),

    # 5. 미국지수 (S&P, 나스닥, 다우, 러셀)
    ("usIndex", ["S&P500", "S&P 500", "SP500", "나스닥", "NASDAQ", "다우존스", "DOW",
                 "러셀", "RUSSELL", "필라델피아반도체", "미국30", "미국대형주"]),

    # 6. 글로벌 (국가/지역)
    ("global", ["일본", "JAPAN", "닛케이", "TOPIX", "차이나", "중국", "항셍", "CSI",
                "인도", "INDIA", "니프티", "NIFTY", "베트남", "VIETNAM", "VN30",
                "유럽", "EUROPE", "EU600", "독일", "DAX", "영국", "FTSE",
                "신흥", "이머징", "EM", "선진국", "글로벌", "MSCI", "전세계", "WORLD",
                "ACWI", "DM", "EAFE"]),

    # 7. 코스피
    ("kospi", ["KOSPI", "코스피", "KRX 300", "KRX300", "200TR", "200동일가중",
               " 200", "200 ", "200액티브", "코리아TOP", "밸류업"]),

    # 8. 코스닥
    ("kosdaq", ["코스닥", "KOSDAQ", "KOSDAQ150"]),

    # 9. 섹터 (산업·업종)
    ("sector", ["반도체", "SEMI", "2차전지", "배터리", "리튬", "전기차",
                "바이오", "헬스케어", "제약", "의료기기",
                "방산", "K방산", "우주항공", "우주", "조선",
                "AI", "인공지능", "로봇", "휴머노이드",
                "원자력", "SMR", "원전",
                "자동차", "은행", "증권", "보험", "건설",
                "철강", "화학", "에너지", "정유", "태양광", "ESS",
                "게임", "엔터", "엔터테인먼트", "K-POP", "미디어",
                "필수소비", "경기소비", "유통", "음식료",
                "유틸리티", "통신", "IT", "인터넷",
                "수출",
                "삼성그룹", "현대차그룹", "지주회사",
                "테슬라", "빅테크", "메가테크"]),

    # 10. 테마 (컨셉/스타일)
    ("thematic", ["메타버스", "K-뉴딜", "ESG", "신재생", "친환경", "탄소", "수소",
                  "물", "WATER", "농업", "곡물", "AGRICULTURE",
                  "Quality", "퀄리티", "성장", "Growth", "가치", "Value",
                  "모멘텀", "Momentum", "로우볼", "최소변동",
                  "팩터", "Factor", "스마트베타",
                  "TOP10", "TOP", "리더스", "초이스",
                  "TDF", "타겟데이트", "라이프사이클",
                  "네트워크", "인프라"]),

    # 11. 배당
    ("dividend", ["고배당", "배당", "Dividend", "DIVO"]),

    # 12. 채권
    ("bond", ["채권", "국고채", "회사채", "TIPS", "단기", "CD금리", "머니마켓",
              "MMF", "RP", "통안", "물가연동", "크레딧", "투자등급",
              "TR", "인컴"]),

    # 13. 원자재
    ("commodity", ["금", "GOLD", "은", "SILVER", "원유", "WTI", "브렌트", "구리",
                   "팔라듐", "백금", "농산물", "곡물"]),
]

CATEGORY_LABELS = {
    "kospi": "코스피",
    "kosdaq": "코스닥",
    "usIndex": "미국지수",
    "global": "글로벌",
    "sector": "섹터",
    "thematic": "테마",
    "dividend": "배당",
    "coveredCall": "커버드콜",
    "bond": "채권",
    "commodity": "원자재",
    "realEstate": "리츠",
    "leveraged": "레버리지/인버스",
    "crypto": "가상자산",
}

CATEGORY_ORDER = list(CATEGORY_LABELS.keys())


def classify(name: str) -> tuple[str, list[str]]:
    """이름에서 primary 카테고리 + 모든 매치된 태그 반환."""
    name_upper = name.upper()
    matched: list[str] = []
    for cat, keywords in CATEGORY_RULES:
        for kw in keywords:
            if kw.upper() in name_upper:
                if cat not in matched:
                    matched.append(cat)
                break
    if not matched:
        return ("thematic", ["thematic"])
    return (matched[0], matched)


def main() -> int:
    print("FinanceDataReader로 ETF 리스트 가져오는 중...")
    df = fdr.StockListing("ETF/KR")
    print(f"전체 ETF: {len(df)}개")

    df = df[["Symbol", "Name", "Price", "NAV", "Volume", "Amount", "MarCap"]].copy()
    df = df.dropna(subset=["Symbol", "Name", "MarCap"])
    df["MarCap"] = df["MarCap"].astype(float)
    df["Volume"] = df["Volume"].fillna(0).astype(float)
    df["Amount"] = df["Amount"].fillna(0).astype(float)

    df["MarCapScore"] = df["MarCap"] / df["MarCap"].max()
    df["AmountScore"] = df["Amount"] / df["Amount"].max() if df["Amount"].max() > 0 else 0
    df["Score"] = df["MarCapScore"] * 0.7 + df["AmountScore"] * 0.3

    EXCLUDE_KEYWORDS = ["콜옵션", "풋옵션", "선물스프레드"]
    for kw in EXCLUDE_KEYWORDS:
        df = df[~df["Name"].str.contains(kw, na=False)]

    df = df.sort_values("Score", ascending=False).head(TARGET_COUNT).reset_index(drop=True)

    rows: list[dict] = []
    category_counts: dict[str, int] = {}
    unmatched: list[str] = []

    for _, r in df.iterrows():
        primary, tags = classify(r["Name"])
        if primary == "thematic" and "thematic" not in [k for k, _ in CATEGORY_RULES if any(kw.upper() in r["Name"].upper() for kw in [k for k, kws in CATEGORY_RULES for kw in kws])]:
            # 진짜 매칭 못 해서 thematic으로 떨어진 거
            if not any(kw.upper() in r["Name"].upper() for cat, kws in CATEGORY_RULES if cat == "thematic" for kw in kws):
                unmatched.append(r["Name"])
        rows.append({
            "ticker": r["Symbol"],
            "name": r["Name"],
            "category": primary,
            "tags": tags,
            "marCap": int(r["MarCap"]),
            "volume": int(r["Volume"]),
            "amount": int(r["Amount"]),
            "price": float(r["Price"]) if r["Price"] else 0,
            "nav": float(r["NAV"]) if r["NAV"] else 0,
        })
        category_counts[primary] = category_counts.get(primary, 0) + 1

    print(f"\n=== 카테고리 분포 ===")
    for cat in CATEGORY_ORDER:
        cnt = category_counts.get(cat, 0)
        if cnt > 0:
            print(f"  {CATEGORY_LABELS[cat]:15s} {cnt}개")

    if unmatched:
        print(f"\n=== 매칭 실패 → 테마로 폴백 ({len(unmatched)}개) ===")
        for n in unmatched[:30]:
            print(f"  - {n}")
        if len(unmatched) > 30:
            print(f"  ... 외 {len(unmatched) - 30}개")

    # TS 파일 작성
    ts: list[str] = [
        "/**",
        " * 한국 ETF 카탈로그 (자동 생성).",
        f" * FinanceDataReader 기반, 시가총액 + 거래대금 가중 상위 {TARGET_COUNT}개.",
        " */",
        "",
        "export type KrEtfCategory =",
    ]
    for i, cat in enumerate(CATEGORY_ORDER):
        sep = " |" if i > 0 else "  "
        ts.append(f"  {sep} \"{cat}\"")
    ts[-1] += ";"
    ts.append("")

    ts += [
        "export type KrEtfMeta = {",
        "  ticker: string;",
        "  name: string;",
        "  category: KrEtfCategory;",
        "  tags: KrEtfCategory[];",
        "  marCap: number;",
        "  volume: number;",
        "  amount: number;",
        "  price: number;",
        "  nav: number;",
        "};",
        "",
        "export const KR_CATEGORY_LABELS: Record<KrEtfCategory, string> = {",
    ]
    for cat in CATEGORY_ORDER:
        ts.append(f"  {cat}: \"{CATEGORY_LABELS[cat]}\",")
    ts += [
        "};",
        "",
        "export const KR_CATEGORY_ORDER: KrEtfCategory[] = [",
    ]
    for cat in CATEGORY_ORDER:
        ts.append(f"  \"{cat}\",")
    ts += [
        "];",
        "",
        "export const KR_ETF_CATALOG: KrEtfMeta[] = [",
    ]
    for r in rows:
        # 큰따옴표·백슬래시 이스케이프
        safe_name = r["name"].replace("\\", "\\\\").replace('"', '\\"')
        tags_str = ", ".join(f'"{t}"' for t in r["tags"])
        ts.append(
            f'  {{ ticker: "{r["ticker"]}", name: "{safe_name}", '
            f'category: "{r["category"]}", tags: [{tags_str}], '
            f'marCap: {r["marCap"]}, volume: {r["volume"]}, amount: {r["amount"]}, '
            f'price: {r["price"]}, nav: {r["nav"]} }},'
        )
    ts += [
        "];",
        "",
        "export const KR_ALL_TICKERS = KR_ETF_CATALOG.map((e) => e.ticker);",
        "",
        "export function krGroupByCategory(): Map<KrEtfCategory, KrEtfMeta[]> {",
        "  const map = new Map<KrEtfCategory, KrEtfMeta[]>();",
        "  for (const cat of KR_CATEGORY_ORDER) map.set(cat, []);",
        "  for (const etf of KR_ETF_CATALOG) {",
        "    const arr = map.get(etf.category) ?? [];",
        "    arr.push(etf);",
        "    map.set(etf.category, arr);",
        "  }",
        "  for (const cat of KR_CATEGORY_ORDER) {",
        "    const arr = map.get(cat)!;",
        "    arr.sort((a, b) => b.marCap - a.marCap);",
        "  }",
        "  return map;",
        "}",
        "",
        "export function krFindByTicker(ticker: string): KrEtfMeta | undefined {",
        "  return KR_ETF_CATALOG.find((e) => e.ticker === ticker);",
        "}",
        "",
    ]

    CATALOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CATALOG_PATH.write_text("\n".join(ts), encoding="utf-8")
    print(f"\n생성: {CATALOG_PATH}")
    print(f"종목 수: {len(rows)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())