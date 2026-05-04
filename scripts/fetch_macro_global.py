"""
글로벌 거시 데이터 수집 스크립트 (yfinance 버전).
미국 + 유럽 + 일본 + 중국 + 원자재 + 환율.

실행: python scripts/fetch_macro_global.py
출력: data/macro/global_YYYY_MM.json
"""

import json
import os
from datetime import datetime
import yfinance as yf

OUT_DIR = os.path.join("data", "macro")
os.makedirs(OUT_DIR, exist_ok=True)

# yfinance 티커 목록
INDICATORS = {
    # 미국 주식 시장
    "sp500": ("^GSPC", "S&P 500 지수"),
    "nasdaq": ("^IXIC", "나스닥 종합지수"),
    "dow": ("^DJI", "다우존스 지수"),
    "russell2000": ("^RUT", "러셀 2000 (미국 중소형주)"),
    "vix": ("^VIX", "VIX 변동성 지수"),

    # 미국 채권/금리
    "us_10y_yield": ("^TNX", "미국 10년물 국채금리"),
    "us_2y_yield": ("^IRX", "미국 13주물 국채금리"),
    "us_30y_yield": ("^TYX", "미국 30년물 국채금리"),

    # 달러 인덱스
    "dxy": ("DX-Y.NYB", "달러 인덱스 (DXY)"),

    # 유럽
    "eu_stoxx50": ("^STOXX50E", "유로스톡스 50"),
    "germany_dax": ("^GDAXI", "독일 DAX"),
    "uk_ftse": ("^FTSE", "영국 FTSE 100"),

    # 일본
    "japan_nikkei": ("^N225", "일본 닛케이 225"),

    # 중국 / 홍콩
    "china_csi300": ("000300.SS", "중국 CSI 300"),
    "hongkong_hsi": ("^HSI", "홍콩 항셍지수"),

    # 한국
    "korea_kospi": ("^KS11", "한국 코스피"),
    "korea_kosdaq": ("^KQ11", "한국 코스닥"),

    # 환율
    "usdkrw": ("KRW=X", "원/달러 환율"),
    "usdjpy": ("JPY=X", "엔/달러 환율"),
    "usdcny": ("CNY=X", "위안/달러 환율"),
    "eurusd": ("EURUSD=X", "유로/달러 환율"),

    # 원자재
    "gold": ("GC=F", "금 선물"),
    "silver": ("SI=F", "은 선물"),
    "wti_oil": ("CL=F", "WTI 원유 선물"),
    "brent_oil": ("BZ=F", "브렌트 원유 선물"),
    "copper": ("HG=F", "구리 선물"),
    "natural_gas": ("NG=F", "천연가스 선물"),

    # 가상자산
    "bitcoin": ("BTC-USD", "비트코인"),
    "ethereum": ("ETH-USD", "이더리움"),
}


def fetch_yf_latest(ticker: str) -> dict | None:
    """yfinance에서 최근 6개월치 데이터로 변동률 계산"""
    try:
        data = yf.Ticker(ticker)
        hist = data.history(period="1y", interval="1d")

        if hist.empty or len(hist) < 5:
            return None

        # 최신값
        latest_value = float(hist["Close"].iloc[-1])
        latest_date = hist.index[-1].strftime("%Y-%m-%d")

        # 1개월 전 (약 20영업일)
        m1_idx = max(0, len(hist) - 22)
        m1_value = float(hist["Close"].iloc[m1_idx])

        # 3개월 전 (약 63영업일)
        m3_idx = max(0, len(hist) - 65)
        m3_value = float(hist["Close"].iloc[m3_idx])

        # 6개월 전 (약 126영업일)
        m6_idx = max(0, len(hist) - 130)
        m6_value = float(hist["Close"].iloc[m6_idx])

        # 1년 전
        y1_value = float(hist["Close"].iloc[0])

        m1_change = ((latest_value - m1_value) / m1_value * 100) if m1_value else 0
        m3_change = ((latest_value - m3_value) / m3_value * 100) if m3_value else 0
        m6_change = ((latest_value - m6_value) / m6_value * 100) if m6_value else 0
        y1_change = ((latest_value - y1_value) / y1_value * 100) if y1_value else 0

        return {
            "latest_date": latest_date,
            "latest_value": round(latest_value, 4),
            "month_change_pct": round(m1_change, 2),
            "three_month_change_pct": round(m3_change, 2),
            "six_month_change_pct": round(m6_change, 2),
            "year_change_pct": round(y1_change, 2),
        }
    except Exception as e:
        print(f"  ERROR: {e}")
        return None


def main():
    print("Fetching global market data from Yahoo Finance...")
    print("=" * 60)

    results = {}
    for key, (ticker, label) in INDICATORS.items():
        print(f"  [{key}] {label} ({ticker})...", end=" ", flush=True)
        data = fetch_yf_latest(ticker)
        if data:
            results[key] = {
                "label": label,
                "ticker": ticker,
                **data,
            }
            print(f"OK ({data['latest_value']}, 1y: {data['year_change_pct']:+.1f}%)")
        else:
            print("FAILED")

    # 출력
    now = datetime.now()
    filename = f"global_{now.year}_{now.month:02d}.json"
    output_path = os.path.join(OUT_DIR, filename)

    output = {
        "fetched_at": now.isoformat(),
        "indicators": results,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("=" * 60)
    print(f"Saved {len(results)}/{len(INDICATORS)} indicators")
    print(f"Output: {output_path}")


if __name__ == "__main__":
    main()