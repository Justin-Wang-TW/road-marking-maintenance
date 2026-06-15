
import React, { useState, useEffect } from 'react';
import { Task, User, TaskStatus, AuditLog } from '../types';
import { STATUS_COLORS, APP_CONFIG, STATIONS } from '../constants';
import { 
  X, FileText, Download, User as UserIcon, Calendar, 
  MapPin, Paperclip, Clock, Send, Loader2, CheckCircle2, History,
  MessageSquare, AlertCircle
} from 'lucide-react';

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  // Updated signature: onSave now accepts optional new file data
  onSave: (
    taskId: string, 
    newStatus: TaskStatus, 
    currentAttachmentUrl?: string,
    newFile?: { name: string, type: string, content: string }
  ) => Promise<void>; 
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, isOpen, onClose, currentUser, onSave }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | ''>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success'>('idle');
  
  // History Logs State
  const [historyLogs, setHistoryLogs] = useState<AuditLog[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Comments State
  const [comments, setComments] = useState<import('../types').Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);

  useEffect(() => {
    if (task && isOpen) {
      setSelectedStatus(task.status);
      fetchTaskHistory(task.uid);
      fetchComments(task.uid);
    }
  }, [task, isOpen]);

  const fetchTaskHistory = async (uid: string) => {
    setIsLoadingHistory(true);
    try {
      const userEmail = currentUser?.email || '';
      const token = currentUser?.password || '';
      const response = await fetch(`${APP_CONFIG.SCRIPT_URL}?action=getTaskLogs&uid=${uid}&userEmail=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}`);
      const data = await response.json();
      
      if (data.success && Array.isArray(data.logs)) {
        const sortedLogs = data.logs.sort((a: AuditLog, b: AuditLog) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setHistoryLogs(sortedLogs);
      } else {
        setHistoryLogs([]);
      }
    } catch (error) {
      console.error("無法取得歷史紀錄", error);
      setHistoryLogs([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchComments = async (uid: string) => {
    try {
      const userEmail = currentUser?.email || '';
      const token = currentUser?.password || '';
      const response = await fetch(`${APP_CONFIG.SCRIPT_URL}?action=getComments&taskUid=${uid}&userEmail=${encodeURIComponent(userEmail)}&token=${encodeURIComponent(token)}`);
      const data = await response.json();
      if (data.success && Array.isArray(data.comments)) {
        setComments(data.comments.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
      } else {
        setComments([]);
      }
    } catch (error) {
      console.error("無法取得留言", error);
    }
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !currentUser || !task) return;
    setIsSendingComment(true);
    try {
      const response = await fetch(APP_CONFIG.SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'addComment',
          userEmail: currentUser.email,
          token: currentUser.password,
          taskUid: task.uid,
          userName: currentUser.name,
          content: newComment
        })
      });
      const result = await response.json();
      if (result.success) {
        setNewComment('');
        fetchComments(task.uid);
      } else {
        alert('留言失敗: ' + result.msg);
      }
    } catch (error) {
      alert('連線錯誤');
    } finally {
      setIsSendingComment(false);
    }
  };

  if (!isOpen || !task) return null;

  // Helper function to format date correctly (YYYY-MM-DD)
  const formatDeadline = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // SLA Calculation
  const calculateSLA = () => {
    if (task.status === TaskStatus.COMPLETED) return null;
    const deadline = new Date(task.deadline);
    const now = new Date();
    // Reset hours to compare dates only
    deadline.setHours(23, 59, 59, 999);
    
    if (now > deadline) {
      const diffTime = Math.abs(now.getTime() - deadline.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return { overdueDays: diffDays };
    }
    return null;
  };

  const slaStatus = calculateSLA();

  const handleUpdateStatus = async () => {
    if (!selectedStatus) {
      alert('請選擇目前的執行狀態');
      return;
    }
    if (!currentUser) {
      alert('登入逾時，請重新登入');
      return;
    }

    setIsSubmitting(true);

    try {
      let fileData = undefined;
      
      if (selectedFile) {
        if (selectedFile.size > 10 * 1024 * 1024) {
          alert("檔案過大，請選擇 10MB 以下的檔案。");
          setIsSubmitting(false);
          return;
        }
        
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

      await onSave(task.uid, selectedStatus as TaskStatus, task.attachmentUrl, fileData);

      setUploadStatus('success');
      // Refresh history after save
      fetchTaskHistory(task.uid);

      setTimeout(() => {
        onClose();
        setUploadStatus('idle');
        setSelectedFile(null);
      }, 1500);

    } catch (error) {
      console.error('提交失敗:', error);
      alert('提交過程中發生錯誤，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBase64 = task.attachmentUrl?.startsWith('data:');
  
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-fade-in">
        
        {/* Header */}
        <div className="p-5 border-b flex justify-between items-start bg-gray-50 rounded-t-xl shrink-0">
          <div className="flex-1 pr-4">
            <div className="flex items-center space-x-2 mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-700">
                <MapPin className="w-3 h-3 mr-1" />
                {STATIONS.find(s => s.code === task.stationCode)?.name || task.stationName || task.stationCode}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_COLORS[task.status]}`}>
                {task.status}
              </span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 leading-snug">{task.itemName}</h3>
            <p className="text-xs font-mono text-gray-400 mt-1">UID: {task.uid}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-8">
          
          {/* 1. Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-xs font-bold text-gray-500 uppercase flex items-center mb-1">
                <Calendar className="w-3 h-3 mr-1" /> 截止日期
              </span>
              <p className={`font-medium ${new Date(task.deadline) < new Date() && task.status !== '已完成' ? 'text-red-600' : 'text-gray-800'}`}>
                {formatDeadline(task.deadline)}
              </p>
              {slaStatus && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-xs text-red-600 font-bold flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    已逾期 {slaStatus.overdueDays} 天
                  </p>
                </div>
              )}
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-xs font-bold text-gray-500 uppercase flex items-center mb-1">
                <Clock className="w-3 h-3 mr-1" /> 最後更新時間
              </span>
              <p className="font-medium text-gray-800">
                {task.lastUpdated ? new Date(task.lastUpdated).toLocaleString() : '-'}
              </p>
            </div>
          </div>

          {/* 2. Uploaded Attachment */}
          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center border-b pb-2">
              <Paperclip className="w-4 h-4 mr-2 text-blue-600" />
              目前佐證資料附件
            </h4>
            
            {task.attachmentUrl ? (
              <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors bg-white">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="p-2 bg-gray-100 rounded">
                    <FileText className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                       {isBase64 ? '已上傳之佐證檔案' : '外部連結檔案'}
                    </p>
                    <p className="text-xs text-gray-400">點擊按鈕開啟連結</p>
                  </div>
                </div>
                <a 
                  href={task.attachmentUrl}
                  download={isBase64 ? `proof_${task.uid}` : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap"
                >
                  <Download className="w-4 h-4 mr-2" />
                  開啟檢視
                </a>
              </div>
            ) : (
              <div className="text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <p className="text-gray-400 text-sm">目前尚無上傳佐證資料</p>
              </div>
            )}
          </div>

          {/* 3. Comments & Discussion */}
          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center border-b pb-2">
              <MessageSquare className="w-4 h-4 mr-2 text-blue-600" />
              溝通與留言板
            </h4>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-60 overflow-y-auto space-y-3">
              {comments.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-2">尚無留言，歡迎發起討論</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                      {comment.userName.charAt(0)}
                    </div>
                    <div className="flex-1 bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-gray-700">{comment.userName}</span>
                        <span className="text-[10px] text-gray-400">{new Date(comment.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="flex items-start space-x-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="輸入留言..."
                className="flex-1 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                rows={2}
              />
              <button
                onClick={handleSendComment}
                disabled={isSendingComment || !newComment.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
              >
                {isSendingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 4. History Timeline */}
          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center border-b pb-2">
              <History className="w-4 h-4 mr-2 text-blue-600" />
              履約歷程紀錄 (Audit Log)
            </h4>
            
            {isLoadingHistory ? (
              <div className="flex justify-center py-6">
                 <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : historyLogs.length === 0 ? (
               <div className="text-center py-6 text-gray-400 text-sm bg-gray-50 rounded-lg">
                 尚無歷史操作紀錄
               </div>
            ) : (
              <div className="relative pl-4 border-l-2 border-gray-200 space-y-6 ml-2">
                {historyLogs.map((log) => (
                  <div key={log.id} className="relative">
                    {/* Timeline Dot */}
                    <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-white border-2 border-blue-400"></div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                      <div>
                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                           {log.action}
                        </span>
                        <p className="text-sm font-medium text-gray-800 mt-1">
                          {log.details}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                         <p className="text-xs text-gray-500 font-mono">
                           {new Date(log.timestamp).toLocaleDateString()}
                         </p>
                         <p className="text-xs text-gray-400 font-mono">
                           {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 flex items-center">
                      <UserIcon className="w-3 h-3 mr-1" />
                      {log.userEmail}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. Update Form */}
          <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
            <h4 className="text-sm font-bold text-blue-800 mb-4 flex items-center">
              <Send className="w-4 h-4 mr-2" />
              提交進度更新
            </h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">執行狀態更新</label>
                <select 
                  className="w-full p-2.5 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as TaskStatus)}
                >
                  {Object.values(TaskStatus).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">上傳佐證檔案 (圖片或PDF)</label>
                <input 
                  type="file" 
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  accept="image/*,.pdf,.doc,.docx"
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer"
                />
              </div>

              <button
                onClick={handleUpdateStatus}
                disabled={isSubmitting || !selectedStatus}
                className={`w-full py-3 rounded-lg text-white font-bold flex items-center justify-center transition-all ${
                  isSubmitting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700 shadow-md'
                }`}
              >
                {isSubmitting ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> 正在處理並上傳檔案...</>
                ) : uploadStatus === 'success' ? (
                  <><CheckCircle2 className="w-5 h-5 mr-2" /> 更新成功！</>
                ) : (
                  '確認提交回報'
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm font-medium"
          >
            關閉視窗
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;
