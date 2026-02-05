# 메이크샵 제한사항 파악 테스트 가이드

## 📊 테스트 전략

각 단계별로 섹션을 추가하면서 메이크샵이 허용하는 최대 크기와 기능을 파악합니다.

---

## 🔬 단계별 테스트 파일

### ✅ 현재 상태 (성공)
**파일**: `index-makeshop-with-style.html`
- **크기**: 7.7KB (287 라인)
- **섹션**: Hero, Philosophy, Timeline (5개 연도)
- **기능**: 기본 CSS, 반응형
- **결과**: ✅ 메이크샵 저장 성공

---

### Step 1: Timeline 전체 (11개 연도)
**파일**: `step1-timeline-full.html`
- **추가 내용**: Timeline 5개 → 11개 연도로 확장
- **예상 크기**: ~10KB
- **테스트 목적**: HTML 크기 증가 테스트
- **새 기능**: 없음 (HTML 양만 증가)

**테스트 방법**:
```
1. step1-timeline-full.html 내용 복사
2. 메이크샵 페이지 편집 → HTML 소스 모드
3. 붙여넣기 → 저장
4. 결과 기록: 성공/실패
```

**성공 시**: Step 2로 진행
**실패 시**: HTML 크기 제한 = 약 8-10KB

---

### Step 2: + Achievements Section (탭 기능)
**파일**: `step2-add-achievements.html`
- **추가 내용**: 수상/프로젝트/특허 탭 섹션
- **예상 크기**: ~15KB
- **테스트 목적**: JavaScript 탭 전환 기능, Grid 레이아웃
- **새 기능**:
  - Tab 버튼 클릭 이벤트
  - Active 클래스 토글
  - Grid 3-column 레이아웃

**테스트 방법**: Step 1과 동일

**성공 시**: JavaScript 이벤트 리스너 허용 확인
**실패 시**: 이유 파악 (크기? JavaScript? CSS Grid?)

---

### Step 3: + Innovation Section
**파일**: `step3-add-innovation.html`
- **추가 내용**: 기술 혁신 섹션 (이미지 + 텍스트 split)
- **예상 크기**: ~18KB
- **테스트 목적**: 2-column Grid 레이아웃
- **새 기능**:
  - 50/50 Grid split
  - 이미지 배치

**성공 시**: Grid 레이아웃 허용 확인

---

### Step 4: + Education & Stats Section
**파일**: `step4-add-education.html`
- **추가 내용**: 교육과 사회공헌, 통계 카운터
- **예상 크기**: ~22KB
- **테스트 목적**: JavaScript 숫자 애니메이션
- **새 기능**:
  - CountUp 애니메이션 (heritage.js 필요)
  - 4-column Grid

**성공 시**: heritage.js의 CountUp 기능 작동 확인

---

### Step 5: + Publications Section (Slick)
**파일**: `step5-add-publications.html`
- **추가 내용**: 저서 및 출판 캐러셀
- **예상 크기**: ~25KB
- **테스트 목적**: **Slick 캐러셀 작동 여부** (핵심)
- **새 기능**:
  - Slick 캐러셀 (jQuery + slick.min.js 필요)
  - 반응형 슬라이드
- **필수 조건**:
  - 메이크샵 디자인 스킨에 jQuery 추가
  - Slick CSS/JS 추가

**성공 시**: Slick 작동 → heritage.js의 캐러셀 초기화 확인

---

### Step 6: + Gallery Section (Lightbox)
**파일**: `step6-add-gallery.html`
- **추가 내용**: 작품 갤러리 (10개 이미지)
- **예상 크기**: ~30KB
- **테스트 목적**: **Lightbox 팝업 작동 여부** (핵심)
- **새 기능**:
  - 이미지 클릭 → Lightbox 팝업
  - ESC 키로 닫기
  - heritage.js의 Lightbox 기능 필요

**성공 시**: JavaScript 이벤트 + DOM 조작 허용 확인

---

### Step 7: 전체 통합 버전
**파일**: `step7-complete.html`
- **추가 내용**: International, Legacy Section 포함
- **예상 크기**: ~35-40KB
- **테스트 목적**: 메이크샵 최대 허용 크기 파악
- **새 기능**: 전체 기능 통합

