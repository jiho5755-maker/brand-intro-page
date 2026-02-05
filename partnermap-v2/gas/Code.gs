/**
 * 프레스코21 파트너 등록 자동화 시스템
 * Google Apps Script
 *
 * 기능:
 * - doGet: 승인된 파트너 목록 조회 (기존 API)
 * - doPost: 파트너 등록 API (신규)
 * - onFormSubmit: Google Forms 제출 처리
 * - processPartnerEmails: 이메일 자동 파싱
 * - processBulkUpload: CSV 대량 업로드
 */

// ==========================================
// 설정
// ==========================================

const CONFIG = {
  // 시트 이름
  SHEETS: {
    PARTNERS: '제휴업체',
    PENDING: '신청대기',
    REJECTED: '거부보류',
    BLACKLIST: '블랙리스트',
    ASSOCIATIONS: '협회목록',
    API_KEYS: 'API키관리',
    LOGS: '로그'
  },

  // 열 인덱스 (1-based)
  COLUMNS: {
    ID: 1,
    NAME: 2,
    OWNER: 3,
    BIZ_NUMBER: 4,
    ADDRESS: 5,
    DETAIL_ADDRESS: 6,
    PHONE: 7,
    EMAIL: 8,
    CATEGORY: 9,
    ASSOCIATION: 10,
    PARTNER_TYPE: 11,
    DESCRIPTION: 12,
    LOGO_URL: 13,
    IMAGE_URL: 14,
    LAT: 15,
    LNG: 16,
    STATUS: 17,
    CREATED_AT: 18,
    UPDATED_AT: 19,
    CHANNEL: 20,
    MEMO: 21
  },

  // 심사 상태
  STATUS: {
    PENDING: '승인대기',
    APPROVED: '승인',
    REJECTED: '거부',
    HOLD: '보류',
    AUTO_APPROVED: '자동승인',
    AUTO_REJECTED: '자동거부'
  },

  // 등록 채널
  CHANNELS: {
    FORM: '웹폼',
    API: 'API',
    EMAIL: '이메일',
    BULK: '대량업로드',
    MANUAL: '수동입력'
  },

  // 자동 승인 규칙
  APPROVAL: {
    REQUIRED_FIELDS: ['name', 'address', 'phone', 'email', 'category'],
    MIN_FIELDS: ['name', 'address', 'phone']
  }
};

// ==========================================
// 메인 엔트리포인트
// ==========================================

/**
 * GET 요청 처리 - 파트너 목록 조회
 */
