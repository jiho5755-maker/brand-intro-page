/*
 * =============================================
 * YouTube-Product Hybrid Layout v1.0
 * =============================================
 *
 * 하이브리드 레이아웃:
 * - 메인 영역: 최신 영상 1개 (크게) + 연결된 제품 정보
 * - 하단: 나머지 영상 썸네일 4개 (클릭 시 메인으로 이동)
 *
 * 기능:
 * - YouTube 영상 자동 로드 (Google Apps Script 프록시)
 * - 24시간 클라이언트 캐싱
 * - NEW 배지 (3일 이내 최신 영상)
 * - 조회수 표시
 * - 제품 자동 매칭
 * - 썸네일 클릭 시 메인 영상 교체
 *
 * =============================================
 */

(function() {
  'use strict';

  // =============================================
  // 설정
  // =============================================

  var CONFIG = {
    // Google Apps Script 배포 URL
    googleScriptUrl: 'https://script.google.com/macros/s/AKfycbxNQxgd8Ew0oClPSIoSA3vbtbf4LoOyHL6j7J1cXSyI1gmaL3ya6teTwmu883js4zSkwg/exec',

    // 제품 매핑 데이터 파일 경로
    // 로컬 테스트: 'product-mapping.json'
    // 메이크샵 배포: '/design/jewoo/youtube-product-integration/product-mapping.json'
    mappingDataUrl: 'product-mapping.json',

    // 표시할 영상 개수 (메인 1개 + 하단 4개 = 5개)
    maxVideos: 5,

    // 캐시 유지 시간 (24시간)
    cacheDuration: 24 * 60 * 60 * 1000,

    // NEW 배지 기준 (3일 이내)
    newVideoDays: 3,

    // 디버그 모드
    debug: true
  };

  // 전역 변수
  var mappingData = null;
  var allVideos = [];
  var currentMainIndex = 0;

  // =============================================
  // 초기화
  // =============================================

  function init() {
    log('[Hybrid] 초기화 시작');

    loadMappingData()
      .then(function() {
        return loadYouTubeVideos();
      })
      .catch(function(error) {
        console.error('[Hybrid] 초기화 실패:', error);
        showErrorMessage();
      });
  }

  // =============================================
  // 매핑 데이터 로드
  // =============================================

  function loadMappingData() {
    return new Promise(function(resolve, reject) {
      log('[Mapping] 데이터 로드 시작');

      jQuery.ajax({
        url: CONFIG.mappingDataUrl,
        dataType: 'json',
        cache: true,
        timeout: 5000,
        success: function(data) {
          if (!data || !data.products) {
            log('[Mapping] 데이터 형식 오류, 제품 연동 없이 진행');
            resolve();
            return;
          }

          mappingData = data;
          var productCount = Object.keys(data.products).length;
          log('[Mapping] 데이터 로드 완료: ' + productCount + '개 제품');
          resolve();
        },
        error: function(xhr, status, error) {
          log('[Mapping] 데이터 로드 실패, 제품 연동 없이 진행');
          resolve();
        }
      });
    });
  }

  // =============================================
  // YouTube 영상 로드 (캐싱 적용)
  // =============================================

  function loadYouTubeVideos() {
    var CACHE_KEY = 'youtube_hybrid_videos_cache';
    var CACHE_TIME_KEY = 'youtube_hybrid_cache_time';

    // 캐시 확인
    try {
      var cachedData = localStorage.getItem(CACHE_KEY);
      var cacheTime = localStorage.getItem(CACHE_TIME_KEY);
      var now = Date.now();

      if (cachedData && cacheTime && (now - parseInt(cacheTime)) < CONFIG.cacheDuration) {
        log('[YouTube] 캐시 사용');
        allVideos = JSON.parse(cachedData);
        renderLayout();
        return Promise.resolve();
      }
    } catch (e) {
      log('[YouTube] 캐시 확인 실패');
    }

    // API 호출
    log('[YouTube] API 호출 시작');
    var apiUrl = CONFIG.googleScriptUrl + '?count=' + CONFIG.maxVideos + '&t=' + Date.now();

    return new Promise(function(resolve, reject) {
      jQuery.ajax({
        url: apiUrl,
        dataType: 'json',
        cache: false,
        timeout: 15000,
        success: function(data) {
          if (data.status === 'success' && data.items && data.items.length > 0) {
            log('[YouTube] ' + data.items.length + '개 영상 로드 성공');

            // 캐시 저장
            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify(data.items));
              localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
            } catch (e) {
              log('[YouTube] 캐시 저장 실패');
            }

            allVideos = data.items;
            renderLayout();
            resolve();
          } else {
            reject(new Error('영상 데이터 없음'));
          }
        },
        error: function(xhr, status, error) {
          console.error('[YouTube] API 호출 실패:', error);
          reject(error);
        }
      });
    });
  }

  // =============================================
  // 레이아웃 렌더링
  // =============================================

  function renderLayout() {
    if (allVideos.length === 0) {
      showErrorMessage();
      return;
    }

    renderMainArea(allVideos[currentMainIndex]);
    renderMoreVideos();
    log('[Hybrid] 레이아웃 렌더링 완료');
  }

  // =============================================
  // 메인 영역 렌더링
  // =============================================

  function renderMainArea(video) {
    var container = document.getElementById('youtube-main-area');
    if (!container) return;

    var html = '';

    // 메인 영상
    html += '<div class="main-video">';

    // NEW 배지
    if (isNewVideo(video.publishedAt)) {
      html += '<span class="badge badge-new">NEW</span>';
    }

    // 영상 iframe
    html += '<div class="video-wrapper">';
    html += '  <iframe ';
    html += '    src="https://www.youtube.com/embed/' + video.id + '?rel=0&modestbranding=1" ';
    html += '    title="' + escapeHtml(video.title) + '" ';
    html += '    frameborder="0" ';
    html += '    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ';
    html += '    allowfullscreen ';
    html += '    loading="lazy">';
    html += '  </iframe>';
    html += '</div>';

    // 영상 정보
    html += '<div class="main-video-info">';
    html += '  <h3 class="main-video-title">' + escapeHtml(video.title) + '</h3>';
    html += '  <div class="main-video-meta">';
    html += '    <span class="view-count">' + formatViewCount(video.viewCount) + '</span>';
    html += '    <span class="published-date">' + formatDate(new Date(video.publishedAt)) + '</span>';
    html += '  </div>';
    html += '</div>';
    html += '</div>';

    // 제품 사이드바
    html += '<div class="product-sidebar">';
    html += '  <div class="product-sidebar-header">영상 속 제품</div>';

    var product = matchProduct(video);
    if (product) {
      html += '  <div class="product-card">';
      html += '    <div class="product-card-image">';
      html += '      <img src="' + product.image + '" alt="' + escapeHtml(product.name) + '" loading="lazy">';
      html += '    </div>';
      html += '    <div class="product-card-info">';
      html += '      <p class="product-card-name">' + escapeHtml(product.name) + '</p>';
      html += '      <p class="product-card-price">' + formatPrice(product.price) + '원</p>';
      html += '      <a href="' + product.link + '" class="btn-product">제품 보기</a>';
      html += '    </div>';
      html += '  </div>';
    } else {
      html += '  <div class="no-product-message">';
      html += '    <p>이 영상의 관련 제품 정보가<br>준비 중입니다.</p>';
      html += '  </div>';
    }

    html += '</div>';

    container.innerHTML = html;
  }

  // =============================================
  // 더 많은 영상 렌더링
  // =============================================

  function renderMoreVideos() {
    var container = document.getElementById('youtube-more-videos');
    if (!container) return;

    container.innerHTML = '';

    // 메인 영상 제외한 나머지 (최대 4개)
    var count = 0;
    for (var i = 0; i < allVideos.length && count < 4; i++) {
      if (i === currentMainIndex) continue;

      var video = allVideos[i];
      var card = createThumbnailCard(video, i);
      container.appendChild(card);
      count++;
    }
  }

  // =============================================
  // 썸네일 카드 생성
  // =============================================

  function createThumbnailCard(video, index) {
    var card = document.createElement('div');
    card.className = 'thumbnail-card';
    card.setAttribute('data-index', index);

    var html = '';

    // NEW 배지
    if (isNewVideo(video.publishedAt)) {
      html += '<span class="badge badge-new">NEW</span>';
    }

    // 썸네일 이미지
    html += '<div class="thumb-wrapper">';
    html += '  <img src="https://img.youtube.com/vi/' + video.id + '/mqdefault.jpg" ';
    html += '       alt="' + escapeHtml(video.title) + '" loading="lazy">';
    html += '  <div class="play-button"></div>';
    html += '  <div class="thumb-overlay">';
    html += '    <p class="thumb-title">' + escapeHtml(truncateTitle(video.title, 40)) + '</p>';
    html += '  </div>';
    html += '</div>';

    card.innerHTML = html;

    // 클릭 이벤트: 메인 영상으로 교체
    card.addEventListener('click', function() {
      currentMainIndex = index;
      renderLayout();

      // 스크롤 이동
      var mainArea = document.getElementById('youtube-main-area');
      if (mainArea) {
        mainArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    return card;
  }

  // =============================================
  // 제품 매칭
  // =============================================

  function matchProduct(video) {
    if (!mappingData) return null;

    // 1순위: 제품 코드 파싱
    var productCode = parseProductCode(video.description);
    if (productCode && mappingData.products[productCode]) {
      log('[Match] 제품 코드 매칭: ' + productCode);
      return mappingData.products[productCode];
    }

    // 2순위: 키워드 매칭
    var keywordProduct = matchByKeywords(video.title, video.description);
    if (keywordProduct) {
      log('[Match] 키워드 매칭 성공');
      return keywordProduct;
    }

    log('[Match] 매칭 실패: ' + video.id);
    return null;
  }

  function parseProductCode(description) {
    if (!description) return null;
    var pattern = /\[제품코드:\s*([A-Z0-9]+)\]/;
    var match = description.match(pattern);
    return match ? match[1] : null;
  }

  function matchByKeywords(title, description) {
    if (!mappingData || !mappingData.keywords) return null;

    var text = (title + ' ' + (description || '')).toLowerCase();

    for (var keyword in mappingData.keywords) {
      if (mappingData.keywords.hasOwnProperty(keyword)) {
        if (text.indexOf(keyword.toLowerCase()) >= 0) {
          var productCodes = mappingData.keywords[keyword];
          if (productCodes && productCodes.length > 0) {
            var productCode = productCodes[0];
            if (mappingData.products[productCode]) {
              return mappingData.products[productCode];
            }
          }
        }
      }
    }

    return null;
  }

  // =============================================
  // 유틸리티 함수
  // =============================================

  function isNewVideo(publishedAt) {
    var published = new Date(publishedAt);
    var now = new Date();
    var diffDays = Math.floor((now - published) / (1000 * 60 * 60 * 24));
    return diffDays <= CONFIG.newVideoDays;
  }

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

  function formatDate(date) {
    var now = new Date();
    var diffTime = now - date;
    var diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return diffDays + '일 전';
    if (diffDays < 30) return Math.floor(diffDays / 7) + '주 전';

    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    return year + '년 ' + month + '월 ' + day + '일';
  }

  function formatPrice(price) {
    return parseInt(price).toLocaleString('ko-KR');
  }

  function truncateTitle(title, maxLength) {
    maxLength = maxLength || 50;
    if (title && title.length > maxLength) {
      return title.substring(0, maxLength) + '...';
    }
    return title;
  }

  function escapeHtml(text) {
    if (!text) return '';
    var map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }

  function log(message) {
    if (CONFIG.debug) {
      console.log(message);
    }
  }

  // =============================================
  // 메시지 표시
  // =============================================

  function showErrorMessage() {
    var container = document.getElementById('youtube-main-area');
    if (container) {
      container.innerHTML =
        '<div class="error-message" style="width:100%">' +
          '<p>최신 영상을 불러오는 중입니다</p>' +
          '<p><a href="https://www.youtube.com/channel/UCOt_7gyvjqHBw304hU4-FUw" target="_blank">YouTube 채널에서 직접 보기</a></p>' +
        '</div>';
    }

    var moreContainer = document.getElementById('youtube-more-videos');
    if (moreContainer) {
      moreContainer.style.display = 'none';
    }
  }

  // =============================================
  // DOM 로드 시 초기화
  // =============================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 디버그 모드 활성화
  window.enableYouTubeHybridDebug = function() {
    CONFIG.debug = true;
    console.log('[Hybrid] 디버그 모드 활성화');
  };

  // 캐시 삭제
  window.clearYouTubeHybridCache = function() {
    localStorage.removeItem('youtube_hybrid_videos_cache');
    localStorage.removeItem('youtube_hybrid_cache_time');
    console.log('[Hybrid] 캐시 삭제 완료. 새로고침합니다.');
    location.reload();
  };

})();
