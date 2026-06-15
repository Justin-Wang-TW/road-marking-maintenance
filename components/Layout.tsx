import React from 'react';
import { LayoutDashboard, ClipboardCheck, FileText, LogOut, Menu, Calendar, Shield, ClipboardList, Package, Bell, Sun, Moon } from 'lucide-react';
import { User, UserRole, PlatformSettings } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User | null;
  onLogout: () => void;
  timeLeft: number; // Idle time remaining in seconds
  unreadCount?: number;
  onToggleMessages?: () => void;
  isHighContrast?: boolean;
  toggleHighContrast?: () => void;
  platformSettings: PlatformSettings;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  setActiveTab, 
  currentUser, 
  onLogout, 
  timeLeft, 
  unreadCount = 0, 
  onToggleMessages,
  isHighContrast = false,
  toggleHighContrast,
  platformSettings
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Define standard menu items
  const baseMenuItems = [
    { id: 'dashboard', label: '主儀表板', icon: LayoutDashboard },
    { id: 'progress_report', label: '進度匯報', icon: ClipboardCheck }, 
    { id: 'venue_check', label: '每月場域檢核', icon: ClipboardList },
    { id: 'assets', label: '財產管理', icon: Package },
    { id: 'calendar', label: '行事曆', icon: Calendar },
    { id: 'meetings', label: '會議與現勘', icon: FileText },
  ];

  // Robust check for Admin role (handles whitespace and case variations)
  const isAdmin = currentUser?.role === UserRole.ADMIN || 
                  currentUser?.role?.trim() === UserRole.ADMIN ||
                  currentUser?.role?.toLowerCase() === 'admin';

  const isManager3D = currentUser?.role === UserRole.MANAGER_3D || 
                      currentUser?.role?.trim() === UserRole.MANAGER_3D ||
                      currentUser?.role?.toLowerCase() === 'manager_3d';

  // Strictly add Admin Panel only if user is ADMIN or MANAGER_3D
  if (isAdmin || isManager3D) {
    baseMenuItems.push({ id: 'admin', label: '後台管理', icon: Shield });
  }

  // Filter menu items based on platformSettings.tabVisibility
  const menuItems = baseMenuItems.filter(item => {
    if (!platformSettings.tabVisibility) return true; // Default show all if not configured
    const allowedRoles = platformSettings.tabVisibility[item.id];
    if (!allowedRoles) return true; // Default show if not explicitly configured
    if (allowedRoles.length === 0) return false; // Hide from everyone
    return allowedRoles.includes(currentUser?.role || '');
  }).map(item => {
    // Override label if configured in pageTitles
    if (platformSettings.pageTitles && platformSettings.pageTitles[item.id] && platformSettings.pageTitles[item.id].title) {
      return { ...item, label: platformSettings.pageTitles[item.id].title };
    }
    return item;
  });

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Header */}
      <div className="lg:hidden fixed w-full bg-white z-20 border-b flex items-center justify-between p-4 shadow-sm">
        <div className="flex items-center">
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="mr-4">
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="font-bold text-lg text-gray-800">{platformSettings.platformName}</h1>
        </div>
        <button onClick={onToggleMessages} className="relative p-2 text-gray-600">
           <Bell className="w-6 h-6" />
           {unreadCount > 0 && (
             <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
               {unreadCount}
             </span>
           )}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-10 w-64 bg-white border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center justify-center border-b px-6 bg-blue-600">
             <h1 className="font-bold text-xl text-white">{platformSettings.platformName}</h1>
          </div>



          <nav className="flex-1 p-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === item.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t space-y-3">
            <button
              onClick={onLogout}
              className="flex items-center w-full px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
            >
              <LogOut className="w-5 h-5 mr-3" />
              登出系統
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-16 lg:pt-0 relative">
        {/* Desktop Header */}
        <div className="hidden lg:flex justify-between items-center px-6 py-3 bg-white border-b shadow-sm sticky top-0 z-10">
           {/* Left Side: User Info & Idle Timer */}
           <div className="flex items-center space-x-6">
              {/* User Info */}
              <div className="flex items-center space-x-3">
                 <span className="text-sm font-medium text-gray-700">歡迎, {currentUser?.name}</span>
                 <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{currentUser?.role}</span>
                 {currentUser?.role !== UserRole.ADMIN && (
                   <span className="text-xs text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                     {currentUser?.assignedStation === 'ALL' ? '全區' : currentUser?.assignedStation}
                   </span>
                 )}
              </div>

              {/* Idle Timer */}
              <div className={`flex items-center text-sm font-medium border-l pl-6 ${timeLeft < 60 ? 'text-red-600 animate-pulse' : 'text-gray-500'}`}>
                 <span className="mr-2">閒置登出:</span>
                 <span className="font-mono">{formatTime(timeLeft)}</span>
              </div>
           </div>

           {/* Right Side: High Contrast & Notifications */}
           <div className="flex items-center space-x-4">
              {/* High Contrast Toggle */}
              {toggleHighContrast && (
                <button 
                  onClick={toggleHighContrast}
                  className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors border border-gray-200"
                  aria-label={isHighContrast ? "切換至一般模式" : "切換至高對比模式"}
                >
                  {isHighContrast ? (
                    <>
                      <Sun className="w-4 h-4 mr-2" />
                      <span>一般模式</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4 mr-2" />
                      <span>高對比模式</span>
                    </>
                  )}
                </button>
              )}

              {/* Notification Bell */}
              <button onClick={onToggleMessages} className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full transform translate-x-1/4 -translate-y-1/4">
                    {unreadCount}
                  </span>
                )}
              </button>
           </div>
        </div>

        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-0 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;