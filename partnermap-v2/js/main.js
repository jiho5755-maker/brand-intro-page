/* ==========================================
   Partner Map Service
   프레스코21 제휴 공방 지도 서비스
   자사몰 common.js 패턴 기반
   ========================================== */

// 네이버 지도 API 설정 (기존 partnermap 코드 참고)
const NAVER_MAP_NCP_KEY_ID = 'bfp8odep5r';
const GOOGLE_SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbxfp4SbpsUCmQu0gnF02r8oMY0dzzadElkcTcFNSsxPNo3x4zsNcw-z8MvJ3F7xskP6Yw/exec';

const CONFIG = {
    defaultCenter: { lat: 37.5665, lng: 126.9780 }, // 서울 시청
    defaultZoom: 11,
    cacheKey: 'fresco21_partners_v3',  // 캐시 키 변경 (이전 캐시 무효화)
    cacheDuration: 24 * 60 * 60 * 1000, // 24시간
    clusterZoom: 10 // 줌 레벨이 이 값 이하일 때 클러스터링 활성화
};

let map = null;
let markers = [];
let clusterMarkers = []; // 클러스터 마커 목록
let partners = [];
let filteredPartners = [];
let idleListenerRef = null; // 지도 idle 이벤트 리스너 참조
let currentFilters = {
    category: 'all',
    region: 'all',
    association: 'all',
    partnerType: 'all',
    search: ''
};
let favorites = [];
let showFavoritesOnly = false;

// 즐겨찾기 관리
function loadFavorites() {
    try {
        const saved = localStorage.getItem('fresco21_favorites');
        favorites = saved ? JSON.parse(saved) : [];
    } catch (e) {
        favorites = [];
    }
}

function saveFavorites() {
    localStorage.setItem('fresco21_favorites', JSON.stringify(favorites));
}

function isFavorite(partnerId) {
    return favorites.includes(String(partnerId));
}

function toggleFavorite(partnerId, event) {
    if (event) {
        event.stopPropagation();
    }
    const id = String(partnerId);
    if (isFavorite(id)) {
        favorites = favorites.filter(f => f !== id);
        showToast('즐겨찾기에서 제거했습니다.', 'info');
    } else {
        favorites.push(id);
        showToast('즐겨찾기에 추가했습니다!', 'success');
    }
    saveFavorites();
    renderPartnerList();
    updateFavoriteButtons();
}

function updateFavoriteButtons() {
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        const id = btn.dataset.id;
        if (isFavorite(id)) {
            btn.classList.add('active');
            btn.innerHTML = '❤️';
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '🤍';
        }
    });
}

function toggleFavoritesFilter() {
    showFavoritesOnly = !showFavoritesOnly;
    const btn = document.getElementById('favoritesFilterBtn');
    if (btn) {
        btn.classList.toggle('active', showFavoritesOnly);
    }
    applyFilters();
}

/* ==========================================
   네이버 지도 SDK 로드
   ========================================== */

