import React from 'react';
import { GitBranch, GitFork, Sparkles, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { Repository, Branch } from '../types.js';

interface HeaderProps {
  currentRepo: Repository | null;
  currentBranch: Branch | null;
  onOpenRepoSelector: () => void;
  hasGithubToken: boolean;
  hasGeminiKey: boolean;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRepo,
  currentBranch,
  onOpenRepoSelector,
  hasGithubToken,
  hasGeminiKey,
  onOpenSettings,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 pt-[env(safe-area-inset-top)] px-4 py-2.5">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* App Branding & Repo Selector */}
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>

          <button
            onClick={onOpenRepoSelector}
            className="flex items-center gap-1.5 text-left bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-xs transition-colors max-w-[210px]"
          >
            <GitFork className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <div className="truncate">
              <span className="font-semibold text-slate-200 block truncate">
                {currentRepo ? currentRepo.full_name : '저장소 선택...'}
              </span>
              {currentBranch && (
                <span className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                  <GitBranch className="w-2.5 h-2.5 text-emerald-400 inline shrink-0" />
                  {currentBranch.name}
                </span>
              )}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-0.5" />
          </button>
        </div>

        {/* API Status Pills */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onOpenSettings}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border transition-colors ${
              hasGithubToken && hasGeminiKey
                ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'
                : 'bg-amber-950/50 text-amber-300 border-amber-800/60 animate-pulse'
            }`}
          >
            {hasGithubToken && hasGeminiKey ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Ready</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 text-amber-400" />
                <span>키 설정 필요</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
