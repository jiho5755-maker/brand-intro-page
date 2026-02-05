/*
 * =============================================
 * YouTube-Product Integration v1.0
 * =============================================
 *
 * YouTube 영상과 제품을 자동으로 연결하는 시스템
 *
 * 기능:
 * - YouTube 영상 자동 로드 (Google Apps Script 프록시)
 * - 24시간 클라이언트 캐싱
 * - NEW 배지 (3일 이내 최신 영상)
 * - 조회수 표시 (1.5만 조회 형식)
 * - 제품 자동 매칭 (제품 코드 파싱 + 키워드 매칭)
 * - 소셜 공유 (카카오톡, 페이스북)
 * - 에러 처리 및 fallback
 *
 * 기반 코드: YouTube-자동화-성공본/메이크샵-유튜브자동화.js
 * =============================================
 */

(function() {
  'use strict';

  // =============================================
  // 설정
  // =============================================

  var CONFIG = {
    // Google Apps Script 배포 URL (기존 YouTube 자동화 사용)
    googleScriptUrl: 'https://script.google.com/macros/s/AKfycbxNQxgd8Ew0oClPSIoSA3vbtbf4LoOyHL6j7J1cXSyI1gmaL3ya6teTwmu883js4zSkwg/exec',

    // 제품 매핑 데이터 파일 경로
    mappingDataUrl: '/design/jewoo/youtube-product-integration/product-mapping.json',

    // 표시할 영상 개수
    maxVideos: 4,

    // 캐시 유지 시간 (24시간)
    cacheDuration: 24 * 60 * 60 * 1000,

    // NEW 배지 기준 (3일 이내)
    newVideoDays: 3,

    // 디버그 모드 (console.log 활성화)
    debug: false
  };

  // 전역 변수
  var mappingData = null;

  // =============================================
  // 초기화
  // =============================================

  function init() {
    log('[YouTube-Product] 초기화 시작');

    // 설정 검증
    if (CONFIG.googleScriptUrl.indexOf('YOUR_SCRIPT_ID') >= 0) {
      console.error('[YouTube-Product] Google Apps Script URL을 설정하세요!');
      showErrorMessage('설정 오류: Google Apps Script URL을 설정해야 합니다.');
      return;
    }

    // 매핑 데이터 로드 → YouTube 영상 로드
    loadMappingData()
      .then(function() {
        return loadYouTubeVideos();
      })
      .catch(function(error) {
        console.error('[YouTube-Product] 초기화 실패:', error);
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
            reject(new Error('매핑 데이터 형식이 올바르지 않습니다'));
            return;
          }

          mappingData = data;
          var productCount = Object.keys(data.products).length;
          log('[Mapping] 데이터 로드 완료: ' + productCount + '개 제품');
          resolve();
        },
        error: function(xhr, status, error) {
          console.error('[Mapping] 데이터 로드 실패:', error);
          // 매핑 데이터 없어도 영상은 표시
          log('[Mapping] 매핑 데이터 없이 진행 (제품 연동 없음)');
          resolve();
        }
      });
    });
  }

  // =============================================
  // YouTube 영상 로드 (캐싱 적용)
  // =============================================

  function loadYouTubeVideos() {
    var CACHE_KEY = 'youtube_product_videos_cache';
    var CACHE_TIME_KEY = 'youtube_product_cache_time';

    // 캐시 확인
    try {
      var cachedData = localStorage.getItem(CACHE_KEY);
      var cacheTime = localStorage.getItem(CACHE_TIME_KEY);
      var now = Date.now();

      // 캐시가 있고 유효하면 사용
      if (cachedData && cacheTime && (now - parseInt(cacheTime)) < CONFIG.cacheDuration) {
        log('[YouTube] 캐시 사용 (마지막 업데이트: ' +
            new Date(parseInt(cacheTime)).toLocaleString('ko-KR') + ')');
        var videos = JSON.parse(cachedData);
        displayVideos(videos);
        return Promise.resolve();
      }
    } catch (e) {
      log('[YouTube] 캐시 확인 실패, 새로 로드');
    }

    // API 호출
    log('[YouTube] Google Apps Script로 영상 로드 시작');
    var apiUrl = CONFIG.googleScriptUrl + '?count=' + CONFIG.maxVideos + '&t=' + Date.now();

    // 로딩 메시지 표시
    showLoadingMessage();

    return new Promise(function(resolve, reject) {
      jQuery.ajax({
        url: apiUrl,
        dataType: 'json',
        cache: false,
        timeout: 10000,
        success: function(data) {
          if (data.status === 'success' && data.items && data.items.length > 0) {
            log('[YouTube] ' + data.items.length + '개 영상 로드 성공');

            // 캐시 저장
            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify(data.items));
              localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
              log('[YouTube] 캐시 저장 완료 (다음 업데이트: 24시간 후)');
            } catch (e) {
              log('[YouTube] 캐시 저장 실패 (LocalStorage 용량 부족?)');
            }

            displayVideos(data.items);
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
  // 영상 표시
  // =============================================

  function displayVideos(videos) {
    var container = document.getElementById('youtube-product-grid');
    if (!container) {
      console.error('[YouTube] youtube-product-grid 컨테이너를 찾을 수 없습니다');
      return;
    }

    container.innerHTML = '';
    container.className = 'video-grid';

    for (var i = 0; i < videos.length; i++) {
      var video = videos[i];
      var videoCard = createVideoCard(video);
      container.appendChild(videoCard);
    }

    log('[YouTube] 모든 영상 표시 완료');
  }

  // =============================================
  // 비디오 카드 생성
  // =============================================

  function createVideoCard(video) {
    var card = document.createElement('div');
    card.className = 'video-card';
    card.setAttribute('data-video-id', video.id);

    var html = '';

    // NEW 배지
    if (isNewVideo(video.publishedAt)) {
      html += '<span class="badge badge-new">NEW</span>';
    }

    // 영상 썸네일
    html += '<div class="video-thumbnail">';
    html += '  <iframe ';
    html += '    width="560" height="315" ';
    html += '    src="https://www.youtube.com/embed/' + video.id + '?rel=0&modestbranding=1" ';
    html += '    title="' + escapeHtml(video.title) + '" ';
    html += '    frameborder="0" ';
    html += '    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ';
    html += '    allowfullscreen ';
    html += '    loading="lazy">';
    html += '  </iframe>';
    html += '</div>';

    // 영상 정보
    html += '<div class="video-info">';
    html += '  <h4 class="video-title">' + escapeHtml(truncateTitle(video.title)) + '</h4>';
    html += '  <div class="video-meta">';
    html += '    <span class="view-count">' + formatViewCount(video.viewCount) + '</span>';
    html += '    <span class="published-date">' + formatDate(new Date(video.publishedAt)) + '</span>';
    html += '  </div>';
    html += '</div>';

    // 제품 정보 (매칭 성공 시)
    var product = matchProduct(video);
    if (product) {
      html += createProductSection(product);
    }

    // 소셜 공유 기능 비활성화 (필요시 주석 해제)
    // html += createSocialShare(video);

    card.innerHTML = html;
    return card;
  }

  // =============================================
  // 제품 매칭 (3단계)
  // =============================================

  function matchProduct(video) {
    if (!mappingData) {
      return null;
    }

    // 1순위: 제품 코드 파싱
    var productCode = parseProductCode(video.description);
    if (productCode && mappingData.products[productCode]) {
      log('[Match] 제품 코드 매칭: ' + productCode + ' → ' + mappingData.products[productCode].name);
      return mappingData.products[productCode];
    }

    // 2순위: 키워드 매칭
    var keywordProduct = matchByKeywords(video.title, video.description);
    if (keywordProduct) {
      log('[Match] 키워드 매칭: ' + keywordProduct.name);
      return keywordProduct;
    }

    // 매칭 실패 (에러 아님)
    log('[Match] 매칭 실패: ' + video.id);
    return null;
  }

  // 제품 코드 파싱
  function parseProductCode(description) {
    if (!description) return null;

    var pattern = /\[제품코드:\s*([A-Z0-9]+)\]/;
    var match = description.match(pattern);
    return match ? match[1] : null;
  }

  // 키워드 매칭
  function matchByKeywords(title, description) {
    if (!mappingData || !mappingData.keywords) return null;

    var text = (title + ' ' + (description || '')).toLowerCase();

    // 키워드 검색
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
  // 제품 섹션 생성
  // =============================================

  function createProductSection(product) {
    var html = '<div class="product-info">';
    html += '  <div class="product-thumbnail">';
    html += '    <img src="' + product.image + '" alt="' + escapeHtml(product.name) + '" loading="lazy">';
    html += '  </div>';
    html += '  <div class="product-details">';
    html += '    <p class="product-name">' + escapeHtml(product.name) + '</p>';
    html += '    <p class="product-price">' + formatPrice(product.price) + '원</p>';
    html += '  </div>';
    html += '  <a href="' + product.link + '" class="btn btn-product">';
    html += '    관련 제품 보기';
    html += '  </a>';
    html += '</div>';
    return html;
  }

  // =============================================
  // 소셜 공유 섹션
  // =============================================

  function createSocialShare(video) {
    var videoUrl = 'https://www.youtube.com/watch?v=' + video.id;
    var videoId = video.id;
    var videoTitle = escapeHtml(video.title).replace(/'/g, "\\'");

    var html = '<div class="social-share">';
    html += '  <button class="btn-share btn-kakao" onclick="window.shareToKakao(\'' +
            videoId + '\', \'' + videoTitle + '\', \'' + videoUrl + '\')">';
    html += '    카톡 공유';
    html += '  </button>';
    html += '  <button class="btn-share btn-facebook" onclick="window.shareToFacebook(\'' +
            videoUrl + '\')">';
    html += '    페북 공유';
    html += '  </button>';
    html += '</div>';
    return html;
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

  function showLoadingMessage() {
    var container = document.getElementById('youtube-product-grid');
    if (container) {
      container.innerHTML =
        '<div class="loading-message">' +
          '<div class="spinner"></div>' +
          '<p>최신 영상을 불러오는 중...</p>' +
        '</div>';
    }
  }

  function showErrorMessage(customMessage) {
    var container = document.getElementById('youtube-product-grid');
    if (container) {
      var message = customMessage ||
        '<p>최신 영상을 불러오는 중입니다</p>' +
        '<p><a href="https://www.youtube.com/channel/UCOt_7gyvjqHBw304hU4-FUw" target="_blank">YouTube 채널에서 직접 보기</a></p>';

      container.innerHTML =
        '<div class="error-message">' +
          message +
        '</div>';
    }
  }

  // =============================================
  // 전역 함수 (소셜 공유용)
  // =============================================

  window.shareToKakao = function(videoId, videoTitle, videoUrl) {
    if (typeof Kakao === 'undefined') {
      alert('카카오 SDK가 로드되지 않았습니다.\n메이크샵 관리자에서 카카오 앱 키를 확인하세요.');
      return;
    }

    if (!Kakao.isInitialized()) {
      alert('카카오 SDK가 초기화되지 않았습니다.\n메이크샵 관리자에서 카카오 앱 키를 확인하세요.');
      return;
    }

    try {
      Kakao.Link.sendDefault({
        objectType: 'feed',
        content: {
          title: videoTitle,
          description: 'pressco21 압화 작업 영상을 확인해보세요!',
          imageUrl: 'https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg',
          link: {
            mobileWebUrl: videoUrl,
            webUrl: videoUrl
          }
        },
        buttons: [
          {
            title: '영상 보기',
            link: {
              mobileWebUrl: videoUrl,
              webUrl: videoUrl
            }
          }
        ]
      });
    } catch (error) {
      console.error('[Kakao] 공유 실패:', error);
      alert('카카오톡 공유에 실패했습니다.\n' + error.message);
    }
  };

  window.shareToFacebook = function(videoUrl) {
    var fbUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(videoUrl);
    var windowFeatures = 'width=600,height=400,menubar=no,toolbar=no,location=no';
    window.open(fbUrl, 'facebook-share', windowFeatures);
  };

  // =============================================
  // DOM 로드 시 초기화
  // =============================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 디버그 모드 활성화 (브라우저 콘솔에서 실행)
  window.enableYouTubeProductDebug = function() {
    CONFIG.debug = true;
    console.log('[YouTube-Product] 디버그 모드 활성화');
  };

  // 캐시 삭제 (브라우저 콘솔에서 실행)
  window.clearYouTubeProductCache = function() {
    localStorage.removeItem('youtube_product_videos_cache');
    localStorage.removeItem('youtube_product_cache_time');
    console.log('[YouTube-Product] 캐시 삭제 완료. 페이지를 새로고침하세요.');
    location.reload();
  };

})();
