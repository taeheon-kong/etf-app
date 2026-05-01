"""ETF 가격/배당 데이터 다운로더.

기본 모드: catalog.ts에 정의된 90개 종목 + ^IRX 일괄 다운로드.
사용법:
  python scripts/fetch_prices.py                    # 전체
  python scripts/fetch_prices.py SPY QQQ            # 특정 티커만
  python scripts/fetch_prices.py --skip-existing    # 이미 받은 거 건너뛰기
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

import yfinance as yf
import pandas as pd

DEFAULT_START = "2005-01-01"
DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
CATALOG_PATH = Path(__file__).resolve().parent.parent / "src" / "lib" / "finance" / "catalog.ts"


def load_catalog_tickers() -> list[str]:
    """catalog.ts에서 ticker 값을 정규식으로 추출."""
    if not CATALOG_PATH.exists():
        return []
    text = CATALOG_PATH.read_text(encoding="utf-8")
    # { ticker: "XXX", ... } 패턴
    tickers = re.findall(r'ticker:\s*"([^"]+)"', text)
    # ^IRX는 무위험수익률용으로 항상 포함
    if "^IRX" not in tickers:
        tickers.append("^IRX")
    # 중복 제거
    seen = set()
    result = []
    for t in tickers:
        if t not in seen:
            seen.add(t)
            result.append(t)
    return result


def fetch_one(ticker: str, start: str, end: str | None = None) -> pd.DataFrame:
    print(f"  [{ticker:6s}] downloading...", end=" ", flush=True)
    try:
        tk = yf.Ticker(ticker)
        hist = tk.history(start=start, end=end, auto_adjust=False, actions=True)
    except Exception as e:
        print(f"ERROR: {e}")
        return pd.DataFrame()

    if hist.empty:
        print("EMPTY (no data)")
        return pd.DataFrame()

    hist = hist.reset_index()
    hist["Date"] = hist["Date"].dt.strftime("%Y-%m-%d")
    if "Dividends" not in hist.columns:
        hist["Dividends"] = 0.0

    cols = ["Date", "Open", "High", "Low", "Close", "Adj Close", "Volume", "Dividends"]
    cols = [c for c in cols if c in hist.columns]
    hist = hist[cols].rename(columns={"Adj Close": "AdjClose"})

    print(f"OK ({len(hist):>5} rows, {hist['Date'].iloc[0]} ~ {hist['Date'].iloc[-1]})")
    return hist


def safe_filename(ticker: str) -> str:
    return ticker.replace("^", "_").replace("/", "_") + ".csv"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("tickers", nargs="*")
    parser.add_argument("--start", default=DEFAULT_START)
    parser.add_argument("--end", default=None)
    parser.add_argument("--skip-existing", action="store_true",
                        help="이미 CSV 있는 티커는 건너뛰기")
    args = parser.parse_args()

    if args.tickers:
        tickers = args.tickers
    else:
        tickers = load_catalog_tickers()
        if not tickers:
            print("catalog.ts에서 티커를 찾을 수 없습니다. 인자로 직접 지정하세요.")
            return 1

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n출력 디렉토리: {DATA_DIR}")
    print(f"기간: {args.start} ~ {args.end or 'today'}")
    print(f"대상: {len(tickers)}개 티커\n")

    meta: dict = {}
    meta_path = DATA_DIR / "_meta.json"
    if meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))

    success: list[str] = []
    failed: list[str] = []
    skipped: list[str] = []

    for ticker in tickers:
        out_path = DATA_DIR / safe_filename(ticker)

        if args.skip_existing and out_path.exists():
            print(f"  [{ticker:6s}] SKIP (already exists)")
            skipped.append(ticker)
            continue

        df = fetch_one(ticker, args.start, args.end)
        if df.empty:
            failed.append(ticker)
            continue

        df.to_csv(out_path, index=False, encoding="utf-8")
        meta[ticker] = {
            "file": safe_filename(ticker),
            "rows": len(df),
            "start": df["Date"].iloc[0],
            "end": df["Date"].iloc[-1],
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        success.append(ticker)

    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n=== 완료 ===")
    print(f"성공: {len(success)}, 실패: {len(failed)}, 건너뜀: {len(skipped)}")
    if failed:
        print(f"  실패 티커: {', '.join(failed)}")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())