function doGet(e) {
  try {
    const action = e.parameter.action || 'list';

    switch (action) {
      case 'list':
        return getPartnersList();
      case 'status':
        return getPartnerStatus(e.parameter.id);
      default:
        return jsonResponse({ error: 'Invalid action' }, 400);
    }
  } catch (error) {
    console.error('doGet error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

/**
 * POST 요청 처리 - 파트너 등록
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = e.parameter.action || 'register';
    const apiKey = e.parameter.apiKey;

    // API 키 검증 (bulk 업로드는 관리자 키 필요)
    if (action === 'bulk' && !validateAdminKey(apiKey)) {
      return jsonResponse({ error: 'Admin authorization required' }, 403);
    }

    if (action !== 'register' && !validateApiKey(apiKey)) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    switch (action) {
      case 'register':
        return registerPartner(data, CONFIG.CHANNELS.API);
      case 'bulk':
        return processBulkUpload(data.partners);
      default:
        return jsonResponse({ error: 'Invalid action' }, 400);
    }
  } catch (error) {
    console.error('doPost error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

/**
 * Google Forms 제출 트리거
 */
function onFormSubmit(e) {
  try {
    const responses = e.namedValues;

    const data = {
      name: responses['업체명'] ? responses['업체명'][0] : '',
      owner: responses['대표자명'] ? responses['대표자명'][0] : '',
      address: responses['주소'] ? responses['주소'][0] : '',
      phone: responses['연락처'] ? responses['연락처'][0] : '',
      email: responses['이메일'] ? responses['이메일'][0] : '',
      category: responses['카테고리'] ? responses['카테고리'][0] : '',
      association: responses['협회'] ? responses['협회'][0] : '',
      description: responses['소개'] ? responses['소개'][0] : '',
      bizNumber: responses['사업자번호'] ? responses['사업자번호'][0] : ''
    };

    registerPartner(data, CONFIG.CHANNELS.FORM);

  } catch (error) {
    console.error('onFormSubmit error:', error);
    logError('onFormSubmit', error);
  }
}

// ==========================================
// 파트너 등록 처리
// ==========================================

/**
 * 파트너 등록
 */
function registerPartner(data, channel) {
  // 1. 데이터 검증
  const validation = validatePartnerData(data);
  if (!validation.valid) {
    return jsonResponse({
      success: false,
      error: 'Validation failed',
      details: validation.errors
    }, 400);
  }

  // 2. 중복 체크
  if (isDuplicate(data.name, data.address)) {
    return jsonResponse({
      success: false,
      error: 'Duplicate entry',
      message: '이미 등록된 업체입니다.'
    }, 409);
  }

  // 3. 블랙리스트 체크
  if (isBlacklisted(data.email, data.phone)) {
    logAction('BLACKLIST_BLOCKED', data);
    return jsonResponse({
      success: false,
      error: 'Registration blocked'
    }, 403);
  }

  // 4. 신청대기 시트에 저장
  const partnerId = savePartnerToPending(data, channel);

  // 5. 주소 → 좌표 변환
  geocodePartnerAddress(partnerId);

  // 6. 조건부 자동 승인 처리
  const approvalResult = processAutoApproval(partnerId);

  // 7. 알림 발송
  if (approvalResult.approved) {
    notifyPartner('approved', data);
  } else {
    notifyPartner('pending', data);
  }
  notifyAdmin(approvalResult.status, data);

  // 8. 로그 기록
  logAction('REGISTER', { partnerId, channel, status: approvalResult.status });

  return jsonResponse({
    success: true,
    partnerId: partnerId,
    status: approvalResult.status,
    message: approvalResult.message
  }, 201);
}

/**
 * 신청대기 시트에 저장
 */
function savePartnerToPending(data, channel) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PENDING);

  const partnerId = generatePartnerId();
  const now = new Date();

  const row = [
    partnerId,
    data.name || '',
    data.owner || '',
    data.bizNumber || '',
    data.address || '',
    data.detailAddress || '',
    data.phone || '',
    data.email || '',
    Array.isArray(data.category) ? data.category.join(',') : (data.category || ''),
    data.association || '',
    data.partnerType || '',
    data.description || '',
    data.logoUrl || '',
    data.imageUrl || '',
    '', // lat (geocoding으로 채움)
    '', // lng
    CONFIG.STATUS.PENDING,
    now,
    now,
    channel,
    ''
  ];

  sheet.appendRow(row);

  return partnerId;
}

/**
 * 파트너 ID 생성
 */
function generatePartnerId() {
  const timestamp = new Date().getTime();
  const random = Math.floor(Math.random() * 1000);
  return `P${timestamp}${random}`;
}

// ==========================================
// 데이터 검증
// ==========================================

/**
 * 파트너 데이터 검증
 */
function validatePartnerData(data) {
  const errors = [];

  // 필수 필드 체크
  if (!data.name || data.name.trim() === '') {
    errors.push({ field: 'name', message: '업체명은 필수입니다.' });
  }

  if (!data.address || data.address.trim() === '') {
    errors.push({ field: 'address', message: '주소는 필수입니다.' });
  }

  if (!data.phone || data.phone.trim() === '') {
    errors.push({ field: 'phone', message: '연락처는 필수입니다.' });
  }

  // 이메일 형식 체크
  if (data.email && !isValidEmail(data.email)) {
    errors.push({ field: 'email', message: '유효한 이메일 형식이 아닙니다.' });
  }

  // 전화번호 형식 체크
  if (data.phone && !isValidPhone(data.phone)) {
    errors.push({ field: 'phone', message: '유효한 전화번호 형식이 아닙니다.' });
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function isValidPhone(phone) {
  const cleaned = phone.replace(/[-\s]/g, '');
  return /^0\d{9,10}$/.test(cleaned);
}

// ==========================================
// 중복/블랙리스트 체크
// ==========================================

/**
 * 중복 체크
 */
function isDuplicate(name, address) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 제휴업체 시트 확인
  const partnersSheet = ss.getSheetByName(CONFIG.SHEETS.PARTNERS);
  if (partnersSheet) {
    const data = partnersSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][CONFIG.COLUMNS.NAME - 1] === name &&
          data[i][CONFIG.COLUMNS.ADDRESS - 1] === address) {
        return true;
      }
    }
  }

  // 신청대기 시트 확인
  const pendingSheet = ss.getSheetByName(CONFIG.SHEETS.PENDING);
  if (pendingSheet) {
    const data = pendingSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][CONFIG.COLUMNS.NAME - 1] === name &&
          data[i][CONFIG.COLUMNS.ADDRESS - 1] === address) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 블랙리스트 체크
 */