function loadNaverMapSDK() {
    return new Promise((resolve, reject) => {
        if (window.naver && window.naver.maps) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_MAP_NCP_KEY_ID}&t=${Date.now()}`;
        script.async = true;

        script.onload = () => resolve();
        script.onerror = () => reject(new Error('네이버 지도 로드 실패'));

        document.head.appendChild(script);
    });
}

/* ==========================================
   초기화
   ========================================== */

async function initPartnerMap() {
    try {
        // 0. 즐겨찾기 로드
        loadFavorites();

        // 1. SDK 로드
        await loadNaverMapSDK();

        // 2. 데이터 로드
        partners = await loadPartnerData();
        filteredPartners = partners;

        // 3. 지도 초기화
        initMap();

        // 4. 필터 생성
        generateFilters();

        // 5. 이벤트 리스너
        setupEventListeners();

        // 6. URL 파라미터 로드 및 필터 적용
        loadUrlParams();
        applyFilters();

        // 로딩 숨김
        hideLoading();

        // 성공 알림
        showToast(`${partners.length}개의 제휴 공방을 불러왔습니다.`, 'success');

    } catch (error) {
        console.error('초기화 실패:', error);
        showError('지도를 불러오는 중 오류가 발생했습니다.');
        showToast('지도를 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

/* ==========================================
   지도 초기화
   ========================================== */

let referenceMarker = null;  // 기준점 마커

function initMap() {
    const mapOptions = {
        center: new naver.maps.LatLng(CONFIG.defaultCenter.lat, CONFIG.defaultCenter.lng),
        zoom: CONFIG.defaultZoom,
        zoomControl: true,
        zoomControlOptions: {
            position: naver.maps.Position.TOP_RIGHT
        },
        mapTypeControl: true
    };

    map = new naver.maps.Map('naverMap', mapOptions);

    // 지도 클릭 시 기준점 설정 및 거리순 정렬
    naver.maps.Event.addListener(map, 'click', function(e) {
        console.log('지도 클릭됨:', e);  // 디버깅
        // 네이버 지도 API v3 좌표 접근
        const coord = e.coord || e.latlng;
        const clickedLat = coord.y || coord.lat();
        const clickedLng = coord.x || coord.lng();
        console.log('좌표:', clickedLat, clickedLng);  // 디버깅
        setReferencePoint(clickedLat, clickedLng);
    });

    // 지도 이동/줌 완료 시 마커 가시성 및 클러스터링 업데이트
    idleListenerRef = naver.maps.Event.addListener(map, 'idle', updateMarkerVisibility);
}

// 기준점 설정 및 거리순 정렬
function setReferencePoint(lat, lng) {
    console.log('setReferencePoint 호출:', lat, lng);  // 디버깅

    // 기존 기준점 마커 제거
    if (referenceMarker) {
        referenceMarker.setMap(null);
    }

    // 새 기준점 마커 생성 (HTML 마커)
    referenceMarker = new naver.maps.Marker({
        position: new naver.maps.LatLng(lat, lng),
        map: map,
        icon: {
            content: '<div style="width:40px;height:40px;line-height:40px;text-align:center;font-size:28px;animation:pulse 1.5s infinite;">📍</div>',
            size: new naver.maps.Size(40, 40),
            anchor: new naver.maps.Point(20, 40)
        },
        zIndex: 1000
    });

    console.log('기준점 마커 생성됨:', referenceMarker);  // 디버깅

    // 거리 계산 및 정렬
    filteredPartners = partners.map(partner => ({
        ...partner,
        distance: calculateDistance(lat, lng, partner.lat, partner.lng)
    })).sort((a, b) => a.distance - b.distance);

    // 필터 적용 (현재 필터 유지하면서 거리순 정렬)
    if (currentFilters.category !== 'all' || currentFilters.region !== 'all' ||
        currentFilters.association !== 'all' || currentFilters.partnerType !== 'all' ||
        currentFilters.search || showFavoritesOnly) {
        applyFilters();
        // 거리 정보 다시 추가
        filteredPartners = filteredPartners.map(partner => ({
            ...partner,
            distance: calculateDistance(lat, lng, partner.lat, partner.lng)
        })).sort((a, b) => a.distance - b.distance);
    }

    renderPartnerList();

    // 초기화 버튼 표시
    const clearBtn = document.getElementById('clearReferenceBtn');
    if (clearBtn) clearBtn.style.display = 'inline-block';

    showToast(`선택한 위치 기준 ${filteredPartners.length}개 공방 정렬됨`, 'success');
}

// 기준점 초기화
function clearReferencePoint() {
    if (referenceMarker) {
        referenceMarker.setMap(null);
        referenceMarker = null;
    }

    // 초기화 버튼 숨김
    const clearBtn = document.getElementById('clearReferenceBtn');
    if (clearBtn) clearBtn.style.display = 'none';

    // 거리 정보 제거하고 필터 다시 적용
    filteredPartners = filteredPartners.map(p => {
        const { distance, ...rest } = p;
        return rest;
    });

    applyFilters();
    showToast('기준점이 초기화되었습니다.', 'info');
}

/* ==========================================
   데이터 로드
   ========================================== */

async function loadPartnerData() {
    // 캐시 확인 (빈 배열이면 무시하고 새로 로드)
    const cached = getCache();
    if (cached && cached.length > 0) return cached;

    try {
        const response = await fetch(GOOGLE_SHEET_API_URL);
        const data = await response.json();

        console.log('API 응답:', data);  // 디버깅용

        // API 응답 구조 확인 (원본과 동일하게 data.partners 사용)
        const rawPartners = data.partners || data;

        console.log('rawPartners:', rawPartners);  // 디버깅용

        if (!Array.isArray(rawPartners)) {
            console.error('잘못된 데이터 형식:', data);
            return [];
        }

        console.log('파트너 수:', rawPartners.length);  // 디버깅용

        // 데이터 가공 (status 필터 제거 - 원본에 없음)
        const partners = rawPartners
            .filter(p => p.lat && p.lng)
            .map(p => ({
                id: p.id,
                name: p.name,
                category: p.category ? p.category.split(',').map(c => c.trim()) : [],
                address: p.address,
                lat: parseFloat(p.lat),
                lng: parseFloat(p.lng),
                phone: p.phone,
                email: p.email,
                description: p.description,
                imageUrl: p.imageUrl,
                logoUrl: p.logoUrl,
                association: p.association || '',
                partnerType: p.partnerType
                    ? (typeof p.partnerType === 'string'
                        ? p.partnerType.split(',').map(t => t.trim())
                        : p.partnerType)
                    : []
            }));

        setCache(partners);
        return partners;

    } catch (error) {
        console.error('데이터 로드 실패:', error);
        return [];
    }
}

/* ==========================================
   필터 생성
   ========================================== */

function generateFilters() {
    // 카테고리 추출
    const categories = new Set();
    partners.forEach(p => {
        p.category.forEach(cat => categories.add(cat));
    });

    // 카테고리 버튼 생성
    const categoryFilters = document.getElementById('categoryFilters');
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'btn filter-btn';
        btn.dataset.category = cat;
        btn.textContent = cat;
        categoryFilters.appendChild(btn);
    });

    // 지역 추출
    const regions = new Set();
    partners.forEach(p => {
        const region = extractRegion(p.address);
        if (region) regions.add(region);
    });

    // 지역 버튼 생성
    const regionFilters = document.getElementById('regionFilters');
    Array.from(regions).sort().forEach(region => {
        const btn = document.createElement('button');
        btn.className = 'btn filter-btn';
        btn.dataset.region = region;
        btn.textContent = region;
        regionFilters.appendChild(btn);
    });

    // 협회 추출
    const associations = new Set();
    partners.forEach(p => {
        if (p.association) {
            p.association.split(',').forEach(a => {
                const trimmed = a.trim();
                if (trimmed) associations.add(trimmed);
            });
        }
    });

    // 협회 버튼 생성
    const associationFilters = document.getElementById('associationFilters');
    if (associationFilters && associations.size > 0) {
        Array.from(associations).sort().forEach(assoc => {
            const btn = document.createElement('button');
            btn.className = 'btn filter-btn';
            btn.dataset.association = assoc;
            btn.textContent = assoc;
            associationFilters.appendChild(btn);
        });
    }

    // 파트너 유형 추출 (협회, 인플루언서 등)
    const partnerTypes = new Set();
    partners.forEach(p => {
        if (p.partnerType && Array.isArray(p.partnerType)) {
            p.partnerType.forEach(type => {
                if (type && type.trim()) partnerTypes.add(type.trim());
            });
        }
    });

    // 파트너 유형 버튼 생성
    const partnerTypeFilters = document.getElementById('partnerTypeFilters');
    if (partnerTypeFilters && partnerTypes.size > 0) {
        Array.from(partnerTypes).sort().forEach(type => {
            const btn = document.createElement('button');
            btn.className = 'btn filter-btn';
            btn.dataset.partnerType = type;
            btn.textContent = type;
            partnerTypeFilters.appendChild(btn);
        });
    }
}

/* ==========================================
   마커 생성
   ========================================== */

function createMarkers() {
    // 기존 마커 제거
    markers.forEach(item => item.marker.setMap(null));
    markers = [];

    // 기존 클러스터 마커 제거
    clusterMarkers.forEach(marker => marker.setMap(null));
    clusterMarkers = [];

    filteredPartners.forEach(partner => {
        const position = new naver.maps.LatLng(partner.lat, partner.lng);

        // 커스텀 마커 생성 (초기에는 숨김 - 클러스터링/뷰포트 기반 관리)
        const marker = new naver.maps.Marker({
            position: position,
            map: null, // 초기에는 숨김
            title: partner.name,
            icon: {
                content: createMarkerIcon(partner),
                anchor: new naver.maps.Point(20, 40)
            }
        });

        // 클릭 이벤트
        naver.maps.Event.addListener(marker, 'click', () => {
            showPartnerDetail(partner);
            map.panTo(position);
        });

        // 마커와 파트너 정보를 함께 저장
        markers.push({ marker, partner });
    });

    // 지도 범위 조정
    if (filteredPartners.length > 0) {
        adjustMapBounds();
    }

    // 마커 가시성 업데이트 (클러스터링 적용)
    setTimeout(() => updateMarkerVisibility(), 100);
}

function createMarkerIcon(partner) {
    // 파트너 유형별 색상
    let color = '#7D9675'; // 기본 (브랜드 컬러)

    if (partner.partnerType) {
        if (partner.partnerType.includes('협회') || partner.partnerType === '협회') {
            color = '#5A7FA8';
        } else if (partner.partnerType.includes('인플루언서') || partner.partnerType === '인플루언서') {
            color = '#C9A961';
        }
    }

    // SVG 꽃 아이콘
    const flowerIcon = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style="margin-right: 6px;">
            <path d="M12 2C12 2 10.5 6 10.5 8.5C10.5 9.88 11.12 11 12 11C12.88 11 13.5 9.88 13.5 8.5C13.5 6 12 2 12 2Z"/>
            <path d="M16.24 7.76C16.24 7.76 15 11.5 16 13C16.5 13.75 17.5 14 18.5 13.5C19.5 13 20 12 19.5 10.5C19 9 16.24 7.76 16.24 7.76Z"/>
            <path d="M7.76 7.76C7.76 7.76 5 9 4.5 10.5C4 12 4.5 13 5.5 13.5C6.5 14 7.5 13.75 8 13C9 11.5 7.76 7.76 7.76 7.76Z"/>
            <path d="M12 12C10.34 12 9 13.34 9 15C9 16.66 10.34 18 12 18C13.66 18 15 16.66 15 15C15 13.34 13.66 12 12 12Z"/>
            <path d="M8.5 16.5C8.5 16.5 6.5 19 7 20.5C7.5 22 9 22 10 21C11 20 10.5 18 9.5 17C8.5 16 8.5 16.5 8.5 16.5Z"/>
            <path d="M15.5 16.5C15.5 16.5 17.5 19 17 20.5C16.5 22 15 22 14 21C13 20 13.5 18 14.5 17C15.5 16 15.5 16.5 15.5 16.5Z"/>
        </svg>
    `;

    return `
        <div style="
            display: flex;
            align-items: center;
            gap: 4px;
            background: white;
            padding: 10px 16px;
            border-radius: var(--radius-full, 9999px);
            box-shadow: var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.12));
            border: 2px solid ${color};
            font-family: 'Pretendard', sans-serif;
            font-size: 14px;
            font-weight: 600;
            color: ${color};
            white-space: nowrap;
            transition: all 0.3s ease;
        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 12px 40px rgba(0,0,0,0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 8px 32px rgba(0,0,0,0.12)';">
            ${flowerIcon}
            ${escapeHtml(partner.name)}
        </div>
    `;
}

function adjustMapBounds() {
    const bounds = new naver.maps.LatLngBounds();
    filteredPartners.forEach(partner => {
        bounds.extend(new naver.maps.LatLng(partner.lat, partner.lng));
    });
    map.fitBounds(bounds);
}

/* ==========================================
   마커 클러스터링
   ========================================== */

/**
 * Viewport 내 마커 표시 + 클러스터링 통합
 * 줌 레벨에 따라 클러스터링 또는 개별 마커 표시
 */
function updateMarkerVisibility() {
    if (!map) return;

    const bounds = map.getBounds();
    if (!bounds) return;

    const zoom = map.getZoom();

    // 기존 클러스터 마커 제거
    clusterMarkers.forEach(marker => marker.setMap(null));
    clusterMarkers = [];

    if (zoom <= CONFIG.clusterZoom) {
        // === 클러스터 모드 ===
        const visibleItems = [];

        markers.forEach(item => {
            if (bounds.hasLatLng(item.marker.getPosition())) {
                visibleItems.push(item);
            }
            // 개별 마커는 모두 숨김
            item.marker.setMap(null);
        });

        // 클러스터 계산
        const clusters = computeClusters(visibleItems, zoom);

        clusters.forEach(cluster => {
            if (cluster.length === 1) {
                // 단일 마커는 그대로 표시
                cluster[0].marker.setMap(map);
            } else {
                // 클러스터 마커 생성
                createClusterMarker(cluster);
            }
        });
    } else {
        // === 일반 모드: Viewport 기반 가시성 ===
        markers.forEach(item => {
            const inBounds = bounds.hasLatLng(item.marker.getPosition());
            if (inBounds && !item.marker.getMap()) {
                item.marker.setMap(map);
            } else if (!inBounds && item.marker.getMap()) {
                item.marker.setMap(null);
            }
        });
    }
}

/**
 * 클러스터 그룹핑 (거리 기반 단일 링크)
 * @param {Array} visibleItems - Viewport 내 마커 배열
 * @param {number} zoom - 현재 줌 레벨
 * @returns {Array} 클러스터 배열
 */
function computeClusters(visibleItems, zoom) {
    // 줌 레벨에 따른 클러스터 반경 (km)
    const thresholdKm = Math.pow(2, 12 - zoom) * 0.3;
    const used = new Set();
    const clusters = [];

    for (let i = 0; i < visibleItems.length; i++) {
        if (used.has(i)) continue;

        const cluster = [visibleItems[i]];
        used.add(i);

        for (let j = i + 1; j < visibleItems.length; j++) {
            if (used.has(j)) continue;

            const dist = calculateDistance(
                visibleItems[i].partner.lat,
                visibleItems[i].partner.lng,
                visibleItems[j].partner.lat,
                visibleItems[j].partner.lng
            );

            if (dist <= thresholdKm) {
                cluster.push(visibleItems[j]);
                used.add(j);
            }
        }

        clusters.push(cluster);
    }

    return clusters;
}

/**
 * 클러스터 마커 생성
 * @param {Array} cluster - 클러스터에 포함된 마커 배열
 */
function createClusterMarker(cluster) {
    // 클러스터 중심점 계산
    const totalLat = cluster.reduce((sum, item) => sum + item.partner.lat, 0);
    const totalLng = cluster.reduce((sum, item) => sum + item.partner.lng, 0);
    const centerLat = totalLat / cluster.length;
    const centerLng = totalLng / cluster.length;

    const position = new naver.maps.LatLng(centerLat, centerLng);
    const count = cluster.length;

    // 클러스터 크기는 개수에 비례
    const size = 40 + Math.min(count, 10) * 3;
    const fontSize = size > 50 ? 16 : 14;

    // 클러스터 마커 스타일
    const clusterContent = `
        <div class="cluster-marker" style="
            width: ${size}px;
            height: ${size}px;
            background: linear-gradient(135deg, var(--color-primary, #7D9675) 0%, var(--color-dark, #5a6e54) 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: ${fontSize}px;
            font-weight: 700;
            font-family: 'Pretendard', sans-serif;
            box-shadow: 0 4px 12px rgba(125, 150, 117, 0.4);
            border: 3px solid white;
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        " onmouseover="this.style.transform='scale(1.1)'; this.style.boxShadow='0 6px 20px rgba(125, 150, 117, 0.5)';"
           onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(125, 150, 117, 0.4)';">
            ${count}
        </div>
    `;

    const marker = new naver.maps.Marker({
        position: position,
        map: map,
        icon: {
            content: clusterContent,
            anchor: new naver.maps.Point(size / 2, size / 2)
        }
    });

    // 클릭 시 해당 클러스터 영역으로 줌인
    naver.maps.Event.addListener(marker, 'click', () => {
        const clusterBounds = new naver.maps.LatLngBounds();
        cluster.forEach(item => {
            clusterBounds.extend(new naver.maps.LatLng(item.partner.lat, item.partner.lng));
        });
        map.fitBounds(clusterBounds, { padding: 60 });
    });

    clusterMarkers.push(marker);
}

/* ==========================================
   필터링
   ========================================== */

function applyFilters() {
    filteredPartners = partners.filter(partner => {
        // 카테고리
        if (currentFilters.category !== 'all' &&
            !partner.category.includes(currentFilters.category)) {
            return false;
        }

        // 지역
        if (currentFilters.region !== 'all') {
            const region = extractRegion(partner.address);
            if (region !== currentFilters.region) {
                return false;
            }
        }

        // 협회
        if (currentFilters.association !== 'all') {
            const assocs = partner.association
                ? partner.association.split(',').map(a => a.trim())
                : [];
            if (!assocs.includes(currentFilters.association)) {
                return false;
            }
        }

        // 파트너 유형
        if (currentFilters.partnerType !== 'all') {
            if (!partner.partnerType || !partner.partnerType.includes(currentFilters.partnerType)) {
                return false;
            }
        }

        // 검색
        if (currentFilters.search) {
            const query = currentFilters.search.toLowerCase();
            const nameMatch = partner.name.toLowerCase().includes(query);
            const addressMatch = partner.address.toLowerCase().includes(query);
            if (!nameMatch && !addressMatch) {
                return false;
            }
        }

        // 즐겨찾기 필터
        if (showFavoritesOnly && !isFavorite(partner.id)) {
            return false;
        }

        return true;
    });

    createMarkers();
    renderPartnerList();
    updateFavoriteButtons();
}

function extractRegion(address) {
    // 주소에서 시/도 추출
    const match = address.match(/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/);
    return match ? match[1] : '기타';
}

/* ==========================================
   리스트 렌더링
   ========================================== */

function renderPartnerList() {
    const listContainer = document.getElementById('partnerList');
    const resultCount = document.getElementById('resultCount');

    resultCount.textContent = `${filteredPartners.length}개`;

    if (filteredPartners.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">검색 결과가 없습니다.</p>';
        return;
    }

    listContainer.innerHTML = filteredPartners
        .map(partner => createPartnerCardHTML(partner))
        .join('');

    // 카드 클릭 이벤트
    listContainer.querySelectorAll('.partner-card').forEach(card => {
        card.addEventListener('click', function() {
            const id = this.dataset.id;
            const partner = partners.find(p => p.id == id);
            if (partner) {
                showPartnerDetail(partner);
                const position = new naver.maps.LatLng(partner.lat, partner.lng);
                map.panTo(position);
                map.setZoom(15);
            }
        });
    });

    // 스크롤 애니메이션 초기화
    setTimeout(() => {
        initScrollAnimations();
    }, 100);
}

function createPartnerCardHTML(partner) {
    const isFav = isFavorite(partner.id);
    const distanceText = partner.distance !== undefined
        ? `<span class="distance-badge">📏 ${partner.distance.toFixed(1)}km</span>`
        : '';
    return `
        <div class="partner-card" data-id="${partner.id}">
            <button class="favorite-btn ${isFav ? 'active' : ''}"
                    data-id="${partner.id}"
                    onclick="toggleFavorite('${partner.id}', event)"
                    title="즐겨찾기">
                ${isFav ? '❤️' : '🤍'}
            </button>
            ${distanceText ? `<div class="distance-indicator">${distanceText}</div>` : ''}
            <div class="partner-logo">
                <img src="${partner.logoUrl || './images/default-logo.jpg'}"
                     alt="${escapeHtml(partner.name)}"
                     onerror="this.src='./images/default-logo.jpg'">
            </div>
            <div class="partner-info">
                <h4>${escapeHtml(partner.name)}</h4>
                <div class="partner-categories">
                    ${partner.category.map(cat => `<span class="category-tag">${escapeHtml(cat)}</span>`).join('')}
                </div>
                <p class="partner-address">📍 ${escapeHtml(partner.address)}</p>
                <p class="partner-phone">📞 ${escapeHtml(partner.phone)}</p>
            </div>
        </div>
    `;
}

/* ==========================================
   모달
   ========================================== */

function showPartnerDetail(partner) {
    const modal = document.getElementById('partnerModal');
    const modalBody = document.getElementById('modalBody');
    const isFav = isFavorite(partner.id);

    modalBody.innerHTML = `
        <div class="modal-header">
            <img src="${partner.logoUrl || './images/default-logo.jpg'}"
                 alt="${escapeHtml(partner.name)}"
                 onerror="this.src='./images/default-logo.jpg'">
            <h2>${escapeHtml(partner.name)}</h2>
            ${partner.category.length > 0 ? `
                <div class="partner-categories">
                    ${partner.category.map(cat => `<span class="category-tag">${escapeHtml(cat)}</span>`).join('')}
                </div>
            ` : ''}
        </div>

        <!-- 액션 버튼 -->
        <div class="modal-actions">
            <button class="action-btn favorite-btn ${isFav ? 'active' : ''}"
                    onclick="toggleFavorite('${partner.id}')"
                    data-id="${partner.id}">
                ${isFav ? '❤️ 즐겨찾기됨' : '🤍 즐겨찾기'}
            </button>
            <button class="action-btn share-btn" onclick="sharePartner('${partner.id}')">
                📤 공유하기
            </button>
        </div>

        ${partner.imageUrl ? `<img src="${partner.imageUrl}" class="modal-image" alt="${escapeHtml(partner.name)}">` : ''}

        <div class="modal-section">
            <h3>소개</h3>
            <p>${partner.description ? escapeHtml(partner.description) : '소개 정보가 없습니다.'}</p>
        </div>

        <div class="modal-section">
            <h3>위치 정보</h3>
            <p class="address">📍 ${escapeHtml(partner.address)}</p>
            <div class="navigation-buttons">
                <a href="https://map.naver.com/v5/search/${encodeURIComponent(partner.address)}"
                   target="_blank"
                   class="nav-btn naver">
                    🗺️ 네이버 지도
                </a>
                <a href="https://map.kakao.com/?q=${encodeURIComponent(partner.address)}"
                   target="_blank"
                   class="nav-btn kakao">
                    🗺️ 카카오맵
                </a>
            </div>
        </div>

        <div class="modal-section">
            <h3>연락처</h3>
            <p>📞 <a href="tel:${partner.phone}">${escapeHtml(partner.phone)}</a></p>
            ${partner.email ? `<p>📧 <a href="mailto:${partner.email}">${escapeHtml(partner.email)}</a></p>` : ''}
        </div>
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('partnerModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

/* ==========================================
   공유 기능
   ========================================== */

function sharePartner(partnerId) {
    const partner = partners.find(p => String(p.id) === String(partnerId));
    if (!partner) return;

    const shareUrl = `${window.location.origin}${window.location.pathname}?partner=${encodeURIComponent(partner.name)}`;
    const shareText = `${partner.name} - 프레스코21 제휴 공방\n📍 ${partner.address}`;

    // 공유 옵션 모달 표시
    showShareOptions(partner, shareUrl, shareText);
}

function showShareOptions(partner, shareUrl, shareText) {
    const existingModal = document.getElementById('shareModal');
    if (existingModal) existingModal.remove();

    const shareModal = document.createElement('div');
    shareModal.id = 'shareModal';
    shareModal.className = 'share-modal';
    shareModal.innerHTML = `
        <div class="share-modal-overlay" onclick="closeShareModal()"></div>
        <div class="share-modal-content">
            <h3>공유하기</h3>
            <p>${escapeHtml(partner.name)}</p>
            <div class="share-buttons">
                <button class="share-option" onclick="copyShareLink('${shareUrl}')">
                    📋 링크 복사
                </button>
                <button class="share-option" onclick="shareKakao('${escapeHtml(partner.name)}', '${escapeHtml(partner.address)}', '${shareUrl}')">
                    💬 카카오톡
                </button>
                ${navigator.share ? `
                <button class="share-option" onclick="nativeShare('${escapeHtml(shareText)}', '${shareUrl}')">
                    📤 더보기
                </button>
                ` : ''}
            </div>
            <button class="share-close" onclick="closeShareModal()">닫기</button>
        </div>
    `;
    document.body.appendChild(shareModal);
    setTimeout(() => shareModal.classList.add('active'), 10);
}

function closeShareModal() {
    const modal = document.getElementById('shareModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

function copyShareLink(url) {
    navigator.clipboard.writeText(url).then(() => {
        showToast('링크가 복사되었습니다!', 'success');
        closeShareModal();
    }).catch(() => {
        // Fallback for older browsers
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast('링크가 복사되었습니다!', 'success');
        closeShareModal();
    });
}

function shareKakao(name, address, url) {
    // 카카오 SDK가 로드되어 있는지 확인
    if (typeof Kakao !== 'undefined' && Kakao.isInitialized()) {
        Kakao.Share.sendDefault({
            objectType: 'location',
            address: address,
            addressTitle: name,
            content: {
                title: name,
                description: `프레스코21 제휴 공방\n${address}`,
                imageUrl: 'https://jiho5755-maker.github.io/brand-intro-page/partnermap-v2/images/default-logo.jpg',
                link: { mobileWebUrl: url, webUrl: url }
            },
            buttons: [{
                title: '공방 보기',
                link: { mobileWebUrl: url, webUrl: url }
            }]
        });
    } else {
        // 카카오 SDK가 없으면 카카오톡 공유 URL 사용
        const kakaoShareUrl = `https://story.kakao.com/share?url=${encodeURIComponent(url)}`;
        window.open(kakaoShareUrl, '_blank', 'width=600,height=400');
    }
    closeShareModal();
}

