import React, { useState } from 'react';
import { User, PlatformSettings } from '../types';
import { APP_CONFIG } from '../constants';
import { Loader2, UserPlus, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { sha256 } from '../utils';

interface LoginProps {
  onLogin: (user: User) => void;
  // Updated to return a Promise<boolean> to handle success/fail UI states
  onRegister: (name: string, email: string, organization: string) => Promise<boolean>;
  onForgotPassword: (email: string) => void;
  users: User[]; // 用於註冊時前端快速檢查
  platformSettings: PlatformSettings;
}

const Login: React.FC<LoginProps> = ({ onLogin, onRegister, onForgotPassword, users, platformSettings }) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);

  // 初始化：檢查 localStorage 是否有儲存的 Email
  React.useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }
  }, []);

  // 正式的 API 登入邏輯
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    // 處理 "記錄我的電子郵件" 邏輯
    if (rememberEmail) {
      localStorage.setItem('rememberedEmail', email);
    } else {
      localStorage.removeItem('rememberedEmail');
    }

    try {
      // ⚡ 將密碼進行 SHA-256 雜湊後再發送
      const hashedPassword = await sha256(password);

      // ⚡ 直接向 GAS 發送驗證請求，讓後端比對雜湊密碼
      const response = await fetch(APP_CONFIG.SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'checkUserAuth',
          userEmail: email.trim().toLowerCase(),
          password: hashedPassword // 發送雜湊值
        })
      });

      const result = await response.json();

      if (result.success) {
        // 登入成功：將後端回傳的 User 物件（包含 forceChangePassword 旗標）傳給 App
        onLogin(result.user);
      } else {
        // 登入失敗：顯示後端回傳的具體原因（密碼錯誤或帳號不存在）
        setErrorMsg(result.msg || '登入失敗，請檢查帳號密碼。');
      }
    } catch (err) {
      setErrorMsg('連線失敗，請檢查網路或 API URL 設定。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);
    
    // 前端初步重複檢查
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      setErrorMsg('此 Email 已被註冊。');
      setIsLoading(false);
      return;
    }

    try {
      // 等待後端處理結果 (包含寄信通知管理員)
      const success = await onRegister(name, email, organization);
      
      if (success) {
        setSuccessMsg('申請已送出！系統已自動發送 Email 通知管理員，請靜候審核。');
        setMode('LOGIN');
        // 清空表單
        setName('');
        setOrganization('');
        setEmail(''); 
      } else {
        setErrorMsg('申請失敗，請稍後再試或聯繫管理員。');
      }
    } catch (err) {
      setErrorMsg('連線錯誤，無法送出申請。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-6">
             {/* 使用 Google Drive Thumbnail API 並指定較大寬度 (w1000) 以確保清晰且能避開掃毒頁面 */}
             <img 
               src={platformSettings.loginLogoUrl || "https://drive.google.com/thumbnail?id=1dRDhDUHOy_PGd0a0INSsCkaSlaxmCNgO&sz=w1000"} 
               alt="系統 Logo" 
               className="w-32 h-auto object-contain"
               referrerPolicy="no-referrer"
               onError={(e) => {
                 const target = e.target as HTMLImageElement;
                 target.style.display = 'none'; // 失敗時隱藏
                 console.error("Logo 載入失敗");
               }}
             />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">{platformSettings.platformName}</h1>
        </div>
        
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm flex items-center">
             <UserPlus className="w-4 h-4 mr-2" />
             {successMsg}
          </div>
        )}

        {mode === 'LOGIN' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">電子郵件 (Email)</label>
              <input 
                type="email" required value={email}
                className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密碼</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} required value={password}
                  className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                  onChange={e => setPassword(e.target.value)}
                />
                <button type="button" className="absolute right-3 top-3 text-gray-400" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="remember-email"
                type="checkbox"
                checked={rememberEmail}
                onChange={(e) => setRememberEmail(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="remember-email" className="ml-2 text-sm font-medium text-gray-900 select-none cursor-pointer">
                記錄我的電子郵件 (Email)
              </label>
            </div>

            <button type="submit" disabled={isLoading} className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold flex justify-center items-center">
              {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : '登入系統'}
            </button>
            <div className="text-center mt-4">
              <button type="button" onClick={() => setMode('REGISTER')} className="text-sm text-blue-600 hover:underline">申請存取權限</button>
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-100 text-center">
               <p className="text-xs text-red-500 font-bold">
                 忘記密碼請洽本計畫專案經理或系統管理員
               </p>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <input type="text" required placeholder="姓名" className="w-full p-2.5 border rounded-lg" value={name} onChange={e => setName(e.target.value)} />
            <input type="text" required placeholder="任職單位" className="w-full p-2.5 border rounded-lg" value={organization} onChange={e => setOrganization(e.target.value)} />
            <input type="email" required placeholder="Email" className="w-full p-2.5 border rounded-lg" value={email} onChange={e => setEmail(e.target.value)} />
            <button type="submit" disabled={isLoading} className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold flex items-center justify-center">
              {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : '送出申請'}
            </button>
            <button type="button" onClick={() => setMode('LOGIN')} className="w-full text-sm text-gray-500 mt-2">返回登入</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;