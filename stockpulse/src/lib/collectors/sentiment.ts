/**
 * 뉴스 감성 분석 모듈
 * 
 * OpenAI API를 사용하여 뉴스 제목/요약의 감성을 분석합니다.
 * 
 * 환경변수:
 *   - OPENAI_API_KEY: OpenAI API 키
 */

import { SentimentLabel } from '@/types';

interface SentimentResult {
  score: number;         // -1.0 ~ +1.0
  label: SentimentLabel; // positive / negative / neutral
  reason: string;        // 판단 근거 (한 줄)
}

/**
 * 단일 뉴스의 감성 분석
 */
export async function analyzeSentiment(
  newsTitle: string,
  stockName: string,
  summary?: string
): Promise<SentimentResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // API 키 없으면 기본 키워드 기반 분석 사용
    return keywordBasedSentiment(newsTitle);
  }

  const prompt = `다음 뉴스가 "${stockName}" 주가에 미치는 영향을 분석해주세요.

뉴스 제목: ${newsTitle}
${summary ? `요약: ${summary}` : ''}

JSON 형식으로만 답변:
{
  "score": (number, -1.0~+1.0, 양수=긍정/상승요인, 음수=부정/하락요인, 0=중립),
  "label": ("positive" | "negative" | "neutral"),
  "reason": "(한 줄로 판단 근거)"
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 한국 주식 시장 전문 감성 분석기입니다. 뉴스가 특정 종목에 미치는 영향만 판단합니다.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error(`OpenAI API 에러: ${response.status}`);
      return keywordBasedSentiment(newsTitle);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    return {
      score: Math.max(-1, Math.min(1, result.score)),
      label: result.label as SentimentLabel,
      reason: result.reason || '',
    };
  } catch (error) {
    console.error('[감성분석 실패]:', error);
    return keywordBasedSentiment(newsTitle);
  }
}

/**
 * 배치 감성 분석 (비용 절약용)
 * 여러 뉴스를 한 번의 API 호출로 처리
 */
export async function analyzeSentimentBatch(
  items: { title: string; stockName: string; summary?: string }[]
): Promise<SentimentResult[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || items.length === 0) {
    return items.map(item => keywordBasedSentiment(item.title));
  }

  // 최대 10개씩 묶어서 분석 (토큰 제한 대응)
  const batchSize = 10;
  const results: SentimentResult[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await analyzeBatchChunk(batch);
    results.push(...batchResults);
    // Rate limit 대응
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}

async function analyzeBatchChunk(
  items: { title: string; stockName: string; summary?: string }[]
): Promise<SentimentResult[]> {
  const apiKey = process.env.OPENAI_API_KEY;

  const newsList = items.map((item, idx) => 
    `${idx + 1}. [${item.stockName}] "${item.title}"`
  ).join('\n');

  const prompt = `다음 뉴스 목록 각각에 대해 해당 종목 주가 영향을 분석해주세요.

${newsList}

JSON 배열로만 답변 (순서 유지):
[
  {"score": number(-1~1), "label": "positive"|"negative"|"neutral", "reason": "한줄근거"},
  ...
]`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '한국 주식 시장 감성 분석기. 각 뉴스가 해당 종목에 미치는 영향만 판단.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      return items.map(item => keywordBasedSentiment(item.title));
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    const results = parsed.results || parsed;

    if (Array.isArray(results)) {
      return results.map((r: SentimentResult) => ({
        score: Math.max(-1, Math.min(1, r.score || 0)),
        label: (r.label || 'neutral') as SentimentLabel,
        reason: r.reason || '',
      }));
    }

    return items.map(item => keywordBasedSentiment(item.title));
  } catch (error) {
    console.error('[배치 감성분석 실패]:', error);
    return items.map(item => keywordBasedSentiment(item.title));
  }
}

/**
 * 키워드 기반 간이 감성 분석 (API 없이도 동작)
 * OpenAI API 키가 없거나 호출 실패 시 폴백
 */
function keywordBasedSentiment(title: string): SentimentResult {
  const positiveKeywords = [
    '상승', '급등', '신고가', '호실적', '순매수', '상향', '성장',
    '수혜', '흑자', '돌파', '최대', '호조', '회복', '개선',
    '수주', '계약', '인수', '승인', '허가', '랠리', '강세',
  ];

  const negativeKeywords = [
    '하락', '급락', '폭락', '적자', '순매도', '하향', '감소',
    '우려', '리스크', '악화', '부진', '손실', '위기', '규제',
    '조사', '기소', '하한가', '유증', '감자', '약세', '매도',
  ];

  const lowerTitle = title.toLowerCase();
  let score = 0;
  let hitKeyword = '';

  for (const kw of positiveKeywords) {
    if (lowerTitle.includes(kw)) {
      score += 0.3;
      hitKeyword = kw;
    }
  }

  for (const kw of negativeKeywords) {
    if (lowerTitle.includes(kw)) {
      score -= 0.3;
      hitKeyword = kw;
    }
  }

  score = Math.max(-1, Math.min(1, score));

  let label: SentimentLabel = 'neutral';
  if (score > 0.15) label = 'positive';
  else if (score < -0.15) label = 'negative';

  return {
    score,
    label,
    reason: hitKeyword ? `키워드 "${hitKeyword}" 감지 (간이분석)` : '중립 판정 (키워드 미감지)',
  };
}

/**
 * AI 일일 요약 생성
 */
export async function generateDailySummary(
  stockName: string,
  changeRate: number,
  newsItems: { title: string; sentiment_label: string }[]
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // 폴백: 단순 요약
    const direction = changeRate > 0 ? '상승' : changeRate < 0 ? '하락' : '보합';
    return `${stockName} ${Math.abs(changeRate).toFixed(2)}% ${direction}. 관련 뉴스 ${newsItems.length}건.`;
  }

  const newsText = newsItems.slice(0, 5).map(n => `- ${n.title} (${n.sentiment_label})`).join('\n');

  const prompt = `${stockName}이 오늘 ${changeRate > 0 ? '+' : ''}${changeRate.toFixed(2)}% 움직였습니다.

관련 뉴스:
${newsText}

이 종목이 오늘 왜 이렇게 움직였는지 투자자가 한눈에 이해할 수 있도록 2~3문장으로 요약해주세요.
- "~했기 때문으로 보입니다" 같은 추정 표현 사용
- 핵심 요인 1~2개만 언급
- 숫자/고유명사 포함`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: '한국 주식 시장 분석가. 간결하고 정확한 한국어 요약을 합니다.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      return `${stockName} ${changeRate > 0 ? '+' : ''}${changeRate.toFixed(2)}% 변동.`;
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch {
    return `${stockName} ${changeRate > 0 ? '+' : ''}${changeRate.toFixed(2)}% 변동.`;
  }
}
