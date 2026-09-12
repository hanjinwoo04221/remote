import React, { useState } from 'react';
import { FileCode, Trash2, CheckCircle2, GitCommit, AlertCircle } from 'lucide-react';
import { FileChange } from '../../types.js';
import { computeUnifiedDiff } from '../../utils/diffHelper.js';

interface DiffViewerProps {
  changes: FileChange[];
  onDiscardChange: (path: string) => void;
  onOpenCommitDrawer: () => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  changes,
  onDiscardChange,
  onOpenCommitDrawer,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (changes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-140px)] max-w-md mx-auto p-6 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400">
          <CheckCircle2 className="w-6 h-6 text-slate-500" />
        </div>
        <h3 className="text-base font-semibold text-slate-200">대기 중인 변경사항 없음</h3>
        <p className="text-xs text-slate-400">
          AI 에이전트에게 파일 수정을 요청하면 여기에 실시간 Diff가 표시됩니다.
        </p>
      </div>
    );
  }

  const currentChange = changes[selectedIndex] || changes[0];
  const diffLines = computeUnifiedDiff(
    currentChange.originalContent || '',
    currentChange.newContent || ''
  );

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-md mx-auto">
      {/* File Selector Tabs */}
      <div className="p-3 bg-slate-900/70 border-b border-slate-800/80 overflow-x-auto flex gap-2">
        {changes.map((c, idx) => (
          <button
            key={c.path}
            onClick={() => setSelectedIndex(idx)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-colors border ${
              selectedIndex === idx
                ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200 font-medium'
                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                c.action === 'create' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span className="truncate max-w-[140px]">{c.path.split('/').pop()}</span>
          </button>
        ))}
      </div>

      {/* Current File Header & Action */}
      <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between">
        <div className="truncate mr-2">
          <span className="text-xs font-mono font-medium text-slate-200 block truncate">
            {currentChange.path}
          </span>
          {currentChange.description && (
            <span className="text-[10px] text-slate-400 block truncate">
              {currentChange.description}
            </span>
          )}
        </div>

        <button
          onClick={() => onDiscardChange(currentChange.path)}
          className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors shrink-0"
          title="변경사항 취소"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Unified Diff View Container */}
      <div className="flex-1 overflow-auto bg-slate-950 p-2 font-mono text-[11px] select-text">
        <table className="w-full border-collapse">
          <tbody>
            {diffLines.map((line, idx) => {
              const isAdd = line.type === 'add';
              const isDel = line.type === 'del';

              return (
                <tr
                  key={idx}
                  className={`leading-5 ${
                    isAdd
                      ? 'bg-emerald-950/40 text-emerald-300'
                      : isDel
                      ? 'bg-rose-950/40 text-rose-300'
                      : 'text-slate-400'
                  }`}
                >
                  <td className="w-8 text-right pr-2 text-slate-600 select-none text-[10px]">
                    {line.oldLineNumber || ''}
                  </td>
                  <td className="w-8 text-right pr-2 text-slate-600 select-none text-[10px]">
                    {line.newLineNumber || ''}
                  </td>
                  <td className="w-4 text-center select-none font-bold">
                    {isAdd ? '+' : isDel ? '-' : ' '}
                  </td>
                  <td className="whitespace-pre pl-1">{line.content}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom Sticky Action: Commit & Push */}
      <div className="p-3 bg-slate-900/90 border-t border-slate-800/80 backdrop-blur-md">
        <button
          onClick={onOpenCommitDrawer}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
        >
          <GitCommit className="w-4 h-4" />
          <span>변경사항 커밋 & GitHub 푸시 ({changes.length}개 파일)</span>
        </button>
      </div>
    </div>
  );
};
