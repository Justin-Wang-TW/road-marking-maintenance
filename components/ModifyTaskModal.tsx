import React, { useState, useEffect } from 'react';
import { Task, TaskStatus } from '../types';
import { X, Save, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import DeleteRecurrenceModal, { DeleteRecurrenceMode } from './DeleteRecurrenceModal';

interface ModifyTaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onDelete: (taskId: string, mode?: DeleteRecurrenceMode) => Promise<void>;
}

const ModifyTaskModal: React.FC<ModifyTaskModalProps> = ({ task, isOpen, onClose, onUpdate, onDelete }) => {
  const [itemName, setItemName] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRecurrenceDelete, setShowRecurrenceDelete] = useState(false);

  useEffect(() => {
    if (task) {
      setItemName(task.itemName || '');
      setDeadline(task.deadline || '');
      setShowDeleteConfirm(false);
      setShowRecurrenceDelete(false);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !deadline) {
      alert('請填寫完整資訊');
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdate(task.uid, { itemName, deadline });
      onClose();
    } catch (error) {
      console.error("Update task error:", error);
      alert("更新失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = () => {
    if (task.recurrenceGroupId) {
      setShowRecurrenceDelete(true);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const handleRecurrenceDeleteConfirm = async (mode: DeleteRecurrenceMode) => {
    setIsSubmitting(true);
    try {
      await onDelete(task.uid, mode);
      setShowRecurrenceDelete(false);
      onClose();
    } catch (error) {
      console.error("Delete recurrence error:", error);
      alert("刪除失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      await onDelete(task.uid);
      onClose();
    } catch (error) {
      console.error("Delete task error:", error);
      alert("刪除失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-fade-in overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <Trash2 className="w-5 h-5 mr-2 text-gray-500" />
            管理工項
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6">
          {!showDeleteConfirm ? (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">任務序號 (UID)</label>
                <p className="text-sm font-mono bg-gray-50 p-2 rounded border border-gray-100">{task.uid}</p>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">工項名稱</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="請輸入工項名稱"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">截止日期</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div className="pt-6 flex flex-col gap-3">
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                    disabled={isSubmitting}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center font-medium shadow-sm"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    儲存修改
                  </button>
                </div>
                
                <div className="border-t pt-4 mt-2">
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    className="w-full py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-center font-medium border border-red-100"
                    disabled={isSubmitting}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    刪除此工項
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h4 className="text-center text-lg font-bold text-gray-900">確認刪除？</h4>
              <p className="text-center text-gray-500 text-sm">
                您即將刪除工項：<br/>
                <span className="font-bold text-gray-800">「{task.itemName}」</span><br/>
                此動作無法復原，所有相關的進度回報與佐證資料也將一併移除。
              </p>
              
              <div className="pt-6 flex flex-col gap-3">
                <button
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold shadow-md flex items-center justify-center"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Trash2 className="w-5 h-5 mr-2" />}
                  確認永久刪除
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  disabled={isSubmitting}
                >
                  返回修改
                </button>
              </div>
            </div>
          )}
        </div>

        <DeleteRecurrenceModal 
          isOpen={showRecurrenceDelete}
          onClose={() => setShowRecurrenceDelete(false)}
          onConfirm={handleRecurrenceDeleteConfirm}
        />
      </div>
    </div>
  );
};

export default ModifyTaskModal;
