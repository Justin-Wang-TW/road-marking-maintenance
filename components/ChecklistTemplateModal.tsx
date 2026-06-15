import React, { useState, useEffect } from 'react';
import { ChecklistItem } from '../types';
import { X, Plus, Trash2, Loader2, Edit2, Check, AlertTriangle, Save, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';

interface ChecklistTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialItems: ChecklistItem[];
  onSave: (items: ChecklistItem[]) => Promise<void>;
}

const ChecklistTemplateModal: React.FC<ChecklistTemplateModalProps> = ({ isOpen, onClose, initialItems, onSave }) => {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // New Item Input State
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemContent, setNewItemContent] = useState('');

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [editContent, setEditContent] = useState('');

  // Collapse State
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  useEffect(() => {
    if (isOpen) {
      setItems([...initialItems]);
    }
  }, [isOpen, initialItems]);

  if (!isOpen) return null;

  // --- Actions ---

  const handleAddItem = () => {
    if (!newItemCategory.trim() || !newItemContent.trim()) {
      alert("請填寫「分類」與「檢查項目內容」");
      return;
    }
    const newItem: ChecklistItem = {
      id: Date.now().toString(), // Simple ID generation
      category: newItemCategory.trim(),
      content: newItemContent.trim()
    };
    setItems(prev => [...prev, newItem]);
    setNewItemContent(''); // Keep category for easier consecutive adding
  };

  const handleDeleteItem = (id: string) => {
    if (window.confirm("確定要刪除此檢查項目嗎？(這可能會影響歷史紀錄的顯示)")) {
      setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const startEditing = (item: ChecklistItem) => {
    setEditingId(item.id);
    setEditCategory(item.category);
    setEditContent(item.content);
  };

  const saveEditing = () => {
    if (!editCategory.trim() || !editContent.trim()) {
      alert("內容不能為空");
      return;
    }
    setItems(prev => prev.map(item => 
      item.id === editingId 
        ? { ...item, category: editCategory.trim(), content: editContent.trim() }
        : item
    ));
    setEditingId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    await onSave(items);
    setIsSaving(false);
    onClose();
  };

  // Grouping for display (Optional, but flat list might be easier for editing in this context? 
  // actually grouping is better for visual organization)
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in">
        
        {/* Header */}
        <div className="p-5 border-b bg-gray-50 rounded-t-xl flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-gray-800 flex items-center">
              <Edit2 className="w-5 h-5 mr-2 text-blue-600" />
              編輯檢核項目
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              在此新增、修改或刪除每月檢核表的檢查工項
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* 1. Add New Item Section */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 shadow-sm">
            <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center">
              <Plus className="w-4 h-4 mr-1" /> 新增工項
            </h4>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="w-full md:w-1/3">
                <input
                  type="text"
                  placeholder="分類 (如: 環境整潔)"
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  list="category-suggestions"
                />
                <datalist id="category-suggestions">
                  {Object.keys(groupedItems).map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
              <div className="w-full md:w-1/2">
                <input
                  type="text"
                  placeholder="檢查項目敘述 (如: 地面無垃圾堆積)"
                  value={newItemContent}
                  onChange={(e) => setNewItemContent(e.target.value)}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
              <button 
                onClick={handleAddItem}
                className="w-full md:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm flex items-center justify-center whitespace-nowrap shadow-sm"
              >
                <Plus className="w-4 h-4 mr-1" /> 加入列表
              </button>
            </div>
          </div>

          {/* 2. Existing Items List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-gray-800">
                現有項目列表 ({items.length})
              </h4>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                修改後請點擊下方的「儲存變更」以生效
              </span>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 text-gray-400">
                <AlertTriangle className="w-10 h-10 mb-2 opacity-50" />
                <p>目前清單為空，請從上方新增項目。</p>
              </div>
            ) : (
              <div className="space-y-6">
                {(Object.entries(groupedItems) as [string, ChecklistItem[]][]).map(([category, catItems]) => {
                  const isCollapsed = collapsedCategories[category];
                  return (
                    <div key={category} className="border border-blue-100 rounded-xl overflow-hidden bg-white shadow-sm">
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
                          {catItems.map((item) => (
                            <div key={item.id} className="p-3 hover:bg-gray-50 transition-colors group">
                              {editingId === item.id ? (
                                <div className="flex flex-col md:flex-row gap-2 items-start md:items-center animate-fade-in bg-blue-50 p-2 -m-2 rounded-lg">
                                  <input 
                                    type="text" 
                                    value={editCategory} 
                                    onChange={(e) => setEditCategory(e.target.value)}
                                    className="w-full md:w-1/4 p-2 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="分類"
                                  />
                                  <input 
                                    type="text" 
                                    value={editContent} 
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="flex-1 w-full p-2 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="項目內容"
                                  />
                                  <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                                    <button 
                                      onClick={saveEditing} 
                                      className="flex-1 md:flex-none px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-bold flex items-center justify-center"
                                    >
                                      <Check className="w-3 h-3 mr-1" /> 確定
                                    </button>
                                    <button 
                                      onClick={cancelEditing} 
                                      className="flex-1 md:flex-none px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs font-bold flex items-center justify-center"
                                    >
                                      <X className="w-3 h-3 mr-1" /> 取消
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex justify-between items-center gap-4">
                                  <span className="text-sm text-gray-800 flex-1">{item.content}</span>
                                  <div className="flex items-center gap-1 transition-opacity">
                                    <button
                                      onClick={() => startEditing(item)}
                                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                      title="編輯"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                      title="刪除"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t bg-gray-50 rounded-b-xl flex justify-between items-center">
          <div className="text-xs text-gray-500 hidden sm:block">
            確認修改完成後，請務必點擊右下角按鈕儲存。
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              onClick={onClose} 
              className="flex-1 sm:flex-none px-5 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors"
            >
              取消
            </button>
            <button 
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold text-sm shadow-md flex items-center justify-center transition-all transform active:scale-95"
            >
              {isSaving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 儲存中...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> 儲存變更</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChecklistTemplateModal;