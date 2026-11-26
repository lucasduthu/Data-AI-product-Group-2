"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  BadgeCheck,
  Calculator,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Coins,
  Copy,
  CreditCard,
  Disc3,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  GitCompareArrows,
  Globe2,
  Info,
  Layers,
  Loader2,
  Lock,
  MessageSquarePlus,
  Play,
  PlusCircle,
  Printer,
  Receipt,
  RotateCcw,
  ScrollText,
  Search,
  ShieldCheck,
  Sparkles,
  Unlock,
  Users,
  Wand2,
  X,
} from "lucide-react";
import {
  ConfidenceBadge,
  ValidationStatusBadge,
} from "@/components/confidence-badge";
import { HolderInvoiceModal } from "@/components/holder-invoice-modal";
import { HolderStatementModal } from "@/components/holder-statement-modal";
import { BlackBoxCreateModal } from "@/components/reconciliation/black-box-create-modal";
import { CampaignsConsolidationView } from "@/components/reconciliation/campaigns-consolidation-view";
import { EmptyState } from "@/components/empty-state";
import {
  computeStatementRoyalties,
  exportStatementSepaXml,
  fetchCurrencyParities,
  fetchHolderIndividualStatement,
  fetchStatementHolderInvoice,
  fetchStatementSepaPreview,
  fetchStatements,
  fetchWorks,
  loadSandboxDemo,
  loadStressTestSample,
  lockAndPostStatementRoyalties,
  markStatementAsPaid,
  reopenStatementToDraft,
  submitPocUserFeedback,
  uploadStatementCsv,
  validateHighConfidenceLines,
  validateStatementLine,
} from "@/lib/api";
import {
  AdvanceRecoupmentState,
  CurrencyRateItem,
  MarkStatementPaidPayload,
  ReadyToUseInvoicePayload,
  RoyaltyRunReport,
  SepaExportRequest,
  SepaExportResponse,
  SepaPayeeSummary,
  SepaSkippedPayeeSummary,
  SepaValidationReport,
  StatementLineMatch,
  StatementLockPayload,
  StatementRead,
  WorkRead,
} from "@/types/api";

function MatchMethodBadge({ method }: { method: string }) {
  if (method === "EXACT_ISWC") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
        <Check className="h-2.5 w-2.5 text-emerald-600" />
        EXACT_ISWC
      </span>
    );
  }
  if (method === "EXACT_SACEM_CODE") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-indigo-500/10 border border-indigo-500/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-800 dark:text-indigo-300">
        <Check className="h-2.5 w-2.5 text-indigo-600" />
        EXACT_COCV
      </span>
    );
  }
  if (method === "EXACT_ISRC") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-teal-500/10 border border-teal-500/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-teal-800 dark:text-teal-300">
        <Check className="h-2.5 w-2.5 text-teal-600" />
        EXACT_ISRC
      </span>
    );
  }
  if (method === "EMBEDDING_VECTOR") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 border border-purple-500/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-purple-800">
        <Sparkles className="h-2.5 w-2.5 text-purple-600" />
        VECTEUR IA
      </span>
    );
  }
  if (method === "LEARNED_ALIAS") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-800">
        ALIAS MÉMORISÉ
      </span>
    );
  }
  if (method === "FUZZY_LEXICAL" || method === "FUZZY_STRING") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-800">
        LEXICAL
      </span>
    );
  }
  return (
    <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
      {method}
    </span>
  );
}

const DEMO_WORKS_OPTIONS: { id: string; title: string; iswc: string | null }[] = [
  {
    id: "11111111-1111-1111-1111-111111111101",
    title: "Lumière Noire",
    iswc: "T-301.452.891-4",
  },
  {
    id: "11111111-1111-1111-1111-111111111103",
    title: "Minuit sur la Seine",
    iswc: "T-302.118.440-2",
  },
  {
    id: "11111111-1111-1111-1111-111111111104",
    title: "Horizon Véloce",
    iswc: "T-303.774.129-8",
  },
  {
    id: "11111111-1111-1111-1111-111111111105",
    title: "Traversée Nocturne",
    iswc: "T-306.100.201-1",
  },
];

const DEMO_STATEMENT: StatementRead = {
  id: "33333333-3333-3333-3333-333333333301",
  source_name: "SACEM Répartition 2026-Q3 & DSP",
  filename: "sacem_repartition_2026Q3.csv",
  period_start: "2026-07-01",
  period_end: "2026-09-30",
  total_gross_amount: "19180.75",
  validated_gross_amount: "4250.00",
  pending_gross_amount: "14930.75",
  lines_count: 5,
  validated_lines_count: 1,
  currency: "EUR",
  accounting_status: "DRAFT",
  created_at: "2026-10-22T12:00:00Z",
  lines: [
    {
      id: "44444444-4444-4444-4444-444444444401",
      statement_id: "33333333-3333-3333-3333-333333333301",
      row_number: 1,
      raw_work_title: "LUMIERE NOIRE",
      raw_iswc: "T-301.452.891-4",
      raw_isrc: "FRZ012600101",
      raw_performer: "Camille Moreau",
      right_type: "DEP",
      exploitation_type: "PUBLIC_PERFORMANCE",
      territory: "FR",
      units: 48200,
      gross_amount: "4250.00",
      currency: "EUR",
      matched_work_id: "11111111-1111-1111-1111-111111111101",
      matched_work_title: "Lumière Noire",
      match_method: "EXACT_ISWC",
      match_reasoning:
        "Identifiant ISWC exact (T-301.452.891-4) reconnu sans ambiguïté → Clé déterministe DEP : 50.00% Camille Moreau (AC, retenu sur avance CTR-2026-LN01) / 50.00% Éditions Solstices Music (E).",
      confidence_score: 1.0,
      validation_status: "VALIDATED",
      validated_by: "royalty.manager@solstices-music.fr",
      validated_at: "2026-10-22T12:00:00Z",
      review_notes: null,
      top_match: null,
      alternatives: [],
      allocations: [
        {
          holder_name: "Camille Moreau",
          role: "AC",
          ipi_number: "00458912301",
          right_type: "DEP",
          share_percentage: "50.00",
          allocated_amount: "2125.00",
          recouped_amount: "2125.00",
          net_payable_amount: "0.00",
        },
        {
          holder_name: "Éditions Solstices Music",
          role: "E",
          ipi_number: "00891234567",
          right_type: "DEP",
          share_percentage: "50.00",
          allocated_amount: "2125.00",
          recouped_amount: "0.00",
          net_payable_amount: "2125.00",
        },
      ],
    },
    {
      id: "44444444-4444-4444-4444-444444444402",
      statement_id: "33333333-3333-3333-3333-333333333301",
      row_number: 2,
      raw_work_title: "Lumiere Noir (Feat. K-Soprano) - Radio Edit",
      raw_iswc: null,
      raw_isrc: null,
      raw_performer: "Camille Moreau feat K",
      right_type: "DRM",
      exploitation_type: "STREAMING",
      territory: "FR",
      units: 915000,
      gross_amount: "3180.50",
      currency: "EUR",
      matched_work_id: "11111111-1111-1111-1111-111111111101",
      matched_work_title: "Lumière Noire",
      match_method: "EMBEDDING_VECTOR",
      match_reasoning:
        "ISWC absent & titre tronqué ('Lumiere Noir') • Rejeté par Le Sage / Vistex → Rattrapé par similarité vectorielle Fastembed (92%) + lexicale (90%) → Clé DRM 50.00% AC / 50.00% Éditeur.",
      confidence_score: 0.91,
      validation_status: "PENDING_REVIEW",
      validated_by: null,
      validated_at: null,
      review_notes: null,
      top_match: null,
      alternatives: [
        {
          work_id: "11111111-1111-1111-1111-111111111101",
          work_title: "Lumière Noire",
          iswc: "T-301.452.891-4",
          performers: ["Camille Moreau"],
          cosine_similarity: 0.92,
          lexical_similarity: 0.9,
          combined_confidence: 0.91,
          match_method: "EMBEDDING_VECTOR",
        },
      ],
      allocations: [],
    },
    {
      id: "44444444-4444-4444-4444-444444444403",
      statement_id: "33333333-3333-3333-3333-333333333301",
      row_number: 3,
      raw_work_title: "Minuit s/ la Seine (Live TV)",
      raw_iswc: null,
      raw_isrc: null,
      raw_performer: "Lea Vasseur",
      right_type: "DEP",
      exploitation_type: "PUBLIC_PERFORMANCE",
      territory: "FR",
      units: 12400,
      gross_amount: "1890.00",
      currency: "EUR",
      matched_work_id: "11111111-1111-1111-1111-111111111103",
      matched_work_title: "Minuit sur la Seine",
      match_method: "FUZZY_STRING",
      match_reasoning:
        "Abréviation 's/' sans ISWC • Clé déterministe 3 ayants droit : 25.00% Léa Vasseur (A) / 25.00% Julien Delacroix (C) / 50.00% Éditions Solstices (E).",
      confidence_score: 0.82,
      validation_status: "PENDING_REVIEW",
      validated_by: null,
      validated_at: null,
      review_notes: null,
      top_match: null,
      alternatives: [],
      allocations: [],
    },
    {
      id: "44444444-4444-4444-4444-444444444405",
      statement_id: "33333333-3333-3333-3333-333333333301",
      row_number: 4,
      raw_work_title: "Minuit sur la Seine - Synchro Série Canal+",
      raw_iswc: "T-302.118.440-2",
      raw_isrc: "FRZ012600201",
      raw_performer: "Léa Vasseur",
      right_type: "SYNC",
      exploitation_type: "SYNCHRONIZATION",
      territory: "WORLD",
      units: 1,
      gross_amount: "4500.00",
      currency: "EUR",
      matched_work_id: "11111111-1111-1111-1111-111111111103",
      matched_work_title: "Minuit sur la Seine",
      match_method: "EXACT_ISWC",
      match_reasoning:
        "Code ISWC T-302.118.440-2 exact • Droit direct Synchronisation (SYNC) → Clé déterministe SYNC : 25.00% Auteur / 25.00% Compositeur / 50.00% Éditeur.",
      confidence_score: 1.0,
      validation_status: "PENDING_REVIEW",
      validated_by: null,
      validated_at: null,
      review_notes: null,
      top_match: null,
      alternatives: [],
      allocations: [],
    },
    {
      id: "44444444-4444-4444-4444-444444444404",
      statement_id: "33333333-3333-3333-3333-333333333301",
      row_number: 5,
      raw_work_title: "TRV NOCT (MASTER SCPP / PHONO)",
      raw_iswc: null,
      raw_isrc: "FRZ012600601",
      raw_performer: "C. Silvestre",
      right_type: "PHONO",
      exploitation_type: "PHONO_MASTER",
      territory: "FR",
      units: 3200,
      gross_amount: "960.25",
      currency: "EUR",
      matched_work_id: "11111111-1111-1111-1111-111111111105",
      matched_work_title: "Traversée Nocturne",
      match_method: "EMBEDDING_VECTOR",
      match_reasoning:
        "Titre abrégé 'TRV NOCT' (< 65%) signalé pour arbitrage humain obligatoire → Clé PHONO Master : 80.00% Producteur (P) / 20.00% Artiste-Interprète (I).",
      confidence_score: 0.58,
      validation_status: "PENDING_REVIEW",
      validated_by: null,
      validated_at: null,
      review_notes: null,
      top_match: null,
      alternatives: [],
      allocations: [],
    },
  ],
};

