import React, { useState } from 'react';
import {
  Database,
  Brain,
  Search,
  BookOpen,
  Orbit,
  Settings,
  ShieldCheck,
  User as UserIcon,
  LogOut,
  Sparkles,
  Key,
  Layers,
  Bot,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ActiveTab = 'chat' | 'search' | 'knowledge' | 'api_hub' | 'visualizer' | 'settings';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenAuthModal: () => void;
  documentCount: number;
  chunkCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenAuthModal,
  documentCount,
  chunkCount,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'chat', label: 'Trợ lý RAG (Hỏi Đáp)', icon: <Brain className="w-3.5 h-3.5" /> },
    { id: 'search', label: 'Tìm kiếm Ngữ nghĩa', icon: <Search className="w-3.5 h-3.5" /> },
    {
      id: 'knowledge',
      label: 'Kho Tài liệu & OCR',
      icon: <BookOpen className="w-3.5 h-3.5" />,
      badge: `${documentCount} docs`,
    },
    {
      id: 'api_hub',
      label: 'Cổng API (Zabbix/Bot)',
      icon: <Bot className="w-3.5 h-3.5" />,
    },
    { id: 'visualizer', label: 'Không gian 2D Vector', icon: <Orbit className="w-3.5 h-3.5" /> },
    { id: 'settings', label: 'Cấu hình & Gemini Key', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'AD';

  return (
    <header className="bg-white border-b border-[#141414] sticky top-0 z-40 text-[#141414]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo & Version */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#141414] text-white flex items-center justify-center text-xs font-mono font-bold">
                VR
              </div>
              <div className="flex flex-col">
                <span className="font-mono font-bold tracking-tighter text-sm sm:text-base leading-none">
                  VECTOR_RAG v2.4
                </span>
                <span className="text-[9px] font-mono text-[#666] tracking-wider uppercase mt-0.5">
                  Semantic Engine
                </span>
              </div>
            </div>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1 sm:gap-2 text-xs font-semibold uppercase tracking-wider">
              {navItems.map(item => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`nav-tab-${item.id}`}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono transition-colors ${
                      isActive
                        ? 'bg-[#141414] text-white'
                        : 'text-[#141414] hover:bg-[#E4E3E0] opacity-80 hover:opacity-100 border border-transparent'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[9px] px-1 py-0.2 font-mono ${
                          isActive ? 'bg-white/20 text-white' : 'bg-[#E4E3E0] text-[#141414] border border-[#141414]/30'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Status & Auth */}
          <div className="flex items-center gap-3">
            {/* Active Vector status indicator */}
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 border border-[#141414] bg-[#F8F7F4] text-[11px] font-mono text-[#141414]">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span>{chunkCount} Vectors</span>
              <span className="text-[#888]">•</span>
              <span className="text-[#666]">768-dim</span>
            </div>

            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  id="user-menu-btn"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 text-left focus:outline-none"
                >
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-[9px] font-mono leading-none uppercase text-[#666]">
                      SECURE_SESSION
                    </span>
                    <span className="text-xs font-bold font-mono truncate max-w-[140px]">
                      {user.email || user.name}
                    </span>
                  </div>
                  <div className="w-8 h-8 bg-[#141414] text-white flex items-center justify-center text-xs font-mono font-bold border border-[#141414] hover:bg-[#333] transition-colors">
                    {userInitials}
                  </div>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-[#141414] shadow-2xl py-2 z-50 animate-in fade-in">
                    <div className="px-4 py-2 border-b border-[#141414] bg-[#F8F7F4]">
                      <div className="text-[10px] font-mono uppercase text-[#666]">Authenticated Principal</div>
                      <p className="text-xs font-bold text-[#141414] mt-0.5">{user.name}</p>
                      <p className="text-[11px] font-mono text-[#666] truncate">{user.email}</p>
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-700 font-mono">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>JWT_MULTI_TENANT_SECURE</span>
                      </div>
                    </div>
                    <button
                      id="logout-btn"
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-mono text-rose-700 hover:bg-[#F0EFEC] flex items-center gap-2 transition-colors border-t border-[#141414]"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>TERMINATE_SESSION</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                id="login-trigger-btn"
                onClick={onOpenAuthModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141414] text-white text-xs font-mono font-bold tracking-wider hover:bg-[#333] transition-colors"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>AUTH_LOGIN</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden overflow-x-auto py-2 gap-1.5 border-t border-[#141414] no-scrollbar">
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono whitespace-nowrap ${
                  isActive
                    ? 'bg-[#141414] text-white font-bold'
                    : 'text-[#141414] bg-[#E4E3E0] border border-[#141414]'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