function isBlacklisted(email, phone) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.BLACKLIST);

  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const blockedValue = data[i][0]; // 첫 번째 열: 차단 값
    const blockedType = data[i][1];  // 두 번째 열: 타입 (email/phone/name)

    if (blockedType === 'email' && email === blockedValue) return true;
    if (blockedType === 'phone' && phone === blockedValue) return true;
  }

  return false;
}

// ==========================================
// Geocoding (주소 → 좌표)
// ==========================================

/**
 * 파트너 주소 Geocoding
 */
function geocodePartnerAddress(partnerId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PENDING);
  const data = sheet.getDataRange().getValues();

  // 파트너 행 찾기
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][CONFIG.COLUMNS.ID - 1] === partnerId) {
      rowIndex = i + 1; // 1-based
      break;
    }
  }

  if (rowIndex === -1) return;

  const address = data[rowIndex - 1][CONFIG.COLUMNS.ADDRESS - 1];

  if (!address) return;

  try {
    const geocodeResult = geocodeAddress(address);

    if (geocodeResult.success) {
      sheet.getRange(rowIndex, CONFIG.COLUMNS.LAT).setValue(geocodeResult.lat);
      sheet.getRange(rowIndex, CONFIG.COLUMNS.LNG).setValue(geocodeResult.lng);
    } else {
      // 메모에 에러 기록
      sheet.getRange(rowIndex, CONFIG.COLUMNS.MEMO).setValue(
        `Geocoding 실패: ${geocodeResult.error}`
      );
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
}

/**
 * Google Maps Geocoding API 호출
 */
function geocodeAddress(address) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GOOGLE_MAPS_API_KEY');

  if (!apiKey) {
    // API 키가 없으면 Maps 서비스 사용
    try {
      const geocoder = Maps.newGeocoder().setLanguage('ko');
      const response = geocoder.geocode(address);

      if (response.results && response.results.length > 0) {
        const location = response.results[0].geometry.location;
        return {
          success: true,
          lat: location.lat,
          lng: location.lng
        };
      }
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // API 키가 있으면 직접 호출
  const encodedAddress = encodeURIComponent(address);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}&language=ko`;

  try {
    const response = UrlFetchApp.fetch(url);
    const result = JSON.parse(response.getContentText());

    if (result.status === 'OK' && result.results.length > 0) {
      const location = result.results[0].geometry.location;
      return {
        success: true,
        lat: location.lat,
        lng: location.lng
      };
    }

    return { success: false, error: result.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==========================================
// 조건부 자동 승인
// ==========================================

/**
 * 자동 승인 처리
 */
function processAutoApproval(partnerId) {
  const partner = getPartnerById(partnerId, CONFIG.SHEETS.PENDING);

  if (!partner) {
    return { approved: false, status: 'ERROR', message: '파트너를 찾을 수 없습니다.' };
  }

  const score = calculateApprovalScore(partner);

  // 자동 거부
  if (score.autoReject) {
    updatePartnerStatus(partnerId, CONFIG.STATUS.AUTO_REJECTED, CONFIG.SHEETS.PENDING);
    moveToRejected(partnerId, score.rejectReason);
    return {
      approved: false,
      status: CONFIG.STATUS.AUTO_REJECTED,
      message: `자동 거부됨: ${score.rejectReason}`
    };
  }

  // 자동 승인
  if (score.autoApprove) {
    updatePartnerStatus(partnerId, CONFIG.STATUS.AUTO_APPROVED, CONFIG.SHEETS.PENDING);
    moveToApproved(partnerId);
    return {
      approved: true,
      status: CONFIG.STATUS.AUTO_APPROVED,
      message: '자동 승인되었습니다.'
    };
  }

  // 수동 검토 필요
  return {
    approved: false,
    status: CONFIG.STATUS.PENDING,
    message: '관리자 검토가 필요합니다.',
    missingFields: score.missingFields
  };
}

/**
 * 승인 점수 계산
 */
function calculateApprovalScore(partner) {
  const result = {
    autoApprove: true,
    autoReject: false,
    rejectReason: null,
    missingFields: [],
    score: 0
  };

  // 1. 필수 필드 체크
  CONFIG.APPROVAL.REQUIRED_FIELDS.forEach(field => {
    if (!partner[field] || partner[field].toString().trim() === '') {
      result.autoApprove = false;
      result.missingFields.push(field);
    } else {
      result.score += 10;
    }
  });

  // 2. 좌표 유효성 체크
  if (!partner.lat || !partner.lng) {
    result.autoApprove = false;
    result.missingFields.push('coordinates');
  } else {
    result.score += 20;
  }

  // 3. 협회 인증 체크 (보너스)
  if (partner.association && isVerifiedAssociation(partner.association)) {
    result.score += 30;
    result.associationVerified = true;
  }

  // 4. 최소 조건 미충족 시 자동 거부
  let minFieldsMet = true;
  CONFIG.APPROVAL.MIN_FIELDS.forEach(field => {
    if (!partner[field] || partner[field].toString().trim() === '') {
      minFieldsMet = false;
    }
  });

  if (!minFieldsMet) {
    result.autoReject = true;
    result.rejectReason = '최소 필수 정보 미입력';
  }

  return result;
}

/**
 * 협회 인증 확인
 */
function isVerifiedAssociation(association) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.ASSOCIATIONS);

  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === association && data[i][1] === '인증') {
      return true;
    }
  }

  return false;
}

// ==========================================
// 시트 간 이동
// ==========================================

/**
 * 승인 시트로 이동
 */
function moveToApproved(partnerId) {
  movePartnerBetweenSheets(
    partnerId,
    CONFIG.SHEETS.PENDING,
    CONFIG.SHEETS.PARTNERS
  );
}

/**
 * 거부 시트로 이동
 */
function moveToRejected(partnerId, reason) {
  const partner = getPartnerById(partnerId, CONFIG.SHEETS.PENDING);
  if (partner) {
    partner.memo = reason;
  }

  movePartnerBetweenSheets(
    partnerId,
    CONFIG.SHEETS.PENDING,
    CONFIG.SHEETS.REJECTED
  );
}

/**
 * 시트 간 파트너 이동
 */
function movePartnerBetweenSheets(partnerId, fromSheetName, toSheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const fromSheet = ss.getSheetByName(fromSheetName);
  const toSheet = ss.getSheetByName(toSheetName);

  if (!fromSheet || !toSheet) return;

  const data = fromSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][CONFIG.COLUMNS.ID - 1] === partnerId) {
      // 대상 시트에 복사
      toSheet.appendRow(data[i]);

      // 원본 시트에서 삭제
      fromSheet.deleteRow(i + 1);

      break;
    }
  }
}

// ==========================================
// 파트너 조회
// ==========================================

/**
 * ID로 파트너 조회
 */
function getPartnerById(partnerId, sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName || CONFIG.SHEETS.PARTNERS);

  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  for (let i = 1; i < data.length; i++) {
    if (data[i][CONFIG.COLUMNS.ID - 1] === partnerId) {
      const partner = {};

      // 열 이름에 맞게 매핑
      partner.id = data[i][CONFIG.COLUMNS.ID - 1];
      partner.name = data[i][CONFIG.COLUMNS.NAME - 1];
      partner.owner = data[i][CONFIG.COLUMNS.OWNER - 1];
      partner.address = data[i][CONFIG.COLUMNS.ADDRESS - 1];
      partner.phone = data[i][CONFIG.COLUMNS.PHONE - 1];
      partner.email = data[i][CONFIG.COLUMNS.EMAIL - 1];
      partner.category = data[i][CONFIG.COLUMNS.CATEGORY - 1];
      partner.association = data[i][CONFIG.COLUMNS.ASSOCIATION - 1];
      partner.lat = data[i][CONFIG.COLUMNS.LAT - 1];
      partner.lng = data[i][CONFIG.COLUMNS.LNG - 1];
      partner.status = data[i][CONFIG.COLUMNS.STATUS - 1];

      return partner;
    }
  }

  return null;
}

/**
 * 승인된 파트너 목록 조회 (기존 API)
 */
function getPartnersList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PARTNERS);

  if (!sheet) {
    return jsonResponse({ success: false, error: 'Sheet not found' }, 404);
  }

  const data = sheet.getDataRange().getValues();
  const partners = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    // 승인된 데이터만 포함
    if (row[CONFIG.COLUMNS.STATUS - 1] !== CONFIG.STATUS.APPROVED &&
        row[CONFIG.COLUMNS.STATUS - 1] !== CONFIG.STATUS.AUTO_APPROVED) {
      continue;
    }

    // 좌표 필수
    if (!row[CONFIG.COLUMNS.LAT - 1] || !row[CONFIG.COLUMNS.LNG - 1]) {
      continue;
    }

    partners.push({
      id: row[CONFIG.COLUMNS.ID - 1],
      name: row[CONFIG.COLUMNS.NAME - 1],
      address: row[CONFIG.COLUMNS.ADDRESS - 1],
      phone: row[CONFIG.COLUMNS.PHONE - 1],
      email: row[CONFIG.COLUMNS.EMAIL - 1],
      category: row[CONFIG.COLUMNS.CATEGORY - 1],
      association: row[CONFIG.COLUMNS.ASSOCIATION - 1],
      partnerType: row[CONFIG.COLUMNS.PARTNER_TYPE - 1],
      description: row[CONFIG.COLUMNS.DESCRIPTION - 1],
      logoUrl: row[CONFIG.COLUMNS.LOGO_URL - 1],
      imageUrl: row[CONFIG.COLUMNS.IMAGE_URL - 1],
      lat: row[CONFIG.COLUMNS.LAT - 1],
      lng: row[CONFIG.COLUMNS.LNG - 1]
    });
  }

  return jsonResponse({
    success: true,
    partners: partners,
    count: partners.length,
    timestamp: new Date().toISOString()
  });
}

/**
 * 파트너 상태 업데이트
 */
function updatePartnerStatus(partnerId, status, sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName || CONFIG.SHEETS.PENDING);

  if (!sheet) return;

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][CONFIG.COLUMNS.ID - 1] === partnerId) {
      sheet.getRange(i + 1, CONFIG.COLUMNS.STATUS).setValue(status);
      sheet.getRange(i + 1, CONFIG.COLUMNS.UPDATED_AT).setValue(new Date());
      break;
    }
  }
}

// ==========================================
// 알림
// ==========================================

/**
 * 관리자 알림
 */
function notifyAdmin(status, partner) {
  const adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');

  if (!adminEmail) return;

  const subjects = {
    [CONFIG.STATUS.AUTO_APPROVED]: `[자동승인] ${partner.name}`,
    [CONFIG.STATUS.AUTO_REJECTED]: `[자동거부] ${partner.name}`,
    [CONFIG.STATUS.PENDING]: `[검토필요] ${partner.name}`
  };

  const subject = subjects[status] || `[파트너 등록] ${partner.name}`;

  const body = `
파트너 등록 알림

업체명: ${partner.name}
주소: ${partner.address}
연락처: ${partner.phone}
이메일: ${partner.email}
카테고리: ${partner.category}
협회: ${partner.association || '없음'}

상태: ${status}
등록시간: ${new Date().toLocaleString('ko-KR')}

---
프레스코21 파트너 관리 시스템
  `;

  try {
    GmailApp.sendEmail(adminEmail, subject, body);
  } catch (error) {
    console.error('Admin notification error:', error);
  }
}

/**
 * 파트너 알림
 */
function notifyPartner(type, partner) {
  if (!partner.email) return;

  const templates = {
    'approved': {
      subject: '[프레스코21] 파트너 등록이 승인되었습니다',
      body: `
안녕하세요, ${partner.name}님.

프레스코21 파트너 등록이 승인되었습니다.
이제 전국 제휴 공방 지도에서 ${partner.name}을(를) 확인하실 수 있습니다.

파트너맵 바로가기: https://jiho5755-maker.github.io/brand-intro-page/partnermap-v2/

감사합니다.
프레스코21 드림
      `
    },
    'pending': {
      subject: '[프레스코21] 파트너 등록 신청이 접수되었습니다',
      body: `
안녕하세요, ${partner.name}님.

프레스코21 파트너 등록 신청이 접수되었습니다.
관리자 검토 후 승인 여부를 이메일로 안내드리겠습니다.

문의사항이 있으시면 회신해 주세요.

감사합니다.
프레스코21 드림
      `
    },
    'rejected': {
      subject: '[프레스코21] 파트너 등록이 반려되었습니다',
      body: `
안녕하세요, ${partner.name}님.

죄송합니다. 파트너 등록 신청이 반려되었습니다.
자세한 사유는 관리자에게 문의해 주세요.

감사합니다.
프레스코21 드림
      `
    }
  };

  const template = templates[type];
  if (!template) return;

  try {
    GmailApp.sendEmail(partner.email, template.subject, template.body);
  } catch (error) {
    console.error('Partner notification error:', error);
  }
}

// ==========================================
// 대량 업로드
// ==========================================

/**
 * CSV 대량 업로드 처리
 */
function processBulkUpload(partners) {
  const results = {
    success: [],
    failed: [],
    duplicates: []
  };

  if (!Array.isArray(partners)) {
    return jsonResponse({ error: 'Invalid data format' }, 400);
  }

  partners.forEach((data, index) => {
    try {
      // 검증
      const validation = validatePartnerData(data);
      if (!validation.valid) {
        results.failed.push({ row: index, errors: validation.errors });
        return;
      }

      // 중복 체크
      if (isDuplicate(data.name, data.address)) {
        results.duplicates.push({ row: index, name: data.name });
        return;
      }

      // 등록
      const partnerId = savePartnerToPending(data, CONFIG.CHANNELS.BULK);
      geocodePartnerAddress(partnerId);
      processAutoApproval(partnerId);

      results.success.push({ row: index, partnerId });

    } catch (error) {
      results.failed.push({ row: index, error: error.message });
    }
  });

  logAction('BULK_UPLOAD', {
    total: partners.length,
    success: results.success.length,
    failed: results.failed.length,
    duplicates: results.duplicates.length
  });

  return jsonResponse({
    success: true,
    results: results
  });
}

// ==========================================
// API 키 관리
// ==========================================

/**
 * API 키 검증
 */
function validateApiKey(apiKey) {
  if (!apiKey) return false;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.API_KEYS);

  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === apiKey && data[i][2] === '활성') {
      return true;
    }
  }

  return false;
}

/**
 * 관리자 API 키 검증
 */
function validateAdminKey(apiKey) {
  if (!apiKey) return false;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.API_KEYS);

  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === apiKey && data[i][1] === '관리자' && data[i][2] === '활성') {
      return true;
    }
  }

  return false;
}

// ==========================================
// 유틸리티
// ==========================================

/**
 * JSON 응답 생성
 */
function jsonResponse(data, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);

  // 참고: Apps Script Web App은 HTTP 상태 코드를 직접 설정할 수 없음
  // statusCode는 응답 데이터에 포함
  if (statusCode && statusCode !== 200) {
    data.statusCode = statusCode;
  }

  return output;
}

/**
 * 로그 기록
 */
function logAction(action, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LOGS);

  if (!sheet) return;

  sheet.appendRow([
    new Date(),
    action,
    JSON.stringify(data),
    Session.getActiveUser().getEmail() || 'system'
  ]);
}

/**
 * 에러 로그
 */
function logError(source, error) {
  logAction('ERROR', {
    source: source,
    message: error.message,
    stack: error.stack
  });
}

// ==========================================
// 이메일 파싱 (트리거용)
// ==========================================

/**
 * 파트너 신청 이메일 처리 (시간 기반 트리거)
 */
function processPartnerEmails() {
  try {
    const threads = GmailApp.search('label:파트너신청 is:unread', 0, 10);

    threads.forEach(thread => {
      const messages = thread.getMessages();

      messages.forEach(message => {
        if (message.isUnread()) {
          const parsed = parsePartnerEmail(message);

          if (parsed.valid) {
            registerPartner(parsed.data, CONFIG.CHANNELS.EMAIL);
            message.markRead();
          } else {
            // 파싱 실패 시 라벨 변경
            thread.addLabel(GmailApp.getUserLabelByName('파싱실패') ||
                           GmailApp.createLabel('파싱실패'));
            logAction('EMAIL_PARSE_FAILED', {
              subject: message.getSubject(),
              errors: parsed.errors
            });
          }
        }
      });
    });
  } catch (error) {
    logError('processPartnerEmails', error);
  }
}

/**
 * 이메일 본문 파싱
 */
function parsePartnerEmail(message) {
  const body = message.getPlainBody();
  const errors = [];

  const patterns = {
    name: /업체명[:\s]+(.+)/i,
    address: /주소[:\s]+(.+)/i,
    phone: /연락처[:\s]*([\d\-]+)/i,
    email: /이메일[:\s]*([\w@.\-]+)/i,
    category: /카테고리[:\s]+(.+)/i,
    association: /협회[:\s]+(.+)/i
  };

  const data = {};

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = body.match(pattern);
    data[key] = match ? match[1].trim() : null;
  }

  // 필수 필드 체크
  if (!data.name) errors.push('업체명 누락');
  if (!data.address) errors.push('주소 누락');
  if (!data.phone) errors.push('연락처 누락');

  // 첨부파일에서 이미지 추출
  const attachments = message.getAttachments();
  if (attachments.length > 0) {
    const imageAttachment = attachments.find(a =>
      a.getContentType().startsWith('image/')
    );

    if (imageAttachment) {
      data.logoUrl = saveAttachmentToDrive(imageAttachment);
    }
  }

  return {
    valid: errors.length === 0,
    data: data,
    errors: errors
  };
}

/**
 * 첨부파일을 Google Drive에 저장
 */
function saveAttachmentToDrive(attachment) {
  try {
    const folder = DriveApp.getFolderById(
      PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID') ||
      DriveApp.getRootFolder().getId()
    );

    const fileName = `partner_logo_${Date.now()}_${attachment.getName()}`;
    const file = folder.createFile(attachment.copyBlob().setName(fileName));

    // 공개 URL 반환
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return `https://drive.google.com/uc?id=${file.getId()}`;

  } catch (error) {
    console.error('File upload error:', error);
    return null;
  }
}

