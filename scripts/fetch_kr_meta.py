"""한국 ETF 메타데이터 다운로더 (네이버 모바일 API).

각 티커의 운용사/시가총액/운용보수/배당률/NAV/괴리율/수익률/소개를
data/meta_kr/{TICKER}.json 으로 저장.

사용법:
  python scripts/fetch_kr_meta.py                  # catalogKr.ts 전체
  python scripts/fetch_kr_meta.py 069500 360750    # 특정만
  python scripts/fetch_kr_meta.py --skip-existing  # 이미 받은 거 건너뜀
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import requests


META_DIR = Path(__file__).resolve().parent.parent / "data" / "meta_kr"
CATALOG_PATH = Path(__file__).resolve().parent.parent / "src" / "lib" / "finance" / "catalogKr.ts"

API_URL = "https://m.stock.naver.com/api/stock/{ticker}/integration"
HEADERS = {"User-Agent": "Mozilla/5.0"}


def load_catalog_tickers() -> list[str]:
    if not CATALOG_PATH.exists():
        return []
    text = CATALOG_PATH.read_text(encoding="utf-8")
    tickers = re.findall(r'ticker:\s*"([^"]+)"', text)
    seen = set()
    result = []
    for t in tickers:
        if t not in seen:
            seen.add(t)
            result.append(t)
    return result


def fetch_one(ticker: str) -> dict | None:
    print(f"  [{ticker}]", end=" ", flush=True)
    try:
        url = API_URL.format(ticker=ticker)
        r = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code != 200:
            print(f"HTTP {r.status_code}")
            return None
        d = r.json()
    except Exception as e:
        print(f"ERROR: {e}")
        return None

    if d.get("stockEndType") != "etf":
        print("(ETF 아님)")
        # ETF 아니어도 저장은 함 (가끔 분류 오류)

    indicator = d.get("etfKeyIndicator", {}) or {}

    meta = {
        "ticker": ticker,
        "stockName": d.get("stockName"),
        "stockEndType": d.get("stockEndType"),
        "description": d.get("description"),

        # etfKeyIndicator
        "issuerName": indicator.get("issuerName"),
        "marketValue": indicator.get("marketValue"),  # "21조 9,042억" 한국식 표기 그대로
        "totalNav": indicator.get("totalNav"),
        "nav": indicator.get("nav"),
        "totalFee": indicator.get("totalFee"),  # 운용보수 %
        "dividendYieldTtm": indicator.get("dividendYieldTtm"),  # 배당률 %
        "deviationSign": indicator.get("deviationSign"),
        "deviationRate": indicator.get("deviationRate"),
        "returnRate1m": indicator.get("returnRate1m"),
        "returnRate3m": indicator.get("returnRate3m"),
        "returnRate1y": indicator.get("returnRate1y"),

        # totalInfos에서 일부 값 추출 (전일가, 거래량, 52주 등)
        "totalInfos": d.get("totalInfos"),

        # 동종 ETF 비교 (보너스)
        "industryCompareInfo": d.get("industryCompareInfo"),

        "fetchedAt": datetime.now().isoformat(),
    }

    # 요약 출력
    fee = indicator.get("totalFee")
    yld = indicator.get("dividendYieldTtm")
    mv = indicator.get("marketValue")
    issuer = indicator.get("issuerName") or "-"
    bits = [issuer]
    if mv:
        bits.append(f"AUM {mv}")
    if fee is not None:
        bits.append(f"보수 {fee}%")
    if yld is not None:
        bits.append(f"배당 {yld}%")
    print(" · ".join(bits))

    return meta


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("tickers", nargs="*")
    parser.add_argument("--skip-existing", action="store_true")
    parser.add_argument("--sleep", type=float, default=0.3)
    args = parser.parse_args()

    if args.tickers:
        tickers = args.tickers
    else:
        tickers = load_catalog_tickers()
        if not tickers:
            print("catalogKr.ts에서 티커를 찾을 수 없습니다.")
            return 1

    META_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n출력 디렉토리: {META_DIR}")
    print(f"대상: {len(tickers)}개\n")

    success: list[str] = []
    failed: list[str] = []
    skipped: list[str] = []

    for ticker in tickers:
        out_path = META_DIR / f"{ticker}.json"

        if args.skip_existing and out_path.exists():
            # 빈 깡통(26바이트)이면 다시 받자
            if out_path.stat().st_size > 100:
                print(f"  [{ticker}] SKIP")
                skipped.append(ticker)
                continue

        meta = fetch_one(ticker)
        if meta is None:
            failed.append(ticker)
            continue

        out_path.write_text(
            json.dumps(meta, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8",
        )
        success.append(ticker)
        time.sleep(args.sleep)

    print(f"\n=== 완료 ===")
    print(f"성공: {len(success)}, 실패: {len(failed)}, 건너뜀: {len(skipped)}")
    if failed:
        print(f"  실패 티커: {', '.join(failed)}")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())