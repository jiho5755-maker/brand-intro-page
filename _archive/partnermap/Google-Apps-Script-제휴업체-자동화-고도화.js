/**
 * 제휴업체 자동화 스크립트 - 고도화 버전
 * 
 * 주요 기능:
 * - 수동 좌표 우선 사용
 * - Geocoding 에러 처리 강화
 * - 민감 정보 보안 처리
 * - 데이터 유효성 검증 강화
 */

// 시트 설정
const SHEET_NAME = '제휴업체'; // 시트 이름
const API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY'; // Google Maps Geocoding API 키

// 열 인덱스 정의 (A=1, B=2, ...)
const COLUMNS = {
  업체명: 2,              // B열
  대표자명: 4,            // D열
  사업자번호: 5,          // E열
  주소: 6,                // F열
  상세주소: 7,            // G열
  개인연락처: 8,          // H열
  전화번호: 9,            // I열
  운영시간: 10,           // J열
  카테고리: 11,           // K열
  협회: 12,               // L열
  설명: 13,               // M열
  이미지URL: 14,          // N열
  심사상태: 16,           // P열
  위도: 17,               // Q열
  경도: 18,               // R열
  파트너유형: 19,         // S열 (새로 추가)
  수동위도: 20,           // T열 (새로 추가)
  수동경도: 21            // U열 (새로 추가)
};

/**
 * 시트 편집 이벤트 핸들러
 * 주소가 입력되면 자동으로 좌표를 Geocoding
 */
function onEdit(e) {
  try {
    const sheet = e.source.getActiveSheet();
    if (sheet.getName() !== SHEET_NAME) return;
    
    const range = e.range;
    const row = range.getRow();
    
    // 헤더 행은 제외
    if (row <= 1) return;
    
    // 주소 열(F열)이 편집되었는지 확인
    if (range.getColumn() === COLUMNS.주소) {
      const addressCell = sheet.getRange(row, COLUMNS.주소);
      const address = addressCell.getValue();
      
      // 주소가 비어있으면 종료
      if (!address || address.toString().trim() === '') {
        return;
      }
      
      // 수동 좌표 우선 확인
      const manualLat = sheet.getRange(row, COLUMNS.수동위도).getValue();
      const manualLng = sheet.getRange(row, COLUMNS.수동경도).getValue();
      
      if (manualLat && manualLng && 
          manualLat.toString().trim() !== '' && 
          manualLng.toString().trim() !== '') {
        // 수동 좌표가 있으면 그대로 사용
        sheet.getRange(row, COLUMNS.위도).setValue(parseFloat(manualLat));
        sheet.getRange(row, COLUMNS.경도).setValue(parseFloat(manualLng));
        
        // 심사상태가 '주소확인필요'였다면 '승인대기'로 변경
        const statusCell = sheet.getRange(row, COLUMNS.심사상태);
        if (statusCell.getValue() === '주소확인필요') {
          statusCell.setValue('승인대기');
          statusCell.clearNote(); // 메모 제거
        }
        
        return;
      }
      
      // 수동 좌표가 없으면 Geocoding 수행
      geocodeAddress(sheet, row, address);
    }
    
    // 수동 좌표 열(T, U)이 편집되었을 때도 처리
    if (range.getColumn() === COLUMNS.수동위도 || range.getColumn() === COLUMNS.수동경도) {
      const manualLat = sheet.getRange(row, COLUMNS.수동위도).getValue();
      const manualLng = sheet.getRange(row, COLUMNS.수동경도).getValue();
      
      if (manualLat && manualLng && 
          manualLat.toString().trim() !== '' && 
          manualLng.toString().trim() !== '') {
        // 수동 좌표를 위도/경도 열에 복사
        sheet.getRange(row, COLUMNS.위도).setValue(parseFloat(manualLat));
        sheet.getRange(row, COLUMNS.경도).setValue(parseFloat(manualLng));
        
        // 심사상태 업데이트
        const statusCell = sheet.getRange(row, COLUMNS.심사상태);
        if (statusCell.getValue() === '주소확인필요') {
          statusCell.setValue('승인대기');
          statusCell.clearNote();
        }
      }
    }
    
  } catch (error) {
    console.error('onEdit 오류:', error);
    // 에러 발생 시에도 스크립트가 중단되지 않도록 처리
  }
}

