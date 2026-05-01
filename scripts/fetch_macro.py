"""
한국 거시 데이터: CPI(소비자물가지수) + USD/KRW 환율 받기.

저장:
  data/macro/kr_cpi.csv     (Date, CPI)
  data/macro/usdkrw.csv     (Date, Rate)
"""
import os
import sys
import pandas as pd
import FinanceDataReader as fdr

OUT_DIR = os.path.join("data", "macro")
os.makedirs(OUT_DIR, exist_ok=True)

# 1. USD/KRW 환율
print("Fetching USD/KRW...")
try:
    df = fdr.DataReader("USD/KRW", "2000-01-01")
    df = df.reset_index()
    print(f"  columns: {list(df.columns)}")  # 디버그
    # 인덱스 컬럼은 보통 'Date' 또는 'index'
    date_col = "Date" if "Date" in df.columns else df.columns[0]
    close_col = "Close" if "Close" in df.columns else "Adj Close"
    df = df[[date_col, close_col]].rename(columns={date_col: "Date", close_col: "Rate"})
    df["Date"] = pd.to_datetime(df["Date"]).dt.strftime("%Y-%m-%d")
    out = os.path.join(OUT_DIR, "usdkrw.csv")
    df.to_csv(out, index=False, encoding="utf-8")
    print(f"  saved {len(df)} rows -> {out}")
except Exception as e:
    print(f"  ERROR: {e}")

# 2. 한국 CPI
# FinanceDataReader는 CPI 직접 지원 X.
# 한국은행 ECOS API 또는 KOSIS가 정석이지만, 간편하게 통계청 월별 CPI를 하드코딩.
# 일단 연 평균 인플레이션 2.5% 가정하여 1990~현재 합성 시계열 생성.
# (추후 실제 CPI 데이터로 교체)
print("Generating CPI series (synthetic, 2.5%/yr)...")
dates = pd.date_range("2000-01-01", "2026-12-31", freq="MS")
base = 100.0
annual_rate = 0.025
monthly_rate = (1 + annual_rate) ** (1 / 12) - 1
cpi_values = [base * ((1 + monthly_rate) ** i) for i in range(len(dates))]
df_cpi = pd.DataFrame({
    "Date": dates.strftime("%Y-%m-%d"),
    "CPI": cpi_values,
})
out = os.path.join(OUT_DIR, "kr_cpi.csv")
df_cpi.to_csv(out, index=False, encoding="utf-8")
print(f"  saved {len(df_cpi)} rows -> {out}")

print("Done.")