const INITIAL_ROYALTY_REPORT: RoyaltyRunReport = {
  statement_id: "33333333-3333-3333-3333-333333333301",
  source_name: "SACEM Répartition 2026-Q3 & DSP",
  accounting_status: "DRAFT",
  is_locked: false,
  total_statement_gross: "19180.75",
  total_validated_gross: "4250.00",
  total_pending_review_gross: "14930.75",
  total_allocated_checksum: "4250.00",
  total_recouped_in_period: "2125.00",
  total_net_payable: "2125.00",
  total_retained_in_reserve: "35.00",
  below_threshold_count: 1,
  validated_lines_processed: 1,
  pending_lines_skipped: 4,
  holder_statements: [
    {
      right_holder_id: "55555555-5555-5555-5555-555555555501",
      holder_name: "Camille Moreau",
      role: "AC",
      ipi_number: "00458912301",
      contract_id: "22222222-2222-2222-2222-222222222201",
      contract_reference: "CTR-2026-LN01",
      entity_type: "PERSONNE_PHYSIQUE",
      legal_form: "Artiste-Auteur (Précompte IRCEC/URSSAF)",
      siret: null,
      vat_number: null,
      vat_applicable: false,
      vat_rate_pct: "0.00",
      vat_amount: "0.00",
      ircec_precompte_applicable: true,
      urssaf_dispense_certificate: false,
      iban: "FR76 3000 4008 0100 0123 4567 891",
      bic: "BNPAFRPPXXX",
      gross_royalties_allocated: "2125.00",
      initial_advance: "15000.00",
      previously_recouped: "3200.00",
      recouped_in_period: "2125.00",
      remaining_unrecouped_balance: "9675.00",
      taxable_base_ht: "0.00",
      precompte_ircec_amount: "0.00",
      precompte_social_amount: "0.00",
      net_payable_amount: "0.00",
      payout_status: "RECOUPING",
      carried_forward_to_next: "9675.00",
      legal_mention_applied:
        "Solde débiteur reporté à nouveau sur les prochaines répartitions conformément aux conditions particulières du contrat de cession.",
      e_invoicing_status: "NOTE DROITS D'AUTEUR (PRÉCOMPTE SOCIAL)",
      works_count: 1,
      works_breakdown: [
        {
          work_id: "11111111-1111-1111-1111-111111111101",
          work_title: "Lumière Noire",
          iswc: "T-301.452.891-4",
          right_type: "DEP",
          exploitation_type: "PUBLIC_PERFORMANCE",
          gross_line_amount: "4250.00",
          share_percentage: "50.00",
          allocated_amount: "2125.00",
        },
      ],
    },
    {
      right_holder_id: "55555555-5555-5555-5555-555555555502",
      holder_name: "Léa Vasseur",
      role: "A",
      ipi_number: "00512398741",
      contract_id: null,
      contract_reference: null,
      entity_type: "PERSONNE_PHYSIQUE",
      legal_form: "Artiste-Auteur (Précompte IRCEC/URSSAF)",
      siret: null,
      vat_number: null,
      vat_applicable: false,
      vat_rate_pct: "0.00",
      vat_amount: "0.00",
      ircec_precompte_applicable: true,
      urssaf_dispense_certificate: false,
      iban: "FR76 1027 8060 3200 0987 6543 218",
      bic: "CMCIFR2AXXX",
      gross_royalties_allocated: "1890.00",
      initial_advance: "0.00",
      previously_recouped: "0.00",
      recouped_in_period: "0.00",
      remaining_unrecouped_balance: "0.00",
      taxable_base_ht: "1890.00",
      precompte_ircec_amount: "209.79",
      precompte_social_amount: "209.79",
      payout_status: "PAYABLE",
      net_payable_amount: "1890.00",
      legal_mention_applied:
        "Règlement effectué par virement bancaire sous réserve d'encaissement et déduction faite des cotisations sociales et précomptes légaux.",
      e_invoicing_status: "NOTE DROITS D'AUTEUR (PRÉCOMPTE SOCIAL)",
      works_count: 1,
      works_breakdown: [
        {
          work_id: "11111111-1111-1111-1111-111111111103",
          work_title: "Minuit sur la Seine",
          iswc: "T-302.118.440-2",
          right_type: "DEP",
          exploitation_type: "PUBLIC_PERFORMANCE",
          gross_line_amount: "1890.00",
          share_percentage: "25.00",
          allocated_amount: "472.50",
        },
      ],
    },
    {
      right_holder_id: "55555555-5555-5555-5555-555555555504",
      holder_name: "Éditions Solstices Music",
      role: "E",
      ipi_number: "00891234567",
      contract_id: null,
      contract_reference: null,
      entity_type: "SOCIETE",
      legal_form: "SAS (Maison d'Édition)",
      siret: "89123456700014",
      vat_number: "FR64891234567",
      vat_applicable: true,
      vat_rate_pct: "10.00",
      vat_amount: "212.50",
      ircec_precompte_applicable: false,
      urssaf_dispense_certificate: false,
      iban: "FR76 3000 2005 5000 0123 4567 890",
      bic: "CRLYFRPPXXX",
      gross_royalties_allocated: "2125.00",
      initial_advance: "0.00",
      previously_recouped: "0.00",
      recouped_in_period: "0.00",
      remaining_unrecouped_balance: "0.00",
      taxable_base_ht: "2125.00",
      precompte_ircec_amount: "0.00",
      precompte_social_amount: "0.00",
      payout_status: "PAYABLE",
      net_payable_amount: "2337.50",
      legal_mention_applied:
        "Règlement effectué par virement bancaire sous réserve d'encaissement et déduction faite des cotisations sociales et précomptes légaux.",
      e_invoicing_status: "FACTURE FACTUR-X 2026 (SOCIÉTÉ)",
      works_count: 1,
      works_breakdown: [
        {
          work_id: "11111111-1111-1111-1111-111111111101",
          work_title: "Lumière Noire",
          iswc: "T-301.452.891-4",
          right_type: "DEP",
          exploitation_type: "PUBLIC_PERFORMANCE",
          gross_line_amount: "4250.00",
          share_percentage: "50.00",
          allocated_amount: "2125.00",
        },
      ],
    },
    {
      right_holder_id: "55555555-5555-5555-5555-555555555505",
      holder_name: "Sami Benali",
      role: "AC",
      ipi_number: "00398765432",
      contract_id: null,
      contract_reference: null,
      entity_type: "PERSONNE_PHYSIQUE",
      legal_form: "Artiste-Auteur (Précompte IRCEC/URSSAF)",
      siret: null,
      vat_number: null,
      vat_applicable: false,
      vat_rate_pct: "0.00",
      vat_amount: "0.00",
      ircec_precompte_applicable: true,
      urssaf_dispense_certificate: false,
      iban: "FR76 3000 4019 9200 0555 4443 210",
      bic: "BNPAFRPPXXX",
      gross_royalties_allocated: "35.00",
      initial_advance: "0.00",
      previously_recouped: "0.00",
      recouped_in_period: "0.00",
      remaining_unrecouped_balance: "0.00",
      taxable_base_ht: "35.00",
      precompte_ircec_amount: "3.89",
      precompte_social_amount: "3.89",
      previous_reserve_balance: "0.00",
      min_payment_threshold: "50.00",
      is_below_payment_threshold: true,
      retained_in_reserve: "35.00",
      carried_forward_to_next: "35.00",
      payout_status: "BELOW_THRESHOLD",
      net_payable_amount: "0.00",
      legal_mention_applied:
        "Le montant net étant inférieur au seuil de paiement minimum de 50.00 €, ce solde est conservé en réserve et reporté au décompte de la période suivante.",
      e_invoicing_status: "NOTE DROITS D'AUTEUR (EN RÉSERVE)",
      works_count: 1,
      works_breakdown: [
        {
          work_id: "11111111-1111-1111-1111-111111111103",
          work_title: "Minuit sur la Seine",
          iswc: "T-302.118.440-2",
          right_type: "DRM",
          exploitation_type: "STREAMING",
          gross_line_amount: "70.00",
          share_percentage: "50.00",
          allocated_amount: "35.00",
        },
      ],
    },
  ],
};

const EMPTY_STATEMENT: StatementRead = {
  id: "",
  source_name: "Aucun relevé importé",
  filename: null,
  period_start: "2026-01-01",
  period_end: "2026-06-30",
  total_gross_amount: "0.00",
  validated_gross_amount: "0.00",
  pending_gross_amount: "0.00",
  lines_count: 0,
  validated_lines_count: 0,
  currency: "EUR",
  accounting_status: "DRAFT",
  locked_at: null,
  created_at: new Date().toISOString(),
  lines: [],
};

const EMPTY_ROYALTY_REPORT: RoyaltyRunReport = {
  statement_id: "",
  source_name: "Aucun relevé importé",
  accounting_status: "DRAFT",
  is_locked: false,
  total_statement_gross: "0.00",
  total_validated_gross: "0.00",
  total_pending_review_gross: "0.00",
  total_allocated_checksum: "0.00",
  total_recouped_in_period: "0.00",
  total_net_payable: "0.00",
  total_retained_in_reserve: "0.00",
  below_threshold_count: 0,
  validated_lines_processed: 0,
  pending_lines_skipped: 0,
  holder_statements: [],
};

