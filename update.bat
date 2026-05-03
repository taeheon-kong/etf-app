@echo off
cd /d C:\Users\user\Projects\etf-app
echo ========================================
echo ETF 데이터 갱신 시작
echo ========================================

echo.
echo [1/5] 미국 ETF 메타데이터...
python scripts\fetch_meta.py

echo.
echo [2/5] 한국 ETF 메타데이터...
python scripts\fetch_kr_meta.py

echo.
echo [3/5] 미국 ETF 가격...
python scripts\fetch_prices.py

echo.
echo [4/5] 한국 ETF 가격...
python scripts\fetch_kr_prices.py

echo.
echo [5/5] 거시경제 (CPI/환율/금리)...
python scripts\fetch_macro.py

echo.
echo ========================================
echo 모든 갱신 완료!
echo ========================================
pause