import { c } from '@/lib/tokens';

/**
 * 이 화면의 약속
 *
 * 서비스의 성격을 명시하는 고정 문구. 투자 권유가 아니라는 점을
 * 각주가 아니라 본문 위계로 보여주는 것이 이 디자인의 의도다.
 */
export default function PromiseCard() {
  return (
    <div style={{ border: `1px solid ${c.borderAlt}`, background: c.surfaceAlt, padding: '16px 20px' }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.09em',
          color: c.inkSoft,
          marginBottom: 7,
        }}
      >
        이 화면의 약속
      </div>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: c.inkStrong }}>
        예측하지 않고, 추천하지 않습니다. 같은 날 무슨 일이 있었는지를 시간 순서대로 보여줄 뿐입니다.
        판단은 당신이 합니다.
      </p>
    </div>
  );
}
