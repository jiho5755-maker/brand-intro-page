# 구현 가이드

YouTube-제품 자동 연동 시스템 상세 구현 가이드입니다.

---

## 목차

1. [사전 준비](#1-사전-준비)
2. [Google Apps Script 설정](#2-google-apps-script-설정)
3. [카카오 SDK 설정](#3-카카오-sdk-설정)
4. [파일 설정](#4-파일-설정)
5. [메이크샵 통합](#5-메이크샵-통합)
6. [테스트](#6-테스트)
7. [최적화](#7-최적화)

---

## 1. 사전 준비

### 필요한 것들

- [ ] Google 계정
- [ ] Kakao Developers 계정
- [ ] 메이크샵 관리자 계정
- [ ] FTP 접속 정보 (선택)
- [ ] 제품 이미지 (최소 10개)
- [ ] YouTube 채널 ID

### YouTube 채널 ID 확인

1. YouTube 채널 접속
2. URL 확인: `https://www.youtube.com/channel/UCOt_7gyvjqHBw304hU4-FUw`
3. `UCOt_7gyvjqHBw304hU4-FUw` 부분이 채널 ID

---

## 2. Google Apps Script 설정

### Step 1: YouTube Data API 키 발급

#### 1.1. Google Cloud Console 접속
```
https://console.developers.google.com/
```

#### 1.2. 프로젝트 생성
1. "프로젝트 선택" 드롭다운 클릭
2. "새 프로젝트" 클릭
3. 프로젝트 이름: "YouTube Product Integration"
4. "만들기" 클릭

#### 1.3. YouTube Data API v3 활성화
1. "API 및 서비스" > "라이브러리" 클릭
2. 검색창에 "YouTube Data API v3" 입력
3. "YouTube Data API v3" 클릭
4. "사용 설정" 클릭

#### 1.4. API 키 생성
1. "API 및 서비스" > "사용자 인증 정보" 클릭
2. "사용자 인증 정보 만들기" > "API 키" 클릭
3. API 키 자동 생성됨
4. **API 키 복사 및 안전하게 보관**

#### 1.5. API 키 제한 설정 (권장)
1. 생성된 API 키 옆 "수정" 클릭
2. "API 제한사항" > "키 제한"
3. "YouTube Data API v3" 선택
4. "저장" 클릭

### Step 2: Google Apps Script 배포

#### 2.1. 새 프로젝트 생성
```
https://script.google.com/
```

1. "새 프로젝트" 클릭
2. 프로젝트 이름 변경: "YouTube Proxy v2"

#### 2.2. 코드 복사
1. 기본 `Code.gs` 파일 선택
2. `youtube-proxy-v2.gs` 파일 내용 전체 복사
3. Google Apps Script 편집기에 붙여넣기
4. Ctrl+S 또는 저장 아이콘 클릭

#### 2.3. API 키 설정
1. 프로젝트 설정 (톱니바퀴 아이콘) 클릭
2. "스크립트 속성" 탭 선택
3. "속성 추가" 클릭
4. 입력:
   - 속성: `YOUTUBE_API_KEY`
   - 값: (Step 1.4에서 복사한 API 키)
5. "스크립트 속성 저장" 클릭

#### 2.4. 테스트 실행
1. 함수 선택: `testGetVideos`
2. "실행" 버튼 클릭
3. 권한 요청 시 "권한 검토" 클릭
4. Google 계정 선택
5. "고급" > "YouTube Proxy v2(안전하지 않음)로 이동" 클릭
6. "허용" 클릭
7. 실행 로그 확인:
   - 보기 > 로그
   - "=== YouTube Proxy v2 테스트 시작 ===" 확인
   - 에러 없이 완료되면 성공

#### 2.5. 웹 앱으로 배포
1. "배포" > "새 배포" 클릭
2. 설정:
   - 유형 선택: "웹 앱"
   - 설명: "YouTube Product Integration v1.0"
   - 실행 계정: "나"
   - 액세스 권한: "모든 사용자"
3. "배포" 클릭
4. **웹 앱 URL 복사** (매우 중요!)
   - 예: `https://script.google.com/macros/s/AKfycby.../exec`

#### 2.6. 배포 URL 테스트
```
브라우저에서 배포 URL 접속:
https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?count=4

예상 응답:
{
  "status": "success",
  "items": [
    {
      "id": "videoId",
      "title": "영상 제목",
      ...
    }
  ],
  "count": 4,
  "timestamp": "2026-02-06T10:30:00Z"
}
```

---

## 3. 카카오 SDK 설정

### Step 1: Kakao Developers 앱 생성

#### 1.1. Kakao Developers 접속
```
https://developers.kakao.com/
```

#### 1.2. 앱 생성
1. "내 애플리케이션" 클릭
2. "애플리케이션 추가하기" 클릭
3. 앱 이름: "pressco21 쇼핑몰"
4. 사업자명: "프레스코21"
5. "저장" 클릭

### Step 2: 플랫폼 설정

#### 2.1. Web 플랫폼 추가
1. 생성한 앱 클릭
2. "플랫폼" > "Web 플랫폼 등록" 클릭
3. 사이트 도메인 입력:
   ```
   https://www.foreverlove.co.kr
   ```
4. "저장" 클릭

### Step 3: 카카오 로그인 활성화

#### 3.1. 카카오 로그인 설정
1. "제품 설정" > "카카오 로그인" 클릭
2. "활성화 설정" 토글 ON
3. "저장" 클릭

### Step 4: JavaScript 키 확인

1. "앱 설정" > "앱 키" 클릭
2. **JavaScript 키 복사** (매우 중요!)
   - 예: `0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p`

---

## 4. 파일 설정

### Step 1: youtube-product.js 수정

```javascript
// Line 18-19: Google Apps Script URL 설정
var CONFIG = {
  googleScriptUrl: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec', // ⚠️ 변경

  mappingDataUrl: '/design/jewoo/youtube-product-integration/product-mapping.json',
  maxVideos: 4,
  cacheDuration: 24 * 60 * 60 * 1000,
  newVideoDays: 3,
  debug: false // 테스트 시 true로 변경
};
```

### Step 2: youtube-product.html 수정

```html
<!-- Line 34-37: 카카오 앱 키 설정 -->
<script>
  if (typeof Kakao !== 'undefined') {
    Kakao.init('YOUR_KAKAO_APP_KEY'); // ⚠️ 변경
  }
</script>
```

### Step 3: product-mapping.json 수정

#### 3.1. 제품 정보 추가

실제 메이크샵 제품 정보로 교체:

```json
{
  "products": {
    "P1001": {
      "name": "압화 스타터 키트",
      "price": "35000",
      "image": "/design/jewoo/products/p1001.jpg",    // ⚠️ 실제 이미지 경로
      "link": "/shop/shopdetail.html?branduid=1001"   // ⚠️ 실제 제품 UID
    }
  }
}
```

#### 3.2. 제품 UID 확인 방법

1. 메이크샵 관리자 > 상품 관리 > 상품 리스트
2. 제품 클릭
3. URL 확인:
   ```
   http://admin.makeshop.co.kr/product/product_form.html?branduid=1001
   ```
4. `branduid=1001` 부분이 제품 UID

#### 3.3. 제품 이미지 경로 확인

1. 메이크샵 관리자 > 상품 관리 > 상품 리스트
2. 제품 이미지 오른쪽 클릭 > "이미지 주소 복사"
3. 경로 예시:
   ```
   http://jewoo.img4.kr/products/p1001.jpg
   또는
   /design/jewoo/products/p1001.jpg
   ```

---

## 5. 메이크샵 통합

### Step 1: 파일 업로드

#### 방법 1: 메이크샵 관리자 (권장)

**CSS 파일:**
1. 메이크샵 관리자 > 디자인 관리 > CSS 관리
2. "파일 추가" 클릭
3. `youtube-product.css` 업로드
4. 저장 위치: `/design/jewoo/youtube-product-integration/`

**JS 파일:**
1. 메이크샵 관리자 > 디자인 관리 > JS 관리
2. "파일 추가" 클릭
3. `youtube-product.js` 업로드
4. 저장 위치: `/design/jewoo/youtube-product-integration/`

**JSON 파일 (FTP 필수):**
1. FTP 클라이언트로 접속
2. 경로: `/design/jewoo/youtube-product-integration/`
3. `product-mapping.json` 업로드

#### 방법 2: FTP (대체)

```
FTP 접속 정보:
호스트: ftp.makeshop.co.kr
포트: 21
사용자명: (메이크샵 관리자 계정)
비밀번호: (메이크샵 관리자 비밀번호)

업로드 경로:
/design/jewoo/youtube-product-integration/
├── youtube-product.css
├── youtube-product.js
└── product-mapping.json
```

### Step 2: index.html 수정

1. 메이크샵 관리자 > 디자인 관리 > HTML 편집
2. "index.html" 선택
3. 삽입 위치 찾기:
   ```html
   <!-- 기존 메인 배너 끝 -->
   </div>

   <!-- ✅ 여기에 삽입! -->

   <!-- 기존 BEST ITEM 시작 -->
   <div id="specialWrap">
   ```

4. `youtube-product.html` 내용 복사 & 붙여넣기
5. "저장" 클릭

---

## 6. 테스트

### Step 1: 로컬 테스트 (선택)

```bash
# Python 3 설치되어 있다면
cd youtube-product-integration
python3 -m http.server 8000

# 브라우저에서 접속
open http://localhost:8000/test.html
```

### Step 2: 메이크샵 테스트

1. 메이크샵 쇼핑몰 접속
2. Ctrl+F5 (강력 새로고침)
3. F12 > Console 확인
4. 체크리스트:
   - [ ] 영상 4개 로드 확인
   - [ ] NEW 배지 표시 확인 (3일 이내 영상)
   - [ ] 조회수 표시 확인
   - [ ] 제품 정보 표시 확인 (매칭 시)
   - [ ] 카카오톡 공유 버튼 클릭 확인
   - [ ] 페이스북 공유 버튼 클릭 확인

### Step 3: 모바일 테스트

1. 모바일 기기 또는 Chrome 개발자 도구 (F12)
2. "Toggle device toolbar" (Ctrl+Shift+M)
3. 체크리스트:
   - [ ] 1열 세로 배치 확인
   - [ ] 터치 인터랙션 확인
   - [ ] 영상 재생 확인

### Step 4: 성능 테스트

1. F12 > Network 탭
2. 페이지 새로고침
3. 확인:
   - [ ] 초기 로드 < 3초
   - [ ] 캐시 로드 < 1초 (두 번째 새로고침)

---

## 7. 최적화

### 캐싱 전략

**클라이언트 캐싱:**
- LocalStorage: 24시간
- 캐시 키: `youtube_product_videos_cache`
- 캐시 시간: `youtube_product_cache_time`

**서버 캐싱:**
- Google Apps Script: 10분
- 캐시 키: `videos_v2_{channelId}_{maxResults}`

### API 호출 최소화

**현재 구조:**
```
첫 방문자:
  YouTube Data API 호출 (1회)
  → Google Apps Script 캐시 (10분)
  → 클라이언트 캐시 (24시간)

이후 방문자 (24시간 이내):
  LocalStorage 캐시 직접 사용
  → API 호출 0회!
```

**예상 API 사용량:**
- 일 방문자 1,000명
- API 호출: 약 144회/일 (10분마다 1회)
- YouTube Data API 무료 할당량: 10,000/일
- **사용률: 1.44%** ✅

### 이미지 최적화

**제품 이미지:**
- 권장 크기: 800x800px
- 권장 포맷: WebP (또는 JPG)
- 권장 용량: < 100KB

**YouTube 썸네일:**
- 자동 최적화 (YouTube 제공)
- Lazy Loading 적용됨

---

## 문제 해결

### YouTube API 할당량 초과

**증상:**
```json
{
  "status": "error",
  "message": "quotaExceeded"
}
```

**해결:**
1. Google Apps Script 캐시 시간 증가:
   ```javascript
   cache.put(cacheKey, JSON.stringify(videos), 600); // 10분
   // →
   cache.put(cacheKey, JSON.stringify(videos), 3600); // 1시간
   ```

2. 클라이언트 캐시 시간 증가:
   ```javascript
   cacheDuration: 24 * 60 * 60 * 1000, // 24시간
   // →
   cacheDuration: 48 * 60 * 60 * 1000, // 48시간
   ```

### CORS 에러

**증상:**
```
Access to fetch at '...' has been blocked by CORS policy
```

**해결:**
1. Google Apps Script 배포 확인:
   - "액세스 권한: 모든 사용자" 인지 확인

2. Google Apps Script 재배포:
   - 배포 > 배포 관리 > 새 배포

### 제품 이미지 깨짐

**증상:**
- 제품 이미지가 표시되지 않음
- Console에 404 에러

**해결:**
1. 이미지 경로 확인:
   ```json
   "image": "/design/jewoo/products/p1001.jpg"
   ```

2. 메이크샵에 이미지 업로드 확인:
   - FTP 또는 메이크샵 관리자 > 이미지 관리

---

## 다음 단계

1. [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) 참고
2. YouTube 영상 설명에 제품 코드 추가
3. 매주 새 영상 업로드 및 자동 반영 확인

---

**작성일**: 2026-02-06
**버전**: 1.0
