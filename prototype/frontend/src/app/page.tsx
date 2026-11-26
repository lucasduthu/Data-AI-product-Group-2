"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Disc3,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FileUp,
  Info,
  Loader2,
  Power,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import {
  exportCatalogCwr,
  exportCatalogXlsx,
  fetchContracts,
  fetchWorks,
  fetchWorkspaceSettings,
  loadSandboxDemo,
  resetSandbox,
  toggleAiOverrideSwitch,
} from "@/lib/api";
import { ContractRead, WorkRead, WorkspaceSettings } from "@/types/api";

export default function HomePage() {
  const [contracts, setContracts] = useState<ContractRead[]>([]);
  const [works, setWorks] = useState<WorkRead[]>([]);
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  function loadData() {
    setIsLoading(true);
    Promise.allSettled([
      fetchContracts(),
      fetchWorks(),
      fetchWorkspaceSettings(),
    ]).then(([cRes, wRes, sRes]) => {
      if (cRes.status === "fulfilled") setContracts(cRes.value);
      if (wRes.status === "fulfilled") setWorks(wRes.value);
      if (sRes.status === "fulfilled") setSettings(sRes.value);
      setIsLoading(false);
    });
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleLoadDemo() {
    setIsLoadingDemo(true);
    setFeedback(null);
    try {
      await loadSandboxDemo();
      setFeedback("✨ Jeu de démonstration chargé : contrats PDF, œuvres et clés CWR prêts.");
      loadData();
    } catch (err: any) {
      setFeedback(`Erreur : ${err.message || err}`);
    } finally {
      setIsLoadingDemo(false);
    }
  }

  async function handleReset() {
    setIsResetting(true);
    setFeedback(null);
    try {
      await resetSandbox();
      setFeedback("Base remise à zéro (0 contrat, 0 œuvre).");
      loadData();
    } catch (err: any) {
      setFeedback(`Erreur : ${err.message || err}`);
    } finally {
      setIsResetting(false);
    }
  }

  async function handleQuickExportCwr() {
    try {
      const res = await exportCatalogCwr();
      const blob = new Blob([res.content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename || "CW26_CATALOGUE_SACEM.V21";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setFeedback(
        `✅ Export CWR v2.1 téléchargé (${res.included_works_count} œuvre(s) conforme(s), ${res.skipped_works_count} bloquée(s) par le Policy Checker).`
      );
    } catch (err: any) {
      setFeedback(`Erreur export CWR : ${err.message || err}`);
    }
  }

  async function handleQuickExportXlsx() {
    try {
      await exportCatalogXlsx();
      setFeedback("📊 Classeur Excel (.xlsx) de visibilité téléchargé avec succès.");
    } catch (err: any) {
      setFeedback(`Erreur export Excel : ${err.message || err}`);
    }
  }

  const pendingContracts = contracts.filter((c) => c.validation_status === "PENDING_REVIEW");
  const validatedContracts = contracts.filter((c) => c.validation_status === "VALIDATED");
  const cwrReadyWorks = works.filter((w) => w.cwr_validation?.is_cwr_ready);
  const cwrBlockedWorks = works.filter((w) => w.cwr_validation && !w.cwr_validation.is_cwr_ready);
  const isDeterministicOnly = settings?.openrouter_model?.toLowerCase() === "deterministic";

  return (
    <div className="space-y-8 pb-12">
      {/* En-tête du Produit IA */}
      <div className="flex flex-col items-center justify-center text-center space-y-3 pt-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Korom AI Product • Du Contrat PDF au Fichier CWR SACEM &amp; Excel (.xlsx)</span>
        </div>

        <h1 className="font-micro text-[38px] font-bold tracking-tight text-foreground leading-none">
          Contract-to-CWR Copilot
        </h1>

        <p className="max-w-2xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Téléversez un contrat de cession et d&apos;édition musicale au format PDF : le Copilot extrait les œuvres,
          les ayants droit, les codes IPI et les clés de répartition (DEP, DRM, SYNC, PHONO) avec citations verbatim,
          vérifie déterministement l&apos;équilibre à 100.00 %, et génère votre fichier <strong>CWR v2.1 (.V21)</strong> pour la SACEM ainsi qu&apos;un tableau <strong>Excel (.xlsx)</strong> de visibilité.
        </p>

        {/* Actions rapides de démo et d'export */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
          <Link
            href="/contracts"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <FileUp className="h-4 w-4" />
            <span>1. Importer &amp; Extraire un Contrat PDF</span>
          </Link>

          <button
            type="button"
            onClick={handleQuickExportCwr}
            disabled={cwrReadyWorks.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <FileCode2 className="h-4 w-4" />
            <span>Exporter CWR SACEM (.V21) ({cwrReadyWorks.length})</span>
          </button>

          <button
            type="button"
            onClick={handleQuickExportXlsx}
            disabled={works.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-500/20 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Exporter Visibilité (.xlsx) ({works.length})</span>
          </button>

          {works.length === 0 && contracts.length === 0 ? (
            <button
              type="button"
              disabled={isLoadingDemo}
              onClick={handleLoadDemo}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-card px-3.5 py-2 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            >
              {isLoadingDemo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>Charger Contrats &amp; Œuvres Démo</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isResetting}
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-card px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Vider la base</span>
            </button>
          )}
        </div>

        {feedback && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            {feedback}
          </div>
        )}
      </div>

      {/* Pipeline Visuel en 4 Étapes (Architecture Class 4 : Rung 1 -> Rung 3 -> Rung 1 Gate -> ⊘ L2 -> Export) */}
      <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Pipeline d&apos;Architecture IA &amp; Garde-Fous Déterministes
            </h2>
            <p className="text-xs text-muted-foreground">
              Séparation stricte entre extraction sémantique (LLM Rung 3) et validation mathématique/statutaire SACEM (Rung 1 Gate)
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              isDeterministicOnly
                ? "bg-amber-500/15 text-amber-800 border border-amber-500/40"
                : "bg-emerald-500/10 text-emerald-800 border border-emerald-500/30"
            }`}
          >
            <Power className="h-3.5 w-3.5" />
            {isDeterministicOnly
              ? "⏻ Override Switch Actif : Parseur Regex Déterministe (Rung 1)"
              : "Mode Nominal : OpenRouter Claude 3.5 Sonnet (Rung 3) + Fallback Rung 1"}
          </span>
        </div>

        <div className="grid gap-3.5 md:grid-cols-4">
          {/* Étape 1 */}
          <div className="rounded-xl border bg-muted/20 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="rounded bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
                ÉTAPE 1 · RUNG 1 + RUNG 3
              </span>
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-xs font-bold text-foreground">
              1. Ingestion PDF &amp; Extraction Structurée
            </h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Lecture du PDF (<code className="font-mono">pypdf</code>), détection du type d&apos;acte (Cession, Co-édition, LAI) et extraction JSON via LLM avec <strong>citations verbatim</strong> de chaque clause.
            </p>
          </div>

          {/* Étape 2 */}
          <div className="rounded-xl border bg-muted/20 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="rounded bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-800">
                ÉTAPE 2 · RUNG 1 GATE
              </span>
              <ShieldCheck className="h-4 w-4 text-amber-700" />
            </div>
            <h3 className="text-xs font-bold text-foreground">
              2. Policy Checker CWR (100.00 %)
            </h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Vérificateur mathématique en <code className="font-mono">Decimal</code> : contrôle que <code className="font-mono">DEP = 100%</code>, <code className="font-mono">DRM = 100%</code>, plafond éditeur ≤ 50% et format IPI (9–11 chiffres). Zéro hallucination arithmétique.
            </p>
          </div>

          {/* Étape 3 */}
          <div className="rounded-xl border bg-muted/20 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="rounded bg-purple-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-800">
                ÉTAPE 3 · CHECKPOINT ⊘ (L2)
              </span>
              <Users className="h-4 w-4 text-purple-700" />
            </div>
            <h3 className="text-xs font-bold text-foreground">
              3. Validation Humaine &amp; Création d&apos;Œuvres
            </h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Le gestionnaire de copyright vérifie les jauges d&apos;équilibre, ajuste en 1 clic si nécessaire et valide : les œuvres et fiches ayants droit sont créées au catalogue.
            </p>
          </div>

          {/* Étape 4 */}
          <div className="rounded-xl border bg-muted/20 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
                ÉTAPE 4 · LIVRABLES SACEM
              </span>
              <FileCode2 className="h-4 w-4 text-emerald-700" />
            </div>
            <h3 className="text-xs font-bold text-foreground">
              4. Export CWR (.V21) &amp; Excel (.xlsx)
            </h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Sérialisation conforme à la norme CISAC CWR v2.1 (<code className="font-mono">HDR/NWR/SPU/SWR/TRL</code>) pour dépôt SACEM et export Excel (<code className="font-mono">.xlsx</code>) pour visibilité immédiate.
            </p>
          </div>
        </div>
      </div>

      {/* 3 Cartes KPI Opérationnelles */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Carte 1 : Contrats à valider */}
        <div className="flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-xs">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                <Clock className="h-3.5 w-3.5" />
                Contrats en revue (⊘ L2)
              </span>
              <span className="font-micro text-2xl font-bold text-foreground">
                {pendingContracts.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingContracts.length > 0
                ? `${pendingContracts.length} contrat(s) extrait(s) en attente d'approbation humaine avant création des œuvres.`
                : `${validatedContracts.length} contrat(s) validé(s). Déposez un nouveau PDF pour extraire ses œuvres.`}
            </p>
          </div>
          <Link
            href="/contracts"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
          >
            <span>Aller à l&apos;extraction &amp; revue des contrats</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Carte 2 : Œuvres Prêtes CWR (.V21) */}
        <div className="flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-xs">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Œuvres Prêtes CWR 2.1
              </span>
              <span className="font-micro text-2xl font-bold text-emerald-700">
                {cwrReadyWorks.length} / {works.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Œuvres ayant passé le Policy Checker (DEP = 100.00 %, DRM = 100.00 %, codes IPI valides) et exportables immédiatement en CWR (.V21) et Excel (.xlsx).
            </p>
          </div>
          <Link
            href="/catalog?filter=A_DEPOSER"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline"
          >
            <span>Voir &amp; exporter les œuvres prêtes</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Carte 3 : Alertes & Conflits CWR interceptés */}
        <div className="flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-xs">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-bold text-rose-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                Bloquées par le Gate CWR
              </span>
              <span className="font-micro text-2xl font-bold text-rose-700">
                {cwrBlockedWorks.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {cwrBlockedWorks.length > 0
                ? `${cwrBlockedWorks.length} œuvre(s) interceptée(s) avant rejet SACEM (écart de quote-part ou code IPI manquant).`
                : "Aucune anomalie bloquante détectée sur le catalogue actif."}
            </p>
          </div>
          <Link
            href="/catalog?filter=INFORMATIONS_MANQUANTES"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:underline"
          >
            <span>Inspecter et corriger les anomalies</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
