"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Circle,
  Database,
  Disc3,
  Eye,
  EyeOff,
  FileText,
  FileUp,
  GitCompareArrows,
  HelpCircle,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { loadSandboxDemo, resetSandbox, updateOnboardingState } from "@/lib/api";
import { DashboardSummary, WorkspaceSettings } from "@/types/api";

export interface OnboardingWizardProps {
  summary: DashboardSummary;
  settings?: WorkspaceSettings | null;
  isDismissed: boolean;
  onToggleDismiss: (dismissed: boolean) => void;
  onRefreshData: () => void;
}

export function OnboardingWizard({
  summary,
  settings,
  isDismissed,
  onToggleDismiss,
  onRefreshData,
}: OnboardingWizardProps) {
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Détection dynamique et collaborative des 4 étapes d'onboarding
  const completedSteps = settings?.onboarding_completed_steps || [];

  const isIdentityComplete = Boolean(
    completedSteps.includes("step_identity") ||
      (settings?.onboarding_completed &&
        settings?.publisher_name &&
        settings?.publisher_ipi &&
        settings?.publisher_ipi.length >= 9)
  );

  const isCatalogComplete =
    summary.total_works > 0 || completedSteps.includes("step_catalog");
  const isContractsComplete =
    summary.total_contracts > 0 || completedSteps.includes("step_contracts");
  const isSimulationComplete =
    summary.total_statements > 0 || completedSteps.includes("step_simulation");

  const steps = [
    {
      id: "step_identity",
      number: "1",
      title: "Identité Éditeur",
      subtitle: "Nom légal, Code IPI 11 chiffres & IBAN/BIC débiteur SEPA",
      status: isIdentityComplete ? "DONE" : "TODO",
      badge: isIdentityComplete ? "Configuré" : "Étape clé",
      icon: Building2,
      actionHref: "/settings",
      actionText: "Configurer mon identité",
      completedText: "Vérifier mon identité",
    },
    {
      id: "step_catalog",
      number: "2",
      title: "Ingestion Catalogue",
      subtitle: "Import 1-clic SACEM .csv / .xlsx (création des œuvres & ayants droit)",
      status: isCatalogComplete ? "DONE" : "TODO",
      badge: isCatalogComplete ? `${summary.total_works} œuvre(s)` : "Recommandé",
      icon: Disc3,
      actionHref: "/catalog?import=sacem",
      actionText: "Importer mon catalogue SACEM",
      completedText: "Consulter le catalogue",
    },
    {
      id: "step_contracts",
      number: "3",
      title: "Liasses & Contrats",
      subtitle: "Dépôt PDF ou CGP1 avec extraction IA Human-in-the-loop",
      status: isContractsComplete ? "DONE" : "TODO",
      badge: isContractsComplete ? `${summary.total_contracts} contrat(s)` : "Priorité",
      icon: FileText,
      actionHref: "/contracts",
      actionText: "Téléverser un contrat PDF",
      completedText: "Consulter les contrats",
    },
    {
      id: "step_simulation",
      number: "4",
      title: "Première Simulation",
      subtitle: "Chargement d'un relevé test DSP, répartition, seuil 50 € & Grand Livre",
      status: isSimulationComplete ? "DONE" : "TODO",
      badge: isSimulationComplete ? `${summary.total_statements} relevé(s)` : "Financier",
      icon: GitCompareArrows,
      actionHref: "/reconciliation",
      actionText: "Lancer une simulation",
      completedText: "Consulter les décomptes",
    },
  ];

  const completedStepsCount = steps.filter((s) => s.status === "DONE").length;
  const progressPct = Math.round((completedStepsCount / 4) * 100);

  async function handleToggleStep(stepId: string) {
    const isCurrentlyDone = steps.find((s) => s.id === stepId)?.status === "DONE";
    let updatedSteps = [...completedSteps];
    if (isCurrentlyDone) {
      updatedSteps = updatedSteps.filter((id) => id !== stepId);
    } else {
      if (!updatedSteps.includes(stepId)) {
        updatedSteps.push(stepId);
      }
    }
    try {
      await updateOnboardingState({
        completed: updatedSteps.length === 4,
        completed_steps: updatedSteps,
      });
      onRefreshData();
    } catch (err: any) {
      console.error("Erreur toggle étape onboarding:", err);
    }
  }

  async function handleLoadDemo() {
    setIsLoadingDemo(true);
    setFeedback(null);
    try {
      const res = await loadSandboxDemo();
      setFeedback("✨ Catalogue de démonstration chargé : 30 œuvres, projets TF1 et contrats prêts !");
      await updateOnboardingState({ completed: true, dismissed: false });
      onRefreshData();
    } catch (err: any) {
      setFeedback(`Erreur lors du chargement démo : ${err.message || err}`);
    } finally {
      setIsLoadingDemo(false);
    }
  }

  async function handleResetSandbox() {
    setIsResetting(true);
    setFeedback(null);
    try {
      await resetSandbox();
      setFeedback("Base de données remise à zéro (0 œuvre, 0 contrat, 0 ayant droit).");
      await updateOnboardingState({ completed: false, dismissed: false, completed_steps: [] });
      setIsResetModalOpen(false);
      onRefreshData();
    } catch (err: any) {
      setFeedback(`Erreur lors de la réinitialisation : ${err.message || err}`);
    } finally {
      setIsResetting(false);
    }
  }

  async function handleToggleHide() {
    const nextState = !isDismissed;
    onToggleDismiss(nextState);
    try {
      await updateOnboardingState({ dismissed: nextState });
    } catch {
      // Ignoré si offline
    }
  }

  // Version compacte repliée
  if (isDismissed) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2.5 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="text-xs">
            <span className="font-bold text-foreground">Assistant de démarrage Korom :</span>{" "}
            <span className="text-muted-foreground font-medium">
              {completedStepsCount} / 4 étapes franchies ({progressPct}%)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleHide}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-2xs"
          >
            <Eye className="h-3.5 w-3.5 text-primary" />
            <span>Rouvrir l&apos;assistant</span>
          </button>

          <button
            type="button"
            disabled={isLoadingDemo}
            onClick={handleLoadDemo}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            {isLoadingDemo ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span>Mode Démo (30 œuvres)</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-card via-card to-primary/5 p-5 sm:p-7 shadow-xs">
      {/* En-tête de l'Assistant */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <Sparkles className="h-4 w-4" />
            </span>
            <h2 className="font-micro text-lg sm:text-xl font-bold tracking-tight text-foreground">
              Assistant de Démarrage & Première Prise en Main
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Suivez ces 4 étapes simples pour configurer votre identité, charger vos œuvres et valider vos premiers décomptes.
          </p>
        </div>

        {/* Contrôles Sandbox & Visibilité */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isLoadingDemo}
            onClick={handleLoadDemo}
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 shadow-2xs"
            title="Charger un jeu de test complet (30 œuvres, séries TV TF1, ayants droit, contrats et relevé DSP)"
          >
            {isLoadingDemo ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Database className="h-3.5 w-3.5" />
            )}
            <span>Charger le catalogue d&apos;exemple</span>
          </button>

          <button
            type="button"
            onClick={() => setIsResetModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-500/10 hover:border-rose-500/30 transition-colors shadow-2xs"
            title="Remettre la base de données à zéro (base vierge)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Vider le bac à sable</span>
          </button>

          <button
            type="button"
            onClick={handleToggleHide}
            className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Masquer l'assistant de démarrage"
          >
            <EyeOff className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Barre de Progression */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground">
            Progression : {completedStepsCount} sur 4 étapes terminées
          </span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
            {progressPct}%
          </span>
        </div>
        <div className="h-2 w-full sm:w-64 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {feedback && (
        <div className="mt-3.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-medium text-foreground">
          {feedback}
        </div>
      )}

      {/* Les 4 Cartes d'Étapes Interactives */}
      <div className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((st) => {
          const Icon = st.icon;
          const isDone = st.status === "DONE";

          return (
            <div
              key={st.id}
              className={`flex flex-col justify-between rounded-2xl border p-4 transition-all shadow-2xs ${
                isDone
                  ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50"
                  : "border-border/80 bg-card hover:border-primary/50"
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleToggleStep(st.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-transform active:scale-95 cursor-pointer ${
                      isDone
                        ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/25"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                    title={isDone ? "Cliquer pour marquer cette étape comme à revoir" : "Cliquer pour valider manuellement cette étape"}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Circle className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span>Étape {st.number}</span>
                  </button>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {st.badge}
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <div
                    className={`rounded-xl p-2 shrink-0 ${
                      isDone
                        ? "bg-emerald-500/15 text-emerald-700"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-foreground">
                      {st.title}
                    </h3>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      {st.subtitle}
                    </p>
                  </div>
                </div>
              </div>

              <Link
                href={st.actionHref}
                className={`mt-4 inline-flex items-center justify-between rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isDone
                    ? "bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                <span>{isDone ? st.completedText : st.actionText}</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </div>
          );
        })}
      </div>

      {/* Modal de Confirmation Réinitialisation Bac à Sable */}
      <ConfirmDeleteModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleResetSandbox}
        title="Vider intégralement le bac à sable"
        itemName="Toutes les œuvres, contrats, ayants droit et relevés"
        description="Attention : cette action purgera l'intégralité des données synthétiques ou réelles de la base locale pour repartir d'un catalogue 100 % vierge. Cette opération est immédiate et irréversible."
        confirmText="Vider et repartir à zéro"
        isDeleting={isResetting}
      />
    </div>
  );
}
