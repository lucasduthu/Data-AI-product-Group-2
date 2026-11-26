import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock,
  Info,
  Send,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ValidationStatus, WorkLifeCycleStatus } from "@/types/api";

export function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const tier =
    score >= 0.9
      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
      : score >= 0.65
        ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
        : "bg-rose-500/10 text-rose-700 border-rose-500/30";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
        tier
      )}
      title={`Score de confiance IA : ${pct}%`}
    >
      <span>Confiance {pct}%</span>
    </span>
  );
}

export function ValidationStatusBadge({
  status,
}: {
  status: ValidationStatus;
}) {
  if (status === "VALIDATED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Validé Humain
      </span>
    );
  }
  if (status === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-700">
        <XCircle className="h-3.5 w-3.5" />
        Rejeté
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">
      <Clock className="h-3.5 w-3.5" />
      Revue Requise
    </span>
  );
}

export function WorkLifeCycleBadge({
  status,
  label,
  issues = [],
  isReady,
}: {
  status?: WorkLifeCycleStatus | string | null;
  label?: string | null;
  issues?: string[];
  isReady?: boolean;
}) {
  let resolvedStatus = status;
  if (!resolvedStatus) {
    resolvedStatus = isReady ? "A_DEPOSER" : "INFORMATIONS_MANQUANTES";
  }

  const tooltipText =
    issues && issues.length > 0
      ? issues.join(" • ")
      : label || undefined;

  switch (resolvedStatus) {
    case "DEPOSE_ET_EXPLOITE":
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 shadow-sm"
          title={tooltipText || "Œuvre officiellement identifiée et exploitée auprès de la SACEM"}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          <span>{label || "Déposé & Exploité"}</span>
        </span>
      );

    case "DEPOSE_EN_ATTENTE":
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-700 shadow-sm"
          title={tooltipText || "Fichier CWR transmis à la SACEM, en attente de l'accusé de réception (ACK)"}
        >
          <Clock className="h-3.5 w-3.5 text-purple-600 animate-pulse" />
          <span>{label || "Déposé (En attente d'ACK)"}</span>
        </span>
      );

    case "A_DEPOSER":
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-700 shadow-sm"
          title={tooltipText || "Œuvre complète et conforme, prête pour l'export CWR et le dépôt SACEM"}
        >
          <Send className="h-3.5 w-3.5 text-blue-600" />
          <span>{label || "À déposer"}</span>
        </span>
      );

    case "INFORMATIONS_MANQUANTES":
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-800 shadow-sm"
          title={tooltipText || "Complétez les informations requises (IPI, splits 100%, rôles) pour débloquer le dépôt"}
        >
          <Info className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
          <span>{label || "Informations manquantes"}</span>
        </span>
      );

    case "REJET_SACEM":
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-800 shadow-sm"
          title={tooltipText || "Dépôt rejeté par la SACEM"}
        >
          <XCircle className="h-3.5 w-3.5 text-rose-600 flex-shrink-0" />
          <span>{label || "Rejet SACEM"}</span>
        </span>
      );

    case "ARCHIVE":
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-400/40 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 shadow-sm"
          title={tooltipText || "Œuvre archivée ou non gérée"}
        >
          <Archive className="h-3.5 w-3.5 text-slate-500" />
          <span>{label || "Archivé"}</span>
        </span>
      );

    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
          {label || resolvedStatus}
        </span>
      );
  }
}

export function CWRStatusBadge({
  isReady,
  status,
  label,
  issues,
}: {
  isReady: boolean;
  status?: WorkLifeCycleStatus | string | null;
  label?: string | null;
  issues?: string[];
}) {
  return (
    <WorkLifeCycleBadge
      isReady={isReady}
      status={status}
      label={label}
      issues={issues}
    />
  );
}
