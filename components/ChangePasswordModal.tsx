
import React, { useState } from 'react';
import { Lock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newPassword: string) => Promise<boolean>;
  isForced: boolean; // If true, cannot close without changing
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, onSubmit, isForced }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 4) {
      setError('密碼長度至少需 4 個字元');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('兩次輸入的密碼不一致');
      return;
    }

    setIsLoading(true);
    const success = await onSubmit(newPassword);
    setIsLoading(false);

    if (success) {
      setNewPassword('');
      setConfirmPassword('');
      // 成功後務必關閉視窗，無論是否為強制修改
      onClose(); 
    } else {
        // 若 App.tsx 的 onSubmit 回傳 false，顯示錯誤 (雖然 App.tsx 已經有 alert，這裡做為備用)
        if (!error) setError('密碼修改失敗，請稍後再試');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        <div className={`p-6 ${isForced ? 'bg-orange-50' : 'bg-gray-50'} border-b`}>
          <h3 className="text-xl font-bold text-gray-800 flex items-center">
            <Lock className={`w-6 h-6 mr-2 ${isForced ? 'text-orange-600' : 'text-blue-600'}`} />
            {isForced ? '請修改預設密碼' : '修改密碼'}
          </h3>
          {isForced && (
            <p className="text-sm text-orange-700 mt-2">
               為了您的帳號安全，初次登入或重置後，請設定一組新的私人密碼。
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">新密碼</label>
            <input
              type="password"
              required
              minLength={4}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="請輸入新密碼"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">確認新密碼</label>
            <input
              type="password"
              required
              minLength={4}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="再次輸入新密碼"
            />
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            {!isForced && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={isLoading}
              >
                取消
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium flex items-center"
            >
              {isLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              確認修改
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
