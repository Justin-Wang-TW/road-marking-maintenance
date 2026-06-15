import React, { useState } from 'react';
import { X } from 'lucide-react';

export type DeleteRecurrenceMode = 'THIS' | 'THIS_AND_FOLLOWING' | 'ALL';

interface DeleteRecurrenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mode: DeleteRecurrenceMode) => void;
}

const DeleteRecurrenceModal: React.FC<DeleteRecurrenceModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [mode, setMode] = useState<DeleteRecurrenceMode>('THIS');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">刪除週期性活動</h3>
          
          <div className="space-y-4">
            <label className="flex items-center space-x-3 cursor-pointer group">
              <div className="relative flex items-center justify-center">
                <input
                  type="radio"
                  name="deleteMode"
                  value="THIS"
                  checked={mode === 'THIS'}
                  onChange={() => setMode('THIS')}
                  className="sr-only"
                />
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  mode === 'THIS' ? 'border-blue-600' : 'border-gray-300 group-hover:border-gray-400'
                }`}>
                  {mode === 'THIS' && <div className="w-3 h-3 rounded-full bg-blue-600" />}
                </div>
              </div>
              <span className="text-gray-700 font-medium">這項活動</span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer group">
              <div className="relative flex items-center justify-center">
                <input
                  type="radio"
                  name="deleteMode"
                  value="THIS_AND_FOLLOWING"
                  checked={mode === 'THIS_AND_FOLLOWING'}
                  onChange={() => setMode('THIS_AND_FOLLOWING')}
                  className="sr-only"
                />
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  mode === 'THIS_AND_FOLLOWING' ? 'border-blue-600' : 'border-gray-300 group-hover:border-gray-400'
                }`}>
                  {mode === 'THIS_AND_FOLLOWING' && <div className="w-3 h-3 rounded-full bg-blue-600" />}
                </div>
              </div>
              <span className="text-gray-700 font-medium">這項活動和後續活動</span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer group">
              <div className="relative flex items-center justify-center">
                <input
                  type="radio"
                  name="deleteMode"
                  value="ALL"
                  checked={mode === 'ALL'}
                  onChange={() => setMode('ALL')}
                  className="sr-only"
                />
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  mode === 'ALL' ? 'border-blue-600' : 'border-gray-300 group-hover:border-gray-400'
                }`}>
                  {mode === 'ALL' && <div className="w-3 h-3 rounded-full bg-blue-600" />}
                </div>
              </div>
              <span className="text-gray-700 font-medium">所有活動</span>
            </label>
          </div>

          <div className="mt-8 flex justify-end space-x-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-blue-600 font-bold hover:bg-blue-50 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => onConfirm(mode)}
              className="px-8 py-2 bg-blue-600 text-white font-bold rounded-full hover:bg-blue-700 shadow-lg transition-all active:scale-95"
            >
              確定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteRecurrenceModal;
