import * as XLSX from 'xlsx';

/**
 * 將字串轉換為 SHA-256 Hex 字串
 * 用於前端密碼加密，確保傳送給後端的是雜湊值
 */
export async function sha256(message: string): Promise<string> {
  // 1. 將字串編碼為 Uint8Array
  const msgBuffer = new TextEncoder().encode(message);
  
  // 2. 使用 Web Crypto API 計算雜湊
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  
  // 3. 將 ArrayBuffer 轉換為 Hex 字串
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

/**
 * 產生指定長度的隨機密碼 (包含大小寫字母與數字)
 * 用於核准用戶時生成預設密碼
 */
export function generateRandomPassword(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);
  
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

/**
 * 將資料匯出為 Excel 檔案 (.xlsx)
 * @param data 要匯出的資料陣列 (JSON 物件陣列)
 * @param fileName 檔案名稱 (不含副檔名)
 * @param sheetName 工作表名稱 (預設為 Sheet1)
 */
export function exportToExcel(data: any[], fileName: string, sheetName: string = 'Sheet1') {
  // 1. 建立工作表
  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // 2. 建立活頁簿
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  // 3. 寫入檔案並觸發下載
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}