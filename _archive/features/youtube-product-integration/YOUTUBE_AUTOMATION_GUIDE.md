# YouTube-제품 자동화 가이드

YouTube 영상과 제품을 자동으로 연동하는 방법을 정리한 문서입니다.

---

## 1. 제품 매칭 방법 (3단계)

### 1순위: 제품 코드 파싱 (권장)

YouTube 영상 설명에 제품 코드를 추가하면 자동으로 매칭됩니다.

**형식:**
```
[제품코드: P1001]
```

**예시 (YouTube 영상 설명):**
```
압화 스타터 키트 언박싱 영상입니다.

[제품코드: P1001]

이 영상에서 사용한 재료:
- 압화 액자
- 프레스 도구
- 압화용 꽃
```

**JavaScript 파싱 로직:**
```javascript
function parseProductCode(description) {
  if (!description) return null;

  // 정규식: [제품코드: P1001] 형식 파싱
  var pattern = /\[제품코드:\s*([A-Z0-9]+)\]/;
  var match = description.match(pattern);
  return match ? match[1] : null;
}
```

**장점:**
- 정확도 100%
- 수동 작업 최소화 (영상 업로드 시 한 번만 추가)
- 10-15분 후 자동 반영

---

### 2순위: 키워드 매칭

영상 제목이나 설명에 키워드가 포함되면 자동 매칭됩니다.

**product-mapping.json 설정:**
```json
{
  "keywords": {
    "압화 스타터": ["P1001"],
    "투명 표본": ["P1002"],
    "레진 몰드": ["P1003"],
    "하바리움 오일": ["P1004"]
  }
}
```

**JavaScript 매칭 로직:**
```javascript
function matchByKeywords(title, description) {
  var text = (title + ' ' + (description || '')).toLowerCase();

  for (var keyword in mappingData.keywords) {
    if (text.indexOf(keyword.toLowerCase()) >= 0) {
      var productCodes = mappingData.keywords[keyword];
      if (productCodes && productCodes.length > 0) {
        return mappingData.products[productCodes[0]];
      }
    }
  }
  return null;
}
```

**장점:**
- 기존 영상에도 적용 가능
- 제품 코드 없어도 매칭

**단점:**
- 키워드 중복 시 오매칭 가능
- 키워드 목록 유지보수 필요

---

### 3순위: 매칭 실패 시

제품 코드도 없고 키워드도 매칭되지 않으면 영상만 표시합니다.

```javascript
function matchProduct(video) {
  // 1순위: 제품 코드
  var productCode = parseProductCode(video.description);
  if (productCode && mappingData.products[productCode]) {
    return mappingData.products[productCode];
  }

  // 2순위: 키워드
  var keywordProduct = matchByKeywords(video.title, video.description);
  if (keywordProduct) {
    return keywordProduct;
  }

  // 3순위: 매칭 실패 (영상만 표시)
  return null;
}
```

---

## 2. 캐싱 전략

### 클라이언트 캐싱 (LocalStorage)

```javascript
var CONFIG = {
  cacheDuration: 24 * 60 * 60 * 1000  // 24시간
};

var CACHE_KEY = 'youtube_hybrid_videos_cache';
var CACHE_TIME_KEY = 'youtube_hybrid_cache_time';

// 캐시 확인
var cachedData = localStorage.getItem(CACHE_KEY);
var cacheTime = localStorage.getItem(CACHE_TIME_KEY);
var now = Date.now();

if (cachedData && cacheTime && (now - parseInt(cacheTime)) < CONFIG.cacheDuration) {
  // 캐시 사용
  var videos = JSON.parse(cachedData);
  renderLayout(videos);
} else {
  // API 호출
  fetchFromAPI();
}

// 캐시 저장
localStorage.setItem(CACHE_KEY, JSON.stringify(videos));
localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
```

### 서버 캐싱 (Google Apps Script)

```javascript
// youtube-proxy-v2.gs
function getLatestVideosWithCache(channelId, maxResults) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'videos_v2_' + channelId + '_' + maxResults;

  var cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // API 호출
  var videos = fetchFromYouTubeAPI(channelId, maxResults);

  // 10분 캐시
  cache.put(cacheKey, JSON.stringify(videos), 600);

  return videos;
}
```

### 캐시 삭제 방법

**브라우저 콘솔에서:**
```javascript
// 하이브리드 레이아웃 캐시 삭제
clearYouTubeHybridCache();

// 또는 수동 삭제
localStorage.removeItem('youtube_hybrid_videos_cache');
localStorage.removeItem('youtube_hybrid_cache_time');
location.reload();
```

---

## 3. NEW 배지 로직

3일 이내 업로드된 영상에 NEW 배지를 표시합니다.

```javascript
var CONFIG = {
  newVideoDays: 3  // NEW 배지 기준 일수
};

function isNewVideo(publishedAt) {
  var published = new Date(publishedAt);
  var now = new Date();
  var diffDays = Math.floor((now - published) / (1000 * 60 * 60 * 24));
  return diffDays <= CONFIG.newVideoDays;
}

// 사용
if (isNewVideo(video.publishedAt)) {
  html += '<span class="badge badge-new">NEW</span>';
}
```

