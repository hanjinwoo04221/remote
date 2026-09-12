import React, { useState } from 'react';
import { X, GitCommit, GitPullRequest, ExternalLink, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { FileChange, CommitRequest } from '../../types.js';

interface CommitDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  changes: FileChange[];
  owner: string;
  repo: string;
  currentBranch: string;
  onSubmit: (req: CommitRequest) => Promise<{ commitUrl: string; prUrl?: string }>;
  onSuccess: () => void;
}

export const CommitDrawer: React.FC<CommitDrawerProps> = ({
  isOpen,
  onClose,
  changes,
  owner,
  repo,
  currentBranch,
  onSubmit,
  onSuccess,
}) => {
  const [message, setMessage] = useState('feat: AI agent code modifications');
  const [mode, setMode] = useState<'direct' | 'pr'>('direct');
  const [newBranch, setNewBranch] = useState(`ai-patch-${Date.now().toString().slice(-4)}`);
  const [prTitle, setPrTitle] = useState('AI Agent Update');
  const [prBody, setPrBody] = useState('Automated pull request created via GitMobile AI Agent.');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ commitUrl: string; prUrl?: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await onSubmit({
        owner,
        repo,
        branch: currentBranch,
        newBranch: mode === 'pr' ? newBranch : undefined,
        createPr: mode === 'pr',
        prTitle: mode === 'pr' ? prTitle : undefined,
        prBody: mode === 'pr' ? prBody : undefined,
        message: message.trim(),
        changes,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || '커밋 및 푸시 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <GitCommit className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">GitHub 커밋 & 푸시</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Result Success View */}
        {result ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">성공적으로 반영되었습니다!</h3>
              <p className="text-xs text-slate-400 mt-1">
                {changes.length}개 파일이 원격 저장소에 반영되었습니다.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <a
                href={result.commitUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-indigo-300 flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>GitHub 커밋 확인하기</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {result.prUrl && (
                <a
                  href={result.prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600/30 border border-indigo-500/40 hover:bg-indigo-600/40 text-xs font-medium text-indigo-200 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <GitPullRequest className="w-3.5 h-3.5" />
                  <span>생성된 Pull Request 보기</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            <button
              onClick={() => {
                onSuccess();
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold mt-4"
            >
              확인 및 대기열 비우기
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-4 overflow-y-auto">
            {error && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs">
                {error}
              </div>
            )}

            {/* Target Branch / Mode Toggle */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setMode('direct')}
                className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                  mode === 'direct'
                    ? 'bg-slate-800 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                현재 브랜치 ({currentBranch})에 직접 푸시
              </button>
              <button
                type="button"
                onClick={() => setMode('pr')}
                className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                  mode === 'pr'
                    ? 'bg-slate-800 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                신규 브랜치 + PR 생성
              </button>
            </div>

            {/* Commit Message */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">커밋 메시지</label>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="예: feat: add authentication token check"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* PR options */}
            {mode === 'pr' && (
              <div className="space-y-3 p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-400">새 브랜치 이름</label>
                  <input
                    type="text"
                    value={newBranch}
                    onChange={(e) => setNewBranch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-400">PR 제목</label>
                  <input
                    type="text"
                    value={prTitle}
                    onChange={(e) => setPrTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-400">PR 설명</label>
                  <textarea
                    value={prBody}
                    onChange={(e) => setPrBody(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white resize-none"
                  />
                </div>
              </div>
            )}

            {/* Staged files review preview */}
            <div className="text-[11px] text-slate-400">
              반영 대상 파일: {changes.length}개 ({changes.map((c) => c.path).join(', ')})
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !message.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>GitHub에 푸시하는 중...</span>
                </>
              ) : (
                <>
                  <GitCommit className="w-4 h-4" />
                  <span>
                    {mode === 'pr' ? '브랜치 푸시 및 PR 생성' : 'GitHub에 즉시 커밋 & 푸시'}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
