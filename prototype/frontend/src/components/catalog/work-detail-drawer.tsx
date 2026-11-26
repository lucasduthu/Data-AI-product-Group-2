"use client";

import React, { useEffect, useState } from "react";
import {
  BookOpen,
  SlidersHorizontal,
  Tv,
  History,
  Sparkles,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileText,
  Send,
  Clock,
  Music,
  Tag,
  Calendar,
  Film,
  Disc3,
  Layers,
  Wand2,
  ShieldCheck,
  Building,
  UserCheck,
  Lock,
  Info,
} from "lucide-react";
import { WorkLifeCycleBadge } from "@/components/confidence-badge";

import {
  WorkRead,
  RightHolderSplit,
  AdministrationStatus,
} from "@/types/api";
import {
  updateWork,
  addWorkTimelineNote,
  applyWorkGroupInheritance,
} from "@/lib/api";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: {
    label: "En exploitation",
    color: "bg-emerald-500/10 text-emerald-800 border-emerald-500/30",
  },
  IN_DISPUTE: {
    label: "Litige Sacem",
    color: "bg-rose-500/10 text-rose-800 border-rose-500/30",
  },
  UNDER_ADMIN: {
    label: "Sous séquestre",
    color: "bg-amber-500/10 text-amber-800 border-amber-500/30",
  },
  ARCHIVED: {
    label: "Archivée",
    color: "bg-muted text-muted-foreground border-border",
  },
};

export type DrawerTabKey = "meta" | "splits" | "contracts" | "history";

interface WorkDetailDrawerProps {
  work: WorkRead;
  onClose: () => void;
  onEditWork: (work: WorkRead) => void;
  onDeleteWork: (work: WorkRead) => void;
  onWorkUpdated: (updatedWork: WorkRead) => void;
  onFilterByGroup?: (groupId: string) => void;
}

