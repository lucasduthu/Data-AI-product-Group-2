"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
  storageKey?: string;
}

function getPageNumbers(currentPage: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [
      1,
      "...",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }
  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
}

export function PaginationBar({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100, 250, 500],
  itemLabel = "éléments",
  className = "",
  storageKey,
}: PaginationBarProps) {
  if (totalItems === 0) {
    return null;
  }

  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t bg-card text-xs text-muted-foreground ${className}`}
    >
      {/* Résumé textuel & sélecteur de taille de page */}
      <div className="flex flex-wrap items-center gap-2">
        <span>
          Affichage{" "}
          <strong className="text-foreground">
            {startIndex + 1}–{endIndex}
          </strong>{" "}
          sur <strong className="text-foreground">{totalItems}</strong> {itemLabel}
        </span>
        <span className="hidden sm:inline text-muted-foreground/40">•</span>
        <div className="flex items-center gap-1.5">
          <span>Lignes par page :</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const newSize = Number(e.target.value);
              if (storageKey && typeof window !== "undefined") {
                try {
                  localStorage.setItem(storageKey, String(newSize));
                } catch {
                  // Ignore localStorage issues
                }
              }
              onPageSizeChange(newSize);
              onPageChange(1);
            }}
            aria-label={`Nombre de ${itemLabel} par page`}
            className="rounded-md border bg-card px-2 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Contrôles de navigation entre les pages */}
      <div className="flex items-center gap-1">
        {/* Première page */}
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-card text-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
          title="Première page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>

        {/* Page précédente */}
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="inline-flex h-8 items-center gap-1 px-2.5 rounded-md border bg-card text-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
          title="Page précédente"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden md:inline">Précédent</span>
        </button>

        {/* Numéros de page */}
        <div className="flex items-center gap-1 mx-1">
          {pages.map((p, idx) => {
            if (p === "...") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1 text-muted-foreground select-none"
                >
                  …
                </span>
              );
            }
            const isCurrent = p === currentPage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`h-8 min-w-[32px] px-2 rounded-md font-semibold text-xs transition-colors ${
                  isCurrent
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : "border bg-card text-foreground hover:bg-muted"
                }`}
                aria-current={isCurrent ? "page" : undefined}
                title={`Aller à la page ${p}`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Page suivante */}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex h-8 items-center gap-1 px-2.5 rounded-md border bg-card text-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
          title="Page suivante"
        >
          <span className="hidden md:inline">Suivant</span>
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Dernière page */}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-card text-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
          title="Dernière page"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
