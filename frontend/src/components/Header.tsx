"use client";

interface Props {
  totalFires: number;
  selectedCount: number;
  apiOk: boolean;
  /** Real data range (years), derived from the loaded dataset. */
  yearRange?: string;
}

/**
 * Top application bar — slim, fixed height. Acts as the persistent context
 * for the dashboard: project name, study area, scope of data, status.
 */
export default function Header({ totalFires, selectedCount, apiOk, yearRange }: Props) {
  return (
    <header className="shrink-0 h-12 px-5 flex items-center gap-4 bg-surface/70 backdrop-blur border-b border-border">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-accent/30 to-warning/20 border border-accent/30 flex items-center justify-center">
          <span className="text-[15px] leading-none">🔥</span>
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent pulse-glow" />
        </div>
        <div className="leading-tight">
          <p className="text-[13px] font-semibold text-text tracking-tight">
            Дашборд анализа гарей
          </p>
          <p className="text-[10px] text-text-muted">
            Иркутская область · MODIS · Landsat · Sentinel-2
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="h-7 w-px bg-border" />

      {/* Data scope */}
      <div className="flex items-center gap-5 text-[11px] text-text-muted">
        <div className="flex items-center gap-1.5">
          <span className="text-text-dim">Период данных:</span>
          <span className="text-text font-medium tabular-nums">{yearRange ?? "—"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-text-dim">Пожаров в базе:</span>
          <span className="text-text font-medium tabular-nums">{totalFires}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-text-dim">Выбрано:</span>
          <span className={`font-medium tabular-nums ${selectedCount > 0 ? "text-accent" : "text-text-dim"}`}>
            {selectedCount}
          </span>
        </div>
      </div>

      {/* Right side: API status */}
      <div className="ml-auto flex items-center gap-3 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              apiOk ? "bg-accent pulse-glow" : "bg-danger"
            }`}
          />
          <span className="text-text-muted">
            API <span className={apiOk ? "text-accent" : "text-danger"}>
              {apiOk ? "online" : "offline"}
            </span>
          </span>
        </div>
        <a
          href="https://disk.yandex.ru/d/ZgsVuaXOy1qf7A"
          target="_blank"
          rel="noreferrer"
          className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-text-muted hover:text-text border border-border transition-colors"
        >
          Данные ↗
        </a>
      </div>
    </header>
  );
}
