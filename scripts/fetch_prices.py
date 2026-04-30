"""ETF 가격/배당 데이터 다운로더."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

import yfinance as yf
import pandas as pd

DEFAULT_TICKERS = [
    "SPY",
    "QQQ",
    "GLD",
    "SCHD",
    "VYM",
    "^IRX",
]

DEFAULT_START = "2005-01-01"
DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"


def fetch_one(ticker: str, start: str, end: str | None = None) -> pd.DataFrame:
    print(f"  [{ticker}] downloading...", end=" ", flush=True)

    tk = yf.Ticker(ticker)
    hist = tk.history(start=start, end=end, auto_adjust=False, actions=True)

    if hist.empty:
        print("EMPTY (skipped)")
        return pd.DataFrame()

    hist = hist.reset_index()
    hist["Date"] = hist["Date"].dt.strftime("%Y-%m-%d")

    if "Dividends" not in hist.columns:
        hist["Dividends"] = 0.0

    cols = ["Date", "Open", "High", "Low", "Close", "Adj Close", "Volume", "Dividends"]
    cols = [c for c in cols if c in hist.columns]
    hist = hist[cols]
    hist = hist.rename(columns={"Adj Close": "AdjClose"})

    print(f"OK ({len(hist)} rows, {hist['Date'].iloc[0]} ~ {hist['Date'].iloc[-1]})")
    return hist


def safe_filename(ticker: str) -> str:
    return ticker.replace("^", "_").replace("/", "_") + ".csv"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("tickers", nargs="*")
    parser.add_argument("--start", default=DEFAULT_START)
    parser.add_argument("--end", default=None)
    args = parser.parse_args()

    tickers = args.tickers if args.tickers else DEFAULT_TICKERS
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n출력 디렉토리: {DATA_DIR}")
    print(f"기간: {args.start} ~ {args.end or 'today'}")
    print(f"티커: {', '.join(tickers)}\n")

    meta: dict = {}
    meta_path = DATA_DIR / "_meta.json"
    if meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))

    success: list[str] = []
    failed: list[str] = []

    for ticker in tickers:
        try:
            df = fetch_one(ticker, args.start, args.end)
            if df.empty:
                failed.append(ticker)
                continue

            out_path = DATA_DIR / safe_filename(ticker)
            df.to_csv(out_path, index=False, encoding="utf-8")

            meta[ticker] = {
                "file": safe_filename(ticker),
                "rows": len(df),
                "start": df["Date"].iloc[0],
                "end": df["Date"].iloc[-1],
                "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }
            success.append(ticker)

        except Exception as e:
            print(f"FAILED: {e}")
            failed.append(ticker)

    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n완료: {len(success)}개 성공, {len(failed)}개 실패")
    if failed:
        print(f"  실패: {', '.join(failed)}")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())