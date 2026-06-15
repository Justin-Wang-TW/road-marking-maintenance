import React from 'react';
import { Task, TaskStatus } from '../types';
import { AlertTriangle, Calendar, X, ArrowRight } from 'lucide-react';

interface DueSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  currentUser: any;
}

const DueSoonModal: React.FC<DueSoonModalProps> = ({ isOpen, onClose, tasks, currentUser }) => {
  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border-t-4 border-red-500">
        <div className="p-5 border-b bg-red-50 flex justify-between items-start">
          <div className="flex items-start">
            <div className="bg-red-100 p-2 rounded-full mr-3">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">履約期限警示</h3>
              <p className="text-sm text-red-700 mt-1 font-medium">
                您有 {tasks.length} 項工作即將在 7 天內到期或已逾期，請盡速處理。
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-0 max-h-[60vh] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 sticky top-0 shadow-sm z-10">
              <tr>
                <th className="px-6 py-3 font-semibold text-gray-600">截止日期</th>
                <th className="px-6 py-3 font-semibold text-gray-600">場域</th>
                <th className="px-6 py-3 font-semibold text-gray-600">工項內容</th>
                <th className="px-6 py-3 font-semibold text-gray-600">目前狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tasks.map((task) => {
                // Parse date properly to avoid T16:00:00Z issues
                const deadline = new Date(task.deadline);
                // Set to midnight local time for diff calculation
                deadline.setHours(0,0,0,0);
                
                const today = new Date();
                today.setHours(0,0,0,0);
                
                const diffTime = deadline.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                // Overdue logic check
                // Logic: Current Time > Deadline Day at 23:59:59
                const overdueDeadline = new Date(task.deadline);
                overdueDeadline.setHours(23, 59, 59, 999);
                const isOverdue = new Date() > overdueDeadline;

                return (
                  <tr key={task.uid} className="hover:bg-red-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex flex-col">
                         <span className={`font-bold text-sm flex items-center ${isOverdue ? 'text-red-600' : 'text-orange-600'}`}>
                           <Calendar className="w-3.5 h-3.5 mr-1.5" />
                           {formatDeadline(task.deadline)}
                         </span>
                         <span className="text-xs text-gray-500 mt-0.5 font-medium">
                           {isOverdue ? `已逾期 ${Math.abs(diffDays)} 天` : `剩餘 ${diffDays} 天`}
                         </span>
                       </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                         {task.stationName}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                       <div className="text-gray-800 font-medium line-clamp-2">{task.itemName}</div>
                       <div className="text-xs text-gray-400 font-mono mt-0.5">{task.uid}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border
                         ${task.status === TaskStatus.OVERDUE ? 'bg-red-100 text-red-800 border-red-200' : 
                           task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-800 border-blue-200' : 
                           'bg-gray-100 text-gray-800 border-gray-200'}`}>
                         {task.status}
                       </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
            <p className="text-xs text-gray-500">
              * 系統僅列出尚未完成且期限緊迫之項目
            </p>
            <button 
              onClick={onClose}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-sm flex items-center"
            >
              我知道了，前往處理 <ArrowRight className="w-4 h-4 ml-2" />
            </button>
        </div>
      </div>
    </div>
  );
};

export default DueSoonModal;