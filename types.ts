export enum TaskStatus {
  PENDING = '待處理',
  IN_PROGRESS = '執行中',
  COMPLETED = '已完成',
  OVERDUE = '逾期',
}

export const StationCode = {
  BAIFU: 'BAIFU',       // 百福立體停車場
  CHENG: 'CHENG',       // 成功立體停車場
  XINYI: 'XINYI',       // 信義國小地下停車場
  SHELIAO: 'SHELIAO',   // 社寮橋平面停車場
  PCM_TEAM: 'PCM_TEAM', // 履約管理團隊
};
export type StationCode = string;

export interface Station {
  code: StationCode;
  name: string;
}

export enum RecurrenceType {
  NONE = 'NONE',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMI_ANNUALLY = 'SEMI_ANNUALLY',
  ANNUALLY = 'ANNUALLY',
}

export interface Task {
  uid: string;
  stationCode: StationCode;
  stationName: string; 
  itemCode: string; 
  itemName: string;
  deadline: string; 
  status: TaskStatus;
  executorEmail: string;
  lastUpdated: string; 
  attachmentUrl?: string;
  recurrence?: RecurrenceType;
  recurrenceGroupId?: string; // To group recurring tasks together
}

/**
 * UserRole：與後端 GAS 邏輯同步
 */
export enum UserRole {
  ADMIN = 'ADMIN',               // 系統管理員
  MANAGER_3D = 'MANAGER_3D',     // 三維團隊
  MANAGER_DEPT = 'MANAGER_DEPT', // 交通處
  GC = 'GC',                     // 承攬/營運業者
  SUBCONTRACTOR = 'SUBCONTRACTOR', // 下包廠商
  PENDING = 'PENDING',           // 待審核
}

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: '系統管理員',
  [UserRole.MANAGER_3D]: '三維團隊',
  [UserRole.MANAGER_DEPT]: '交通處',
  [UserRole.GC]: '承攬/營運業者',
  [UserRole.SUBCONTRACTOR]: '下包廠商',
  [UserRole.PENDING]: '待審核',
};

export interface User {
  name: string;
  email: string;
  password?: string;        // 存儲雜湊後的密碼
  organization?: string;    // 任職單位/所屬公司
  role: UserRole;
  assignedStation: string; // Changed to string to support comma-separated values like 'ALL' or 'BAIFU,CHENG'
  isActive: boolean;
  forceChangePassword?: boolean; // 是否需要強制修改密碼
}

export enum LogAction {
  LOGIN = '登入',
  REGISTER = '註冊申請',
  APPROVE_USER = '核准用戶',
  CREATE_TASK = '新增工項',
  UPDATE_STATUS = '變更狀態',
  DELETE_TASK = '刪除項目',
  UPLOAD_FILE = '上傳檔案',
  RESET_PASSWORD = '重設密碼請求',
  CHANGE_PASSWORD = '修改密碼', 
  ADD_MEETING = '新增會議紀錄',
  ADD_CONTACT = '新增通訊錄',
  UPDATE_TEMPLATE = '更新檢核範本',
  SUBMIT_CHECKLIST = '提交場館檢核',
  ADD_COMMENT = '新增留言',
  CREATE_CHANGE_ORDER = '建立變更單',
  UPDATE_CHANGE_ORDER = '更新變更單',
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userEmail: string;
  action: LogAction;
  taskUid?: string;
  details: string;
}

export interface Comment {
  id: string;
  taskUid: string;
  userEmail: string;
  userName: string;
  content: string;
  timestamp: string;
}

export enum ChangeOrderStatus {
  PENDING = '待審核',
  APPROVED = '已核准',
  REJECTED = '已駁回',
}

export interface ChangeOrder {
  id: string;
  title: string;
  description: string;
  requestDate: string;
  status: ChangeOrderStatus;
  requester: string;
  attachmentUrl?: string;
  response?: string;
  responseDate?: string;
}

