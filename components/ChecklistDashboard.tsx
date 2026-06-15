import React, { useState, useMemo } from 'react';
import { ChecklistSubmission, ChecklistItem, User, StationCode, CheckStatus, UserRole, PlatformSettings } from '../types';
import { STATIONS } from '../constants';
import { ClipboardList, Plus, Search, Settings, FileCheck, AlertCircle, Eye, ExternalLink, Image as ImageIcon, ChevronDown, ChevronRight, BarChart3, AlertTriangle, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ChecklistTemplateModal from './ChecklistTemplateModal';
import ChecklistSubmissionModal from './ChecklistSubmissionModal';
import { exportToExcel } from '../utils';

interface ChecklistDashboardProps {
  currentUser: User;
  submissions: ChecklistSubmission[];
  template: ChecklistItem[];
  onSaveTemplate: (items: ChecklistItem[]) => Promise<void>;
  onSubmitChecklist: (data: any) => Promise<void>;
  onResolveAlert: (submissionId: string, alertId: string) => Promise<void>;
  platformSettings?: PlatformSettings;
}

const ChecklistDashboard: React.FC<ChecklistDashboardProps> = ({
  currentUser,
  submissions = [],
  template = [],
  onSaveTemplate,
  onSubmitChecklist,
  onResolveAlert,
  platformSettings
}) => {
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState<ChecklistSubmission | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'alerts'>('overview');
  const [focusBar, setFocusBar] = useState<string | null>(null);

  const [filterStation, setFilterStation] = useState<string>('ALL');
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Permission Logic
  const isReadOnly = currentUser.role === UserRole.GC || currentUser.role === UserRole.SUBCONTRACTOR || currentUser.role === UserRole.MANAGER_DEPT;
  // Only Admin or 3D Manager can resolve alerts
  const canResolveAlert = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER_3D;

  // Filter Submissions
  const filteredSubmissions = submissions.filter(sub => {
    const matchStation = filterStation === 'ALL' || sub.stationCode === filterStation;
    const matchMonth = filterMonth === '' || sub.yearMonth === filterMonth;
    
    const assignedStations = currentUser.assignedStation ? currentUser.assignedStation.split(',') : [];
    if (!assignedStations.includes('ALL') && !assignedStations.includes(sub.stationCode)) return false;

    if (sub.stationCode === StationCode.PCM_TEAM && (currentUser.role === UserRole.GC || currentUser.role === UserRole.SUBCONTRACTOR)) return false;

    return matchStation && matchMonth;
  });

  // --- Chart Data Calculation ---
  const { chartData, allStationNames } = useMemo(() => {
    // 1. Filter submissions for the chart (respecting permissions and station filter, but IGNORING month filter)
    const chartSubmissions = submissions.filter(sub => {
      const assignedStations = currentUser.assignedStation ? currentUser.assignedStation.split(',') : [];
      // Permission check
      if (!assignedStations.includes('ALL') && !assignedStations.includes(sub.stationCode)) return false;
      if (sub.stationCode === StationCode.PCM_TEAM && (currentUser.role === UserRole.GC || currentUser.role === UserRole.SUBCONTRACTOR)) return false;
      // UI Filter check
      if (filterStation !== 'ALL' && sub.stationCode !== filterStation) return false;
      return true;
    });

    // 2. Get unique months and sort
    const months = Array.from(new Set(chartSubmissions.map(s => s.yearMonth))).sort();

    // 3. Get involved stations
    const involvedStationCodes = Array.from(new Set(chartSubmissions.map(s => s.stationCode)));
    const names = involvedStationCodes.map(code => STATIONS.find(s => s.code === code)?.name || code);

    // 4. Build data points
    const data = months.map(month => {
      const point: any = { name: month };
      involvedStationCodes.forEach(code => {
        const stationName = STATIONS.find(s => s.code === code)?.name || code;
        const sub = chartSubmissions.find(s => s.yearMonth === month && s.stationCode === code);
        
        if (sub) {
          const score = sub.results.reduce((acc, item) => {
            if (item.status === CheckStatus.OK) return acc + 1;
            if (item.status === CheckStatus.ISSUE) return acc - 1;
            // NA is 0
            return acc;
          }, 0);
          point[stationName] = score;
        }
      });
      return point;
    });

    return { chartData: data, allStationNames: names };
  }, [submissions, filterStation, currentUser.assignedStation]);

  // --- Abnormality Alerts Logic (Single Month) ---
  const abnormalityAlerts = useMemo(() => {
    const accessibleSubmissions = submissions.filter(sub => {
      const assignedStations = currentUser.assignedStation ? currentUser.assignedStation.split(',') : [];
      if (!assignedStations.includes('ALL') && !assignedStations.includes(sub.stationCode)) return false;
      if (sub.stationCode === StationCode.PCM_TEAM && (currentUser.role === UserRole.GC || currentUser.role === UserRole.SUBCONTRACTOR)) return false;
      return true;
    });

    const results: { 
      id: string, 
      uniqueKey: string,
      submissionId: string,
      stationName: string, 
      month: string,
      items: string[],
      isResolved: boolean
    }[] = [];

    accessibleSubmissions.forEach(sub => {
      const issues = sub.results.filter(r => r.status === CheckStatus.ISSUE);

      if (issues.length > 0) {
        const getItemName = (itemId: string, savedContent?: string) => {
            if (savedContent) return savedContent;
            const t = template.find(t => t.id === itemId);
            return t?.content || '未知項目';
        };

        // Alert ID is now just the submission ID (or month-station combo)
        // Using month-station ensures uniqueness per month per station
        const alertId = `${sub.stationCode}-${sub.yearMonth}`; 
        const isResolved = sub.resolvedAlerts?.includes(alertId) || false;

        results.push({
          id: alertId,
          uniqueKey: sub.id,
          submissionId: sub.id,
          stationName: STATIONS.find(s => s.code === sub.stationCode)?.name || sub.stationName || sub.stationCode,
          month: sub.yearMonth,
          items: issues.map(r => getItemName(r.itemId, r.content)),
          isResolved
        });
      }
    });

    // Sort by month descending, then by station name
    return results.sort((a, b) => {
      const dateCompare = b.month.localeCompare(a.month);
      if (dateCompare !== 0) return dateCompare;
      return a.stationName.localeCompare(b.stationName);
    });
  }, [submissions, currentUser.assignedStation, template]);

  const LINE_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#9333ea', '#0891b2'];

  const handleOpenSubmission = () => {
    setIsSubmissionModalOpen(true);
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleExport = () => {
    const dataToExport: any[] = [];

    filteredSubmissions.forEach(sub => {
      sub.results.forEach(res => {
        const itemDef = template.find(t => t.id === res.itemId);
        const displayContent = res.content || itemDef?.content || '未知項目';
        const displayCategory = res.category || itemDef?.category || '未分類';

        dataToExport.push({
          '檢核月份': sub.yearMonth,
          '場域': STATIONS.find(s => s.code === sub.stationCode)?.name || sub.stationName || sub.stationCode,
          '填表人': sub.submittedBy,
          '填表時間': new Date(sub.submittedAt).toLocaleString(),
          '分類': displayCategory,
          '檢查項目': displayContent,
          '結果': res.status,
          '備註': res.note || '-',
          '照片連結': res.photoUrl || '-'
        });
      });
    });

    const dateStr = filterMonth ? filterMonth.replace('-', '年') + '月' : new Date().getFullYear() + '年';
    const fileName = `${dateStr}各停車場場館檢核紀錄匯報表`;
    
    exportToExcel(dataToExport, fileName);
  };

  const pageTitle = platformSettings?.pageTitles?.['venue_check']?.title || '每月場域檢核表';
  const pageSubtitle = platformSettings?.pageTitles?.['venue_check']?.subtitle || '定期檢視場域是否符合要求';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-gray-800 flex items-center">
             <ClipboardList className="w-6 h-6 mr-2 text-blue-600" />
             {pageTitle}
           </h2>
           <p className="text-gray-500 mt-1">
             {pageSubtitle}
           </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4 mr-2" />
            匯出 Excel
          </button>
          {!isReadOnly && (
            <>
              <button
                onClick={() => setIsTemplateModalOpen(true)}
                className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors shadow-sm border border-gray-200"
              >
                <Settings className="w-4 h-4 mr-2" />
                管理檢核項目
              </button>
              <button
                onClick={handleOpenSubmission}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                填寫本月檢核
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeSubTab === 'overview'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          檢核總覽
        </button>
        <button
          onClick={() => setActiveSubTab('alerts')}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 flex items-center ${
            activeSubTab === 'alerts'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4 mr-1" />
          異常改善追蹤
          {abnormalityAlerts.filter(a => !a.isResolved).length > 0 && (
            <span className="ml-2 bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">
              {abnormalityAlerts.filter(a => !a.isResolved).length}
            </span>
          )}
        </button>
      </div>

      {/* Content based on active sub-tab */}
      {activeSubTab === 'overview' ? (
        <>
          {/* Filters */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">場域篩選</label>
              <select
                value={filterStation}
                onChange={(e) => setFilterStation(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white min-w-[150px]"
              >
                <option value="ALL">全部場域</option>
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
              <label className="text-xs font-bold text-gray-700 block mb-1">月份篩選</label>
              <div className="flex items-center gap-2">
                <input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                />
                {filterMonth && (
                  <button 
                    onClick={() => setFilterMonth('')}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    顯示全部
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Score Chart */}
          {chartData.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
            檢核評分趨勢
          </h3>
          
          {/* Scrollable Container */}
          <div className="w-full overflow-x-auto pb-2">
            <div style={{ width: `${Math.max(100, chartData.length * 8)}%`, minWidth: '100%' }}>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickMargin={10} />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip 
                      cursor={{fill: '#f3f4f6'}}
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ fontSize: '12px' }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }} 
                      onClick={(e) => setFocusBar(focusBar === e.value ? null : e.value)}
                      cursor="pointer"
                    />
                    {allStationNames.map((stationName, index) => (
                      <Bar
                        key={stationName}
                        dataKey={stationName}
                        fill={LINE_COLORS[index % LINE_COLORS.length]}
                        fillOpacity={focusBar ? (focusBar === stationName ? 1 : 0.1) : 1}
                        onClick={() => setFocusBar(focusBar === stationName ? null : stationName)}
                        cursor="pointer"
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-500 flex gap-4 justify-center border-t pt-4">
             <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span>正常 +1分</span>
             <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-red-500 mr-1"></span>異常 -1分</span>
             <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-gray-400 mr-1"></span>不適用 0分</span>
          </div>
          <div className="mt-2 text-center text-xs text-gray-400">
            * 點擊長條圖可鎖定特定場域進行比較
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-600">檢核月份</th>
                <th className="px-6 py-4 font-semibold text-gray-600">場域</th>
                <th className="px-6 py-4 font-semibold text-gray-600">填表人</th>
                <th className="px-6 py-4 font-semibold text-gray-600">填表時間</th>
                <th className="px-6 py-4 font-semibold text-gray-600">異常項目數</th>
                <th className="px-6 py-4 font-semibold text-gray-600 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    此月份尚無檢核紀錄
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => {
                  const issueCount = sub.results.filter(r => r.status === CheckStatus.ISSUE).length;
                  return (
                    <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-gray-700">
                        {sub.yearMonth}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                          {STATIONS.find(s => s.code === sub.stationCode)?.name || sub.stationName || sub.stationCode}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{sub.submittedBy}</td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {new Date(sub.submittedAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        {issueCount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {issueCount} 項異常
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">
                            <FileCheck className="w-3 h-3 mr-1" />
                            全數正常
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setViewingSubmission(sub)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-xs flex items-center justify-end w-full"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          檢視詳情
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  ) : (
    /* Abnormality Alerts List */
    abnormalityAlerts.length > 0 ? (
      <div className="bg-red-50 p-6 rounded-xl shadow-sm border border-red-100">
        <h3 className="text-lg font-bold text-red-800 mb-4 flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2" />
          異常改善追蹤列表
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {abnormalityAlerts.map(alert => (
            <div key={alert.uniqueKey} className={`bg-white p-4 rounded-lg border shadow-sm flex flex-col ${alert.isResolved ? 'border-green-200 bg-green-50' : 'border-red-200'}`}>
              <div className="font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100 flex justify-between items-center">
                <span>{alert.stationName}</span>
                {alert.isResolved ? (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700">
                    <FileCheck className="w-3 h-3 mr-1" />
                    已改善
                  </span>
                ) : (
                  canResolveAlert && (
                    <button
                      onClick={() => onResolveAlert(alert.submissionId, alert.id)}
                      className="text-xs bg-white border border-red-200 text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      標記為已改善
                    </button>
                  )
                )}
              </div>
              
              <div className={`flex-1 space-y-4 ${alert.isResolved ? 'opacity-60' : ''}`}>
                <div>
                  <div className="text-xs font-bold text-gray-500 mb-1 flex items-center">
                    <span className={`w-2 h-2 rounded-full mr-1 ${alert.isResolved ? 'bg-green-600' : 'bg-red-600'}`}></span>
                    {alert.month} ({alert.items.length}項)
                  </div>
                  <ul className="list-none pl-3 text-sm text-gray-700 space-y-1">
                    {alert.items.map((item, idx) => (
                      <li key={idx} className="flex items-start text-xs">
                        <span className={`mr-1 ${alert.isResolved ? 'text-green-600' : 'text-red-600'}`}>•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : (
      <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
          <FileCheck className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-2">目前無異常項目</h3>
        <p className="text-gray-500">所有場館檢核狀況良好，請繼續保持！</p>
      </div>
    )
  )}

      {!isReadOnly && (
        <ChecklistTemplateModal 
          isOpen={isTemplateModalOpen}
          onClose={() => setIsTemplateModalOpen(false)}
          initialItems={template}
          onSave={onSaveTemplate}
        />
      )}

      {!isReadOnly && (
        <ChecklistSubmissionModal
          isOpen={isSubmissionModalOpen}
          onClose={() => setIsSubmissionModalOpen(false)}
          currentUser={currentUser}
          template={template}
          onSubmit={onSubmitChecklist}
          onManageTemplate={() => setIsTemplateModalOpen(true)}
        />
      )}

      {/* View Details Modal */}
      {viewingSubmission && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-fade-in">
             <div className="p-5 border-b bg-gray-50 rounded-t-xl flex justify-between items-center">
                <div>
                   <h3 className="text-xl font-bold text-gray-800">
                     {viewingSubmission.yearMonth} 場館檢核詳情
                   </h3>
                   <p className="text-sm text-gray-500 mt-1">
                     {STATIONS.find(s => s.code === viewingSubmission.stationCode)?.name || viewingSubmission.stationName || viewingSubmission.stationCode} - 填表人: {viewingSubmission.submittedBy}
                   </p>
                </div>
                <button onClick={() => setViewingSubmission(null)}><div className="p-2 hover:bg-gray-200 rounded-full"><Plus className="w-6 h-6 rotate-45 text-gray-500" /></div></button>
             </div>
             <div className="p-6 overflow-y-auto">
                {(() => {
                  // Group results by category
                  const groupedResults = viewingSubmission.results.reduce((acc, res) => {
                    const itemDef = template.find(t => t.id === res.itemId);
                    const displayCategory = res.category || itemDef?.category || '未分類';
                    if (!acc[displayCategory]) acc[displayCategory] = [];
                    acc[displayCategory].push(res);
                    return acc;
                  }, {} as Record<string, ChecklistSubmission['results']>);

                  return (
                    <div className="space-y-4">
                      {Object.entries(groupedResults).map(([category, items]) => {
                        const resultItems = items as ChecklistSubmission['results'];
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
                                {resultItems.length} 項
                              </span>
                            </div>

                            {!isCollapsed && (
                              <table className="w-full text-sm border-collapse">
                                <thead>
                                  <tr className="bg-gray-50 text-gray-600 border-b border-gray-200">
                                    <th className="p-3 text-left w-[40%]">檢查項目</th>
                                    <th className="p-3 text-center w-[15%]">結果</th>
                                    <th className="p-3 text-left w-[30%]">備註說明</th>
                                    <th className="p-3 text-right w-[15%]">佐證照片</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {resultItems.map((res, idx) => {
                                    const itemDef = template.find(t => t.id === res.itemId);
                                    const displayContent = res.content || itemDef?.content || '未知項目';
                                    
                                    return (
                                      <tr key={idx} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                        <td className="p-3 text-gray-800 align-top">{displayContent}</td>
                                        <td className="p-3 text-center align-top">
                                          <span className={`px-2 py-1 rounded-full text-xs font-bold inline-block ${
                                            res.status === CheckStatus.ISSUE ? 'bg-red-100 text-red-700' : 
                                            res.status === CheckStatus.NA ? 'bg-gray-100 text-gray-600' :
                                            'bg-green-100 text-green-700'
                                          }`}>
                                            {res.status}
                                          </span>
                                        </td>
                                        <td className="p-3 text-gray-600 align-top break-all">{res.note || '-'}</td>
                                        <td className="p-3 text-right align-top">
                                          {res.photoUrl ? (
                                            <a 
                                              href={res.photoUrl} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 border border-blue-200 transition-colors"
                                            >
                                              <ImageIcon className="w-3 h-3 mr-1" />
                                              檢視照片
                                            </a>
                                          ) : (
                                            <span className="text-gray-300 text-xs">-</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
             </div>
             <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end">
                <button onClick={() => setViewingSubmission(null)} className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors">關閉</button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ChecklistDashboard;