function nativeShare(text, url) {
    if (navigator.share) {
        navigator.share({
            title: '프레스코21 제휴 공방',
            text: text,
            url: url
        }).catch(() => {});
    }
    closeShareModal();
}

/* ==========================================
   GPS 위치 검색
   ========================================== */

function searchNearby() {
    if (!navigator.geolocation) {
        showToast('위치 서비스를 지원하지 않는 브라우저입니다.', 'error');
        return;
    }

    showToast('현재 위치를 확인하는 중...', 'info');

    navigator.geolocation.getCurrentPosition(
        position => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            // 거리 계산 및 정렬
            filteredPartners = partners.map(partner => ({
                ...partner,
                distance: calculateDistance(lat, lng, partner.lat, partner.lng)
            })).sort((a, b) => a.distance - b.distance);

            // 지도 중심 이동
            const myPosition = new naver.maps.LatLng(lat, lng);
            map.panTo(myPosition);
            map.setZoom(13);

            renderPartnerList();
            showToast('내 위치 주변 공방을 찾았습니다!', 'success');
        },
        error => {
            showToast('위치를 가져올 수 없습니다. GPS를 켜주세요.', 'error');
        }
    );
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // 지구 반경 (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/* ==========================================
   이벤트 리스너
   ========================================== */

