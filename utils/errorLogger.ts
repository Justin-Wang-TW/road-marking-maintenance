
/**
 * Error Logger Utility
 * Handles error reporting to console, local storage, and backend API.
 */

interface ErrorLog {
  timestamp: string;
  message: string;
  stack?: string;
  user?: string;
  url?: string;
}

const LOG_STORAGE_KEY = 'app_error_logs';
const MAX_LOGS = 50;

export const logError = async (error: Error, user?: string) => {
  const errorLog: ErrorLog = {
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    user: user || 'anonymous',
    url: window.location.href,
  };

  // 1. Console Log (for developers)
  console.error('Captured Error:', errorLog);

  // 2. Local Storage Log (for debugging in field)
  try {
    const existingLogs = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
    const updatedLogs = [errorLog, ...existingLogs].slice(0, MAX_LOGS);
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(updatedLogs));
  } catch (e) {
    console.error('Failed to save error to localStorage', e);
  }

  // 3. Backend API Log (Stub for GAS integration)
  // In a real implementation, this would POST to the GAS web app URL
  /*
  try {
    await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'logError', data: errorLog })
    });
  } catch (e) {
    // Fail silently if network is down
  }
  */
};

export const getErrorLogs = (): ErrorLog[] => {
  try {
    return JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

export const clearErrorLogs = () => {
  localStorage.removeItem(LOG_STORAGE_KEY);
};
