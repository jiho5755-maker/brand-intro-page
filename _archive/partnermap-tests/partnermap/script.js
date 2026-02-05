// 전역 설정 변수
var NAVER_MAP_NCP_KEY_ID = 'bfp8odep5r';
var GOOGLE_SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbxfp4SbpsUCmQu0gnF02r8oMY0dzzadElkcTcFNSsxPNo3x4zsNcw-z8MvJ3F7xskP6Yw/exec';
var CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간 캐싱
var DEBUG_MODE = false;

// URLSearchParams Polyfill (메이크샵 호환성)
if (typeof URLSearchParams === 'undefined') {
  window.URLSearchParams = function(search) {
    var self = this;
    self.params = {};
    if (search) {
      search.substring(1).split('&').forEach(function(pair) {
        var parts = pair.split('=');
        self.params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || '');
      });
    }
    self.get = function(key) { return self.params[key] || null; };
    self.set = function(key, value) { self.params[key] = value; };
    self.toString = function() {
      return Object.keys(self.params).map(function(k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(self.params[k]);
      }).join('&');
    };
  };
}

// 네이버 지도 API 로드 (병렬 처리)
(function() {
  var retryCount = 0;
  var maxRetries = 3;
  var retryDelay = 2000;
  
  function loadNaverMapAPI() {
    var existingScript = document.querySelector('script[src*="map.naver.com"]');
    if (existingScript) existingScript.remove();
    
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=' + NAVER_MAP_NCP_KEY_ID + '&t=' + Date.now();
    script.async = true;
    
    script.onerror = function() {
      retryCount++;
      if (retryCount < maxRetries) {
        setTimeout(loadNaverMapAPI, retryDelay);
      } else {
        window.naverMapLoadError = true;
        if (window.showMapLoadError) window.showMapLoadError();
      }
    };
    
    script.onload = function() {
      window.naverMapLoaded = true;
      window.naverMapLoadError = false;
      if (window.pendingMapInit) window.pendingMapInit();
      if (typeof tryInitMap === 'function') tryInitMap();
    };
    
    document.head.appendChild(script);
  }
  
  loadNaverMapAPI();
})();

// 전역 변수
var partnersData = [];
var filteredPartnersData = [];
var map = null;
var markers = [];
var infowindows = [];
var currentInfoWindow = null;
var currentFilters = { region: 'all', category: 'all', association: 'all', partnerType: 'all' };
var userLocation = null;
var favorites = [];
var searchQuery = '';
var sortBy = 'name';
var mapStyle = 'normal';
var idleListenerRef = null;  // idle 이벤트 리스너 참조 (중복 스택 방지)
var isFirstLoad = true;      // 첫 로드 여부 (fitBounds 조건부 실행)
var currentLocationMarker = null;  // 현재 위치 마커 (GPS)
var clusterMarkers = [];           // 클러스터 마커 목록
var CLUSTER_ZOOM = 10;             // zoom ≤ 이 값이면 클러스터링 활성화
var pendingPartnerFocus = null;    // URL param ?partner= 자동 포커스 대기

// 파트너 유형 색상 매핑 (프레스코21 브랜드 컬러 #7d9675 기반 톤온톤)
var partnerTypeColors = {
  '협회': { class: 'association', color: '#5a7fa8' }, // 브랜드 컬러와 조화로운 파란색 계열
  '인플루언서': { class: 'influencer', color: '#c9a961' } // 브랜드 컬러와 조화로운 금색 계열
};

// 유틸리티 함수
function escapeHtml(text) {
  if (!text) return '';
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLng/2) * Math.sin(dLng/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function formatDistance(km) {
  if (km < 1) return Math.round(km * 1000) + 'm';
  return km.toFixed(1) + 'km';
}

function splitData(text) {
  if (!text || text.trim() === '') return [];
  return text.split(/[,|\n]+/).map(function(item) {
    return item.trim();
  }).filter(function(item) {
    return item !== '';
  });
}

// 파트너 유형 뱃지 HTML 생성
function createPartnerTypeBadges(partnerTypes) {
  if (!partnerTypes || !Array.isArray(partnerTypes) || partnerTypes.length === 0) {
    return '';
  }
  
  var badges = partnerTypes.map(function(type) {
    var typeInfo = partnerTypeColors[type] || { class: 'other', color: '#999' };
    return '<span class="partner-type-badge ' + typeInfo.class + '">' + escapeHtml(type) + '</span>';
  }).join('');
  
  return '<div class="partner-type-badges">' + badges + '</div>';
}

// 파트너가 특정 유형을 가지고 있는지 확인
function hasPartnerType(partner, type) {
  if (!partner.partnerType || !Array.isArray(partner.partnerType)) {
    return false;
  }
  return partner.partnerType.indexOf(type) > -1;
}

// 인플루언서인지 확인
function isInfluencer(partner) {
  return hasPartnerType(partner, '인플루언서');
}

// 카테고리별 이모지 폴백 (리스트 카드 미리보기용)
function getCategoryEmoji(category) {
  var map = {
    '도자기': '🏺', '도자': '🏺', '세라믹': '🏺', '도자기공예': '🏺',
    '목공': '🪵', '목공예': '🪵',
    '금속공예': '⚙️', '금속': '⚙️',
    '가죽공예': '👜', '가죽': '👜',
    '회화': '🎨', '그림': '🎨', '공예': '🎨',
    '비단': '🧵', '자수': '🧵',
    '한지': '📜', '종이공예': '📜',
    '조각': '🗿', '석조': '🗿',
    '도예': '🏺', '도예공예': '🏺',
    '보구에': '💐', '꽃': '💐', '꽃공예': '💐'
  };
  if (!category) return '🏢';
  var cats = splitData(category);
  for (var i = 0; i < cats.length; i++) {
    if (map[cats[i]]) return map[cats[i]];
  }
  return '🏢';
}

// 운영 상태 파싱 및 현재 영업 여부 확인
function parseAndCheckHours(hoursStr) {
  if (!hoursStr || hoursStr.trim() === '') return null;
  if (/휴업|폐점/.test(hoursStr)) return { isOpen: false };
  var match = hoursStr.match(/(\d{1,2}):(\d{2})\s*[~\-\u2013]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  var now = new Date();
  var nowMinutes = now.getHours() * 60 + now.getMinutes();
  var openMinutes = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  var closeMinutes = parseInt(match[3], 10) * 60 + parseInt(match[4], 10);
  return { isOpen: nowMinutes >= openMinutes && nowMinutes < closeMinutes };
}

// 운영 상태 뱃지 HTML 생성
function createOperatingStatusBadge(hours) {
  var status = parseAndCheckHours(hours);
  if (!status) return '';
  var isOpen = status.isOpen;
  return '<span class="partner-map-operating-status ' + (isOpen ? 'partner-map-status-open' : 'partner-map-status-closed') + '">' + (isOpen ? '영업 중' : '영업 종료') + '</span>';
}

// 파트너 공유 URL 복사
function sharePartnerUrl(partnerName) {
  var url = window.location.pathname + '?partner=' + encodeURIComponent(partnerName);
  var fullUrl = window.location.origin + url;
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(fullUrl).then(function() {
      showShareToast();
    }).catch(function() {
      fallbackCopyToClipboard(fullUrl);
    });
  } else {
    fallbackCopyToClipboard(fullUrl);
  }
}

function fallbackCopyToClipboard(text) {
  var textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  showShareToast();
}

function showShareToast() {
  var container = document.getElementById('partner-map-container');
  if (!container) return;
  var toast = document.getElementById('partner-map-share-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'partner-map-share-toast';
    toast.className = 'partner-map-share-toast';
    toast.textContent = '📌 공유 링크가 복사되었습니다!';
    container.appendChild(toast);
  }
  toast.classList.add('show');
  setTimeout(function() { toast.classList.remove('show'); }, 2000);
}

function getUrlParams() {
  var params = {};
  var search = window.location.search.substring(1);
  if (search) {
    search.split('&').forEach(function(pair) {
      var parts = pair.split('=');
      params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || '');
    });
  }
  return params;
}