---

## 📋 테스트 결과 기록표

각 단계 테스트 후 아래 표를 작성해주세요:

| Step | 파일명 | 크기 | 결과 | 에러 메시지 | 비고 |
|------|--------|------|------|------------|------|
| 현재 | index-makeshop-with-style.html | 7.7KB | ✅ 성공 | - | 기능/내용 부족 |
| 1a | step1-timeline-full-complete.html | 8.6KB | ⚠️ 저장됨 | - | 디자인 저하 (CSS 압축) |
| 1b | makeshop-quality-version.html | 11.4KB | ⚠️ 저장됨 | - | 폰트/여백 이상 |
| 1c | **makeshop-final-fixed.html** | **12.9KB** | **🧪 테스트 대기** | - | **폰트/리셋 추가** |
| 2 | step2-add-achievements.html | ~18KB | | | + Achievements 탭 |
| 3 | step3-add-innovation.html | ~21KB | | | + Innovation |
| 4 | step4-add-education.html | ~25KB | | | + Education, Stats |
| 5 | step5-add-publications.html | ~28KB | | | + Slick 캐러셀 |
| 6 | step6-add-gallery.html | ~32KB | | | + Gallery, Lightbox |
| 7 | step7-complete.html | ~40KB | | | 전체 통합 |

---

## 🔍 분석 기준

### HTML 크기 제한
- ✅ 성공: 해당 크기까지 허용
- ❌ 실패: 크기 제한 초과

### JavaScript 기능
- Tab 전환: Step 2에서 확인
- CountUp 애니메이션: Step 4에서 확인
- Slick 캐러셀: Step 5에서 확인
- Lightbox: Step 6에서 확인

### CSS 레이아웃
- 2-column Grid: Step 3에서 확인
- 3-column Grid: Step 2에서 확인
- 4-column Grid: Step 4에서 확인

---

## ⚠️ 중요 발견 사항 (2026-02-06)

### 메이크샵에서 필수로 포함해야 할 스타일

#### 1. Pretendard 폰트 @font-face 선언
메이크샵 페이지 편집기는 별도 CSS 파일을 로드하지 않으므로, **HTML 내부 `<style>` 태그에 @font-face를 직접 포함**해야 함.

```css
@font-face {
  font-family: 'Pretendard';
  font-weight: 700;
  src: url(//skin.makeshop.co.kr/skin/rw_shop/pretendard/woff2/Pretendard-Bold.woff2) format('woff2');
}
/* 600, 400, 300도 동일하게 추가 */
```

**누락 시**: 메이크샵 기본 폰트 사용 → 타이포그래피 완전히 다름

#### 2. 전역 스타일 리셋
```css
#heritage-main * {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
```

**누락 시**: 브라우저 기본 여백 적용 → 레이아웃 틀어짐

#### 3. 폰트 및 렌더링 최적화
```css
#heritage-main {
  font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.75;
  color: #121212;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

**누락 시**: 폰트 미적용, 렌더링 품질 저하

#### 결론
- ❌ `makeshop-quality-version.html`: 위 3가지 누락 → 폰트/여백 이상
- ✅ `makeshop-final-fixed.html`: 위 3가지 포함 → 원본과 동일한 느낌

**참고 문서**: `MAKESHOP_FONT_FIX_REPORT.md`

---

## 💡 문제 발생 시 대응

### 크기 제한 초과 시
→ 이전 성공한 Step까지가 메이크샵 최대 크기
→ 섹션을 여러 페이지로 분할 필요

### JavaScript 에러 시
→ heritage.js 파일 확인
→ jQuery, Slick 라이브러리 로드 확인

### CSS 깨짐 시
→ CSS 변수 사용 여부 확인
→ Grid, Flexbox 지원 확인

---

## 🎯 최종 목표

**메이크샵 허용 기준 문서화**:
1. 최대 HTML 크기
2. 허용되는 JavaScript 기능
3. 허용되는 CSS 속성
4. 금지된 태그/속성 목록

이 정보를 바탕으로 최적화된 메이크샵 전용 버전을 제작합니다.
