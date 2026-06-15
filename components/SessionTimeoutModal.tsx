import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

interface SessionTimeoutModalProps {
  isOpen: boolean;
  timeLeft: number;
  onContinue: () => void;
  onLogout: () => void;
}

const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({ isOpen, timeLeft, onContinue, onLogout }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-yellow-600" />
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 mb-2">閒置警示</h2>
          
          <p className="text-gray-600 mb-6">
            您已閒置過久，為了資訊安全，系統將在 <span className="font-bold text-red-600 text-lg">{timeLeft}</span> 秒後自動登出。
            <br />
            是否繼續使用？
          </p>
          
          <div className="flex space-x-3 w-full">
            <button
              onClick={onLogout}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              登出
            </button>
            <button
              onClick={onContinue}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center justify-center"
            >
              <Clock className="w-4 h-4 mr-2" />
              繼續使用
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionTimeoutModal;
