"use client";

import { useEffect, useState, useMemo } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  CreditCard,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  GitCompareArrows,
  Info,
  Layers,
  Loader2,
  Lock,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  ConsolidatedCampaignReport,
  ConsolidatedHolderPayout,
  DistributionCampaign,
  SepaExportRequest,
  SepaExportResponse,
  SepaValidationReport,
  StatementRead,
} from "@/types/api";
import {
  attachStatementsToCampaign,
  createCampaign,
  deleteCampaign,
  detachStatementFromCampaign,
  exportCampaignSepa,
  fetchCampaignById,
  fetchCampaignConsolidatedPayouts,
  fetchCampaigns,
  lockCampaign,
  previewCampaignSepa,
} from "@/lib/api";

interface CampaignsConsolidationViewProps {
  statementsList: StatementRead[];
  onRefreshStatements?: () => void;
}

export function CampaignsConsolidationView({
  statementsList,
  onRefreshStatements,
}: CampaignsConsolidationViewProps) {
  const [campaigns, setCampaigns] = useState<DistributionCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [report, setReport] = useState<ConsolidatedCampaignReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [isSepaModalOpen, setIsSepaModalOpen] = useState(false);

  // Formulaire de création de campagne
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignStart, setNewCampaignStart] = useState("2026-01-01");
  const [newCampaignEnd, setNewCampaignEnd] = useState("2026-06-30");
  const [newCampaignNotes, setNewCampaignNotes] = useState("");
  const [newCampaignStatementIds, setNewCampaignStatementIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Clôture comptable
  const [lockReference, setLockReference] = useState("");
  const [lockNotes, setLockNotes] = useState("");
  const [isLocking, setIsLocking] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  // SEPA
  const [sepaReport, setSepaReport] = useState<SepaValidationReport | null>(null);
  const [isSepaLoading, setIsSepaLoading] = useState(false);
  const [isSepaExporting, setIsSepaExporting] = useState(false);
  const [sepaXmlOutput, setSepaXmlOutput] = useState<SepaExportResponse | null>(null);
  const [sepaDebtorName, setSepaDebtorName] = useState("KOROM PUBLISHING SAS");
  const [sepaDebtorIban, setSepaDebtorIban] = useState("FR0830004019920005554443210");
  const [sepaDebtorBic, setSepaDebtorBic] = useState("BNPAFRPPXXX");
  const [sepaRemittance, setSepaRemittance] = useState("KOROM ROYALTIES");
  const [sepaAllowUnverified, setSepaAllowUnverified] = useState(true);
  const [copiedXml, setCopiedXml] = useState(false);

  // Filtres table ayants droit
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PAYABLE" | "BELOW_THRESHOLD" | "RECOUPING">("ALL");
  const [expandedHolders, setExpandedHolders] = useState<Set<string>>(new Set());

  // 1. Charger la liste des campagnes
  async function loadCampaigns(selectId?: string) {
    try {
      setLoading(true);
      const list = await fetchCampaigns();
      setCampaigns(list);

      const targetId = selectId || (list.length > 0 ? (selectedCampaignId && list.some(c => c.id === selectedCampaignId) ? selectedCampaignId : list[0].id) : null);
      setSelectedCampaignId(targetId);

      if (targetId) {
        await loadCampaignReport(targetId);
      } else {
        setReport(null);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Erreur de chargement des campagnes.");
    } finally {
      setLoading(false);
    }
  }

  // 2. Charger le décompte consolidé d'une campagne
  async function loadCampaignReport(campaignId: string) {
    try {
      setCalculating(true);
      const rep = await fetchCampaignConsolidatedPayouts(campaignId);
      setReport(rep);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Erreur lors du calcul consolidé.");
    } finally {
      setCalculating(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  const selectedCampaign = useMemo(() => {
    return campaigns.find((c) => c.id === selectedCampaignId) || null;
  }, [campaigns, selectedCampaignId]);

  // Gestion création campagne
  async function handleCreateCampaign() {
    if (!newCampaignName.trim()) return;
    try {
      setIsCreating(true);
      const created = await createCampaign({
        name: newCampaignName.trim(),
        period_start: newCampaignStart || null,
        period_end: newCampaignEnd || null,
        notes: newCampaignNotes.trim() || null,
        statement_ids: newCampaignStatementIds,
      });
      setIsCreateModalOpen(false);
      setNewCampaignName("");
      setNewCampaignNotes("");
      setNewCampaignStatementIds([]);
      setNotice(`Campagne '${created.name}' créée avec succès.`);
      await loadCampaigns(created.id);
      if (onRefreshStatements) onRefreshStatements();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Échec de création de la campagne.");
    } finally {
      setIsCreating(false);
    }
  }

  // Gestion clôture campagne
  async function handleLockCampaign() {
    if (!selectedCampaignId) return;
    try {
      setIsLocking(true);
      const locked = await lockCampaign(selectedCampaignId, {
        payment_reference: lockReference.trim() || undefined,
        payment_method: "VIREMENT_SEPA",
        payment_notes: lockNotes.trim() || undefined,
      });
      setReport(locked);
      setIsLockModalOpen(false);
      setNotice(`Campagne '${locked.campaign_name}' clôturée et scellée avec succès avec le hash SHA-256.`);
      await loadCampaigns(selectedCampaignId);
      if (onRefreshStatements) onRefreshStatements();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Erreur de clôture de la campagne.");
    } finally {
      setIsLocking(false);
    }
  }

  // Suppression d'une campagne DRAFT
  async function handleDeleteCampaign(campaignId: string) {
    if (!confirm("Voulez-vous vraiment supprimer cette campagne ? Les relevés associés seront simplement détachés.")) return;
    try {
      await deleteCampaign(campaignId);
      setNotice("Campagne supprimée et relevés détachés.");
      await loadCampaigns();
      if (onRefreshStatements) onRefreshStatements();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Échec de suppression.");
    }
  }

  // Détachement d'un relevé
  async function handleDetachStatement(statementId: string) {
    if (!selectedCampaignId) return;
    try {
      await detachStatementFromCampaign(selectedCampaignId, statementId);
      setNotice("Relevé détaché de la campagne.");
      await loadCampaigns(selectedCampaignId);
      if (onRefreshStatements) onRefreshStatements();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Erreur de détachement.");
    }
  }

  // Rattachement de relevés
  async function handleAttachStatements(statementIds: string[]) {
    if (!selectedCampaignId || statementIds.length === 0) return;
    try {
      await attachStatementsToCampaign(selectedCampaignId, statementIds);
      setIsAttachModalOpen(false);
      setNotice(`${statementIds.length} relevé(s) rattaché(s) à la campagne.`);
      await loadCampaigns(selectedCampaignId);
      if (onRefreshStatements) onRefreshStatements();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Erreur de rattachement.");
    }
  }

  // SEPA Modale
  async function openSepaModal() {
    if (!selectedCampaignId) return;
    setIsSepaModalOpen(true);
    setIsSepaLoading(true);
    setSepaXmlOutput(null);
    try {
      const prev = await previewCampaignSepa(selectedCampaignId);
      setSepaReport(prev);
      if (prev.debtor_iban) setSepaDebtorIban(prev.debtor_iban);
      if (prev.debtor_bic) setSepaDebtorBic(prev.debtor_bic);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Erreur prévisualisation SEPA.");
    } finally {
      setIsSepaLoading(false);
    }
  }

  async function handleExportSepaXml() {
    if (!selectedCampaignId) return;
    setIsSepaExporting(true);
    try {
      const payload: SepaExportRequest = {
        debtor_name: sepaDebtorName,
        debtor_iban: sepaDebtorIban,
        debtor_bic: sepaDebtorBic,
        remittance_prefix: sepaRemittance,
        allow_unverified_ibans: sepaAllowUnverified,
      };
      const res = await exportCampaignSepa(selectedCampaignId, payload);
      setSepaXmlOutput(res);

      // Déclencher le téléchargement du fichier XML
      const blob = new Blob([res.xml_content], { type: "application/xml;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = res.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setNotice(`Fichier SEPA XML officiel '${res.filename}' généré et téléchargé.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Erreur lors de la génération SEPA.");
    } finally {
      setIsSepaExporting(false);
    }
  }

  const toggleExpand = (holderKey: string) => {
    setExpandedHolders((prev) => {
      const next = new Set(prev);
      if (next.has(holderKey)) {
        next.delete(holderKey);
      } else {
        next.add(holderKey);
      }
      return next;
    });
  };

  // Filtrage des ayants droit consolidés
  const filteredHolders = useMemo(() => {
    if (!report?.holders_payouts) return [];
    return report.holders_payouts.filter((h) => {
      if (statusFilter !== "ALL" && h.payout_status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = h.holder_name.toLowerCase().includes(q);
        const matchesIpi = h.ipi_number?.includes(q);
        const matchesWork = h.works_breakdown?.some((w) => w.work_title.toLowerCase().includes(q));
        if (!matchesName && !matchesIpi && !matchesWork) return false;
      }
      return true;
    });
  }, [report, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {notice && (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-blue-700 hover:text-blue-900 dark:text-blue-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Barre supérieure : Sélecteur de campagne + Actions */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Campagnes de Répartition Multi-Relevés (SACEM + DSP)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Agrégation semestrielle consolidée de multiples fichiers de ventes • Seuil unique de 50 € et amortissement d'avances global
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {campaigns.length > 0 && (
              <select
                aria-label="Sélectionner une campagne de répartition"
                value={selectedCampaignId || ""}
                onChange={(e) => {
                  setSelectedCampaignId(e.target.value);
                  loadCampaignReport(e.target.value);
                }}
                className="h-9 rounded-lg border bg-background px-3 text-xs font-semibold text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.statements_count} relevé{c.statements_count > 1 ? "s" : ""}) — {c.accounting_status}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Nouvelle Campagne</span>
            </button>

            {selectedCampaign && (
              <button
                type="button"
                onClick={() => loadCampaignReport(selectedCampaign.id)}
                disabled={calculating}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-card px-3 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted"
                title="Recalculer la simulation"
              >
                <RefreshCw className={`h-4 w-4 ${calculating ? "animate-spin text-primary" : ""}`} />
                <span>Actualiser</span>
              </button>
            )}
          </div>
        </div>

        {/* Détails de la campagne active */}
        {selectedCampaign && (
          <div className="mt-4 border-t pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-foreground">{selectedCampaign.name}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">
                  Période : {selectedCampaign.period_start || "N/A"} au {selectedCampaign.period_end || "N/A"}
                </span>
                <span className="text-muted-foreground">•</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    selectedCampaign.accounting_status === "LOCKED"
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800"
                      : selectedCampaign.accounting_status === "PAID"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                  }`}
                >
                  {selectedCampaign.accounting_status === "LOCKED" && <Lock className="h-3 w-3" />}
                  {selectedCampaign.accounting_status === "PAID" && <BadgeCheck className="h-3 w-3" />}
                  {selectedCampaign.accounting_status === "DRAFT" && <Sparkles className="h-3 w-3" />}
                  {selectedCampaign.accounting_status === "LOCKED" ? "CLÔTURÉE & SCELLÉE (SHA-256)" : selectedCampaign.accounting_status === "PAID" ? "RÈGLEMENTS EXÉCUTÉS" : "SIMULATION DRAFT"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedCampaign.accounting_status === "DRAFT" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsAttachModalOpen(true)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs font-semibold text-foreground hover:bg-muted"
                    >
                      <PlusCircle className="h-3.5 w-3.5 text-primary" />
                      <span>Gérer les Relevés ({selectedCampaign.statements_count})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLockReference(`BATCH-SEPA-${selectedCampaign.name.replace(/\s+/g, "-").toUpperCase()}`);
                        setIsLockModalOpen(true);
                      }}
                      disabled={selectedCampaign.statements_count === 0}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-purple-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      <span>Clôturer &amp; Sceller (SHA-256)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCampaign(selectedCampaign.id)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 px-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/30"
                      title="Supprimer la campagne"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={openSepaModal}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      <span>Exporter Virement SEPA XML (pain.001)</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Empreinte SHA-256 si la campagne est verrouillée */}
            {selectedCampaign.integrity_hash && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-purple-200 bg-purple-50/70 p-2.5 text-xs text-purple-950 dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-200">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="font-semibold">Certificat d'intégrité comptable SHA-256 :</span>
                  <code className="font-mono text-[11px] text-purple-800 dark:text-purple-300">
                    {selectedCampaign.integrity_hash}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (selectedCampaign.integrity_hash) {
                      await navigator.clipboard.writeText(selectedCampaign.integrity_hash);
                      setCopiedHash(true);
                      setTimeout(() => setCopiedHash(false), 2000);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] font-semibold text-purple-700 shadow-xs hover:bg-purple-100 dark:bg-purple-900 dark:text-purple-200"
                >
                  {copiedHash ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedHash ? "Copié !" : "Copier le certificat"}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Si aucune campagne */}
      {campaigns.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Layers className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-foreground">Aucune campagne de répartition semestrielle</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
            Créez une première campagne consolidée pour regrouper vos relevés SACEM et DSPs (Spotify, Apple Music, Deezer...) sur une même période semestrielle.
          </p>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Créer la Campagne 2026-S1</span>
          </button>
        </div>
      )}

      {/* Cartes KPI Consolidées */}
      {report && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Brut Consolidé (EUR)
            </div>
            <div className="mt-1 text-xl font-black text-foreground">
              {Number(report.total_campaign_gross).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {report.total_statements_count} relevé{report.total_statements_count > 1 ? "s" : ""} regroupé{report.total_statements_count > 1 ? "s" : ""}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Net Exigible (Payable)
            </div>
            <div className="mt-1 text-xl font-black text-emerald-600 dark:text-emerald-400">
              {Number(report.total_net_payable).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {report.payable_holders_count} ayant{report.payable_holders_count > 1 ? "s" : ""} droit &ge; 50 €
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Avances Amorties
            </div>
            <div className="mt-1 text-xl font-black text-purple-600 dark:text-purple-400">
              {Number(report.total_recouped_in_period).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {report.recouping_count} en cours d'amortissement
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Réserves Reportées (&lt; 50 €)
            </div>
            <div className="mt-1 text-xl font-black text-amber-600 dark:text-amber-400">
              {Number(report.total_retained_in_reserve).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {report.below_threshold_count} solde{report.below_threshold_count > 1 ? "s" : ""} &lt; 50 € conservé{report.below_threshold_count > 1 ? "s" : ""}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Seuil Global 50 €
            </div>
            <div className="mt-1 text-xl font-black text-foreground">
              {report.holders_payouts.length}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {report.payable_holders_count} payables / {report.below_threshold_count} sous seuil
            </div>
          </div>
        </div>
      )}

      {/* Sources regroupées dans la campagne */}
      {selectedCampaign && selectedCampaign.statements.length > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Relevés rattachés à cette campagne ({selectedCampaign.statements.length})
              </h3>
            </div>
            {selectedCampaign.accounting_status === "DRAFT" && (
              <button
                type="button"
                onClick={() => setIsAttachModalOpen(true)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                + Ajouter d'autres relevés
              </button>
            )}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {selectedCampaign.statements.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 text-xs"
              >
                <div className="min-w-0 pr-2">
                  <div className="font-bold text-foreground truncate">{s.source_name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {s.filename || "Relevé manuel"} • {s.period_start} au {s.period_end}
                  </div>
                  <div className="mt-1 font-semibold text-primary">
                    {Number(s.total_gross_amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                    {s.source_currency !== "EUR" && (
                      <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                        ({Number(s.source_gross_amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {s.source_currency})
                      </span>
                    )}
                  </div>
                </div>

                {selectedCampaign.accounting_status === "DRAFT" && (
                  <button
                    type="button"
                    onClick={() => handleDetachStatement(s.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Détacher de la campagne"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tableau des Ayants Droit Consolidés */}
      {report && (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">
                Décomptes Consolidés par Ayant Droit ({filteredHolders.length})
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Barre de recherche */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Rechercher ayant droit, IPI, œuvre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-48 sm:w-64 rounded-lg border bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Filtre statut */}
              <select
                aria-label="Filtrer par statut de paiement"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="h-8 rounded-lg border bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="PAYABLE">Payables (&ge; 50 €)</option>
                <option value="BELOW_THRESHOLD">Sous seuil (&lt; 50 €)</option>
                <option value="RECOUPING">En amortissement</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="w-8 px-3 py-2.5"></th>
                  <th className="px-3 py-2.5">Ayant Droit &amp; Rôle</th>
                  <th className="px-3 py-2.5">Ventilation Multi-Sources</th>
                  <th className="px-3 py-2.5 text-right">Brut Consolidé</th>
                  <th className="px-3 py-2.5 text-right">Avance Amortie</th>
                  <th className="px-3 py-2.5 text-right">Net Exigible</th>
                  <th className="px-3 py-2.5 text-center">Seuil 50 € &amp; Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredHolders.map((h, idx) => {
                  const isExpanded = expandedHolders.has(h.holder_name);
                  const isMultiSource = h.sources_breakdown && h.sources_breakdown.length > 1;
                  const isUnblockedByConsolidation =
                    h.payout_status === "PAYABLE" &&
                    isMultiSource &&
                    h.sources_breakdown.every((s) => Number(s.allocated_gross) < 50);

                  return (
                    <div key={idx} className="contents">
                      <tr className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleExpand(h.holder_name)}
                            className="rounded p-1 text-muted-foreground hover:bg-muted"
                          >
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                        <td className="px-3 py-3 font-medium text-foreground">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold">{h.holder_name}</span>
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {h.role || "N/A"}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {h.ipi_number ? `IPI : ${h.ipi_number}` : "Sans IPI"} • {h.works_count} œuvre{h.works_count > 1 ? "s" : ""}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap items-center gap-1">
                            {h.sources_breakdown.map((sb, sIdx) => (
                              <span
                                key={sIdx}
                                className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                              >
                                <span>{sb.source_name}:</span>
                                <span className="font-bold">{Number(sb.allocated_gross).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                              </span>
                            ))}
                          </div>
                          {isUnblockedByConsolidation && (
                            <div className="mt-1 inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <Sparkles className="h-3 w-3" />
                              <span>Seuil débloqué grâce au cumul SACEM + DSP !</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-foreground">
                          {Number(h.total_gross_allocated).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                        </td>
                        <td className="px-3 py-3 text-right text-purple-600 dark:text-purple-400 font-medium">
                          {Number(h.recouped_in_period) > 0
                            ? `-${Number(h.recouped_in_period).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`
                            : "0,00 €"}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-foreground">
                          {Number(h.net_payable_amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              h.payout_status === "PAYABLE"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                : h.payout_status === "BELOW_THRESHOLD"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                : "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800"
                            }`}
                          >
                            {h.payout_status === "PAYABLE" && <Check className="h-3 w-3" />}
                            {h.payout_status === "BELOW_THRESHOLD" && <AlertCircle className="h-3 w-3" />}
                            {h.payout_status === "RECOUPING" && <Lock className="h-3 w-3" />}
                            {h.payout_status === "PAYABLE"
                              ? "PAYABLE (>= 50 €)"
                              : h.payout_status === "BELOW_THRESHOLD"
                              ? "SOUS SEUIL (< 50 €)"
                              : "AMORTISSEMENT"}
                          </span>
                        </td>
                      </tr>

                      {/* Sous-tableau déroulant des œuvres */}
                      {isExpanded && (
                        <tr className="bg-muted/15">
                          <td colSpan={7} className="px-6 py-3">
                            <div className="rounded-lg border bg-card p-3 shadow-xs">
                              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                Détail consolidé œuvre par œuvre ({h.works_breakdown.length})
                              </h4>
                              <div className="overflow-x-auto">
                                <table className="w-full text-[11px]">
                                  <thead className="border-b text-muted-foreground">
                                    <tr>
                                      <th className="py-1 text-left">Titre Œuvre</th>
                                      <th className="py-1 text-left">ISWC</th>
                                      <th className="py-1 text-left">Droit</th>
                                      <th className="py-1 text-left">Exploitation</th>
                                      <th className="py-1 text-right">Part %</th>
                                      <th className="py-1 text-right">Redevance Allouée</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border/50">
                                    {h.works_breakdown.map((w, wIdx) => (
                                      <tr key={wIdx} className="hover:bg-muted/30">
                                        <td className="py-1.5 font-medium text-foreground">{w.work_title}</td>
                                        <td className="py-1.5 font-mono text-muted-foreground">{w.iswc || "—"}</td>
                                        <td className="py-1.5">{w.right_type}</td>
                                        <td className="py-1.5 text-muted-foreground">{w.exploitation_type}</td>
                                        <td className="py-1.5 text-right">{w.share_percentage} %</td>
                                        <td className="py-1.5 text-right font-semibold text-foreground">
                                          {Number(w.allocated_amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </div>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODALE 1 : CRÉATION D'UNE NOUVELLE CAMPAGNE              */}
      {/* ========================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-xl border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Nouvelle Campagne de Répartition Consolidée
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-foreground">Libellé de la Campagne *</label>
                <input
                  type="text"
                  placeholder="Ex: Campagne Semestrielle 2026-S1 (SACEM + DSPs)"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground">Date de début de période</label>
                  <input
                    type="date"
                    value={newCampaignStart}
                    onChange={(e) => setNewCampaignStart(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground">Date de fin de période</label>
                  <input
                    type="date"
                    value={newCampaignEnd}
                    onChange={(e) => setNewCampaignEnd(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground">Notes / Observations</label>
                <textarea
                  placeholder="Notes de clôture, règles particulières..."
                  value={newCampaignNotes}
                  onChange={(e) => setNewCampaignNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border bg-background p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Sélection des relevés à intégrer */}
              <div>
                <label className="font-semibold text-foreground">
                  Sélectionner les Relevés de Ventes à intégrer ({statementsList.length} disponibles)
                </label>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Cochez les fichiers SACEM et DSPs (Spotify, Apple...) de la période pour consolider les seuils de 50 €.
                </p>

                <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg border p-2 bg-muted/20">
                  {statementsList.map((s) => {
                    const isChecked = newCampaignStatementIds.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center justify-between rounded p-2 cursor-pointer transition ${
                          isChecked ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewCampaignStatementIds((prev) => [...prev, s.id]);
                              } else {
                                setNewCampaignStatementIds((prev) => prev.filter((id) => id !== s.id));
                              }
                            }}
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <div>
                            <div className="font-semibold text-foreground">{s.source_name}</div>
                            <div className="text-[10px] text-muted-foreground">{s.filename || "Relevé"} • {s.period_start} au {s.period_end}</div>
                          </div>
                        </div>
                        <div className="font-bold text-foreground">
                          {Number(s.total_gross_amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="h-8 rounded-lg border px-3 text-xs font-semibold text-foreground hover:bg-muted"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreateCampaign}
                disabled={isCreating || !newCampaignName.trim()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isCreating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Créer la Campagne Consolidée</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODALE 2 : ATTACHEMENT DE RELEVÉS                        */}
      {/* ========================================================= */}
      {isAttachModalOpen && selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-foreground">
                Rattacher des relevés à '{selectedCampaign.name}'
              </h3>
              <button type="button" onClick={() => setIsAttachModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 max-h-60 overflow-y-auto space-y-2 text-xs">
              {statementsList.filter(s => s.campaign_id !== selectedCampaign.id).length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  Tous les relevés disponibles sont déjà rattachés à cette campagne.
                </div>
              ) : (
                statementsList
                  .filter((s) => s.campaign_id !== selectedCampaign.id)
                  .map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border p-2.5">
                      <div>
                        <div className="font-semibold text-foreground">{s.source_name}</div>
                        <div className="text-[11px] text-muted-foreground">{s.filename || "Relevé"} • {s.period_start} au {s.period_end}</div>
                        <div className="font-bold text-primary">{Number(s.total_gross_amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAttachStatements([s.id])}
                        className="h-7 rounded bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                      >
                        Rattacher
                      </button>
                    </div>
                  ))
              )}
            </div>

            <div className="mt-4 flex justify-end border-t pt-3">
              <button
                type="button"
                onClick={() => setIsAttachModalOpen(false)}
                className="h-8 rounded-lg border px-3 text-xs font-semibold text-foreground hover:bg-muted"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODALE 3 : CLÔTURE & SCELLEMENT SHA-256                   */}
      {/* ========================================================= */}
      {isLockModalOpen && selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center gap-2.5 border-b pb-3">
              <Lock className="h-5 w-5 text-purple-600" />
              <h3 className="text-base font-bold text-foreground">
                Clôture Semestrielle &amp; Scellement SHA-256
              </h3>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <p className="text-muted-foreground">
                Vous êtes sur le point de clôturer définitivement la campagne <strong>{selectedCampaign.name}</strong>.
              </p>
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-purple-950 dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-200 space-y-1">
                <div className="font-bold">Effets de la clôture :</div>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  <li>Génération d'une empreinte cryptographique SHA-256 scellant les montants consolidés.</li>
                  <li>Clôture automatique de tous les relevés sources rattachés.</li>
                  <li>Mise à jour définitive des soldes d'avances sur les contrats.</li>
                  <li>Autorisation d'émission du fichier de virement bancaire groupé SEPA pain.001.</li>
                </ul>
              </div>

              <div>
                <label className="font-semibold text-foreground">Référence de lot de virement</label>
                <input
                  type="text"
                  value={lockReference}
                  onChange={(e) => setLockReference(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground">Notes de trésorerie</label>
                <input
                  type="text"
                  placeholder="Ex: Clôture 2026-S1 validée en comité éditorial"
                  value={lockNotes}
                  onChange={(e) => setLockNotes(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => setIsLockModalOpen(false)}
                className="h-8 rounded-lg border px-3 text-xs font-semibold text-foreground hover:bg-muted"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleLockCampaign}
                disabled={isLocking}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-purple-600 px-3 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {isLocking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirmer &amp; Sceller la Campagne</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODALE 4 : EXPORT SEPA XML CONSOLIDÉ                     */}
      {/* ========================================================= */}
      {isSepaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-xl border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-foreground">
                  Télétransmission Bancaire SEPA XML pain.001.001.03
                </h3>
              </div>
              <button type="button" onClick={() => setIsSepaModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {isSepaLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span>Audit pré-vol SEPA en cours...</span>
                </div>
              ) : sepaReport ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border p-3 bg-muted/20">
                      <div className="text-[11px] text-muted-foreground">Montant Total à Virer</div>
                      <div className="text-lg font-bold text-emerald-600">
                        {Number(sepaReport.total_amount_eur).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 bg-muted/20">
                      <div className="text-[11px] text-muted-foreground">Virements Valides</div>
                      <div className="text-lg font-bold text-foreground">
                        {sepaReport.total_valid_recipients} ayant{sepaReport.total_valid_recipients > 1 ? "s" : ""} droit
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 bg-muted/20">
                      <div className="text-[11px] text-muted-foreground">Exclus / Sous Seuil</div>
                      <div className="text-lg font-bold text-amber-600">
                        {sepaReport.total_skipped_recipients} exclus
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-foreground">IBAN Débiteur (Éditeur)</label>
                      <input
                        type="text"
                        value={sepaDebtorIban}
                        onChange={(e) => setSepaDebtorIban(e.target.value.toUpperCase())}
                        className="mt-1 h-8 w-full rounded border bg-background px-2.5 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-foreground">BIC Débiteur</label>
                      <input
                        type="text"
                        value={sepaDebtorBic}
                        onChange={(e) => setSepaDebtorBic(e.target.value.toUpperCase())}
                        className="mt-1 h-8 w-full rounded border bg-background px-2.5 font-mono text-xs"
                      />
                    </div>
                  </div>

                  {sepaXmlOutput && (
                    <div className="rounded-lg border border-emerald-300 bg-emerald-50/50 p-3 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                      <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          Fichier XML pain.001 généré avec succès !
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            if (sepaXmlOutput?.xml_content) {
                              await navigator.clipboard.writeText(sepaXmlOutput.xml_content);
                              setCopiedXml(true);
                              setTimeout(() => setCopiedXml(false), 2000);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-800 shadow-xs hover:bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-100"
                        >
                          {copiedXml ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedXml ? "Copié !" : "Copier XML"}</span>
                        </button>
                      </div>
                      <div className="mt-1 font-mono text-[11px]">
                        Fichier : {sepaXmlOutput.filename} • MsgId : {sepaXmlOutput.message_id}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => setIsSepaModalOpen(false)}
                className="h-8 rounded-lg border px-3 text-xs font-semibold text-foreground hover:bg-muted"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handleExportSepaXml}
                disabled={isSepaExporting || isSepaLoading}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSepaExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                <span>Télécharger le Fichier SEPA XML (.xml)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
