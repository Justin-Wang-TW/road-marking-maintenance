import React, { useState, useEffect } from 'react';
import { Task, TaskStatus } from '../types';
import { X, Upload, FileText, Trash2, Link as LinkIcon, Loader2 } from 'lucide-react';

interface EditTaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  // Updated signature
  onSave: (
    taskId: string, 
    newStatus: TaskStatus, 
    currentAttachmentUrl?: string, 
    newFile?: { name: string, type: string, content: string }
  ) => Promise<void>;
}

const EditTaskModal: React.FC<EditTaskModalProps> = ({ task, isOpen, onClose, onSave }) => {
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.PENDING);
  const [currentAttachment, setCurrentAttachment] = useState(''); // Stores the existing URL string
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // Stores the newly selected file
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (task) {
      setStatus(task.status);
      setCurrentAttachment(task.attachmentUrl || '');
      setSelectedFile(null);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        alert("檔案過大，請選擇 10MB 以下的檔案以確保連線穩定。");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let fileData = undefined;

      // Prepare new file data if selected
      if (selectedFile) {
        const base64Content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(selectedFile);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
        });

        fileData = {
          name: selectedFile.name,
          type: selectedFile.type,
          content: base64Content
        };
      }

      await onSave(task.uid, status, currentAttachment, fileData);
      onClose();
    } catch (error) {
      console.error("Error saving task:", error);
      alert("更新失敗，請重試");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-fade-in">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-bold text-gray-800">更新進度</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">任務序號 (UID)</label>
            <p className="text-sm font-mono bg-gray-50 p-2 rounded">{task.uid}</p>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">工項名稱</label>
            <p className="text-sm font-medium text-gray-900">{task.itemName}</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-2">執行狀態</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {Object.values(TaskStatus).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
               佐證資料上傳
            </label>
            
            {!selectedFile ? (
              <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50 transition-colors text-center cursor-pointer group">
                <input 
                  type="file" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.doc,.docx"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-3 bg-blue-50 rounded-full group-hover:bg-blue-100 transition-colors">
                    <Upload className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">點擊或拖曳檔案至此</p>
                  <p className="text-xs text-gray-400">支援圖片(10MB內)、PDF 或 Word 文件</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="p-2 bg-white rounded shadow-sm">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {!selectedFile && currentAttachment && (
              <div className="mt-3 flex items-start p-3 bg-gray-50 rounded border border-gray-100">
                <LinkIcon className="w-4 h-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-1">目前已存的佐證資料：</p>
                  <a 
                    href={currentAttachment} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-xs text-blue-600 hover:underline break-all block"
                  >
                    {currentAttachment.startsWith('data:') ? '檢視上傳的檔案' : currentAttachment}
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={isSubmitting}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              確認更新
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTaskModal;