/**
 * 한국투자증권 Open API 주가 수집기
 * 
 * 사용법:
 *   1. 한국투자증권 OpenAPI 신청 (https://apiportal.koreainvestment.com)
 *   2. 앱키 발급 후 환경변수 설정
 *   3. fetchStockPrice('005930') 호출
 * 
 * 환경변수:
 *   - KIS_APP_KEY: 앱키
 *   - KIS_APP_SECRET: 앱 시크릿키
 *   - KIS_ACCOUNT_NO: 계좌번호 (XXXXXXXX-XX)
 *   - KIS_IS_MOCK: 모의투자 여부 ('true' / 'false')
 */

interface KISToken {
  access_token: string;
  expires_at: number;
}

let cachedToken: KISToken | null = null;

const getBaseUrl = () => {
  const isMock = process.env.KIS_IS_MOCK === 'true';
  return isMock
    ? 'https://openapivts.koreainvestment.com:29443'
    : 'https://openapi.koreainvestment.com:9443';
};

/**
 * OAuth 토큰 발급/갱신
 */
async function getAccessToken(): Promise<string> {
  // 캐시된 토큰이 유효하면 재사용
  if (cachedToken && cachedToken.expires_at > Date.now()) {
    return cachedToken.access_token;
  }

  const response = await fetch(`${getBaseUrl()}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey: process.env.KIS_APP_KEY,
      appsecret: process.env.KIS_APP_SECRET,
    }),
  });

  if (!response.ok) {
    throw new Error(`KIS 토큰 발급 실패: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = {
    access_token: data.access_token,
    // 토큰 만료 1시간 전에 갱신
    expires_at: Date.now() + (data.expires_in - 3600) * 1000,
  };

  return cachedToken.access_token;
}

/**
 * 공통 헤더 생성
 */
async function getHeaders(trId: string) {
  const token = await getAccessToken();
  return {
    'Content-Type': 'application/json; charset=utf-8',
    authorization: `Bearer ${token}`,
    appkey: process.env.KIS_APP_KEY!,
    appsecret: process.env.KIS_APP_SECRET!,
    tr_id: trId,
  };
}

// --- 현재가 조회 ---

export interface CurrentPrice {
  ticker: string;
  name: string;
  price: number;
  change_amount: number;
  change_rate: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  market_cap: number;
}

/**
 * 종목 현재가 조회
 * API: /uapi/domestic-stock/v1/quotations/inquire-price
 */
export async function fetchCurrentPrice(ticker: string): Promise<CurrentPrice> {
  const trId = 'FHKST01010100';
  const headers = await getHeaders(trId);

  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: 'J',  // 주식
    FID_INPUT_ISCD: ticker,
  });

  const response = await fetch(
    `${getBaseUrl()}/uapi/domestic-stock/v1/quotations/inquire-price?${params}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`현재가 조회 실패 [${ticker}]: ${response.status}`);
  }

  const data = await response.json();
  const output = data.output;

  return {
    ticker,
    name: output.hts_kor_isnm || '',
    price: Number(output.stck_prpr),
    change_amount: Number(output.prdy_vrss),
    change_rate: Number(output.prdy_ctrt),
    volume: Number(output.acml_vol),
    open: Number(output.stck_oprc),
    high: Number(output.stck_hgpr),
    low: Number(output.stck_lwpr),
    market_cap: Number(output.hts_avls) || 0,  // 시가총액 (억)
  };
}

// --- 일봉 조회 ---

export interface DailyCandle {
  date: string;  // 'YYYYMMDD'
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change_rate: number;
}

/**
 * 일봉 데이터 조회 (최대 100일)
 * API: /uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice
 */
export async function fetchDailyPrices(
  ticker: string,
  startDate: string,  // 'YYYYMMDD'
  endDate: string     // 'YYYYMMDD'
): Promise<DailyCandle[]> {
  const trId = 'FHKST03010100';
  const headers = await getHeaders(trId);

  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: 'J',
    FID_INPUT_ISCD: ticker,
    FID_INPUT_DATE_1: startDate,
    FID_INPUT_DATE_2: endDate,
    FID_PERIOD_DIV_CODE: 'D',  // 일봉
    FID_ORG_ADJ_PRC: '0',     // 수정주가 미적용
  });

  const response = await fetch(
    `${getBaseUrl()}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?${params}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`일봉 조회 실패 [${ticker}]: ${response.status}`);
  }

  const data = await response.json();
  const output2 = data.output2 || [];

  return output2.map((item: Record<string, string>) => ({
    date: item.stck_bsop_date,
    open: Number(item.stck_oprc),
    high: Number(item.stck_hgpr),
    low: Number(item.stck_lwpr),
    close: Number(item.stck_clpr),
    volume: Number(item.acml_vol),
    change_rate: Number(item.prdy_ctrt || 0),
  }));
}

/**
 * 여러 종목의 현재가를 동시에 조회
 */
export async function fetchMultipleCurrentPrices(
  tickers: string[]
): Promise<Map<string, CurrentPrice>> {
  const results = new Map<string, CurrentPrice>();

  for (const ticker of tickers) {
    try {
      const price = await fetchCurrentPrice(ticker);
      results.set(ticker, price);
      // KIS API Rate Limit 대응 (초당 20건)
      await new Promise(resolve => setTimeout(resolve, 60));
    } catch (error) {
      console.error(`[주가 조회 실패] ${ticker}:`, error);
    }
  }

  return results;
}

/**
 * 종목 코드로 KOSPI/KOSDAQ 구분
 * (실제로는 마스터 데이터에서 판별해야 하지만, 간이 판별)
 */
export function guessMarket(ticker: string): 'KOSPI' | 'KOSDAQ' {
  const num = parseInt(ticker);
  // KOSDAQ: 보통 6자리이며 1~3으로 시작하는 경우가 많음 (추정)
  // 정확한 판별은 KRX 마스터 참조 필요
  if (num >= 100000 && num < 400000) return 'KOSDAQ';
  return 'KOSPI';
}
