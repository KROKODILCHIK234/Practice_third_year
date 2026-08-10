"use client";
import type { FireMeta } from "@/types";

interface Props {
  fires: FireMeta[];
  selectedFireIds: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
}

// Formats an ISO-ish date string (e.g. "2005-09-14") to "14.09.2005".
function fmtDate(s?: string): string {
  if (!s) return "";
  const d = s.slice(0, 10).split("-");
  return d.length === 3 ? `${d[2]}.${d[1]}.${d[0]}` : s.slice(0, 10);
}

/**
 * Selected-fires bar shown at the top of the dashboard (moved out of the filter
 * sidebar so the *dates* of the chosen fires are always visible, not hidden in a
 * hover tooltip). Renders one chip per selected fire with its date and area.
 */
export default function SelectedFiresBar({ fires, selectedFireIds, onToggle, onClear }: Props) {
  if (selectedFireIds.size === 0) return null;
  const selected = fires.filter((f) => selectedFireIds.has(f.fire_id));

  return (
    <div className="rise-in flex items-center gap-3 rounded-2xl border border-border bg-surface/40 shadow-sm px-4 py-2.5">
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm leading-none" aria-hidden>🔥</span>
        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">
          Выбранные пожары
        </span>
        <span className="text-[11px] text-accent tabular-nums font-medium">{selected.length}</span>
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto scrollbar-thin py-0.5">
        {selected.map((f) => (
          <div
            key={f.fire_id}
            className="shrink-0 flex items-center gap-2.5 bg-surface-2 rounded-lg pl-3 pr-2 py-1.5 border border-border"
          >
            <span className="text-xs font-mono font-semibold text-warning tabular-nums">#{f.fire_id}</span>
            <span className="flex flex-col leading-tight">
              <span className="text-[11px] text-text tabular-nums">{fmtDate(f.dt_first)}</span>
              <span className="text-[9px] text-text-dim tabular-nums">{Math.round(f.Area).toLocaleString("ru-RU")} га</span>
            </span>
            <button
              onClick={() => onToggle(f.fire_id)}
              className="text-text-dim hover:text-danger transition-colors text-sm leading-none w-4 h-4 flex items-center justify-center rounded focus-ring"
              aria-label={`Убрать пожар #${f.fire_id}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={onClear}
        className="shrink-0 text-[10px] text-text-dim hover:text-danger transition-colors focus-ring rounded px-1"
      >
        сбросить
      </button>
    </div>
  );
}
