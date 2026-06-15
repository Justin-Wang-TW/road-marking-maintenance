import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { Task, TaskStatus, User, StationCode, UserRole, PlatformSettings } from '../types';
import { STATIONS, STATUS_COLORS } from '../constants';

// --- Date Utils (Replacement for date-fns to avoid dependency issues) ---

const parseDateString = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  
  // Try YYYY-MM-DD
  if (dateStr.includes('-')) {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month - 1, day);
    }
  }
  
  // Try YYYY/MM/DD (Google Sheets common format)
  if (dateStr.includes('/')) {
     const [year, month, day] = dateStr.split('/').map(Number);
     if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
       return new Date(year, month - 1, day);
     }
  }

  // Fallback to standard Date parse (ISO)
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
};

const formatDate = (date: Date, formatStr: string): string => {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const pad = (n: number) => n.toString().padStart(2, '0');

  if (formatStr === 'yyyy年 MM月') return `${y}年 ${pad(m)}月`;
  if (formatStr === 'yyyy年 MM月 dd日') return `${y}年 ${pad(m)}月 ${pad(d)}日`;
  if (formatStr === 'd') return d.toString();
  return date.toISOString().split('T')[0];
};

const addMonthsToDate = (date: Date, amount: number): Date => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + amount);
  return d;
};

const getStartOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);
const getEndOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Sun) to 6 (Sat)
  const diff = d.getDate() - day;
  d.setDate(diff);
  return d;
};

const getEndOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() + (6 - day);
  d.setDate(diff);
  return d;
};

const addDaysToDate = (date: Date, amount: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
};

const isSameDayDate = (d1: Date, d2: Date): boolean => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

const isSameMonthDate = (d1: Date, d2: Date): boolean => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth();
};

// ----------------------------------------------------------------------

interface CalendarViewProps {
  tasks: Task[];
  currentUser: User;
  onEditTask: (task: Task) => void;
  platformSettings?: PlatformSettings;
}