function setUrlParams(params) {
  var pairs = [];
  Object.keys(params).forEach(function(key) {
    if (params[key] && params[key] !== 'all' && params[key] !== '') {
      pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
    }
  });
  var newUrl = window.location.pathname + (pairs.length > 0 ? '?' + pairs.join('&') : '');
  window.history.replaceState({}, '', newUrl);
}

// 캐싱 함수
function getCachedData() {
  try {
    var cached = localStorage.getItem('partner_map_cache');
    var cacheTime = localStorage.getItem('partner_map_cache_time');
    if (cached && cacheTime) {
      var age = Date.now() - parseInt(cacheTime);
      if (age < CACHE_TTL) {
        return JSON.parse(cached);
      }
    }
  } catch (e) {
    console.error('캐시 읽기 실패:', e);
  }
  return null;
}

function setCachedData(data) {
  try {
    localStorage.setItem('partner_map_cache', JSON.stringify(data));
    localStorage.setItem('partner_map_cache_time', Date.now().toString());
  } catch (e) {
    console.error('캐시 저장 실패:', e);
  }
}

// 즐겨찾기 함수
function loadFavorites() {
  try {
    var stored = localStorage.getItem('partner_favorites');
    favorites = stored ? JSON.parse(stored) : [];
    updateFavoritesCount();
  } catch (e) {
    favorites = [];
  }
}

function saveFavorites() {
  try {
    localStorage.setItem('partner_favorites', JSON.stringify(favorites));
    updateFavoritesCount();
  } catch (e) {
    console.error('즐겨찾기 저장 실패:', e);
  }
}

function toggleFavorite(partnerName) {
  var index = favorites.indexOf(partnerName);
  if (index > -1) {
    favorites.splice(index, 1);
  } else {
    favorites.push(partnerName);
  }
  saveFavorites();
  renderPartnerList();
}

function isFavorite(partnerName) {
  return favorites.indexOf(partnerName) > -1;
}

function updateFavoritesCount() {
  var countEl = document.getElementById('partner-map-favorites-count');
  if (countEl) {
    countEl.textContent = '(' + favorites.length + ')';
  }
}

// 상태 표시 함수
function showStatus(type, title, message) {
  var notice = document.getElementById('partner-map-status');
  if (!notice) return;
  
  notice.className = 'partner-map-status ' + type + ' show';
  notice.innerHTML = '<h3>' + title + '</h3><p>' + message + '</p>';
}

function hideStatus() {
  var notice = document.getElementById('partner-map-status');
  if (notice) {
    notice.style.display = 'none';
  }
}

// 데이터 로드 (캐싱 적용)
function loadPartnersData() {
  // 캐시 확인
  var cached = getCachedData();
  if (cached) {
    // 캐시된 데이터의 partnerType 배열 처리 (하위 호환성)
    partnersData = cached.map(function(partner) {
      if (partner.partnerType && typeof partner.partnerType === 'string') {
        partner.partnerType = splitData(partner.partnerType);
      }
      if (!partner.partnerType || !Array.isArray(partner.partnerType)) {
        partner.partnerType = [];
      }
      return partner;
    });
    filteredPartnersData = partnersData;
    initializeFilters();
    hideStatus();
    if (map) createMarkers();
    return;
  }
  
  showStatus('loading', '데이터를 불러오는 중입니다...', '잠시만 기다려주세요.');
  
  fetch(GOOGLE_SHEET_API_URL)
    .then(function(response) {
      if (!response.ok) {
        throw new Error('API 응답 오류 (HTTP ' + response.status + ')');
      }
      return response.json();
    })
    .then(function(data) {
      if (data.error || data.success === false) {
        throw new Error(data.message || '알 수 없는 오류가 발생했습니다.');
      }
      
      if (!data.partners || !Array.isArray(data.partners)) {
        throw new Error('잘못된 데이터 형식: partners 배열이 없습니다.');
      }
      
      if (data.partners.length === 0) {
        showStatus('error', '표시할 업체가 없습니다', '구글 시트에 승인된 업체가 없습니다.');
        return;
      }
      
      // 데이터 모델 업데이트: partnerType 배열 처리
      partnersData = data.partners.map(function(partner) {
        // partnerType이 문자열인 경우 배열로 변환
        if (partner.partnerType && typeof partner.partnerType === 'string') {
          partner.partnerType = splitData(partner.partnerType);
        }
        // partnerType이 없거나 빈 배열인 경우 빈 배열로 설정
        if (!partner.partnerType || !Array.isArray(partner.partnerType)) {
          partner.partnerType = [];
        }
        return partner;
      });
      
      filteredPartnersData = partnersData;
      
      // 캐시 저장 (partnerType 배열 포함)
      setCachedData(partnersData);
      
      initializeFilters();
      hideStatus();
      
      if (map) {
        createMarkers();
        // URL param ?partner= 자동 포커스
        if (pendingPartnerFocus) {
          var targetName = pendingPartnerFocus;
          pendingPartnerFocus = null;
          setTimeout(function() {
            for (var j = 0; j < partnersData.length; j++) {
              if (partnersData[j].name === targetName) { focusOnPartner(partnersData[j]); break; }
            }
          }, 600);
        }
      }
    })
    .catch(function(error) {
      console.error('데이터 로드 실패:', error);
      showStatus('error', '데이터를 불러올 수 없습니다', error.message);
    });
}