// ==========================================
// 설정 트리거
// ==========================================

/**
 * 초기 설정 (한 번만 실행)
 */
function setupTriggers() {
  // 기존 트리거 제거
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));

  // 이메일 처리 트리거 (매 시간)
  ScriptApp.newTrigger('processPartnerEmails')
    .timeBased()
    .everyHours(1)
    .create();

  console.log('Triggers setup completed');
}

/**
 * 스프레드시트 초기화 (한 번만 실행)
 */
function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 필요한 시트 생성
  const sheetNames = Object.values(CONFIG.SHEETS);

  sheetNames.forEach(name => {
    if (!ss.getSheetByName(name)) {
      ss.insertSheet(name);
      console.log(`Created sheet: ${name}`);
    }
  });

  // 제휴업체 시트 헤더 설정
  const partnersSheet = ss.getSheetByName(CONFIG.SHEETS.PARTNERS);
  if (partnersSheet.getLastRow() === 0) {
    partnersSheet.appendRow([
      'ID', '업체명', '대표자명', '사업자번호', '주소', '상세주소',
      '전화번호', '이메일', '카테고리', '협회', '파트너유형',
      '소개', '로고URL', '이미지URL', '위도', '경도',
      '심사상태', '등록일', '수정일', '등록채널', '메모'
    ]);
  }

  // 신청대기 시트 헤더 설정 (동일)
  const pendingSheet = ss.getSheetByName(CONFIG.SHEETS.PENDING);
  if (pendingSheet.getLastRow() === 0) {
    pendingSheet.appendRow([
      'ID', '업체명', '대표자명', '사업자번호', '주소', '상세주소',
      '전화번호', '이메일', '카테고리', '협회', '파트너유형',
      '소개', '로고URL', '이미지URL', '위도', '경도',
      '심사상태', '등록일', '수정일', '등록채널', '메모'
    ]);
  }

  console.log('Spreadsheet setup completed');
}
