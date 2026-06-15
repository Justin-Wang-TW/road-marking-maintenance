import React, { useState, useMemo, useEffect } from 'react';
import { Task, User, StationCode, TaskStatus, UserRole, PlatformSettings } from '../types';
import { STATIONS, STATUS_COLORS } from '../constants';
import { Search, History, Edit, Paperclip, ClipboardCheck, Eye, Calendar, User as UserIcon, Download, Settings } from 'lucide-react';
import { exportToExcel } from '../utils';

interface TaskListProps {
  tasks: Task[];
  currentUser: User;
  onEditTask: (task: Task) => void;
  onModifyTask?: (task: Task) => void;
  // Changed from onViewHistory(uid) to onViewDetail(task) for rich modal
  onViewDetail: (task: Task) => void;
  platformSettings?: PlatformSettings;
}

const TaskList: React.FC<TaskListProps> = ({ tasks = [], currentUser, onEditTask, onModifyTask, onViewDetail, platformSettings }) => {
  // Logic: Users/Managers are locked to their assigned station. Admins can see ALL.
  const [filterStation, setFilterStation] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const canManageTask = useMemo(() => {
    return [UserRole.ADMIN, UserRole.MANAGER_3D, UserRole.MANAGER_DEPT].includes(currentUser.role);
  }, [currentUser]);

  // Initialize filter based on user role
  useEffect(() => {
    const assignedStations = currentUser.assignedStation ? currentUser.assignedStation.split(',') : [];
    if (!assignedStations.includes('ALL')) {
      // If multiple stations are assigned, we can't just set one. 
      // We might need to keep it as 'ALL' (meaning all assigned to them) or the first one.
      // Let's set it to 'ALL' to show all their assigned stations by default.
      setFilterStation('ALL');
    }
  }, [currentUser]);

  // Helper function to format date correctly (YYYY-MM-DD)
  // Handles timezone conversion correctly (e.g. UTC 16:00 previous day -> Local next day)
  const formatDeadline = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to determine display status
  // Logic: Current Time > Deadline Date at 23:59:59
  const getDisplayStatus = (task: Task): TaskStatus => {
    if (task.status === TaskStatus.COMPLETED) return TaskStatus.COMPLETED;
    
    // Parse deadline
    const deadline = new Date(task.deadline);
    // Set to end of day 23:59:59.999
    deadline.setHours(23, 59, 59, 999);
    
    const now = new Date();

    if (now > deadline) {
      return TaskStatus.OVERDUE;
    }
    
    return task.status;
  };

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((task) => {
      // Security Check: Even if UI dropdown is bypassed, enforce logic here for non-admins
      const assignedStations = currentUser.assignedStation ? currentUser.assignedStation.split(',') : [];
      if (!assignedStations.includes('ALL') && !assignedStations.includes(task.stationCode)) {
        return false; 
      }

      // Hide PCM_TEAM tasks from GC and SUBCONTRACTOR
      if (task.stationCode === StationCode.PCM_TEAM && (currentUser.role === UserRole.GC || currentUser.role === UserRole.SUBCONTRACTOR)) {
        return false;
      }

      // Calculate effective status for filtering logic to match display
      const displayStatus = getDisplayStatus(task);

      const matchStation = filterStation === 'ALL' || task.stationCode === filterStation;
      const matchStatus = filterStatus === 'ALL' || displayStatus === filterStatus;
      
      // Month Filter
      let matchMonth = true;
      if (filterMonth) {
          // task.deadline is in format YYYY-MM-DD
          matchMonth = task.deadline.startsWith(filterMonth);
      }

      // Fix: Safe string conversion to prevent crash if data is null/undefined/number
      const safeItemName = String(task.itemName || '');
      const safeUid = String(task.uid || '');
      const matchSearch = safeItemName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          safeUid.toLowerCase().includes(searchTerm.toLowerCase());
                          
      return matchStation && matchStatus && matchMonth && matchSearch;
    });
  }, [tasks, filterStation, filterStatus, filterMonth, searchTerm, currentUser]);

  const handleExport = () => {
    const dataToExport = filteredTasks.map(task => ({
      '場域': STATIONS.find(s => s.code === task.stationCode)?.name || task.stationName || task.stationCode,
      '工項名稱': task.itemName,
      '截止日期': formatDeadline(task.deadline),
      '狀態': getDisplayStatus(task),
      '執行人': task.executorEmail || '-',
      '佐證資料連結': task.attachmentUrl || '-'
    }));

    const dateStr = filterMonth ? filterMonth.replace('-', '年') + '月' : new Date().getFullYear() + '年';
    const fileName = `${dateStr}各停車場進度匯報表`;
    
    exportToExcel(dataToExport, fileName);
  };

  const pageTitle = platformSettings?.pageTitles?.['progress_report']?.title || '進度匯報';
  const defaultSubtitle = currentUser.assignedStation === 'ALL' 
    ? '檢核全區履約工項並追蹤進度' 
    : '請檢核本場域應執行項目，並填報進度與上傳佐證';
  const pageSubtitle = platformSettings?.pageTitles?.['progress_report']?.subtitle || defaultSubtitle;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-gray-800 flex items-center">
             <ClipboardCheck className="w-6 h-6 mr-2 text-blue-600" />
             {pageTitle}
           </h2>
           <p className="text-gray-500 mt-1">
             {pageSubtitle}
           </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4 mr-2" />
          匯出 Excel
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <select
            value={filterStation}
            onChange={(e) => setFilterStation(e.target.value)}
            disabled={!currentUser.assignedStation?.includes('ALL') && currentUser.assignedStation?.split(',').length === 1}
            className="w-full p-2 border rounded-lg bg-white disabled:bg-gray-100 disabled:text-gray-500"
          >
            <option value="ALL">所有場域</option>
            {STATIONS.map((s) => {
              if (s.code === StationCode.PCM_TEAM && (currentUser.role === UserRole.GC || currentUser.role === UserRole.SUBCONTRACTOR)) return null;
              const assignedStations = currentUser.assignedStation ? currentUser.assignedStation.split(',') : [];
              if (assignedStations.includes('ALL') || assignedStations.includes(s.code)) {
                return <option key={s.code} value={s.code}>{s.name}</option>;
              }
              return null;
            })}
          </select>
        </div>

        <div>
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="w-full p-2 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full p-2 border rounded-lg bg-white"
          >
            <option value="ALL">所有狀態</option>
            {Object.values(TaskStatus).map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="搜尋 UID 或項目名稱..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Mobile View (Card Layout) - Visible on small screens, hidden on md+ */}
      <div className="block md:hidden space-y-4">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>查無符合條件的工項</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const displayStatus = getDisplayStatus(task);
            const isOverdue = displayStatus === TaskStatus.OVERDUE;
            
            return (
              <div key={task.uid} className={`bg-white p-4 rounded-lg shadow-sm border ${isOverdue ? 'border-red-200 bg-red-50/10' : 'border-gray-200'}`}>
                <div className="flex justify-between items-start mb-3">
                   <div className="flex items-center space-x-2">
                     <span className="inline-flex items-center px-2 py-0.5 rounded text-sm font-bold bg-blue-50 text-blue-700 border border-blue-100">
                        {STATIONS.find(s => s.code === task.stationCode)?.name || task.stationName || task.stationCode}
                     </span>
                   </div>
                   <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[displayStatus]}`}>
                      {displayStatus}
                   </span>
                </div>
                
                <h3 className={`font-bold text-base mb-2 line-clamp-2 leading-snug ${isOverdue ? 'text-red-700' : 'text-gray-800'}`}>
                  {task.itemName || <span className="text-gray-300 italic font-normal">(未填寫工項名稱)</span>}
                </h3>
                
                {task.attachmentUrl && (
                  <div className="text-blue-500 text-xs flex items-center mb-3 font-medium bg-blue-50 p-1.5 rounded w-fit">
                      <Paperclip className="w-3 h-3 mr-1" />
                      已上傳佐證資料
                  </div>
                )}

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <div className="flex flex-col">
                     <span className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">截止日期</span>
                     <span className={`text-sm flex items-center ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-700 font-medium'}`}>
                        <Calendar className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                        {formatDeadline(task.deadline)}
                     </span>
                  </div>
                  
                  <div className="flex space-x-2">
                     {canManageTask && onModifyTask && (
                        <button
                           onClick={() => onModifyTask(task)}
                           className="p-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors border border-amber-100"
                           title="管理工項"
                        >
                           <Settings className="w-4 h-4" />
                        </button>
                     )}
                     <button
                        onClick={() => onEditTask(task)}
                        className="p-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                        title="填寫進度"
                     >
                        <Edit className="w-4 h-4" />
                     </button>
                     <button
                        onClick={() => onViewDetail(task)}
                        className="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                        title="查看詳情"
                     >
                        <Eye className="w-4 h-4" />
                     </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop View (Table Layout) - Hidden on small screens, visible on md+ */}
      <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-fixed">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-3 font-semibold text-gray-700 text-base w-[16%]">場域</th>
                <th className="px-3 py-3 font-semibold text-gray-700 text-base w-[17%]">工項名稱</th>
                <th className="px-3 py-3 font-semibold text-gray-700 text-base w-[16%]">截止日期</th>
                <th className="px-3 py-3 font-semibold text-gray-700 text-base w-[10%]">狀態</th>
                <th className="px-3 py-3 font-semibold text-gray-700 text-base w-[16%]">執行人</th>
                <th className="px-3 py-3 font-semibold text-gray-700 text-base w-[10%] text-center">回報</th>
                <th className="px-3 py-3 font-semibold text-gray-700 text-base w-[10%] text-center">檢視</th>
                {canManageTask && <th className="px-3 py-3 font-semibold text-gray-700 text-base w-[10%] text-center">管理</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400 text-base">
                    查無符合條件的工項
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  const displayStatus = getDisplayStatus(task);
                  const isOverdue = displayStatus === TaskStatus.OVERDUE;
                  
                  return (
                    <tr key={task.uid} className={`hover:bg-gray-50 transition-colors ${isOverdue ? 'bg-red-50/30' : ''}`}>
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-col gap-2">
                           <span className="inline-flex items-center px-2.5 py-1 rounded-md text-base font-bold bg-blue-50 text-blue-700 border border-blue-100 w-fit">
                             {STATIONS.find(s => s.code === task.stationCode)?.name || task.stationName || task.stationCode}
                           </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                           <div className={`font-bold text-base mb-1 ${isOverdue ? 'text-red-700' : 'text-gray-800'}`}>
                             {task.itemName || <span className="text-gray-300 italic font-normal text-sm">(未填寫工項名稱)</span>}
                           </div>
                           {task.attachmentUrl && (
                               <div className="text-blue-500 text-xs flex items-center font-medium">
                                  <Paperclip className="w-3 h-3 mr-1" />
                                  已上傳佐證資料
                               </div>
                           )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap align-top">
                         <span className={`block mt-1 text-base ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                          {formatDeadline(task.deadline)}
                         </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium border mt-0.5 ${STATUS_COLORS[displayStatus]}`}>
                          {displayStatus}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-500 text-sm align-top break-all">
                        <div className="mt-1">{task.executorEmail || '-'}</div>
                      </td>
                      <td className="px-3 py-3 text-center align-top">
                         <button
                            onClick={() => onEditTask(task)}
                            className="inline-flex items-center justify-center px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-sm font-medium transition-colors"
                            title="填寫進度與上傳照片"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            匯報進度
                          </button>
                      </td>
                      <td className="px-3 py-3 text-center align-top">
                          <button
                            onClick={() => onViewDetail(task)}
                            className="inline-flex items-center justify-center px-3 py-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 rounded text-sm font-medium transition-colors border border-transparent hover:border-gray-200"
                            title="查看詳細資訊與下載檔案"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            檢視
                          </button>
                      </td>
                      {canManageTask && onModifyTask && (
                        <td className="px-3 py-3 text-center align-top">
                            <button
                              onClick={() => onModifyTask(task)}
                              className="inline-flex items-center justify-center px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded text-sm font-medium transition-colors border border-amber-100"
                              title="刪除或修改工項"
                            >
                              <Settings className="w-4 h-4 mr-1" />
                              管理
                            </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TaskList;