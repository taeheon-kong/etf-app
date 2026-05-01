import os
import re
import argparse
import FinanceDataReader as fdr

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-existing", action="store_true", help="Skip already downloaded files")
    args = parser.parse_args()

    # 경로 설정
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    catalog_path = os.path.join(base_dir, "src", "lib", "finance", "catalogKr.ts")
    out_dir = os.path.join(base_dir, "data", "raw_kr")

    if not os.path.exists(catalog_path):
        print(f"오류: {catalog_path} 파일을 찾을 수 없습니다.")
        return

    # catalogKr.ts 파일 읽어서 티커 추출
    with open(catalog_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 정규식으로 ticker: "069500" 형태의 숫자 6자리 추출
    tickers = re.findall(r"ticker:\s*['\"](\d{6})['\"]", content)
    tickers = list(dict.fromkeys(tickers)) # 중복 제거

    print(f"총 {len(tickers)}개의 한국 ETF 티커를 찾았습니다.")

    for ticker in tickers:
        csv_path = os.path.join(out_dir, f"{ticker}.csv")

        if args.skip_existing and os.path.exists(csv_path):
            print(f"[{ticker}] 파일이 이미 존재하여 건너뜁니다.")
            continue

        print(f"[{ticker}] 데이터 다운로드 중...")
        try:
            # 2000년 1월 1일 이후 전체 데이터 다운로드
            df = fdr.DataReader(ticker, "2000-01-01")

            if df.empty:
                print(f"[{ticker}] 데이터가 없습니다.")
                continue

            # 미국 데이터 CSV 형식(Date, Open, High, Low, Close, AdjClose, Volume, Dividends)에 맞추기
            df["AdjClose"] = df["Close"]  # 한국은 Close 자체가 수정주가 성격을 띠는 경우가 많아 그대로 복사
            df["Dividends"] = 0.0         # fdr에서 배당이 안 나오므로 Next.js 에러 방지용 0 채우기
            df.index.name = "Date"

            # 필요한 컬럼만 추출 (순서 유지)
            df = df[["Open", "High", "Low", "Close", "AdjClose", "Volume", "Dividends"]]
            
            # 저장
            df.to_csv(csv_path)
            print(f"[{ticker}] 저장 완료 ({len(df)}일치)")

        except Exception as e:
            print(f"[{ticker}] 다운로드 실패: {e}")

if __name__ == "__main__":
    main()