const CalendarView: React.FC<CalendarViewProps> = ({ tasks, currentUser, onEditTask, platformSettings }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const nextMonth = () => setCurrentDate(addMonthsToDate(currentDate, 1));
  const prevMonth = () => setCurrentDate(addMonthsToDate(currentDate, -1));
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // Filter tasks based on user permissions
  const visibleTasks = React.useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(task => {
      const assignedStations = currentUser.assignedStation ? currentUser.assignedStation.split(',') : [];
      if (!assignedStations.includes('ALL') && !assignedStations.includes(task.stationCode)) {
        return false;
      }
      if (task.stationCode === StationCode.PCM_TEAM && (currentUser.role === UserRole.GC || currentUser.role === UserRole.SUBCONTRACTOR)) {
        return false;
      }
      return true;
    });
  }, [tasks, currentUser]);

  // Calendar Grid Generation
  const monthStart = getStartOfMonth(currentDate);
  const monthEnd = getEndOfMonth(monthStart);
  const startDate = getStartOfWeek(monthStart);
  const endDate = getEndOfWeek(monthEnd);

  const calendarDays: Date[] = [];
  let day = startDate;
  
  // Safe Loop with max iterations to prevent infinite loop
  let iterations = 0;
  while (day.getTime() <= endDate.getTime() && iterations < 42) {
    calendarDays.push(new Date(day)); // Push copy
    day = addDaysToDate(day, 1);
    iterations++;
  }

  // Get tasks for a specific date (based on deadline) and sort by priority
  const getTasksForDate = (date: Date) => {
    if (!visibleTasks || !Array.isArray(visibleTasks)) return [];

    const dayTasks = visibleTasks.filter(task => {
      // task.deadline is YYYY-MM-DD
      if (!task.deadline) return false;
      const taskDate = parseDateString(task.deadline);
      return isSameDayDate(taskDate, date);
    });

    // Priority: OVERDUE (1) > IN_PROGRESS (2) > PENDING (3) > COMPLETED (4)
    return dayTasks.sort((a, b) => {
      const priority = {
        [TaskStatus.OVERDUE]: 1,
        [TaskStatus.IN_PROGRESS]: 2,
        [TaskStatus.PENDING]: 3,
        [TaskStatus.COMPLETED]: 4,
      };
      return (priority[a.status] || 99) - (priority[b.status] || 99);
    });
  };

  const selectedDateTasks = getTasksForDate(selectedDate);

  // Status Color Dot Helper
  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED: return 'bg-green-500';
      case TaskStatus.OVERDUE: return 'bg-red-500';
      case TaskStatus.IN_PROGRESS: return 'bg-blue-500';
      default: return 'bg-gray-400';
    }
  };

  const pageTitle = platformSettings?.pageTitles?.['calendar']?.title || '履約行事曆';
  const pageSubtitle = platformSettings?.pageTitles?.['calendar']?.subtitle || '檢視各項任務之截止期限';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <CalendarIcon className="w-6 h-6 mr-2 text-blue-600" />
            {pageTitle}
          </h2>
          <p className="text-gray-500 mt-1">{pageSubtitle}</p>
        </div>
        
        <div className="flex items-center space-x-4 bg-white p-1 rounded-lg border shadow-sm">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-md">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-lg font-bold text-gray-800 w-32 text-center">
            {formatDate(currentDate, 'yyyy年 MM月')}
          </span>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-md">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        
        <button 
          onClick={goToToday}
          className="px-4 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium"
        >
          回到今天
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Calendar Grid */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Weekday Header */}
          <div className="grid grid-cols-7 border-b bg-gray-50">
            {['日', '一', '二', '三', '四', '五', '六'].map((d, i) => (
              <div key={i} className={`py-3 text-center text-sm font-semibold ${i === 0 || i === 6 ? 'text-red-500' : 'text-gray-600'}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 auto-rows-fr">
            {calendarDays.map((date, idx) => {
              const dayTasks = getTasksForDate(date);
              const isSelected = isSameDayDate(date, selectedDate);
              const isCurrentMonth = isSameMonthDate(date, monthStart);
              const isToday = isSameDayDate(date, new Date());

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(date)}
                  className={`
                    min-h-[100px] border-b border-r p-2 cursor-pointer transition-colors relative
                    ${!isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'}
                    ${isSelected ? 'ring-2 ring-inset ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'}
                  `}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`
                      text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                      ${isToday ? 'bg-blue-600 text-white' : ''}
                    `}>
                      {formatDate(date, 'd')}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="text-[10px] font-bold text-gray-400 hidden md:block">
                        {dayTasks.length} 筆
                      </span>
                    )}
                  </div>

                  {/* Task Dots / Indicators - Display Top 3 + More */}
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map((task) => (
                      <div key={task.uid} className="flex items-center text-xs group">
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 flex-shrink-0 ${getStatusColor(task.status)}`}></span>
                        <span className="truncate text-gray-600 text-[11px] leading-tight hidden md:block max-w-[90%] group-hover:text-blue-600">
                          {task.itemName}
                        </span>
                      </div>
                    ))}
                    
                    {dayTasks.length > 3 && (
                      <div className="text-[10px] text-gray-400 pl-3 pt-0.5 font-medium hidden md:block hover:text-gray-600">
                        + {dayTasks.length - 3} more
                      </div>
                    )}
                    
                    {/* Mobile Only Dot Indicator */}
                    <div className="flex md:hidden space-x-1 mt-1 justify-center">
                      {dayTasks.length > 0 && (
                        <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(dayTasks[0].status)}`}></div>
                      )}
                      {dayTasks.length > 1 && <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Date Detail Panel */}
        <div className="lg:w-80 w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col h-fit">
          <div className="border-b pb-4 mb-4">
            <h3 className="text-lg font-bold text-gray-800">
              {formatDate(selectedDate, 'yyyy年 MM月 dd日')}
            </h3>
            <p className="text-sm text-gray-500">
              {['週日', '週一', '週二', '週三', '週四', '週五', '週六'][selectedDate.getDay()]}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px] space-y-3">
            {selectedDateTasks.length === 0 ? (
              <div className="text-center py-8 text-gray-400 flex flex-col items-center">
                <Clock className="w-10 h-10 mb-2 opacity-50" />
                <p>該日無到期任務</p>
              </div>
            ) : (
              selectedDateTasks.map(task => (
                <div 
                  key={task.uid} 
                  className="p-3 rounded-lg border border-gray-100 hover:shadow-md transition-shadow bg-gray-50 cursor-pointer"
                  onClick={() => onEditTask(task)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500 bg-white px-2 py-0.5 rounded border">
                      {STATIONS.find(s => s.code === task.stationCode)?.name || task.stationName || task.stationCode}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[task.status]}`}>
                      {task.status}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-800 line-clamp-2 mb-1">
                    {task.itemName}
                  </h4>
                  <p className="text-xs text-gray-400 font-mono">{task.uid}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;