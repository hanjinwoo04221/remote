import React from 'react';
import { Bot, FolderTree, GitCompare, Settings } from 'lucide-react';

export type ActiveTab = 'agent' | 'explorer' | 'diff' | 'settings';

interface BottomNavProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  diffCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  diffCount,
}) => {
  const navItems = [
    {
      id: 'agent' as ActiveTab,
      label: 'AI 에이전트',
      icon: Bot,
    },
    {
      id: 'explorer' as ActiveTab,
      label: '파일 탐색기',
      icon: FolderTree,
    },
    {
      id: 'diff' as ActiveTab,
      label: '변경사항',
      icon: GitCompare,
      badge: diffCount > 0 ? diffCount : undefined,
    },
    {
      id: 'settings' as ActiveTab,
      label: '설정',
      icon: Settings,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-[env(safe-area-inset-bottom)] select-none">
      <div className="max-w-md mx-auto grid grid-cols-4 h-16 items-center px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 relative transition-colors ${
                isActive ? 'text-indigo-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 bg-emerald-500 text-slate-950 text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-4 text-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