function setupEventListeners() {
    // 카테고리 필터
    document.querySelectorAll('#categoryFilters .filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#categoryFilters .filter-btn')
                .forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilters.category = this.dataset.category;
            applyFilters();
            updateUrlParams();
        });
    });

    // 지역 필터
    document.querySelectorAll('#regionFilters .filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#regionFilters .filter-btn')
                .forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilters.region = this.dataset.region;
            applyFilters();
            updateUrlParams();
        });
    });

    // 협회 필터
    document.querySelectorAll('#associationFilters .filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#associationFilters .filter-btn')
                .forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilters.association = this.dataset.association;
            applyFilters();
            updateUrlParams();
        });
    });

    // 파트너 유형 필터
    document.querySelectorAll('#partnerTypeFilters .filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#partnerTypeFilters .filter-btn')
                .forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilters.partnerType = this.dataset.partnerType;
            applyFilters();
            updateUrlParams();
        });
    });

    // 검색
    const searchInput = document.getElementById('partnerSearch');
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            currentFilters.search = searchInput.value;
            applyFilters();
        }
    });

    // 검색 debounce 적용
    searchInput.addEventListener('input', debounce(function() {
        currentFilters.search = this.value;
        applyFilters();
    }, 300));

    // 내 위치
    document.getElementById('myLocationBtn').addEventListener('click', searchNearby);

    // 모달
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', closeModal);

    // ESC 키
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

