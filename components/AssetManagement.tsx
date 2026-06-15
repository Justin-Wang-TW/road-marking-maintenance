import React, { useState, useMemo } from 'react';
import { Asset, AssetStatus, StationCode, User, UserRole, AssetCheckRecord, AssetCheckStatus, AssetCheckBatch, AssetCheckItemResult, PlatformSettings } from '../types';
import { STATIONS } from '../constants';
import { Plus, Edit, Trash2, Search, Filter, Save, X, Upload, Image as ImageIcon, ClipboardCheck, History, FileText, ClipboardList, ChevronDown, ChevronUp, Download, LayoutGrid, List, MapPin, Box, User as UserIcon, Calendar } from 'lucide-react';
import { exportToExcel } from '../utils';

interface AssetManagementProps {
  currentUser: User | null;
  assets: Asset[];
  checkRecords: AssetCheckRecord[];
  checkBatches?: AssetCheckBatch[];
  onDelete: (id: string) => Promise<void>;
  onSubmitCheck: (record: Partial<AssetCheckRecord>, file?: { name: string, type: string, content: string }) => Promise<void>;
  onSaveBatch?: (batch: Partial<AssetCheckBatch>, files?: { [key: string]: { name: string, type: string, content: string } }) => Promise<void>;
  onSaveBatchAssets?: (items: { asset: Partial<Asset>, file?: { name: string, type: string, content: string } }[]) => Promise<void>;
  onEdit?: (asset: Partial<Asset>, file?: { name: string, type: string, content: string }) => Promise<void>;
  platformSettings?: PlatformSettings;
}

interface BatchAssetItem {
  tempId: string;
  stationCode: StationCode;
  name: string;
  unit: string;
  supplier: string;
  location: string;
  status: AssetStatus;
  statusDate: string;
  quantity: number;
  note: string;
  file?: { name: string, type: string, content: string };
}

