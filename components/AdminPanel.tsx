import React, { useState } from 'react';
import { User, AuditLog, UserRole, StationCode, Task, Contact, ROLE_LABELS, EmailTemplate, PlatformSettings } from '../types';
import { Shield, Users, FileText, Search, Activity, Lock, Unlock, X, ListTodo, Plus, Contact as ContactIcon, Check, Copy, Key, Loader2, AlertTriangle, UserCheck, Building2, ShieldAlert, UserPlus, Trash2, Mail, Info, Send, ChevronDown, Settings, Link, MapPin, Layout as LayoutIcon, Save, Calendar } from 'lucide-react';
import { STATIONS, APP_CONFIG } from '../constants';
import TaskList from './TaskList';
import CreateTaskModal from './CreateTaskModal';
import ContactList from './ContactList';
import { sha256, generateRandomPassword } from '../utils';

interface AdminPanelProps {
  users: User[];
  logs: AuditLog[];
  onUpdateUser: (email: string, updates: Partial<User>) => Promise<boolean>;
  onDeleteUser: (email: string) => Promise<boolean>;
  currentUser: User;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onModifyTask?: (task: Task) => void;
  onCreateTask: (taskData: any) => void; 
  onViewDetail: (task: Task) => void; 
  contacts: Contact[];
  onSaveContact: (contact: Partial<Contact>) => Promise<void>;
  emailTemplate: EmailTemplate;
  onSaveEmailTemplate: (template: EmailTemplate) => Promise<void>;
  onSendWelcomeEmail: (email: string, name: string, password: string) => Promise<void>;
  platformSettings: PlatformSettings;
  onUpdatePlatformSettings: (settings: PlatformSettings) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  users = [], 
  logs = [], 
  onUpdateUser,
  onDeleteUser,
  currentUser,
  tasks = [],
  onEditTask,
  onModifyTask,
  onCreateTask,
  onViewDetail,
  contacts = [],
  onSaveContact,
  emailTemplate,
  onSaveEmailTemplate,
  onSendWelcomeEmail,
  platformSettings,
  onUpdatePlatformSettings
}) => {
  // 新增 'pending' 頁籤類型
  const [activeTab, setActiveTab] = useState<'tasks' | 'pending' | 'users' | 'logs' | 'contacts' | 'emailTemplate' | 'platformSettings'>('tasks');
  
  // 郵件範本編輯 State
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate>(emailTemplate);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  
  // 刪除使用者相關 State
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 停用/啟用使用者相關 State
  const [userToToggleStatus, setUserToToggleStatus] = useState<User | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // 核准流程相關 State
  const [approvingUser, setApprovingUser] = useState<User | null>(null);
  const [approvalRole, setApprovalRole] = useState<UserRole>(UserRole.GC); 
  const [approvalStation, setApprovalStation] = useState<string[]>(['ALL']);
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);

  // 核准成功憑證視窗 State
  const [createdCredentials, setCreatedCredentials] = useState<{name: string, email: string, password: string} | null>(null);

  // 平台設定編輯 State
  const [editingPlatformSettings, setEditingPlatformSettings] = useState({
    ...platformSettings,
    stations: platformSettings.stations || STATIONS
  });
  const [isSavingPlatformSettings, setIsSavingPlatformSettings] = useState(false);
  const [newStationName, setNewStationName] = useState('');
  const [newStationCode, setNewStationCode] = useState('');
  const [openStationDropdownId, setOpenStationDropdownId] = useState<string | null>(null);

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // 處理 LOGO 上傳
  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('請上傳圖片檔案 (JPG, PNG 等)');
      return;
    }

    if (!platformSettings.driveFolderId) {
      alert('請先設定 Google Drive 資料夾 ID');
      return;
    }

    setIsUploadingLogo(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64Content = (reader.result as string).split(',')[1];
        
        const payload = {
          action: 'uploadLogo',
          userEmail: currentUser.email,
          token: 'dummy-token', // 替換為實際的 token 如果有實作
          folderId: platformSettings.driveFolderId,
          file: {
            name: `logo_${new Date().getTime()}_${file.name}`,
            type: file.type,
            content: base64Content
          }
        };

        // 實際呼叫 GAS API
        const response = await fetch(APP_CONFIG.SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // 加入此行避開 CORS 問題
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        
        if (result.success) {
          setEditingPlatformSettings({
            ...editingPlatformSettings,
            loginLogoUrl: result.url
          });
          alert('LOGO 上傳成功！請記得點擊「儲存設定」以套用變更。');
        } else {
          alert(result.msg || '上傳失敗');
        }

      } catch (error) {
        console.error('上傳錯誤:', error);
        alert('上傳發生錯誤');
      } finally {
        setIsUploadingLogo(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // 權限檢查
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isManager3D = currentUser.role === UserRole.MANAGER_3D;
  const canAccessAdminPanel = isAdmin || isManager3D;
  
  if (!canAccessAdminPanel) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500 bg-white rounded-xl shadow-sm">
        <Shield className="w-16 h-16 mb-4 text-red-400" />
        <h2 className="text-xl font-bold text-gray-800">存取被拒</h2>
        <p>您沒有權限存取後台管理系統。</p>
      </div>
    );
  }

  // 強力判定待審核邏輯
  const isPendingUser = (u: User) => {
    const roleVal = String(u.role || '').trim();
    const statusVal = String(u.isActive || '').trim();
    const pendingKeywords = ['PENDING', '待審核', '待分配', '待處理'];
    const isRolePending = pendingKeywords.some(k => roleVal.toUpperCase().includes(k)) || !u.role || roleVal === '';
    const isStatusPending = pendingKeywords.some(k => statusVal.toUpperCase().includes(k));
    return isRolePending || isStatusPending;
  };

  // 分離名單
  const pendingUsers = (users || []).filter(u => isPendingUser(u));
  const activeUsers = (users || []).filter(u => {
    const isPending = isPendingUser(u);
    if (isPending) return false;
    const searchTerm = userSearch.toLowerCase();
    return (
      u.name.toLowerCase().includes(searchTerm) || 
      u.email.toLowerCase().includes(searchTerm) || 
      (u.organization || '').toLowerCase().includes(searchTerm)
    );
  });

  const filteredLogs = (logs || []).filter(l => 
    l.userEmail.includes(logSearch) || l.details.includes(logSearch) || l.action.includes(logSearch)
  );

  const handleApproveSubmit = async () => {
    if (!approvingUser) return;
    setIsProcessingApproval(true);
    try {
      const tempPassword = generateRandomPassword(8);
      const hashedPassword = await sha256(tempPassword);
      const success = await onUpdateUser(approvingUser.email, {
        role: approvalRole,
        assignedStation: approvalStation.join(','),
        isActive: true,
        password: hashedPassword,
        forceChangePassword: true
      });
      if (success) {
        // 自動發送歡迎信件
        onSendWelcomeEmail(approvingUser.email, approvingUser.name, tempPassword);
        
        setCreatedCredentials({ name: approvingUser.name, email: approvingUser.email, password: tempPassword });
        setApprovingUser(null);
      } else {
        alert("核准失敗");
      }
    } catch (error) {
      alert("程序錯誤");
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => alert('已複製到剪貼簿'));
  };

  const adminTitle = platformSettings.pageTitles?.['admin']?.title || '後台管理系統';
  const adminSubtitle = platformSettings.pageTitles?.['admin']?.subtitle || '系統中樞：任務派發、權限審核與日誌稽核';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <Shield className="w-6 h-6 mr-2 text-purple-600" />
            {adminTitle}
          </h2>
          <p className="text-gray-500 mt-1">{adminSubtitle}</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-lg border shadow-sm mt-4 md:mt-0 flex-wrap gap-1">
          <button onClick={() => setActiveTab('tasks')} className={`px-3 py-2 text-sm font-medium rounded-md flex items-center transition-all ${activeTab === 'tasks' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            <ListTodo className="w-4 h-4 mr-2" /> 任務列表
          </button>
          
          {/* 新增獨立的待審核頁籤按鈕 */}
          <button onClick={() => setActiveTab('pending')} className={`px-3 py-2 text-sm font-medium rounded-md flex items-center transition-all relative ${activeTab === 'pending' ? 'bg-orange-100 text-orange-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            <UserPlus className="w-4 h-4 mr-2" /> 待審核申請
            {pendingUsers.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                {pendingUsers.length}
              </span>
            )}
          </button>

          <button onClick={() => setActiveTab('users')} className={`px-3 py-2 text-sm font-medium rounded-md flex items-center transition-all ${activeTab === 'users' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Users className="w-4 h-4 mr-2" /> 人員權限管理
          </button>
          
          <button onClick={() => setActiveTab('contacts')} className={`px-3 py-2 text-sm font-medium rounded-md flex items-center transition-all ${activeTab === 'contacts' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            <ContactIcon className="w-4 h-4 mr-2" /> 通訊錄
          </button>
          
          <button onClick={() => setActiveTab('logs')} className={`px-3 py-2 text-sm font-medium rounded-md flex items-center transition-all ${activeTab === 'logs' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            <FileText className="w-4 h-4 mr-2" /> 系統操作日誌
          </button>

          {isAdmin && (
            <button onClick={() => { setActiveTab('platformSettings'); }} className={`px-3 py-2 text-sm font-medium rounded-md flex items-center transition-all ${activeTab === 'platformSettings' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}>
              <Building2 className="w-4 h-4 mr-2" /> 平台環境設定
            </button>
          )}

          {isAdmin && (
            <button onClick={() => { setActiveTab('emailTemplate'); setEditingTemplate(emailTemplate); }} className={`px-3 py-2 text-sm font-medium rounded-md flex items-center transition-all ${activeTab === 'emailTemplate' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}>
              <Mail className="w-4 h-4 mr-2" /> 歡迎信件設定
            </button>
          )}
        </div>
      </div>

      {activeTab === 'tasks' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
           <div className="flex justify-between items-center mb-6">
             <div className="bg-blue-50 border-l-4 border-blue-500 p-4 flex-1 mr-4">
                <p className="text-sm text-blue-700"><strong>說明：</strong> 此處為全系統任務總表。您在此處新增或編輯的任務，將同步顯示於前端「進度匯報」頁面。</p>
             </div>
             {(isAdmin || isManager3D || currentUser.role === UserRole.MANAGER_DEPT) && (
               <button onClick={() => setIsCreateTaskModalOpen(true)} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap">
                 <Plus className="w-4 h-4 mr-2" /> 發佈新工項
               </button>
             )}
           </div>
           <TaskList tasks={tasks} currentUser={currentUser} onEditTask={onEditTask} onModifyTask={onModifyTask} onViewDetail={onViewDetail} />
           <CreateTaskModal isOpen={isCreateTaskModalOpen} onClose={() => setIsCreateTaskModalOpen(false)} onSubmit={(data) => { onCreateTask(data); setIsCreateTaskModalOpen(false); }} />
        </div>
      )}

      {/* --- 新增：待審核申請獨立頁面 --- */}
      {activeTab === 'pending' && (
        <div className="space-y-6">
          <div className="bg-white border border-orange-200 rounded-xl shadow-sm overflow-hidden animate-fade-in">
            <div className="bg-orange-50 px-6 py-4 border-b border-orange-100 flex items-center justify-between">
              <div className="flex items-center">
                <ShieldAlert className="w-6 h-6 text-orange-600 mr-3" />
                <h3 className="text-lg font-bold text-orange-900">
                  待審核申請列表 ({pendingUsers.length})
                </h3>
              </div>
              <p className="text-xs text-orange-700 bg-orange-200/50 px-2 py-1 rounded">僅顯示狀態為「待審核」的申請</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 text-xs font-bold border-b">
                  <tr>
                    <th className="px-6 py-4">申請人資訊</th>
                    <th className="px-6 py-4">單位名稱</th>
                    <th className="px-6 py-4">申請狀態</th>
                    <th className="px-6 py-4 text-right">管理執行</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingUsers.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-20 text-center text-gray-400">目前沒有待審核的申請案件</td></tr>
                  ) : (
                    pendingUsers.map(user => (
                      <tr key={user.email} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-800">{user.name}</div>
                          <div className="text-xs text-gray-500 font-mono">{user.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center text-sm text-gray-600">
                             <Building2 className="w-4 h-4 mr-2 text-gray-400" />
                             {user.organization || <span className="text-gray-400 italic">未填寫</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {user.role || '待分配'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isAdmin && (
                            <button 
                              onClick={() => { setApprovingUser(user); setApprovalRole(UserRole.GC); }} 
                              className="inline-flex items-center px-4 py-2 bg-orange-600 text-white text-xs font-bold rounded-lg hover:bg-orange-700 transition-colors shadow-sm"
                            >
                              <UserCheck className="w-4 h-4 mr-1.5" />
                              進行審核
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
          <div className="p-4 border-b flex items-center justify-between bg-gray-50">
            <h3 className="font-bold text-gray-700 flex items-center">
              <Users className="w-5 h-5 mr-2 text-gray-500" />
              正式人員管理
            </h3>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="搜尋姓名、Email 或單位..." 
                value={userSearch} 
                onChange={e => setUserSearch(e.target.value)} 
                className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-md focus:ring-2 focus:ring-purple-500 outline-none" 
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 font-semibold text-gray-600">姓名 / Email</th>
                  <th className="px-6 py-3 font-semibold text-gray-600">角色權限</th>
                  <th className="px-6 py-3 font-semibold text-gray-600">負責場域</th>
                  <th className="px-6 py-3 font-semibold text-gray-600">帳號狀態</th>
                  <th className="px-6 py-3 font-semibold text-gray-600 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeUsers.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">查無人員資料</td></tr>
                ) : (
                  activeUsers.map((user) => (
                    <tr key={user.email} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-gray-500 text-xs font-mono mb-1">{user.email}</div>
                        {user.organization && (
                          <div className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600 border border-gray-200">
                            {user.organization}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={user.role}
                          onChange={(e) => onUpdateUser(user.email, { role: e.target.value as UserRole })}
                          disabled={!isAdmin}
                          className={`p-1.5 border rounded text-xs bg-white font-medium shadow-sm focus:ring-2 focus:ring-blue-500 outline-none ${!isAdmin ? 'text-gray-500 bg-gray-50 cursor-not-allowed' : 'text-gray-700'}`}
                        >
                          {Object.values(UserRole).filter(r => r !== UserRole.PENDING).map(role => (
                            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative min-w-[160px]">
                          <button
                            onClick={() => setOpenStationDropdownId(openStationDropdownId === user.email ? null : user.email)}
                            className="w-full flex items-center justify-between p-2 border rounded bg-white shadow-sm text-sm text-gray-700 hover:bg-gray-50 focus:outline-none"
                            disabled={!isAdmin}
                          >
                            <span className="truncate pr-2">
                              {String(user.assignedStation || '').split(',').includes('ALL') 
                                ? '全部 (ALL)' 
                                : String(user.assignedStation || '').split(',').length + ' 個場域'}
                            </span>
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          </button>
                          
                          {openStationDropdownId === user.email && (
                            <div className="absolute z-50 mt-1 w-full bg-white border rounded shadow-lg max-h-60 overflow-y-auto">
                              <div className="p-2 flex flex-col space-y-1.5">
                                <label className={`flex items-center space-x-2 ${!isAdmin ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                  <input 
                                    type="checkbox" 
                                    checked={String(user.assignedStation || '').split(',').includes('ALL')} 
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        onUpdateUser(user.email, { assignedStation: 'ALL' });
                                      } else {
                                        onUpdateUser(user.email, { assignedStation: STATIONS[0].code });
                                      }
                                    }}
                                    disabled={!isAdmin}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                  />
                                  <span className="text-xs font-bold text-gray-700">全部 (ALL)</span>
                                </label>
                                {STATIONS.map(s => {
                                  const assigned = user.assignedStation ? String(user.assignedStation).split(',') : [];
                                  const isAll = assigned.includes('ALL');
                                  const isChecked = isAll || assigned.includes(s.code);
                                  return (
                                    <label key={s.code} className={`flex items-center space-x-2 ${!isAdmin || isAll ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                                      <input 
                                        type="checkbox" 
                                        checked={isChecked} 
                                        onChange={(e) => {
                                          let current = [...assigned];
                                          if (isAll) current = [];
                                          
                                          if (e.target.checked) {
                                            current.push(s.code);
                                          } else {
                                            current = current.filter(c => c !== s.code);
                                          }
                                          
                                          if (current.length === 0) current = ['ALL'];
                                          if (current.length === STATIONS.length) current = ['ALL'];
                                          
                                          onUpdateUser(user.email, { assignedStation: current.join(',') });
                                        }}
                                        disabled={!isAdmin || isAll}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                      />
                                      <span className="text-xs text-gray-600">{s.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                       <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                         user.isActive === true || String(user.isActive).includes('啟用')
                           ? 'bg-green-100 text-green-700 border border-green-200' 
                           : 'bg-red-100 text-red-700 border border-red-200'
                       }`}>
                         {user.isActive === true || String(user.isActive).includes('啟用') ? '啟用中' : '已停用'}
                       </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isAdmin && (
                          <div className="flex items-center justify-end space-x-2">
                            <button 
                              onClick={() => setUserToToggleStatus(user)} 
                              title={user.isActive === true || String(user.isActive).includes('啟用') ? '停用帳號' : '啟用帳號'}
                              className={`p-2 rounded-lg transition-colors border ${
                                user.isActive === true || String(user.isActive).includes('啟用')
                                  ? 'text-orange-600 border-orange-200 hover:bg-orange-50' 
                                  : 'text-green-600 border-green-200 hover:bg-green-50'
                              }`} 
                            >
                              {user.isActive === true || String(user.isActive).includes('啟用') ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={() => setUserToDelete(user.email)} 
                              title="刪除帳號"
                              className="p-2 rounded-lg transition-colors border text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'contacts' && <ContactList contacts={contacts} onSave={onSaveContact} />}

      {activeTab === 'logs' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
           <div className="p-4 border-b flex items-center justify-between bg-gray-50">
            <h3 className="font-bold text-gray-700 flex items-center"><Activity className="w-4 h-4 mr-2 text-gray-500"/> 系統稽核紀錄</h3>
            <div className="relative w-64">
               <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
               <input type="text" placeholder="搜尋..." value={logSearch} onChange={e => setLogSearch(e.target.value)} className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-md focus:ring-2 focus:ring-purple-500 outline-none" />
            </div>
          </div>
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b sticky top-0">
                <tr><th className="px-6 py-3 font-semibold text-gray-600">時間戳記</th><th className="px-6 py-3 font-semibold text-gray-600">操作者</th><th className="px-6 py-3 font-semibold text-gray-600">動作</th><th className="px-6 py-3 font-semibold text-gray-600">詳細內容</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.length === 0 ? (<tr><td colSpan={4} className="p-4 text-center text-gray-400">尚無紀錄</td></tr>) : 
                  (filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-500 text-xs font-mono">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="px-6 py-3 font-medium text-gray-800">{log.userEmail}</td>
                      <td className="px-6 py-3"><span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{log.action}</span></td>
                      <td className="px-6 py-3 text-gray-600">{log.details}</td>
                    </tr>
                  )))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'emailTemplate' && isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
          <div className="p-6 border-b bg-gray-50 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-800 flex items-center">
                <Mail className="w-5 h-5 mr-2 text-purple-600" />
                歡迎信件範本設定
              </h3>
              <p className="text-sm text-gray-500 mt-1">設定新用戶核准後自動發送的歡迎信件內容</p>
            </div>
            <button 
              onClick={async () => {
                setIsSavingTemplate(true);
                await onSaveEmailTemplate(editingTemplate);
                setIsSavingTemplate(false);
              }}
              disabled={isSavingTemplate}
              className="flex items-center px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-md disabled:opacity-50"
            >
              {isSavingTemplate ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              儲存範本
            </button>
          </div>
          
          <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                <div className="flex items-start">
                  <Info className="w-5 h-5 text-blue-500 mr-3 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-blue-800">可用變數說明</h4>
                    <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                      您可以在內文中使用以下標籤，系統發送時會自動替換為實際資料：
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="bg-white/60 px-2 py-1 rounded text-[11px] font-mono text-blue-800 border border-blue-100">
                        <span className="font-bold">{"{{name}}"}</span> : 使用者姓名
                      </div>
                      <div className="bg-white/60 px-2 py-1 rounded text-[11px] font-mono text-blue-800 border border-blue-100">
                        <span className="font-bold">{"{{email}}"}</span> : 登入帳號
                      </div>
                      <div className="bg-white/60 px-2 py-1 rounded text-[11px] font-mono text-blue-800 border border-blue-100">
                        <span className="font-bold">{"{{password}}"}</span> : 隨機預設密碼
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">信件主旨</label>
                  <input 
                    type="text" 
                    value={editingTemplate.subject}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                    placeholder="請輸入信件主旨..."
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">信件內文</label>
                  <textarea 
                    rows={12}
                    value={editingTemplate.body}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                    placeholder="請輸入信件內文..."
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all font-sans leading-relaxed"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center">
                  <Search className="w-4 h-4 mr-2" />
                  即時預覽 (範例)
                </h4>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 rounded-full bg-red-400"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50 text-xs text-gray-500">
                  <div className="mb-1"><span className="font-bold">收件者：</span> 新用戶 (newuser@example.com)</div>
                  <div><span className="font-bold">主旨：</span> {editingTemplate.subject}</div>
                </div>
                <div className="p-6 text-sm text-gray-800 whitespace-pre-wrap min-h-[300px] leading-relaxed">
                  {editingTemplate.body
                    .replace(/\{\{name\}\}/g, '王小明')
                    .replace(/\{\{email\}\}/g, 'newuser@example.com')
                    .replace(/\{\{password\}\}/g, 'Abc12345')
                  }
                </div>
                <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
                  <div className="flex items-center text-[10px] text-gray-400">
                    <Send className="w-3 h-3 mr-1" />
                    此為系統自動發送之信件
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- 核准設定 Modal --- */}
      {approvingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm animate-fade-in">
             <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
               <h3 className="font-bold text-gray-800">核准使用者申請</h3>
               <button onClick={() => !isProcessingApproval && setApprovingUser(null)}><X className="w-5 h-5 text-gray-400" /></button>
             </div>
             <div className="p-6 space-y-4">
               <div className="bg-blue-50 p-3 rounded border border-blue-100">
                 <div className="mb-2"><label className="text-xs font-bold text-blue-500 block mb-0.5">申請人</label><p className="font-medium text-blue-900">{approvingUser.name}</p></div>
                 <div className="mb-2"><label className="text-xs font-bold text-blue-500 block mb-0.5">單位</label><p className="font-medium text-blue-900">{approvingUser.organization || '未填寫'}</p></div>
                 <div><label className="text-xs font-bold text-blue-500 block mb-0.5">Email</label><p className="font-mono text-xs text-blue-700">{approvingUser.email}</p></div>
               </div>
               
               <div>
                 <label className="text-xs font-bold text-gray-600 block mb-1">指派角色權限</label>
                 <select value={approvalRole} onChange={(e) => setApprovalRole(e.target.value as UserRole)} className="w-full p-2 border rounded bg-white font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none">
                    {Object.values(UserRole).filter(r => r !== UserRole.PENDING).map(role => (
                      <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                    ))}
                 </select>
               </div>
               <div>
                 <label className="text-xs font-bold text-gray-600 block mb-2">指派負責場域 (可複選)</label>
                 <div className="flex flex-col space-y-2 p-3 border rounded bg-white">
                   <label className="flex items-center space-x-2 cursor-pointer">
                     <input 
                       type="checkbox" 
                       checked={approvalStation.includes('ALL')} 
                       onChange={(e) => {
                         if (e.target.checked) {
                           setApprovalStation(['ALL']);
                         } else {
                           setApprovalStation([STATIONS[0].code]);
                         }
                       }}
                       className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                     />
                     <span className="text-sm font-bold text-gray-700">全部 (ALL)</span>
                   </label>
                   {STATIONS.map(s => {
                     const isAll = approvalStation.includes('ALL');
                     const isChecked = isAll || approvalStation.includes(s.code);
                     return (
                       <label key={s.code} className={`flex items-center space-x-2 ${isAll ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                         <input 
                           type="checkbox" 
                           checked={isChecked} 
                           onChange={(e) => {
                             let current = [...approvalStation];
                             if (isAll) current = [];
                             
                             if (e.target.checked) {
                               current.push(s.code);
                             } else {
                               current = current.filter(c => c !== s.code);
                             }
                             
                             if (current.length === 0) current = ['ALL'];
                             if (current.length === STATIONS.length) current = ['ALL'];
                             
                             setApprovalStation(current);
                           }}
                           disabled={isAll}
                           className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                         />
                         <span className="text-sm text-gray-600">{s.name}</span>
                       </label>
                     );
                   })}
                 </div>
               </div>
               <button onClick={handleApproveSubmit} disabled={isProcessingApproval} className="w-full py-2.5 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium mt-4 flex items-center justify-center shadow-md">
                 {isProcessingApproval ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserCheck className="w-4 h-4 mr-2" />} 
                 {isProcessingApproval ? '處理中...' : '確認核准並啟用帳號'}
               </button>
             </div>
          </div>
        </div>
      )}

      {/* --- 核准成功憑證顯示視窗 --- */}
      {createdCredentials && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-bounce-in">
            <div className="p-6 bg-green-50 border-b border-green-100 rounded-t-xl text-center">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3"><Check className="w-6 h-6 text-green-600" /></div>
              <h3 className="text-xl font-bold text-green-800">核准成功！</h3>
              <p className="text-sm text-green-600 mt-1">帳號已正式啟用，請將密碼告知使用者</p>
            </div>
            <div className="p-6 space-y-4">
               <div><label className="text-xs font-bold text-gray-500 uppercase block mb-1">姓名</label><p className="font-medium text-gray-800 bg-gray-50 p-2 rounded border border-gray-200">{createdCredentials.name}</p></div>
               <div>
                 <label className="text-xs font-bold text-gray-500 uppercase block mb-1">登入帳號</label>
                 <div className="flex">
                   <p className="font-medium text-gray-800 bg-gray-50 p-2 rounded-l border border-gray-200 border-r-0 flex-1 overflow-hidden text-ellipsis">{createdCredentials.email}</p>
                   <button onClick={() => copyToClipboard(createdCredentials.email)} className="bg-gray-100 border border-gray-200 border-l-0 rounded-r px-3 hover:bg-gray-200 text-gray-600 transition-colors"><Copy className="w-4 h-4"/></button>
                 </div>
               </div>
               <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mt-4">
                  <label className="text-xs font-bold text-blue-600 uppercase block mb-2 flex items-center"><Key className="w-3 h-3 mr-1"/> 登入密碼</label>
                  <div className="flex items-center">
                    <p className="font-mono text-2xl font-bold text-blue-800 tracking-wider flex-1 select-all">{createdCredentials.password}</p>
                    <button onClick={() => copyToClipboard(createdCredentials.password)} className="text-sm bg-white text-blue-600 px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-50 font-medium shadow-sm transition-colors">複製密碼</button>
                  </div>
                  <p className="text-[10px] text-blue-400 mt-2">* 系統已對此密碼加密儲存，使用者登入後將被要求修改密碼。</p>
               </div>
               <button onClick={() => setCreatedCredentials(null)} className="w-full py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-medium mt-2 shadow-lg transition-colors">關閉並回到列表</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'platformSettings' && isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-xl font-bold text-gray-800 flex items-center">
                <Settings className="w-6 h-6 mr-2 text-purple-600" />
                平台環境設定
              </h3>
              <p className="text-sm text-gray-500 mt-1">管理平台名稱、LOGO、外部系統介接與介面顯示</p>
            </div>
            
            <button 
              onClick={async () => {
                setIsSavingPlatformSettings(true);
                onUpdatePlatformSettings(editingPlatformSettings);
                try {
                  // 同步全域設定（包含名稱、LOGO、ID 等）
                  const resSettings = await fetch(APP_CONFIG.SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // 加入此行避開 CORS 問題
                    body: JSON.stringify({
                      action: 'savePlatformSettings',
                      adminEmail: currentUser.email,
                      token: currentUser.password,
                      settings: editingPlatformSettings
                    })
                  });
                  const resultSettings = await resSettings.json();

                  // 兼容現有的 syncStations 邏輯
                  const resStations = await fetch(APP_CONFIG.SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // 加入此行避開 CORS 問題
                    body: JSON.stringify({
                      action: 'syncStations',
                      adminEmail: currentUser.email,
                      token: currentUser.password,
                      stations: editingPlatformSettings.stations
                    })
                  });
                  const resultStations = await resStations.json();

                  if (resultSettings.success && resultStations.success) {
                    alert('平台環境設定與場域資料已成功同步至雲端資料庫！');
                  } else {
                    const errorMsg = (!resultSettings.success ? ('設定同步失敗: ' + resultSettings.msg) : '') + 
                                     (!resultStations.success ? (' | 場域同步失敗: ' + resultStations.msg) : '');
                    alert(errorMsg);
                  }
                } catch (e) {
                  console.error(e);
                  alert('同步至雲端時發生錯誤，請檢查網路連線或 GAS 設定。');
                }
                setIsSavingPlatformSettings(false);
              }} 
              disabled={isSavingPlatformSettings}
              className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg flex items-center shadow-sm transition-colors text-sm font-medium disabled:opacity-70"
            >
              {isSavingPlatformSettings ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 儲存中...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> 儲存變更</>
              )}
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              
              {/* Left Column: General & Integrations */}
              <div className="xl:col-span-5 space-y-6">
                
                {/* 一般設定 */}
                <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100 shadow-sm">
                  <h4 className="flex items-center text-md font-bold text-gray-800 mb-5">
                    <LayoutIcon className="w-5 h-5 mr-2 text-blue-500" />
                    一般設定
                  </h4>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">平台名稱</label>
                      <input 
                        type="text" 
                        value={editingPlatformSettings.platformName} 
                        onChange={(e) => setEditingPlatformSettings({...editingPlatformSettings, platformName: e.target.value})} 
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none" 
                        placeholder="請輸入平台顯示名稱"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">登入頁面 LOGO</label>
                      <div 
                        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${isUploadingLogo ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-blue-500 hover:bg-gray-50'}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (isUploadingLogo) return;
                          const file = e.dataTransfer.files[0];
                          if (file) {
                            handleLogoUpload(file);
                          }
                        }}
                        onClick={() => !isUploadingLogo && document.getElementById('logo-upload')?.click()}
                      >
                        {isUploadingLogo ? (
                          <div className="flex flex-col items-center justify-center text-blue-600">
                            <Loader2 className="w-8 h-8 animate-spin mb-2" />
                            <p className="font-medium">上傳中...</p>
                          </div>
                        ) : (
                          <>
                            {editingPlatformSettings.loginLogoUrl ? (
                              <div className="mb-4 flex pl-4 pr-4 justify-center">
                                <img src={editingPlatformSettings.loginLogoUrl} alt="Logo Preview" className="max-h-24 object-contain rounded drop-shadow-sm" />
                              </div>
                            ) : (
                              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Building2 className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                            <p className="text-gray-600 font-medium">拖曳圖片至此，或 <span className="text-blue-600">點擊選擇檔案</span></p>
                            <p className="text-gray-400 text-xs mt-1">建議尺寸 400x120，格式支援 PNG, JPG, SVG</p>
                            <input 
                              id="logo-upload" 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) { handleLogoUpload(file); }
                              }}
                            />
                          </>
                        )}
                      </div>
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-gray-500 mb-1">或直接輸入圖片 URL</label>
                        <input 
                          type="text" 
                          value={editingPlatformSettings.loginLogoUrl} 
                          onChange={(e) => setEditingPlatformSettings({...editingPlatformSettings, loginLogoUrl: e.target.value})} 
                          className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 外部系統介接 */}
                <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100 shadow-sm">
                  <h4 className="flex items-center text-md font-bold text-gray-800 mb-5">
                    <Link className="w-5 h-5 mr-2 text-indigo-500" />
                    外部系統介接 (API)
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Google Sheet ID</label>
                      <input 
                        type="text" 
                        value={editingPlatformSettings.sheetId} 
                        onChange={(e) => setEditingPlatformSettings({...editingPlatformSettings, sheetId: e.target.value})} 
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Google Drive 資料夾 ID</label>
                      <input 
                        type="text" 
                        value={editingPlatformSettings.driveFolderId} 
                        onChange={(e) => setEditingPlatformSettings({...editingPlatformSettings, driveFolderId: e.target.value})} 
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Google Apps Script URL</label>
                      <input 
                        type="text" 
                        value={editingPlatformSettings.scriptUrl || ''} 
                        onChange={(e) => setEditingPlatformSettings({...editingPlatformSettings, scriptUrl: e.target.value})} 
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm outline-none" 
                      />
                    </div>
                  </div>
                </div>

                {/* 場域管理 */}
                <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100 shadow-sm">
                  <h4 className="flex items-center text-md font-bold text-gray-800 mb-5">
                    <MapPin className="w-5 h-5 mr-2 text-teal-500" />
                    場域與站點管理
                  </h4>
                  <div className="space-y-3 mb-5 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {(editingPlatformSettings.stations || []).map((station, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm transition-all hover:border-teal-300">
                        <input 
                          type="text" 
                          value={station.code} 
                          onChange={(e) => {
                            const newStations = [...(editingPlatformSettings.stations || [])];
                            newStations[idx].code = e.target.value.toUpperCase();
                            setEditingPlatformSettings({...editingPlatformSettings, stations: newStations});
                          }}
                          className="font-mono text-xs font-semibold text-gray-700 w-24 p-1.5 border border-transparent hover:border-gray-300 focus:border-teal-500 rounded outline-none bg-gray-50 focus:bg-white"
                          disabled={station.code === 'PCM_TEAM'}
                          placeholder="代碼 (Code)"
                        />
                        <input 
                          type="text" 
                          value={station.name} 
                          onChange={(e) => {
                            const newStations = [...(editingPlatformSettings.stations || [])];
                            newStations[idx].name = e.target.value;
                            setEditingPlatformSettings({...editingPlatformSettings, stations: newStations});
                          }}
                          className="flex-1 p-1.5 border border-transparent hover:border-gray-300 focus:border-teal-500 rounded outline-none bg-gray-50 focus:bg-white text-sm"
                          disabled={station.code === 'PCM_TEAM'}
                          placeholder="中文名稱"
                        />
                        {station.code !== 'PCM_TEAM' && (
                          <button 
                            onClick={() => {
                              if (confirm('確定要刪除此場域嗎？請注意，這可能會影響已關聯的資料。')) {
                                const newStations = (editingPlatformSettings.stations || []).filter((_, i) => i !== idx);
                                setEditingPlatformSettings({...editingPlatformSettings, stations: newStations});
                              }
                            }}
                            className="text-gray-400 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition-colors"
                            title="刪除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-100">
                    <p className="text-xs font-bold text-teal-800 mb-3 flex items-center"><Plus className="w-4 h-4 mr-1"/>新增場域</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <input type="text" value={newStationCode} onChange={(e) => setNewStationCode(e.target.value.toUpperCase())} placeholder="代碼 (例如: STATION_A)" className="w-full p-2 border border-teal-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                      </div>
                      <div className="flex-1">
                        <input type="text" value={newStationName} onChange={(e) => setNewStationName(e.target.value)} placeholder="名稱 (例如: A區平面停車場)" className="w-full p-2 border border-teal-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                      </div>
                      <button 
                        onClick={() => {
                          if (!newStationCode || !newStationName) {
                            alert('請填寫代碼與名稱');
                            return;
                          }
                          if ((editingPlatformSettings.stations || []).some(s => s.code === newStationCode)) {
                            alert('代碼已存在');
                            return;
                          }
                          setEditingPlatformSettings({
                            ...editingPlatformSettings,
                            stations: [...(editingPlatformSettings.stations || []), { code: newStationCode, name: newStationName }]
                          });
                          setNewStationCode('');
                          setNewStationName('');
                        }}
                        className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors whitespace-nowrap shadow-sm"
                      >
                        新增
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: UI & Tabs */}
              <div className="xl:col-span-7">
                <div className="bg-gray-50/50 rounded-xl p-5 md:p-7 border border-gray-100 shadow-sm h-full">
                  <div className="mb-6 pb-4 border-b border-gray-200">
                    <h4 className="flex items-center text-lg font-bold text-gray-800">
                      <LayoutIcon className="w-5 h-5 mr-3 text-orange-500" />
                      左側側邊欄與頁面標題權限
                    </h4>
                    <p className="text-sm text-gray-500 mt-1 pl-8">
                      在這裡，您可以自訂每一個主選單的「大標題」、「副標題說明」，並透過勾選決定「哪些角色的使用者」可以看見與存取該頁面。
                    </p>
                  </div>
                  
                  <div className="space-y-6 max-h-[850px] overflow-y-auto pr-2 custom-scrollbar">
                    {[
                      { id: 'dashboard', defaultLabel: '主儀表板', icon: Activity },
                      { id: 'progress_report', defaultLabel: '進度匯報', icon: ListTodo },
                      { id: 'venue_check', defaultLabel: '每月場域檢核', icon: Check },
                      { id: 'assets', defaultLabel: '財產管理', icon: Building2 },
                      { id: 'calendar', defaultLabel: '行事曆', icon: Calendar },
                      { id: 'meetings', defaultLabel: '會議與現勘', icon: FileText },
                      { id: 'admin', defaultLabel: '後台管理', icon: ShieldAlert }
                    ].map(tab => {
                      const currentVisibility = editingPlatformSettings.tabVisibility?.[tab.id] || Object.values(UserRole);
                      const currentTitle = editingPlatformSettings.pageTitles?.[tab.id]?.title || '';
                      const currentSubtitle = editingPlatformSettings.pageTitles?.[tab.id]?.subtitle || '';
                      const TabIcon = tab.icon;

                      return (
                        <div key={tab.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:border-orange-200 transition-colors">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="bg-orange-100 p-2 rounded-lg">
                              <TabIcon className="w-5 h-5 text-orange-600" />
                            </div>
                            <h5 className="font-bold text-gray-800 text-lg">
                              {tab.defaultLabel} <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-1">{tab.id}</span>
                            </h5>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5 bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center">
                                自訂大標題 (選填)
                              </label>
                              <input 
                                type="text" 
                                placeholder={`預設顯示: ${tab.defaultLabel}`}
                                value={currentTitle}
                                onChange={(e) => {
                                  const newTitles = { ...(editingPlatformSettings.pageTitles || {}) };
                                  if (!newTitles[tab.id]) newTitles[tab.id] = { title: '', subtitle: '' };
                                  newTitles[tab.id].title = e.target.value;
                                  setEditingPlatformSettings({ ...editingPlatformSettings, pageTitles: newTitles });
                                }}
                                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                自訂小標題 / 頁面描述 (選填)
                              </label>
                              <input 
                                type="text" 
                                placeholder="輸入顯示在標題下方的說明文字..."
                                value={currentSubtitle}
                                onChange={(e) => {
                                  const newTitles = { ...(editingPlatformSettings.pageTitles || {}) };
                                  if (!newTitles[tab.id]) newTitles[tab.id] = { title: '', subtitle: '' };
                                  newTitles[tab.id].subtitle = e.target.value;
                                  setEditingPlatformSettings({ ...editingPlatformSettings, pageTitles: newTitles });
                                }}
                                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm transition-all"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-3">允許看見此分頁的角色 (取消勾選則隱藏此頁面)</label>
                            <div className="flex flex-wrap gap-2.5">
                              {Object.values(UserRole).map(role => {
                                const isChecked = currentVisibility.includes(role);
                                return (
                                  <label 
                                    key={role} 
                                    className={`flex items-center px-3 py-1.5 rounded-full border text-sm cursor-pointer transition-all ${
                                      isChecked ? 'border-orange-500 bg-orange-50 text-orange-800 font-medium' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                                    }`}
                                  >
                                    <div className="relative flex items-center justify-center mr-2">
                                      <input 
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          let newVis = [...currentVisibility];
                                          if (e.target.checked) {
                                            if (!newVis.includes(role)) newVis.push(role);
                                          } else {
                                            newVis = newVis.filter(r => r !== role);
                                          }
                                          const newTabVisibility = { ...(editingPlatformSettings.tabVisibility || {}) };
                                          newTabVisibility[tab.id] = newVis;
                                          setEditingPlatformSettings({ ...editingPlatformSettings, tabVisibility: newTabVisibility });
                                        }}
                                        className="sr-only"
                                      />
                                      <div className={`w-4 h-4 rounded shadow-sm border flex items-center justify-center ${isChecked ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-gray-300'}`}>
                                        {isChecked && <Check className="w-3 h-3" />}
                                      </div>
                                    </div>
                                    {ROLE_LABELS[role]}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- 刪除使用者確認 Modal --- */}
      {userToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm animate-fade-in">
            <div className="p-4 border-b flex justify-between items-center bg-red-50 rounded-t-lg">
              <h3 className="font-bold text-red-800 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                確認刪除使用者
              </h3>
              <button onClick={() => !isDeleting && setUserToDelete(null)}>
                <X className="w-5 h-5 text-red-400 hover:text-red-600" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                您確定要刪除使用者 <span className="font-bold text-red-600">{userToDelete}</span> 嗎？
                <br /><br />
                <span className="text-sm text-gray-500">此操作無法復原，該使用者的所有權限將被永久移除。</span>
              </p>
              <div className="flex justify-end space-x-3 mt-6">
                <button 
                  onClick={() => setUserToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={async () => {
                    setIsDeleting(true);
                    const success = await onDeleteUser(userToDelete);
                    setIsDeleting(false);
                    if (success) setUserToDelete(null);
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  {isDeleting ? '刪除中...' : '確認刪除'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- 停用/啟用使用者確認 Modal --- */}
      {userToToggleStatus && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm animate-fade-in">
            <div className={`p-4 border-b flex justify-between items-center rounded-t-lg ${
              userToToggleStatus.isActive === true || String(userToToggleStatus.isActive).includes('啟用')
                ? 'bg-orange-50' 
                : 'bg-green-50'
            }`}>
              <h3 className={`font-bold flex items-center ${
                userToToggleStatus.isActive === true || String(userToToggleStatus.isActive).includes('啟用')
                  ? 'text-orange-800' 
                  : 'text-green-800'
              }`}>
                {userToToggleStatus.isActive === true || String(userToToggleStatus.isActive).includes('啟用') ? (
                  <><Lock className="w-5 h-5 mr-2" /> 確認停用帳號</>
                ) : (
                  <><Unlock className="w-5 h-5 mr-2" /> 確認啟用帳號</>
                )}
              </h3>
              <button onClick={() => !isTogglingStatus && setUserToToggleStatus(null)}>
                <X className={`w-5 h-5 hover:text-gray-800 ${
                  userToToggleStatus.isActive === true || String(userToToggleStatus.isActive).includes('啟用')
                    ? 'text-orange-400' 
                    : 'text-green-400'
                }`} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                您確定要
                <span className={`font-bold mx-1 ${
                  userToToggleStatus.isActive === true || String(userToToggleStatus.isActive).includes('啟用')
                    ? 'text-orange-600' 
                    : 'text-green-600'
                }`}>
                  {userToToggleStatus.isActive === true || String(userToToggleStatus.isActive).includes('啟用') ? '停用' : '啟用'}
                </span>
                使用者 <span className="font-bold text-gray-900">{userToToggleStatus.name}</span> ({userToToggleStatus.email}) 嗎？
                <br /><br />
                {userToToggleStatus.isActive === true || String(userToToggleStatus.isActive).includes('啟用') ? (
                  <span className="text-sm text-gray-500">停用後，該使用者將無法登入系統。</span>
                ) : (
                  <span className="text-sm text-gray-500">啟用後，該使用者將恢復登入系統的權限。</span>
                )}
              </p>
              <div className="flex justify-end space-x-3 mt-6">
                <button 
                  onClick={() => setUserToToggleStatus(null)}
                  disabled={isTogglingStatus}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={async () => {
                    setIsTogglingStatus(true);
                    const success = await onUpdateUser(userToToggleStatus.email, { isActive: !userToToggleStatus.isActive });
                    setIsTogglingStatus(false);
                    if (success) setUserToToggleStatus(null);
                  }}
                  disabled={isTogglingStatus}
                  className={`px-4 py-2 text-white rounded-lg transition-colors flex items-center ${
                    userToToggleStatus.isActive === true || String(userToToggleStatus.isActive).includes('啟用')
                      ? 'bg-orange-600 hover:bg-orange-700' 
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isTogglingStatus ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    userToToggleStatus.isActive === true || String(userToToggleStatus.isActive).includes('啟用') ? <Lock className="w-4 h-4 mr-2" /> : <Unlock className="w-4 h-4 mr-2" />
                  )}
                  {isTogglingStatus ? '處理中...' : (userToToggleStatus.isActive === true || String(userToToggleStatus.isActive).includes('啟用') ? '確認停用' : '確認啟用')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;