import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Task, TaskStats, TaskStatus, StationCode, User, UserRole, PlatformSettings } from '../types';
import { STATIONS } from '../constants';
import StationHistoryModal from './StationHistoryModal';
import { ChevronRight, AlertCircle, CheckCircle2, Clock, PlayCircle, ClipboardList } from 'lucide-react';

interface DashboardProps {
  tasks: Task[];
  currentUser: User;
  platformSettings?: PlatformSettings;
}

const COLORS = ['#10B981', '#E5E7EB', '#3B82F6', '#EF4444']; // Green, Gray, Blue, Red
// Mapping for Pie Chart: Completed, Pending, In Progress, Overdue

const Dashboard: React.FC<DashboardProps> = ({ tasks = [], currentUser, platformSettings }) => {
  const [selectedStationCode, setSelectedStationCode] = useState<string | null>(null);

  // Helper function to format date correctly (YYYY-MM-DD)
  // Handles timezone conversion from UTC (e.g. 2026-01-29T16:00:00Z -> 2026-01-30)
  const formatDeadline = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper function to check if a task is overdue
  // Logic: Current Time > Deadline Date at 23:59:59
  const isTaskOverdue = (deadlineStr: string) => {
    if (!deadlineStr) return false;
    
    const deadline = new Date(deadlineStr);
    // Use local time set to end of day
    deadline.setHours(23, 59, 59, 999);
    
    const now = new Date();
    
    return now > deadline;
  };

  const visibleTasks = useMemo(() => {
    return (tasks || []).filter(t => {
      const assignedStations = currentUser.assignedStation ? currentUser.assignedStation.split(',') : [];
      if (!assignedStations.includes('ALL') && !assignedStations.includes(t.stationCode)) {
        return false;
      }
      if (t.stationCode === StationCode.PCM_TEAM && (currentUser.role === UserRole.GC || currentUser.role === UserRole.SUBCONTRACTOR)) {
        return false;
      }
      return true;
    });
  }, [tasks, currentUser]);

  const stats = useMemo(() => {
    const visibleStations = STATIONS.filter(s => {
      const assignedStations = currentUser.assignedStation ? currentUser.assignedStation.split(',') : [];
      if (!assignedStations.includes('ALL') && !assignedStations.includes(s.code)) {
        return false;
      }
      if (s.code === StationCode.PCM_TEAM && (currentUser.role === UserRole.GC || currentUser.role === UserRole.SUBCONTRACTOR)) {
        return false;
      }
      return true;
    });

    return visibleStations.map(station => {
      const stationTasks = visibleTasks.filter(t => t.stationCode === station.code);
      const total = stationTasks.length;

      let pending = 0;
      let inProgress = 0;
      let completed = 0;
      let overdue = 0;

      stationTasks.forEach(t => {
        // Determine effective status
        let displayStatus = t.status;
        
        // Logic: If not completed AND deadline has passed, force OVERDUE
        if (t.status !== TaskStatus.COMPLETED && isTaskOverdue(t.deadline)) {
          displayStatus = TaskStatus.OVERDUE;
        }

        switch (displayStatus) {
          case TaskStatus.PENDING: pending++; break;
          case TaskStatus.IN_PROGRESS: inProgress++; break;
          case TaskStatus.COMPLETED: completed++; break;
          case TaskStatus.OVERDUE: overdue++; break;
          default: break;
        }
      });
      
      return {
        stationName: station.name,
        stationCode: station.code,
        total,
        pending,
        inProgress,
        completed,
        overdue,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });
  }, [visibleTasks, currentUser]);

  const globalStats = useMemo(() => {
    // Re-calculate global stats based on the same dynamic logic
    let completed = 0;
    let pending = 0;
    let inProgress = 0;
    let overdue = 0;

    visibleTasks.forEach(t => {
      let displayStatus = t.status;
      if (t.status !== TaskStatus.COMPLETED && isTaskOverdue(t.deadline)) {
        displayStatus = TaskStatus.OVERDUE;
      }

      if (displayStatus === TaskStatus.COMPLETED) completed++;
      else if (displayStatus === TaskStatus.PENDING) pending++;
      else if (displayStatus === TaskStatus.IN_PROGRESS) inProgress++;
      else if (displayStatus === TaskStatus.OVERDUE) overdue++;
    });

    return [
      { name: '已完成', value: completed },
      { name: '待處理', value: pending },
      { name: '執行中', value: inProgress },
      { name: '逾期', value: overdue },
    ];
  }, [visibleTasks]);

  const selectedStationName = STATIONS.find(s => s.code === selectedStationCode)?.name || '';
  const selectedStationTasks = visibleTasks.filter(t => t.stationCode === selectedStationCode);

  const pageTitle = platformSettings?.pageTitles?.['dashboard']?.title || '戰情儀表板';
  const pageSubtitle = platformSettings?.pageTitles?.['dashboard']?.subtitle || '即時監控各場域履約狀況';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
           <h2 className="text-2xl font-bold text-gray-800">{pageTitle}</h2>
           <p className="text-gray-500 mt-1">{pageSubtitle}</p>
        </div>
        <div className="mt-4 md:mt-0 bg-white p-3 rounded-lg shadow-sm border flex items-center">
          <ClipboardList className="w-5 h-5 text-gray-500 mr-2" />
          <span className="text-sm text-gray-500 mr-2">總任務數:</span>
          <span className="text-xl font-bold text-gray-800">{(tasks || []).length}</span>
        </div>
      </div>

      {/* Station Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         {stats.map((stat) => (
           <div 
             key={stat.stationCode} 
             onClick={() => setSelectedStationCode(stat.stationCode)}
             className={`bg-white p-5 rounded-xl shadow-sm border cursor-pointer hover:shadow-md transition-all group relative overflow-hidden ${
               stat.overdue > 0 ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-100 hover:border-blue-200'
             }`}
           >
             {/* Progress Bar Background (Subtle) */}
             <div className="absolute top-0 left-0 h-1 bg-gray-100 w-full">
               <div 
                  className={`h-full transition-all duration-500 ${stat.rate === 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
                  style={{ width: `${stat.rate}%` }}
               />
             </div>

             <div className="flex justify-between items-start mb-4 mt-2">
               <h3 className="font-bold text-lg text-gray-800 group-hover:text-blue-600 transition-colors truncate pr-2">
                 {stat.stationName.replace('停車場', '')}
               </h3>
               <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${stat.rate >= 90 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                 {stat.rate}%
               </span>
             </div>

             {/* Detailed Stats Grid */}
             <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                <div className="flex items-center text-gray-600">
                   <Clock className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                   <span>待處理: <span className="font-semibold text-gray-800">{stat.pending}</span></span>
                </div>
                <div className="flex items-center text-blue-700">
                   <PlayCircle className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                   <span>執行中: <span className="font-semibold text-blue-800">{stat.inProgress}</span></span>
                </div>
                <div className="flex items-center text-green-700">
                   <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-green-500" />
                   <span>已完成: <span className="font-semibold text-green-800">{stat.completed}</span></span>
                </div>
                <div className={`flex items-center ${stat.overdue > 0 ? 'text-red-700 font-bold' : 'text-gray-400'}`}>
                   <AlertCircle className={`w-3.5 h-3.5 mr-1.5 ${stat.overdue > 0 ? 'text-red-600' : 'text-gray-300'}`} />
                   <span>逾期: <span className={`${stat.overdue > 0 ? 'text-red-700' : 'text-gray-400'}`}>{stat.overdue}</span></span>
                </div>
             </div>

             <div className="mt-4 pt-3 border-t border-gray-50 flex justify-between items-center text-xs text-gray-400">
                <span>總計 {stat.total} 項任務</span>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400" />
             </div>
           </div>
         ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
          <h3 className="text-lg font-bold text-gray-800 mb-6">全區任務狀態分佈</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={globalStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {globalStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
           <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
             <AlertCircle className="w-5 h-5 mr-2 text-red-500" />
             近期逾期與待處理項目
           </h3>
           <div className="space-y-3">
             {visibleTasks
                .filter(t => {
                   // Display in list if it IS overdue, OR if it's not completed and deadline is approaching
                   const overdue = t.status !== TaskStatus.COMPLETED && isTaskOverdue(t.deadline);
                   const explicitlyOverdue = t.status === TaskStatus.OVERDUE;
                   return overdue || explicitlyOverdue;
                })
                .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
                .slice(0, 5)
                .map(task => {
                  return (
                    <div key={task.uid} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100 hover:bg-red-100 transition-colors">
                      <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-red-600 bg-white border border-red-200 px-1.5 rounded">{STATIONS.find(s => s.code === task.stationCode)?.name || task.stationName || task.stationCode}</span>
                            <h4 className="text-sm font-bold text-gray-900 line-clamp-1">{task.itemName}</h4>
                          </div>
                          <p className="text-xs text-red-600 mt-1 font-medium flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            截止日期: {formatDeadline(task.deadline)}
                          </p>
                      </div>
                      <span className="text-xs font-bold px-2 py-1 bg-white text-red-600 rounded border border-red-200 whitespace-nowrap">
                          逾期
                      </span>
                    </div>
                  );
                })}
             {visibleTasks.filter(t => t.status === TaskStatus.OVERDUE || (t.status !== TaskStatus.COMPLETED && isTaskOverdue(t.deadline))).length === 0 && (
               <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-gray-50 rounded-lg border border-dashed">
                  <CheckCircle2 className="w-10 h-10 mb-2 text-green-500 opacity-50" />
                  <p>太棒了！目前無逾期項目</p>
               </div>
             )}
           </div>
        </div>
      </div>

      <StationHistoryModal 
        isOpen={!!selectedStationCode}
        onClose={() => setSelectedStationCode(null)}
        stationName={selectedStationName}
        tasks={selectedStationTasks}
      />
    </div>
  );
};

export default Dashboard;