// 지도 초기화
function initMap() {
  try {
    document.getElementById('partner-map-loading').classList.add('hidden');
    
    var mapOptions = {
      center: new naver.maps.LatLng(37.5665, 126.9780),
      zoom: 11,
      zoomControl: true,
      zoomControlOptions: { position: naver.maps.Position.TOP_RIGHT },
      mapTypeControl: true
    };
    
    map = new naver.maps.Map('partner-map', mapOptions);
    
    if (partnersData.length > 0) {
      createMarkers();
    }
  } catch (error) {
    console.error('지도 초기화 실패:', error);
    document.getElementById('partner-map-loading').innerHTML = 
      '<div style="color: #F44336; text-align: center; padding: 20px;">' +
      '<div style="font-size: 18px; font-weight: 600; margin-bottom: 12px;">지도를 불러올 수 없습니다</div>' +
      '<div style="font-size: 14px; color: #666;">네이버 지도 API 설정을 확인해주세요</div>' +
      '</div>';
  }
}

// 필터 초기화
function extractRegion(address) {
  if (!address) return '기타';
  var match = address.match(/^([^시도군구]+[시도])/);
  if (match) return match[1];
  match = address.match(/^(서울|부산|대구|인천|광주|대전|울산|세종)/);
  if (match) return match[1];
  return '기타';
}

function initializeFilters() {
  var regions = new Set();
  var categories = new Set();
  var associations = new Set();
  var partnerTypes = new Set();
  
  partnersData.forEach(function(partner) {
    regions.add(extractRegion(partner.address));
    if (partner.category) {
      splitData(partner.category).forEach(function(cat) {
        if (cat) categories.add(cat);
      });
    }
    if (partner.association) {
      splitData(partner.association).forEach(function(assoc) {
        if (assoc) associations.add(assoc);
      });
    }
    // partnerType 배열 처리
    if (partner.partnerType && Array.isArray(partner.partnerType)) {
      partner.partnerType.forEach(function(type) {
        if (type && type.trim() !== '') {
          partnerTypes.add(type.trim());
        }
      });
    }
  });
  
  // 필터 버튼 생성
  createFilterButtons('region', regions, 'partner-map-region-filters');
  createFilterButtons('category', categories, 'partner-map-category-filters');
  createFilterButtons('association', associations, 'partner-map-association-filters');
  createFilterButtons('partnerType', partnerTypes, 'partner-map-partner-type-filters');
  
  updatePartnerCount();
}

function createFilterButtons(type, items, containerId) {
  var container = document.getElementById(containerId);
  container.innerHTML = '<button class="partner-map-filter-btn active" data-value="all">전체</button>';
  
  Array.from(items).sort().forEach(function(item) {
    var btn = document.createElement('button');
    btn.className = 'partner-map-filter-btn';
    btn.setAttribute('data-value', item);
    btn.textContent = item;
    btn.onclick = function() { setFilter(type, item); };
    container.appendChild(btn);
  });
  
  container.querySelector('[data-value="all"]').onclick = function() { setFilter(type, 'all'); };
}

function setFilter(filterType, value) {
  currentFilters[filterType] = value;
  
  var containerId = 'partner-map-' + filterType + '-filters';
  var buttons = document.getElementById(containerId).querySelectorAll('.partner-map-filter-btn');
  buttons.forEach(function(btn) {
    if (btn.getAttribute('data-value') === value) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  applyFilters();
}

function applyFilters() {
  filteredPartnersData = partnersData.filter(function(partner) {
    if (searchQuery) {
      var q = searchQuery.toLowerCase();
      var searchTarget = [
        partner.name || '',
        partner.category || '',
        partner.address || '',
        partner.detailAddress || '',
        partner.description || ''
      ].join(' ').toLowerCase();
      if (searchTarget.indexOf(q) === -1) return false;
    }
    
    if (currentFilters.region !== 'all') {
      if (extractRegion(partner.address) !== currentFilters.region) return false;
    }
    
    if (currentFilters.category !== 'all') {
      var cats = splitData(partner.category);
      if (cats.indexOf(currentFilters.category) === -1) return false;
    }
    
    if (currentFilters.association !== 'all') {
      var assocs = splitData(partner.association);
      if (assocs.indexOf(currentFilters.association) === -1) return false;
    }
    
    // 파트너 유형 필터 정교화: 해당 유형을 하나라도 가진 업체 필터링
    if (currentFilters.partnerType !== 'all') {
      // partnerType이 배열이고, 선택한 유형을 포함하는지 확인
      if (!partner.partnerType || !Array.isArray(partner.partnerType) || 
          partner.partnerType.length === 0) {
        return false; // partnerType이 없으면 제외
      }
      // 배열에 선택한 유형이 포함되어 있는지 확인
      var hasType = partner.partnerType.some(function(type) {
        return type && type.trim() === currentFilters.partnerType;
      });
      if (!hasType) return false;
    }
    
    return true;
  });
  
  var favBtn = document.getElementById('partner-map-btn-favorites');
  if (favBtn && favBtn.classList.contains('active')) {
    filteredPartnersData = filteredPartnersData.filter(function(partner) {
      return isFavorite(partner.name);
    });
  }
  
  sortPartners();
  createMarkers();
  renderPartnerList();
  updatePartnerCount();
  
  setUrlParams({
    region: currentFilters.region,
    category: currentFilters.category,
    association: currentFilters.association,
    partnerType: currentFilters.partnerType,
    search: searchQuery
  });
}

function updatePartnerCount() {
  var countElement = document.getElementById('partner-map-total-count');
  if (countElement) {
    countElement.textContent = filteredPartnersData.length;
  }
}

function sortPartners() {
  if (sortBy === 'distance' && userLocation) {
    filteredPartnersData.sort(function(a, b) {
      var distA = calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng);
      var distB = calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng);
      return distA - distB;
    });
  } else {
    filteredPartnersData.sort(function(a, b) {
      return (a.name || '').localeCompare(b.name || '');
    });
  }
}

