import React, { useState } from 'react';
import { StationCode, TaskStatus, RecurrenceType } from '../types';
import { STATIONS } from '../constants';
import { X, Globe, AlertCircle, Repeat } from 'lucide-react';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (taskData: { 
    itemName: string; 
    name: string; // Add alias
    title: string; // Add alias
    deadline: string; 
    stationCodes: StationCode[]; 
    isCommon: boolean;
    recurrence: RecurrenceType;
    recurrenceCount: number;
  }) => void;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [itemName, setItemName] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isCommon, setIsCommon] = useState(false);
  const [selectedStations, setSelectedStations] = useState<StationCode[]>([]);
  const [recurrence, setRecurrence] = useState<RecurrenceType>(RecurrenceType.NONE);
  const [recurrenceCount, setRecurrenceCount] = useState(1);

  if (!isOpen) return null;

  const handleStationToggle = (code: StationCode) => {
    if (selectedStations.includes(code)) {
      setSelectedStations(selectedStations.filter(s => s !== code));
    } else {
      setSelectedStations([...selectedStations, code]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let targetStations: StationCode[] = [];
    
    if (isCommon) {
      targetStations = STATIONS.filter(s => s.code !== StationCode.PCM_TEAM).map(s => s.code);
    } else {
      if (selectedStations.length === 0) {
        alert("請至少選擇一個場域");
        return;
      }
      targetStations = selectedStations;
    }

    // 將 itemName 同時賦值給 name 和 title，確保後端無論使用哪個變數名稱都能讀取到資料
    onSubmit({
      itemName: itemName,
      name: itemName,    // 兼容性修正：後端可能使用 .name
      title: itemName,   // 兼容性修正：後端可能使用 .title
      deadline,
      stationCodes: targetStations,
      isCommon,
      recurrence,
      recurrenceCount
    });
    
    // Reset form
    setItemName('');
    setDeadline('');
    setIsCommon(false);
    setSelectedStations([]);
    setRecurrence(RecurrenceType.NONE);
    setRecurrenceCount(1);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-lg">
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
             新增任務 / 發佈工項
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* Common Task Toggle */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div className="flex items-start">
               <div className="flex items-center h-5">
                 <input
                   id="isCommon"
                   type="checkbox"
                   checked={isCommon}
                   onChange={(e) => {
                    const checked = e.target.checked;
                    setIsCommon(checked);
                    if (checked) {
                      // 當勾選共同工項時，自動選取四個停車場，排除履約管理團隊
                      const commonStations = STATIONS.filter(s => s.code !== StationCode.PCM_TEAM).map(s => s.code);
                      setSelectedStations(commonStations);
                    }
                  }}
                   className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                 />
               </div>
               <div className="ml-3 text-sm">
                 <label htmlFor="isCommon" className="font-bold text-gray-800 flex items-center">
                    <Globe className="w-4 h-4 mr-1 text-blue-600"/>
                    共同工項一鍵分派
                 </label>
                 <p className="text-gray-500 mt-1">
                   勾選後，系統將自動針對「四個停車場」分別生成 4 筆獨立追蹤的任務。
                 </p>
               </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">工項名稱</label>
            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="例如：113年度第二季履約會議"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">截止日期</label>
            <input
              type="date"
              required
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Recurrence Settings */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center">
              <Repeat className="w-4 h-4 mr-1 text-gray-600"/>
              重複設定
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">重複週期</label>
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                  className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value={RecurrenceType.NONE}>不重複</option>
                  <option value={RecurrenceType.MONTHLY}>每月重複一次</option>
                  <option value={RecurrenceType.QUARTERLY}>每季重複一次</option>
                  <option value={RecurrenceType.SEMI_ANNUALLY}>每半年重複一次</option>
                  <option value={RecurrenceType.ANNUALLY}>每年重複一次</option>
                </select>
              </div>
              {recurrence !== RecurrenceType.NONE && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">重複次數</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={recurrenceCount}
                    onChange={(e) => setRecurrenceCount(parseInt(e.target.value) || 1)}
                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              )}
            </div>
            {recurrence !== RecurrenceType.NONE && (
              <p className="text-[10px] text-gray-500 mt-2">
                系統將根據截止日期自動生成後續 {recurrenceCount} 個週期的任務。
              </p>
            )}
          </div>

          {/* Station Selector (Disabled if Common) */}
          <div className={`transition-opacity ${isCommon ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              選擇場域 (個別發佈)
            </label>
            <div className="grid grid-cols-2 gap-3">
              {STATIONS.map((station) => (
                <div 
                  key={station.code}
                  onClick={() => !isCommon && handleStationToggle(station.code)}
                  className={`p-3 border rounded-lg cursor-pointer flex items-center transition-all ${
                    selectedStations.includes(station.code) 
                      ? 'bg-blue-600 border-blue-600 text-white' 
                      : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border mr-2 flex items-center justify-center ${
                    selectedStations.includes(station.code) ? 'border-white bg-white' : 'border-gray-400'
                  }`}>
                    {selectedStations.includes(station.code) && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                  </div>
                  <span className="text-sm font-medium">{station.name}</span>
                </div>
              ))}
            </div>
             {isCommon && (
                <p className="text-xs text-blue-600 mt-2 flex items-center">
                   <AlertCircle className="w-3 h-3 mr-1"/>
                   已啟用共同分派，將自動選取所有場域。
                </p>
             )}
          </div>

          <div className="pt-4 flex justify-end space-x-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium shadow-sm"
            >
              {isCommon ? '確認發佈 (產生4筆)' : `確認發佈 (產生${selectedStations.length}筆)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;