
import React, { useState, useEffect } from 'react';
import { ChecklistItem, User, StationCode, CheckStatus, UserRole } from '../types';
import { STATIONS } from '../constants';
import { X, Save, Loader2, AlertTriangle, Settings, Camera, Trash2, Image as ImageIcon, ChevronDown, ChevronRight } from 'lucide-react';

interface ChecklistSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  template: ChecklistItem[];
  onSubmit: (data: any) => Promise<void>;
  onManageTemplate?: () => void; 
}

const ChecklistSubmissionModal: React.FC<ChecklistSubmissionModalProps> = ({ 
  isOpen, onClose, currentUser, template, onSubmit, onManageTemplate 
}) => {
  const [stationCode, setStationCode] = useState<string>('');
  const [yearMonth, setYearMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [answers, setAnswers] = useState<Record<string, CheckStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({}); // State for files
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const showManageButton = !!onManageTemplate;

  useEffect(() => {
    if (isOpen) {
      const assigned = currentUser.assignedStation ? currentUser.assignedStation.split(',') : [];
      if (assigned.includes('ALL')) {
        if (STATIONS.length > 0) setStationCode(STATIONS[0].code);
      } else if (assigned.length > 0) {
        setStationCode(assigned[0]);
      }
      
      const initialAnswers: Record<string, CheckStatus> = {};
      template.forEach(t => initialAnswers[t.id] = CheckStatus.OK);
      setAnswers(initialAnswers);
      setNotes({});
      setFiles({});
      setCollapsedCategories({});
    }
  }, [isOpen, currentUser, template]);

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  if (!isOpen) return null;

  const handleStatusChange = (itemId: string, status: CheckStatus) => {
    setAnswers(prev => ({ ...prev, [itemId]: status }));
  };

  const handleNoteChange = (itemId: string, note: string) => {
    setNotes(prev => ({ ...prev, [itemId]: note }));
  };

  const handleFileChange = (itemId: string, file: File | null) => {
    if (file && file.size > 5 * 1024 * 1024) {
      alert("單張照片大小請勿超過 5MB");
      return;
    }
    setFiles(prev => ({ ...prev, [itemId]: file }));
  };

  // Helper to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleSubmit = async () => {
    if (!stationCode || !yearMonth) {
      alert("請選擇場域與月份");
      return;
    }

    for (const item of template) {
      if (answers[item.id] === CheckStatus.ISSUE && (!notes[item.id] || !notes[item.id].trim())) {
        alert(`請為異常項目「${item.content}」填寫說明備註`);
        return;
      }
    }

    setIsSubmitting(true);
    
    try {
      // Process files and build results array
      const resultsPromises = template.map(async (t) => {
        let fileData = undefined;
        const file = files[t.id];
        
        if (file) {
          const base64 = await fileToBase64(file);
          fileData = {
            name: file.name,
            type: file.type,
            content: base64
          };
        }

        return {
          itemId: t.id,
          category: t.category, 
          content: t.content,   
          status: answers[t.id],
          note: notes[t.id] || '',
          file: fileData // Pass file data to backend
        };
      });

      const processedResults = await Promise.all(resultsPromises);

      const submissionData = {
        stationCode,
        yearMonth,
        submittedBy: currentUser.email,
        results: processedResults
      };

      await onSubmit(submissionData);
      onClose();
    } catch (error) {
      console.error(error);
      alert("提交失敗，請檢查網路連線或檔案大小");
    } finally {
      setIsSubmitting(false);
    }
  };

  const groupedItems = template.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-fade-in">
        <div className="p-5 border-b bg-gray-50 rounded-t-xl flex justify-between items-center">
           <h3 className="text-xl font-bold text-gray-800">每月場館檢核填報</h3>
           <div className="flex items-center gap-2">
             {showManageButton && (
               <button 
                 onClick={onManageTemplate}
                 className="flex items-center text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded hover:bg-blue-100 font-medium transition-colors border border-blue-200 shadow-sm"
               >
                 <Settings className="w-3.5 h-3.5 mr-1" /> 管理/編輯工項
               </button>
             )}
             <button onClick={onClose}><X className="w-6 h-6 text-gray-500" /></button>
           </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
             <div>
               <label className="text-xs font-bold text-gray-500 block mb-1">場域</label>
               <select
                 value={stationCode}
                 onChange={(e) => setStationCode(e.target.value)}
                 disabled={!currentUser.assignedStation?.includes('ALL') && currentUser.assignedStation?.split(',').length === 1}
                 className="w-full p-2 border rounded bg-white disabled:bg-gray-100"
               >
                 {STATIONS.map(s => {
                    if (s.code === StationCode.PCM_TEAM && (currentUser.role === UserRole.GC || currentUser.role === UserRole.SUBCONTRACTOR)) return null;
                    const assigned = currentUser.assignedStation ? currentUser.assignedStation.split(',') : [];
                    if (assigned.includes('ALL') || assigned.includes(s.code)) {
                        return <option key={s.code} value={s.code}>{s.name}</option>;
                    }
                    return null;
                 })}
               </select>
             </div>
             <div>
               <label className="text-xs font-bold text-gray-500 block mb-1">月份</label>
               <input
                 type="month"
                 value={yearMonth}
                 onChange={(e) => setYearMonth(e.target.value)}
                 className="w-full p-2 border rounded bg-white"
               />
             </div>
          </div>

          <div className="space-y-6">
            {Object.keys(groupedItems).length === 0 ? (
                <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-lg border-2 border-dashed">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50"/>
                    <p>目前沒有檢核項目</p>
                    {showManageButton && <p className="text-xs mt-1 text-blue-500">請點擊右上角「管理/編輯工項」新增</p>}
                </div>
            ) : (
                (Object.entries(groupedItems) as [string, ChecklistItem[]][]).map(([category, catItems]) => {
                  const isCollapsed = collapsedCategories[category];
                  return (
                    <div key={category} className="border border-blue-100 rounded-lg overflow-hidden shadow-sm">
                      <div 
                        className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex justify-between items-center cursor-pointer hover:bg-blue-100 transition-colors"
                        onClick={() => toggleCategory(category)}
                      >
                        <div className="flex items-center gap-2">
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4 text-blue-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-blue-600" />
                          )}
                          <h5 className="font-bold text-blue-800 text-sm">{category}</h5>
                        </div>
                        <span className="text-xs font-mono text-blue-600 bg-white px-2 py-0.5 rounded border border-blue-200">
                          {catItems.length} 項
                        </span>
                      </div>
                      
                      {!isCollapsed && (
                        <div className="divide-y divide-gray-100">
                          {catItems.map(item => {
                              const status = answers[item.id] || CheckStatus.OK;
                              const currentFile = files[item.id];

                              return (
                              <div key={item.id} className={`p-4 ${status === CheckStatus.ISSUE ? 'bg-red-50' : 'bg-white'}`}>
                                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                      <div className="flex-1 pt-1">
                                          <p className="text-sm font-medium text-gray-800">{item.content}</p>
                                      </div>
                                      
                                      <div className="flex flex-col gap-2 min-w-[280px]">
                                          {/* Status Buttons */}
                                          <div className="flex gap-2 justify-end">
                                              {Object.values(CheckStatus).map(s => (
                                                  <button
                                                  key={s}
                                                  onClick={() => handleStatusChange(item.id, s)}
                                                  className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${
                                                      status === s 
                                                      ? s === CheckStatus.OK ? 'bg-green-600 text-white border-green-600'
                                                      : s === CheckStatus.ISSUE ? 'bg-red-600 text-white border-red-600'
                                                      : 'bg-gray-600 text-white border-gray-600'
                                                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                  }`}
                                                  >
                                                      {s}
                                                  </button>
                                              ))}
                                          </div>

                                          {/* Inputs Row */}
                                          <div className="flex gap-2 items-center">
                                              {/* File Upload Button */}
                                              <div className="relative shrink-0">
                                                  <input 
                                                      type="file" 
                                                      id={`file-${item.id}`} 
                                                      className="hidden" 
                                                      accept="image/*"
                                                      onChange={(e) => handleFileChange(item.id, e.target.files?.[0] || null)}
                                                  />
                                                  <label 
                                                      htmlFor={`file-${item.id}`}
                                                      className={`flex items-center justify-center p-2 rounded cursor-pointer border transition-colors ${
                                                          currentFile 
                                                          ? 'bg-blue-100 text-blue-600 border-blue-300' 
                                                          : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
                                                      }`}
                                                      title="上傳照片"
                                                  >
                                                      <Camera className="w-4 h-4" />
                                                  </label>
                                              </div>

                                              {/* Note Input */}
                                              <input 
                                                  type="text" 
                                                  placeholder={status === CheckStatus.ISSUE ? "異常狀況說明 (必填)" : "備註說明 (選填)"}
                                                  value={notes[item.id] || ''}
                                                  onChange={(e) => handleNoteChange(item.id, e.target.value)}
                                                  className={`flex-1 text-sm p-2 border rounded outline-none focus:ring-1 ${
                                                      status === CheckStatus.ISSUE 
                                                      ? 'border-red-300 focus:ring-red-500 bg-white placeholder-red-300' 
                                                      : 'border-gray-200 focus:ring-blue-500 bg-gray-50'
                                                  }`}
                                              />
                                          </div>

                                          {/* File Preview Label */}
                                          {currentFile && (
                                              <div className="flex justify-end">
                                                  <div className="flex items-center gap-2 bg-blue-50 px-2 py-1 rounded border border-blue-100 max-w-full">
                                                      <ImageIcon className="w-3 h-3 text-blue-500" />
                                                      <span className="text-xs text-blue-700 truncate max-w-[150px]">{currentFile.name}</span>
                                                      <button 
                                                          onClick={() => handleFileChange(item.id, null)}
                                                          className="text-red-500 hover:text-red-700"
                                                      >
                                                          <Trash2 className="w-3 h-3" />
                                                      </button>
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              </div>
                              );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            取消
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center shadow-sm"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isSubmitting ? '處理照片並提交...' : '確認提交'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChecklistSubmissionModal;