export default function ReconciliationPage() {
  const [statement, setStatement] = useState<StatementRead>(EMPTY_STATEMENT);
  const [statementsList, setStatementsList] = useState<StatementRead[]>([]);
  const [catalogOptions, setCatalogOptions] = useState<
    { id: string; title: string; iswc: string | null }[]
  >([]);

  // Sous-vues principales
  const [activeTab, setActiveTab] = useState<
    "HOLDERS_SUMMARY" | "WORKS_RECONCILIATION" | "STATEMENTS_INGESTION" | "CAMPAIGNS_CONSOLIDATION"
  >("HOLDERS_SUMMARY");

  // Filtres Bilan par Ayant Droit
  const [holderFilter, setHolderFilter] = useState<
    | "ALL"
    | "PAYABLE"
    | "BELOW_THRESHOLD"
    | "RECOUPING"
    | "PERSONNE_PHYSIQUE"
    | "SOCIETE"
    | "WITH_ADVANCE"
    | string
  >("ALL");
  const [holderSearch, setHolderSearch] = useState("");
  const [expandedHolderNames, setExpandedHolderNames] = useState<Set<string>>(
    new Set()
  );

  // Filtres Rapprochement Œuvres
  const [confidenceFilter, setConfidenceFilter] = useState<
    "ALL" | "HIGH" | "MEDIUM" | "LOW"
  >("ALL");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "PENDING" | "VALIDATED" | "BLACK_BOX"
  >("ALL");
  const [lineSearch, setLineSearch] = useState("");
  const [lineSortBy, setLineSortBy] = useState<
    "DEFAULT" | "GROSS_AMOUNT_DESC" | "GROSS_AMOUNT_ASC" | "CONFIDENCE_ASC"
  >("DEFAULT");
  const [selectedLineForWorkCreation, setSelectedLineForWorkCreation] =
    useState<StatementLineMatch | null>(null);
  const [csvProfile, setCsvProfile] = useState("SACEM_STANDARD");

  // Notifications & Rapport Royalties
  const [learnedAliasNotice, setLearnedAliasNotice] = useState<string | null>(null);
  const [royaltyReport, setRoyaltyReport] = useState<RoyaltyRunReport | null>(
    EMPTY_ROYALTY_REPORT
  );
  const [computing, setComputing] = useState(false);

  // Modales
  const [selectedHolderForStatement, setSelectedHolderForStatement] =
    useState<AdvanceRecoupmentState | null>(null);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);

  // Options de Présentation Avancées des Décomptes (US-4.6)
  const [statementGroupBy, setStatementGroupBy] = useState<
    "WORK" | "PROJECT" | "TERRITORY" | "RIGHT_TYPE"
  >("WORK");
  const [statementLanguage, setStatementLanguage] = useState<"FR" | "EN">("FR");
  const [hideZeroBalances, setHideZeroBalances] = useState(false);

  const [selectedInvoiceData, setSelectedInvoiceData] =
    useState<ReadyToUseInvoicePayload | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  // Multi-Devises & Import Modal (US-4.5)
  const [currencyRates, setCurrencyRates] = useState<CurrencyRateItem[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadSourceName, setUploadSourceName] = useState("");
  const [uploadCurrency, setUploadCurrency] = useState("EUR");
  const [uploadExchangeRate, setUploadExchangeRate] = useState("1.000000");
  const [isUploading, setIsUploading] = useState(false);

  // Modale Retour Testeur
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [testerName, setTesterName] = useState("");
  const [testerRole, setTesterRole] = useState("Head of Copyrights & Royalties");
  const [currentTool, setCurrentTool] = useState("Excel XLOOKUP + Le Sage (Improvize)");
  const [painScore, setPainScore] = useState(5);
  const [feedbackVerdict, setFeedbackVerdict] = useState("");
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  async function handleLoadSampleDSP() {
    setIsLoadingSample(true);
    try {
      const created = await loadStressTestSample();
      setStatementsList((prev) => [created, ...prev]);
      setStatement(created);
      try {
        const rep = await computeStatementRoyalties(created.id);
        setRoyaltyReport(rep);
      } catch {
        // Ignoré si calcul initial
      }
      setLearnedAliasNotice("✨ Relevé de test DSP chargé avec succès (50 lignes).");
    } catch (err: any) {
      console.error("Erreur chargement relevé test:", err);
    } finally {
      setIsLoadingSample(false);
    }
  }

  async function handleLoadDemoAll() {
    setIsLoadingDemo(true);
    try {
      await loadSandboxDemo();
      const stmts = await fetchStatements();
      setStatementsList(stmts);
      if (stmts.length > 0) {
        setStatement(stmts[0]);
        try {
          const rep = await computeStatementRoyalties(stmts[0].id);
          setRoyaltyReport(rep);
        } catch {
          // Ignoré si calcul initial
        }
      }
      try {
        const works = await fetchWorks();
        setCatalogOptions(works.map((w) => ({ id: w.id, title: w.title, iswc: w.iswc })));
      } catch {
        // Ignoré
      }
      setLearnedAliasNotice("✨ Jeu complet de démonstration chargé (30 œuvres, contrats et relevé).");
    } catch (err: any) {
      console.error("Erreur chargement démo:", err);
    } finally {
      setIsLoadingDemo(false);
    }
  }

  async function refreshStatementsList() {
    try {
      const stmts = await fetchStatements();
      setStatementsList(stmts);
    } catch {
      // Ignoré
    }
  }

  useEffect(() => {
    function loadReconciliationData() {
      fetchStatements()
        .then((stmts) => {
          setStatementsList(stmts);
          if (stmts.length > 0) {
            setStatement(stmts[0]);
            computeStatementRoyalties(stmts[0].id)
              .then((rep) => setRoyaltyReport(rep))
              .catch(() => {});
          } else {
            setStatement(EMPTY_STATEMENT);
            setRoyaltyReport(EMPTY_ROYALTY_REPORT);
          }
        })
        .catch(() => {});

      fetchWorks()
        .then((works: WorkRead[]) => {
          setCatalogOptions(
            works.map((w) => ({ id: w.id, title: w.title, iswc: w.iswc }))
          );
        })
        .catch(() => {});

      fetchCurrencyParities()
        .then((rates) => {
          if (rates && rates.length > 0) setCurrencyRates(rates);
        })
        .catch(() => {});
    }

    loadReconciliationData();

    window.addEventListener("korom_entity_changed", loadReconciliationData);
    return () => {
      window.removeEventListener("korom_entity_changed", loadReconciliationData);
    };
  }, []);

  function handleSelectUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadSourceName(file.name.replace(/\.[^/.]+$/, ""));
    setIsUploadModalOpen(true);
    e.target.value = "";
  }

  function handleCurrencyChange(code: string) {
    setUploadCurrency(code);
    const found = currencyRates.find((c) => c.currency === code);
    if (found) {
      setUploadExchangeRate(found.rate_to_eur);
    } else if (code === "EUR") {
      setUploadExchangeRate("1.000000");
    }
  }

  async function handleConfirmUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;
    setIsUploading(true);
    try {
      const created = await uploadStatementCsv(
        uploadFile,
        uploadSourceName.trim() || uploadFile.name,
        uploadCurrency,
        uploadCurrency !== "EUR" ? uploadExchangeRate : undefined
      );
      setStatement(created);
      setStatementsList((prev) => [created, ...prev]);
      const rep = await computeStatementRoyalties(created.id);
      setRoyaltyReport(rep);
      setActiveTab("HOLDERS_SUMMARY");
      setIsUploadModalOpen(false);
      setUploadFile(null);
      setLearnedAliasNotice(
        `Relevé « ${created.source_name} » importé avec succès (${created.currency !== "EUR" ? `${created.currency} @ ${created.exchange_rate} ➔ ` : ""}${Number(created.total_gross_amount).toLocaleString("fr-FR")} €).`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'importation du relevé.";
      alert(msg);
    } finally {
      setIsUploading(false);
    }
  }

  function toggleExpandHolder(holderName: string) {
    setExpandedHolderNames((prev) => {
      const next = new Set(prev);
      if (next.has(holderName)) {
        next.delete(holderName);
      } else {
        next.add(holderName);
      }
      return next;
    });
  }

  async function handleSelectStatement(stmtId: string) {
    const found = statementsList.find((s) => s.id === stmtId);
    if (!found) return;
    setStatement(found);
    setComputing(true);
    try {
      const rep = await computeStatementRoyalties(found.id);
      setRoyaltyReport(rep);
    } catch {
      // Fallback
    } finally {
      setComputing(false);
    }
  }

  async function handleRunRoyalties() {
    setComputing(true);
    try {
      const rep = await computeStatementRoyalties(statement.id);
      setRoyaltyReport(rep);
      setLearnedAliasNotice(
        `Répartition calculée avec succès : ${Number(rep.total_allocated_checksum).toLocaleString("fr-FR")} € alloués aux ayants droit (Somme de contrôle 100% équilibrée).`
      );
    } catch {
      setRoyaltyReport(INITIAL_ROYALTY_REPORT);
    } finally {
      setComputing(false);
    }
  }

  // Modales Cycle Comptable DRAFT ➔ LOCKED ➔ PAID
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [closingNotes, setClosingNotes] = useState("");
  const [isClosing, setIsClosing] = useState(false);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("VIREMENT_SEPA");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [isReopening, setIsReopening] = useState(false);

  // Modale Virement Bancaire SEPA XML (pain.001.001.03)
  const [isSepaModalOpen, setIsSepaModalOpen] = useState(false);
  const [sepaReport, setSepaReport] = useState<SepaValidationReport | null>(null);
  const [isSepaLoading, setIsSepaLoading] = useState(false);
  const [isSepaExporting, setIsSepaExporting] = useState(false);
  const [sepaExecutionDate, setSepaExecutionDate] = useState(new Date().toISOString().split("T")[0]);
  const [sepaRemittancePrefix, setSepaRemittancePrefix] = useState("KOROM ROYALTIES");
  const [sepaAllowUnverified, setSepaAllowUnverified] = useState(true);
  const [sepaDebtorIban, setSepaDebtorIban] = useState("");
  const [sepaDebtorBic, setSepaDebtorBic] = useState("");
  const [sepaTab, setSepaTab] = useState<"included" | "skipped">("included");
  const [sepaXmlOutput, setSepaXmlOutput] = useState<SepaExportResponse | null>(null);
  const [sepaCopySuccess, setSepaCopySuccess] = useState(false);

  async function openSepaModal() {
    if (!statement.id) return;
    setIsSepaModalOpen(true);
    setIsSepaLoading(true);
    setSepaXmlOutput(null);
    setSepaCopySuccess(false);
    try {
      const rep = await fetchStatementSepaPreview(statement.id, {
        allowUnverifiedIbans: sepaAllowUnverified,
      });
      setSepaReport(rep);
      if (rep.debtor_iban) setSepaDebtorIban(rep.debtor_iban);
      if (rep.debtor_bic) setSepaDebtorBic(rep.debtor_bic);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur de prévisualisation SEPA";
      setLearnedAliasNotice(`Erreur SEPA : ${msg}`);
    } finally {
      setIsSepaLoading(false);
    }
  }

  async function handleRefreshSepaPreview(allowUnverified = sepaAllowUnverified) {
    if (!statement.id) return;
    setIsSepaLoading(true);
    try {
      const rep = await fetchStatementSepaPreview(statement.id, {
        allowUnverifiedIbans: allowUnverified,
        debtorIban: sepaDebtorIban.trim() || undefined,
        debtorBic: sepaDebtorBic.trim() || undefined,
      });
      setSepaReport(rep);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors du recalcul de la conformité SEPA";
      setLearnedAliasNotice(`Erreur SEPA : ${msg}`);
    } finally {
      setIsSepaLoading(false);
    }
  }

  async function handleExportSepaXml() {
    if (!statement.id) return;
    setIsSepaExporting(true);
    try {
      const res = await exportStatementSepaXml(statement.id, {
        execution_date: sepaExecutionDate || undefined,
        remittance_prefix: sepaRemittancePrefix || undefined,
        allow_unverified_ibans: sepaAllowUnverified,
        debtor_iban: sepaDebtorIban.trim() || undefined,
        debtor_bic: sepaDebtorBic.trim() || undefined,
      });
      setSepaXmlOutput(res);
      if (!paymentReference) {
        setPaymentReference(res.message_id.slice(0, 30));
      }

      // Téléchargement automatique du fichier XML pain.001
      const blob = new Blob([res.xml_content], { type: "application/xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = res.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setLearnedAliasNotice(
        `Fichier SEPA XML généré et téléchargé (${res.total_transactions} virements, total ${Number(res.total_amount_eur).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €). Fichier : ${res.filename}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la génération du fichier SEPA XML pain.001";
      setLearnedAliasNotice(`Erreur SEPA : ${msg}`);
    } finally {
      setIsSepaExporting(false);
    }
  }

  async function handleCopySepaXml() {
    if (!sepaXmlOutput?.xml_content) return;
    await navigator.clipboard.writeText(sepaXmlOutput.xml_content);
    setSepaCopySuccess(true);
    setTimeout(() => setSepaCopySuccess(false), 3000);
  }

  async function handleConfirmClosing() {
    setIsClosing(true);
    try {
      const rep = await lockAndPostStatementRoyalties(statement.id, {
        notes: closingNotes.trim() || undefined,
      });
      setRoyaltyReport(rep);
      setStatement((prev) => ({
        ...prev,
        accounting_status: "LOCKED",
        locked_at: rep.locked_at || new Date().toISOString(),
        integrity_hash: rep.integrity_hash,
      }));
      setStatementsList((prev) =>
        prev.map((s) =>
          s.id === statement.id
            ? {
                ...s,
                accounting_status: "LOCKED",
                locked_at: rep.locked_at,
                integrity_hash: rep.integrity_hash,
              }
            : s
        )
      );
      setLearnedAliasNotice(
        `Clôture comptable immuable (LOCKED) effectuée avec succès. Sceau d'intégrité SHA-256 : ${rep.integrity_hash?.slice(0, 16)}...`
      );
      setIsClosingModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la clôture comptable.";
      setLearnedAliasNotice(`Erreur : ${msg}`);
    } finally {
      setIsClosing(false);
    }
  }

  async function handleConfirmPayment() {
    if (!paymentReference.trim()) return;
    setIsPaying(true);
    try {
      const rep = await markStatementAsPaid(statement.id, {
        payment_date: paymentDate || undefined,
        payment_method: paymentMethod,
        payment_reference: paymentReference.trim(),
        payment_notes: paymentNotes.trim() || undefined,
      });
      setRoyaltyReport(rep);
      setStatement((prev) => ({
        ...prev,
        accounting_status: "PAID",
        paid_at: rep.paid_at || new Date().toISOString(),
        payment_reference: rep.payment_reference,
        payment_method: rep.payment_method,
        payment_notes: rep.payment_notes,
      }));
      setStatementsList((prev) =>
        prev.map((s) =>
          s.id === statement.id
            ? {
                ...s,
                accounting_status: "PAID",
                paid_at: rep.paid_at,
                payment_reference: rep.payment_reference,
                payment_method: rep.payment_method,
              }
            : s
        )
      );
      setLearnedAliasNotice(
        `Règlement bancaire enregistré avec succès (${rep.payment_method} - Réf. ${rep.payment_reference}). Période soldée (PAID).`
      );
      setIsPaymentModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'enregistrement du règlement bancaire.";
      setLearnedAliasNotice(`Erreur : ${msg}`);
    } finally {
      setIsPaying(false);
    }
  }

  async function handleConfirmReopenDraft() {
    setIsReopening(true);
    try {
      const rep = await reopenStatementToDraft(statement.id);
      setRoyaltyReport(rep);
      setStatement((prev) => ({
        ...prev,
        accounting_status: "DRAFT",
        locked_at: null,
        integrity_hash: null,
        paid_at: null,
        payment_reference: null,
        payment_method: null,
        payment_notes: null,
      }));
      setStatementsList((prev) =>
        prev.map((s) =>
          s.id === statement.id
            ? {
                ...s,
                accounting_status: "DRAFT",
                locked_at: null,
                integrity_hash: null,
                paid_at: null,
                payment_reference: null,
                payment_method: null,
              }
            : s
        )
      );
      setLearnedAliasNotice(
        `Réouverture comptable réussie : le relevé est repassé en mode simulation (DRAFT) et le Grand Livre a été purgé.`
      );
      setIsReopenModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la réouverture en DRAFT.";
      setLearnedAliasNotice(`Erreur : ${msg}`);
    } finally {
      setIsReopening(false);
    }
  }

  function handleCopyIntegrityHash(hash: string) {
    if (!hash) return;
    navigator.clipboard.writeText(hash).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }

  async function handleLockAndPostRoyalties() {
    setIsClosingModalOpen(true);
  }

  async function handleOpenAuthorStatement(holder: AdvanceRecoupmentState) {
    setSelectedHolderForStatement(holder);
    setIsStatementModalOpen(true);
  }

  async function handleOpenHolderInvoice(holder: AdvanceRecoupmentState) {
    try {
      const invoice = await fetchStatementHolderInvoice(statement.id, holder.holder_name);
      setSelectedInvoiceData(invoice);
      setIsInvoiceModalOpen(true);
    } catch {
      // Fallback local
      const isCompany = holder.entity_type === "SOCIETE";
      const gross = parseFloat(holder.gross_royalties_allocated) || 0;
      const recouped = parseFloat(holder.recouped_in_period) || 0;
      const taxableHt = Math.max(0, gross - recouped);
      const vatRate = parseFloat(holder.vat_rate_pct || "0");
      const vatAmount = (taxableHt * vatRate) / 100;
      const precompte = parseFloat(holder.precompte_social_amount || holder.precompte_ircec_amount || "0");
      const netPayable = Math.max(0, taxableHt + vatAmount - precompte);

      const localPayload: ReadyToUseInvoicePayload = {
        invoice_number: `${isCompany ? "FAC" : "NDA"}-2026-${holder.holder_name.slice(0, 3).toUpperCase()}`,
        document_type: isCompany ? "FACTURE_REDEVANCES_FACTURX" : "NOTE_DROITS_AUTEUR",
        issue_date: new Date().toISOString().split("T")[0],
        period_label: `${statement.source_name} (${statement.period_start} au ${statement.period_end})`,
        publisher_name: "Éditions Solstices Music",
        publisher_siret: "89123456700014",
        publisher_vat: "FR64891234567",
        publisher_address: "24 Rue de Paradis, 75010 Paris, France",
        holder_id: holder.right_holder_id || crypto.randomUUID(),
        holder_name: holder.holder_name,
        entity_type: holder.entity_type || "PERSONNE_PHYSIQUE",
        legal_form: holder.legal_form || (isCompany ? "SAS / SARL" : "Personne Physique"),
        holder_ipi: holder.ipi_number || null,
        holder_siret: holder.siret || null,
        holder_vat_number: holder.vat_number || null,
        holder_address: "Adresse déclarée de l'ayant droit",
        holder_email: null,
        holder_iban: holder.iban || null,
        gross_royalties_eur: gross.toFixed(2),
        recouped_advance_eur: recouped.toFixed(2),
        taxable_base_ht_eur: taxableHt.toFixed(2),
        vat_rate_pct: vatRate.toFixed(2),
        vat_amount_eur: vatAmount.toFixed(2),
        ircec_raap_cotisation_eur: (taxableHt * 0.011).toFixed(2),
        csg_crds_cotisation_eur: (taxableHt * 0.1).toFixed(2),
        total_precompte_social_eur: precompte.toFixed(2),
        net_payable_to_holder_eur: netPayable.toFixed(2),
        legal_mentions: [
          isCompany
            ? "Facture de redevances émise par une personne morale (Société)."
            : "Note de droits d'auteur établie par mandat d'autofacturation.",
          "Conforme aux dispositions du Code de la propriété intellectuelle (CPI).",
        ],
        printable_text: `DOCUMENT OFFICIEL KOROM DE REDEVANCES\nAyant Droit : ${holder.holder_name}\nBrut SACEM : ${gross.toFixed(2)} EUR\nAmortissement Avance : -${recouped.toFixed(2)} EUR\nAssiette HT : ${taxableHt.toFixed(2)} EUR\nNet à Payer : ${netPayable.toFixed(2)} EUR\nIBAN : ${holder.iban || "N/A"}`,
      };
      setSelectedInvoiceData(localPayload);
      setIsInvoiceModalOpen(true);
    }
  }

  function handleExportRoyaltiesCsv() {
    if (!royaltyReport) return;
    const headers = [
      "holder_name",
      "entity_type",
      "role",
      "ipi_number",
      "contract_reference",
      "gross_royalties_allocated",
      "initial_advance",
      "recouped_in_period",
      "remaining_unrecouped_balance",
      "previous_reserve_balance",
      "retained_in_reserve",
      "payout_status",
      "taxable_base_ht",
      "precompte_social_amount",
      "net_payable_amount",
      "iban",
    ];
    const rows = royaltyReport.holder_statements.map((h) =>
      [
        `"${h.holder_name}"`,
        h.entity_type || "PERSONNE_PHYSIQUE",
        h.role || "AC",
        h.ipi_number || "",
        h.contract_reference || "CATALOG",
        h.gross_royalties_allocated,
        h.initial_advance,
        h.recouped_in_period,
        h.remaining_unrecouped_balance,
        h.previous_reserve_balance || "0.00",
        h.retained_in_reserve || "0.00",
        h.payout_status || "PAYABLE",
        h.taxable_base_ht || "",
        h.precompte_social_amount || "0.00",
        h.net_payable_amount,
        `"${h.iban || ""}"`,
      ].join(",")
    );
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `synthese_royalties_sacem_${statement.source_name.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const created = await uploadStatementCsv(file, file.name);
      setStatement(created);
      setStatementsList((prev) => [created, ...prev]);
      const rep = await computeStatementRoyalties(created.id);
      setRoyaltyReport(rep);
      setActiveTab("HOLDERS_SUMMARY");
    } catch {
      // Fallback
    }
  }

  function handleSelectAlternativeWork(lineId: string, newWorkId: string) {
    const chosen = catalogOptions.find((w) => w.id === newWorkId);
    if (!chosen) return;
    setStatement((prev) => ({
      ...prev,
      lines: prev.lines.map((l) =>
        l.id === lineId
          ? {
              ...l,
              matched_work_id: chosen.id,
              matched_work_title: chosen.title,
              match_method: "MANUAL",
            }
          : l
      ),
    }));
  }

  async function handleValidateLine(line: StatementLineMatch) {
    try {
      const updatedLine = await validateStatementLine(line.id, {
        approve: true,
        matched_work_id: line.matched_work_id,
      });
      setStatement((prev) => ({
        ...prev,
        lines: prev.lines.map((l) => (l.id === updatedLine.id ? updatedLine : l)),
      }));
    } catch {
      setStatement((prev) => ({
        ...prev,
        lines: prev.lines.map((l) =>
          l.id === line.id ? { ...l, validation_status: "VALIDATED" } : l
        ),
      }));
    }
  }

  async function handleValidateBatchHighConfidence() {
    try {
      const updatedStmt = await validateHighConfidenceLines(statement.id);
      setStatement(updatedStmt);
      const rep = await computeStatementRoyalties(statement.id);
      setRoyaltyReport(rep);
    } catch {
      setStatement((prev) => ({
        ...prev,
        lines: prev.lines.map((l) =>
          l.confidence_score >= 0.9 ? { ...l, validation_status: "VALIDATED" } : l
        ),
      }));
    }
  }

  // Filtrage des ayants droit dans le Bilan
  const holdersList = royaltyReport?.holder_statements || [];
  const filteredHolders = holdersList.filter((h) => {
    const q = holderSearch.trim().toLowerCase();
    if (q) {
      const matchName = h.holder_name.toLowerCase().includes(q);
      const matchIpi = (h.ipi_number || "").toLowerCase().includes(q);
      const matchContract = (h.contract_reference || "").toLowerCase().includes(q);
      const matchWorks = (h.works_breakdown || []).some((wb) =>
        wb.work_title.toLowerCase().includes(q)
      );
      if (!matchName && !matchIpi && !matchContract && !matchWorks) return false;
    }
    if (hideZeroBalances) {
      const gross = parseFloat(h.gross_royalties_allocated || "0");
      const netPayable = parseFloat(h.net_payable_amount || "0");
      if (gross <= 0 && netPayable <= 0) return false;
    }
    if (holderFilter === "PAYABLE") return h.payout_status === "PAYABLE";
    if (holderFilter === "BELOW_THRESHOLD") return h.payout_status === "BELOW_THRESHOLD" || Boolean(h.is_below_payment_threshold);
    if (holderFilter === "RECOUPING") return h.payout_status === "RECOUPING" || parseFloat(h.remaining_unrecouped_balance || "0") > 0;
    if (holderFilter === "PERSONNE_PHYSIQUE") return h.entity_type === "PERSONNE_PHYSIQUE";
    if (holderFilter === "SOCIETE") return h.entity_type === "SOCIETE";
    if (holderFilter === "WITH_ADVANCE") return parseFloat(h.initial_advance || "0") > 0;
    return true;
  });

  // Filtrage des lignes pour l'onglet Rapprochement
  const filteredLines = statement.lines.filter((l) => {
    const q = lineSearch.trim().toLowerCase();
    if (q) {
      const matchRaw = l.raw_work_title.toLowerCase().includes(q);
      const matchMatched = (l.matched_work_title || "").toLowerCase().includes(q);
      const matchIswc = (l.raw_iswc || "").toLowerCase().includes(q);
      const matchIsrc = (l.raw_isrc || "").toLowerCase().includes(q);
      const matchPerformer = (l.raw_performer || "").toLowerCase().includes(q);
      const matchRight = l.right_type.toLowerCase().includes(q);
      if (!matchRaw && !matchMatched && !matchIswc && !matchIsrc && !matchPerformer && !matchRight) {
        return false;
      }
    }
    if (statusFilter === "PENDING") {
      if (l.validation_status !== "PENDING_REVIEW") return false;
    } else if (statusFilter === "VALIDATED") {
      if (l.validation_status !== "VALIDATED") return false;
    } else if (statusFilter === "BLACK_BOX") {
      if (l.validation_status === "VALIDATED") return false;
      const isOrphan = !l.raw_iswc && !l.raw_isrc;
      const isLowConfidence = l.confidence_score < 0.8;
      if (!isOrphan && !isLowConfidence) return false;
    }
    if (confidenceFilter === "HIGH") return l.confidence_score >= 0.9;
    if (confidenceFilter === "MEDIUM")
      return l.confidence_score >= 0.65 && l.confidence_score < 0.9;
    if (confidenceFilter === "LOW") return l.confidence_score < 0.65;
    return true;
  });

  // US-5.2 : Tri haute priorité par montant décroissant (€) pour loi de Pareto (80/20)
  const sortedFilteredLines = useMemo(() => {
    const list = [...filteredLines];
    if (lineSortBy === "GROSS_AMOUNT_DESC") {
      list.sort(
        (a, b) =>
          parseFloat(String(b.gross_amount || 0)) -
          parseFloat(String(a.gross_amount || 0))
      );
    } else if (lineSortBy === "GROSS_AMOUNT_ASC") {
      list.sort(
        (a, b) =>
          parseFloat(String(a.gross_amount || 0)) -
          parseFloat(String(b.gross_amount || 0))
      );
    } else if (lineSortBy === "CONFIDENCE_ASC") {
      list.sort((a, b) => a.confidence_score - b.confidence_score);
    }
    return list;
  }, [filteredLines, lineSortBy]);

  const blackBoxLinesCount = useMemo(() => {
    return statement.lines.filter(
      (l) =>
        l.validation_status === "PENDING_REVIEW" &&
        ((!l.raw_iswc && !l.raw_isrc) || l.confidence_score < 0.8)
    ).length;
  }, [statement.lines]);

  return (
    <div className="space-y-4">
      {/* En-tête Principal Royalties & Décomptes SACEM */}
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center border-b pb-3.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-micro text-[28px] font-bold tracking-tight text-foreground leading-none">
              Royalties &amp; Décomptes SACEM
            </h1>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              Moteur 100% Déterministe
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Ingestion des décomptes SACEM • Répartition automatique sur le Catalogue • Bilan par Ayant Droit &amp; Génération 1-clic (Décomptes, Factures Factur-X &amp; Notes de Droits)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sélecteur de Décompte SACEM */}
          <select
            value={statement.id}
            onChange={(e) => handleSelectStatement(e.target.value)}
            aria-label="Sélectionner le décompte SACEM actif"
            className="rounded-lg border bg-card px-2.5 py-1.5 text-xs font-semibold shadow-xs focus:outline-none focus:ring-2 focus:ring-primary max-w-xs"
          >
            {statementsList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.source_name} ({Number(s.total_gross_amount).toLocaleString("fr-FR")} €)
              </option>
            ))}
          </select>

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/30 bg-card px-3 py-1.5 text-xs font-semibold shadow-xs hover:bg-accent transition-colors">
            <Coins className="h-3.5 w-3.5 text-primary" />
            <span>Importer Relevé (CSV / Multi-Devises)</span>
            <input
              type="file"
              accept=".csv,.xlsx,.txt"
              onChange={handleSelectUploadFile}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleRunRoyalties}
            disabled={computing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Calculator className="h-3.5 w-3.5" />
            <span>{computing ? "Calcul en cours..." : "Actualiser la Répartition"}</span>
          </button>

          <button
            type="button"
            onClick={handleExportRoyaltiesCsv}
            disabled={!royaltyReport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary shadow-xs hover:bg-primary/20 disabled:opacity-50 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exporter CSV Synthèse</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {learnedAliasNotice && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-800">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span>{learnedAliasNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setLearnedAliasNotice(null)}
            className="text-xs font-semibold underline hover:no-underline"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Empty State bienveillant si aucun relevé de royalties importé */}
      {statementsList.length === 0 ? (
        <EmptyState
          icon={<GitCompareArrows className="h-8 w-8 text-primary" />}
          title="Aucun relevé de royalties ou SACEM importé"
          description="Importez un fichier de décompte SACEM ou un relevé streaming DSP (Spotify, Apple Music, Deezer...) pour lancer le matching intelligent, calculer les répartitions au micro-centime et générer vos décomptes d'ayants droit."
          badgeText="Base vierge"
          primaryAction={{
            label: "Charger un relevé test DSP (Simulation)",
            onClick: handleLoadSampleDSP,
            icon: isLoadingSample ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />,
          }}
          secondaryAction={{
            label: "Importer un relevé (CSV / Devises)",
            onClick: () => setIsUploadModalOpen(true),
            icon: <Coins className="h-4 w-4" />,
          }}
          demoAction={{
            label: "Charger toutes les données démo (30 œuvres & relevé)",
            onClick: handleLoadDemoAll,
            isLoading: isLoadingDemo,
          }}
          tipText="💡 Règle des micro-centimes & Seuil 50 € : Korom garantit que la somme des parts distribuées est égale au centime près au brut déclaré (algorithme du plus fort reste). Les soldes nets inférieurs à 50 € sont automatiquement conservés en réserve et reportés à nouveau au décompte suivant."
        />
      ) : (
        <>
          {/* Bandeau de Pilotage du Cycle de Clôture Comptable (DRAFT ➔ LOCKED ➔ PAID) */}
      <div
        className={`rounded-xl border p-4 shadow-xs transition-all ${
          statement.accounting_status === "PAID"
            ? "bg-emerald-500/10 border-emerald-500/30"
            : statement.accounting_status === "LOCKED"
            ? "bg-indigo-500/10 border-indigo-500/30"
            : "bg-amber-500/10 border-amber-500/30"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {statement.accounting_status === "PAID" ? (
                <>
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white text-[11px] font-bold px-2 py-0.5 font-mono shadow-xs">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    PAID — Période Soldée
                  </span>
                  <span className="text-xs font-semibold text-emerald-950 dark:text-emerald-200">
                    Règlements bancaires exécutés ({statement.payment_method || "SEPA"})
                  </span>
                </>
              ) : statement.accounting_status === "LOCKED" ? (
                <>
                  <span className="inline-flex items-center gap-1 rounded-md bg-indigo-600 text-white text-[11px] font-bold px-2 py-0.5 font-mono shadow-xs">
                    <Lock className="h-3.5 w-3.5" />
                    LOCKED — Période Clôturée
                  </span>
                  <span className="text-xs font-semibold text-indigo-950 dark:text-indigo-200">
                    Grand Livre scellé • Décomptes immuables
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-600 text-white text-[11px] font-bold px-2 py-0.5 font-mono shadow-xs">
                    <Sparkles className="h-3.5 w-3.5" />
                    DRAFT — Simulation en cours
                  </span>
                  <span className="text-xs font-semibold text-amber-950 dark:text-amber-200">
                    Calculs en temps réel • Modifications et arbitrages autorisés
                  </span>
                </>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {statement.accounting_status === "PAID" ? (
                <>
                  Réf. Virement : <strong className="font-mono text-foreground">{statement.payment_reference}</strong>
                  {statement.paid_at && ` • Date : ${new Date(statement.paid_at).toLocaleDateString("fr-FR")}`}
                  {statement.integrity_hash && (
                    <> • Sceau : <code className="font-mono text-[11px] text-foreground">{statement.integrity_hash.slice(0, 16)}...</code></>
                  )}
                </>
              ) : statement.accounting_status === "LOCKED" ? (
                <>
                  {statement.locked_at && `Clôturé le ${new Date(statement.locked_at).toLocaleString("fr-FR")} • `}
                  Sceau cryptographique SHA-256 : <code className="font-mono text-[11px] text-foreground">{statement.integrity_hash ? `${statement.integrity_hash.slice(0, 18)}...` : "Certifié"}</code>
                </>
              ) : (
                "Les quotes-parts, amortissements d'avances et réserves sont calculés à la volée. Dès que vos arbitrages sont terminés, clôturez la période pour figer les écritures au Grand Livre."
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {statement.accounting_status === "DRAFT" ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsClosingModalOpen(true)}
                  disabled={computing || !statement.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Clôturer la période (LOCKED)</span>
                </button>
                <button
                  type="button"
                  onClick={() => openSepaModal()}
                  disabled={computing || !statement.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  title="Prévisualiser et auditer le fichier de virement SEPA ISO 20022"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Audit SEPA XML (pain.001)</span>
                </button>
              </>
            ) : statement.accounting_status === "LOCKED" ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-700 transition-colors"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>Enregistrer le Règlement (PAID)</span>
                </button>
                <button
                  type="button"
                  onClick={() => openSepaModal()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                  title="Générer le fichier de télétransmission bancaire SEPA XML ISO 20022 (pain.001.001.03)"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Virement SEPA XML (pain.001)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCertificateModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-card px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Certificat d&apos;Intégrité</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsReopenModalOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Rouvrir la période en mode simulation (DRAFT)"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Rouvrir en DRAFT</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openSepaModal()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                  title="Télécharger à nouveau le fichier SEPA XML pain.001"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Virement SEPA XML (pain.001)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCertificateModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-card px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                >
                  <BadgeCheck className="h-4 w-4 text-emerald-600" />
                  <span>Certificat d&apos;Intégrité &amp; Sceau</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 5 Piliers Financiers du Décompte SACEM Actif */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border bg-card p-3.5 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Total Brut Relevé</span>
            {statement.source_currency && statement.source_currency !== "EUR" && (
              <span className="rounded bg-primary/10 text-primary font-bold px-1.5 py-0.5 font-mono text-[10px]">
                {statement.source_currency} @ {statement.exchange_rate}
              </span>
            )}
          </div>
          <div className="text-xl font-bold font-mono text-foreground">
            {Number(statement.total_gross_amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
          </div>
          <div className="text-[11px] text-muted-foreground">
            {statement.source_gross_amount && statement.source_currency !== "EUR" ? (
              <span className="font-semibold text-foreground">
                {Number(statement.source_gross_amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {statement.source_currency} &bull;{" "}
              </span>
            ) : null}
            Période : {statement.period_start} au {statement.period_end}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-3.5 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Brut Réparti aux Ayants Droit
          </div>
          <div className="text-xl font-bold font-mono text-emerald-700">
            {Number(royaltyReport?.total_allocated_checksum || statement.validated_gross_amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
          </div>
          <div className="text-[11px] text-emerald-700/90 font-medium">
            {royaltyReport?.holder_statements.length || 0} ayants droit crédités sur {statement.validated_lines_count} lignes
          </div>
        </div>

        <div className="rounded-xl border bg-card p-3.5 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Avances Retenues (Période)
          </div>
          <div className="text-xl font-bold font-mono text-amber-700">
            - {Number(royaltyReport?.total_recouped_in_period || "0.00").toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
          </div>
          <div className="text-[11px] text-amber-700/90 font-medium">
            Amortissement déterministe sur contrats actifs
          </div>
        </div>

        <div className="rounded-xl border bg-card p-3.5 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Mis en Réserve (&lt; 50 €)
          </div>
          <div className="text-xl font-bold font-mono text-amber-600">
            {Number(royaltyReport?.total_retained_in_reserve || "0.00").toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
          </div>
          <div className="text-[11px] text-amber-700/90 font-medium">
            {royaltyReport?.below_threshold_count || 0} ayant(s) droit sous le seuil (Report S2)
          </div>
        </div>

        <div className="rounded-xl border bg-card p-3.5 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Net Total à Décaisser</span>
            {statement.accounting_status === "PAID" ? (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-800">
                <BadgeCheck className="h-2.5 w-2.5 text-emerald-600" />
                PAID
              </span>
            ) : statement.accounting_status === "LOCKED" ? (
              <span className="inline-flex items-center gap-1 rounded bg-indigo-500/15 border border-indigo-500/30 px-1.5 py-0.5 font-mono text-[9px] font-bold text-indigo-800">
                <ShieldCheck className="h-2.5 w-2.5 text-indigo-600" />
                LOCKED
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-800">
                DRAFT
              </span>
            )}
          </div>
          <div className="text-xl font-bold font-mono text-emerald-700">
            {Number(royaltyReport?.total_net_payable || "0.00").toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
          </div>
          <div className="text-[11px] text-muted-foreground">
            {statement.accounting_status === "PAID" ? (
              `Règlement effectué (${statement.payment_method || "SEPA"})`
            ) : statement.accounting_status === "LOCKED" ? (
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(true)}
                className="text-emerald-700 hover:underline font-semibold"
              >
                Payer les ayants droit (PAID) →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsClosingModalOpen(true)}
                disabled={computing || !statement.id}
                className="text-primary hover:underline font-semibold disabled:opacity-50"
              >
                Clôturer la période (LOCKED) →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation par Onglets de Travail */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-2 pt-1">
        <button
          type="button"
          onClick={() => setActiveTab("HOLDERS_SUMMARY")}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
            activeTab === "HOLDERS_SUMMARY"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Bilan par Ayant Droit (SACEM)</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
            activeTab === "HOLDERS_SUMMARY" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
          }`}>
            {holdersList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("WORKS_RECONCILIATION")}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
            activeTab === "WORKS_RECONCILIATION"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
          }`}
        >
          <Disc3 className="h-4 w-4" />
          <span>Rapprochement Œuvres &amp; Catalogue</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
            activeTab === "WORKS_RECONCILIATION" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
          }`}>
            {statement.lines_count}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("STATEMENTS_INGESTION")}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
            activeTab === "STATEMENTS_INGESTION"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Ingestion &amp; Historique Relevés</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
            activeTab === "STATEMENTS_INGESTION" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
          }`}>
            {statementsList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("CAMPAIGNS_CONSOLIDATION")}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
            activeTab === "CAMPAIGNS_CONSOLIDATION"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Campagnes Multi-Relevés (SACEM + DSP)</span>
          <span className="rounded bg-emerald-500/15 px-1.5 py-0.2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            Nouveau
          </span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* VUE 1 : BILAN PAR AYANT DROIT (SACEM) — CŒUR DE LA DEMANDE    */}
      {/* ============================================================== */}
      {activeTab === "HOLDERS_SUMMARY" && (
        <div className="space-y-4">
          {/* Barre de filtres et recherche des ayants droit */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setHolderFilter("ALL")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                  holderFilter === "ALL"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground hover:bg-muted border-border"
                }`}
              >
                Tous ({holdersList.length})
              </button>
              <button
                type="button"
                onClick={() => setHolderFilter("PAYABLE")}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                  holderFilter === "PAYABLE"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-card text-foreground hover:bg-muted border-border"
                }`}
              >
                À Régler ({holdersList.filter((h) => h.payout_status === "PAYABLE").length})
              </button>
              <button
                type="button"
                onClick={() => setHolderFilter("BELOW_THRESHOLD")}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                  holderFilter === "BELOW_THRESHOLD"
                    ? "bg-amber-600 text-white border-amber-600"
                    : "bg-card text-foreground hover:bg-muted border-border"
                }`}
              >
                En Réserve &lt; 50 € ({holdersList.filter((h) => h.payout_status === "BELOW_THRESHOLD" || h.is_below_payment_threshold).length})
              </button>
              <button
                type="button"
                onClick={() => setHolderFilter("RECOUPING")}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                  holderFilter === "RECOUPING"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-card text-foreground hover:bg-muted border-border"
                }`}
              >
                Avances en cours ({holdersList.filter((h) => h.payout_status === "RECOUPING" || parseFloat(h.remaining_unrecouped_balance || "0") > 0).length})
              </button>
              <button
                type="button"
                onClick={() => setHolderFilter("PERSONNE_PHYSIQUE")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                  holderFilter === "PERSONNE_PHYSIQUE"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground hover:bg-muted border-border"
                }`}
              >
                Personnes Physiques
              </button>
              <button
                type="button"
                onClick={() => setHolderFilter("SOCIETE")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                  holderFilter === "SOCIETE"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground hover:bg-muted border-border"
                }`}
              >
                Sociétés
              </button>

              {(holderFilter !== "ALL" || holderSearch) && (
                <button
                  type="button"
                  onClick={() => {
                    setHolderFilter("ALL");
                    setHolderSearch("");
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground underline ml-2"
                >
                  <X className="h-3 w-3" />
                  Réinitialiser
                </button>
              )}
            </div>

            <div className="relative sm:w-80">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={holderSearch}
                onChange={(e) => setHolderSearch(e.target.value)}
                placeholder="Rechercher par ayant droit, IPI, œuvre..."
                className="w-full rounded-lg border bg-card pl-9 pr-8 py-1.5 text-xs shadow-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {holderSearch && (
                <button
                  type="button"
                  onClick={() => setHolderSearch("")}
                  className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Barre d'Options Avancées des Décomptes (US-4.6) */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 px-3.5 py-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                <span>Regroupement des Décomptes :</span>
              </span>
              <div className="inline-flex rounded-lg border bg-background p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setStatementGroupBy("WORK")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    statementGroupBy === "WORK"
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Par Œuvre
                </button>
                <button
                  type="button"
                  onClick={() => setStatementGroupBy("PROJECT")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    statementGroupBy === "PROJECT"
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Par Projet / Série TV
                </button>
                <button
                  type="button"
                  onClick={() => setStatementGroupBy("TERRITORY")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    statementGroupBy === "TERRITORY"
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Par Territoire
                </button>
                <button
                  type="button"
                  onClick={() => setStatementGroupBy("RIGHT_TYPE")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    statementGroupBy === "RIGHT_TYPE"
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Par Famille de Droits
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Toggle Langue */}
              <div className="flex items-center gap-1">
                <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="inline-flex rounded-lg border bg-background p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setStatementLanguage("FR")}
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                      statementLanguage === "FR"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    FR
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatementLanguage("EN")}
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                      statementLanguage === "EN"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    EN
                  </button>
                </div>
              </div>

              {/* Toggle Masquer soldes nuls */}
              <label className="inline-flex cursor-pointer items-center gap-1.5 select-none text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  checked={hideZeroBalances}
                  onChange={(e) => setHideZeroBalances(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary/20 h-3.5 w-3.5"
                />
                <span className="flex items-center gap-1 font-medium">
                  <Filter className="h-3 w-3" />
                  <span>Masquer soldes nuls (0 €)</span>
                </span>
              </label>
            </div>
          </div>

          {/* Tableau Haute Densité des Ayants Droit */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="flex flex-col justify-between gap-2 border-b px-4 py-2.5 sm:flex-row sm:items-center bg-muted/20">
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Synthèse Périodique de Répartition SACEM par Ayant Droit
                </h2>
                <p className="text-xs text-muted-foreground">
                  Application déterministe des clés du catalogue • Ventilation des règles selon statut juridique (Personne Physique vs Société)
                </p>
              </div>
              <div className="font-mono text-xs text-muted-foreground">
                {filteredHolders.length} ayant(s) droit affiché(s)
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground border-b">
                  <tr>
                    <th className="px-3 py-2 font-medium w-8"></th>
                    <th className="px-3 py-2 font-medium">Bénéficiaire / Ayant Droit</th>
                    <th className="px-3 py-2 font-medium">Rôle &amp; IPI</th>
                    <th className="px-3 py-2 text-center font-medium">Œuvres SACEM</th>
                    <th className="px-3 py-2 text-right font-medium">Brut Alloué SACEM</th>
                    <th className="px-3 py-2 text-right font-medium">Avance &amp; Amortissement</th>
                    <th className="px-3 py-2 text-right font-medium">Base Nette HT</th>
                    <th className="px-3 py-2 text-right font-medium">Régime Fiscal &amp; Social</th>
                    <th className="px-3 py-2 text-right font-medium">Net à Payer (SEPA)</th>
                    <th className="px-3 py-2 text-right font-medium">Actions 1-Clic</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredHolders.length > 0 ? (
                    filteredHolders.map((h, i) => {
                      const isExpanded = expandedHolderNames.has(h.holder_name);
                      const isCompany = h.entity_type === "SOCIETE";
                      const gross = parseFloat(h.gross_royalties_allocated) || 0;
                      const initialAdv = parseFloat(h.initial_advance || "0") || 0;
                      const recouped = parseFloat(h.recouped_in_period) || 0;
                      const remainingAdv = parseFloat(h.remaining_unrecouped_balance || "0") || 0;
                      const taxableHt = parseFloat(h.taxable_base_ht || "0") || Math.max(0, gross - recouped);
                      const precompte = parseFloat(h.precompte_social_amount || h.precompte_ircec_amount || "0") || 0;
                      const netPayable = parseFloat(h.net_payable_amount) || 0;
                      const worksCount = h.works_count || (h.works_breakdown?.length || 0);

                      return (
                        <>
                          <tr key={i} className="hover:bg-muted/20 transition-colors">
                            {/* Bouton déplier accordéon */}
                            <td className="px-3 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => toggleExpandHolder(h.holder_name)}
                                title={isExpanded ? "Replier le détail des œuvres" : "Voir le détail des œuvres"}
                                className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </td>

                            {/* Identité de l'ayant droit */}
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-semibold text-foreground">
                                  {h.holder_name}
                                </div>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  isCompany
                                    ? "bg-indigo-500/10 text-indigo-700 border border-indigo-500/30"
                                    : "bg-blue-500/10 text-blue-700 border border-blue-500/30"
                                }`}>
                                  {isCompany ? "Société" : "Personne Physique"}
                                </span>
                                {(h.is_deceased || h.succession_active) && (
                                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-purple-500/15 text-purple-800 border border-purple-500/30 flex items-center gap-1">
                                    <ScrollText className="h-3 w-3" />
                                    <span>Succession {h.heirs_distribution && h.heirs_distribution.length > 0 ? `(${h.heirs_distribution.length})` : ""}</span>
                                  </span>
                                )}
                                {h.payout_recipient_name && (
                                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-sky-500/15 text-sky-800 border border-sky-500/30 flex items-center gap-1" title={`Virement mandaté vers : ${h.payout_recipient_name}`}>
                                    <ArrowRightLeft className="h-3 w-3" />
                                    <span>Tiers Payé ➔ {h.payout_recipient_name}</span>
                                  </span>
                                )}
                                {h.payout_status === "BELOW_THRESHOLD" ? (
                                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-500/15 text-amber-800 border border-amber-500/30">
                                    En réserve (&lt; 50 €)
                                  </span>
                                ) : h.payout_status === "RECOUPING" ? (
                                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-blue-500/15 text-blue-800 border border-blue-500/30">
                                    Avance en cours
                                  </span>
                                ) : h.payout_status === "ZERO_BALANCE" ? (
                                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-muted border text-muted-foreground">
                                    Solde nul
                                  </span>
                                ) : statement.accounting_status === "PAID" && netPayable > 0 ? (
                                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-600 text-white shadow-xs flex items-center gap-1">
                                    <BadgeCheck className="h-3 w-3" />
                                    <span>Payé ({statement.payment_method || "SEPA"})</span>
                                  </span>
                                ) : (
                                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-500/15 text-emerald-800 border border-emerald-500/30">
                                    {statement.accounting_status === "LOCKED" ? "À décaisser (LOCKED)" : "À payer"}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {h.legal_form || (isCompany ? "Société commerciale" : "Artiste-Auteur")}
                                {h.contract_reference ? ` • Contrat ${h.contract_reference}` : ""}
                                {parseFloat(h.previous_reserve_balance || "0") > 0 && (
                                  <span className="font-mono text-indigo-700 font-semibold ml-1.5">
                                    • Report précédent : +{Number(h.previous_reserve_balance).toLocaleString("fr-FR")} €
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Rôle & IPI */}
                            <td className="px-3 py-2.5">
                              <div className="font-mono text-xs font-semibold">
                                {h.role || "AC"}
                              </div>
                              <div className="font-mono text-[11px] text-muted-foreground">
                                IPI {h.ipi_number || "N/A"}
                              </div>
                            </td>

                            {/* Nombre d'œuvres créditées */}
                            <td className="px-3 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => toggleExpandHolder(h.holder_name)}
                                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-foreground hover:bg-accent"
                              >
                                <span>{worksCount}</span>
                                <span>œuvre{worksCount > 1 ? "s" : ""}</span>
                              </button>
                            </td>

                            {/* Brut Alloué SACEM */}
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-foreground">
                              {Number(gross).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                            </td>

                            {/* Avance Initiale & Retenue */}
                            <td className="px-3 py-2.5 text-right font-mono">
                              {initialAdv > 0 ? (
                                <div>
                                  <div className="text-amber-700 font-semibold">
                                    - {Number(recouped).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    Reste : {Number(remainingAdv).toLocaleString("fr-FR")} €
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>

                            {/* Base Nette HT */}
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-foreground">
                              {Number(taxableHt).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                            </td>

                            {/* Régime Fiscal & Social */}
                            <td className="px-3 py-2.5 text-right text-[11px]">
                              {isCompany ? (
                                <div>
                                  <span className="font-mono text-primary font-semibold">
                                    TVA {Number(h.vat_rate_pct || "10.00").toFixed(0)}%
                                  </span>
                                  <div className="text-[10px] text-muted-foreground">
                                    0% Précompte
                                  </div>
                                </div>
                              ) : h.urssaf_dispense_certificate ? (
                                <div>
                                  <span className="text-emerald-700 font-semibold">
                                    Dispense BNC
                                  </span>
                                  <div className="text-[10px] text-muted-foreground">
                                    0% Précompte
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <span className="font-mono text-amber-700 font-semibold">
                                    - {Number(precompte).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                                  </span>
                                  <div className="text-[10px] text-muted-foreground">
                                    Précompte URSSAF ~11,10%
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* Net à Payer */}
                            <td className="px-3 py-2.5 text-right font-mono">
                              {h.payout_status === "BELOW_THRESHOLD" ? (
                                <div>
                                  <span className="text-muted-foreground font-semibold text-xs">0,00 €</span>
                                  <div className="text-[10px] text-amber-700 font-semibold font-sans">
                                    En réserve : {Number(h.retained_in_reserve || "0").toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                                  </div>
                                  <div className="text-[9px] text-muted-foreground font-sans">
                                    Reporté au semestre suiv.
                                  </div>
                                </div>
                              ) : h.payout_status === "RECOUPING" ? (
                                <div>
                                  <span className="text-muted-foreground font-semibold text-xs">0,00 €</span>
                                  <div className="text-[10px] text-blue-700 font-medium font-sans">
                                    Amortissement avance
                                  </div>
                                  <div className="text-[9px] text-muted-foreground font-sans">
                                    Solde débiteur reporté
                                  </div>
                                </div>
                              ) : h.payout_status === "ZERO_BALANCE" ? (
                                <div>
                                  <span className="text-muted-foreground font-semibold text-xs">0,00 €</span>
                                  <div className="text-[10px] text-muted-foreground font-sans">Solde nul</div>
                                </div>
                              ) : (
                                <div>
                                  <span className="font-mono font-bold text-emerald-700 text-sm">
                                    {Number(netPayable).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                                  </span>
                                  <div className="text-[10px] text-emerald-700/80 font-medium font-sans">
                                    Prêt au virement
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* Actions 1-Clic */}
                            <td className="px-3 py-2.5 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenAuthorStatement(h)}
                                className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
                                title="Voir le décompte légal d'auteur détaillé œuvre par œuvre"
                              >
                                <FileText className="h-3 w-3" />
                                <span>Décompte</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenHolderInvoice(h)}
                                className="inline-flex items-center gap-1 rounded-md border border-indigo-500/40 bg-indigo-500/10 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-500/20 transition-colors"
                                title={isCompany ? "Générer la facture Factur-X" : "Générer la note de droits d'auteur"}
                              >
                                <Receipt className="h-3 w-3" />
                                <span>{isCompany ? "Facture" : "Note Droits"}</span>
                              </button>
                            </td>
                          </tr>

                          {/* Accordéon déroulé : Détail Œuvre par Œuvre pour cet ayant droit */}
                          {isExpanded && (
                            <tr key={`${i}-expanded`} className="bg-muted/15 border-b">
                              <td colSpan={10} className="px-6 py-3">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                                    <div className="flex items-center gap-1.5 text-primary">
                                      <Disc3 className="h-3.5 w-3.5" />
                                      <span>
                                        Œuvres créditées dans ce décompte SACEM pour {h.holder_name}
                                      </span>
                                    </div>
                                    <span className="text-[11px]">
                                      Total : {Number(gross).toLocaleString("fr-FR")} € alloués
                                    </span>
                                  </div>

                                  <div className="rounded-lg border bg-background overflow-hidden">
                                    {(() => {
                                      const list = (h.works_breakdown || []).filter(
                                        (wb) => !hideZeroBalances || parseFloat(wb.allocated_amount || "0") > 0
                                      );
                                      type GroupEntry = {
                                        label: string;
                                        key: string;
                                        lines: typeof list;
                                        totalGross: number;
                                        totalAlloc: number;
                                      };
                                      let grouped: GroupEntry[] = [];

                                      if (statementGroupBy === "WORK") {
                                        grouped = [
                                          {
                                            label: "Toutes les œuvres",
                                            key: "ALL",
                                            lines: list,
                                            totalGross: list.reduce((acc, l) => acc + (parseFloat(l.gross_line_amount) || 0), 0),
                                            totalAlloc: list.reduce((acc, l) => acc + (parseFloat(l.allocated_amount) || 0), 0),
                                          },
                                        ];
                                      } else {
                                        const map = new Map<string, GroupEntry>();
                                        for (const item of list) {
                                          let key = "";
                                          let label = "";
                                          if (statementGroupBy === "PROJECT") {
                                            key = item.work_group_title || "Catalogue Général / Hors Projet";
                                            label = `Projet / Série TV : ${key}`;
                                          } else if (statementGroupBy === "TERRITORY") {
                                            key = item.territory || "FR";
                                            const terrLabels: Record<string, string> = {
                                              FR: "France",
                                              DE: "Allemagne",
                                              GB: "Royaume-Uni",
                                              US: "États-Unis",
                                              IT: "Italie",
                                              ES: "Espagne",
                                              CA: "Canada",
                                              JP: "Japon",
                                              WORLD: "Monde Entier",
                                            };
                                            label = `Territoire : ${terrLabels[key] || key} (${key})`;
                                          } else {
                                            key = item.right_type;
                                            const rtLabels: Record<string, string> = {
                                              DEP: "Droits d'Exécution Publique (DEP)",
                                              DRM: "Droits de Reproduction Mécanique (DRM)",
                                              SYNC: "Synchronisation Audiovisuelle (SYNC)",
                                              PHONO: "Master Phonographique / Voisins (PHONO)",
                                              DSN: "Droits Numériques & Streaming (DSN)",
                                            };
                                            label = `Famille de Droits : ${rtLabels[key] || key}`;
                                          }
                                          if (!map.has(key)) {
                                            map.set(key, { label, key, lines: [], totalGross: 0, totalAlloc: 0 });
                                          }
                                          const entry = map.get(key)!;
                                          entry.lines.push(item);
                                          entry.totalGross += parseFloat(item.gross_line_amount || "0");
                                          entry.totalAlloc += parseFloat(item.allocated_amount || "0");
                                        }
                                        grouped = Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
                                      }

                                      return (
                                        <table className="w-full text-left text-xs">
                                          <thead className="bg-muted/50 border-b text-[11px] text-muted-foreground">
                                            <tr>
                                              <th className="px-3 py-1.5">Titre de l&apos;œuvre</th>
                                              <th className="px-3 py-1.5">ISWC</th>
                                              <th className="px-3 py-1.5">Type de Droit</th>
                                              <th className="px-3 py-1.5">Exploitation</th>
                                              <th className="px-3 py-1.5 text-right">Brut Ligne SACEM</th>
                                              <th className="px-3 py-1.5 text-right">Quote-part (%)</th>
                                              <th className="px-3 py-1.5 text-right">Revenu Alloué (€)</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y">
                                            {grouped.length > 0 && grouped.some((g) => g.lines.length > 0) ? (
                                              grouped.map((grp, gIdx) => (
                                                <Fragment key={gIdx}>
                                                  {statementGroupBy !== "WORK" && (
                                                    <tr className="bg-muted/40 font-semibold border-t">
                                                      <td colSpan={4} className="px-3 py-1.5 text-foreground">
                                                        <div className="flex items-center gap-2">
                                                          <span className="font-bold text-xs">{grp.label}</span>
                                                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
                                                            {grp.lines.length} œuvre(s)
                                                          </span>
                                                        </div>
                                                      </td>
                                                      <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                                                        {grp.totalGross.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                                                      </td>
                                                      <td className="px-3 py-1.5 text-right font-mono text-[11px] text-muted-foreground">
                                                        Sous-total :
                                                      </td>
                                                      <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-700">
                                                        {grp.totalAlloc.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                                                      </td>
                                                    </tr>
                                                  )}
                                                  {grp.lines.map((wb, wIdx) => (
                                                    <tr key={`${gIdx}-${wIdx}`} className="hover:bg-muted/10">
                                                      <td className="px-3 py-1.5 font-semibold text-foreground">
                                                        {wb.work_title}
                                                        {wb.work_group_title && statementGroupBy !== "PROJECT" && (
                                                          <span className="block text-[10px] font-normal text-muted-foreground">
                                                            Projet : {wb.work_group_title}
                                                          </span>
                                                        )}
                                                      </td>
                                                      <td className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                                                        {wb.iswc || "Non renseigné"}
                                                      </td>
                                                      <td className="px-3 py-1.5">
                                                        <span className="rounded bg-secondary px-1 py-0.5 font-mono text-[10px] font-bold">
                                                          {wb.right_type}
                                                        </span>
                                                        <span className="ml-1 text-[10px] text-muted-foreground">
                                                          ({wb.territory || "FR"})
                                                        </span>
                                                      </td>
                                                      <td className="px-3 py-1.5 text-muted-foreground text-[11px]">
                                                        {wb.exploitation_type || "STREAMING"}
                                                      </td>
                                                      <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                                                        {Number(wb.gross_line_amount).toLocaleString("fr-FR")} €
                                                      </td>
                                                      <td className="px-3 py-1.5 text-right font-mono font-medium">
                                                        {Number(wb.share_percentage).toFixed(2)} %
                                                      </td>
                                                      <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-700">
                                                        {Number(wb.allocated_amount).toLocaleString("fr-FR")} €
                                                      </td>
                                                    </tr>
                                                  ))}
                                                </Fragment>
                                              ))
                                            ) : (
                                              <tr>
                                                <td colSpan={7} className="px-3 py-2 text-center text-muted-foreground italic">
                                                  Synthèse globale enregistrée sur ce décompte SACEM ({Number(gross).toLocaleString("fr-FR")} €).
                                                </td>
                                              </tr>
                                            )}
                                          </tbody>
                                        </table>
                                      );
                                    })()}
                                  </div>

                                  {(h.heirs_distribution && h.heirs_distribution.length > 0) && (
                                    <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3 space-y-2">
                                      <div className="flex items-center justify-between text-xs font-semibold text-purple-900">
                                        <div className="flex items-center gap-1.5">
                                          <ScrollText className="h-3.5 w-3.5 text-purple-700" />
                                          <span>Dévolution successorale indivise — Ventilation entre les héritiers de {h.holder_name}</span>
                                        </div>
                                        <span className="text-[11px] font-mono font-bold text-purple-700">
                                          Net total dévolu : {Number(netPayable).toLocaleString("fr-FR")} €
                                        </span>
                                      </div>
                                      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                                        {h.heirs_distribution.map((hr, hrIdx) => (
                                          <div key={hrIdx} className="rounded-md border bg-card p-2 text-xs space-y-1">
                                            <div className="flex items-center justify-between font-bold text-foreground">
                                              <span>{hr.heir_name}</span>
                                              <span className="font-mono text-purple-700">{hr.share_pct} %</span>
                                            </div>
                                            <div className="text-[10px] text-muted-foreground">{hr.relationship}</div>
                                            <div className="flex items-center justify-between font-mono text-[11px] pt-1 border-t">
                                              <span className="text-muted-foreground">Net à payer :</span>
                                              <span className="font-bold text-emerald-700">{Number(hr.net_payable).toLocaleString("fr-FR")} €</span>
                                            </div>
                                            {hr.iban && (
                                              <div className="font-mono text-[10px] text-muted-foreground truncate" title={hr.iban}>
                                                IBAN: {hr.iban}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {h.payout_recipient_name && (
                                    <div className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-sky-900">
                                      <ArrowRightLeft className="h-4 w-4 text-sky-600 shrink-0" />
                                      <div>
                                        <strong>Virement SEPA mandaté vers le Tiers Payé désigné :</strong> {h.payout_recipient_name}
                                        {h.iban ? ` (IBAN: ${h.iban})` : ""}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                        Aucun ayant droit ne correspond à ces critères de recherche.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VUE 2 : RAPPROCHEMENT DES ŒUVRES & CATALOGUE                    */}
      {/* ============================================================== */}
      {activeTab === "WORKS_RECONCILIATION" && (
        <div className="space-y-4">
          {/* Barre de triage rapide */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                  statusFilter === "ALL"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground hover:bg-muted border-border"
                }`}
              >
                Toutes ({statement.lines.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("PENDING")}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                  statusFilter === "PENDING"
                    ? "bg-amber-600 text-white border-amber-600"
                    : "bg-card text-amber-700 hover:bg-amber-50 border-amber-500/30"
                }`}
              >
                <AlertTriangle className="h-3 w-3" />
                <span>À arbitrer</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("VALIDATED")}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                  statusFilter === "VALIDATED"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-card text-emerald-700 hover:bg-emerald-50 border-emerald-500/30"
                }`}
              >
                <CheckCircle2 className="h-3 w-3" />
                <span>Validées</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("BLACK_BOX")}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                  statusFilter === "BLACK_BOX"
                    ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                    : "bg-card text-purple-700 hover:bg-purple-50 border-purple-500/30"
                }`}
              >
                <Layers className="h-3 w-3" />
                <span>Black Box ({blackBoxLinesCount})</span>
              </button>

              <button
                type="button"
                onClick={handleValidateBatchHighConfidence}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 transition-colors ml-1"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Valider lot ≥ 90%</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* US-5.2 : Option de tri par montant brut décroissant (€) pour loi de Pareto */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-muted-foreground hidden lg:inline">
                  Trier par :
                </span>
                <select
                  value={lineSortBy}
                  onChange={(e) =>
                    setLineSortBy(
                      e.target.value as
                        | "DEFAULT"
                        | "GROSS_AMOUNT_DESC"
                        | "GROSS_AMOUNT_ASC"
                        | "CONFIDENCE_ASC"
                    )
                  }
                  className="rounded-lg border bg-card px-2.5 py-1.5 text-xs font-semibold shadow-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label="Trier les lignes de réconciliation"
                >
                  <option value="DEFAULT">Ordre du relevé (#)</option>
                  <option value="GROSS_AMOUNT_DESC">
                    Trier par montant décroissant (€) [Pareto 80/20]
                  </option>
                  <option value="GROSS_AMOUNT_ASC">
                    Trier par montant croissant (€)
                  </option>
                  <option value="CONFIDENCE_ASC">
                    Score de confiance croissant
                  </option>
                </select>
              </div>

              <div className="relative sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={lineSearch}
                  onChange={(e) => setLineSearch(e.target.value)}
                  placeholder="Filtrer par titre, ISWC, ISRC..."
                  className="w-full rounded-lg border bg-card pl-9 pr-8 py-1.5 text-xs shadow-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {lineSearch && (
                  <button
                    type="button"
                    onClick={() => setLineSearch("")}
                    className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bannière indicative de tri Pareto */}
          {lineSortBy === "GROSS_AMOUNT_DESC" && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-foreground">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>
                  <strong>Priorisation Pareto (80/20) :</strong> Lignes ordonnées par montant brut décroissant (€) pour traiter en priorité les flux financiers majeurs.
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                {sortedFilteredLines.length} ligne(s)
              </span>
            </div>
          )}

          {/* Tableau des lignes */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Titre Brut SACEM &amp; Métadonnées</th>
                    <th className="px-3 py-2 font-medium">Œuvre Catalogue (Rapprochement)</th>
                    <th className="px-3 py-2 font-medium">Méthode &amp; Confiance</th>
                    <th className="px-3 py-2 text-right font-medium">Droit / Brut (€)</th>
                    <th className="px-3 py-2 text-right font-medium">Action Human-in-the-loop</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedFilteredLines.map((line) => (
                    <tr key={line.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono text-muted-foreground">
                        {line.row_number}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-foreground">
                            {line.raw_work_title}
                          </span>
                          {!line.raw_iswc && !line.raw_isrc && (
                            <span className="rounded bg-purple-500/10 border border-purple-500/30 px-1.5 py-0.2 text-[9px] font-bold text-purple-700">
                              Black Box
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {line.raw_performer || "Interprète N/A"} •{" "}
                          {line.raw_iswc
                            ? `ISWC ${line.raw_iswc}`
                            : line.raw_isrc
                              ? `ISRC ${line.raw_isrc}`
                              : "Sans code ISWC/ISRC"}
                        </div>
                        {line.match_reasoning && (
                          <div className="mt-1 flex items-start gap-1 rounded border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] text-foreground">
                            <Info className="h-3 w-3 shrink-0 text-primary mt-0.5" />
                            <span>
                              <strong>Raison :</strong> {line.match_reasoning}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {line.validation_status === "PENDING_REVIEW" ? (
                          <select
                            value={line.matched_work_id || ""}
                            onChange={(e) =>
                              handleSelectAlternativeWork(line.id, e.target.value)
                            }
                            className="w-full max-w-xs rounded border bg-card px-2 py-1 text-xs font-medium text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            {catalogOptions.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.title} {opt.iswc ? `(${opt.iswc})` : ""}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex items-center gap-1.5 font-semibold text-primary">
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>{line.matched_work_title || "Aucun match"}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <ConfidenceBadge score={line.confidence_score} />
                          <MatchMethodBadge method={line.match_method} />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="mr-1.5 rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px]">
                          {line.right_type}
                        </span>
                        <div className="inline-block text-right">
                          {line.source_currency && line.source_currency !== "EUR" && (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {Number(line.source_gross_amount || line.gross_amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {line.source_currency}
                            </div>
                          )}
                          <span className="font-mono font-bold">
                            {Number(line.gross_amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {line.validation_status === "PENDING_REVIEW" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleValidateLine(line)}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Valider</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedLineForWorkCreation(line)}
                              title="Créer l'œuvre au catalogue et apparier en 1 clic (Passerelle Black Box)"
                              className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary shadow-xs hover:bg-primary/20 transition-colors"
                            >
                              <PlusCircle className="h-3.5 w-3.5" />
                              <span>+ Créer Œuvre</span>
                            </button>
                          </div>
                        ) : (
                          <ValidationStatusBadge status={line.validation_status} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VUE 3 : INGESTION & HISTORIQUE DES DÉCOMPTES SACEM            */}
      {/* ============================================================== */}
      {activeTab === "STATEMENTS_INGESTION" && (
        <div className="space-y-4">
          {/* Zone de Drag and Drop Compacte */}
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-card p-6 text-center hover:border-primary hover:bg-primary/5 transition-colors">
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            <div>
              <span className="text-sm font-bold text-foreground">
                Glissez-déposez ici votre fichier de décompte SACEM (CSV, XLSX, TXT)
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Prise en charge native des fichiers de répartition trimestrielle SACEM (T1, T2, T3, T4) et DSP
              </p>
            </div>
            <input
              type="file"
              accept=".csv,.xlsx,.txt"
              onChange={handleCsvUpload}
              className="hidden"
            />
          </label>

          {/* Liste des décomptes disponibles */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="border-b px-4 py-3 bg-muted/20">
              <h2 className="text-sm font-bold text-foreground">
                Historique des Décomptes &amp; Répartitions Reçus
              </h2>
            </div>
            <div className="divide-y text-xs">
              {statementsList.map((st) => (
                <div
                  key={st.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 hover:bg-muted/15 transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-sm">
                        {st.source_name}
                      </span>
                      {st.accounting_status === "PAID" ? (
                        <span className="rounded bg-emerald-500/15 text-emerald-800 font-mono text-[10px] font-bold px-1.5 py-0.5 border border-emerald-500/30">
                          PAID (Réglé)
                        </span>
                      ) : st.accounting_status === "LOCKED" ? (
                        <span className="rounded bg-indigo-500/10 text-indigo-700 font-mono text-[10px] font-bold px-1.5 py-0.5 border border-indigo-500/30">
                          LOCKED (Grand Livre)
                        </span>
                      ) : (
                        <span className="rounded bg-amber-500/10 text-amber-700 font-mono text-[10px] font-bold px-1.5 py-0.5 border border-amber-500/30">
                          DRAFT (Simulation)
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground text-[11px]">
                      Période : {st.period_start} au {st.period_end} • Fichier source : {st.filename || "repartition.csv"}
                      {st.source_currency && st.source_currency !== "EUR" && (
                        <span className="ml-2 font-mono text-primary font-semibold">
                          ({Number(st.source_gross_amount || st.total_gross_amount).toLocaleString("fr-FR")} {st.source_currency} @ {st.exchange_rate})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm text-foreground">
                      {Number(st.total_gross_amount).toLocaleString("fr-FR")} €
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectStatement(st.id);
                        setActiveTab("HOLDERS_SUMMARY");
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
                    >
                      <span>Ouvrir Bilan</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VUE 4 : CAMPAGNES DE RÉPARTITION MULTI-RELEVÉS (US-5.7)        */}
      {/* ============================================================== */}
      {activeTab === "CAMPAIGNS_CONSOLIDATION" && (
        <CampaignsConsolidationView
          statementsList={statementsList}
          onRefreshStatements={refreshStatementsList}
        />
      )}
      </>
      )}

      {/* Modale Décompte d'Auteur Individuel */}
      <HolderStatementModal
        isOpen={isStatementModalOpen}
        onClose={() => setIsStatementModalOpen(false)}
        holder={selectedHolderForStatement}
        statementId={statement.id}
        statementSource={statement.source_name}
        periodLabel={`${statement.period_start} au ${statement.period_end}`}
        onOpenInvoice={handleOpenHolderInvoice}
        initialGroupBy={statementGroupBy}
        initialLanguage={statementLanguage}
        initialHideZeroLines={hideZeroBalances}
      />

      {/* Modale Facture / Note de Droits Prête à l'Emploi */}
      <HolderInvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        invoiceData={selectedInvoiceData}
      />

      {/* Modale d'Importation de Relevé Multi-Devises (US-4.5) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Coins className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Importer un Relevé de Redevances
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    CSV multi-devises avec parité de change déterministe (USD, GBP, EUR)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setUploadFile(null);
                }}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmUpload} className="space-y-3.5">
              {/* Sélecteur de fichier si non choisi */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Fichier Relevé CSV
                </label>
                {uploadFile ? (
                  <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-2.5 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-mono font-medium truncate">{uploadFile.name}</span>
                      <span className="text-muted-foreground">({(uploadFile.size / 1024).toFixed(1)} Ko)</span>
                    </div>
                    <label className="cursor-pointer text-primary font-semibold hover:underline text-[11px] shrink-0 ml-2">
                      Changer
                      <input
                        type="file"
                        accept=".csv,.xlsx,.txt"
                        onChange={handleSelectUploadFile}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/10 p-6 text-center cursor-pointer transition-colors">
                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-xs font-semibold text-foreground">
                      Cliquez pour sélectionner un fichier CSV de relevé
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">
                      Formats acceptés : SACEM, Spotify US, Apple Music, PRS, CSV personnalisé
                    </span>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.txt"
                      onChange={handleSelectUploadFile}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Nom du relevé */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Nom du Relevé / Source
                </label>
                <input
                  type="text"
                  required
                  value={uploadSourceName}
                  onChange={(e) => setUploadSourceName(e.target.value)}
                  className="w-full rounded-md border bg-card px-2.5 py-1.5 text-xs"
                  placeholder="Ex : Spotify US Q3 2026, BMI Foreign 2026..."
                />
              </div>

              {/* Devise et Taux de Change */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border bg-muted/20">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Devise du Relevé
                  </label>
                  <select
                    value={uploadCurrency}
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                    className="w-full rounded-md border bg-card px-2 py-1.5 text-xs font-mono font-semibold"
                  >
                    <option value="EUR">EUR (€) - Euro (Pivot)</option>
                    <option value="USD">USD ($) - Dollar US</option>
                    <option value="GBP">GBP (£) - Livre Sterling</option>
                    <option value="CAD">CAD (C$) - Dollar Canadien</option>
                    <option value="CHF">CHF (CHF) - Franc Suisse</option>
                    <option value="JPY">JPY (¥) - Yen Japonais</option>
                    <option value="AUD">AUD (A$) - Dollar Australien</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Taux vers EUR (1 {uploadCurrency} = X €)
                  </label>
                  <input
                    type="text"
                    disabled={uploadCurrency === "EUR"}
                    value={uploadCurrency === "EUR" ? "1.000000" : uploadExchangeRate}
                    onChange={(e) => setUploadExchangeRate(e.target.value)}
                    className="w-full rounded-md border bg-card px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-700 disabled:opacity-50"
                  />
                </div>

                {uploadCurrency !== "EUR" && (
                  <div className="col-span-2 text-[11px] text-muted-foreground bg-card p-2 rounded border space-y-0.5">
                    <p className="font-semibold text-foreground">
                      Parité déterministe certifiée :
                    </p>
                    <p>
                      Les montants bruts du relevé seront convertis en EUR avec 6 décimales de précision (zéro perte de centime). La devise d&apos;origine ({uploadCurrency}) restera consultable sur chaque ligne et au Grand Livre.
                    </p>
                  </div>
                )}
              </div>

              {/* Boutons d'action */}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setUploadFile(null);
                  }}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
                >
                  <Coins className="h-3.5 w-3.5" />
                  <span>{isUploading ? "Importation & Conversion..." : "Lancer l'Ingestion"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. Modale Clôture Comptable Périodique (DRAFT ➔ LOCKED) */}
      {isClosingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Clôture Comptable Périodique &amp; Verrouillage
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {statement.source_name} • {statement.period_start} au {statement.period_end}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsClosingModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Synthèse chiffrée de la clôture */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-xl border bg-muted/30">
                <div className="text-[10px] uppercase font-bold text-muted-foreground">Brut Réparti</div>
                <div className="font-mono text-sm font-bold text-emerald-700 mt-0.5">
                  {Number(royaltyReport?.total_allocated_checksum || "0.00").toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                </div>
              </div>
              <div className="p-2.5 rounded-xl border bg-muted/30">
                <div className="text-[10px] uppercase font-bold text-muted-foreground">Avances Amorties</div>
                <div className="font-mono text-sm font-bold text-amber-700 mt-0.5">
                  - {Number(royaltyReport?.total_recouped_in_period || "0.00").toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                </div>
              </div>
              <div className="p-2.5 rounded-xl border bg-muted/30">
                <div className="text-[10px] uppercase font-bold text-muted-foreground">En Réserve (&lt; 50 €)</div>
                <div className="font-mono text-sm font-bold text-amber-600 mt-0.5">
                  {Number(royaltyReport?.total_retained_in_reserve || "0.00").toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                </div>
              </div>
              <div className="p-2.5 rounded-xl border bg-muted/30">
                <div className="text-[10px] uppercase font-bold text-muted-foreground">Net à Décaisser</div>
                <div className="font-mono text-sm font-bold text-emerald-700 mt-0.5">
                  {Number(royaltyReport?.total_net_payable || "0.00").toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                </div>
              </div>
            </div>

            {/* Somme de contrôle & Intégrité */}
            <div className="flex items-center justify-between p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-xs">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
                <ShieldCheck className="h-4 w-4" />
                <span>Somme de contrôle 100.00 % validée</span>
              </div>
              <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                {royaltyReport?.holder_statements.length || 0} ayants droit crédités
              </span>
            </div>

            {/* Observations optionnelles */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Observations ou note de clôture (optionnel) :
              </label>
              <input
                type="text"
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="Ex: Clôture semestrielle validée en comité DAF"
                className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs"
              />
            </div>

            {/* Avertissement d'immuabilité */}
            <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Conséquences de la clôture (statut LOCKED) :</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Les décomptes sont figés, les écritures du Grand Livre enregistrées et les montants d&apos;avances amortis définitivement sur les contrats. Un certificat d&apos;intégrité SHA-256 infalsifiable sera généré.
              </p>
            </div>

            {/* Boutons d'action */}
            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setIsClosingModalOpen(false)}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isClosing}
                onClick={handleConfirmClosing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
              >
                {isClosing ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verrouillage en cours...</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    <span>Confirmer la Clôture &amp; Verrouiller</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modale Enregistrement du Règlement Bancaire (LOCKED ➔ PAID) */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Enregistrer le Règlement Bancaire (PAID)
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {statement.source_name} • Net à régler : {Number(royaltyReport?.total_net_payable || "0.00").toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Mode de règlement :
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-semibold"
                  >
                    <option value="VIREMENT_SEPA">Virement SEPA Groupé (pain.001)</option>
                    <option value="VIREMENT_BANCAIRE">Virement Bancaire Standard</option>
                    <option value="CHEQUE">Chèque de Redevances</option>
                    <option value="AUTRE">Autre Moyen de Paiement</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Date effective d&apos;exécution :
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs font-mono font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Référence de transaction / virement bancaire :
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Ex: VIR-SEPA-2026-S1-001"
                  className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Notes ou observations de trésorerie (optionnel) :
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Ex: Fichier pain.001 télétransmis via Qonto"
                  className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs"
                />
              </div>

              {paymentMethod === "VIREMENT_SEPA" && (
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="text-emerald-950 dark:text-emerald-200 text-[11px]">
                      Générez et téléchargez le fichier de télétransmission bancaire SEPA XML (pain.001.001.03) pour votre banque.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPaymentModalOpen(false);
                      openSepaModal();
                    }}
                    className="shrink-0 px-2.5 py-1 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-700 text-[11px] transition-colors"
                  >
                    Générer SEPA XML →
                  </button>
                </div>
              )}

              {/* Aperçu des ayants droit à décaisser */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>Bénéficiaires payables ({royaltyReport?.holder_statements.filter((h) => parseFloat(h.net_payable_amount) > 0).length || 0})</span>
                  <span>Montant net</span>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 p-2 rounded-lg border bg-muted/20 text-xs">
                  {royaltyReport?.holder_statements
                    .filter((h) => parseFloat(h.net_payable_amount) > 0)
                    .map((h, i) => (
                      <div key={i} className="flex items-center justify-between py-0.5">
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-semibold text-foreground truncate">{h.holder_name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {h.iban ? `${h.iban.slice(0, 4)}...${h.iban.slice(-4)}` : "Pas d'IBAN"}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-foreground shrink-0">
                          {Number(h.net_payable_amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isPaying || !paymentReference.trim()}
                onClick={handleConfirmPayment}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
              >
                {isPaying ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>Valider le Règlement Bancaire (PAID)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modale Certificat d'Intégrité & Sceau Numérique */}
      {isCertificateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Certificat d&apos;Intégrité Comptable
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    Sceau probatoire Korom • Article L. 132-13 CPI
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCertificateModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Sceau SHA-256 */}
            <div className="p-3.5 rounded-xl border bg-muted/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-foreground">
                <span>Empreinte Cryptographique (SHA-256)</span>
                <button
                  type="button"
                  onClick={() => handleCopyIntegrityHash(statement.integrity_hash || royaltyReport?.integrity_hash || "")}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <Copy className="h-3 w-3" />
                  <span>{copySuccess ? "Copié !" : "Copier l'empreinte"}</span>
                </button>
              </div>
              <div className="font-mono text-[11px] p-2.5 rounded-lg bg-background border break-all leading-relaxed select-all">
                {statement.integrity_hash || royaltyReport?.integrity_hash || "Sceau généré lors de la clôture"}
              </div>
            </div>

            {/* Détails du décompte */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b">
                <span className="text-muted-foreground">Relevé source :</span>
                <span className="font-semibold text-foreground">{statement.source_name}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b">
                <span className="text-muted-foreground">Statut comptable :</span>
                <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                  {statement.accounting_status}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b">
                <span className="text-muted-foreground">Date de clôture :</span>
                <span className="font-mono">
                  {statement.locked_at ? new Date(statement.locked_at).toLocaleString("fr-FR") : "En attente"}
                </span>
              </div>
              {statement.accounting_status === "PAID" && (
                <>
                  <div className="flex items-center justify-between py-1 border-b">
                    <span className="text-muted-foreground">Date de règlement :</span>
                    <span className="font-mono">
                      {statement.paid_at ? new Date(statement.paid_at).toLocaleDateString("fr-FR") : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b">
                    <span className="text-muted-foreground">Mode de paiement :</span>
                    <span className="font-semibold">{statement.payment_method}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b">
                    <span className="text-muted-foreground">Réf. transaction :</span>
                    <span className="font-mono font-bold">{statement.payment_reference}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Total décaissé aux ayants droit :</span>
                <span className="font-mono font-bold text-emerald-700">
                  {Number(royaltyReport?.total_net_payable || "0.00").toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl border bg-muted/20 text-[11px] text-muted-foreground leading-snug">
              Ce certificat atteste que l&apos;ensemble des répartitions et imputations d&apos;avances a été calculé de manière déterministe et irrévocable, garantissant l&apos;intégrité absolue des décomptes transmis aux ayants droit.
            </div>

            <div className="flex items-center justify-end border-t pt-3">
              <button
                type="button"
                onClick={() => setIsCertificateModalOpen(false)}
                className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modale Réouverture en Mode Simulation (DRAFT) */}
      {isReopenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-amber-600 border-b pb-3">
              <RotateCcw className="h-5 w-5" />
              <h3 className="text-base font-bold text-foreground">
                Rouvrir la période en mode DRAFT
              </h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Vous êtes sur le point de déverrouiller le relevé <strong>« {statement.source_name} »</strong>.
            </p>

            <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Attention :</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px]">
                <li>Les écritures immuables du Grand Livre seront annulées.</li>
                <li>Les avances amorties seront restituées sur les contrats d&apos;édition.</li>
                <li>Le statut repassera en DRAFT pour autoriser de nouveaux arbitrages.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setIsReopenModalOpen(false)}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                Conserver le verrouillage
              </button>
              <button
                type="button"
                disabled={isReopening}
                onClick={handleConfirmReopenDraft}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-amber-700 disabled:opacity-50"
              >
                {isReopening ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Réouverture...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Confirmer la Réouverture (DRAFT)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modale Télétransmission Bancaire SEPA XML (pain.001.001.03) */}
      {isSepaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            {/* En-tête */}
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Télétransmission Bancaire SEPA XML (pain.001.001.03)
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {statement.source_name} • Norme bancaire européenne ISO 20022 EPC SCT
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSepaModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Contenu avec défilement */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {isSepaLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <div className="h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-muted-foreground font-medium">
                    Audit de conformité bancaire ISO 13616 et ventilation des virements en cours...
                  </p>
                </div>
              ) : sepaReport ? (
                <>
                  {/* Synthèse 4 cartes métriques */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="rounded-xl border bg-muted/30 p-2.5">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                        Total à virer
                      </span>
                      <div className="text-base font-bold font-mono text-emerald-600">
                        {Number(sepaReport.total_amount_eur).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {sepaReport.total_valid_recipients} virement(s)
                      </span>
                    </div>

                    <div className="rounded-xl border bg-muted/30 p-2.5">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                        Bénéficiaires éligibles
                      </span>
                      <div className="text-base font-bold font-mono text-foreground">
                        {sepaReport.total_valid_recipients} / {sepaReport.total_payees_evaluated}
                      </div>
                      <span className="text-[10px] text-emerald-600">
                        {sepaReport.included.length} transactions prêtes
                      </span>
                    </div>

                    <div className="rounded-xl border bg-muted/30 p-2.5">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                        Virements exclus / reportés
                      </span>
                      <div className="text-base font-bold font-mono text-amber-600">
                        {sepaReport.total_skipped_recipients}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        Seuil &lt; {sepaReport.min_payment_threshold} €, avances, solde 0
                      </span>
                    </div>

                    <div className="rounded-xl border bg-muted/30 p-2.5">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                        Compte Débiteur
                      </span>
                      <div className="flex items-center gap-1 mt-0.5">
                        {sepaReport.is_debtor_iban_valid ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 font-mono">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            IBAN Valide
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 font-mono">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {sepaReport.debtor_iban ? "IBAN Non Conforme" : "IBAN Manquant"}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground truncate block font-mono">
                        {sepaReport.debtor_iban ? `${sepaReport.debtor_iban.slice(0, 4)}...${sepaReport.debtor_iban.slice(-4)}` : "À renseigner"}
                      </span>
                    </div>
                  </div>

                  {/* Paramétrage du lot de virements */}
                  <div className="rounded-xl border bg-card p-3 space-y-3">
                    <div className="text-xs font-bold text-foreground flex items-center justify-between">
                      <span>Paramètres du Lot de Règlement Bancaire</span>
                      <button
                        type="button"
                        onClick={() => handleRefreshSepaPreview()}
                        className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Actualiser l&apos;audit</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div>
                        <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                          Date d&apos;exécution souhaitée :
                        </label>
                        <input
                          type="date"
                          value={sepaExecutionDate}
                          onChange={(e) => setSepaExecutionDate(e.target.value)}
                          className="w-full rounded-md border bg-background px-2.5 py-1 text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                          Libellé virement (EndToEnd / Remittance) :
                        </label>
                        <input
                          type="text"
                          value={sepaRemittancePrefix}
                          onChange={(e) => setSepaRemittancePrefix(e.target.value)}
                          placeholder="KOROM ROYALTIES"
                          className="w-full rounded-md border bg-background px-2.5 py-1 text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                          IBAN Compte Émetteur Éditeur :
                        </label>
                        <input
                          type="text"
                          value={sepaDebtorIban}
                          onChange={(e) => setSepaDebtorIban(e.target.value.toUpperCase())}
                          placeholder="FR763000..."
                          className="w-full rounded-md border bg-background px-2.5 py-1 text-xs font-mono uppercase"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="sepaAllowUnverified"
                        checked={sepaAllowUnverified}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setSepaAllowUnverified(val);
                          handleRefreshSepaPreview(val);
                        }}
                        className="rounded border-input text-emerald-600 focus:ring-emerald-500"
                      />
                      <label htmlFor="sepaAllowUnverified" className="text-[11px] text-muted-foreground cursor-pointer">
                        Autoriser l&apos;export même si des IBANs ont un format bancaire non normalisé (évite les blocages sur comptes spécifiques)
                      </label>
                    </div>
                  </div>

                  {/* Alertes bloquantes si nécessaire */}
                  {sepaReport.blocking_issues.length > 0 && !sepaAllowUnverified && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-900 dark:text-rose-200 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                        <span>Anomalies bloquantes détectées :</span>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                        {sepaReport.blocking_issues.map((issue, idx) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Fichier XML généré avec succès */}
                  {sepaXmlOutput && (
                    <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 space-y-2.5 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>Fichier SEPA XML généré avec succès !</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCopySepaXml}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-600/40 bg-card px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/10"
                          >
                            <Copy className="h-3 w-3" />
                            <span>{sepaCopySuccess ? "XML Copié !" : "Copier XML"}</span>
                          </button>
                        </div>
                      </div>

                      <div className="text-[11px] text-emerald-950 dark:text-emerald-200 font-mono space-y-0.5">
                        <div>Nom de fichier : <strong>{sepaXmlOutput.filename}</strong></div>
                        <div>MessageId EPC : <code>{sepaXmlOutput.message_id}</code></div>
                        <div>Montant total viré : <strong>{Number(sepaXmlOutput.total_amount_eur).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</strong> ({sepaXmlOutput.total_transactions} transactions)</div>
                      </div>

                      <div className="max-h-24 overflow-y-auto rounded-lg border bg-background/80 p-2 font-mono text-[10px] text-muted-foreground select-all">
                        {sepaXmlOutput.xml_content.slice(0, 500)}...
                      </div>

                      {statement.accounting_status === "LOCKED" && (
                        <div className="flex items-center justify-between pt-1 border-t border-emerald-500/20 text-xs">
                          <span className="text-muted-foreground">
                            Passer directement le relevé au statut <strong>Règlement Réalisé (PAID)</strong> :
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsSepaModalOpen(false);
                              setPaymentMethod("VIREMENT_SEPA");
                              setPaymentReference(sepaXmlOutput.message_id.slice(0, 30));
                              setIsPaymentModalOpen(true);
                            }}
                            className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition-colors"
                          >
                            Valider le paiement (PAID) →
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Onglets Détail des Ayants Droit */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 border-b pb-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setSepaTab("included")}
                        className={`font-semibold pb-1.5 px-2.5 transition-colors relative ${
                          sepaTab === "included"
                            ? "text-emerald-600 border-b-2 border-emerald-600 font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Virements Inclus ({sepaReport.included.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSepaTab("skipped")}
                        className={`font-semibold pb-1.5 px-2.5 transition-colors relative ${
                          sepaTab === "skipped"
                            ? "text-amber-600 border-b-2 border-amber-600 font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Exclus ou Reportés ({sepaReport.skipped.length})
                      </button>
                    </div>

                    {/* Contenu Onglet 1 : Inclus */}
                    {sepaTab === "included" && (
                      <div className="max-h-52 overflow-y-auto rounded-xl border bg-card text-xs">
                        {sepaReport.included.length === 0 ? (
                          <div className="p-6 text-center text-muted-foreground">
                            Aucun virement à générer. Tous les ayants droit sont sous le seuil minimal ou ont un solde nul.
                          </div>
                        ) : (
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="border-b bg-muted/40 text-[11px] text-muted-foreground text-left">
                                <th className="p-2">Bénéficiaire</th>
                                <th className="p-2">IBAN Destinataire</th>
                                <th className="p-2">Libellé Virement</th>
                                <th className="p-2 text-right">Net à Régler</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sepaReport.included.map((payee) => (
                                <tr key={payee.payee_id} className="border-b last:border-b-0 hover:bg-muted/20">
                                  <td className="p-2">
                                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                                      <span>{payee.name}</span>
                                      {payee.is_heir && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300">
                                          Héritier {payee.heir_of ? `(${payee.heir_of})` : ""}
                                        </span>
                                      )}
                                      {payee.is_mandataire && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300">
                                          Mandataire {payee.mandataire_of ? `(${payee.mandataire_of})` : ""}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                      {payee.role || "Ayant Droit"}
                                    </div>
                                  </td>
                                  <td className="p-2 font-mono text-[11px]">
                                    <div className="text-foreground">{payee.iban_formatted}</div>
                                    <div className="text-[10px] text-muted-foreground">
                                      BIC : {payee.bic || "Automatique"}
                                      {payee.is_iban_valid ? (
                                        <span className="ml-1 text-emerald-600 font-bold">✓ Modulo-97</span>
                                      ) : (
                                        <span className="ml-1 text-amber-600 font-bold">⚠ Non standard</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-2 font-mono text-[11px] text-muted-foreground truncate max-w-[200px]" title={payee.remittance_info}>
                                    {payee.remittance_info}
                                  </td>
                                  <td className="p-2 text-right font-mono font-bold text-emerald-600">
                                    {Number(payee.amount_eur).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {/* Contenu Onglet 2 : Exclus / Reportés */}
                    {sepaTab === "skipped" && (
                      <div className="max-h-52 overflow-y-auto rounded-xl border bg-card text-xs">
                        {sepaReport.skipped.length === 0 ? (
                          <div className="p-6 text-center text-muted-foreground">
                            Aucun ayant droit exclu. Tous les bénéficiaires ont des coordonnées bancaires valides et dépassent le seuil de paiement.
                          </div>
                        ) : (
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="border-b bg-muted/40 text-[11px] text-muted-foreground text-left">
                                <th className="p-2">Ayant Droit</th>
                                <th className="p-2">Motif d&apos;exclusion / report</th>
                                <th className="p-2 text-right">Net Calculé</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sepaReport.skipped.map((sk) => (
                                <tr key={sk.payee_id} className="border-b last:border-b-0 hover:bg-muted/20">
                                  <td className="p-2">
                                    <div className="font-semibold text-foreground">{sk.name}</div>
                                    <div className="text-[10px] text-muted-foreground">{sk.role || "Ayant Droit"}</div>
                                  </td>
                                  <td className="p-2">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-800 dark:text-amber-200">
                                      {sk.reason}
                                    </span>
                                  </td>
                                  <td className="p-2 text-right font-mono font-medium text-muted-foreground">
                                    {Number(sk.net_amount_eur).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Pied de page et Bouton d'action principal */}
            <div className="flex items-center justify-between border-t pt-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsSepaModalOpen(false)}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                Fermer
              </button>

              <button
                type="button"
                disabled={isSepaExporting || isSepaLoading || !sepaReport || (!sepaReport.is_ready_for_export && !sepaAllowUnverified)}
                onClick={handleExportSepaXml}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {isSepaExporting ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Génération ISO 20022...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    <span>Générer &amp; Télécharger le fichier SEPA XML (.xml)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale US-5.2 : Passerelle Black Box 1-Clic */}
      {selectedLineForWorkCreation && (
        <BlackBoxCreateModal
          isOpen={Boolean(selectedLineForWorkCreation)}
          line={selectedLineForWorkCreation}
          onClose={() => setSelectedLineForWorkCreation(null)}
          onWorkCreatedAndMatched={(updatedLine, workTitle, createdIswc) => {
            // Mise à jour de la ligne dans le relevé
            setStatement((prev) => ({
              ...prev,
              lines: prev.lines.map((l) =>
                l.id === updatedLine.id ? updatedLine : l
              ),
              validated_lines_count: prev.validated_lines_count + 1,
            }));

            // Ajout immédiat de la nouvelle œuvre dans les options catalogue
            if (updatedLine.matched_work_id) {
              setCatalogOptions((prev) => [
                ...prev,
                {
                  id: updatedLine.matched_work_id!,
                  title: workTitle,
                  iswc: createdIswc || updatedLine.raw_iswc,
                  performers: updatedLine.raw_performer
                    ? [updatedLine.raw_performer]
                    : [],
                },
              ]);
            }

            // Recalcul immédiat du rapport de répartition financière (Bilan Ayants Droit)
            if (statement.id) {
              computeStatementRoyalties(statement.id)
                .then((rep) => setRoyaltyReport(rep))
                .catch(() => {});
            }

            setLearnedAliasNotice(
              `✨ Passerelle Black Box : Œuvre « ${workTitle} » créée au catalogue et appariée à la ligne #${updatedLine.row_number} (Statut VALIDATED) !`
            );
            setTimeout(() => setLearnedAliasNotice(null), 5000);
          }}
        />
      )}
    </div>
  );
}