---

## 4. 조회수 포맷팅

```javascript
function formatViewCount(viewCount) {
  var count = parseInt(viewCount);

  if (isNaN(count) || count === 0) {
    return '조회수 집계 중';
  }

  if (count >= 10000) {
    return (count / 10000).toFixed(1) + '만 조회';
  }

  return count.toLocaleString('ko-KR') + ' 조회';
}

// 예시:
// 15000 → "1.5만 조회"
// 5432 → "5,432 조회"
// 0 → "조회수 집계 중"
```

---

## 5. 날짜 포맷팅

```javascript
function formatDate(date) {
  var now = new Date();
  var diffTime = now - date;
  var diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return diffDays + '일 전';
  if (diffDays < 30) return Math.floor(diffDays / 7) + '주 전';

  // 30일 이상
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  var day = date.getDate();
  return year + '년 ' + month + '월 ' + day + '일';
}
```

---

## 6. product-mapping.json 구조

```json
{
  "version": "1.0",
  "lastUpdated": "2026-02-06",
  "products": {
    "P1001": {
      "name": "압화 스타터 키트",
      "price": "35000",
      "image": "/design/jewoo/products/p1001.jpg",
      "link": "/shop/shopdetail.html?branduid=1001"
    },
    "P1002": {
      "name": "투명 식물 표본",
      "price": "42000",
      "image": "/design/jewoo/products/p1002.jpg",
      "link": "/shop/shopdetail.html?branduid=1002"
    }
  },
  "keywords": {
    "압화 스타터": ["P1001"],
    "투명 표본": ["P1002"],
    "스타터 키트": ["P1001"],
    "식물표본": ["P1002"]
  }
}
```

### 제품 추가 방법

1. `products` 섹션에 새 제품 추가
2. `keywords` 섹션에 관련 키워드 추가
3. FTP로 파일 업로드
4. 캐시 삭제 후 확인

---

## 7. Google Apps Script 설정

### 배포 URL 구조
```
https://script.google.com/macros/s/{SCRIPT_ID}/exec?count=5
```

### API 응답 형식
```json
{
  "status": "success",
  "items": [
    {
      "id": "videoId123",
      "title": "영상 제목",
      "description": "영상 설명\n[제품코드: P1001]",
      "publishedAt": "2026-02-05T10:30:00Z",
      "thumbnail": "https://i.ytimg.com/vi/videoId123/mqdefault.jpg",
      "viewCount": "15000"
    }
  ],
  "count": 5,
  "timestamp": "2026-02-06T12:00:00Z"
}
```

---

## 8. 자동화 워크플로우

```
┌─────────────────────────────────────────────────────────┐
│  YouTube 영상 업로드                                     │
│  ↓                                                       │
│  영상 설명에 [제품코드: P1001] 추가                      │
│  ↓                                                       │
│  10-15분 후 YouTube RSS 업데이트                         │
│  ↓                                                       │
│  Google Apps Script가 RSS + API로 영상 정보 조회         │
│  ↓                                                       │
│  클라이언트가 데이터 로드 (캐시 만료 시)                 │
│  ↓                                                       │
│  JavaScript가 제품 코드 파싱                             │
│  ↓                                                       │
│  product-mapping.json에서 제품 정보 조회                 │
│  ↓                                                       │
│  영상 + 제품 정보 함께 표시                              │
└─────────────────────────────────────────────────────────┘
```

---

## 9. 디버그 방법

### 디버그 모드 활성화
```javascript
// 브라우저 콘솔에서
enableYouTubeHybridDebug();
```

### 로그 확인
```
[Hybrid] 초기화 시작
[Mapping] 데이터 로드 완료: 10개 제품
[YouTube] 캐시 사용
[Match] 제품 코드 매칭: P1001
[Match] 키워드 매칭 성공
[Match] 매칭 실패: videoId123
[Hybrid] 레이아웃 렌더링 완료
```

---

## 10. 에러 처리

### API 호출 실패 시
```javascript
error: function(xhr, status, error) {
  console.error('[YouTube] API 호출 실패:', error);
  showErrorMessage();  // fallback 메시지 표시
}
```

### 매핑 데이터 로드 실패 시
```javascript
error: function(xhr, status, error) {
  console.log('[Mapping] 데이터 로드 실패, 제품 연동 없이 진행');
  resolve();  // 에러가 아닌 정상 진행 (영상만 표시)
}
```

---

## 11. 메이크샵 배포 경로

```
/design/jewoo/youtube-product-integration/
├── youtube-product-hybrid.css
├── youtube-product-hybrid.js
└── product-mapping.json
```

### JS 파일 설정 변경 (배포 시)
```javascript
var CONFIG = {
  // 로컬 테스트: 'product-mapping.json'
  // 메이크샵 배포:
  mappingDataUrl: '/design/jewoo/youtube-product-integration/product-mapping.json',
};
```

---

**작성일**: 2026-02-06
**버전**: 1.0
