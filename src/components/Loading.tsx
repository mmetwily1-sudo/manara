"use client";

/** هياكل تحميل (Skeleton) وحالات فراغ (Empty) موحدة — بدل نص "جاري التحميل..." */

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card animate-pulse space-y-0 divide-y divide-slate-100 p-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-slate-200" />
            <div className="h-2 w-1/2 rounded bg-slate-100" />
          </div>
          <div className="h-6 w-16 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ cols = 4, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <div className="card animate-pulse overflow-hidden p-4" aria-hidden>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-3">
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className={`h-4 rounded bg-slate-100 ${j === 0 ? "w-1/4 bg-slate-200" : "flex-1"}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCards({ n = 3 }: { n?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="card animate-pulse space-y-3 p-5">
          <div className="h-4 w-2/3 rounded bg-slate-200" />
          <div className="h-8 w-1/2 rounded bg-slate-100" />
          <div className="h-2 w-full rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon = "📭",
  title,
  desc,
  actionLabel,
  onAction,
}: {
  icon?: string;
  title: string;
  desc?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="card flex flex-col items-center p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light text-3xl">{icon}</div>
      <h3 className="mt-3 font-bold">{title}</h3>
      {desc && <p className="mt-1 max-w-sm text-small text-slate-500">{desc}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn-primary mt-4 !py-2 text-small">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