/* ==========================================
   유틸리티
   ========================================== */

// Debounce 함수 (common.js 의존성 제거)
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function hideLoading() {
    const loading = document.getElementById('mapLoading');
    if (loading) {
        loading.classList.add('d-none');
    }
}

function showError(message) {
    const loading = document.getElementById('mapLoading');
    if (loading) {
        loading.innerHTML = `
            <div style="text-align: center; color: var(--text-primary);">
                <p style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">⚠️ 오류 발생</p>
                <p style="font-size: 0.875rem; color: var(--text-secondary);">${message}</p>
                <button onclick="location.reload()" class="location-btn" style="margin-top: 1rem; cursor: pointer;">다시 시도</button>
            </div>
        `;
    }
}

/* ==========================================
   URL 파라미터 관리
   ========================================== */

function updateUrlParams() {
    const params = new URLSearchParams();

    if (currentFilters.category !== 'all') params.set('category', currentFilters.category);
    if (currentFilters.region !== 'all') params.set('region', currentFilters.region);
    if (currentFilters.association !== 'all') params.set('association', currentFilters.association);
    if (currentFilters.partnerType !== 'all') params.set('partnerType', currentFilters.partnerType);
    if (currentFilters.search) params.set('search', currentFilters.search);

    const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;

    window.history.replaceState({}, '', newUrl);
}

