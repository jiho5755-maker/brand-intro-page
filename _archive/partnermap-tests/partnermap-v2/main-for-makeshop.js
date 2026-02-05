/* ==========================================
   Partner Map Service - MakeShop Version
   프레스코21 제휴 공방 지도 서비스
   ========================================== */

// 네이버 지도 API 설정
const NAVER_MAP_NCP_KEY_ID = 'bfp8odep5r';
const GOOGLE_SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbxfp4SbpsUCmQu0gnF02r8oMY0dzzadElkcTcFNSsxPNo3x4zsNcw-z8MvJ3F7xskP6Yw/exec';

const CONFIG = {
    defaultCenter: { lat: 37.5665, lng: 126.9780 },
    defaultZoom: 11,
    cacheKey: 'fresco21_partners',
    cacheDuration: 24 * 60 * 60 * 1000
};

let map = null;
let markers = [];
let partners = [];
let filteredPartners = [];
let currentFilters = {
    category: 'all',
    region: 'all',
    search: ''
};

/* 네이버 지도 SDK 로드 */
function loadNaverMapSDK() {
    return new Promise(function(resolve, reject) {
        if (window.naver && window.naver.maps) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=' + NAVER_MAP_NCP_KEY_ID + '&t=' + Date.now();
        script.async = true;

        script.onload = function() { resolve(); };
        script.onerror = function() { reject(new Error('네이버 지도 로드 실패')); };

        document.head.appendChild(script);
    });
}