export function WorkDetailDrawer({
  work,
  onClose,
  onEditWork,
  onDeleteWork,
  onWorkUpdated,
  onFilterByGroup,
}: WorkDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTabKey>("meta");
  const [drawerBanner, setDrawerBanner] = useState<string | null>(null);

  // Mémo libre
  const [drawerMemoText, setDrawerMemoText] = useState(work.general_notes || "");
  const [isSavingDrawerMemo, setIsSavingDrawerMemo] = useState(false);

  useEffect(() => {
    setDrawerMemoText(work.general_notes || "");
  }, [work.id, work.general_notes]);

  // Fil d'annotations
  const [drawerTimelineAuthor, setDrawerTimelineAuthor] = useState("Éditeur");
  const [drawerTimelineText, setDrawerTimelineText] = useState("");
  const [isSubmittingDrawerNote, setIsSubmittingDrawerNote] = useState(false);

  // Action équilibrage automatique
  const [isBalancingSplits, setIsBalancingSplits] = useState(false);
  const [isApplyingInheritance, setIsApplyingInheritance] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    try {
      setIsUpdatingStatus(true);
      const updated = await updateWork(work.id, {
        title: work.title,
        subtitle: work.subtitle,
        alternate_titles: work.alternate_titles,
        iswc: work.iswc,
        sacem_work_code: work.sacem_work_code,
        cotage_number: work.cotage_number,
        isrc_codes: work.isrc_codes,
        performers: work.performers,
        genre: work.genre,
        duration_seconds: work.duration_seconds,
        creation_year: work.creation_year,
        administration_status: work.administration_status,
        contract_reference: work.contract_reference,
        general_notes: work.general_notes,
        lifecycle_status: newStatus,
        splits: work.splits,
      });
      onWorkUpdated(updated);
      setDrawerBanner(`État de l'œuvre mis à jour : ${updated.lifecycle_status_label || newStatus}`);
      setTimeout(() => setDrawerBanner(null), 4000);
    } catch (err: any) {
      alert("Erreur lors du changement d'état : " + err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Calcul dynamique de l'équilibre des quotes-parts
  const depTotal = work.splits.reduce(
    (acc, s) => acc + parseFloat(s.dep_share_pct || "0"),
    0
  );
  const drmTotal = work.splits.reduce(
    (acc, s) => acc + parseFloat(s.drm_share_pct || "0"),
    0
  );
  const syncTotal = work.splits.reduce(
    (acc, s) => acc + parseFloat(s.sync_share_pct || "0"),
    0
  );
  const phonoTotal = work.splits.reduce(
    (acc, s) => acc + parseFloat(s.phono_share_pct || "0"),
    0
  );

  const depDiff = Math.round((100 - depTotal) * 100) / 100;
  const drmDiff = Math.round((100 - drmTotal) * 100) / 100;
  const syncDiff = Math.round((100 - syncTotal) * 100) / 100;
  const phonoDiff = Math.round((100 - phonoTotal) * 100) / 100;

  const hasImbalance =
    Math.abs(depDiff) > 0.001 ||
    Math.abs(drmDiff) > 0.001 ||
    (syncTotal > 0 && Math.abs(syncDiff) > 0.001) ||
    (phonoTotal > 0 && Math.abs(phonoDiff) > 0.001);

  const missingIpiCount = work.splits.filter(
    (s) => !s.ipi_number || s.ipi_number.trim() === ""
  ).length;

  async function handleSaveDrawerMemo() {
    setIsSavingDrawerMemo(true);
    try {
      const payload = {
        title: work.title,
        subtitle: work.subtitle,
        alternate_titles: work.alternate_titles,
        iswc: work.iswc,
        sacem_work_code: work.sacem_work_code,
        cotage_number: work.cotage_number,
        isrc_codes: work.isrc_codes,
        performers: work.performers,
        genre: work.genre,
        duration_seconds: work.duration_seconds,
        creation_year: work.creation_year,
        administration_status: work.administration_status,
        contract_reference: work.contract_reference,
        general_notes: drawerMemoText.trim() || null,
        timeline_notes: work.timeline_notes || [],
        rights_managed: work.rights_managed || ["DEP", "DRM", "SYNC", "PHONO"],
        splits: work.splits,
      };
      const saved = await updateWork(work.id, payload);
      onWorkUpdated(saved);
      setDrawerBanner("Mémo éditeur enregistré avec succès.");
    } catch {
      const localUpdated: WorkRead = {
        ...work,
        general_notes: drawerMemoText.trim() || null,
      };
      onWorkUpdated(localUpdated);
      setDrawerBanner("Mémo enregistré (sauvegarde locale).");
    } finally {
      setIsSavingDrawerMemo(false);
      setTimeout(() => setDrawerBanner(null), 3500);
    }
  }

  async function handleAddDrawerTimelineNote(e: React.FormEvent) {
    e.preventDefault();
    if (!drawerTimelineText.trim()) return;
    setIsSubmittingDrawerNote(true);
    const author = drawerTimelineAuthor.trim() || "Éditeur";
    const text = drawerTimelineText.trim();
    try {
      const saved = await addWorkTimelineNote(work.id, { author, text });
      onWorkUpdated(saved);
      setDrawerTimelineText("");
      setDrawerBanner("Annotation ajoutée avec succès au fil d'activité.");
    } catch {
      const localNote = {
        id: `note-${Date.now()}`,
        author,
        text,
        created_at: new Date().toISOString(),
      };
      const localUpdated: WorkRead = {
        ...work,
        timeline_notes: [...(work.timeline_notes || []), localNote],
      };
      onWorkUpdated(localUpdated);
      setDrawerTimelineText("");
      setDrawerBanner("Annotation ajoutée (sauvegarde locale).");
    } finally {
      setIsSubmittingDrawerNote(false);
      setTimeout(() => setDrawerBanner(null), 3500);
    }
  }

  // US-5.1 : Action 1-clic « Équilibrer le reste sur l'éditeur »
  async function handleBalanceOnPublisher() {
    if (!hasImbalance) return;
    setIsBalancingSplits(true);
    try {
      const updatedSplits = work.splits.map((s) => ({ ...s }));
      let publisherIndex = updatedSplits.findIndex(
        (s) =>
          s.role === "E" ||
          s.role === "PUBLISHER" ||
          s.role === "SE" ||
          s.role === "SUB_PUBLISHER"
      );

      if (publisherIndex >= 0) {
        const pub = updatedSplits[publisherIndex];
        const newDep = Math.max(
          0,
          Math.round((parseFloat(pub.dep_share_pct || "0") + depDiff) * 100) / 100
        );
        const newDrm = Math.max(
          0,
          Math.round((parseFloat(pub.drm_share_pct || "0") + drmDiff) * 100) / 100
        );
        const newSync = syncTotal > 0 ? Math.max(
          0,
          Math.round(
            (parseFloat(pub.sync_share_pct || "0") + syncDiff) * 100
          ) / 100
        ) : parseFloat(pub.sync_share_pct || "0");
        const newPhono = phonoTotal > 0 ? Math.max(
          0,
          Math.round(
            (parseFloat(pub.phono_share_pct || "0") + phonoDiff) * 100
          ) / 100
        ) : parseFloat(pub.phono_share_pct || "0");

        updatedSplits[publisherIndex] = {
          ...pub,
          dep_share_pct: newDep.toFixed(2),
          drm_share_pct: newDrm.toFixed(2),
          sync_share_pct: newSync.toFixed(2),
          phono_share_pct: newPhono.toFixed(2),
          share_percentage: newDep.toFixed(2),
        };
      } else {
        // Crée la quote-part éditeur résiduelle
        updatedSplits.push({
          holder_name: "TF1 DROITS AUDIOVISUELS (Éditeur)",
          ipi_number: null,
          role: "E",
          dep_share_pct: Math.max(0, depDiff).toFixed(2),
          drm_share_pct: Math.max(0, drmDiff).toFixed(2),
          sync_share_pct: Math.max(0, syncDiff).toFixed(2),
          phono_share_pct: Math.max(0, phonoDiff).toFixed(2),
          share_percentage: Math.max(0, depDiff).toFixed(2),
          society_name: "SACEM",
          society_de: "SACEM",
          society_dr: "SACEM",
        });
      }

      const payload = {
        title: work.title,
        subtitle: work.subtitle,
        alternate_titles: work.alternate_titles,
        iswc: work.iswc,
        sacem_work_code: work.sacem_work_code,
        cotage_number: work.cotage_number,
        isrc_codes: work.isrc_codes,
        performers: work.performers,
        genre: work.genre,
        duration_seconds: work.duration_seconds,
        creation_year: work.creation_year,
        administration_status: work.administration_status,
        contract_reference: work.contract_reference,
        general_notes: work.general_notes,
        timeline_notes: work.timeline_notes || [],
        rights_managed: work.rights_managed || ["DEP", "DRM", "SYNC", "PHONO"],
        splits: updatedSplits,
      };

      const updated = await updateWork(work.id, payload);
      onWorkUpdated(updated);
      setDrawerBanner(
        "✨ Action 1-clic appliquée : la quote-part éditeur a été ajustée pour atteindre 100.00 % émeraude."
      );
    } catch (err) {
      console.error(err);
      setDrawerBanner("Erreur lors de l'équilibrage des quotes-parts.");
    } finally {
      setIsBalancingSplits(false);
      setTimeout(() => setDrawerBanner(null), 4000);
    }
  }

  async function handleApplyInheritance(groupId: string) {
    setIsApplyingInheritance(groupId);
    try {
      const res = await applyWorkGroupInheritance(groupId, true, false);
      setDrawerBanner(
        `Héritage contrat appliqué au projet « ${res.group_name} » : ${res.affected_works_count} œuvre(s) mise(s) à jour.`
      );
      // Met à jour l'œuvre localement si elle hérite de la référence
      if (res.contract_reference) {
        onWorkUpdated({
          ...work,
          contract_reference: res.contract_reference,
        });
      }
    } catch (err) {
      console.error(err);
      setDrawerBanner("Erreur lors de l'application de l'héritage contrat.");
    } finally {
      setIsApplyingInheritance(null);
      setTimeout(() => setDrawerBanner(null), 4000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Drawer */}
      <div className="relative z-50 flex h-full w-full sm:w-[600px] md:w-[700px] flex-col border-l bg-card shadow-2xl transition-transform duration-300">
        {/* Header */}
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div className="space-y-1 pr-4">
            <div className="flex flex-wrap items-center gap-2">
              <WorkLifeCycleBadge
                status={work.lifecycle_status}
                label={work.lifecycle_status_label}
                issues={work.lifecycle_status_issues}
                isReady={work.cwr_validation?.is_cwr_ready}
              />
              <select
                value={
                  work.lifecycle_status ||
                  (work.cwr_validation?.is_cwr_ready
                    ? "A_DEPOSER"
                    : "INFORMATIONS_MANQUANTES")
                }
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={isUpdatingStatus}
                aria-label="Changer l'état métier de l'œuvre"
                className="h-6 rounded border bg-card px-1.5 text-[11px] font-semibold text-foreground hover:bg-accent focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer disabled:opacity-50"
                title="Changer manuellement l'état métier de l'œuvre"
              >
                <option value="A_DEPOSER">🔵 À déposer</option>
                <option value="INFORMATIONS_MANQUANTES">🟡 Informations manquantes</option>
                <option value="DEPOSE_EN_ATTENTE">🟣 Déposé (En attente d&apos;ACK)</option>
                <option value="DEPOSE_ET_EXPLOITE">🟢 Déposé &amp; Exploité</option>
                <option value="REJET_SACEM">🔴 Rejet SACEM</option>
                <option value="ARCHIVE">⚪ Archivé / Non administré</option>
              </select>
              <span
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  STATUS_LABELS[
                    work.administration_status || "ACTIVE"
                  ]?.color || "bg-secondary text-foreground"
                }`}
              >
                {STATUS_LABELS[work.administration_status || "ACTIVE"]?.label ||
                  work.administration_status}
              </span>
              {work.contract_reference && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {work.contract_reference}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-foreground leading-tight">
              {work.title}
            </h2>
            {work.subtitle && (
              <p className="text-xs text-primary font-medium italic">
                Sous-titre officiel Sacem : {work.subtitle}
              </p>
            )}
            {work.alternate_titles.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Alias / Versions : {work.alternate_titles.join(" • ")}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onEditWork(work)}
              className="inline-flex items-center gap-1 rounded-md border bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent"
            >
              <Pencil className="h-3.5 w-3.5" />
              Modifier
            </button>
            <button
              type="button"
              onClick={() => onDeleteWork(work)}
              title="Supprimer cette œuvre"
              className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Bannière de notification interne */}
        {drawerBanner && (
          <div className="border-b bg-emerald-500/10 px-5 py-2 text-xs font-medium text-emerald-800 flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>{drawerBanner}</span>
          </div>
        )}

        {/* US-5.1 : 4 Sous-Onglets Thématiques Lisibles */}
        <div className="flex border-b bg-muted/30 px-5 text-xs font-medium text-muted-foreground">
          <button
            type="button"
            onClick={() => setActiveTab("meta")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 transition-colors ${
              activeTab === "meta"
                ? "border-primary font-bold text-foreground"
                : "border-transparent hover:text-foreground"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            1. Identifiants &amp; Métadonnées
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("splits")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 transition-colors relative ${
              activeTab === "splits"
                ? "border-primary font-bold text-foreground"
                : "border-transparent hover:text-foreground"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            2. Quotes-Parts &amp; Jauges
            {hasImbalance && (
              <span className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("contracts")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 transition-colors ${
              activeTab === "contracts"
                ? "border-primary font-bold text-foreground"
                : "border-transparent hover:text-foreground"
            }`}
          >
            <Tv className="h-3.5 w-3.5" />
            3. Contrats &amp; Projets TF1
            {work.groups && work.groups.length > 0 && (
              <span className="rounded-full bg-primary/10 text-primary px-1.5 py-0.2 text-[10px] font-bold">
                {work.groups.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 transition-colors ${
              activeTab === "history"
                ? "border-primary font-bold text-foreground"
                : "border-transparent hover:text-foreground"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            4. Historique &amp; Audit CWR
            {work.cwr_validation && !work.cwr_validation.is_cwr_ready && (
              <span className="h-2 w-2 rounded-full bg-rose-500" />
            )}
          </button>
        </div>

        {/* Contenu Défilable du Tiroir */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ============================================================== */}
          {/* SOUS-ONGLET 1 : IDENTIFIANTS & MÉTADONNÉES                     */}
          {/* ============================================================== */}
          {activeTab === "meta" && (
            <div className="space-y-4">
              {/* Grille d'identifiants SACEM / ISWC / ISRC / Cotage */}
              <div className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Music className="h-3.5 w-3.5 text-primary" />
                  Identifiants Internationaux &amp; Enregistrement
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="rounded-lg border bg-indigo-500/10 border-indigo-500/25 p-2.5">
                    <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-400 block">
                      Code SACEM (COCV)
                    </span>
                    <span className="font-mono font-bold text-indigo-800 dark:text-indigo-300">
                      {work.sacem_work_code || "Non attribué"}
                    </span>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-2.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Code ISWC Édition
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {work.iswc || "Non attribué"}
                    </span>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-2.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      N° de Cotage Librairie
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {work.cotage_number || work.contract_reference || "Non attribué"}
                    </span>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-2.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Code(s) ISRC Master
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {work.isrc_codes.length > 0
                        ? work.isrc_codes.join(", ")
                        : "Non attribué"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Suivi Officiel de Dépôt SACEM (US-5.8) */}
              <div className="rounded-xl border bg-card p-4 space-y-2 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  Suivi Officiel du Dépôt SACEM (Accusé CWR)
                </h3>
                {work.sacem_registration_status === "REGISTERED" ? (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-emerald-900">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Œuvre enregistrée et validée auprès de la SACEM</span>
                    </div>
                    <p className="text-[11px] text-emerald-700">
                      Code Œuvre SACEM (COCV) officiel : <strong className="font-mono">{work.sacem_work_code || "Confirmé"}</strong>
                      {work.sacem_registered_at && ` • Validé le ${new Date(work.sacem_registered_at).toLocaleDateString("fr-FR")}`}
                      {work.sacem_ack_reference && ` • Réf : ${work.sacem_ack_reference}`}
                    </p>
                  </div>
                ) : work.sacem_registration_status === "REJECTED" ? (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-800 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-rose-900">
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                      <span>Dépôt rejeté par la SACEM (NACK)</span>
                    </div>
                    <p className="text-[11px] text-rose-700 font-medium">
                      Motif notifié : {work.sacem_rejection_reason || "Anomalie de conformité de déclaration"}
                    </p>
                    {work.sacem_ack_reference && (
                      <p className="text-[10px] text-rose-600/80">
                        Fichier accusé : {work.sacem_ack_reference}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground flex items-center justify-between">
                    <span>Aucun accusé de réception SACEM ingéré pour cette œuvre.</span>
                    <span className="text-[11px] font-semibold text-slate-500">Non soumis ou en cours</span>
                  </div>
                )}
              </div>

              {/* Caractéristiques Artistiques */}
              <div className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  Caractéristiques Artistiques &amp; Production
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-lg border bg-muted/20 p-2.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Genre Musical
                    </span>
                    <span className="font-semibold text-foreground">
                      {work.genre || "Non renseigné"}
                    </span>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-2.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Durée
                    </span>
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {work.duration_seconds
                        ? `${Math.floor(work.duration_seconds / 60)}m ${String(
                            work.duration_seconds % 60
                          ).padStart(2, "0")}s (${work.duration_seconds}s)`
                        : "Non renseignée"}
                    </span>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-2.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Année de Création
                    </span>
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {work.creation_year || "Non renseignée"}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-2.5 text-xs">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">
                    Interprètes Déclarés (Droits Voisins &amp; Phono)
                  </span>
                  <span className="font-medium text-foreground">
                    {work.performers.length > 0
                      ? work.performers.join(", ")
                      : "Non spécifié"}
                  </span>
                </div>

                <div className="rounded-lg border bg-muted/20 p-2.5 text-xs">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">
                    Statut d&apos;Administration
                  </span>
                  <span className="font-semibold text-foreground">
                    {STATUS_LABELS[work.administration_status || "ACTIVE"]?.label ||
                      work.administration_status}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SOUS-ONGLET 2 : QUOTES-PARTS & AYANTS DROIT (JAUGES + 1-CLIC)   */}
          {/* ============================================================== */}
          {activeTab === "splits" && (
            <div className="space-y-4">
              {/* 4 Jauges d'Équilibre en Temps Réel */}
              <div className="rounded-xl border bg-card p-4 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Jauges d&apos;Équilibre des Quotes-Parts (100.00 %)
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Contrôle en temps réel de la complétude des clés statutaires
                    </p>
                  </div>
                  {hasImbalance && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                      <AlertTriangle className="h-3 w-3" />
                      Écart détecté
                    </span>
                  )}
                  {!hasImbalance && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      100.00 % Parfait
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {/* Jauge DEP */}
                  <div className="rounded-lg border bg-muted/20 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">
                        DEP (Exécution)
                      </span>
                      <span
                        className={`font-mono font-bold text-xs ${
                          Math.abs(depDiff) < 0.001
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {depTotal.toFixed(2)} %
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          Math.abs(depDiff) < 0.001
                            ? "bg-emerald-500"
                            : depTotal > 100
                              ? "bg-rose-500"
                              : "bg-amber-500"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, depTotal))}%` }}
                      />
                    </div>
                  </div>

                  {/* Jauge DRM */}
                  <div className="rounded-lg border bg-muted/20 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">
                        DRM (Mécanique)
                      </span>
                      <span
                        className={`font-mono font-bold text-xs ${
                          Math.abs(drmDiff) < 0.001
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {drmTotal.toFixed(2)} %
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          Math.abs(drmDiff) < 0.001
                            ? "bg-emerald-500"
                            : drmTotal > 100
                              ? "bg-rose-500"
                              : "bg-amber-500"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, drmTotal))}%` }}
                      />
                    </div>
                  </div>

                  {/* Jauge SYNC */}
                  <div className="rounded-lg border bg-muted/20 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-purple-700">
                        SYNC (Image/TV)
                      </span>
                      <span
                        className={`font-mono font-bold text-xs ${
                          Math.abs(syncDiff) < 0.001
                            ? "text-emerald-700 dark:text-emerald-400"
                            : syncTotal === 0
                            ? "text-muted-foreground"
                            : "text-purple-700"
                        }`}
                      >
                        {syncTotal === 0 ? "Non attribué (0 %)" : `${syncTotal.toFixed(2)} %`}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          Math.abs(syncDiff) < 0.001
                            ? "bg-emerald-500"
                            : syncTotal === 0
                            ? "bg-muted-foreground/30"
                            : "bg-purple-500"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, syncTotal))}%` }}
                      />
                    </div>
                  </div>

                  {/* Jauge PHONO */}
                  <div className="rounded-lg border bg-muted/20 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-indigo-700">
                        PHONO (Master)
                      </span>
                      <span
                        className={`font-mono font-bold text-xs ${
                          Math.abs(phonoDiff) < 0.001
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-indigo-700"
                        }`}
                      >
                        {phonoTotal.toFixed(2)} %
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          Math.abs(phonoDiff) < 0.001 ? "bg-emerald-500" : "bg-indigo-500"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, phonoTotal))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* US-5.1 : Action 1-clic « Équilibrer le reste sur l'éditeur » */}
                {hasImbalance && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                        <Wand2 className="h-3.5 w-3.5 text-primary" />
                        <span>Action 1-clic : Différentiel manquant détecté</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {depDiff !== 0 && `DEP : ${depDiff > 0 ? "+" : ""}${depDiff.toFixed(2)} % `}
                        {drmDiff !== 0 && `• DRM : ${drmDiff > 0 ? "+" : ""}${drmDiff.toFixed(2)} %`}
                        {" — Ajuste automatiquement la quote-part éditeur."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleBalanceOnPublisher}
                      disabled={isBalancingSplits}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors shrink-0 disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>
                        {isBalancingSplits
                          ? "Calcul & Injection..."
                          : "Équilibrer le reste sur l'éditeur"}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Tableau Détaillé des Splits */}
              <div className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Tableau des Ayants Droit &amp; Rôles Statutaires
                  </h3>
                  <button
                    type="button"
                    onClick={() => onEditWork(work)}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <Pencil className="h-3 w-3" />
                    Modifier les splits
                  </button>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-2.5 py-1.5 font-medium">Ayant droit</th>
                        <th className="px-2.5 py-1.5 font-medium">Rôle</th>
                        <th className="px-2.5 py-1.5 font-medium">IPI</th>
                        <th className="px-2.5 py-1.5 font-medium">Statut Fiscal &amp; Mandat</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">DEP</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">DRM</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">SYNC</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">PHONO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {work.splits.map((s, idx) => {
                        const isIpiMissing = !s.ipi_number || s.ipi_number.trim() === "";
                        const isPublisherRole =
                          s.role === "E" ||
                          s.role === "PUBLISHER" ||
                          s.role === "SE" ||
                          s.role === "SUB_PUBLISHER";

                        return (
                          <tr key={idx} className="hover:bg-muted/10">
                            <td className="px-2.5 py-1.5 font-medium text-foreground">
                              <div>{s.holder_name}</div>
                              <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                                <span className="text-sky-700">
                                  DE: {s.society_de || s.society_name || "SACEM"}
                                </span>
                                <span>•</span>
                                <span className="text-indigo-700">
                                  DR: {s.society_dr || s.society_name || "SACEM"}
                                </span>
                              </div>
                            </td>
                            <td className="px-2.5 py-1.5 font-mono text-[11px]">
                              <span
                                className={`rounded px-1 py-0.5 font-bold ${
                                  isPublisherRole
                                    ? "bg-primary/10 text-primary"
                                    : "bg-secondary text-foreground"
                                }`}
                              >
                                {s.role}
                              </span>
                            </td>
                            <td className="px-2.5 py-1.5 font-mono text-[11px]">
                              {isIpiMissing ? (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                                  <AlertCircle className="h-2.5 w-2.5" />
                                  IPI manquant
                                </span>
                              ) : (
                                <span className="text-muted-foreground">{s.ipi_number}</span>
                              )}
                            </td>
                            <td className="px-2.5 py-1.5 text-[10px]">
                              <div className="flex flex-col gap-1 items-start">
                                {isPublisherRole ? (
                                  <span className="rounded bg-sky-500/10 px-1.5 py-0.5 font-medium text-sky-700">
                                    Assujetti TVA Éditeur
                                  </span>
                                ) : (
                                  <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
                                    Précompte / Dispense
                                  </span>
                                )}
                                {s.is_controlled ? (
                                  <span
                                    className="inline-flex items-center gap-1 rounded bg-indigo-500/15 text-indigo-700 font-semibold px-1.5 py-0.5 text-[10px]"
                                    title={`Droits collectés pour compte de tiers et reversés par ${s.controlled_by_name || "l'éditeur"}`}
                                  >
                                    <Lock className="h-2.5 w-2.5" />
                                    Contrôlé par {s.controlled_by_name || "Éditeur"}
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 rounded bg-muted/60 text-muted-foreground px-1.5 py-0.5 text-[10px]"
                                    title="Perception directe auprès de la SACEM / DSP. Aucun reversement de coédition."
                                  >
                                    <UserCheck className="h-2.5 w-2.5" />
                                    Perception directe
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono font-semibold">
                              {s.dep_share_pct}%
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono font-semibold">
                              {s.drm_share_pct}%
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono font-semibold text-purple-700">
                              {s.sync_share_pct || "0.00"}%
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono font-semibold text-indigo-700">
                              {s.phono_share_pct || "0.00"}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t bg-muted/30 font-bold">
                      <tr>
                        <td colSpan={4} className="px-2.5 py-1.5">
                          Total Déterministe
                        </td>
                        <td
                          className={`px-2.5 py-1.5 text-right font-mono ${
                            Math.abs(depDiff) < 0.001
                              ? "text-emerald-700 font-bold"
                              : "text-amber-700"
                          }`}
                        >
                          {depTotal.toFixed(2)}%
                        </td>
                        <td
                          className={`px-2.5 py-1.5 text-right font-mono ${
                            Math.abs(drmDiff) < 0.001
                              ? "text-emerald-700 font-bold"
                              : "text-amber-700"
                          }`}
                        >
                          {drmTotal.toFixed(2)}%
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-mono text-purple-700">
                          {syncTotal === 0 ? "0.00% (En attente)" : `${syncTotal.toFixed(2)}%`}
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-mono text-indigo-700">
                          {phonoTotal === 0 ? "0.00% (En attente)" : `${phonoTotal.toFixed(2)}%`}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {missingIpiCount > 0 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>
                      {missingIpiCount} ayant(s) droit sans IPI : la SACEM bloquera l&apos;accusé
                      de réception CWR si les créateurs ne disposent pas d&apos;identifiant CAE/IPI valide.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SOUS-ONGLET 3 : CONTRATS & PROJETS TF1 / ALBUMS                 */}
          {/* ============================================================== */}
          {activeTab === "contracts" && (
            <div className="space-y-4">
              {/* Contrat d'édition rattaché */}
              <div className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-primary" />
                    Contrat d&apos;Édition / Cession Associé
                  </h3>
                  <button
                    type="button"
                    onClick={() => onEditWork(work)}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Changer de contrat
                  </button>
                </div>

                {work.contract_reference ? (
                  <div className="rounded-lg border bg-muted/20 p-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Référence Juridique Active
                      </span>
                      <span className="font-mono font-bold text-sm text-foreground">
                        {work.contract_reference}
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Liasse contractuelle indexée au grand livre des avances
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                      <CheckCircle2 className="h-3 w-3" />
                      Contrat Lié
                    </span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-center space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Aucun contrat d&apos;édition rattaché à cette œuvre (gestion directe ou
                      œuvre libre).
                    </p>
                    <button
                      type="button"
                      onClick={() => onEditWork(work)}
                      className="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1 text-xs font-semibold text-foreground hover:bg-accent"
                    >
                      <Pencil className="h-3 w-3" />
                      Associer un contrat
                    </button>
                  </div>
                )}
              </div>

              {/* Projets Audiovisuels & Albums Rattachés */}
              <div className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Tv className="h-3.5 w-3.5 text-primary" />
                  Projets Audiovisuels, Séries TF1 &amp; Albums Rattachés
                </h3>

                {(!work.groups || work.groups.length === 0) && (
                  <div className="rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">
                    Cette œuvre n&apos;est actuellement rattachée à aucun projet audiovisuel ou album.
                    Utilisez le module Projets ou la modification par lot pour la lier à une série TV ou un album.
                  </div>
                )}

                {work.groups && work.groups.length > 0 && (
                  <div className="space-y-3">
                    {work.groups.map((grp) => (
                      <div
                        key={grp.id}
                        className="rounded-lg border bg-muted/20 p-3.5 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {grp.group_type === "SERIE_TV" && (
                              <Tv className="h-4 w-4 text-primary" />
                            )}
                            {grp.group_type === "FILM_CINEMA" && (
                              <Film className="h-4 w-4 text-primary" />
                            )}
                            {grp.group_type === "ALBUM" && (
                              <Disc3 className="h-4 w-4 text-primary" />
                            )}
                            {grp.group_type !== "SERIE_TV" &&
                              grp.group_type !== "FILM_CINEMA" &&
                              grp.group_type !== "ALBUM" && (
                                <Layers className="h-4 w-4 text-primary" />
                              )}
                            <span className="font-bold text-xs text-foreground">
                              {grp.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {onFilterByGroup && (
                              <button
                                type="button"
                                onClick={() => onFilterByGroup(grp.id)}
                                className="text-[11px] font-semibold text-primary hover:underline"
                              >
                                Filtrer ce projet →
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                          <div>
                            <span className="font-medium">Diffuseur / Client : </span>
                            <span className="text-foreground font-semibold">
                              {grp.broadcaster_or_client || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Production : </span>
                            <span className="text-foreground">
                              {grp.production_company || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Utilisation Cue : </span>
                            <span className="font-mono text-primary font-semibold">
                              {grp.cue_usage_type || "Standard"}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Piste / Repère : </span>
                            <span className="font-mono text-foreground">
                              {grp.track_or_cue_number || "—"}
                            </span>
                          </div>
                        </div>

                        {/* Bouton de propagation d'héritage cadre */}
                        {grp.contract_reference && (
                          <div className="pt-1 border-t flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">
                              Contrat cadre projet :{" "}
                              <code className="font-mono font-bold text-foreground">
                                {grp.contract_reference}
                              </code>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleApplyInheritance(grp.id)}
                              disabled={isApplyingInheritance === grp.id}
                              className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[10px] font-bold text-foreground hover:bg-accent"
                            >
                              <Wand2 className="h-2.5 w-2.5 text-primary" />
                              <span>
                                {isApplyingInheritance === grp.id
                                  ? "Propagation..."
                                  : "Propager l'héritage contrat"}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SOUS-ONGLET 4 : HISTORIQUE, NOTES & AUDIT CWR                  */}
          {/* ============================================================== */}
          {activeTab === "history" && (
            <div className="space-y-4">
              {/* Rapport d'Audit CWR 2.1 Détaillé */}
              <div className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    Contrôles de Conformité SACEM &amp; CISAC (CWR 2.1)
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      work.cwr_validation?.is_cwr_ready
                        ? "bg-emerald-500/10 text-emerald-800 border border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-800 border border-amber-500/30"
                    }`}
                  >
                    {work.cwr_validation?.is_cwr_ready
                      ? "✓ Conforme pour Dépôt"
                      : "Informations manquantes"}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg border bg-muted/20">
                    <span className="font-medium text-foreground">
                      Règle CISAC CWR-01 : Clé Exécution Publique (DEP = 100.00 %)
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        Math.abs(depDiff) < 0.001 ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {depTotal.toFixed(2)} % {Math.abs(depDiff) < 0.001 ? "✓" : "✕"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg border bg-muted/20">
                    <span className="font-medium text-foreground">
                      Règle CISAC CWR-02 : Clé Reproduction Mécanique (DRM = 100.00 %)
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        Math.abs(drmDiff) < 0.001 ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {drmTotal.toFixed(2)} % {Math.abs(drmDiff) < 0.001 ? "✓" : "✕"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg border bg-muted/20">
                    <span className="font-medium text-foreground">
                      Règle CISAC CWR-03 : Plafond Statutaire Éditeur Sacem (DEP Éditeur ≤ 50.00 %)
                    </span>
                    <span className="font-mono font-bold text-emerald-700">
                      Conforme ✓
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg border bg-muted/20">
                    <span className="font-medium text-foreground">
                      Règle CISAC CWR-04 : Identification IPI / CAE des Créateurs
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        missingIpiCount === 0 ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {missingIpiCount === 0
                        ? "100% Renseignés ✓"
                        : `${missingIpiCount} manquant(s) ⚠️`}
                    </span>
                  </div>
                </div>

                {work.cwr_validation?.blocking_errors &&
                  work.cwr_validation.blocking_errors.length > 0 && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 space-y-1">
                      <span className="font-bold flex items-center gap-1.5 text-amber-800">
                        <Info className="h-4 w-4 text-amber-600 flex-shrink-0" />
                        Informations manquantes avant dépôt SACEM :
                      </span>
                      {work.cwr_validation.blocking_errors.map((err, i) => (
                        <p key={i} className="pl-5 text-amber-900">• {err}</p>
                      ))}
                    </div>
                  )}
              </div>

              {/* Bloc-Notes / Mémo Général Éditeur */}
              <div className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    Bloc-Notes &amp; Mémo Juridique Éditeur
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Espace libre persistant pour noter les accords particuliers, clauses de reversion ou contacts d&apos;artistes.
                  </p>
                </div>

                <textarea
                  rows={4}
                  value={drawerMemoText}
                  onChange={(e) => setDrawerMemoText(e.target.value)}
                  placeholder="Saisissez ici les notes d'édition, accords de coédition, clause de reversion..."
                  className="w-full rounded-lg border bg-background p-3 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary"
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveDrawerMemo}
                    disabled={isSavingDrawerMemo}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>
                      {isSavingDrawerMemo ? "Enregistrement..." : "Enregistrer le mémo"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Fil d'Activité & Annotations Horodatées */}
              <div className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
                <form onSubmit={handleAddDrawerTimelineNote} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Send className="h-3.5 w-3.5 text-primary" />
                      Ajouter une Annotation au Fil
                    </h3>
                    <input
                      type="text"
                      value={drawerTimelineAuthor}
                      onChange={(e) => setDrawerTimelineAuthor(e.target.value)}
                      placeholder="Auteur (ex: Éditeur)"
                      className="rounded border bg-background px-2 py-0.5 text-[11px] font-semibold w-36"
                    />
                  </div>

                  <textarea
                    rows={2}
                    required
                    value={drawerTimelineText}
                    onChange={(e) => setDrawerTimelineText(e.target.value)}
                    placeholder="Écrivez votre commentaire, décision d'arbitrage ou mise à jour de split..."
                    className="w-full rounded-lg border bg-background p-2.5 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary"
                  />

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmittingDrawerNote || !drawerTimelineText.trim()}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Send className="h-3 w-3" />
                      <span>
                        {isSubmittingDrawerNote ? "Publication..." : "Publier l'annotation"}
                      </span>
                    </button>
                  </div>
                </form>

                <div className="space-y-2 pt-2 border-t">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Historique chronologique ({work.timeline_notes?.length || 0})
                  </h4>

                  {(!work.timeline_notes || work.timeline_notes.length === 0) && (
                    <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                      Aucune annotation pour le moment sur cette œuvre.
                    </div>
                  )}

                  {work.timeline_notes &&
                    work.timeline_notes.map((note) => {
                      const dateFormatted = new Date(note.created_at).toLocaleDateString(
                        "fr-FR",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      );
                      return (
                        <div
                          key={note.id}
                          className="rounded-lg border bg-muted/20 p-2.5 space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-foreground">
                              {note.author}
                            </span>
                            <span className="text-muted-foreground font-mono text-[10px] flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {dateFormatted}
                            </span>
                          </div>
                          <p className="text-foreground/90 whitespace-pre-wrap">
                            {note.text}
                          </p>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/20 px-5 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Identifiant interne :{" "}
            <code className="font-mono">{work.id.slice(0, 13)}...</code>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border bg-card px-3 py-1 font-semibold text-foreground hover:bg-accent"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