function loadUrlParams() {
    const params = new URLSearchParams(window.location.search);

    if (params.get('category')) {
        currentFilters.category = params.get('category');
        activateFilterButton('categoryFilters', 'category', currentFilters.category);
    }
    if (params.get('region')) {
        currentFilters.region = params.get('region');
        activateFilterButton('regionFilters', 'region', currentFilters.region);
    }
    if (params.get('association')) {
        currentFilters.association = params.get('association');
        activateFilterButton('associationFilters', 'association', currentFilters.association);
    }
    if (params.get('partnerType')) {
        currentFilters.partnerType = params.get('partnerType');
        activateFilterButton('partnerTypeFilters', 'partnerType', currentFilters.partnerType);
    }
    if (params.get('search')) {
        currentFilters.search = params.get('search');
        const searchInput = document.getElementById('partnerSearch');
        if (searchInput) searchInput.value = currentFilters.search;
    }
}

function activateFilterButton(containerId, dataAttr, value) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset[dataAttr] === value) {
            btn.classList.add('active');
        }
    });
}

/* ==========================================
   캐시 관리
   ========================================== */

function getCache() {
    try {
        const cached = localStorage.getItem(CONFIG.cacheKey);
        if (!cached) return null;

        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp > CONFIG.cacheDuration) {
            localStorage.removeItem(CONFIG.cacheKey);
            return null;
        }
        return data;
    } catch (error) {
        console.error('캐시 로드 실패:', error);
        return null;
    }
}