export interface TaskStats {
  stationName: string;
  total: number;
  completed: number;
  rate: number;
  overdue: number;
}

export interface Meeting {
  id: string;
  date: string;
  subject: string;
  summary: string;
  attachmentUrl?: string; 
  createdBy: string;
  stationCode?: string; // Added for filtering
}

export interface Contact {
  id: string;
  organization: string;
  project: string;
  name: string;
  phone: string;
  email: string;
  station: string;
  note: string;
}

// --- New Types for Monthly Checklist ---

export interface ChecklistItem {
  id: string;
  category: string;
  content: string;
}

export enum CheckStatus {
  OK = '正常',
  ISSUE = '異常',
  NA = '不適用',
}

export enum AssetStatus {
  NEW = '新購',
  REPLACEMENT = '汰換',
  REPAIR = '修繕',
  SCRAPPED = '報廢',
  NORMAL = '使用中',
}

export interface Asset {
  id: string;
  stationCode: StationCode;
  stationName: string;
  name: string;
  status: AssetStatus;
  statusDate: string; // YYYY-MM-DD
  quantity: number;
  note?: string;
  unit?: string;       // 單位
  supplier?: string;   // 設備商
  location?: string;   // 所在位置
  photoUrl?: string; // Added photoUrl
  lastUpdatedBy?: string;
}

export enum AssetCheckStatus {
  NORMAL = '數量符合',
  PARTIAL_MATCH = '部分不符合',
  OTHER = '其他',
}

export interface AssetCheckItemResult {
  assetId: string;
  assetName: string;
  status: AssetCheckStatus;
  note?: string;
  photoUrl?: string; // Optional photo for individual item
}

export interface AssetCheckBatch {
  id: string;
  stationCode: StationCode;
  stationName: string;
  year: number;
  period: '上半年' | '下半年' | '不定期';
  checkDate: string; // YYYY-MM-DD
  submittedBy: string;
  submittedAt: string;
  results: AssetCheckItemResult[];
}

export interface AssetCheckRecord {
  id: string;
  assetId: string;
  assetName: string;
  stationCode: StationCode;
  checkDate: string; // YYYY-MM-DD
  status: AssetCheckStatus;
  quantity: number;
  photoUrl?: string;
  note?: string;
  checkedBy: string;
  checkedAt: string;
}

export interface ChecklistSubmission {
  id: string;
  stationCode: StationCode;
  stationName: string;
  yearMonth: string; // Format: YYYY-MM
  submittedBy: string; // User Email
  submittedAt: string;
  resolvedAlerts?: string[]; // Array of alert IDs that have been resolved
  results: {
    itemId: string;
    category?: string; 
    content?: string;  
    status: CheckStatus;
    note?: string; 
    photoUrl?: string; // 用於儲存照片連結
  }[];
}

export enum MessageType {
  PRIVATE = 'private',
  SYSTEM = 'system',
  MENTION = 'mention',
  BROADCAST = 'broadcast'
}

export interface Message {
  id: string;
  senderEmail: string;
  senderName: string;
  receiverEmail: string;
  receiverName?: string;
  content: string;
  type: MessageType;
  relatedId?: string; // e.g., Task UID
  isRead: boolean;
  timestamp: string;
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface TabVisibility {
  [tabId: string]: string[]; // Array of roles (e.g., ['ADMIN', 'GC', 'MANAGER_3D'])
}

export interface PageTitleConfig {
  [tabId: string]: {
    title: string;
    subtitle: string;
  }
}

export interface PlatformSettings {
  platformName: string;
  loginLogoUrl: string;
  sheetId: string;
  driveFolderId: string;
  scriptUrl?: string;
  stations?: Station[];
  tabVisibility?: TabVisibility;
  pageTitles?: PageTitleConfig;
}

declare global {
  interface Window {
    google?: {
      script: {
        run: {
          withSuccessHandler: (callback: (data: any) => any) => any;
          withFailureHandler: (callback: (error: any) => any) => any;
          [key: string]: any;
        };
      };
    };
  }
}