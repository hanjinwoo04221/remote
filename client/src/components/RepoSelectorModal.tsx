import React, { useState, useEffect } from 'react';
import { X, Search, GitBranch, Lock, Globe, RefreshCw, Check } from 'lucide-react';
import { Repository, Branch } from '../types.js';
import { ApiService } from '../services/api.js';

interface RepoSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  githubToken: string;
  currentRepo: Repository | null;
  currentBranch: Branch | null;
  onSelect: (repo: Repository, branch: Branch) => void;
  onOpenSettings: () => void;
}

export const RepoSelectorModal: React.FC<RepoSelectorModalProps> = ({
  isOpen,
  onClose,
  githubToken,
  currentRepo,
  currentBranch,
  onSelect,
  onOpenSettings,
}) => {
  const [search, setSearch] = useState('');
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(currentRepo);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(currentBranch);
  const [loadingBranches, setLoadingBranches] = useState(false);

  useEffect(() => {
    if (isOpen && githubToken) {
      loadRepos();
    }
  }, [isOpen, githubToken]);

  useEffect(() => {
    if (selectedRepo && githubToken) {
      loadBranches(selectedRepo);
    }
  }, [selectedRepo]);

  const loadRepos = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ApiService.getRepositories(githubToken, search);
      setRepos(data);
      if (!selectedRepo && data.length > 0) {
        setSelectedRepo(data[0]);
      }
    } catch (err: any) {
      setError(err.message || '저장소 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async (repo: Repository) => {
    setLoadingBranches(true);
    try {
      const branchList = await ApiService.getBranches(githubToken, repo.owner, repo.name);
      setBranches(branchList);
      const defaultB = branchList.find((b) => b.isDefault) || branchList[0];
      setSelectedBranch(defaultB || null);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingBranches(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-white">GitHub 저장소 선택</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!githubToken ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-sm text-slate-300">
              저장소를 불러오려면 먼저 GitHub Personal Access Token을 설정해야 합니다.
            </p>
            <button
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium text-white text-sm"
            >
              설정으로 이동하여 토큰 등록
            </button>
          </div>
        ) : (
          <>
            {/* Search & Refresh */}
            <div className="p-3 border-b border-slate-800/80 flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="저장소 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadRepos()}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                onClick={loadRepos}
                disabled={loading}
                className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl flex items-center justify-center transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Repos List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2">
              {loading && repos.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  저장소 목록 불러오는 중...
                </div>
              ) : error ? (
                <div className="p-4 text-center text-xs text-rose-400">{error}</div>
              ) : repos.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  일치하는 저장소가 없습니다.
                </div>
              ) : (
                repos.map((repo) => {
                  const isSelected = selectedRepo?.id === repo.id;
                  return (
                    <div
                      key={repo.id}
                      onClick={() => setSelectedRepo(repo)}
                      className={`p-3 rounded-xl cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-indigo-950/40 border border-indigo-500/30'
                          : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-medium text-xs text-slate-200 truncate">
                          {repo.private ? (
                            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          ) : (
                            <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          <span className="truncate">{repo.full_name}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
                      </div>
                      {repo.description && (
                        <p className="text-[11px] text-slate-400 truncate mt-1">
                          {repo.description}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Branch Selector & Confirmation Footer */}
            {selectedRepo && (
              <div className="p-4 border-t border-slate-800 bg-slate-950/60 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-300 font-medium flex items-center gap-1">
                    <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
                    브랜치 선택:
                  </label>
                  {loadingBranches ? (
                    <span className="text-[11px] text-slate-500">불러오는 중...</span>
                  ) : (
                    <select
                      value={selectedBranch?.name || ''}
                      onChange={(e) => {
                        const b = branches.find((item) => item.name === e.target.value);
                        if (b) setSelectedBranch(b);
                      }}
                      className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 max-w-[200px]"
                    >
                      {branches.map((b) => (
                        <option key={b.name} value={b.name}>
                          {b.name} {b.isDefault ? '(기본)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <button
                  onClick={() => {
                    if (selectedRepo && selectedBranch) {
                      onSelect(selectedRepo, selectedBranch);
                      onClose();
                    }
                  }}
                  disabled={!selectedRepo || !selectedBranch}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-xs shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                >
                  선택한 저장소 연결하기
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