function renderPartnerList() {
  var container = document.getElementById('partner-map-items');
  if (!container) return;
  
  container.innerHTML = '';
  
  // 필터링 결과가 없을 때 안내 문구 표시
  if (filteredPartnersData.length === 0) {
    container.innerHTML = 
      '<div class="partner-map-empty-state">' +
      '<div class="partner-map-empty-state-icon">🔍</div>' +
      '<div class="partner-map-empty-state-title">조건에 맞는 파트너를 찾지 못했습니다</div>' +
      '<div class="partner-map-empty-state-message">다른 필터를 선택해 보세요</div>' +
      '<button class="partner-map-empty-state-btn" onclick="resetAllFilters()">전체 보기</button>' +
      '</div>';
    return;
  }
  
  filteredPartnersData.forEach(function(partner) {
    var item = document.createElement('div');
    item.className = 'partner-map-item';
    if (isFavorite(partner.name)) {
      item.classList.add('favorited');
    }
    
    var distance = '';
    if (userLocation) {
      var dist = calculateDistance(userLocation.lat, userLocation.lng, partner.lat, partner.lng);
      distance = '<span class="partner-map-item-distance">' + formatDistance(dist) + '</span>';
    }
    
    var categories = splitData(partner.category).slice(0, 2).join(', ');
    if (splitData(partner.category).length > 2) categories += '...';
    
    // 파트너 유형 뱃지 추가
    var partnerTypeBadges = createPartnerTypeBadges(partner.partnerType);

    // 리스트 카드 이미지 미리보기
    var imgUrl = convertGoogleDriveUrl(partner.imageUrl);
    var thumbnailHTML = imgUrl
      ? '<img src="' + escapeHtml(imgUrl) + '" class="partner-map-item-thumbnail" alt="' + escapeHtml(partner.name) + '" loading="lazy">'
      : '<div class="partner-map-item-thumbnail partner-map-item-thumbnail-fallback">' + getCategoryEmoji(partner.category) + '</div>';

    item.innerHTML =
      thumbnailHTML +
      '<div class="partner-map-item-content">' +
      '<div class="partner-map-item-header">' +
      '<div class="partner-map-item-name" style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">' +
      escapeHtml(partner.name) +
      partnerTypeBadges +
      '</div>' +
      '<div class="partner-map-item-favorite ' + (isFavorite(partner.name) ? 'active' : '') + '" ' +
      'data-name="' + escapeHtml(partner.name) + '">★</div>' +
      '</div>' +
      '<div class="partner-map-item-info">' +
      createOperatingStatusBadge(partner.hours) +
      distance +
      '<span class="partner-map-item-category">' + escapeHtml(categories || '공방') + '</span>' +
      '</div>' +
      '</div>';
    
    item.onclick = function(e) {
      if (!e.target.classList.contains('partner-map-item-favorite')) {
        focusOnPartner(partner);
      }
    };
    
    var favBtn = item.querySelector('.partner-map-item-favorite');
    favBtn.onclick = function(e) {
      e.stopPropagation();
      toggleFavorite(partner.name);
    };
    
    container.appendChild(item);
  });
}

