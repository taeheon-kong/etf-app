"""한국 ETF 전체 리스트 + AUM(시가총액) 조회.

pykrx로 KRX 상장 ETF 다 받아서 시가총액 큰 순으로 정렬.
일단 리스트만 출력해서 어떤 종목 넣을지 결정용.

사용법:
  python scripts/fetch_kr_list.py
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
from pykrx import stock


def latest_business_day() -> str:
    """가장 최근 영업일을 yyyymmdd 형식으로."""
    d = datetime.now()
    # 주말/휴일이면 거꾸로 가면서 거래일 찾기 (간단히 7일까지)
    for _ in range(10):
        ds = d.strftime("%Y%m%d")
        try:
            tickers = stock.get_etf_ticker_list(ds)
            if tickers:
                return ds
        except Exception:
            pass
        d -= timedelta(days=1)
    return d.strftime("%Y%m%d")


def main() -> int:
    date = latest_business_day()
    print(f"기준일: {date}\n")

    tickers = stock.get_etf_ticker_list(date)
    print(f"전체 ETF: {len(tickers)}개")

    # 시가총액 (=AUM 근사) 받기
    rows = []
    print("AUM 조회 중...")
    for i, ticker in enumerate(tickers):
        try:
            name = stock.get_etf_ticker_name(ticker)
            cap_df = stock.get_market_cap(date, date, ticker)
            if cap_df is None or cap_df.empty:
                continue
            cap = int(cap_df["시가총액"].iloc[-1])
            rows.append({
                "ticker": ticker,
                "name": name,
                "aum_krw": cap,
            })
        except Exception as e:
            print(f"  {ticker} 실패: {e}")
        if (i + 1) % 50 == 0:
            print(f"  {i+1}/{len(tickers)} 진행중...")

    df = pd.DataFrame(rows).sort_values("aum_krw", ascending=False).reset_index(drop=True)

    # 결과 출력 (TOP 150)
    print(f"\n=== TOP 150 (AUM 기준) ===\n")
    out_path = Path(__file__).resolve().parent.parent / "data" / "kr_etf_list.csv"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path, index=False, encoding="utf-8-sig")

    # 상위 150개 콘솔 출력
    pd.set_option("display.max_rows", 150)
    pd.set_option("display.width", 200)
    print(df.head(150).to_string(index=False))

    print(f"\n전체 결과 저장: {out_path}")
    print(f"\n총 {len(df)}개 ETF, AUM 합계: {df['aum_krw'].sum()/1e12:.1f}조원")

    return 0


if __name__ == "__main__":
    sys.exit(main())