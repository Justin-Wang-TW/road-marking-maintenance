import { Station, StationCode, Task, TaskStatus, User, UserRole } from './types';

/**
 * 系統組態設定
 * 請確保 SCRIPT_URL 是你 GAS 部署後產生的「網頁應用程式 URL」
 */
export const APP_CONFIG = {
  SHEET_ID: '1qmEM4QjJiANOszU7_GiOU9ENsyL9vOSKsFfdvRaH4tg',
  // 注意：此處 URL 應與 App.tsx 中使用的 API 位址保持一致
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycby5g3xOHxJzvKR79BuLRRdALvRgRjG9EYfoZ8jxO2gJUevytapCoZ3-gatfLNpUnRJCeQ/exec',
  // [新增] 指定檔案上傳的 Google Drive 資料夾 ID
  // 請從 Google Drive 資料夾網址取得 ID (例如: folders/123xyz... 中的 123xyz...)
  // 若未設定，後端將使用預設邏輯 (如建立新資料夾或存於根目錄)
  UPLOAD_FOLDER_ID: '14Q298fPOjV17lx215IbmKD63AGJ3PYoS' 
};

/**
 * 停車場基本資料定義
 */
export let STATIONS: Station[] = [
  { code: StationCode.BAIFU, name: '百福立體停車場' },
  { code: StationCode.CHENG, name: '成功立體停車場' },
  { code: StationCode.XINYI, name: '信義國小地下停車場' },
  { code: StationCode.SHELIAO, name: '社寮橋平面停車場' },
  { code: StationCode.PCM_TEAM, name: '履約管理團隊' },
];

export const updateStations = (newStations: Station[]) => {
  if (newStations && newStations.length > 0) {
    STATIONS = newStations;
  }
};

/**
 * 根據場域名稱轉換為代碼的工具函數
 */
export const getStationCodeByName = (nameOrCode: string): StationCode => {
  const station = STATIONS.find(s => s.name === nameOrCode || s.code === nameOrCode);
  return station ? station.code : StationCode.BAIFU; // 預設回傳百福
};

/**
 * 模擬使用者名單 - 已清空
 * 系統現在將完全依照 [3_使用者權限表] 的內容進行身份驗證
 */
export const MOCK_USERS: User[] = [];

/**
 * 初始任務資料 - 已清空
 * 系統啟動後會顯示讀取中，直到成功從 Google Sheets 抓取資料
 */
export const INITIAL_TASKS: Task[] = [];

/**
 * 前端 UI 狀態標籤顏色設定
 */
export const STATUS_COLORS = {
  [TaskStatus.PENDING]: 'bg-gray-100 text-gray-800 border-gray-200',
  [TaskStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-800 border-blue-200',
  [TaskStatus.COMPLETED]: 'bg-green-100 text-green-800 border-green-200',
  [TaskStatus.OVERDUE]: 'bg-red-100 text-red-800 border-red-200',
};

/**
 * 財產管理自我檢查項目 (參考高雄市政府公有財產管理自我檢查項目參考表)
 */
export const ASSET_CHECKLIST_ITEMS = [
  { id: 'AC01', content: '財產帳卡是否齊全並妥善保管？' },
  { id: 'AC02', content: '財產帳面數量與實地盤點數量是否相符？' },
  { id: 'AC03', content: '財產是否黏貼標籤並保持清晰？' },
  { id: 'AC04', content: '財產使用狀況是否良好，有無閒置或毀損？' },
  { id: 'AC05', content: '報廢財產是否依規定程序辦理除帳及廢品處理？' },
  { id: 'AC06', content: '財產增減異動是否隨時登錄並依限申報？' },
];