/**
 * 주소를 Geocoding하여 좌표를 가져옴
 * 실패 시 에러 처리 및 메모 추가
 */
function geocodeAddress(sheet, row, address) {
  try {
    // 상세주소가 있으면 합쳐서 검색
    const detailAddress = sheet.getRange(row, COLUMNS.상세주소).getValue();
    const fullAddress = detailAddress && detailAddress.toString().trim() !== '' 
      ? address + ' ' + detailAddress 
      : address;
    
    // Geocoding API 호출
    const encodedAddress = encodeURIComponent(fullAddress);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${API_KEY}&language=ko`;
    
    const response = UrlFetchApp.fetch(url);
    const result = JSON.parse(response.getContentText());
    
    if (result.status === 'OK' && result.results && result.results.length > 0) {
      const location = result.results[0].geometry.location;
      const lat = location.lat;
      const lng = location.lng;
      
      // 좌표 저장
      sheet.getRange(row, COLUMNS.위도).setValue(lat);
      sheet.getRange(row, COLUMNS.경도).setValue(lng);
      
      // 심사상태가 '주소확인필요'였다면 '승인대기'로 변경
      const statusCell = sheet.getRange(row, COLUMNS.심사상태);
      if (statusCell.getValue() === '주소확인필요') {
        statusCell.setValue('승인대기');
        statusCell.clearNote();
      }
      
    } else {
      // Geocoding 실패 처리
      handleGeocodingError(sheet, row, result.status, fullAddress);
    }
    
  } catch (error) {
    console.error('Geocoding 오류:', error);
    handleGeocodingError(sheet, row, 'EXCEPTION', address);
  }
}

/**
 * Geocoding 에러 처리
 * 심사상태를 '주소확인필요'로 변경하고 메모 추가
 */
function handleGeocodingError(sheet, row, errorStatus, address) {
  try {
    const statusCell = sheet.getRange(row, COLUMNS.심사상태);
    const currentStatus = statusCell.getValue();
    
    // 심사상태를 '주소확인필요'로 변경
    statusCell.setValue('주소확인필요');
    
    // 에러 메시지 생성
    const errorMessages = {
      'ZERO_RESULTS': '주소를 찾을 수 없습니다',
      'OVER_QUERY_LIMIT': 'API 할당량 초과',
      'REQUEST_DENIED': 'API 요청 거부',
      'INVALID_REQUEST': '잘못된 요청',
      'EXCEPTION': '예외 발생'
    };
    
    const errorMessage = errorMessages[errorStatus] || `Geocoding 실패: ${errorStatus}`;
    const note = `[${new Date().toLocaleString('ko-KR')}] ${errorMessage}\n주소: ${address}\n수동 좌표를 입력하거나 주소를 확인해주세요.`;
    
    // 메모 추가 (기존 메모가 있으면 추가)
    const existingNote = statusCell.getNote();
    if (existingNote && existingNote.trim() !== '') {
      statusCell.setNote(existingNote + '\n\n' + note);
    } else {
      statusCell.setNote(note);
    }
    
    // 위도/경도 열 비우기
    sheet.getRange(row, COLUMNS.위도).clearContent();
    sheet.getRange(row, COLUMNS.경도).clearContent();
    
  } catch (error) {
    console.error('에러 처리 중 오류:', error);
  }
}

/**
 * Web App으로 데이터 제공
 * 민감 정보 제외 및 파트너 유형 배열 변환
 */
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ 
          success: false, 
          message: '시트를 찾을 수 없습니다' 
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const partners = [];
    
    // 데이터 행 처리 (헤더 제외)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // 업체명(B열) 유효성 검증 - 필수 필드
      const 업체명 = row[COLUMNS.업체명 - 1];
      if (!업체명 || 업체명.toString().trim() === '') {
        continue; // 업체명이 없으면 해당 행 건너뛰기
      }
      
      // 심사상태 확인 (승인된 것만 포함)
      const 심사상태 = row[COLUMNS.심사상태 - 1];
      if (!심사상태 || 심사상태.toString().trim() !== '승인') {
        continue; // 승인되지 않은 행은 제외
      }
      
      // 위도/경도 확인
      const 위도 = parseFloat(row[COLUMNS.위도 - 1]);
      const 경도 = parseFloat(row[COLUMNS.경도 - 1]);
      
      if (isNaN(위도) || isNaN(경도) || 위도 === 0 || 경도 === 0) {
        continue; // 유효한 좌표가 없으면 제외
      }
      
      // 파트너 유형 처리 (S열)
      const 파트너유형Raw = row[COLUMNS.파트너유형 - 1];
      let 파트너유형 = [];
      
      if (파트너유형Raw && 파트너유형Raw.toString().trim() !== '') {
        // 쉼표 또는 줄바꿈으로 구분된 문자열을 배열로 변환
        파트너유형 = 파트너유형Raw
          .toString()
          .split(/[,|\n]+/)
          .map(function(item) {
            return item.trim();
          })
          .filter(function(item) {
            return item !== '';
          });
      }
      
      // 파트너 객체 생성 (민감 정보 제외)
      const partner = {
        name: 업체명.toString().trim(),
        address: row[COLUMNS.주소 - 1] ? row[COLUMNS.주소 - 1].toString().trim() : '',
        detailAddress: row[COLUMNS.상세주소 - 1] ? row[COLUMNS.상세주소 - 1].toString().trim() : '',
        phone: row[COLUMNS.전화번호 - 1] ? row[COLUMNS.전화번호 - 1].toString().trim() : '',
        hours: row[COLUMNS.운영시간 - 1] ? row[COLUMNS.운영시간 - 1].toString().trim() : '',
        category: row[COLUMNS.카테고리 - 1] ? row[COLUMNS.카테고리 - 1].toString().trim() : '',
        association: row[COLUMNS.협회 - 1] ? row[COLUMNS.협회 - 1].toString().trim() : '',
        description: row[COLUMNS.설명 - 1] ? row[COLUMNS.설명 - 1].toString().trim() : '',
        imageUrl: row[COLUMNS.이미지URL - 1] ? row[COLUMNS.이미지URL - 1].toString().trim() : '',
        lat: 위도,
        lng: 경도,
        partnerType: 파트너유형 // JSON 배열 형태로 반환
      };
      
      partners.push(partner);
    }
    
    // 성공 응답 반환
    const response = {
      success: true,
      partners: partners,
      count: partners.length,
      timestamp: new Date().toISOString()
    };
    
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('doGet 오류:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: false, 
        message: '데이터를 불러오는 중 오류가 발생했습니다: ' + error.toString() 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 수동으로 모든 행의 주소를 Geocoding
 * 관리자용 유틸리티 함수
 */
function batchGeocodeAll() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    console.error('시트를 찾을 수 없습니다');
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  
  // 헤더 제외하고 모든 행 처리
  for (let i = 1; i < data.length; i++) {
    const row = i + 1; // 시트 행 번호 (1-based)
    const address = sheet.getRange(row, COLUMNS.주소).getValue();
    
    if (address && address.toString().trim() !== '') {
      // 수동 좌표 확인
      const manualLat = sheet.getRange(row, COLUMNS.수동위도).getValue();
      const manualLng = sheet.getRange(row, COLUMNS.수동경도).getValue();
      
      if (manualLat && manualLng && 
          manualLat.toString().trim() !== '' && 
          manualLng.toString().trim() !== '') {
        // 수동 좌표 사용
        sheet.getRange(row, COLUMNS.위도).setValue(parseFloat(manualLat));
        sheet.getRange(row, COLUMNS.경도).setValue(parseFloat(manualLng));
      } else {
        // Geocoding 수행
        geocodeAddress(sheet, row, address);
        Utilities.sleep(200); // API 호출 제한을 위한 딜레이
      }
    }
  }
  
  console.log('일괄 Geocoding 완료');
}

/**
 * 테스트 함수
 */
function test() {
  console.log('테스트 시작');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (sheet) {
    console.log('시트 찾음:', sheet.getName());
    console.log('데이터 행 수:', sheet.getLastRow());
  } else {
    console.log('시트를 찾을 수 없습니다');
  }
}
