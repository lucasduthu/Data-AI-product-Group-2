"use client";

import React, { useState, useMemo } from "react";
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Download,
  Zap,
  RefreshCw,
  Search,
  Filter,
  Check,
  Building2,
  Globe,
  ArrowRight,
  ShieldCheck,
  X,
  FileSpreadsheet,
} from "lucide-react";
import {
  CatalogDiffReport,
  CatalogDiffItem,
  ComparisonStatus,
  SubpublishingDeliveryPayload,
} from "@/types/api";
import {
  compareCatalogWithSacem,
  applySacemCodes,
  exportSubpublishingDeliveryXlsx,
  exportSubpublishingDeliveryCwr,
} from "@/lib/api";

interface SandboxDiffViewerProps {
  isOpen: boolean;
  onClose: () => void;
  activeEntityId?: string | null;
  onDataModified?: () => void;
}

export function SandboxDiffViewer({
  isOpen,
  onClose,
  activeEntityId,
  onDataModified,
}: SandboxDiffViewerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isComparing, setIsComparing] = useState(false);
  const [report, setReport] = useState<CatalogDiffReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filtres et recherche
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Sélection pour livraison
  const [selectedWorkIds, setSelectedWorkIds] = useState<string[]>([]);
  const [isApplyingCodes, setIsApplyingCodes] = useState(false);

  // Modal export livraison sous-éditeur
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState<"XLSX" | "CWR">("XLSX");
  const [subPublisherName, setSubPublisherName] = useState("Sous-Éditeur Partenaire International");
  const [territory, setTerritory] = useState("Monde entier hors France");
  const [deliveryRef, setDeliveryRef] = useState(`LIV-SUB-${new Date().getFullYear()}-01`);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMsg(null);
    }
  };

  const handleRunComparison = async () => {
    if (!file) {
      setErrorMsg("Veuillez sélectionner un fichier d'export SACEM (.xlsx, .csv ou .V21).");
      return;
    }
    setIsComparing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const diffReport = await compareCatalogWithSacem(file, {
        entityId: activeEntityId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setReport(diffReport);
      // Pré-sélectionner toutes les œuvres ayant un ID Korom
      const koromIds = diffReport.items
        .map((it) => it.korom_work_id)
        .filter((id): id is string => Boolean(id));
      setSelectedWorkIds(koromIds);
      setSuccessMsg(`Rapprochement terminé : ${diffReport.total_compared} œuvre(s) analysée(s).`);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de la comparaison.");
    } finally {
      setIsComparing(false);
    }
  };

  // Filtrage des lignes du rapport
  const filteredItems = useMemo(() => {
    if (!report) return [];
    return report.items.filter((item) => {
      // Filtre statut
      if (statusFilter !== "ALL" && item.status !== statusFilter) {
        return false;
      }
      // Filtre recherche textuelle
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const tKorom = (item.title_korom || "").toLowerCase();
        const tSacem = (item.title_sacem || "").toLowerCase();
        const cocvK = (item.sacem_work_code_korom || "").toLowerCase();
        const cocvS = (item.sacem_work_code_sacem || "").toLowerCase();
        const iswcK = (item.iswc_korom || "").toLowerCase();
        const iswcS = (item.iswc_sacem || "").toLowerCase();
        const cotage = (item.cotage_korom || "").toLowerCase();

        return (
          tKorom.includes(q) ||
          tSacem.includes(q) ||
          cocvK.includes(q) ||
          cocvS.includes(q) ||
          iswcK.includes(q) ||
          iswcS.includes(q) ||
          cotage.includes(q)
        );
      }
      return true;
    });
  }, [report, statusFilter, searchQuery]);

  // Œuvres éligibles à l'application 1-clic des codes SACEM
  const syncableItems = useMemo(() => {
    if (!report) return [];
    return report.items.filter(
      (it) => it.can_apply_sacem_codes && it.korom_work_id && (it.sacem_work_code_sacem || it.iswc_sacem)
    );
  }, [report]);

  const handleApplyCodes = async () => {
    if (syncableItems.length === 0) return;
    setIsApplyingCodes(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        items: syncableItems.map((it) => ({
          work_id: it.korom_work_id!,
          sacem_work_code: it.sacem_work_code_sacem,
          iswc: it.iswc_sacem,
        })),
      };
      const res = await applySacemCodes(payload);
      setSuccessMsg(
        `Succès ! ${res.updated_works_count} œuvre(s) enrichie(s) des identifiants officiels SACEM (COCV & ISWC).`
      );
      if (onDataModified) onDataModified();

      // Mettre à jour localement les statuts dans le rapport
      if (report) {
        const updatedItems = report.items.map((it) => {
          if (it.can_apply_sacem_codes && it.korom_work_id) {
            const discFiltered = it.discrepancies.filter(
              (d) => d.field !== "sacem_work_code" && d.field !== "iswc"
            );
            const newStatus =
              discFiltered.length === 0 ? "SYNCHRONIZED" : "DISCREPANCY";
            return {
              ...it,
              sacem_work_code_korom: it.sacem_work_code_sacem || it.sacem_work_code_korom,
              iswc_korom: it.iswc_sacem || it.iswc_korom,
              discrepancies: discFiltered,
              status: newStatus as ComparisonStatus,
              status_label:
                newStatus === "SYNCHRONIZED" ? "Concordance exacte" : "Écarts résiduels",
              can_apply_sacem_codes: false,
            };
          }
          return it;
        });
        setReport({
          ...report,
          items: updatedItems,
          synchronized_count: updatedItems.filter((i) => i.status === "SYNCHRONIZED").length,
          discrepancy_count: updatedItems.filter((i) => i.status === "DISCREPANCY").length,
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de la synchronisation des codes.");
    } finally {
      setIsApplyingCodes(false);
    }
  };

  const handleToggleSelectAll = () => {
    if (!report) return;
    const availableIds = filteredItems
      .map((it) => it.korom_work_id)
      .filter((id): id is string => Boolean(id));

    const allSelected = availableIds.every((id) => selectedWorkIds.includes(id));
    if (allSelected) {
      setSelectedWorkIds(selectedWorkIds.filter((id) => !availableIds.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedWorkIds, ...availableIds]));
      setSelectedWorkIds(merged);
    }
  };

  const handleToggleSelectItem = (workId: string) => {
    if (selectedWorkIds.includes(workId)) {
      setSelectedWorkIds(selectedWorkIds.filter((id) => id !== workId));
    } else {
      setSelectedWorkIds([...selectedWorkIds, workId]);
    }
  };

  const handleOpenExportModal = (mode: "XLSX" | "CWR") => {
    setExportMode(mode);
    setShowExportModal(true);
  };

  const handleConfirmExport = async () => {
    if (selectedWorkIds.length === 0) {
      setErrorMsg("Veuillez sélectionner au moins une œuvre à livrer.");
      return;
    }
    setIsExporting(true);
    setErrorMsg(null);

    const payload: SubpublishingDeliveryPayload = {
      work_ids: selectedWorkIds,
      sub_publisher_name: subPublisherName,
      territory,
      delivery_reference: deliveryRef,
      notes: deliveryNotes || undefined,
    };

    try {
      if (exportMode === "XLSX") {
        const blob = await exportSubpublishingDeliveryXlsx(payload);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        a.download = `LIVRAISON_SOUS_EDITION_${deliveryRef.replace(/[^a-zA-Z0-9_-]/g, "")}_${nowStr}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        setSuccessMsg(`Bordereau Excel généré avec succès (${selectedWorkIds.length} titres).`);
      } else {
        const cwrRes = await exportSubpublishingDeliveryCwr(payload);
        const blob = new Blob([cwrRes.content], { type: "text/plain;charset=utf-8" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = cwrRes.filename || "LIVRAISON_SUB.V21";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        setSuccessMsg(`Fichier CWR v2.1 de sous-édition généré (${cwrRes.included_works_count} titres).`);
      }
      setShowExportModal(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de l'export de livraison.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-7xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* En-tête modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-micro">
                  Bac à Sable Différentiel SACEM vs Korom & Livraison Sous-Édition
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                  US-5.18
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Comparez les œuvres déclarées avec les enregistrements officiels SACEM et préparez les livraisons internationales (.xlsx & .V21).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corps défilable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Messages de retour */}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Étape 1 : Téléversement du fichier SACEM */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Upload className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              1. Charger l'export officiel SACEM (Espace Membre Mes_oeuvres_*.xlsx / .csv ou CWR .V21)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Fichier source SACEM
                </label>
                <input
                  type="file"
                  accept=".xlsx,.csv,.v21,.cwr,.txt"
                  onChange={handleFileChange}
                  className="block w-full text-xs text-slate-500 dark:text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-950/50 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900/50 cursor-pointer"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Créé depuis le
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Jusqu'au
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="md:col-span-3">
                <button
                  onClick={handleRunComparison}
                  disabled={!file || isComparing}
                  className="w-full py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  {isComparing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Analyse différentielle...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Lancer la comparaison
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Étape 2 : Synthèse & KPI Report */}
          {report && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                  <div className="text-xs text-slate-500 font-medium">Total Analysées</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {report.total_compared}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Rapprochement global</div>
                </div>

                <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm">
                  <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Synchronisées (100%)
                  </div>
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                    {report.synchronized_count}
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-500 mt-0.5">
                    Taux : {report.health_score_pct} %
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm">
                  <div className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Écarts Détectés
                  </div>
                  <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">
                    {report.discrepancy_count}
                  </div>
                  <div className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5">
                    Clés ou splits divergents
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-sky-200 dark:border-sky-900/50 bg-sky-50/50 dark:bg-sky-950/20 shadow-sm">
                  <div className="text-xs text-sky-700 dark:text-sky-400 font-medium flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    Korom Uniquement
                  </div>
                  <div className="text-2xl font-bold text-sky-700 dark:text-sky-400 mt-1">
                    {report.korom_only_count}
                  </div>
                  <div className="text-[10px] text-sky-600 dark:text-sky-500 mt-0.5">
                    Dépôts récents / locaux
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 shadow-sm">
                  <div className="text-xs text-purple-700 dark:text-purple-400 font-medium flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" />
                    SACEM Uniquement
                  </div>
                  <div className="text-2xl font-bold text-purple-700 dark:text-purple-400 mt-1">
                    {report.sacem_only_count}
                  </div>
                  <div className="text-[10px] text-purple-600 dark:text-purple-500 mt-0.5">
                    Absent de Korom
                  </div>
                </div>
              </div>

              {/* Barre d'actions & Outils de synchronisation */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Sélection : {selectedWorkIds.length} œuvre(s)
                  </span>

                  {syncableItems.length > 0 && (
                    <button
                      onClick={handleApplyCodes}
                      disabled={isApplyingCodes}
                      className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      {isApplyingCodes
                        ? "Application en cours..."
                        : `Appliquer COCV & ISWC officiels (${syncableItems.length} titres)`}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenExportModal("XLSX")}
                    disabled={selectedWorkIds.length === 0}
                    className="py-1.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    Exporter Bordereau Excel (.xlsx)
                  </button>

                  <button
                    onClick={() => handleOpenExportModal("CWR")}
                    disabled={selectedWorkIds.length === 0}
                    className="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Exporter CWR Sous-Édition (.V21)
                  </button>
                </div>
              </div>

              {/* Filtres de la table */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  {[
                    { key: "ALL", label: `Tous (${report.total_compared})` },
                    { key: "DISCREPANCY", label: `Écarts (${report.discrepancy_count})` },
                    { key: "SYNCHRONIZED", label: `Synchronisées (${report.synchronized_count})` },
                    { key: "KOROM_ONLY", label: `Korom seul (${report.korom_only_count})` },
                    { key: "SACEM_ONLY", label: `SACEM seule (${report.sacem_only_count})` },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setStatusFilter(tab.key)}
                      className={`py-1 px-3 rounded-lg text-xs font-medium transition-all ${
                        statusFilter === tab.key
                          ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative min-w-[240px]">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrer par titre, COCV, ISWC..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Tableau comparatif haute densité */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold">
                        <th className="py-3 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              filteredItems.length > 0 &&
                              filteredItems
                                .filter((i) => Boolean(i.korom_work_id))
                                .every((i) => selectedWorkIds.includes(i.korom_work_id!))
                            }
                            onChange={handleToggleSelectAll}
                            className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-3">Titre de l'Œuvre (Korom / SACEM)</th>
                        <th className="py-3 px-3">Identifiants Officiels (COCV & ISWC)</th>
                        <th className="py-3 px-3">Ayants Droit & Splits (DE / DR)</th>
                        <th className="py-3 px-3">Statut & Écarts Identifiés</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400">
                            Aucune œuvre ne correspond aux filtres sélectionnés.
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item) => {
                          const isSelected = item.korom_work_id
                            ? selectedWorkIds.includes(item.korom_work_id)
                            : false;

                          return (
                            <tr
                              key={item.id}
                              className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                                isSelected ? "bg-indigo-50/30 dark:bg-indigo-950/20" : ""
                              }`}
                            >
                              <td className="py-3 px-3 text-center align-top">
                                {item.korom_work_id ? (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleSelectItem(item.korom_work_id!)}
                                    className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                  />
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-700">-</span>
                                )}
                              </td>

                              {/* Titre */}
                              <td className="py-3 px-3 align-top min-w-[200px]">
                                <div className="font-bold text-slate-900 dark:text-slate-100 font-micro">
                                  {item.title_korom || item.title_sacem}
                                </div>
                                {item.title_sacem && item.title_korom && item.title_korom !== item.title_sacem && (
                                  <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                                    SACEM : {item.title_sacem}
                                  </div>
                                )}
                                {item.cotage_korom && (
                                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    Cotage : {item.cotage_korom}
                                  </span>
                                )}
                              </td>

                              {/* Identifiants COCV & ISWC */}
                              <td className="py-3 px-3 align-top min-w-[180px] space-y-1">
                                <div>
                                  <span className="text-[10px] text-slate-400 font-semibold block">
                                    CODE SACEM (COCV)
                                  </span>
                                  {item.sacem_work_code_korom ? (
                                    <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">
                                      {item.sacem_work_code_korom}
                                    </span>
                                  ) : item.sacem_work_code_sacem ? (
                                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-1 py-0.5 rounded">
                                      {item.sacem_work_code_sacem} (SACEM)
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic">Non renseigné</span>
                                  )}
                                </div>

                                <div>
                                  <span className="text-[10px] text-slate-400 font-semibold block">
                                    ISWC
                                  </span>
                                  {item.iswc_korom ? (
                                    <span className="font-mono text-slate-700 dark:text-slate-300">
                                      {item.iswc_korom}
                                    </span>
                                  ) : item.iswc_sacem ? (
                                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-1 py-0.5 rounded">
                                      {item.iswc_sacem} (SACEM)
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic">Sans ISWC</span>
                                  )}
                                </div>
                              </td>

                              {/* Splits */}
                              <td className="py-3 px-3 align-top min-w-[260px]">
                                {item.splits_korom.length > 0 ? (
                                  <div className="space-y-1">
                                    {item.splits_korom.map((s, idx) => (
                                      <div key={idx} className="flex items-center justify-between text-[11px]">
                                        <span className="truncate max-w-[160px] text-slate-800 dark:text-slate-200">
                                          {s.holder_name}{" "}
                                          <span className="text-slate-400 text-[10px]">({s.role})</span>
                                        </span>
                                        <span className="font-mono font-semibold text-slate-600 dark:text-slate-400">
                                          {Number(s.dep_share_pct).toFixed(2)}%
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : item.splits_sacem.length > 0 ? (
                                  <div className="space-y-1 opacity-75">
                                    {item.splits_sacem.map((s, idx) => (
                                      <div key={idx} className="flex items-center justify-between text-[11px]">
                                        <span className="truncate max-w-[160px] text-slate-600 dark:text-slate-400">
                                          {s.holder_name} ({s.role})
                                        </span>
                                        <span className="font-mono text-slate-500">
                                          {Number(s.dep_share_pct).toFixed(2)}%
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">Aucun split</span>
                                )}
                              </td>

                              {/* Statut & Divergences */}
                              <td className="py-3 px-3 align-top min-w-[240px]">
                                <div className="mb-1.5">
                                  {item.status === "SYNCHRONIZED" && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                      <CheckCircle2 className="h-3 w-3" />
                                      {item.status_label}
                                    </span>
                                  )}
                                  {item.status === "DISCREPANCY" && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                      <AlertTriangle className="h-3 w-3" />
                                      {item.status_label}
                                    </span>
                                  )}
                                  {item.status === "KOROM_ONLY" && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                                      <Building2 className="h-3 w-3" />
                                      {item.status_label}
                                    </span>
                                  )}
                                  {item.status === "SACEM_ONLY" && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                                      <Globe className="h-3 w-3" />
                                      {item.status_label}
                                    </span>
                                  )}
                                </div>

                                {item.discrepancies.length > 0 && (
                                  <ul className="space-y-1">
                                    {item.discrepancies.map((d, dIdx) => (
                                      <li
                                        key={dIdx}
                                        className="text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded border border-slate-200 dark:border-slate-800"
                                      >
                                        {d.message}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Pied de dialogue modal */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="text-xs text-slate-500">
            {report
              ? `${report.total_compared} titres analysés • ${selectedWorkIds.length} sélectionné(s) pour livraison sous-édition.`
              : "Chargez un export pour comparer vos données avec la SACEM."}
          </div>
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
          >
            Fermer le bac à sable
          </button>
        </div>
      </div>

      {/* Modal Paramètres Export Livraison Sous-Éditeur */}
      {showExportModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                {exportMode === "XLSX" ? (
                  <>
                    <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                    Livraison Bordereau Excel Sous-Édition (.xlsx)
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5 text-indigo-600" />
                    Livraison Fichier CWR v2.1 Sous-Édition (.V21)
                  </>
                )}
              </h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Sous-Éditeur Partenaire Destinataire
                </label>
                <input
                  type="text"
                  value={subPublisherName}
                  onChange={(e) => setSubPublisherName(e.target.value)}
                  placeholder="ex: Budde Music Germany, Kassner Music UK..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Territoire Concédé
                </label>
                <input
                  type="text"
                  value={territory}
                  onChange={(e) => setTerritory(e.target.value)}
                  placeholder="ex: Monde entier hors France, GSA, UK..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Référence du Bordereau
                </label>
                <input
                  type="text"
                  value={deliveryRef}
                  onChange={(e) => setDeliveryRef(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notes & Spécificités (optionnel)
                </label>
                <textarea
                  rows={2}
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Instructions de reversement, contrat de référence..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedWorkIds.length} œuvre(s)
                </span>{" "}
                seront incluses dans ce lot de livraison sous-édition normé.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowExportModal(false)}
                className="py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmExport}
                disabled={isExporting}
                className="py-1.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    Télécharger le fichier
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
