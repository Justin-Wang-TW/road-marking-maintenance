import React, { useState, useEffect } from 'react';
import { Task, TaskStatus } from '../types';
import { STATUS_COLORS } from '../constants';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface TimelineViewProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({ tasks, onEditTask }) => {
  const [viewMode, setViewMode] = useState<'MONTH' | 'QUARTER'>('MONTH');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Group tasks by Station
  const tasksByStation = tasks.reduce((acc, task) => {
    if (!acc[task.stationName]) acc[task.stationName] = [];
    acc[task.stationName].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'MONTH') newDate.setMonth(newDate.getMonth() - 1);
    else newDate.setMonth(newDate.getMonth() - 3);
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'MONTH') newDate.setMonth(newDate.getMonth() + 1);
    else newDate.setMonth(newDate.getMonth() + 3);
    setCurrentDate(newDate);
  };

  const renderTimeline = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <div className="overflow-x-auto border rounded-lg shadow-sm bg-white">
        <div className="min-w-[800px]">
          {/* Header Row: Days */}
          <div className="grid grid-cols-[200px_1fr] border-b bg-gray-50">
            <div className="p-3 font-bold text-gray-700 border-r flex items-center">
               場域 / 任務
            </div>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${daysInMonth}, minmax(30px, 1fr))` }}>
              {days.map(day => (
                <div key={day} className={`text-center text-xs py-2 border-r ${[0, 6].includes(new Date(year, month, day).getDay()) ? 'bg-gray-100 text-gray-400' : 'text-gray-600'}`}>
                  {day}
                </div>
              ))}
            </div>
          </div>

          {/* Body: Stations & Tasks */}
          {Object.entries(tasksByStation).map(([station, stationTasks]) => (
            <div key={station} className="group">
              <div className="grid grid-cols-[200px_1fr] border-b hover:bg-gray-50 transition-colors">
                <div className="p-3 font-medium text-gray-800 border-r bg-gray-50/50 flex items-center sticky left-0 z-10">
                  {station}
                </div>
                <div className="relative h-12 border-r-0">
                   {/* Grid Lines */}
                   <div className="absolute inset-0 grid pointer-events-none" style={{ gridTemplateColumns: `repeat(${daysInMonth}, minmax(30px, 1fr))` }}>
                      {days.map(day => (
                        <div key={day} className="border-r border-gray-100 h-full"></div>
                      ))}
                   </div>

                   {/* Tasks Bars */}
                   {(stationTasks as Task[]).map(task => {
                     const taskDate = new Date(task.deadline);
                     if (taskDate.getFullYear() !== year || taskDate.getMonth() !== month) return null;
                     
                     const day = taskDate.getDate();
                     const startCol = day; 
                     const span = 1; // Assuming 1 day duration for now as we only have deadline

                     // Determine color based on status
                     let bgClass = 'bg-gray-400';
                     if (task.status === TaskStatus.COMPLETED) bgClass = 'bg-green-500';
                     else if (task.status === TaskStatus.IN_PROGRESS) bgClass = 'bg-blue-500';
                     else if (task.status === TaskStatus.OVERDUE) bgClass = 'bg-red-500';
                     else if (new Date(task.deadline) < new Date()) bgClass = 'bg-red-500'; // Overdue logic

                     return (
                       <div 
                         key={task.uid}
                         onClick={() => onEditTask(task)}
                         className={`absolute top-2 h-8 rounded-md shadow-sm cursor-pointer hover:opacity-80 flex items-center justify-center text-white text-[10px] px-1 truncate transition-all ${bgClass}`}
                         style={{
                           left: `calc(${(day - 1) / daysInMonth * 100}% + 2px)`,
                           width: `calc(${1 / daysInMonth * 100}% - 4px)`,
                           zIndex: 20
                         }}
                         title={`${task.itemName} (${task.status}) - ${task.deadline}`}
                       >
                         {task.itemCode}
                       </div>
                     );
                   })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-blue-600" />
            專案進度甘特圖 (Timeline)
          </h2>
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button onClick={handlePrev} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-3 text-sm font-mono font-medium">{currentDate.getFullYear()} 年 {currentDate.getMonth() + 1} 月</span>
            <button onClick={handleNext} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 text-xs">
          <span className="flex items-center"><div className="w-3 h-3 bg-gray-400 rounded mr-1"></div> 待處理</span>
          <span className="flex items-center"><div className="w-3 h-3 bg-blue-500 rounded mr-1"></div> 執行中</span>
          <span className="flex items-center"><div className="w-3 h-3 bg-green-500 rounded mr-1"></div> 已完成</span>
          <span className="flex items-center"><div className="w-3 h-3 bg-red-500 rounded mr-1"></div> 逾期</span>
        </div>
      </div>

      {renderTimeline()}
    </div>
  );
};

export default TimelineView;