const AssetManagement: React.FC<AssetManagementProps> = ({ currentUser, assets, checkRecords, checkBatches = [], onDelete, onSubmitCheck, onSaveBatch, onSaveBatchAssets, onEdit, platformSettings }) => {
  const [activeTab, setActiveTab] = useState<'list' | 'check_records'>('list');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid'); // Default to grid view
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isBatchCheckModalOpen, setIsBatchCheckModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Batch Add State
  const [isBatchAddModalOpen, setIsBatchAddModalOpen] = useState(false);
  const [batchAddItems, setBatchAddItems] = useState<BatchAssetItem[]>([]);
  const [currentBatchItem, setCurrentBatchItem] = useState<Omit<BatchAssetItem, 'tempId'>>({
    stationCode: StationCode.BAIFU,
    name: '',
    unit: '',
    supplier: '',
    location: '',
    status: AssetStatus.NEW,
    statusDate: new Date().toISOString().split('T')[0],
    quantity: 1,
    note: ''
  });

  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [checkingAsset, setCheckingAsset] = useState<Asset | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string, title: string } | null>(null);
  const [checkRecord, setCheckRecord] = useState<Partial<AssetCheckRecord>>({});
  const [selectedAssetHistory, setSelectedAssetHistory] = useState<Asset | null>(null);

  // Batch Check State
  const [batchCheckData, setBatchCheckData] = useState<{
    year: number;
    period: '上半年' | '下半年' | '不定期';
    checkDate: string;
    stationCode: StationCode;
    results: { [assetId: string]: AssetCheckItemResult };
  }>({
    year: new Date().getFullYear(),
    period: '上半年',
    checkDate: new Date().toISOString().split('T')[0],
    stationCode: StationCode.BAIFU,
    results: {}
  });
  const [batchFiles, setBatchFiles] = useState<{ [assetId: string]: { name: string, type: string, content: string } }>({});
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  const [filterStation, setFilterStation] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ name: string, type: string, content: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Determine available stations for the current user
  const availableStations = useMemo(() => {
    if (!currentUser) return [];
    
    let stations = STATIONS;
    if (currentUser.role === UserRole.GC || currentUser.role === UserRole.SUBCONTRACTOR) {
      stations = STATIONS.filter(s => s.code !== StationCode.PCM_TEAM);
    }

    if (currentUser.assignedStation === 'ALL') {
      return stations;
    }
    const assignedCodes = currentUser.assignedStation.split(',');
    return stations.filter(s => assignedCodes.includes(s.code));
  }, [currentUser]);

  // Filter assets
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const matchesStation = filterStation === 'ALL' || asset.stationCode === filterStation;
      const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            asset.note?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Permission check
      const userStations = currentUser?.assignedStation?.split(',') || [];
      const hasPermission = userStations.includes('ALL') || userStations.includes(asset.stationCode);

      if (asset.stationCode === StationCode.PCM_TEAM && (currentUser?.role === UserRole.GC || currentUser?.role === UserRole.SUBCONTRACTOR)) {
        return false;
      }

      return matchesStation && matchesSearch && hasPermission;
    });
  }, [assets, filterStation, searchTerm, currentUser]);

  // Group assets by station for grid view
  const assetsByStation = useMemo(() => {
    const groups: Record<string, Asset[]> = {};
    filteredAssets.forEach(asset => {
      const displayStationName = STATIONS.find(s => s.code === asset.stationCode)?.name || asset.stationName;
      if (!groups[displayStationName]) {
        groups[displayStationName] = [];
      }
      groups[displayStationName].push(asset);
    });
    return groups;
  }, [filteredAssets]);

  // Filter check records
  const filteredRecords = useMemo(() => {
    return checkRecords.filter(record => {
      const matchesStation = filterStation === 'ALL' || record.stationCode === filterStation;
      const matchesSearch = record.assetName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            record.note?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const userStations = currentUser?.assignedStation?.split(',') || [];
      const hasPermission = userStations.includes('ALL') || userStations.includes(record.stationCode);

      if (record.stationCode === StationCode.PCM_TEAM && (currentUser?.role === UserRole.GC || currentUser?.role === UserRole.SUBCONTRACTOR)) {
        return false;
      }

      return matchesStation && matchesSearch && hasPermission;
    });
  }, [checkRecords, filterStation, searchTerm, currentUser]);

  // Filter batch records
  const filteredBatches = useMemo(() => {
    return checkBatches.filter(batch => {
      const matchesStation = filterStation === 'ALL' || batch.stationCode === filterStation;
      
      const userStations = currentUser?.assignedStation?.split(',') || [];
      const hasPermission = userStations.includes('ALL') || userStations.includes(batch.stationCode);

      if (batch.stationCode === StationCode.PCM_TEAM && (currentUser?.role === UserRole.GC || currentUser?.role === UserRole.SUBCONTRACTOR)) {
        return false;
      }

      return matchesStation && hasPermission;
    });
  }, [checkBatches, filterStation, currentUser]);

  // Get history for a specific asset
  const assetHistory = useMemo(() => {
    if (!selectedAssetHistory) return [];
    return checkRecords
      .filter(r => r.assetId === selectedAssetHistory.id)
      .sort((a, b) => new Date(b.checkDate).getTime() - new Date(a.checkDate).getTime());
  }, [selectedAssetHistory, checkRecords]);

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setSelectedFile(null);
    setIsEditModalOpen(true);
  };

  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset || !onEdit) return;

    setIsUploading(true);
    try {
      await onEdit(editingAsset, selectedFile || undefined);
      setIsEditModalOpen(false);
      setEditingAsset(null);
      setSelectedFile(null);
    } catch (error) {
      console.error("Update asset failed", error);
      alert("更新失敗");
    } finally {
      setIsUploading(false);
    }
  };

  const handleBatchCheck = () => {
    const initialStation = availableStations[0]?.code || StationCode.BAIFU;
    setBatchCheckData({
      year: new Date().getFullYear(),
      period: '上半年',
      checkDate: new Date().toISOString().split('T')[0],
      stationCode: initialStation,
      results: {}
    });
    setBatchFiles({});
    setIsBatchCheckModalOpen(true);
  };

  const handleBatchAddOpen = () => {
    setCurrentBatchItem({
      stationCode: availableStations[0]?.code || StationCode.BAIFU,
      name: '',
      unit: '',
      supplier: '',
      location: '',
      status: AssetStatus.NEW,
      statusDate: new Date().toISOString().split('T')[0],
      quantity: 1,
      note: ''
    });
    setBatchAddItems([]);
    setIsBatchAddModalOpen(true);
  };

  const handleCurrentItemChange = (field: keyof Omit<BatchAssetItem, 'tempId'>, value: any) => {
    setCurrentBatchItem(prev => ({ ...prev, [field]: value }));
  };

  const handleCurrentItemFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const content = base64String.split(',')[1];
        setCurrentBatchItem(prev => ({
          ...prev,
          file: { name: file.name, type: file.type, content }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddToQueue = () => {
    if (!currentBatchItem.name) {
      alert('請輸入財產名稱');
      return;
    }
    
    setBatchAddItems(prev => [...prev, {
      ...currentBatchItem,
      tempId: Date.now().toString() + Math.random()
    }]);
    
    // Clear only Name as requested, keep others including unit and file
    setCurrentBatchItem(prev => ({
      ...prev,
      name: ''
    }));
  };

  const handleRemoveFromQueue = (tempId: string) => {
    setBatchAddItems(prev => prev.filter(item => item.tempId !== tempId));
  };

  const handleEditFromQueue = (item: BatchAssetItem) => {
    // Remove from queue
    handleRemoveFromQueue(item.tempId);
    // Load into form
    const { tempId, ...itemData } = item;
    setCurrentBatchItem(itemData);
  };

  const handleSubmitBatchAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveBatchAssets) return;

    // Validation
    const invalidItems = batchAddItems.filter(item => !item.name);
    if (invalidItems.length > 0) {
      alert('請填寫所有項目的財產名稱');
      return;
    }

    setIsUploading(true);
    try {
      const itemsToSave = batchAddItems.map(item => {
        const station = STATIONS.find(s => s.code === item.stationCode);
        return {
          asset: {
            stationCode: item.stationCode,
            stationName: station?.name || item.stationCode,
            name: item.name,
            unit: item.unit,
            supplier: item.supplier,
            location: item.location,
            status: item.status,
            statusDate: item.statusDate,
            quantity: item.quantity,
            note: item.note
          },
          file: item.file
        };
      });

      await onSaveBatchAssets(itemsToSave);
      setIsBatchAddModalOpen(false);
      setBatchAddItems([]);
    } catch (error) {
      console.error("Batch add failed", error);
      alert("批量新增失敗");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('確定要刪除此財產紀錄嗎？此動作無法復原。')) {
      await onDelete(id);
    }
  };

  const handleCheck = (asset: Asset) => {
    setCheckingAsset(asset);
    setCheckRecord({
      assetId: asset.id,
      assetName: asset.name,
      stationCode: asset.stationCode,
      checkDate: new Date().toISOString().split('T')[0],
      status: AssetCheckStatus.NORMAL,
      quantity: asset.quantity,
      note: ''
    });
    setSelectedFile(null);
    setIsCheckModalOpen(true);
  };

  const handleViewHistory = (asset: Asset) => {
    setSelectedAssetHistory(asset);
    setIsHistoryModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const content = base64String.split(',')[1];
        setSelectedFile({
          name: file.name,
          type: file.type,
          content: content
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBatchFileChange = (assetId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const content = base64String.split(',')[1];
        setBatchFiles(prev => ({
          ...prev,
          [assetId]: {
            name: file.name,
            type: file.type,
            content: content
          }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Removed handleSubmitAsset

  const handleSubmitCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkRecord.assetId) return;

    setIsUploading(true);
    try {
      await onSubmitCheck(checkRecord, selectedFile || undefined);
      setIsCheckModalOpen(false);
      setCheckingAsset(null);
      setCheckRecord({});
      setSelectedFile(null);
    } catch (error) {
      console.error("Check submission failed", error);
      alert("提交失敗");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmitBatchCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveBatch) return;

    // Prepare results array
    const stationAssets = assets.filter(a => a.stationCode === batchCheckData.stationCode);
    const results: AssetCheckItemResult[] = stationAssets.map(asset => {
      const result = batchCheckData.results[asset.id];
      return {
        assetId: asset.id,
        assetName: asset.name,
        status: result?.status || AssetCheckStatus.NORMAL,
        note: result?.note || '',
        // photoUrl will be handled by backend if file exists
      };
    });

    // Validate: if status is not NORMAL, note is required
    const invalidItems = results.filter(r => r.status !== AssetCheckStatus.NORMAL && !r.note);
    if (invalidItems.length > 0) {
      alert(`請為以下項目填寫備註：${invalidItems.map(i => i.assetName).join(', ')}`);
      return;
    }

    setIsUploading(true);
    try {
      const station = STATIONS.find(s => s.code === batchCheckData.stationCode);
      const batchToSave: Partial<AssetCheckBatch> = {
        stationCode: batchCheckData.stationCode,
        stationName: station?.name || batchCheckData.stationCode,
        year: batchCheckData.year,
        period: batchCheckData.period,
        checkDate: batchCheckData.checkDate,
        results: results
      };

      await onSaveBatch(batchToSave, batchFiles);
      setIsBatchCheckModalOpen(false);
      setBatchCheckData({
        year: new Date().getFullYear(),
        period: '上半年',
        checkDate: new Date().toISOString().split('T')[0],
        stationCode: StationCode.BAIFU,
        results: {}
      });
      setBatchFiles({});
    } catch (error) {
      console.error("Batch check submission failed", error);
      alert("提交失敗");
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case AssetStatus.NEW: return 'bg-green-100 text-green-800';
      case AssetStatus.REPLACEMENT: return 'bg-blue-100 text-blue-800';
      case AssetStatus.REPAIR: return 'bg-yellow-100 text-yellow-800';
      case AssetStatus.SCRAPPED: return 'bg-red-100 text-red-800';
      case AssetStatus.NORMAL: return 'bg-gray-100 text-gray-800';
      case AssetCheckStatus.NORMAL: return 'bg-green-100 text-green-800';
      case AssetCheckStatus.PARTIAL_MATCH: return 'bg-orange-100 text-orange-800';
      case AssetCheckStatus.OTHER: return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleExportAssets = () => {
    const dataToExport = filteredAssets.map(asset => ({
      '場域名稱': STATIONS.find(s => s.code === asset.stationCode)?.name || asset.stationName,
      '財產名稱': asset.name,
      '數量': asset.quantity,
      '單位': asset.unit || '-',
      '設備商': asset.supplier || '-',
      '所在位置': asset.location || '-',
      '狀態': asset.status,
      '備註': asset.note || '-',
      '照片連結': asset.photoUrl || '-',
      '更新日期': asset.statusDate,
      '最後更新者': asset.lastUpdatedBy || '-'
    }));

    const year = new Date().getFullYear();
    const fileName = `${year}年各停車場財產清單`;
    
    exportToExcel(dataToExport, fileName);
  };

  const handleExportCheckRecords = () => {
    const dataToExport: any[] = [];

    // Export from batches if available, otherwise from individual records
    if (checkBatches && checkBatches.length > 0) {
      filteredBatches.forEach(batch => {
        batch.results.forEach(res => {
          dataToExport.push({
            '年度': batch.year,
            '期別': batch.period,
            '場域': STATIONS.find(s => s.code === batch.stationCode)?.name || batch.stationName,
            '檢核日期': batch.checkDate,
            '提交人': batch.submittedBy,
            '財產名稱': res.assetName,
            '檢核結果': res.status,
            '備註': res.note || '-',
            '照片連結': res.photoUrl || '-'
          });
        });
      });
    } else {
      // Fallback for individual records if no batches
      filteredRecords.forEach(record => {
        dataToExport.push({
          '年度': new Date(record.checkDate).getFullYear(),
          '期別': '-',
          '場域': STATIONS.find(s => s.code === record.stationCode)?.name || record.stationCode,
          '檢核日期': record.checkDate,
          '提交人': record.checkedBy,
          '財產名稱': record.assetName,
          '檢核結果': record.status,
          '備註': record.note || '-',
          '照片連結': record.photoUrl || '-'
        });
      });
    }

    const year = new Date().getFullYear();
    const fileName = `${year}年各停車場財產檢核紀錄`;
    
    exportToExcel(dataToExport, fileName);
  };

  const renderBatchCheckModal = () => {
    const stationAssets = assets.filter(a => a.stationCode === batchCheckData.stationCode);
    
    // Get past records for this station
    const stationBatches = checkBatches.filter(b => b.stationCode === batchCheckData.stationCode);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full overflow-hidden max-h-[90vh] flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h3 className="text-lg font-bold text-gray-900">批次財產檢核</h3>
            <button onClick={() => setIsBatchCheckModalOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto flex-1">
            <form id="batchCheckForm" onSubmit={handleSubmitBatchCheck} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">年度</label>
                  <select
                    value={batchCheckData.year}
                    onChange={(e) => setBatchCheckData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                      <option key={y} value={y}>{y}年</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">期別</label>
                  <select
                    value={batchCheckData.period}
                    onChange={(e) => setBatchCheckData(prev => ({ ...prev, period: e.target.value as any }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="上半年">上半年</option>
                    <option value="下半年">下半年</option>
                    <option value="不定期">不定期</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">檢核日期</label>
                  <input
                    type="date"
                    value={batchCheckData.checkDate}
                    onChange={(e) => setBatchCheckData(prev => ({ ...prev, checkDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">場域</label>
                  <select
                    value={batchCheckData.stationCode}
                    onChange={(e) => setBatchCheckData(prev => ({ ...prev, stationCode: e.target.value as StationCode, results: {} }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    {availableStations.map(s => (
                      <option key={s.code} value={s.code}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-medium text-gray-900 mb-4">檢核項目 ({stationAssets.length})</h4>
                <div className="space-y-4">
                  {stationAssets.map(asset => {
                    const result = batchCheckData.results[asset.id] || { 
                      assetId: asset.id, 
                      assetName: asset.name, 
                      status: AssetCheckStatus.NORMAL 
                    };
                    return (
                      <div key={asset.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-2">
                          <div>
                            <p className="font-medium text-gray-900">{asset.name}</p>
                            <p className="text-xs text-gray-500">應有數量: {asset.quantity}</p>
                          </div>
                          <div className="flex items-center gap-2">
                             <select
                              value={result.status}
                              onChange={(e) => setBatchCheckData(prev => ({
                                ...prev,
                                results: {
                                  ...prev.results,
                                  [asset.id]: { ...result, status: e.target.value as AssetCheckStatus, assetId: asset.id, assetName: asset.name }
                                }
                              }))}
                              className={`border rounded-lg px-3 py-1 text-sm ${
                                result.status === AssetCheckStatus.NORMAL ? 'border-green-300 bg-green-50 text-green-800' :
                                result.status === AssetCheckStatus.PARTIAL_MATCH ? 'border-orange-300 bg-orange-50 text-orange-800' :
                                'border-gray-300 bg-gray-50 text-gray-800'
                              }`}
                            >
                              {Object.values(AssetCheckStatus).map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                          <input
                            type="text"
                            placeholder={result.status !== AssetCheckStatus.NORMAL ? "請填寫備註 (必填)" : "備註 (選填)"}
                            value={result.note || ''}
                            onChange={(e) => setBatchCheckData(prev => ({
                              ...prev,
                              results: {
                                ...prev.results,
                                [asset.id]: { ...result, note: e.target.value, assetId: asset.id, assetName: asset.name }
                              }
                            }))}
                            className={`w-full border rounded-lg px-3 py-1 text-sm ${
                              result.status !== AssetCheckStatus.NORMAL && !result.note ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                            }`}
                          />
                          <div className="flex items-center gap-2">
                            <label className="cursor-pointer flex items-center px-3 py-1 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-xs font-medium text-gray-700">
                              <Upload className="w-3 h-3 mr-1" />
                              {batchFiles[asset.id] ? '更換照片' : '上傳照片'}
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleBatchFileChange(asset.id, e)} />
                            </label>
                            {batchFiles[asset.id] && <span className="text-xs text-gray-500 truncate">{batchFiles[asset.id].name}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* History Section */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-medium text-gray-900 mb-2">歷史清查紀錄 ({stationBatches.length})</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {stationBatches.map(batch => (
                    <div key={batch.id} className="text-sm border-l-2 border-blue-500 pl-3 py-1">
                      <div className="flex justify-between">
                        <span className="font-medium">{batch.year}年 {batch.period}</span>
                        <span className="text-gray-500">{batch.checkDate}</span>
                      </div>
                      <div className="text-gray-600 text-xs">
                        提交人: {batch.submittedBy} | 異常項目: {batch.results.filter(r => r.status !== AssetCheckStatus.NORMAL).length}
                      </div>
                    </div>
                  ))}
                  {stationBatches.length === 0 && <p className="text-sm text-gray-500">尚無紀錄</p>}
                </div>
              </div>
            </form>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsBatchCheckModalOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              disabled={isUploading}
            >
              取消
            </button>
            <button
              type="submit"
              form="batchCheckForm"
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={isUploading}
            >
              {isUploading ? '提交中...' : <><Save className="w-4 h-4 mr-2" />提交檢核</>}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Permission check for export
  const canExport = useMemo(() => {
    if (!currentUser) return false;
    return [UserRole.ADMIN, UserRole.MANAGER_3D, UserRole.MANAGER_DEPT].includes(currentUser.role);
  }, [currentUser]);

  const pageTitle = platformSettings?.pageTitles?.['assets']?.title || '財產紀錄與管理';
  const pageSubtitle = platformSettings?.pageTitles?.['assets']?.subtitle || '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{pageTitle}</h2>
          {pageSubtitle && <p className="text-gray-500 mt-1">{pageSubtitle}</p>}
        </div>
        <div className="flex gap-2">
          {activeTab === 'list' && (
            <>
              {canExport && (
                <button
                  onClick={handleExportAssets}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  匯出清單
                </button>
              )}
              <button
                onClick={handleBatchAddOpen}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors ml-2"
              >
                <ClipboardList className="w-5 h-5 mr-2" />
                新增財產
              </button>
            </>
          )}
          {activeTab === 'check_records' && (
            <>
              {canExport && (
                <button
                  onClick={handleExportCheckRecords}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  匯出紀錄
                </button>
              )}
              <button
                onClick={handleBatchCheck}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ClipboardList className="w-5 h-5 mr-2" />
                新增財產檢核
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('list')}
            className={`${
              activeTab === 'list'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <FileText className="w-4 h-4 mr-2" />
            停車場財產清單
          </button>
          <button
            onClick={() => setActiveTab('check_records')}
            className={`${
              activeTab === 'check_records'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <History className="w-4 h-4 mr-2" />
            財產檢核紀錄
          </button>
        </nav>
      </div>

      {/* Filters and View Toggle */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="搜尋財產名稱或備註..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="text-gray-500 w-5 h-5" />
          <select
            value={filterStation}
            onChange={(e) => setFilterStation(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="ALL">所有場域</option>
            {availableStations.map(s => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>
          {activeTab === 'list' && (
            <div className="flex bg-gray-100 p-1 rounded-lg ml-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                title="網格檢視"
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                title="列表檢視"
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Asset List Content */}
      {activeTab === 'list' && (
        <>
          {viewMode === 'grid' ? (
            <div className="space-y-8">
              {Object.keys(assetsByStation).length > 0 ? (
                Object.entries(assetsByStation).map(([stationName, stationAssets]) => (
                  <div key={stationName} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center">
                      <div className="w-1 h-6 bg-blue-600 rounded-full mr-3"></div>
                      <h3 className="text-lg font-bold text-gray-800">{stationName}</h3>
                      <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full font-medium">
                        {stationAssets.length}
                      </span>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {stationAssets.map(asset => (
                        <div key={asset.id} className="bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200 flex flex-col">
                          {/* Card Header */}
                          <div className="p-4 border-b border-gray-100 flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-gray-900 text-lg mb-1">{asset.name}</h4>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(asset.status)}`}>
                                {asset.status}
                              </span>
                            </div>
                            {asset.photoUrl && (
                              <button 
                                onClick={() => setPreviewPhoto({ url: asset.photoUrl!, title: asset.name })}
                                className="ml-2 flex-shrink-0"
                              >
                                <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden hover:border-blue-500 transition-colors">
                                  <img src={asset.photoUrl} alt={asset.name} className="w-full h-full object-cover" />
                                </div>
                              </button>
                            )}
                          </div>
                          
                          {/* Card Body */}
                          <div className="p-4 flex-1 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-500">數量</span>
                              <span className="text-lg font-bold text-gray-900">
                                {asset.quantity} <span className="text-sm font-normal text-gray-500">{asset.unit || '個'}</span>
                              </span>
                            </div>
                            
                            <div className="space-y-2 pt-2 border-t border-gray-50">
                              <div className="flex items-start gap-2 text-sm">
                                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                <span className="text-gray-600 truncate" title={asset.location || '未指定位置'}>
                                  {asset.location || '未指定位置'}
                                </span>
                              </div>
                              <div className="flex items-start gap-2 text-sm">
                                <Box className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                <span className="text-gray-600 truncate" title={asset.supplier || '未指定設備商'}>
                                  {asset.supplier || '未指定設備商'}
                                </span>
                              </div>
                              {asset.note && (
                                <div className="flex items-start gap-2 text-sm">
                                  <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <span className="text-gray-600 line-clamp-2" title={asset.note}>
                                    {asset.note}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Card Footer */}
                          <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                            <div className="text-xs text-gray-400 flex flex-col">
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {asset.statusDate}</span>
                              <span className="flex items-center gap-1 mt-0.5"><UserIcon className="w-3 h-3" /> {asset.lastUpdatedBy?.split('@')[0] || '-'}</span>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleCheck(asset)}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                                title="執行單項檢核"
                              >
                                <ClipboardCheck className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleViewHistory(asset)}
                                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                                title="檢核歷史"
                              >
                                <History className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEdit(asset)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                title="編輯"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(asset.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="刪除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                  <p className="text-gray-500 text-lg">尚無財產紀錄</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">場域</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">財產名稱</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">數量</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">單位</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">設備商</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">所在位置</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">狀態</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">備註</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">照片</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">更新日期</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">最後更新者</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAssets.length > 0 ? (
                      filteredAssets.map((asset) => (
                        <tr key={asset.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{STATIONS.find(s => s.code === asset.stationCode)?.name || asset.stationName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{asset.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{asset.quantity}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{asset.unit || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{asset.supplier || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{asset.location || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(asset.status)}`}>
                              {asset.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={asset.note}>{asset.note || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {asset.photoUrl ? (
                              <button 
                                onClick={() => setPreviewPhoto({ url: asset.photoUrl!, title: asset.name })}
                                className="text-blue-600 hover:text-blue-800" 
                                title="預覽照片"
                              >
                                <ImageIcon className="w-5 h-5" />
                              </button>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{asset.statusDate}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{asset.lastUpdatedBy || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleCheck(asset)}
                              className="text-green-600 hover:text-green-900 mr-3"
                              title="執行單項檢核"
                            >
                              <ClipboardCheck className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleViewHistory(asset)}
                              className="text-purple-600 hover:text-purple-900 mr-3"
                              title="檢核歷史"
                            >
                              <History className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleEdit(asset)}
                              className="text-blue-600 hover:text-blue-900 mr-3"
                              title="編輯"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(asset.id)}
                              className="text-red-600 hover:text-red-900"
                              title="刪除"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={12} className="px-6 py-12 text-center text-gray-500">
                          尚無財產紀錄
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Merged Check Records Content */}
      {activeTab === 'check_records' && (
        <div className="space-y-8">
          {/* Batch Check History Table */}
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <ClipboardList className="w-5 h-5 mr-2" />
              批次檢核紀錄
            </h3>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">年度/期別</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">場域</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">檢核日期</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">提交人</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">異常項目數</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">詳情</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredBatches.length > 0 ? (
                      filteredBatches.map((batch) => (
                        <React.Fragment key={batch.id}>
                          <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedBatchId(expandedBatchId === batch.id ? null : batch.id)}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{batch.year}年 {batch.period}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{STATIONS.find(s => s.code === batch.stationCode)?.name || batch.stationName}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{batch.checkDate}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{batch.submittedBy}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                batch.results.filter(r => r.status !== AssetCheckStatus.NORMAL).length > 0 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-green-100 text-green-800'
                              }`}>
                                {batch.results.filter(r => r.status !== AssetCheckStatus.NORMAL).length} 項異常
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              {expandedBatchId === batch.id ? <ChevronUp className="w-5 h-5 inline" /> : <ChevronDown className="w-5 h-5 inline" />}
                            </td>
                          </tr>
                          {expandedBatchId === batch.id && (
                            <tr>
                              <td colSpan={6} className="bg-gray-50 px-6 py-4">
                                <div className="text-sm">
                                  <h5 className="font-bold mb-2">檢核明細</h5>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {batch.results.map((result, idx) => (
                                      <div key={idx} className={`p-3 rounded border ${
                                        result.status !== AssetCheckStatus.NORMAL ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
                                      }`}>
                                        <div className="flex justify-between items-start">
                                          <span className="font-medium">{result.assetName}</span>
                                          <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(result.status)}`}>
                                            {result.status}
                                          </span>
                                        </div>
                                        {result.note && <p className="text-xs text-gray-600 mt-1">備註: {result.note}</p>}
                                        {result.photoUrl && (
                                          <button 
                                            onClick={() => setPreviewPhoto({ url: result.photoUrl!, title: result.assetName })}
                                            className="text-blue-600 text-xs mt-1 block hover:underline"
                                          >
                                            預覽照片
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                          尚無批次檢核紀錄
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>


        </div>
      )}

      {/* Asset Modal (Create/Edit) - Removed Single Add Modal */}
      {/* Check Modal (Single) */}
      {isCheckModalOpen && checkingAsset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">執行單項財產檢核</h3>
              <button onClick={() => setIsCheckModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmitCheck} className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg mb-4">
                <p className="text-sm text-gray-500">檢核項目</p>
                <p className="font-medium text-gray-900">{checkingAsset.name}</p>
                <p className="text-xs text-gray-500 mt-1">目前狀態: {checkingAsset.status} | 數量: {checkingAsset.quantity}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">檢核日期</label>
                <input
                  type="date"
                  required
                  value={checkRecord.checkDate}
                  onChange={(e) => setCheckRecord(prev => ({ ...prev, checkDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">檢核結果</label>
                  <select
                    required
                    value={checkRecord.status}
                    onChange={(e) => setCheckRecord(prev => ({ ...prev, status: e.target.value as AssetCheckStatus }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {Object.values(AssetCheckStatus).map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">盤點數量</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={checkRecord.quantity}
                    onChange={(e) => setCheckRecord(prev => ({ ...prev, quantity: parseInt(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">檢核照片</label>
                <div className="flex items-center space-x-2">
                  <label className="cursor-pointer flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
                    <Upload className="w-4 h-4 mr-2" />
                    上傳照片
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                  <span className="text-sm text-gray-500 truncate max-w-[200px]">
                    {selectedFile ? selectedFile.name : '未選擇檔案'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
                <textarea
                  rows={3}
                  value={checkRecord.note || ''}
                  onChange={(e) => setCheckRecord(prev => ({ ...prev, note: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="異常狀況說明..."
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCheckModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  disabled={isUploading}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={isUploading}
                >
                  {isUploading ? '提交中...' : <><Save className="w-4 h-4 mr-2" />提交檢核</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && selectedAssetHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">歷次檢核紀錄</h3>
                <p className="text-sm text-gray-500">{selectedAssetHistory.name} ({selectedAssetHistory.stationName})</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {assetHistory.length > 0 ? (
                <div className="space-y-4">
                  {assetHistory.map((record) => (
                    <div key={record.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(record.status)}`}>
                            {record.status}
                          </span>
                          <span className="text-sm font-medium text-gray-900">{record.checkDate}</span>
                        </div>
                        <span className="text-xs text-gray-500">{record.checkedBy}</span>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <p className="text-sm text-gray-600">盤點數量: {record.quantity}</p>
                          {record.note && <p className="text-sm text-gray-600 mt-1">備註: {record.note}</p>}
                        </div>
                        {record.photoUrl && (
                          <button 
                            onClick={() => setPreviewPhoto({ url: record.photoUrl!, title: record.assetName })}
                            className="block w-20 h-20 flex-shrink-0"
                          >
                            <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 hover:border-blue-500">
                              <ImageIcon className="w-8 h-8 text-gray-400" />
                            </div>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  尚無檢核紀錄
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Asset Modal */}
      {isEditModalOpen && editingAsset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">編輯財產資料</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form id="editAssetForm" onSubmit={handleUpdateAsset} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">場域</label>
                    <select
                      value={editingAsset.stationCode}
                      onChange={(e) => {
                        const newCode = e.target.value as StationCode;
                        const newStation = availableStations.find(s => s.code === newCode);
                        setEditingAsset({ 
                          ...editingAsset, 
                          stationCode: newCode,
                          stationName: newStation?.name || newCode 
                        });
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      {availableStations.map(s => (
                        <option key={s.code} value={s.code}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">財產名稱</label>
                    <input
                      type="text"
                      value={editingAsset.name}
                      onChange={(e) => setEditingAsset({ ...editingAsset, name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">單位</label>
                    <input
                      type="text"
                      value={editingAsset.unit || ''}
                      onChange={(e) => setEditingAsset({ ...editingAsset, unit: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">狀態</label>
                    <select
                      value={editingAsset.status}
                      onChange={(e) => setEditingAsset({ ...editingAsset, status: e.target.value as AssetStatus })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      {Object.values(AssetStatus).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">數量</label>
                    <input
                      type="number"
                      min="1"
                      value={editingAsset.quantity}
                      onChange={(e) => setEditingAsset({ ...editingAsset, quantity: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                    <input
                      type="date"
                      value={editingAsset.statusDate}
                      onChange={(e) => setEditingAsset({ ...editingAsset, statusDate: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">設備商</label>
                  <input
                    type="text"
                    value={editingAsset.supplier || ''}
                    onChange={(e) => setEditingAsset({ ...editingAsset, supplier: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">所在位置</label>
                  <input
                    type="text"
                    value={editingAsset.location || ''}
                    onChange={(e) => setEditingAsset({ ...editingAsset, location: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
                  <input
                    type="text"
                    value={editingAsset.note || ''}
                    onChange={(e) => setEditingAsset({ ...editingAsset, note: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">照片</label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors">
                      <Upload className="w-4 h-4 mr-2" />
                      {selectedFile ? '更換檔案' : '上傳新照片'}
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </label>
                    {selectedFile ? (
                      <span className="text-sm text-green-600 flex items-center">
                        <ClipboardCheck className="w-4 h-4 mr-1" />
                        {selectedFile.name}
                      </span>
                    ) : editingAsset.photoUrl ? (
                      <span className="text-sm text-blue-600 flex items-center">
                        <ImageIcon className="w-4 h-4 mr-1" />
                        已有照片 (上傳新照片將會覆蓋)
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">未選擇檔案</span>
                    )}
                  </div>
                </div>
              </form>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                disabled={isUploading}
              >
                取消
              </button>
              <button
                type="submit"
                form="editAssetForm"
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={isUploading}
              >
                {isUploading ? '儲存中...' : <><Save className="w-4 h-4 mr-2" />儲存變更</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Check Modal */}
      {isBatchCheckModalOpen && renderBatchCheckModal()}
      {/* Batch Add Modal */}
      {isBatchAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-7xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">新增財產</h3>
              <button onClick={() => setIsBatchAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto md:overflow-hidden flex flex-col md:flex-row min-h-0">
              {/* Left Panel: Form */}
              <div className="w-full md:w-5/12 p-6 md:border-r border-gray-200 md:overflow-y-auto bg-white">
                <h4 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                  <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded mr-2">1</span>
                  新增項目 (Add Item)
                </h4>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">場域 (Field)</label>
                      <select
                        value={currentBatchItem.stationCode}
                        onChange={(e) => handleCurrentItemChange('stationCode', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        {availableStations.map(s => (
                          <option key={s.code} value={s.code}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">財產名稱 (Name)</label>
                      <input
                        type="text"
                        value={currentBatchItem.name}
                        onChange={(e) => handleCurrentItemChange('name', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        placeholder="例如：辦公椅"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">單位 (Unit)</label>
                      <input
                        type="text"
                        value={currentBatchItem.unit}
                        onChange={(e) => handleCurrentItemChange('unit', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        placeholder="例如：張"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">狀態 (Status)</label>
                      <select
                        value={currentBatchItem.status}
                        onChange={(e) => handleCurrentItemChange('status', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        {Object.values(AssetStatus).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">數量 (Qty)</label>
                      <input
                        type="number"
                        min="1"
                        value={currentBatchItem.quantity}
                        onChange={(e) => handleCurrentItemChange('quantity', parseInt(e.target.value))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">日期 (Date)</label>
                      <input
                        type="date"
                        value={currentBatchItem.statusDate}
                        onChange={(e) => handleCurrentItemChange('statusDate', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">設備商 (Supplier)</label>
                    <input
                      type="text"
                      value={currentBatchItem.supplier}
                      onChange={(e) => handleCurrentItemChange('supplier', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="供應商名稱"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">所在位置 (Location)</label>
                    <input
                      type="text"
                      value={currentBatchItem.location}
                      onChange={(e) => handleCurrentItemChange('location', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="例如：B1 管理室"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">備註 (Note)</label>
                    <input
                      type="text"
                      value={currentBatchItem.note}
                      onChange={(e) => handleCurrentItemChange('note', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="選填"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">照片 (Photo)</label>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors">
                        <Upload className="w-4 h-4 mr-2" />
                        {currentBatchItem.file ? '更換檔案' : '選擇檔案'}
                        <input type="file" accept="image/*" className="hidden" onChange={handleCurrentItemFileChange} />
                      </label>
                      {currentBatchItem.file ? (
                        <span className="text-sm text-green-600 flex items-center">
                          <ClipboardCheck className="w-4 h-4 mr-1" />
                          {currentBatchItem.file.name}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">未選擇檔案</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={handleAddToQueue}
                      className="w-full flex items-center justify-center px-4 py-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 font-medium transition-colors"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      加入待提交清單 (Add to Queue)
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Panel: List */}
              <div className="w-full md:w-7/12 bg-gray-50 flex flex-col md:h-full md:overflow-hidden">
                <div className="flex justify-between items-center px-6 pt-6 mb-4 flex-shrink-0">
                  <h4 className="text-lg font-medium text-gray-800 flex items-center">
                    <span className="bg-gray-200 text-gray-800 text-xs font-bold px-2 py-1 rounded mr-2">2</span>
                    待提交清單 ({batchAddItems.length})
                  </h4>
                  <span className="text-xs text-gray-500">確認無誤後請點擊下方送出</span>
                </div>

                <div className="md:flex-1 md:overflow-y-auto space-y-3 px-6 min-h-0 pb-6 md:pb-0">
                  {batchAddItems.length > 0 ? (
                    batchAddItems.map((item) => (
                      <div key={item.tempId} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex justify-between items-start group hover:border-blue-300 transition-colors">
                        <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1">
                          <div className="col-span-2 font-medium text-gray-900 flex items-center">
                            {item.name}
                            <span className="ml-2 text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                              {availableStations.find(s => s.code === item.stationCode)?.name}
                            </span>
                          </div>
                          
                          <div className="text-sm text-gray-600">
                            <span className="text-gray-400 text-xs mr-1">數量:</span>
                            {item.quantity} {item.unit}
                          </div>
                          <div className="text-sm text-gray-600">
                            <span className="text-gray-400 text-xs mr-1">狀態:</span>
                            {item.status}
                          </div>
                          
                          {(item.supplier || item.location) && (
                            <div className="col-span-2 text-xs text-gray-500 mt-1">
                              {item.supplier && <span className="mr-3">廠商: {item.supplier}</span>}
                              {item.location && <span>位置: {item.location}</span>}
                            </div>
                          )}
                          
                          {item.file && (
                            <div className="col-span-2 text-xs text-blue-600 flex items-center mt-1">
                              <ImageIcon className="w-3 h-3 mr-1" />
                              已附照片: {item.file.name}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => handleEditFromQueue(item)}
                            className="text-gray-400 hover:text-blue-600 p-1 rounded-full hover:bg-blue-50 transition-colors"
                            title="編輯"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleRemoveFromQueue(item.tempId)}
                            className="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"
                            title="移除"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-white/50">
                      <ClipboardList className="w-12 h-12 mb-3 opacity-20" />
                      <p>尚未加入任何項目</p>
                      <p className="text-sm mt-1">請從左側填寫資料並加入</p>
                    </div>
                  )}
                </div>

                <div className="px-6 pb-6 flex-shrink-0 bg-gray-50 z-10">
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-4 text-sm text-gray-600">
                      <span>總筆數: {batchAddItems.length}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSubmitBatchAdd}
                      className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all transform active:scale-[0.99]"
                      disabled={isUploading || batchAddItems.length === 0}
                    >
                      {isUploading ? (
                        '提交中...'
                      ) : (
                        <>
                          <Save className="w-5 h-5 mr-2" />
                          送出所有財產資料 (Submit All)
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[100] p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-5xl w-full max-h-full flex flex-col items-center">
            <button 
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 flex items-center gap-2"
            >
              <span className="text-sm">關閉</span>
              <X className="w-8 h-8" />
            </button>
            <div className="bg-white p-2 rounded-lg shadow-2xl max-h-[80vh] overflow-hidden">
              <img 
                src={previewPhoto.url} 
                alt={previewPhoto.title} 
                className="max-w-full max-h-[75vh] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="mt-4 text-white text-center">
              <h4 className="text-lg font-bold">{previewPhoto.title}</h4>
              <a 
                href={previewPhoto.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block underline"
                onClick={(e) => e.stopPropagation()}
              >
                在新視窗開啟原始圖片
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetManagement;