function setCache(data) {
    try {
        localStorage.setItem(CONFIG.cacheKey, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    } catch (error) {
        console.error('캐시 저장 실패:', error);
    }
}

/* ==========================================
   토스트 알림
   ========================================== */

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // 아이콘 선택
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '❌';
    else if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;

    toastContainer.appendChild(toast);

    // 애니메이션 시작
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    // 자동 제거
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* ==========================================
   스크롤 애니메이션
   ========================================== */

function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-up');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // 파트너 카드 관찰
    const cards = document.querySelectorAll('.partner-card');
    cards.forEach(card => {
        card.style.opacity = '0';
        observer.observe(card);
    });
}

/* ==========================================
   즐겨찾기 관리
   ========================================== */

class FavoritesManager {
    constructor() {
        this.storageKey = 'fresco21_favorites';
        this.favorites = this.load();
    }

    load() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey)) || [];
        } catch {
            return [];
        }
    }

    save() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.favorites));
    }

    add(partnerId) {
        if (!this.favorites.includes(partnerId)) {
            this.favorites.push(partnerId);
            this.save();
            showToast('즐겨찾기에 추가되었습니다', 'success');
        }
    }

    remove(partnerId) {
        this.favorites = this.favorites.filter(function(id) { return id !== partnerId; });
        this.save();
        showToast('즐겨찾기에서 제거되었습니다', 'info');
    }

    toggle(partnerId) {
        this.isFavorite(partnerId) ? this.remove(partnerId) : this.add(partnerId);
    }

    isFavorite(partnerId) {
        return this.favorites.includes(partnerId);
    }
}

