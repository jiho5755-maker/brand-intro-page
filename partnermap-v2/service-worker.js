const CACHE_NAME = 'fresco21-partnermap-v1.0.0';
const RUNTIME_CACHE = 'runtime-cache-v1';

// 오프라인 캐시할 리소스
const STATIC_RESOURCES = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './images/default-logo.jpg',
  './manifest.webmanifest',
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css'
];

// 설치 이벤트: 정적 리소스 캐싱
self.addEventListener('install', function(event) {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('[Service Worker] Caching static resources');
        return cache.addAll(STATIC_RESOURCES);
      })
      .then(function() {
        console.log('[Service Worker] Skip waiting');
        return self.skipWaiting();
      })
      .catch(function(error) {
        console.error('[Service Worker] Installation failed:', error);
      })
  );
});

// 활성화 이벤트: 오래된 캐시 삭제
self.addEventListener('activate', function(event) {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(function() {
        console.log('[Service Worker] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch 이벤트: 캐싱 전략
self.addEventListener('fetch', function(event) {
  const request = event.request;
  const url = new URL(request.url);

  // API 요청은 항상 네트워크 우선 (캐시는 폴백)
  if (url.hostname.includes('script.google.com') ||
      url.hostname.includes('oapi.map.naver.com')) {
    event.respondWith(
      fetch(request)
        .then(function(response) {
          // API 응답 캐싱
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then(function(cache) {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(function() {
          // 네트워크 실패 시 캐시에서 가져오기
          return caches.match(request);
        })
    );
    return;
  }

  // 정적 리소스는 Cache-First 전략
  event.respondWith(
    caches.match(request)
      .then(function(cachedResponse) {
        if (cachedResponse) {
          // 캐시에 있으면 즉시 반환
          return cachedResponse;
        }

        // 캐시에 없으면 네트워크에서 가져오고 캐싱
        return fetch(request).then(function(response) {
          // 유효한 응답만 캐싱
          if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then(function(cache) {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
      .catch(function(error) {
        console.error('[Service Worker] Fetch failed:', error);
        // 오프라인 폴백 페이지 (선택적)
        return new Response('오프라인 상태입니다. 인터넷 연결을 확인해주세요.', {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
  );
});

// 메시지 이벤트: 캐시 업데이트 등
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