/* 초기화 */
async function initPartnerMap() {
    try {
        await loadNaverMapSDK();
        partners = await loadPartnerData();
        filteredPartners = partners;
        initMap();
        generateFilters();
        createMarkers();
        renderPartnerList();
        setupEventListeners();
        hideLoading();
        showToast(partners.length + '개의 제휴 공방을 불러왔습니다.', 'success');
    } catch (error) {
        console.error('초기화 실패:', error);
        showError('지도를 불러오는 중 오류가 발생했습니다.');
        showToast('지도를 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

/* 지도 초기화 */
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
}

/* 데이터 로드 */
async function loadPartnerData() {
    const cached = getCache();
    if (cached) return cached;

    try {
        const response = await fetch(GOOGLE_SHEET_API_URL);
        const data = await response.json();

        const partners = data
            .filter(function(p) { return p.status === 'active' && p.lat && p.lng; })
            .map(function(p) {
                return {
                    id: p.id,
                    name: p.name,
                    category: p.category ? p.category.split(',').map(function(c) { return c.trim(); }) : [],
                    address: p.address,
                    lat: parseFloat(p.lat),
                    lng: parseFloat(p.lng),
                    phone: p.phone,
                    email: p.email,
                    description: p.description,
                    imageUrl: p.imageUrl,
                    logoUrl: p.logoUrl,
                    partnerType: p.partnerType
                };
            });

        setCache(partners);
        return partners;
    } catch (error) {
        console.error('데이터 로드 실패:', error);
        return [];
    }
}

/* 필터 생성 */
function generateFilters() {
    const categories = new Set();
    partners.forEach(function(p) {
        p.category.forEach(function(cat) { categories.add(cat); });
    });

    const categoryFilters = document.getElementById('categoryFilters');
    categories.forEach(function(cat) {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.dataset.category = cat;
        btn.textContent = cat;
        categoryFilters.appendChild(btn);
    });

    const regions = new Set();
    partners.forEach(function(p) {
        const region = extractRegion(p.address);
        if (region) regions.add(region);
    });

    const regionFilters = document.getElementById('regionFilters');
    Array.from(regions).sort().forEach(function(region) {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.dataset.region = region;
        btn.textContent = region;
        regionFilters.appendChild(btn);
    });
}

/* 마커 생성 */
function createMarkers() {
    markers.forEach(function(marker) { marker.setMap(null); });
    markers = [];

    filteredPartners.forEach(function(partner) {
        const position = new naver.maps.LatLng(partner.lat, partner.lng);

        const marker = new naver.maps.Marker({
            position: position,
            map: map,
            title: partner.name,
            icon: {
                content: createMarkerIcon(partner),
                anchor: new naver.maps.Point(20, 40)
            }
        });

        naver.maps.Event.addListener(marker, 'click', function() {
            showPartnerDetail(partner);
            map.panTo(position);
        });

        markers.push(marker);
    });

    if (filteredPartners.length > 0) {
        adjustMapBounds();
    }
}

function createMarkerIcon(partner) {
    let color = '#7D9675';

    if (partner.partnerType) {
        if (partner.partnerType.includes('협회') || partner.partnerType === '협회') {
            color = '#5A7FA8';
        } else if (partner.partnerType.includes('인플루언서') || partner.partnerType === '인플루언서') {
            color = '#C9A961';
        }
    }

    const flowerIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="white" style="margin-right: 6px;"><path d="M12 2C12 2 10.5 6 10.5 8.5C10.5 9.88 11.12 11 12 11C12.88 11 13.5 9.88 13.5 8.5C13.5 6 12 2 12 2Z"/><path d="M16.24 7.76C16.24 7.76 15 11.5 16 13C16.5 13.75 17.5 14 18.5 13.5C19.5 13 20 12 19.5 10.5C19 9 16.24 7.76 16.24 7.76Z"/><path d="M7.76 7.76C7.76 7.76 5 9 4.5 10.5C4 12 4.5 13 5.5 13.5C6.5 14 7.5 13.75 8 13C9 11.5 7.76 7.76 7.76 7.76Z"/><path d="M12 12C10.34 12 9 13.34 9 15C9 16.66 10.34 18 12 18C13.66 18 15 16.66 15 15C15 13.34 13.66 12 12 12Z"/><path d="M8.5 16.5C8.5 16.5 6.5 19 7 20.5C7.5 22 9 22 10 21C11 20 10.5 18 9.5 17C8.5 16 8.5 16.5 8.5 16.5Z"/><path d="M15.5 16.5C15.5 16.5 17.5 19 17 20.5C16.5 22 15 22 14 21C13 20 13.5 18 14.5 17C15.5 16 15.5 16.5 15.5 16.5Z"/></svg>';

    return '<div style="display: flex;align-items: center;gap: 4px;background: white;padding: 10px 16px;border-radius: 9999px;box-shadow: 0 8px 32px rgba(0,0,0,0.12);border: 2px solid ' + color + ';font-family: Pretendard, sans-serif;font-size: 14px;font-weight: 600;color: ' + color + ';white-space: nowrap;transition: all 0.3s ease;" onmouseover="this.style.transform=\'translateY(-2px)\'; this.style.boxShadow=\'0 12px 40px rgba(0,0,0,0.2)\';" onmouseout="this.style.transform=\'translateY(0)\'; this.style.boxShadow=\'0 8px 32px rgba(0,0,0,0.12)\';">' + flowerIcon + escapeHtml(partner.name) + '</div>';
}

function adjustMapBounds() {
    const bounds = new naver.maps.LatLngBounds();
    filteredPartners.forEach(function(partner) {
        bounds.extend(new naver.maps.LatLng(partner.lat, partner.lng));
    });
    map.fitBounds(bounds);
}

/* 필터링 */
function applyFilters() {
    filteredPartners = partners.filter(function(partner) {
        if (currentFilters.category !== 'all' && !partner.category.includes(currentFilters.category)) {
            return false;
        }

        if (currentFilters.region !== 'all') {
            const region = extractRegion(partner.address);
            if (region !== currentFilters.region) {
                return false;
            }
        }

        if (currentFilters.search) {
            const query = currentFilters.search.toLowerCase();
            const nameMatch = partner.name.toLowerCase().includes(query);
            const addressMatch = partner.address.toLowerCase().includes(query);
            if (!nameMatch && !addressMatch) {
                return false;
            }
        }

        return true;
    });

    createMarkers();
    renderPartnerList();
}

function extractRegion(address) {
    const match = address.match(/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/);
    return match ? match[1] : '기타';
}

/* 리스트 렌더링 */
function renderPartnerList() {
    const listContainer = document.getElementById('partnerList');
    const resultCount = document.getElementById('resultCount');

    resultCount.textContent = filteredPartners.length + '개';

    if (filteredPartners.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">검색 결과가 없습니다.</p>';
        return;
    }

    listContainer.innerHTML = filteredPartners.map(function(partner) {
        return createPartnerCardHTML(partner);
    }).join('');

    listContainer.querySelectorAll('.partner-card').forEach(function(card) {
        card.addEventListener('click', function() {
            const id = this.dataset.id;
            const partner = partners.find(function(p) { return p.id == id; });
            if (partner) {
                showPartnerDetail(partner);
                const position = new naver.maps.LatLng(partner.lat, partner.lng);
                map.panTo(position);
                map.setZoom(15);
            }
        });
    });

    setTimeout(function() {
        initScrollAnimations();
    }, 100);
}

function createPartnerCardHTML(partner) {
    const categoriesHTML = partner.category.map(function(cat) {
        return '<span class="category-tag">' + escapeHtml(cat) + '</span>';
    }).join('');

    return '<div class="partner-card" data-id="' + partner.id + '"><div class="partner-logo"><img src="' + (partner.logoUrl || './images/default-logo.jpg') + '" alt="' + escapeHtml(partner.name) + '" onerror="this.src=\'./images/default-logo.jpg\'"></div><div class="partner-info"><h4>' + escapeHtml(partner.name) + '</h4><div class="partner-categories">' + categoriesHTML + '</div><p class="partner-address">📍 ' + escapeHtml(partner.address) + '</p><p class="partner-phone">📞 ' + escapeHtml(partner.phone) + '</p></div></div>';
}

/* 모달 */
function showPartnerDetail(partner) {
    const modal = document.getElementById('partnerModal');
    const modalBody = document.getElementById('modalBody');

    const categoriesHTML = partner.category.length > 0 ? '<div class="partner-categories">' + partner.category.map(function(cat) {
        return '<span class="category-tag">' + escapeHtml(cat) + '</span>';
    }).join('') + '</div>' : '';

    const imageHTML = partner.imageUrl ? '<img src="' + partner.imageUrl + '" class="modal-image" alt="' + escapeHtml(partner.name) + '">' : '';

    const emailHTML = partner.email ? '<p>📧 ' + escapeHtml(partner.email) + '</p>' : '';

    modalBody.innerHTML = '<div class="modal-header"><img src="' + (partner.logoUrl || './images/default-logo.jpg') + '" alt="' + escapeHtml(partner.name) + '" onerror="this.src=\'./images/default-logo.jpg\'"><h2>' + escapeHtml(partner.name) + '</h2>' + categoriesHTML + '</div>' + imageHTML + '<div class="modal-section"><h3>소개</h3><p>' + (partner.description ? escapeHtml(partner.description) : '소개 정보가 없습니다.') + '</p></div><div class="modal-section"><h3>위치 정보</h3><p class="address">📍 ' + escapeHtml(partner.address) + '</p><a href="https://map.naver.com/v5/directions/-/-/-/car?c=' + partner.lng + ',' + partner.lat + ',15" target="_blank" class="map-link-btn">네이버 지도로 길찾기</a></div><div class="modal-section"><h3>연락처</h3><p>📞 ' + escapeHtml(partner.phone) + '</p>' + emailHTML + '</div>';

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('partnerModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

/* GPS 위치 검색 */
function searchNearby() {
    if (!navigator.geolocation) {
        showToast('위치 서비스를 지원하지 않는 브라우저입니다.', 'error');
        return;
    }

    showToast('현재 위치를 확인하는 중...', 'info');

    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            filteredPartners = partners.map(function(partner) {
                return Object.assign({}, partner, {
                    distance: calculateDistance(lat, lng, partner.lat, partner.lng)
                });
            }).sort(function(a, b) { return a.distance - b.distance; });

            const myPosition = new naver.maps.LatLng(lat, lng);
            map.panTo(myPosition);
            map.setZoom(13);

            renderPartnerList();
            showToast('내 위치 주변 공방을 찾았습니다!', 'success');
        },
        function(error) {
            showToast('위치를 가져올 수 없습니다. GPS를 켜주세요.', 'error');
        }
    );
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/* 이벤트 리스너 */
function setupEventListeners() {
    document.querySelectorAll('#categoryFilters .filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#categoryFilters .filter-btn').forEach(function(b) {
                b.classList.remove('active');
            });
            this.classList.add('active');
            currentFilters.category = this.dataset.category;
            applyFilters();
        });
    });

    document.querySelectorAll('#regionFilters .filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#regionFilters .filter-btn').forEach(function(b) {
                b.classList.remove('active');
            });
            this.classList.add('active');
            currentFilters.region = this.dataset.region;
            applyFilters();
        });
    });

    const searchInput = document.getElementById('partnerSearch');
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            currentFilters.search = searchInput.value;
            applyFilters();
        }
    });

    searchInput.addEventListener('input', debounce(function() {
        currentFilters.search = this.value;
        applyFilters();
    }, 300));

    document.getElementById('myLocationBtn').addEventListener('click', searchNearby);

    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', closeModal);

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeModal();
    });
}