const favoritesManager = new FavoritesManager();

/* ==========================================
   공유 기능
   ========================================== */

async function sharePartner(partner) {
    const shareData = {
        title: partner.name + ' - 프레스코21 제휴 공방',
        text: partner.address + '에 위치한 ' + partner.category.join(', ') + ' 전문 공방을 확인해보세요!',
        url: window.location.origin + window.location.pathname + '?partner=' + partner.id
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
            showToast('공유되었습니다!', 'success');
        } else {
            // Fallback: 클립보드 복사
            await navigator.clipboard.writeText(shareData.url);
            showToast('링크가 복사되었습니다!', 'success');
        }
    } catch (error) {
        console.error('Share failed:', error);
    }
}

/* ==========================================
   URL 딥링크 처리
   ========================================== */

function handleDeepLink() {
    const params = new URLSearchParams(window.location.search);

    // ?partner=123 -> 해당 파트너 상세보기
    if (params.has('partner')) {
        const partnerId = params.get('partner');
        const partner = partners.find(function(p) { return p.id == partnerId; });
        if (partner) {
            showPartnerDetail(partner);
            map.panTo(new naver.maps.LatLng(partner.lat, partner.lng));
            map.setZoom(15);
        }
    }

    // ?nearby=true -> 내 위치 검색
    if (params.get('nearby') === 'true') {
        setTimeout(function() {
            searchNearby();
        }, 1000);
    }

    // ?category=압화 -> 카테고리 필터
    if (params.has('category')) {
        currentFilters.category = params.get('category');
        applyFilters();
    }
}

/* ==========================================
   iframe 높이 자동 조정 (메이크샵용)
   ========================================== */

function notifyParentOfHeight() {
    if (window.parent !== window) {
        const height = document.documentElement.scrollHeight;
        window.parent.postMessage({
            type: 'resize',
            height: height
        }, '*');
    }
}

/* ==========================================
   초기화 실행 (common.js 패턴)
   ========================================== */

document.addEventListener('DOMContentLoaded', function() {
    // 파트너맵 요소가 있을 때만 실행
    if (document.getElementById('naverMap')) {
        initPartnerMap().then(function() {
            handleDeepLink();
            notifyParentOfHeight();
        });
    }
});

// 윈도우 리사이즈 시 높이 알림
window.addEventListener('resize', debounce(notifyParentOfHeight, 300));
window.addEventListener('load', notifyParentOfHeight);
