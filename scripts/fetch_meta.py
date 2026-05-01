"""ETF 메타데이터 다운로더.

각 티커의 운용보수/AUM/상장일/배당률/구성종목 TOP10/소개를
data/meta/{TICKER}.json 으로 저장.

사용법:
  python scripts/fetch_meta.py                   # 전체
  python scripts/fetch_meta.py SPY QQQ           # 특정만
  python scripts/fetch_meta.py --skip-existing   # 이미 있는 건 건너뛰기
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import yfinance as yf

META_DIR = Path(__file__).resolve().parent.parent / "data" / "meta"
CATALOG_PATH = Path(__file__).resolve().parent.parent / "src" / "lib" / "finance" / "catalog.ts"


def load_catalog_tickers() -> list[str]:
    if not CATALOG_PATH.exists():
        return []
    text = CATALOG_PATH.read_text(encoding="utf-8")
    tickers = re.findall(r'ticker:\s*"([^"]+)"', text)
    seen = set()
    result = []
    for t in tickers:
        if t.startswith("^"):  # 지수는 메타 안 받음
            continue
        if t not in seen:
            seen.add(t)
            result.append(t)
    return result


def safe_filename(ticker: str) -> str:
    return ticker.replace("/", "_") + ".json"


def fetch_meta(ticker: str) -> dict | None:
    print(f"  [{ticker:6s}]", end=" ", flush=True)
    try:
        tk = yf.Ticker(ticker)
        info = tk.info or {}

        # 기본 정보
        meta = {
            "ticker": ticker,
            "longName": info.get("longName") or info.get("shortName"),
            "summary": info.get("longBusinessSummary"),
            "category": info.get("category"),
            "fundFamily": info.get("fundFamily"),
            "totalAssets": info.get("totalAssets"),  # AUM (USD)
            "expenseRatio": info.get("annualReportExpenseRatio") or info.get("netExpenseRatio"),
            "yield": info.get("yield"),  # 연 배당률 (소수)
            "fundInceptionDate": info.get("fundInceptionDate"),  # epoch
            "navPrice": info.get("navPrice"),
            "previousClose": info.get("previousClose"),
            "fiftyTwoWeekHigh": info.get("fiftyTwoWeekHigh"),
            "fiftyTwoWeekLow": info.get("fiftyTwoWeekLow"),
            "beta3Year": info.get("beta3Year"),
        }

        # 구성종목 TOP 10 + 섹터 비중
        try:
            fd = tk.funds_data
            holdings_df = fd.top_holdings
            if holdings_df is not None and not holdings_df.empty:
                # 인덱스 = 종목 심볼, 컬럼 보통 'Holding Percent' 또는 'holdingPercent'
                holdings = []
                for symbol, row in holdings_df.head(10).iterrows():
                    name_val = row.get("Name") if "Name" in row else row.get("holdingName")
                    pct = row.get("Holding Percent")
                    if pct is None:
                        pct = row.get("holdingPercent")
                    holdings.append({
                        "symbol": str(symbol),
                        "name": str(name_val) if name_val else None,
                        "weight": float(pct) if pct is not None else None,
                    })
                meta["topHoldings"] = holdings
            else:
                meta["topHoldings"] = []

            # 섹터 비중
            try:
                sectors = fd.sector_weightings
                if sectors:
                    meta["sectorWeightings"] = {k: float(v) for k, v in sectors.items()}
            except Exception:
                meta["sectorWeightings"] = {}
        except Exception as e:
            meta["topHoldings"] = []
            meta["sectorWeightings"] = {}
            meta["fundsDataError"] = str(e)

        meta["fetchedAt"] = datetime.now().isoformat()

        # 간단 요약 출력
        aum_b = (meta["totalAssets"] / 1e9) if meta["totalAssets"] else None
        exp = meta["expenseRatio"]
        yld = meta["yield"]
        n_hold = len(meta.get("topHoldings", []))
        bits = []
        if aum_b is not None:
            bits.append(f"AUM ${aum_b:.1f}B")
        if exp is not None:
            bits.append(f"보수 {exp*100:.2f}%")
        if yld is not None:
            bits.append(f"배당 {yld*100:.2f}%")
        bits.append(f"종목 {n_hold}")
        print(" · ".join(bits))

        return meta

    except Exception as e:
        print(f"ERROR: {e}")
        return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("tickers", nargs="*")
    parser.add_argument("--skip-existing", action="store_true")
    parser.add_argument("--sleep", type=float, default=0.3,
                        help="요청 간 대기 (초). yfinance rate limit 회피용")
    args = parser.parse_args()

    if args.tickers:
        tickers = args.tickers
    else:
        tickers = load_catalog_tickers()
        if not tickers:
            print("catalog.ts에서 티커를 찾을 수 없습니다.")
            return 1

    META_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n출력 디렉토리: {META_DIR}")
    print(f"대상: {len(tickers)}개\n")

    success = []
    failed = []
    skipped = []

    for ticker in tickers:
        out_path = META_DIR / safe_filename(ticker)

        if args.skip_existing and out_path.exists():
            print(f"  [{ticker:6s}] SKIP")
            skipped.append(ticker)
            continue

        meta = fetch_meta(ticker)
        if meta is None:
            failed.append(ticker)
            continue

        out_path.write_text(
            json.dumps(meta, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8"
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