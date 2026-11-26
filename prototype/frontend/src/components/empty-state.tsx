"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, Loader2, Info } from "lucide-react";

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: React.ReactNode;
}

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  badgeText?: string;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  demoAction?: {
    label: string;
    onClick: () => void;
    isLoading?: boolean;
  };
  tipText?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  badgeText = "Base vierge",
  primaryAction,
  secondaryAction,
  demoAction,
  tipText,
}: EmptyStateProps) {
  return (
    <div className="rounded-3xl border border-dashed border-border/80 bg-gradient-to-b from-card/60 via-card to-card/90 p-8 sm:p-12 text-center shadow-xs transition-all">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-8 ring-primary/5">
        {icon}
      </div>

      <div className="mt-5 space-y-2 max-w-lg mx-auto">
        {badgeText && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
            <Sparkles className="h-3 w-3" />
            {badgeText}
          </span>
        )}
        <h3 className="font-micro text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>

      {/* Boutons d'actions directes */}
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        {primaryAction &&
          (primaryAction.href ? (
            <Link
              href={primaryAction.href}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
            >
              {primaryAction.icon}
              <span>{primaryAction.label}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
            >
              {primaryAction.icon}
              <span>{primaryAction.label}</span>
            </button>
          ))}

        {secondaryAction &&
          (secondaryAction.href ? (
            <Link
              href={secondaryAction.href}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors shadow-xs"
            >
              {secondaryAction.icon}
              <span>{secondaryAction.label}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors shadow-xs"
            >
              {secondaryAction.icon}
              <span>{secondaryAction.label}</span>
            </button>
          ))}

        {demoAction && (
          <button
            type="button"
            disabled={demoAction.isLoading}
            onClick={demoAction.onClick}
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            {demoAction.isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            )}
            <span>{demoAction.label}</span>
          </button>
        )}
      </div>

      {/* Boîte d'astuce contextuelle */}
      {tipText && (
        <div className="mt-8 max-w-xl mx-auto rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5 text-left flex items-start gap-2.5 text-[11px] text-muted-foreground leading-normal">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span>{tipText}</span>
        </div>
      )}
    </div>
  );
}
