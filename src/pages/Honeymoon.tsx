import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Honeymoon.css'

type Plan = 'a' | 'b'

export default function Honeymoon() {
  const [plan, setPlan] = useState<Plan>('a')
  const navigate = useNavigate()

  return (
    <div className="honeymoon">
      <button className="back-btn" onClick={() => navigate('/')}>
        ← 홈으로
      </button>

      {/* ══ HERO ══ */}
      <div className="hero">
        <div className="hero-inner">
          <div className="hero-kicker">2026 신혼여행 완전 가이드</div>
          <h1>파리 · 니스 · 바르셀로나<br />10일의 허니문</h1>
          <div className="hero-meta">
            <span><strong>10월 5일(월)</strong> 파리 IN</span>
            <div className="dot"></div>
            <span><strong>10월 14일(수)</strong> 바르셀로나 OUT</span>
            <div className="dot"></div>
            <span><strong>아시아나항공</strong> 직항</span>
            <div className="dot"></div>
            <span>9박 10일</span>
          </div>
          <div className="city-chips">
            <div className="city-chip chip-paris">🗼 파리 3박</div>
            <div className="city-chip chip-nice">🌊 니스 3박</div>
            <div className="city-chip chip-bcn">🎨 바르셀로나 3박</div>
          </div>
        </div>
      </div>

      {/* ══ PLAN SELECTOR ══ */}
      <div className="plan-selector-wrap">
        <div className="plan-selector">
          <button className={`plan-tab ${plan === 'a' ? 'active' : ''}`} onClick={() => setPlan('a')}>
            <span className="plan-badge badge-a">A안</span>
            내 추천 — 깊이 + 가성비
          </button>
          <button className={`plan-tab ${plan === 'b' ? 'active' : ''}`} onClick={() => setPlan('b')}>
            <span className="plan-badge badge-b">B안</span>
            한국 관광객 일반 — 많이 보기
          </button>
        </div>
      </div>

      {/* ══ CALENDAR OVERVIEW ══ */}
      <div className="section">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-eyebrow">10일 전체 일정</div>
            <div className="sec-title">한눈에 보는 캘린더</div>
          </div>

          <div className="legend">
            <div className="leg-item"><div className="leg-dot" style={{ background: 'var(--paris)' }}></div> 파리</div>
            <div className="leg-item"><div className="leg-dot" style={{ background: 'var(--nice)' }}></div> 니스 + 코트다쥐르</div>
            <div className="leg-item"><div className="leg-dot" style={{ background: 'var(--bcn)' }}></div> 바르셀로나</div>
            <div className="leg-item"><div className="leg-dot" style={{ background: '#2E6B2E' }}></div> 도착/출발</div>
            <div className="leg-item"><div className="leg-dot" style={{ background: '#8B5A10' }}></div> 특별일</div>
          </div>

          {/* A안 캘린더 */}
          <div className={`plan-content ${plan === 'a' ? 'active' : ''}`}>
            <div className="cal-wrap">
              <div className="cal-grid">
                <div className="cal-card city-paris">
                  <div className="cal-card-head"><div className="cal-dnum">5</div><div className="cal-ddate">10월 · 월요일</div><div className="cal-city-label">파리</div></div>
                  <div className="cal-card-body">
                    <div className="cal-special tag-arrive">✈ 인천 출발</div>
                    <div className="cal-item"><span className="cal-icon">🛬</span><span>20:00 CDG 도착</span></div>
                    <div className="cal-item"><span className="cal-icon">🏠</span><span>체크인 · 마레지구</span></div>
                    <div className="cal-item"><span className="cal-icon">🍽</span><span>근처 비스트로 저녁</span></div>
                  </div>
                </div>
                <div className="cal-card city-paris">
                  <div className="cal-card-head"><div className="cal-dnum">6</div><div className="cal-ddate">10월 · 화요일</div><div className="cal-city-label">파리</div></div>
                  <div className="cal-card-body">
                    <div className="cal-special tag-special">🚌 마이리얼트립 투어</div>
                    <div className="cal-item"><span className="cal-icon">🚌</span><span>한국어 버스투어 (반일)</span></div>
                    <div className="cal-item"><span className="cal-icon">🎨</span><span>오르세 미술관</span></div>
                    <div className="cal-item"><span className="cal-icon">✨</span><span>에펠탑 야경</span></div>
                  </div>
                </div>
                <div className="cal-card city-paris">
                  <div className="cal-card-head"><div className="cal-dnum">7</div><div className="cal-ddate">10월 · 수요일</div><div className="cal-city-label">파리</div></div>
                  <div className="cal-card-body">
                    <div className="cal-item"><span className="cal-icon">🌳</span><span>뤽상부르 공원</span></div>
                    <div className="cal-item"><span className="cal-icon">🧆</span><span>마레지구 팔라펠</span></div>
                    <div className="cal-item"><span className="cal-icon">🏛</span><span>로댕미술관 정원</span></div>
                  </div>
                </div>
                <div className="cal-card city-paris">
                  <div className="cal-card-head"><div className="cal-dnum">8</div><div className="cal-ddate">10월 · 목요일</div><div className="cal-city-label">파리→니스</div></div>
                  <div className="cal-card-body">
                    <div className="cal-item"><span className="cal-icon">⛪</span><span>몽마르트르</span></div>
                    <div className="cal-item"><span className="cal-icon">🚄</span><span>13:30 TGV 출발</span></div>
                    <div className="cal-item"><span className="cal-icon">🌊</span><span>19:00 니스 도착</span></div>
                  </div>
                </div>
                <div className="cal-card city-nice">
                  <div className="cal-card-head"><div className="cal-dnum">9</div><div className="cal-ddate">10월 · 금요일</div><div className="cal-city-label">니스</div></div>
                  <div className="cal-card-body">
                    <div className="cal-special tag-special">🇲🇨 모나코 + 에즈</div>
                    <div className="cal-item"><span className="cal-icon">🏛</span><span>에즈 절벽마을</span></div>
                    <div className="cal-item"><span className="cal-icon">👑</span><span>왕궁 교대식 11:55</span></div>
                    <div className="cal-item"><span className="cal-icon">🐠</span><span>해양박물관</span></div>
                  </div>
                </div>
                <div className="cal-card city-nice">
                  <div className="cal-card-head"><div className="cal-dnum">10</div><div className="cal-ddate">10월 · 토요일</div><div className="cal-city-label">니스</div></div>
                  <div className="cal-card-body">
                    <div className="cal-special tag-relax">🌴 순수 휴양일</div>
                    <div className="cal-item"><span className="cal-icon">🛏</span><span>늦잠 · 브런치</span></div>
                    <div className="cal-item"><span className="cal-icon">🏖</span><span>프롬나드 해변</span></div>
                    <div className="cal-item"><span className="cal-icon">🍽</span><span>미슐랭 디너 Jan</span></div>
                  </div>
                </div>
                <div className="cal-card city-nice">
                  <div className="cal-card-head"><div className="cal-dnum">11</div><div className="cal-ddate">10월 · 일요일</div><div className="cal-city-label">니스→BCN</div></div>
                  <div className="cal-card-body">
                    <div className="cal-item"><span className="cal-icon">🛍</span><span>벼룩시장 (쿠르 살레야)</span></div>
                    <div className="cal-item"><span className="cal-icon">✈</span><span>저가항공 바르셀로나</span></div>
                    <div className="cal-item"><span className="cal-icon">🍺</span><span>고딕지구 타파스</span></div>
                  </div>
                </div>
                <div className="cal-card city-bcn">
                  <div className="cal-card-head"><div className="cal-dnum">12</div><div className="cal-ddate">10월 · 월요일</div><div className="cal-city-label">바르셀로나</div></div>
                  <div className="cal-card-body">
                    <div className="cal-special tag-holiday">🇪🇸 스페인 국경절</div>
                    <div className="cal-item"><span className="cal-icon">🏗</span><span>카사 바트요</span></div>
                    <div className="cal-item"><span className="cal-icon">🏗</span><span>카사 밀라</span></div>
                    <div className="cal-item"><span className="cal-icon">🏖</span><span>바르셀로네타 해변</span></div>
                  </div>
                </div>
                <div className="cal-card city-bcn">
                  <div className="cal-card-head"><div className="cal-dnum">13</div><div className="cal-ddate">10월 · 화요일</div><div className="cal-city-label">바르셀로나</div></div>
                  <div className="cal-card-body">
                    <div className="cal-item"><span className="cal-icon">⛪</span><span>사그라다 파밀리아</span></div>
                    <div className="cal-item"><span className="cal-icon">🌿</span><span>파크 구엘</span></div>
                    <div className="cal-item"><span className="cal-icon">🍸</span><span>Paradiso 칵테일 바</span></div>
                  </div>
                </div>
                <div className="cal-card city-bcn">
                  <div className="cal-card-head"><div className="cal-dnum">14</div><div className="cal-ddate">10월 · 수요일</div><div className="cal-city-label">바르셀로나</div></div>
                  <div className="cal-card-body">
                    <div className="cal-special tag-depart">✈ 20:00 귀국 출발</div>
                    <div className="cal-item"><span className="cal-icon">🥩</span><span>보케리아 시장</span></div>
                    <div className="cal-item"><span className="cal-icon">🏰</span><span>고딕지구 산책</span></div>
                    <div className="cal-item"><span className="cal-icon">🛍</span><span>쇼핑 · 귀국</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* B안 캘린더 */}
          <div className={`plan-content ${plan === 'b' ? 'active' : ''}`}>
            <div className="cal-wrap">
              <div className="cal-grid">
                <div className="cal-card city-paris">
                  <div className="cal-card-head"><div className="cal-dnum">5</div><div className="cal-ddate">10월 · 월요일</div><div className="cal-city-label">파리</div></div>
                  <div className="cal-card-body">
                    <div className="cal-special tag-arrive">✈ 인천 출발</div>
                    <div className="cal-item"><span className="cal-icon">🛬</span><span>20:00 CDG 도착</span></div>
                    <div className="cal-item"><span className="cal-icon">🏠</span><span>체크인</span></div>
                    <div className="cal-item"><span className="cal-icon">🌃</span><span>마레지구 야경 산책</span></div>
                  </div>
                </div>
                <div className="cal-card city-paris">
                  <div className="cal-card-head"><div className="cal-dnum">6</div><div className="cal-ddate">10월 · 화요일</div><div className="cal-city-label">파리</div></div>
                  <div className="cal-card-body">
                    <div className="cal-item"><span className="cal-icon">🏛</span><span>루브르 박물관</span></div>
                    <div className="cal-item"><span className="cal-icon">🌳</span><span>튈르리 공원 산책</span></div>
                    <div className="cal-item"><span className="cal-icon">✨</span><span>에펠탑 야경</span></div>
                  </div>
                </div>
                <div className="cal-card city-paris">
                  <div className="cal-card-head"><div className="cal-dnum">7</div><div className="cal-ddate">10월 · 수요일</div><div className="cal-city-label">파리</div></div>
                  <div className="cal-card-body">
                    <div className="cal-item"><span className="cal-icon">🎨</span><span>오르세 미술관</span></div>
                    <div className="cal-item"><span className="cal-icon">⛪</span><span>몽마르트르</span></div>
                    <div className="cal-item"><span className="cal-icon">🕍</span><span>노트르담 대성당</span></div>
                  </div>
                </div>
                <div className="cal-card city-paris">
                  <div className="cal-card-head"><div className="cal-dnum">8</div><div className="cal-ddate">10월 · 목요일</div><div className="cal-city-label">파리→니스</div></div>
                  <div className="cal-card-body">
                    <div className="cal-item"><span className="cal-icon">💎</span><span>생트샤펠 스테인드글라스</span></div>
                    <div className="cal-item"><span className="cal-icon">🧆</span><span>마레지구 팔라펠</span></div>
                    <div className="cal-item"><span className="cal-icon">🚄</span><span>TGV → 니스</span></div>
                  </div>
                </div>
                <div className="cal-card city-nice">
                  <div className="cal-card-head"><div className="cal-dnum">9</div><div className="cal-ddate">10월 · 금요일</div><div className="cal-city-label">니스</div></div>
                  <div className="cal-card-body">
                    <div className="cal-special tag-special">🇲🇨 모나코 + 에즈</div>
                    <div className="cal-item"><span className="cal-icon">🏛</span><span>에즈 절벽마을</span></div>
                    <div className="cal-item"><span className="cal-icon">👑</span><span>모나코 왕궁</span></div>
                    <div className="cal-item"><span className="cal-icon">🐠</span><span>해양박물관</span></div>
                  </div>
                </div>
                <div className="cal-card city-nice">
                  <div className="cal-card-head"><div className="cal-dnum">10</div><div className="cal-ddate">10월 · 토요일</div><div className="cal-city-label">니스</div></div>
                  <div className="cal-card-body">
                    <div className="cal-special tag-special">🇫🇷 앙티브 + 칸</div>
                    <div className="cal-item"><span className="cal-icon">🎨</span><span>피카소 미술관 (앙티브)</span></div>
                    <div className="cal-item"><span className="cal-icon">🎬</span><span>칸느 크루아제트</span></div>
                    <div className="cal-item"><span className="cal-icon">🌊</span><span>프랑스 리비에라 뷰</span></div>
                  </div>
                </div>
                <div className="cal-card city-nice">
                  <div className="cal-card-head"><div className="cal-dnum">11</div><div className="cal-ddate">10월 · 일요일</div><div className="cal-city-label">니스→BCN</div></div>
                  <div className="cal-card-body">
                    <div className="cal-item"><span className="cal-icon">🏰</span><span>카슬힐 전망대</span></div>
                    <div className="cal-item"><span className="cal-icon">✈</span><span>저가항공 바르셀로나</span></div>
                    <div className="cal-item"><span className="cal-icon">🍺</span><span>고딕지구 도착</span></div>
                  </div>
                </div>
                <div className="cal-card city-bcn">
                  <div className="cal-card-head"><div className="cal-dnum">12</div><div className="cal-ddate">10월 · 월요일</div><div className="cal-city-label">바르셀로나</div></div>
                  <div className="cal-card-body">
                    <div className="cal-special tag-holiday">🇪🇸 스페인 국경절</div>
                    <div className="cal-item"><span className="cal-icon">⛪</span><span>사그라다 파밀리아</span></div>
                    <div className="cal-item"><span className="cal-icon">🏗</span><span>산타 파우 병원</span></div>
                    <div className="cal-item"><span className="cal-icon">🍺</span><span>에이샴플레 타파스</span></div>
                  </div>
                </div>
                <div className="cal-card city-bcn">
                  <div className="cal-card-head"><div className="cal-dnum">13</div><div className="cal-ddate">10월 · 화요일</div><div className="cal-city-label">바르셀로나</div></div>
                  <div className="cal-card-body">
                    <div className="cal-item"><span className="cal-icon">🌿</span><span>파크 구엘</span></div>
                    <div className="cal-item"><span className="cal-icon">🎨</span><span>피카소 미술관</span></div>
                    <div className="cal-item"><span className="cal-icon">🥩</span><span>보케리아 시장</span></div>
                  </div>
                </div>
                <div className="cal-card city-bcn">
                  <div className="cal-card-head"><div className="cal-dnum">14</div><div className="cal-ddate">10월 · 수요일</div><div className="cal-city-label">바르셀로나</div></div>
                  <div className="cal-card-body">
                    <div className="cal-special tag-depart">✈ 20:00 귀국 출발</div>
                    <div className="cal-item"><span className="cal-icon">🚡</span><span>몬주익 케이블카</span></div>
                    <div className="cal-item"><span className="cal-icon">🛍</span><span>파세이그 드 그라시아 쇼핑</span></div>
                    <div className="cal-item"><span className="cal-icon">✈</span><span>귀국</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ PLAN COMPARISON ══ */}
      <div className="section" style={{ background: 'var(--cream2)' }}>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-eyebrow">두 플랜 비교</div>
            <div className="sec-title">A안 vs B안 — 뭐가 다른가요?</div>
          </div>
          <div className="compare-grid">
            <div className="compare-card">
              <div className="compare-head compare-head-a">
                <div>
                  <div className="compare-label">A안 — 내 추천</div>
                  <div className="compare-title">깊이 있게, 가성비 좋게</div>
                </div>
              </div>
              <div className="compare-body">
                <div className="compare-row"><span className="compare-city cc-paris">파리</span><div className="compare-desc">마이리얼트립 투어로 언어 걱정 없이 파리 맥락 파악 → 이후 오르세·마레 자유 탐방. <span className="em">루브르 제외</span>로 시간 절약.</div></div>
                <div className="compare-row"><span className="compare-city cc-nice">니스</span><div className="compare-desc">모나코+에즈 당일치기 1회. <span className="em">토요일은 완전 휴양</span> — 해변+미슐랭 디너. 진짜 쉬는 날 1일 확보.</div></div>
                <div className="compare-row"><span className="compare-city cc-bcn">BCN</span><div className="compare-desc">가우디 건물 + 파크 구엘 + 엘보른. <span className="em">Paradiso 바</span> 같은 특별한 저녁 경험 포함.</div></div>
              </div>
            </div>
            <div className="compare-card">
              <div className="compare-head compare-head-b">
                <div>
                  <div className="compare-label">B안 — 한국 관광객 일반</div>
                  <div className="compare-title">최대한 많이, 빠짐없이</div>
                </div>
              </div>
              <div className="compare-body">
                <div className="compare-row"><span className="compare-city cc-paris">파리</span><div className="compare-desc"><span className="em">루브르 + 오르세</span> 양대 미술관 + 몽마르트르 + 노트르담 + 생트샤펠. 타이트하지만 빠짐없이.</div></div>
                <div className="compare-row"><span className="compare-city cc-nice">니스</span><div className="compare-desc">동쪽(모나코+에즈) + <span className="em">서쪽(앙티브+칸) 당일치기 2회.</span> 코트다쥐르 최대한 탐방. 휴양일 없음.</div></div>
                <div className="compare-row"><span className="compare-city cc-bcn">BCN</span><div className="compare-desc">사그라다 파밀리아 + 파크 구엘 + <span className="em">피카소 미술관 + 보케리아 + 몬주익</span>까지 빡빡하게.</div></div>
              </div>
            </div>
          </div>
          <div className="tip-box" style={{ marginTop: 0 }}>
            <span>💡</span>
            <span><strong>신혼여행이라면 A안 추천.</strong> 니스에서 진짜 쉬는 날이 있어야 여행이 기억에 남아요. B안은 '다시는 갈 수 없어서 다 봐야 한다'는 마음이 강할 때 선택. 체력 소모가 큽니다.</span>
          </div>
        </div>
      </div>

      {/* ══ PARIS DISTRICT GUIDE ══ */}
      <div className="section">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-eyebrow">파리 숙소 가이드</div>
            <div className="sec-title">어느 구(arrondissement)에 묵을까?</div>
            <div className="sec-sub">파리는 1~20구까지 달팽이 모양으로 펼쳐져요. 구마다 분위기와 가격이 완전히 다릅니다.</div>
          </div>

          <div className="district-grid">
            {/* 15구 — 추천 */}
            <div className="district-card district-card--recommended">
              <div className="district-head district-head--rec">
                <div className="district-num">15구</div>
                <div className="district-name">Vaugirard</div>
                <span className="district-badge district-badge--rec">⭐ 아내 추천</span>
              </div>
              <div className="district-body">
                <div className="district-price">에어비앤비 1박 €80~130</div>
                <div className="district-desc">
                  파리에서 <strong>가장 넓고 인구가 많은 구</strong>. 관광지가 아니라 현지인 동네 — 그래서 가성비가 압도적이에요.
                  에펠탑 도보 15~20분, 메트로 6·12호선으로 어디든 20분 이내. 대형 마트·빵집·레스토랑이 일상적 가격.
                </div>
                <ul className="district-pros">
                  <li>✅ 에펠탑 도보권 — 야경 산책 가능</li>
                  <li>✅ 1박 €80~130 — 마레·생제르맹 대비 30~40% 저렴</li>
                  <li>✅ 현지인 동네라 치안 양호, 조용함</li>
                  <li>✅ Rue du Commerce 상점가 — 마트·약국·카페 밀집</li>
                  <li>✅ RER C로 베르사유 접근 편리</li>
                </ul>
                <ul className="district-cons">
                  <li>⚠️ 밤 문화·트렌디한 바는 적음</li>
                  <li>⚠️ 관광 중심부(루브르·마레)까지 메트로 20~25분</li>
                </ul>
              </div>
            </div>

            {/* 4구 마레 */}
            <div className="district-card">
              <div className="district-head">
                <div className="district-num">3~4구</div>
                <div className="district-name">Le Marais</div>
                <span className="district-badge">인기 No.1</span>
              </div>
              <div className="district-body">
                <div className="district-price">에어비앤비 1박 €130~200</div>
                <div className="district-desc">
                  관광객 인기 1위. 파리에서 가장 활기찬 동네. 갤러리·빈티지숍·팔라펠·카페가 골목마다.
                  노트르담·바스티유·보주 광장 도보권.
                </div>
                <ul className="district-pros">
                  <li>✅ 도보로 주요 명소 접근</li>
                  <li>✅ 밤까지 활기찬 분위기</li>
                  <li>✅ 맛집·카페 밀집</li>
                </ul>
                <ul className="district-cons">
                  <li>⚠️ 가격대 높음 — 같은 조건 15구 대비 1.5~2배</li>
                  <li>⚠️ 주말 인파 많음</li>
                </ul>
              </div>
            </div>

            {/* 6구 생제르맹 */}
            <div className="district-card">
              <div className="district-head">
                <div className="district-num">5~6구</div>
                <div className="district-name">Saint-Germain / Latin Quarter</div>
                <span className="district-badge">클래식</span>
              </div>
              <div className="district-body">
                <div className="district-price">에어비앤비 1박 €140~220</div>
                <div className="district-desc">
                  파리의 클래식. 뤽상부르 공원, Café de Flore, 셰익스피어 서점. 고급스럽고 조용한 분위기.
                  오르세 미술관·로댕 미술관 도보권.
                </div>
                <ul className="district-pros">
                  <li>✅ 파리 감성 최고 — 신혼여행 분위기</li>
                  <li>✅ 치안 우수</li>
                  <li>✅ 뤽상부르 공원 조깅·산책</li>
                </ul>
                <ul className="district-cons">
                  <li>⚠️ 파리에서 가장 비싼 구 중 하나</li>
                  <li>⚠️ 에펠탑까지 메트로 필요</li>
                </ul>
              </div>
            </div>

            {/* 7구 */}
            <div className="district-card">
              <div className="district-head">
                <div className="district-num">7구</div>
                <div className="district-name">Tour Eiffel / Invalides</div>
                <span className="district-badge">에펠탑</span>
              </div>
              <div className="district-body">
                <div className="district-price">에어비앤비 1박 €120~180</div>
                <div className="district-desc">
                  에펠탑이 있는 구. 앵발리드·로댕 미술관 도보권. 조용한 주거 지역으로 치안 최상.
                </div>
                <ul className="district-pros">
                  <li>✅ 에펠탑 바로 옆 — 방에서 야경 가능한 숙소도</li>
                  <li>✅ 치안 최상급</li>
                  <li>✅ 15구와 인접 — 가성비 식당 접근 가능</li>
                </ul>
                <ul className="district-cons">
                  <li>⚠️ 밤에 조용함 — 바·클럽 거의 없음</li>
                  <li>⚠️ 마레·오페라 지역까지 거리 있음</li>
                </ul>
              </div>
            </div>

            {/* 9구 */}
            <div className="district-card">
              <div className="district-head">
                <div className="district-num">9~10구</div>
                <div className="district-name">Opéra / Canal Saint-Martin</div>
                <span className="district-badge">가성비</span>
              </div>
              <div className="district-body">
                <div className="district-price">에어비앤비 1박 €90~140</div>
                <div className="district-desc">
                  오페라 가르니에·갤러리 라파예트 백화점 도보권. 10구 생마르탱 운하 주변은 힙한 카페·바 밀집.
                </div>
                <ul className="district-pros">
                  <li>✅ 교통 허브 — 파리 북역·동역 가까움</li>
                  <li>✅ 마레·몽마르트르 사이 위치</li>
                  <li>✅ 15구만큼은 아니지만 합리적 가격</li>
                </ul>
                <ul className="district-cons">
                  <li>⚠️ 10구 북역 주변은 밤에 혼잡·소란</li>
                  <li>⚠️ 에펠탑까지 메트로 25분+</li>
                </ul>
              </div>
            </div>

            {/* 11구 */}
            <div className="district-card">
              <div className="district-head">
                <div className="district-num">11구</div>
                <div className="district-name">Bastille / Oberkampf</div>
                <span className="district-badge">가성비</span>
              </div>
              <div className="district-body">
                <div className="district-price">에어비앤비 1박 €80~120</div>
                <div className="district-desc">
                  바스티유 광장 중심. 파리 젊은층 나이트라이프 성지. 자연와인 바·라이브 클럽 밀집.
                  마레지구 바로 옆이라 접근성 좋음.
                </div>
                <ul className="district-pros">
                  <li>✅ 마레지구 도보 5분</li>
                  <li>✅ 가격 합리적 — 15구와 비슷한 수준</li>
                  <li>✅ 밤 문화 풍부</li>
                </ul>
                <ul className="district-cons">
                  <li>⚠️ 밤에 시끄러울 수 있음 (바 밀집 구역)</li>
                  <li>⚠️ 에펠탑·개선문까지 거리 있음</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="tip-box" style={{ marginTop: 20 }}>
            <span>💡</span>
            <span><strong>결론: 15구 Vaugirard 강력 추천.</strong> 신혼여행 3박이면 숙소비 차이가 €100~200 정도. 그 돈으로 Jan Restaurant 디너 한 번 더 가능. 에펠탑 야경도 걸어서 보러 갈 수 있고, Rue du Commerce에서 현지인처럼 장도 볼 수 있어요.</span>
          </div>
        </div>
      </div>

      {/* ══ A안 ITINERARY ══ */}
      <div className={`plan-content ${plan === 'a' ? 'active' : ''}`}>
        {/* 파리 A안 */}
        <div className="city-header">
          <div className="city-header-inner">
            <div className="city-banner cb-paris">
              <div className="cb-main">
                <div className="cb-eyebrow">A안 · Paris · 3박 4일</div>
                <div className="cb-title">파리</div>
                <div className="cb-sub">10/5(월) 도착 → 10/8(목) TGV 이동 · 마이리얼트립 + 오르세 + 에펠탑</div>
              </div>
              <div className="cb-badges">
                <div className="cb-badge">🚌 마이리얼트립 투어</div>
                <div className="cb-badge">🎨 오르세 미술관</div>
                <div className="cb-badge">✨ 에펠탑 야경</div>
              </div>
            </div>
          </div>
        </div>

        <div className="days-wrap" style={{ paddingTop: 24 }}>
          <div className="days-inner">
            {/* D1 */}
            <div className="day-block">
              <div className="day-meta dm-paris">
                <div className="day-num-label">D1</div>
                <div className="day-dot dd-transit">1</div>
                <div className="day-date-sm">10/5 월</div>
              </div>
              <div className="day-card">
                <div className="day-card-head">
                  <div className="dch-title">파리 도착 · 마레지구 저녁</div>
                  <div className="dch-theme theme-paris">✈ 입국일</div>
                </div>
                <div className="day-card-body">
                  <div className="sched-time-row"><div className="sched-t">20:00</div><div className="sched-c"><strong>CDG 도착</strong> — EES 생체인식 등록 포함, 입국 심사 30~60분 예상 <span className="note">⚠️ 첫 방문자 EES 등록 시간 여유 있게</span></div></div>
                  <div className="sched-time-row"><div className="sched-t">이동</div><div className="sched-c"><strong>CDG → 숙소</strong> — RER B <span className="price">€11.80 · 45분</span> 또는 공식 택시 <span className="price">€56~65 (우안/좌안)</span><div className="note">⚠️ 택시 사칭 주의. 공식 노란 택시 표지 확인. Bolt·Uber 앱도 가능.</div></div></div>
                  <div className="sched-time-row"><div className="sched-t">밤</div><div className="sched-c"><strong>마레지구 저녁</strong> — 숙소 근처 비스트로 또는 편의점 간단히. 오늘은 이동만으로 충분.</div></div>
                  <div className="tip-box"><span>💡</span><span>파리 도착 첫날 — 비행 12시간 후입니다. 진짜 아무것도 안 해도 됩니다.</span></div>
                  <div className="links-row">
                    <a href="https://www.paris.fr" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-paris">🗼 Paris 공식</a>
                  </div>
                </div>
              </div>
            </div>

            {/* D2 */}
            <div className="day-block">
              <div className="day-meta dm-paris">
                <div className="day-num-label">D2</div>
                <div className="day-dot dd-paris">2</div>
                <div className="day-date-sm">10/6 화</div>
              </div>
              <div className="day-card">
                <div className="day-card-head">
                  <div className="dch-title">마이리얼트립 투어 + 오르세 + 에펠탑</div>
                  <div className="dch-theme theme-paris">🚌 가이드 투어</div>
                </div>
                <div className="day-card-body">
                  <div className="sched-time-row"><div className="sched-t">오전</div><div className="sched-c"><strong>마이리얼트립 한국어 버스투어</strong> <span className="price">₩5~8만/인</span><div className="note">파리 주요 명소를 한국어 가이드와 함께. 에펠탑·루브르 외관·개선문·노트르담 등 커버. <strong>유럽 첫 방문이라 언어 걱정 없이 파리 전체 맥락 파악하는 최고의 방법.</strong></div></div></div>
                  <div className="sched-time-row"><div className="sched-t">오후</div><div className="sched-c"><strong>오르세 미술관</strong> <span className="price">€16</span><div className="note">모네·드가·르누아르·반 고흐 인상주의 집결지. 2~3시간. 사전 예약 필수 (당일 줄 1~2시간).</div></div></div>
                  <div className="sched-time-row"><div className="sched-t">점심</div><div className="sched-c"><strong>생제르맹데프레 카페</strong> — Café de Flore 또는 Les Deux Magots에서 파리 감성 체험</div></div>
                  <div className="sched-time-row"><div className="sched-t">저녁</div><div className="sched-c"><strong>에펠탑 야경</strong> — 트로카데로(Trocadéro) 광장에서 정면 뷰<div className="note">매 정각 10분간 조명 반짝이는 쇼. 9~11시 사이 관람 권장. 올라가려면 사전 예약 필수.</div></div></div>
                  <div className="links-row">
                    <a href="https://www.myrealtrip.com" target="_blank" rel="noopener noreferrer" className="link-btn">🚌 마이리얼트립</a>
                    <a href="https://www.musee-orsay.fr" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-paris">🎨 오르세 예약</a>
                    <a href="https://www.toureiffel.paris" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-paris">✨ 에펠탑 예약</a>
                    <a href="https://www.cafedeflore.fr" target="_blank" rel="noopener noreferrer" className="link-btn">☕ Café de Flore</a>
                  </div>
                </div>
              </div>
            </div>

            {/* D3 */}
            <div className="day-block">
              <div className="day-meta dm-paris">
                <div className="day-num-label">D3</div>
                <div className="day-dot dd-paris">3</div>
                <div className="day-date-sm">10/7 수</div>
              </div>
              <div className="day-card">
                <div className="day-card-head">
                  <div className="dch-title">뤽상부르 공원 · 마레지구 · 로댕 미술관</div>
                  <div className="dch-theme theme-paris">🌳 자유 탐방</div>
                </div>
                <div className="day-card-body">
                  <div className="sched-time-row"><div className="sched-t">오전</div><div className="sched-c"><strong>뤽상부르 공원</strong> <span className="price">무료</span><div className="note">10월 단풍이 아름다운 계절. 파리지앵처럼 벤치에 앉아 커피 한 잔.</div></div></div>
                  <div className="sched-time-row"><div className="sched-t">오전</div><div className="sched-c"><strong>로댕 미술관 정원</strong> <span className="price">€4 (정원만)</span><div className="note">생각하는 사람·지옥의 문 실물 관람. 정원에서 피크닉 가능. 내부 전체 €13.</div></div></div>
                  <div className="sched-time-row"><div className="sched-t">점심</div><div className="sched-c"><strong>마레지구</strong> — L'As du Fallafel <span className="price">€7~8</span><div className="note">파리에서 가장 유명한 팔라펠. Rue des Rosiers에 위치.</div></div></div>
                  <div className="sched-time-row"><div className="sched-t">오후</div><div className="sched-c"><strong>마레지구 탐방</strong> — 갤러리, 빈티지숍, 피카소 미술관 외관, 보주 광장(Place des Vosges, 파리 최고(最古) 광장) 산책</div></div>
                  <div className="sched-time-row"><div className="sched-t">저녁</div><div className="sched-c"><strong>마레지구 레스토랑</strong> — 내일 TGV가 있으니 오늘 저녁은 여유롭게</div></div>
                  <div className="links-row">
                    <a href="https://www.musee-rodin.fr" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-paris">🏛 로댕 미술관</a>
                  </div>
                </div>
              </div>
            </div>

            {/* D4 */}
            <div className="day-block">
              <div className="day-meta dm-paris">
                <div className="day-num-label">D4</div>
                <div className="day-dot dd-transit">→</div>
                <div className="day-date-sm">10/8 목</div>
              </div>
              <div className="day-card">
                <div className="day-card-head">
                  <div className="dch-title">몽마르트르 → TGV → 니스</div>
                  <div className="dch-theme theme-transit">🚄 이동일</div>
                </div>
                <div className="day-card-body">
                  <div className="sched-time-row"><div className="sched-t">오전</div><div className="sched-c"><strong>몽마르트르(Montmartre)</strong><div className="note">사크레쾨르 대성당(파리 전망 최고, 무료) → 테르트르 광장(거리 화가들) → 아멜리에 로케 골목 산책</div></div></div>
                  <div className="sched-time-row"><div className="sched-t">점심</div><div className="sched-c"><strong>몽마르트르 카페</strong> — 마지막 파리 식사</div></div>
                  <div className="sched-time-row"><div className="sched-t">13:30</div><div className="sched-c"><strong>파리 리옹역 → TGV InOui → 니스 빌</strong> <span className="price">€30~80 · 5시간 31분</span><div className="note">리옹역에 30분 전 도착 권장. 2층 객차 창가석 추천 — 론 계곡, 프로방스, 지중해 해안 차례로 펼쳐짐. 식당칸에서 프랑스 와인 한 잔.</div></div></div>
                  <div className="sched-time-row"><div className="sched-t">19:00</div><div className="sched-c"><strong>니스 빌 역 도착</strong> — 역에서 숙소까지 트램 또는 도보 15~20분</div></div>
                  <div className="tip-box"><span>💡</span><span>TGV는 OUIGO(저가, €19~)와 InOui(프리미엄, €30~) 중 선택. 신혼여행이면 InOui 추천 — 더 빠르고, 좌석 더 넓고, 짐 규정도 여유로움.</span></div>
                  <div className="links-row">
                    <a href="https://www.sncf-connect.com" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-paris">🚄 SNCF TGV 예약</a>
                    <a href="https://www.ouigo.com" target="_blank" rel="noopener noreferrer" className="link-btn">💰 OUIGO 저가</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 니스 A안 */}
        <div className="city-header" style={{ paddingTop: 32 }}>
          <div className="city-header-inner">
            <div className="city-banner cb-nice">
              <div className="cb-main">
                <div className="cb-eyebrow">A안 · Nice &amp; Côte d'Azur · 3박 4일</div>
                <div className="cb-title">니스 + 코트다쥐르</div>
                <div className="cb-sub">10/8(목) 도착 → 10/11(일) 출발 · 모나코·에즈 + 순수 휴양 1일</div>
              </div>
              <div className="cb-badges">
                <div className="cb-badge">🇲🇨 모나코 당일치기</div>
                <div className="cb-badge">🏛 에즈 절벽마을</div>
                <div className="cb-badge">🌴 해변 휴양일</div>
                <div className="cb-badge">🍽 미슐랭 1스타 디너</div>
              </div>
            </div>
          </div>
        </div>

        <div className="days-wrap" style={{ paddingTop: 24 }}>
          <div className="days-inner">
            {/* D5 */}
            <div className="day-block">
              <div className="day-meta dm-nice">
                <div className="day-num-label">D5</div>
                <div className="day-dot dd-nice">5</div>
                <div className="day-date-sm">10/8 목</div>
              </div>
              <div className="day-card">
                <div className="day-card-head">
                  <div className="dch-title">니스 도착 · 프롬나드 · 뷰니스</div>
                  <div className="dch-theme theme-nice">🌊 도착 저녁</div>
                </div>
                <div className="day-card-body">
                  <div className="sched-time-row"><div className="sched-t">19:00</div><div className="sched-c"><strong>니스 빌 역 도착</strong> → 체크인</div></div>
                  <div className="sched-time-row"><div className="sched-t">저녁 전</div><div className="sched-c"><strong>프롬나드 데장글레(Promenade des Anglais) 산책</strong><div className="note">지중해 첫 인상. 7km 해안 산책로. 파리와 다른 공기가 느껴질 것.</div></div></div>
                  <div className="sched-time-row"><div className="sched-t">저녁</div><div className="sched-c"><strong>뷰니스(Vieux-Nice) 올드타운</strong><div className="note"><strong>소카(Socca)</strong> — 병아리콩 가루 갈레트. 니스 대표 음식. Lou Pilha Leva에서 €3~5. 좁은 골목 노천 테이블에서 현지 분위기 첫 경험.</div></div></div>
                </div>
              </div>
            </div>

            {/* D6 */}
            <div className="day-block">
              <div className="day-meta dm-nice">
                <div className="day-num-label">D6</div>
                <div className="day-dot dd-nice">6</div>
                <div className="day-date-sm">10/9 금</div>
              </div>
              <div className="day-card">
                <div className="day-card-head">
                  <div className="dch-title">에즈 절벽마을 + 모나코 몬테카를로</div>
                  <div className="dch-theme theme-nice">🇲🇨 동쪽 당일치기</div>
                </div>
                <div className="day-card-body">
                  <div className="sched-time-row"><div className="sched-t">9:30</div><div className="sched-c"><strong>버스 출발</strong> — 트램 1호선 → Vauban 정류장 → 버스 82번 또는 602번 <span className="price">€1.70~2.50</span><div className="note">버스 82: €1.70 (Lignes d'Azur 카드), 운전기사 현금 €4. 버스 602: €2.50. 약 1시간 간격 운행.</div></div></div>
                  <div className="sched-time-row"><div className="sched-t">10:00</div><div className="sched-c"><strong>에즈(Èze) 절벽마을</strong><div className="note">해발 429m 중세 돌담 마을. 자르댕 엑조티크(선인장 정원) €7 — 신용카드만. 프라고나르 향수공장(무료 견학). <strong>10:30 이후 단체 버스 도착해 혼잡해지니 일찍 가세요.</strong></div></div></div>
                  <div className="sched-time-row"><div className="sched-t">12:30</div><div className="sched-c"><strong>에즈 산상 점심</strong> — 절벽 위 레스토랑에서 지중해 뷰와 함께</div></div>
                  <div className="sched-time-row"><div className="sched-t">14:00</div><div className="sched-c"><strong>모나코 이동</strong> — 버스 602번 타고 20분 (€2.50) 또는 기차<div className="note">⚠️ 여권 지참 필수. 모나코는 별도 국가.</div></div></div>
                  <div className="sched-time-row"><div className="sched-t">14:30</div><div className="sched-c"><strong>왕궁(Palais Princier)</strong> 근위병 교대식 — <strong>매일 11:55</strong> (오전에 가면 볼 수 있지만, 이 일정이면 오후 외관 투어)<div className="note">왕궁 내부 투어: 4~10월 운영, €15 내외.</div></div></div>
                  <div className="sched-time-row"><div className="sched-t">15:30</div><div className="sched-c"><strong>해양박물관(Musée Océanographique)</strong> <span className="price">€20</span><div className="note">자크 쿠스토가 설립. 절벽 위 대형 수족관. 2~3시간.</div></div></div>
                  <div className="sched-time-row"><div className="sched-t">17:30</div><div className="sched-c"><strong>몬테카를로 카지노 광장</strong> — 외관 구경, 고급 차량 퍼레이드 구경</div></div>
                  <div className="sched-time-row"><div className="sched-t">귀환</div><div className="sched-c"><strong>모나코 → 니스</strong> — 기차 25분 <span className="price">€4~7</span></div></div>
                  <div className="tip-box"><span>💡</span><span>저녁 식사는 모나코보다 니스에서 — 같은 음식이 2~3배 저렴해요.</span></div>
                  <div className="links-row">
                    <a href="https://www.palais.mc" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-nice">👑 모나코 왕궁</a>
                    <a href="https://oceano.org" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-nice">🐠 해양박물관</a>
                    <a href="https://www.fragonard.com" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-nice">🌸 프라고나르</a>
                  </div>
                </div>
              </div>
            </div>

            {/* D7 */}
            <div className="day-block">
              <div className="day-meta dm-nice">
                <div className="day-num-label">D7</div>
                <div className="day-dot dd-nice" style={{ background: 'var(--nice-mid)' }}>7</div>
                <div className="day-date-sm">10/10 토</div>
              </div>
              <div className="day-card">
                <div className="day-card-head">
                  <div className="dch-title">🌴 순수 휴양일 — 해변 + 미슐랭 디너</div>
                  <div className="dch-theme theme-relax">휴양</div>
                </div>
                <div className="day-card-body">
                  <div className="sched-time-row"><div className="sched-t">오전</div><div className="sched-c"><strong>늦잠</strong> + 호텔 조식 여유롭게</div></div>
                  <div className="sched-time-row"><div className="sched-t">11:00</div><div className="sched-c"><strong>쿠르 살레야(Cours Saleya) 시장</strong><div className="note">토요일 = 꽃시장 + 식재료 시장. 니스에서 가장 활기찬 아침.</div></div></div>
                  <div className="sched-time-row"><div className="sched-t">점심</div><div className="sched-c"><strong>뷰니스 골목 브런치</strong> — Chez Acchiardo (1927년 창업, 정통 니수아즈 요리) 추천</div></div>
                  <div className="sched-time-row"><div className="sched-t">오후</div><div className="sched-c"><strong>프롬나드 데장글레 해변</strong><div className="note">수영, 독서, 낮잠, 지중해 바라보기. 10월 니스 수온 20°C 내외, 수영 가능.</div></div></div>
                  <div className="sched-time-row"><div className="sched-t">저녁</div><div className="sched-c"><strong>Jan Restaurant</strong> — 미슐랭 1스타 <span className="price">약 €80~120/인</span><div className="note">남아프리카 셰프 Jan Hendrik의 창의적 요리. 니스 최고의 파인다이닝. <strong>사전 예약 필수 (2~4주 전).</strong></div></div></div>
                  <div className="tip-box"><span>💡</span><span>4일을 열심히 달렸으니 오늘은 진짜 아무 계획 없이 쉬어도 됩니다. 이 날이 신혼여행 중 가장 기억에 남을 거예요.</span></div>
                  <div className="links-row">
                    <a href="https://www.restaurantjan.com" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-nice">🍽 Jan Restaurant 예약</a>
                  </div>
                </div>
              </div>
            </div>

            {/* D8 */}
            <div className="day-block">
              <div className="day-meta dm-nice">
                <div className="day-num-label">D8</div>
                <div className="day-dot dd-transit">→</div>
                <div className="day-date-sm">10/11 일</div>
              </div>
              <div className="day-card">
                <div className="day-card-head">
                  <div className="dch-title">벼룩시장 · 카슬힐 → 바르셀로나</div>
                  <div className="dch-theme theme-transit">✈ 이동일</div>
                </div>
                <div className="day-card-body">
                  <div className="sched-time-row"><div className="sched-t">오전</div><div className="sched-c"><strong>쿠르 살레야 벼룩시장(Marché de la Brocante)</strong><div className="note">⭐ <strong>일요일에는 꽃시장 대신 벼룩시장!</strong> 골동품, 빈티지 소품, 프로방스 기념품.</div></div></div>
                  <div className="sched-time-row"><div className="sched-t">오전</div><div className="sched-c"><strong>카슬힐(Colline du Château) 전망대</strong> <span className="price">엘리베이터 무료</span><div className="note">니스 + 지중해 파노라마 뷰. 마지막 니스 기억으로 딱.</div></div></div>
                  <div className="sched-time-row"><div className="sched-t">점심</div><div className="sched-c"><strong>La Merenda</strong> — 현금만, 예약 불가, 줄 서야 하는 니스 명물<div className="note">소카, 피소살라디에르(양파 타르트), 트리파. 마지막 니스 식사로 최고.</div></div></div>
                  <div className="sched-time-row"><div className="sched-t">오후</div><div className="sched-c"><strong>니스 코트다쥐르 공항(NCE) → 바르셀로나 엘프라트</strong><div className="note">트램 T2 → 공항 €1.70. Vueling 또는 easyJet, 1시간 30분.</div></div></div>
                  <div className="links-row">
                    <a href="https://www.vueling.com" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-nice">✈ Vueling</a>
                    <a href="https://www.easyjet.com" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-nice">✈ easyJet</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 바르셀로나 A안 */}
        <div className="city-header" style={{ paddingTop: 32 }}>
          <div className="city-header-inner">
            <div className="city-banner cb-bcn">
              <div className="cb-main">
                <div className="cb-eyebrow">A안 · Barcelona · 3박 4일</div>
                <div className="cb-title">바르셀로나</div>
                <div className="cb-sub">10/11(일) 도착 → 10/14(수) 20:00 출발 · 가우디 + 엘보른 + Paradiso</div>
              </div>
              <div className="cb-badges">
                <div className="cb-badge">⛪ 사그라다 파밀리아 완공</div>
                <div className="cb-badge">🌿 파크 구엘</div>
                <div className="cb-badge">🍸 Paradiso 바</div>
              </div>
            </div>
          </div>
        </div>

        <div className="days-wrap" style={{ paddingTop: 24 }}>
          <div className="days-inner">
            {/* D9 */}
            <div className="day-block">
              <div className="day-meta dm-bcn">
                <div className="day-num-label">D9</div>
                <div className="day-dot dd-bcn">9</div>
                <div className="day-date-sm">10/11 일</div>
              </div>
              <div className="day-card">
                <div className="day-card-head">
                  <div className="dch-title">바르셀로나 도착 · 고딕지구</div>
                  <div className="dch-theme theme-bcn">🎨 도착 저녁</div>
                </div>
                <div className="day-card-body">
                  <div className="sched-time-row"><div className="sched-t">도착</div><div className="sched-c"><strong>공항 → 시내</strong> — Aerobus <span className="price">€6.75 · 35분</span> 또는 메트로 L9 <span className="price">€5.5</span></div></div>
                  <div className="sched-time-row"><div className="sched-t">저녁</div><div className="sched-c"><strong>고딕지구(Barri Gòtic) 타파스</strong><div className="note">Can Culleretes (1786년 창업, 스페인 최고령 레스토랑 중 하나). 카탈루냐 전통 요리.</div></div></div>
                  <div className="links-row">
                    <a href="https://www.aerobcn.com" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-bcn">🚌 Aerobus</a>
                  </div>
                </div>
              </div>
            </div>

            {/* D10 */}
            <div className="day-block">
              <div className="day-meta dm-bcn">
                <div className="day-num-label">D10</div>
                <div className="day-dot dd-bcn" style={{ background: 'var(--bcn-mid)' }}>10</div>
                <div className="day-date-sm">10/12 월 ⚠️</div>
              </div>
              <div className="day-card">
                <div className="day-card-head">
                  <div className="dch-title">카사 바트요 · 카사 밀라 · 바르셀로네타 해변</div>
                  <div className="dch-theme theme-holiday">🇪🇸 국경절</div>
                </div>
                <div className="day-card-body">
                  <div className="warn-box"><span>⚠️</span><span>오늘은 스페인 국경절(Día de la Hispanidad). 일부 박물관 휴무 가능. 야외 중심 일정으로 구성.</span></div>
                  <div className="sched-time-row"><div className="sched-t">오전</div><div className="sched-c"><strong>카사 바트요(Casa Batlló)</strong> <span className="price">€35~49</span><div className="note">가우디의 용 등껍질 외관. AR 투어 포함. 세계에서 가장 아름다운 건물 중 하나. <strong>사전 예약 필수.</strong></div></div></div>
                  <div className="sched-time-row"><div className="sched-t">오전</div><div className="sched-c"><strong>카사 밀라(La Pedrera)</strong> <span className="price">€25~28</span><div className="note">옥상 테라스가 특히 아름다움. 두 건물 모두 보려면 오전 일찍 시작.</div></div></div>
                  <div className="sched-time-row"><div className="sched-t">점심</div><div className="sched-c"><strong>Cervecería Catalana</strong> — 에이샴플레 현지인 타파스 명소</div></div>
                  <div className="sched-time-row"><div className="sched-t">오후</div><div className="sched-c"><strong>바르셀로네타(Barceloneta) 해변</strong><div className="note">10월 수온 약 20°C, 수영 가능. 지중해 해변 산책. 자전거 대여 가능.</div></div></div>
                  <div className="sched-time-row"><div className="sched-t">저녁</div><div className="sched-c"><strong>Carrer de Blai 핀초스 골목</strong> (포블레 섹)<div className="note">핀초스 바들이 줄지어 있는 골목. 카운터에 쌓인 것 골라먹고 나중에 계산. 개당 €1~1.5.</div></div></div>
                  <div className="links-row">
                    <a href="https://www.casabatllo.es" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-bcn">🏗 카사 바트요 예약</a>
                    <a href="https://www.lapedrera.com" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-bcn">🏗 카사 밀라 예약</a>
                  </div>
                </div>
              </div>
            </div>

            {/* D11 */}
            <div className="day-block">
              <div className="day-meta dm-bcn">
                <div className="day-num-label">D11</div>
                <div className="day-dot dd-bcn">11</div>
                <div className="day-date-sm">10/13 화</div>
              </div>
              <div className="day-card">
                <div className="day-card-head">
                  <div className="dch-title">사그라다 파밀리아 · 파크 구엘 · 엘보른 · Paradiso</div>
                  <div className="dch-theme theme-bcn">⭐ 하이라이트</div>
                </div>
                <div className="day-card-body">
                  <div className="sched-time-row"><div className="sched-t">9:00</div><div className="sched-c"><strong>사그라다 파밀리아(Sagrada Família)</strong> <span className="price">€26~49</span><div className="note">🏆 <strong>2026년 2월 20일 외부 완공!</strong> 비계 없는 완성된 모습을 볼 수 있는 첫 해. 172.5m 세계 최고 높이 교회. 오디오 가이드 필수. <strong>2~4주 전 예약 필수.</strong></div></div></div>
                  <div className="sched-time-row"><div className="sched-t">점심</div><div className="sched-c"><strong>그라시아 동네 카페</strong> — 공원 아래 현지 분위기 식당</div></div>
                  <div className="sched-time-row"><div className="sched-t">14:00</div><div className="sched-c"><strong>파크 구엘(Park Güell)</strong> <span className="price">€10</span><div className="note">가우디 모자이크 테라스. 바르셀로나 전망. <strong>시간대 예약 필수.</strong></div></div></div>
                  <div className="sched-time-row"><div className="sched-t">오후</div><div className="sched-c"><strong>엘보른(El Born) 탐방</strong> — 산타 마리아 델 마르 성당(무료), 편집숍, 자연와인 바</div></div>
                  <div className="sched-time-row"><div className="sched-t">저녁</div><div className="sched-c"><strong>Bar del Pla</strong> — 자연와인 + 타파스, 현지 젊은층 핫플</div></div>
                  <div className="sched-time-row"><div className="sched-t">야간</div><div className="sched-c"><strong>Paradiso 칵테일 바</strong> <span className="price">칵테일 €15~20</span><div className="note">책장 뒤 숨겨진 문으로 입장하는 세계 베스트 바. 예약 필수.</div></div></div>
                  <div className="links-row">
                    <a href="https://www.sagradafamilia.org" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-bcn">⛪ 사그라다 파밀리아 예약</a>
                    <a href="https://www.parkguell.barcelona" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-bcn">🌿 파크 구엘 예약</a>
                    <a href="https://www.paradisocollective.com" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-bcn">🍸 Paradiso 예약</a>
                  </div>
                </div>
              </div>
            </div>

            {/* D12 */}
            <div className="day-block">
              <div className="day-meta dm-bcn">
                <div className="day-num-label">D12</div>
                <div className="day-dot dd-transit">→</div>
                <div className="day-date-sm">10/14 수</div>
              </div>
              <div className="day-card">
                <div className="day-card-head">
                  <div className="dch-title">보케리아 · 고딕지구 · 쇼핑 → 귀국</div>
                  <div className="dch-theme theme-transit">✈ 귀국일</div>
                </div>
                <div className="day-card-body">
                  <div className="sched-time-row"><div className="sched-t">9:00</div><div className="sched-c"><strong>보케리아 시장(La Boqueria)</strong><div className="note">Bar Pinotxo — 시장 내 로컬 조식 명소. 혈소세지+병아리콩 €8. 오전 일찍 줄 서야 함. 람블라스 주변 소매치기 주의.</div></div></div>
                  <div className="sched-time-row"><div className="sched-t">점심</div><div className="sched-c"><strong>La Paradeta</strong> — 직접 해산물 고르면 조리, 가성비 최고</div></div>
                  <div className="sched-time-row"><div className="sched-t">오후</div><div className="sched-c"><strong>고딕지구 산책 + 쇼핑</strong> — 세금환급(détaxe) 서류 챙기기, 기념품</div></div>
                  <div className="sched-time-row"><div className="sched-t">17:00</div><div className="sched-c"><strong>Aerobus 탑승</strong> → 공항 T1/T2<div className="note">17:00 탑승 → 17:35 공항 도착. 저가항공 체크인 마감 엄격. 여유 있게 도착.</div></div></div>
                  <div className="sched-time-row"><div className="sched-t">20:00</div><div className="sched-c"><strong>아시아나 직항 출발</strong> → 인천</div></div>
                  <div className="links-row">
                    <a href="https://www.boqueria.barcelona" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-bcn">🥩 보케리아 시장</a>
                    <a href="https://laparadeta.com" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-bcn">🦐 La Paradeta</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ B안 ITINERARY ══ */}
      <div className={`plan-content ${plan === 'b' ? 'active' : ''}`}>
        {/* 파리 B안 */}
        <div className="city-header"><div className="city-header-inner"><div className="city-banner cb-paris">
          <div className="cb-main"><div className="cb-eyebrow">B안 · Paris · 3박 4일</div><div className="cb-title">파리</div><div className="cb-sub">10/5(월) 도착 → 10/8(목) TGV · 루브르 + 오르세 + 몽마르트르 + 노트르담</div></div>
          <div className="cb-badges"><div className="cb-badge">🏛 루브르 박물관</div><div className="cb-badge">🎨 오르세 미술관</div><div className="cb-badge">💎 생트샤펠</div></div>
        </div></div></div>

        <div className="days-wrap" style={{ paddingTop: 24 }}><div className="days-inner">
          <div className="day-block">
            <div className="day-meta dm-paris"><div className="day-num-label">D1</div><div className="day-dot dd-transit">1</div><div className="day-date-sm">10/5 월</div></div>
            <div className="day-card">
              <div className="day-card-head"><div className="dch-title">파리 도착 · 마레지구</div><div className="dch-theme theme-paris">✈ 입국일</div></div>
              <div className="day-card-body">
                <div className="sched-time-row"><div className="sched-t">20:00</div><div className="sched-c"><strong>CDG 도착</strong> → RER B 또는 택시로 숙소 이동</div></div>
                <div className="sched-time-row"><div className="sched-t">밤</div><div className="sched-c"><strong>마레지구</strong> — 체크인 후 근처 저녁 식사</div></div>
                <div className="tip-box"><span>💡</span><span>A안과 동일. 오늘은 이동만. 내일부터 빡빡하게 시작.</span></div>
              </div>
            </div>
          </div>
          <div className="day-block">
            <div className="day-meta dm-paris"><div className="day-num-label">D2</div><div className="day-dot dd-paris">2</div><div className="day-date-sm">10/6 화</div></div>
            <div className="day-card">
              <div className="day-card-head"><div className="dch-title">루브르 박물관 + 에펠탑 야경</div><div className="dch-theme theme-paris">🏛 대표 코스</div></div>
              <div className="day-card-body">
                <div className="sched-time-row"><div className="sched-t">오전</div><div className="sched-c"><strong>루브르 박물관(Musée du Louvre)</strong> <span className="price">€22</span><div className="note">모나리자, 밀로의 비너스, 사모트라케의 니케. 3~4시간. 사전 예약 필수. 리볼리 입구 이용.</div></div></div>
                <div className="sched-time-row"><div className="sched-t">점심</div><div className="sched-c"><strong>튈르리 공원(Jardin des Tuileries)</strong> 카페 <span className="price">무료 입장</span></div></div>
                <div className="sched-time-row"><div className="sched-t">오후</div><div className="sched-c"><strong>콩코르드 광장 → 샹젤리제 → 개선문</strong> — 파리 가장 유명한 축 산책</div></div>
                <div className="sched-time-row"><div className="sched-t">저녁</div><div className="sched-c"><strong>에펠탑 야경</strong> — 트로카데로 광장 명당 뷰</div></div>
                <div className="links-row">
                  <a href="https://www.louvre.fr" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-paris">🏛 루브르 예약</a>
                  <a href="https://www.toureiffel.paris" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-paris">✨ 에펠탑 예약</a>
                </div>
              </div>
            </div>
          </div>
          <div className="day-block">
            <div className="day-meta dm-paris"><div className="day-num-label">D3</div><div className="day-dot dd-paris">3</div><div className="day-date-sm">10/7 수</div></div>
            <div className="day-card">
              <div className="day-card-head"><div className="dch-title">오르세 미술관 + 몽마르트르 + 노트르담</div><div className="dch-theme theme-paris">🎨 문화 코스</div></div>
              <div className="day-card-body">
                <div className="sched-time-row"><div className="sched-t">오전</div><div className="sched-c"><strong>오르세 미술관</strong> <span className="price">€16</span><div className="note">인상주의 명화. 사전 예약 필수.</div></div></div>
                <div className="sched-time-row"><div className="sched-t">오후</div><div className="sched-c"><strong>몽마르트르</strong> — 사크레쾨르 대성당, 테르트르 광장</div></div>
                <div className="sched-time-row"><div className="sched-t">저녁 전</div><div className="sched-c"><strong>노트르담 대성당</strong> <span className="price">무료</span><div className="note">2024년 재개장. 센강변 야경 산책.</div></div></div>
                <div className="links-row">
                  <a href="https://www.musee-orsay.fr" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-paris">🎨 오르세 예약</a>
                  <a href="https://www.notredamedeparis.fr" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-paris">🕍 노트르담</a>
                </div>
              </div>
            </div>
          </div>
          <div className="day-block">
            <div className="day-meta dm-paris"><div className="day-num-label">D4</div><div className="day-dot dd-transit">→</div><div className="day-date-sm">10/8 목</div></div>
            <div className="day-card">
              <div className="day-card-head"><div className="dch-title">생트샤펠 · 마레 → TGV → 니스</div><div className="dch-theme theme-transit">🚄 이동일</div></div>
              <div className="day-card-body">
                <div className="sched-time-row"><div className="sched-t">오전</div><div className="sched-c"><strong>생트샤펠(Sainte-Chapelle)</strong> <span className="price">€13</span><div className="note">13세기 중세 스테인드글라스 걸작. 파리에서 가장 아름다운 실내 공간 중 하나.</div></div></div>
                <div className="sched-time-row"><div className="sched-t">점심</div><div className="sched-c"><strong>마레지구</strong> — L'As du Fallafel 팔라펠 €7~8</div></div>
                <div className="sched-time-row"><div className="sched-t">13:30</div><div className="sched-c"><strong>파리 리옹역 → TGV → 니스</strong></div></div>
                <div className="links-row">
                  <a href="https://www.sainte-chapelle.fr" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-paris">💎 생트샤펠 예약</a>
                  <a href="https://www.sncf-connect.com" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-paris">🚄 TGV 예약</a>
                </div>
              </div>
            </div>
          </div>
        </div></div>

        {/* 니스 B안 */}
        <div className="city-header" style={{ paddingTop: 32 }}><div className="city-header-inner"><div className="city-banner cb-nice">
          <div className="cb-main"><div className="cb-eyebrow">B안 · Nice &amp; Côte d'Azur · 3박 4일</div><div className="cb-title">니스 + 코트다쥐르</div><div className="cb-sub">10/8(목) 도착 → 10/11(일) 출발 · 당일치기 2회 — 코트다쥐르 최대 탐방</div></div>
          <div className="cb-badges"><div className="cb-badge">🇲🇨 모나코+에즈</div><div className="cb-badge">🎨 앙티브 피카소</div><div className="cb-badge">🎬 칸느 크루아제트</div></div>
        </div></div></div>

        <div className="days-wrap" style={{ paddingTop: 24 }}><div className="days-inner">
          <div className="day-block">
            <div className="day-meta dm-nice"><div className="day-num-label">D5</div><div className="day-dot dd-nice">5</div><div className="day-date-sm">10/8 목</div></div>
            <div className="day-card">
              <div className="day-card-head"><div className="dch-title">니스 도착 · 시내 첫 탐방</div><div className="dch-theme theme-nice">🌊 도착 저녁</div></div>
              <div className="day-card-body">
                <div className="sched-time-row"><div className="sched-t">19:00</div><div className="sched-c"><strong>니스 빌 역 도착</strong> → 체크인 → 프롬나드 산책 → 뷰니스 소카</div></div>
              </div>
            </div>
          </div>
          <div className="day-block">
            <div className="day-meta dm-nice"><div className="day-num-label">D6</div><div className="day-dot dd-nice">6</div><div className="day-date-sm">10/9 금</div></div>
            <div className="day-card">
              <div className="day-card-head"><div className="dch-title">모나코 + 에즈 당일치기</div><div className="dch-theme theme-nice">🇲🇨 동쪽 코스</div></div>
              <div className="day-card-body">
                <div className="sched-time-row"><div className="sched-t">종일</div><div className="sched-c"><strong>A안 D6와 동일</strong> — 에즈 절벽마을 + 모나코 왕궁(근위병 교대식 11:55) + 해양박물관 + 카지노 광장</div></div>
                <div className="links-row">
                  <a href="https://www.palais.mc" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-nice">👑 모나코 왕궁</a>
                  <a href="https://oceano.org" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-nice">🐠 해양박물관</a>
                </div>
              </div>
            </div>
          </div>
          <div className="day-block">
            <div className="day-meta dm-nice"><div className="day-num-label">D7</div><div className="day-dot dd-nice">7</div><div className="day-date-sm">10/10 토</div></div>
            <div className="day-card">
              <div className="day-card-head"><div className="dch-title">앙티브 피카소 미술관 + 칸느 크루아제트</div><div className="dch-theme theme-nice">🎨 서쪽 코스</div></div>
              <div className="day-card-body">
                <div className="sched-time-row"><div className="sched-t">오전</div><div className="sched-c"><strong>앙티브(Antibes)</strong> — 기차 20분 <span className="price">€5~6</span><div className="note">⭐ 토요일 = 마르셰 프로방살(시장) 오픈. 피카소가 1946년 실제로 작업한 그리말디 성의 피카소 미술관. €8.</div></div></div>
                <div className="sched-time-row"><div className="sched-t">점심</div><div className="sched-c"><strong>앙티브 항구 카페</strong> — 고급 요트들이 정박한 항구 뷰</div></div>
                <div className="sched-time-row"><div className="sched-t">오후</div><div className="sched-c"><strong>칸(Cannes)</strong> — 기차 10분 <span className="price">€5</span><div className="note">영화제 레드카펫 거리 크루아제트(La Croisette) 산책. 뤼 당티브 쇼핑.</div></div></div>
                <div className="sched-time-row"><div className="sched-t">저녁</div><div className="sched-c"><strong>니스 귀환</strong> — 기차 30분. 뷰니스 저녁 식사.</div></div>
                <div className="links-row">
                  <a href="https://www.antibes-juanlespins.com" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-nice">🎨 앙티브 피카소 미술관</a>
                </div>
              </div>
            </div>
          </div>
          <div className="day-block">
            <div className="day-meta dm-nice"><div className="day-num-label">D8</div><div className="day-dot dd-transit">→</div><div className="day-date-sm">10/11 일</div></div>
            <div className="day-card">
              <div className="day-card-head"><div className="dch-title">카슬힐 전망대 · 니스 시내 → 바르셀로나</div><div className="dch-theme theme-transit">✈ 이동일</div></div>
              <div className="day-card-body">
                <div className="sched-time-row"><div className="sched-t">오전</div><div className="sched-c"><strong>카슬힐(Colline du Château) 전망대</strong> <span className="price">엘리베이터 무료</span><div className="note">니스 마지막 전망. 올라갈 때 엘리베이터, 내려올 때 뷰니스 골목 계단.</div></div></div>
                <div className="sched-time-row"><div className="sched-t">점심</div><div className="sched-c"><strong>쿠르 살레야 일요 벼룩시장</strong> + 현지 점심</div></div>
                <div className="sched-time-row"><div className="sched-t">오후</div><div className="sched-c"><strong>니스 공항 → 바르셀로나</strong> — Vueling 또는 easyJet</div></div>
              </div>
            </div>
          </div>
        </div></div>

        {/* 바르셀로나 B안 */}
        <div className="city-header" style={{ paddingTop: 32 }}><div className="city-header-inner"><div className="city-banner cb-bcn">
          <div className="cb-main"><div className="cb-eyebrow">B안 · Barcelona · 3박 4일</div><div className="cb-title">바르셀로나</div><div className="cb-sub">10/11(일) 도착 → 10/14(수) 20:00 출발 · 가우디 + 피카소 + 몬주익 + 보케리아</div></div>
          <div className="cb-badges"><div className="cb-badge">⛪ 사그라다 파밀리아</div><div className="cb-badge">🎨 피카소 미술관</div><div className="cb-badge">🚡 몬주익 케이블카</div></div>
        </div></div></div>

        <div className="days-wrap" style={{ paddingTop: 24 }}><div className="days-inner">
          <div className="day-block">
            <div className="day-meta dm-bcn"><div className="day-num-label">D9</div><div className="day-dot dd-bcn">9</div><div className="day-date-sm">10/11 일</div></div>
            <div className="day-card">
              <div className="day-card-head"><div className="dch-title">바르셀로나 도착 · 고딕지구</div><div className="dch-theme theme-bcn">🎨 도착 저녁</div></div>
              <div className="day-card-body">
                <div className="sched-time-row"><div className="sched-t">도착</div><div className="sched-c"><strong>공항 → 체크인 → 고딕지구 타파스</strong> — A안과 동일</div></div>
              </div>
            </div>
          </div>
          <div className="day-block">
            <div className="day-meta dm-bcn"><div className="day-num-label">D10</div><div className="day-dot dd-bcn" style={{ background: 'var(--bcn-mid)' }}>10</div><div className="day-date-sm">10/12 월 ⚠️</div></div>
            <div className="day-card">
              <div className="day-card-head"><div className="dch-title">사그라다 파밀리아 + 산타 파우 병원 (국경절)</div><div className="dch-theme theme-holiday">🇪🇸 국경절</div></div>
              <div className="day-card-body">
                <div className="warn-box"><span>⚠️</span><span>국경절. 사그라다 파밀리아는 운영하나, 방문 전 공식 홈페이지 확인 권장.</span></div>
                <div className="sched-time-row"><div className="sched-t">오전</div><div className="sched-c"><strong>사그라다 파밀리아</strong> <span className="price">€26~49</span><div className="note">2026년 외부 완공! 오디오 가이드 포함. 사전 예약 필수.</div></div></div>
                <div className="sched-time-row"><div className="sched-t">점심</div><div className="sched-c"><strong>에이샴플레 타파스</strong></div></div>
                <div className="sched-time-row"><div className="sched-t">오후</div><div className="sched-c"><strong>산타 파우 병원(Recinte Modernista de Sant Pau)</strong> <span className="price">€18</span><div className="note">UNESCO 유산. 카탈루냐 아르누보 건축 걸작. 사그라다 파밀리아 도보 10분. 관광객이 적어 여유롭게 탐방 가능.</div></div></div>
                <div className="sched-time-row"><div className="sched-t">저녁</div><div className="sched-c"><strong>El Nacional</strong> — 그랜드 푸드홀. 여러 콘셉트 공간.</div></div>
                <div className="links-row">
                  <a href="https://www.sagradafamilia.org" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-bcn">⛪ 사그라다 파밀리아</a>
                  <a href="https://santpaubarcelona.org" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-bcn">🏛 산타 파우 병원</a>
                  <a href="https://www.elnacionalbcn.com" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-bcn">🍽 El Nacional</a>
                </div>
              </div>
            </div>
          </div>
          <div className="day-block">
            <div className="day-meta dm-bcn"><div className="day-num-label">D11</div><div className="day-dot dd-bcn">11</div><div className="day-date-sm">10/13 화</div></div>
            <div className="day-card">
              <div className="day-card-head"><div className="dch-title">파크 구엘 · 피카소 미술관 · 보케리아 · 바르셀로네타</div><div className="dch-theme theme-bcn">🌿 풀 코스</div></div>
              <div className="day-card-body">
                <div className="sched-time-row"><div className="sched-t">오전</div><div className="sched-c"><strong>파크 구엘</strong> <span className="price">€10</span><div className="note">이른 오전 방문으로 인파 피하기. 사전 예약 필수.</div></div></div>
                <div className="sched-time-row"><div className="sched-t">오전</div><div className="sched-c"><strong>피카소 미술관(Museu Picasso)</strong> <span className="price">€14</span><div className="note">피카소 청년기 작품 집중 전시. 엘보른 내.</div></div></div>
                <div className="sched-time-row"><div className="sched-t">점심</div><div className="sched-c"><strong>보케리아 시장(La Boqueria)</strong> — Bar Pinotxo 또는 시장 내 타파스</div></div>
                <div className="sched-time-row"><div className="sched-t">오후</div><div className="sched-c"><strong>바르셀로네타 해변</strong> 산책 + 해산물 저녁</div></div>
                <div className="links-row">
                  <a href="https://www.parkguell.barcelona" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-bcn">🌿 파크 구엘 예약</a>
                  <a href="https://www.museupicassobcn.org" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-bcn">🎨 피카소 미술관</a>
                  <a href="https://www.boqueria.barcelona" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-bcn">🥩 보케리아 시장</a>
                </div>
              </div>
            </div>
          </div>
          <div className="day-block">
            <div className="day-meta dm-bcn"><div className="day-num-label">D12</div><div className="day-dot dd-transit">→</div><div className="day-date-sm">10/14 수</div></div>
            <div className="day-card">
              <div className="day-card-head"><div className="dch-title">몬주익 케이블카 · 쇼핑 → 귀국</div><div className="dch-theme theme-transit">✈ 귀국일</div></div>
              <div className="day-card-body">
                <div className="sched-time-row"><div className="sched-t">오전</div><div className="sched-c"><strong>몬주익(Montjuïc) 케이블카</strong> <span className="price">€13</span><div className="note">바르셀로나 + 항구 전망. 호안 미로 재단도 근처.</div></div></div>
                <div className="sched-time-row"><div className="sched-t">오후</div><div className="sched-c"><strong>파세이그 드 그라시아 쇼핑</strong> + 마지막 타파스</div></div>
                <div className="sched-time-row"><div className="sched-t">17:00</div><div className="sched-c"><strong>Aerobus → 공항</strong></div></div>
                <div className="sched-time-row"><div className="sched-t">20:00</div><div className="sched-c"><strong>아시아나 직항 출발</strong> → 인천</div></div>
                <div className="links-row">
                  <a href="https://www.fmirobcn.org" target="_blank" rel="noopener noreferrer" className="link-btn link-btn-bcn">🎨 호안 미로 재단</a>
                </div>
              </div>
            </div>
          </div>
        </div></div>
      </div>

      {/* ══ PRACTICAL INFO ══ */}
      <div className="section">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-eyebrow">유럽 첫 여행 필수 정보</div>
            <div className="sec-title">출발 전 꼭 알아야 할 것들</div>
          </div>
          <div className="info-grid">
            <div className="info-card alert">
              <div className="info-icon">⚠️</div>
              <div className="info-title">ETIAS — 2026년 Q4 시행 예정</div>
              <div className="info-body">한국인도 필요한 새 EU 사전 입국 허가. <strong>€20/인, 온라인 신청, 3년 유효.</strong> 10월 여행이면 시행 초기 + 6개월 유예기간 가능성 있음. 공식 사이트에서 최신 상황 확인 필수. <strong>⚠️ 현재 신청 포털 미운영 — 제3자 사이트 사기 주의!</strong><br /><a href="https://travel-europe.europa.eu" target="_blank" rel="noopener noreferrer">→ 공식 사이트</a></div>
            </div>
            <div className="info-card alert">
              <div className="info-icon">🛂</div>
              <div className="info-title">EES — 이미 시행 중 (2025년 10월~)</div>
              <div className="info-body">EU 생체인식 입국 시스템. 여권 도장 대신 <strong>지문 + 얼굴 사진 등록.</strong> CDG 도착 시 입국 심사에 추가 시간 예상. 등록 후 이후 입국은 빠름. 별도 신청 불필요.</div>
            </div>
            <div className="info-card">
              <div className="info-icon">📱</div>
              <div className="info-title">데이터 — eSIM 강력 추천</div>
              <div className="info-body"><strong>한국 유심 유지</strong>하면서 유럽 데이터 추가. OTP·카카오톡 정상 수신. 분실 위험 없음. Airalo 또는 통신사 eSIM. <strong>출국 전 설치, 현지 도착 후 활성화.</strong> 2인 각각 10~15GB 준비.</div>
            </div>
            <div className="info-card">
              <div className="info-icon">💳</div>
              <div className="info-title">결제 — 트래블월렛 + 유로 현금</div>
              <div className="info-body"><strong>트래블월렛 또는 트래블로그 카드</strong> (수수료 없음). 유로 현금 €200~300 준비. €10~20 지폐 위주. <strong>La Merenda(니스) 같은 현금만 받는 곳 있음.</strong> 한국 플러그(둥근 2핀 C타입)는 유럽에서 그대로 사용 가능!</div>
            </div>
            <div className="info-card">
              <div className="info-icon">🚨</div>
              <div className="info-title">소매치기 — 파리·바르셀로나 특히 주의</div>
              <div className="info-body">파리: 에펠탑, RER B, 관광지. 바르셀로나: <strong>람블라스, 메트로, 보케리아 주변.</strong> 대책: 가방 항상 앞으로, 지갑·핸드폰 가방 깊숙이, 테이블 위 핸드폰 절대 금지. 의심스러운 사람이 말 걸면 "No, gracias".</div>
            </div>
            <div className="info-card">
              <div className="info-icon">🍽</div>
              <div className="info-title">팁 문화 + 수돗물</div>
              <div className="info-body"><strong>프랑스:</strong> 팁 의무 없음 (service compris 법적 의무). 감사하면 €1~2. <strong>스페인:</strong> 의무 아님, 만족하면 소액. <strong>수돗물:</strong> 파리·니스·바르셀로나 모두 음용 가능! 식당에서 "une carafe d'eau" (파리) = 무료 수돗물.</div>
            </div>
            <div className="info-card">
              <div className="info-icon">🗣</div>
              <div className="info-title">기본 회화</div>
              <div className="info-body"><strong>프랑스어:</strong> Bonjour(봉주르), Merci(메르시), L'addition s'il vous plaît(계산서). <strong>스페인어:</strong> Hola(올라), Gracias(그라시아스), La cuenta(계산서). 첫마디를 현지 언어로 시작하면 서비스가 달라져요.</div>
            </div>
            <div className="info-card">
              <div className="info-icon">💊</div>
              <div className="info-title">비상 준비물</div>
              <div className="info-body"><strong>한국 소화제·두통약 충분히 챙기기</strong> (현지 약은 비싸고 효과 다름). 여권 사본 1부 (디지털+종이). 해외여행자보험 필수. 세금환급(détaxe): 한 매장 €100.01 이상 구매 시 VAT ~15% 환급 가능. 긴급번호: <strong>112</strong> (유럽 공통).</div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ BUDGET ══ */}
      <div className="section" style={{ background: 'var(--cream2)' }}>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-eyebrow">예산 가이드</div>
            <div className="sec-title">2인 기준 예상 비용 (항공 제외)</div>
          </div>
          <table className="budget-table">
            <thead>
              <tr>
                <th>항목</th>
                <th>절약형</th>
                <th>중간형 (권장)</th>
                <th>메모</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>숙박 9박 (에어비앤비·합리적 호텔)</td><td className="budget-range">110~150만원</td><td className="budget-range">160~210만원</td><td style={{ fontSize: 12, color: 'var(--muted)' }}>주방 있는 숙소 = 조식비 절약</td></tr>
              <tr><td>식비·카페</td><td className="budget-range">80~130만원</td><td className="budget-range">130~200만원</td><td style={{ fontSize: 12, color: 'var(--muted)' }}>마트 활용 시 하루 €15~20 절약</td></tr>
              <tr><td>TGV + 저가항공 + 버스</td><td className="budget-range">40~70만원</td><td className="budget-range">50~80만원</td><td style={{ fontSize: 12, color: 'var(--muted)' }}>TGV 2주+ 전 예약 시 특가</td></tr>
              <tr><td>관광·입장료</td><td className="budget-range">25~50만원</td><td className="budget-range">40~70만원</td><td style={{ fontSize: 12, color: 'var(--muted)' }}>사그라다 파밀리아·오르세 등</td></tr>
              <tr><td>마이리얼트립 투어 (2인)</td><td className="budget-range">10~16만원</td><td className="budget-range">10~16만원</td><td style={{ fontSize: 12, color: 'var(--muted)' }}>A안 파리 D2 한국어 투어</td></tr>
              <tr><td>A안 미슐랭 디너 (Jan, 2인)</td><td className="budget-range">—</td><td className="budget-range">25~35만원</td><td style={{ fontSize: 12, color: 'var(--muted)' }}>신혼여행 특별 저녁</td></tr>
              <tr><td>쇼핑·여유비·ETIAS·보험</td><td className="budget-range">50~100만원</td><td className="budget-range">80~150만원</td><td style={{ fontSize: 12, color: 'var(--muted)' }}>ETIAS €40 (2인)</td></tr>
              <tr><td colSpan={4} style={{ padding: 0 }}></td></tr>
              <tr>
                <td><strong>2인 합계</strong></td>
                <td className="budget-range" style={{ fontSize: 15 }}><strong>315~516만원</strong></td>
                <td className="budget-range" style={{ fontSize: 15 }}><strong>495~761만원</strong></td>
                <td style={{ fontSize: 12, color: 'var(--muted)' }}>항공(아시아나 직항) 별도 200~350만원</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ CHECKLIST ══ */}
      <div className="section">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-eyebrow">사전 예약 체크리스트</div>
            <div className="sec-title">시기별 해야 할 것들</div>
          </div>
          <div className="check-grid">
            <div className="check-col">
              <div className="check-col-title">🗓 3~6개월 전</div>
              <div className="check-item"><div className="check-box"></div><div><strong>아시아나 직항 예약</strong> (인천→파리, 바르셀로나→인천)<span className="check-urgent">이미 완료!</span></div></div>
              <div className="check-item"><div className="check-box"></div><div><strong>숙소 3곳</strong> 예약 (파리·니스·바르셀로나)</div></div>
              <div className="check-item"><div className="check-box"></div><div>해외여행자 보험 가입</div></div>
              <div className="check-item"><div className="check-box"></div><div>여권 유효기간 확인 (출국일 기준 6개월+)</div></div>
            </div>
            <div className="check-col">
              <div className="check-col-title">🗓 2~3개월 전</div>
              <div className="check-item"><div className="check-box"></div><div><strong>TGV 파리→니스</strong> 예약 <a href="https://www.sncf-connect.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--paris-l)' }}>sncf-connect.com</a></div></div>
              <div className="check-item"><div className="check-box"></div><div><strong>니스→바르셀로나</strong> 저가항공 <a href="https://www.vueling.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--paris-l)' }}>vueling.com</a></div></div>
              <div className="check-item"><div className="check-box"></div><div>트래블월렛/트래블로그 카드 발급</div></div>
              <div className="check-item"><div className="check-box"></div><div>eSIM 구매 (출국 전 설치)</div></div>
            </div>
            <div className="check-col">
              <div className="check-col-title">🗓 1~2개월 전</div>
              <div className="check-item"><div className="check-box"></div><div><strong>사그라다 파밀리아</strong> <a href="https://www.sagradafamilia.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--bcn)' }}>예약</a> <span className="check-urgent">최우선!</span></div></div>
              <div className="check-item"><div className="check-box"></div><div><strong>오르세 미술관</strong> <a href="https://www.musee-orsay.fr" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--paris-l)' }}>예약</a></div></div>
              <div className="check-item"><div className="check-box"></div><div><strong>파크 구엘</strong> <a href="https://www.parkguell.barcelona" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--bcn)' }}>예약</a></div></div>
              <div className="check-item"><div className="check-box"></div><div>카사 바트요/밀라 예약</div></div>
              <div className="check-item"><div className="check-box"></div><div><strong>마이리얼트립</strong> 파리 투어 <a href="https://www.myrealtrip.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--paris-l)' }}>예약</a></div></div>
              <div className="check-item"><div className="check-box"></div><div>A안: Jan Restaurant 예약 <a href="https://www.restaurantjan.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--nice)' }}>링크</a></div></div>
              <div className="check-item"><div className="check-box"></div><div>Paradiso 바 예약 (BCN)</div></div>
            </div>
            <div className="check-col">
              <div className="check-col-title">🗓 출발 전 최종 확인</div>
              <div className="check-item"><div className="check-box"></div><div><strong>ETIAS 상황 확인</strong> <a href="https://travel-europe.europa.eu" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--bcn)' }}>공식사이트</a> <span className="check-urgent">Q4 2026 시행!</span></div></div>
              <div className="check-item"><div className="check-box"></div><div>구글맵 오프라인 지도 다운 (파리·니스·바르셀로나)</div></div>
              <div className="check-item"><div className="check-box"></div><div>유로 현금 환전 (€200~300, €10~20 소액권)</div></div>
              <div className="check-item"><div className="check-box"></div><div>한국 소화제·두통약·비상약 충분히</div></div>
              <div className="check-item"><div className="check-box"></div><div>여권 사본 (디지털 + 종이 1부)</div></div>
              <div className="check-item"><div className="check-box"></div><div>eSIM 활성화 방법 숙지</div></div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ FOOTER ══ */}
      <div className="honeymoon-footer">
        <strong>파리 · 니스 · 바르셀로나 신혼여행 플래너 v5</strong><br />
        아시아나항공 직항 · 2026년 10월 5일~14일 · 9박 10일<br />
        숙소는 3개월 전 / TGV·저가항공은 2개월 전 / 사그라다 파밀리아는 반드시 사전 예약
      </div>
    </div>
  )
}