// 전체 필터 리셋 함수
window.resetAllFilters = function() {
  currentFilters = { region: 'all', category: 'all', association: 'all', partnerType: 'all' };
  searchQuery = '';
  var searchInput = document.getElementById('partner-map-search-input');
  if (searchInput) searchInput.value = '';
  
  // 모든 필터 버튼 리셋
  document.querySelectorAll('.partner-map-filter-btn').forEach(function(btn) {
    if (btn.getAttribute('data-value') === 'all') {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  applyFilters();
};

function focusOnPartner(partner) {
  if (!map) return;
  
  var position = new naver.maps.LatLng(partner.lat, partner.lng);
  map.setCenter(position);
  map.setZoom(16);
  
  markers.forEach(function(item) {
    if (item.partner.name === partner.name) {
      naver.maps.Event.trigger(item.marker, 'click');
    }
  });
}

// Viewport 기반 마커 관리 (성능 최적화)
var visibleMarkers = [];
var markerVisibilityMap = {};

// Viewport 내 마커 표시 + 클러스터링 통합
function updateMarkerVisibility() {
  if (!map) return;

  var bounds = map.getBounds();
  if (!bounds) return;
  var zoom = map.getZoom();

  // 기존 클러스터 마커 제거
  clusterMarkers.forEach(function(m) { m.setMap(null); });
  clusterMarkers = [];

  if (zoom <= CLUSTER_ZOOM) {
    // === 클러스터 모드 ===
    var visible = [];
    markers.forEach(function(item) {
      if (bounds.hasLatLng(item.marker.getPosition())) {
        visible.push(item);
      }
      item.marker.setMap(null); // 개별 마커는 모두 숨김
    });

    var clusters = computeClusters(visible, zoom);
    clusters.forEach(function(cluster) {
      if (cluster.length === 1) {
        cluster[0].marker.setMap(map); // 단일 마커는 그대로 표시
      } else {
        createClusterMarker(cluster);  // 클러스터 마커 생성
      }
    });
  } else {
    // === 일반 모드: Viewport 기반 가시성 ===
    markers.forEach(function(item) {
      var inBounds = bounds.hasLatLng(item.marker.getPosition());
      if (inBounds && !item.marker.getMap()) {
        item.marker.setMap(map);
      } else if (!inBounds && item.marker.getMap()) {
        item.marker.setMap(null);
      }
    });
  }
}

// 클러스터 그룹핑 (거리 기반 단일 링크)
function computeClusters(visibleMarkers, zoom) {
  var thresholdKm = Math.pow(2, 12 - zoom) * 0.3; // zoom별 클러스터 반경 (km)
  var used = {};
  var clusters = [];

  for (var i = 0; i < visibleMarkers.length; i++) {
    if (used[i]) continue;
    var cluster = [visibleMarkers[i]];
    used[i] = true;

    for (var j = i + 1; j < visibleMarkers.length; j++) {
      if (used[j]) continue;
      var dist = calculateDistance(
        visibleMarkers[i].partner.lat, visibleMarkers[i].partner.lng,
        visibleMarkers[j].partner.lat, visibleMarkers[j].partner.lng
      );
      if (dist <= thresholdKm) {
        cluster.push(visibleMarkers[j]);
        used[j] = true;
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

// 클러스터 마커 생성
function createClusterMarker(cluster) {
  var totalLat = 0, totalLng = 0;
  cluster.forEach(function(item) {
    totalLat += item.partner.lat;
    totalLng += item.partner.lng;
  });
  var position = new naver.maps.LatLng(totalLat / cluster.length, totalLng / cluster.length);
  var count = cluster.length;
  var size = 36 + Math.min(count, 8) * 3; // 클러스터 크기는 개수에 비례

  var marker = new naver.maps.Marker({
    position: position,
    map: map,
    icon: {
      content: '<div class="partner-map-cluster-marker" style="width:' + size + 'px;height:' + size + 'px;font-size:' + (size > 46 ? 16 : 14) + 'px;">' + count + '</div>',
      anchor: new naver.maps.Point(size / 2, size / 2)
    }
  });

  // 클릭 시 해당 클러스터 영역으로 줄이기
  naver.maps.Event.addListener(marker, 'click', function() {
    var clusterBounds = new naver.maps.LatLngBounds();
    cluster.forEach(function(item) {
      clusterBounds.extend(new naver.maps.LatLng(item.partner.lat, item.partner.lng));
    });
    map.fitBounds(clusterBounds, { padding: 60 });
  });

  clusterMarkers.push(marker);
}

// 현재 위치 마커 추가/업데이트 (GPS)
function addCurrentLocationMarker(position) {
  if (currentLocationMarker) {
    currentLocationMarker.setMap(null);
    currentLocationMarker = null;
  }
  currentLocationMarker = new naver.maps.Marker({
    position: position,
    map: map,
    icon: {
      content: '<div class="partner-map-current-location-marker"><div class="partner-map-current-location-dot"></div></div>',
      anchor: new naver.maps.Point(20, 20)
    }
  });
}

// 마커 생성 (Viewport 기반 최적화)
function createMarkers() {
  markers.forEach(function(item) {
    item.marker.setMap(null);
  });
  markers = [];
  infowindows = [];
  visibleMarkers = [];
  markerVisibilityMap = {};
  
  if (!map || typeof naver === 'undefined' || !naver.maps) {
    console.error('네이버 지도 API가 로드되지 않았습니다.');
    return;
  }
  
  var bounds = new naver.maps.LatLngBounds();
  var createdCount = 0;
  var initialBounds = map.getBounds();
  
  filteredPartnersData.forEach(function(partner) {
    if (!partner.lat || !partner.lng || partner.lat === 0 || partner.lng === 0) {
      return;
    }
    
    var position = new naver.maps.LatLng(partner.lat, partner.lng);
    bounds.extend(position);
    
    // 인플루언서인지 확인
    var isInfluencerPartner = isInfluencer(partner);
    var isAssociationPartner = hasPartnerType(partner, '협회');
    
    // 마커 아이콘 생성 (브랜드 컬러 기반)
    var markerBgColor = '#7d9675'; // 기본 브랜드 컬러
    var markerTextColor = 'white';
    
    if (isInfluencerPartner) {
      markerBgColor = '#c9a961'; // 브랜드 컬러와 조화로운 금색
      markerTextColor = '#2c3e30'; // 어두운 텍스트
    } else if (isAssociationPartner) {
      markerBgColor = '#5a7fa8'; // 브랜드 컬러와 조화로운 파란색
      markerTextColor = 'white';
    }
    
    // 인플루언서 마커에 Pulse 애니메이션 추가
    var markerContent = '<div class="marker-wrapper" style="position: relative; display: inline-block; transform: translate(-50%, -100%);">';
    if (isInfluencerPartner) {
      markerContent += '<div class="marker-pulse-ring marker-pulse-ring-1"></div>';
      markerContent += '<div class="marker-pulse-ring marker-pulse-ring-2"></div>';
      markerContent += '<div class="marker-pulse-ring marker-pulse-ring-3"></div>';
    }
    markerContent += '<div class="marker-content" style="background: ' + markerBgColor + '; color: ' + markerTextColor + '; padding: 8px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; box-shadow: 0 5px 25px rgba(0,0,0,0.15); white-space: nowrap; cursor: pointer; border: 2px solid white; font-family: \'Pretendard\', \'Noto Sans KR\', sans-serif; position: relative; z-index: 10;">' + escapeHtml(partner.name) + '</div>';
    markerContent += '</div>';
    
    var marker = new naver.maps.Marker({
      position: position,
      map: null, // 초기에는 숨김
      title: partner.name,
      icon: {
        content: markerContent,
        anchor: new naver.maps.Point(0, 0)
      }
    });
    
    // 초기 Viewport 내에 있으면 표시
    if (initialBounds && initialBounds.hasLatLng(position)) {
      marker.setMap(map);
      visibleMarkers.push({ marker: marker, partner: partner });
    }
    
    var infoContent = createInfoWindowHTML(partner);
    
    var infowindow = new naver.maps.InfoWindow({
      content: infoContent,
      backgroundColor: 'transparent',
      borderWidth: 0,
      disableAnchor: true,
      pixelOffset: new naver.maps.Point(0, -10),
      maxWidth: 340
    });
    
    naver.maps.Event.addListener(marker, 'click', function() {
      infowindows.forEach(function(iw) { iw.close(); });
      infowindow.open(map, marker);
      currentInfoWindow = infowindow;
      map.panTo(position);
    });
    
    markers.push({ marker: marker, partner: partner, infowindow: infowindow });
    infowindows.push(infowindow);
    createdCount++;
  });
  
  if (createdCount > 0) {
    // fitBounds는 첫 로드 시만 실행 (이후 필터 변경 시 현재 뷰 유지)
    if (isFirstLoad) {
      map.fitBounds(bounds, { padding: 50 });
      isFirstLoad = false;
    }

    // idle 이벤트 리스너: 기존 리스너 제거 후 재추가 (중복 스택 방지)
    if (idleListenerRef) {
      naver.maps.Event.removeListener(idleListenerRef);
      idleListenerRef = null;
    }
    idleListenerRef = naver.maps.Event.addListener(map, 'idle', function() {
      updateMarkerVisibility();
    });

    // 초기 마커 가시성 업데이트
    setTimeout(function() {
      updateMarkerVisibility();
    }, 500);
  }
}

function createInfoWindowHTML(partner) {
  var imageUrl = convertGoogleDriveUrl(partner.imageUrl);
  var imageHTML = imageUrl ? 
    '<img src="' + escapeHtml(imageUrl) + '" class="partner-map-infowindow-image" alt="' + escapeHtml(partner.name) + '" loading="lazy">' :
    '<div class="partner-map-infowindow-image" style="display: flex; align-items: center; justify-content: center; color: #999; font-size: 48px;">🏢</div>';
  
  var fullAddress = partner.address;
  if (partner.detailAddress && partner.detailAddress.trim() !== '') {
    fullAddress += ' ' + partner.detailAddress;
  }
  
  var hoursHTML = '';
  if (partner.hours && partner.hours.trim() !== '') {
    hoursHTML = '<div class="partner-map-infowindow-detail-item">' +
                createOperatingStatusBadge(partner.hours) +
                '<span>🕐</span> ' + escapeHtml(partner.hours) +
                '</div>';
  }
  
  var phoneButtonHTML = '';
  if (partner.phone && partner.phone.trim() !== '') {
    var phoneLink = partner.phone.trim().replace(/[^0-9]/g, '');
    phoneButtonHTML = '<a href="tel:' + escapeHtml(phoneLink) + '" class="partner-map-infowindow-btn secondary">📞 전화</a>';
  }
  
  var navigationHTML = '';
  if (partner.lat && partner.lng) {
    var naverMapUrl = 'https://map.naver.com/v5/directions/-/-/-/car?c=' + partner.lng + ',' + partner.lat + ',15,0,0,0,dh';
    navigationHTML = '<a href="' + naverMapUrl + '" target="_blank" class="partner-map-infowindow-btn">🗺️ 길찾기</a>';
  }
  
  var categoryDisplay = partner.category || '제휴업체';
  var categories = splitData(categoryDisplay);
  if (categories.length > 2) {
    categoryDisplay = categories.slice(0, 2).join(', ') + '...';
  } else if (categories.length > 0) {
    categoryDisplay = categories.join(', ');
  }
  
  // 파트너 유형 뱃지 추가
  var partnerTypeBadges = createPartnerTypeBadges(partner.partnerType);
  
  var html = '<div class="partner-map-infowindow">' +
              imageHTML +
              '<div class="partner-map-infowindow-content">' +
              '<div class="partner-map-infowindow-header">' +
              '<div style="flex: 1; display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">' +
              '<h3 class="partner-map-infowindow-name" style="margin: 0;">' + escapeHtml(partner.name) + '</h3>' +
              partnerTypeBadges +
              '</div>' +
              '<span class="partner-map-infowindow-badge">' + escapeHtml(categoryDisplay) + '</span>' +
              '</div>';
  
  if (partner.description && partner.description.trim() !== '') {
    html += '<p class="partner-map-infowindow-description">' + escapeHtml(partner.description) + '</p>';
  }
  
  html += '<div class="partner-map-infowindow-details">' +
          '<div class="partner-map-infowindow-detail-item">' +
          '<span>📍</span> ' + escapeHtml(fullAddress) +
          '</div>' +
          hoursHTML +
          '</div>' +
          '<div class="partner-map-infowindow-actions">' +
          phoneButtonHTML +
          navigationHTML +
          '<button class="partner-map-infowindow-btn secondary partner-map-share-btn" data-partner-name="' + escapeHtml(partner.name) + '">📤 공유</button>' +
          '<button class="partner-map-infowindow-btn secondary partner-map-detail-btn" data-partner-name="' + escapeHtml(partner.name) + '">📄 상세보기</button>' +
          '</div>' +
          '</div>' +
          '</div>';
  
  return html;
}

function convertGoogleDriveUrl(url) {
  if (!url || url.trim() === '') return null;
  var trimmedUrl = url.trim();
  if (trimmedUrl.includes('drive.google.com/uc?') || trimmedUrl.includes('lh3.googleusercontent.com')) {
    return trimmedUrl;
  }
  var fileId = null;
  var match1 = trimmedUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match1) {
    fileId = match1[1];
  } else {
    var match2 = trimmedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match2) fileId = match2[1];
  }
  if (fileId) {
    return 'https://drive.google.com/uc?export=view&id=' + fileId;
  }
  return trimmedUrl;
}

window.showPartnerDetailModal = function(partnerName) {
  var partner = partnersData.find(function(p) { return p.name === partnerName; });
  if (!partner) return;
  
  var modal = document.getElementById('partner-map-modal');
  var title = document.getElementById('partner-map-modal-title');
  var body = document.getElementById('partner-map-modal-body');
  
  if (!modal || !title || !body) return;
  
  title.textContent = partner.name;
  
  var imageUrl = convertGoogleDriveUrl(partner.imageUrl);
  var fullAddress = partner.address;
  if (partner.detailAddress) fullAddress += ' ' + partner.detailAddress;
  
  var categories = splitData(partner.category).join(', ') || '공방';
  var associations = splitData(partner.association).join(', ') || '-';
  var partnerTypeBadges = createPartnerTypeBadges(partner.partnerType);
  var isAssociationPartner = hasPartnerType(partner, '협회');
  var naverMapUrl = 'https://map.naver.com/v5/directions/-/-/-/car?c=' + partner.lng + ',' + partner.lat + ',15,0,0,0,dh';
  
  // 인스타그램 URL (독립 필드 우선, 없으면 description에서 추출)
  var instagramUrl = '';
  if (partner.instagram) {
    instagramUrl = partner.instagram;
  } else if (partner.description) {
    var instagramMatch = partner.description.match(/instagram\.com\/([a-zA-Z0-9_.]+)/i);
    if (instagramMatch) {
      instagramUrl = 'https://instagram.com/' + instagramMatch[1];
    }
  }
  
  // 배너 이미지
  var bannerHTML = imageUrl ? 
    '<div class="partner-map-modal-banner" style="background-image: url(\'' + escapeHtml(imageUrl) + '\');"></div>' :
    '<div class="partner-map-modal-banner" style="background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-dark) 100%);"></div>';
  
  // 협회 파트너 신뢰 박스
  var trustBoxHTML = '';
  if (isAssociationPartner) {
    trustBoxHTML = '<div class="partner-map-modal-trust-box">' +
      '<i data-lucide="award" class="trust-icon"></i>' +
      '<div class="trust-content">' +
      '<div class="trust-title">프레스코21 인증 협회</div>' +
      '<div class="trust-subtitle">공식 인증된 협회 파트너입니다</div>' +
      '</div>' +
      '</div>';
  }
  
  body.innerHTML = bannerHTML +
    '<div class="partner-map-modal-body-content">' +
    trustBoxHTML +
    '<div class="partner-map-modal-header-section">' +
    '<h3 class="partner-map-modal-partner-name">' + escapeHtml(partner.name) + '</h3>' +
    '<div class="partner-map-modal-badges">' + partnerTypeBadges + '</div>' +
    '</div>' +
    
    '<div class="partner-map-modal-section">' +
    '<div class="partner-map-modal-section-header">' +
    '<i data-lucide="info" class="section-icon"></i>' +
    '<div class="partner-map-modal-section-title">공식 파트너 소개</div>' +
    '</div>' +
    '<div class="partner-map-modal-section-content">' +
    '<p class="partner-map-modal-description">' + escapeHtml(partner.description || '소개가 없습니다.') + '</p>' +
    '<div class="partner-map-modal-info-grid">' +
    '<div class="partner-map-modal-info-item">' +
    '<span class="info-label">카테고리</span>' +
    '<span class="info-value">' + escapeHtml(categories) + '</span>' +
    '</div>' +
    (associations !== '-' ? '<div class="partner-map-modal-info-item">' +
    '<span class="info-label">협회</span>' +
    '<span class="info-value">' + escapeHtml(associations) + '</span>' +
    '</div>' : '') +
    '</div>' +
    '</div>' +
    '</div>' +
    
    '<div class="partner-map-modal-section">' +
    '<div class="partner-map-modal-section-header">' +
    '<i data-lucide="map-pin" class="section-icon"></i>' +
    '<div class="partner-map-modal-section-title">운영 정보</div>' +
    '</div>' +
    '<div class="partner-map-modal-section-content">' +
    '<div class="partner-map-modal-detail-item">' +
    '<i data-lucide="map-pin" class="detail-icon"></i>' +
    '<div class="detail-content">' +
    '<div class="detail-label">주소</div>' +
    '<div class="detail-value">' + escapeHtml(fullAddress) + '</div>' +
    '</div>' +
    '</div>' +
    (partner.phone ? '<div class="partner-map-modal-detail-item">' +
    '<i data-lucide="phone" class="detail-icon"></i>' +
    '<div class="detail-content">' +
    '<div class="detail-label">전화</div>' +
    '<div class="detail-value">' + escapeHtml(partner.phone) + '</div>' +
    '</div>' +
    '</div>' : '') +
    (partner.hours ? '<div class="partner-map-modal-detail-item">' +
    '<i data-lucide="clock" class="detail-icon"></i>' +
    '<div class="detail-content">' +
    '<div class="detail-label">운영시간</div>' +
    '<div class="detail-value">' + createOperatingStatusBadge(partner.hours) + ' ' + escapeHtml(partner.hours) + '</div>' +
    '</div>' +
    '</div>' : '') +
    '</div>' +
    '</div>' +
    
    '<div class="partner-map-modal-actions">' +
    (instagramUrl ? '<a href="' + escapeHtml(instagramUrl) + '" target="_blank" class="partner-map-modal-btn partner-map-modal-btn-primary partner-map-modal-btn-instagram">' +
    '<i data-lucide="instagram" class="btn-icon"></i>' +
    '<span>인스타그램 방문하기</span>' +
    '</a>' : '') +
    (partner.phone ? '<a href="tel:' + escapeHtml(partner.phone.replace(/[^0-9]/g, '')) + '" class="partner-map-modal-btn partner-map-modal-btn-secondary">' +
    '<i data-lucide="phone" class="btn-icon"></i>' +
    '<span>전화하기</span>' +
    '</a>' : '') +
    '<a href="' + naverMapUrl + '" target="_blank" class="partner-map-modal-btn partner-map-modal-btn-secondary">' +
    '<i data-lucide="navigation" class="btn-icon"></i>' +
    '<span>길찾기</span>' +
    '</a>' +
    '<button class="partner-map-modal-btn partner-map-modal-btn-secondary partner-map-modal-share-btn" data-partner-name="' + escapeHtml(partner.name) + '">' +
    '<i data-lucide="share-2" class="btn-icon"></i>' +
    '<span>공유하기</span>' +
    '</button>' +
    '</div>' +
    '</div>';
  
  modal.classList.add('show');
  
  // Lucide Icons 초기화
  if (typeof lucide !== 'undefined') {
    setTimeout(function() {
      lucide.createIcons();
    }, 100);
  }
};

window.closeInfoWindow = function() {
  if (currentInfoWindow) {
    currentInfoWindow.close();
    currentInfoWindow = null;
  }
};

window.tryInitMap = function() {
  if (typeof naver !== 'undefined' && naver.maps) {
    try {
      initMap();
      return true;
    } catch (error) {
      console.error('지도 초기화 중 오류:', error);
      return false;
    }
  }
  return false;
};

window.showMapLoadError = function() {
  var loading = document.getElementById('partner-map-loading');
  if (loading) {
    loading.innerHTML = 
      '<div style="color: #F44336; text-align: center; padding: 20px;">' +
      '<div style="font-size: 18px; font-weight: 600; margin-bottom: 12px;">네이버 지도 API 로드 실패</div>' +
      '<div style="font-size: 14px; color: #666;">Web Service URL을 확인해주세요</div>' +
      '</div>';
    loading.classList.remove('hidden');
  }
};

// 앱 초기화
function initializeApp() {
  // 지도 API 로드 대기
  var checkCount = 0;
  var maxChecks = 75;
  
  function checkNaverMap() {
    checkCount++;
    
    if (window.tryInitMap && window.tryInitMap()) {
      setTimeout(function() {
        loadPartnersData();
      }, 300);
    } else if (window.naverMapLoadError) {
      window.showMapLoadError();
      loadPartnersData();
    } else if (checkCount < maxChecks) {
      setTimeout(checkNaverMap, 200);
    } else {
      console.warn('네이버 지도 API 로드 타임아웃');
      window.showMapLoadError();
      loadPartnersData();
    }
  }
  
  checkNaverMap();
  
  // 이벤트 리스너
  var searchInput = document.getElementById('partner-map-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      searchQuery = e.target.value;
      applyFilters();
    });
  }

  // InfoWindow/Modal 이벤트 위임 (XSS 방지: onclick 인라인 핸들러 제거)
  document.addEventListener('click', function(e) {
    var detailBtn = e.target.closest && e.target.closest('.partner-map-detail-btn');
    if (detailBtn) {
      var partnerName = detailBtn.getAttribute('data-partner-name');
      if (partnerName) showPartnerDetailModal(partnerName);
      return;
    }
    var shareBtn = e.target.closest && e.target.closest('.partner-map-share-btn, .partner-map-modal-share-btn');
    if (shareBtn) {
      var partnerName = shareBtn.getAttribute('data-partner-name');
      if (partnerName) sharePartnerUrl(partnerName);
    }
  });

  var btnLocation = document.getElementById('partner-map-btn-location');
  if (btnLocation) {
    btnLocation.addEventListener('click', function() {
      var self = this;
      if (self.classList.contains('active')) {
        // 비활성화: 현재 위치 마커 제거 + 정렬 초기화
        self.classList.remove('active');
        userLocation = null;
        sortBy = 'name';
        if (currentLocationMarker) {
          currentLocationMarker.setMap(null);
          currentLocationMarker = null;
        }
        applyFilters();
      } else {
        // 활성화: GPS로 현재 위치 가져오기
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(function(pos) {
            userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            sortBy = 'distance';
            self.classList.add('active');
            var sortSelect = document.getElementById('partner-map-sort-select');
            if (sortSelect) sortSelect.value = 'distance';
            if (map) {
              var gpsPos = new naver.maps.LatLng(userLocation.lat, userLocation.lng);
              map.setCenter(gpsPos);
              map.setZoom(13);
              addCurrentLocationMarker(gpsPos);
            }
            applyFilters();
          }, function() {
            // GPS 권한 거부 시 지도 중앙 폴백
            if (map) {
              var center = map.getCenter();
              userLocation = { lat: center.y, lng: center.x };
              sortBy = 'distance';
              self.classList.add('active');
              var sortSelect = document.getElementById('partner-map-sort-select');
              if (sortSelect) sortSelect.value = 'distance';
              applyFilters();
            }
          });
        } else if (map) {
          // geolocation API 미지원 시 폴백
          var center = map.getCenter();
          userLocation = { lat: center.y, lng: center.x };
          sortBy = 'distance';
          self.classList.add('active');
          var sortSelect = document.getElementById('partner-map-sort-select');
          if (sortSelect) sortSelect.value = 'distance';
          applyFilters();
        }
      }
    });
  }
  
  var btnFavorites = document.getElementById('partner-map-btn-favorites');
  if (btnFavorites) {
    btnFavorites.addEventListener('click', function() {
      this.classList.toggle('active');
      applyFilters();
    });
  }
  
  var sortSelect = document.getElementById('partner-map-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', function(e) {
      sortBy = e.target.value;
      applyFilters();
    });
  }

  // 캐시 강제 새로고침
  var btnRefresh = document.getElementById('partner-map-btn-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', function() {
      try {
        localStorage.removeItem('partner_map_cache');
        localStorage.removeItem('partner_map_cache_time');
      } catch (e) {}
      this.classList.add('loading');
      setTimeout(function() { location.reload(); }, 300);
    });
  }

  // 모바일 Bottom Sheet 토글
  var btnList = document.getElementById('partner-map-btn-list');
  var sidebar = document.getElementById('partner-map-sidebar');
  var overlay = document.getElementById('partner-map-sidebar-overlay');
  if (btnList && sidebar) {
    btnList.addEventListener('click', function() {
      sidebar.classList.toggle('show');
      btnList.classList.toggle('active');
      if (overlay) overlay.classList.toggle('show');
    });
    if (overlay) {
      overlay.addEventListener('click', function() {
        sidebar.classList.remove('show');
        btnList.classList.remove('active');
        overlay.classList.remove('show');
      });
    }
  }

  var btnMapStyle = document.getElementById('partner-map-btn-style');
  if (btnMapStyle) {
    btnMapStyle.addEventListener('click', function() {
      if (map) {
        if (mapStyle === 'normal') {
          map.setMapTypeId(naver.maps.MapTypeId.HYBRID);
          mapStyle = 'satellite';
          this.textContent = '🛰️';
          this.classList.add('active');
        } else {
          map.setMapTypeId(naver.maps.MapTypeId.NORMAL);
          mapStyle = 'normal';
          this.textContent = '🗺️';
          this.classList.remove('active');
        }
      }
    });
  }
  
  var modalClose = document.getElementById('partner-map-modal-close');
  if (modalClose) {
    modalClose.addEventListener('click', function() {
      var modal = document.getElementById('partner-map-modal');
      if (modal) {
        modal.classList.remove('show');
        // Lucide Icons 정리
        if (typeof lucide !== 'undefined') {
          var icons = modal.querySelectorAll('[data-lucide]');
          icons.forEach(function(icon) {
            var iconElement = icon.parentElement;
            if (iconElement && iconElement.querySelector('svg')) {
              iconElement.innerHTML = '';
            }
          });
        }
      }
    });
  }
  
  var modal = document.getElementById('partner-map-modal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        this.classList.remove('show');
        // Lucide Icons 정리
        if (typeof lucide !== 'undefined') {
          var icons = this.querySelectorAll('[data-lucide]');
          icons.forEach(function(icon) {
            var iconElement = icon.parentElement;
            if (iconElement && iconElement.querySelector('svg')) {
              iconElement.innerHTML = '';
            }
          });
        }
      }
    });
  }
  
  loadFavorites();
  
  // URL 파라미터 복원
  var urlParams = getUrlParams();
  if (urlParams.region && urlParams.region !== 'all') {
    currentFilters.region = urlParams.region;
    setFilter('region', urlParams.region);
  }
  if (urlParams.category && urlParams.category !== 'all') {
    currentFilters.category = urlParams.category;
    setFilter('category', urlParams.category);
  }
  if (urlParams.association && urlParams.association !== 'all') {
    currentFilters.association = urlParams.association;
    setFilter('association', urlParams.association);
  }
  if (urlParams.partnerType && urlParams.partnerType !== 'all') {
    currentFilters.partnerType = urlParams.partnerType;
    setFilter('partnerType', urlParams.partnerType);
  }
  if (urlParams.search) {
    searchQuery = urlParams.search;
    if (searchInput) searchInput.value = searchQuery;
  }
  if (urlParams.partner) {
    pendingPartnerFocus = urlParams.partner;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