/* 유틸리티 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction() {
        const args = arguments;
        const context = this;
        const later = function() {
            clearTimeout(timeout);
            func.apply(context, args);
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
        loading.innerHTML = '<div style="text-align: center; color: var(--text-primary);"><p style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">⚠️ 오류 발생</p><p style="font-size: 0.875rem; color: var(--text-secondary);">' + message + '</p><button onclick="location.reload()" class="location-btn" style="margin-top: 1rem; cursor: pointer;">다시 시도</button></div>';
    }
}

/* 캐시 관리 */
function getCache() {
    try {
        const cached = localStorage.getItem(CONFIG.cacheKey);
        if (!cached) return null;

        const data = JSON.parse(cached);
        if (Date.now() - data.timestamp > CONFIG.cacheDuration) {
            localStorage.removeItem(CONFIG.cacheKey);
            return null;
        }
        return data.data;
    } catch (error) {
        console.error('캐시 로드 실패:', error);
        return null;
    }
}

function setCache(data) {
    try {
        localStorage.setItem(CONFIG.cacheKey, JSON.stringify({
            data: data,
            timestamp: Date.now()
        }));
    } catch (error) {
        console.error('캐시 저장 실패:', error);
    }
}

/* 토스트 알림 */
function showToast(message, type) {
    type = type || 'info';
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '❌';
    else if (type === 'warning') icon = '⚠️';

    toast.innerHTML = '<span class="toast-icon">' + icon + '</span><span class="toast-message">' + escapeHtml(message) + '</span>';

    toastContainer.appendChild(toast);

    setTimeout(function() {
        toast.classList.add('show');
    }, 100);

    setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
}

/* 스크롤 애니메이션 */
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-up');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const cards = document.querySelectorAll('.partner-card');
    cards.forEach(function(card) {
        card.style.opacity = '0';
        observer.observe(card);
    });
}

/* 초기화 실행 */
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('naverMap')) {
        initPartnerMap();
    }
});
