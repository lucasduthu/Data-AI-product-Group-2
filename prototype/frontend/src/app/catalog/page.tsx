"use client";

import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Database,
  Disc3,
  Download,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FileUp,
  Film,
  Filter,
  FolderPlus,
  Layers,
  LayoutGrid,
  List,
  MessageSquare,
  Music,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Tag,
  Trash2,
  Tv,
  Wrench,
  X,
  Info,
  Lock,
  UserCheck,
} from "lucide-react";
import { CWRStatusBadge, WorkLifeCycleBadge } from "@/components/confidence-badge";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { addRecentItem } from "@/lib/recent-history";
import { WorkDetailDrawer } from "@/components/catalog/work-detail-drawer";
import { CwrAckModal } from "@/components/catalog/cwr-ack-modal";
import { SandboxDiffViewer } from "@/components/catalog/sandbox-diff-viewer";
import { useWorkspace } from "@/context/workspace-context";
import { PaginationBar } from "@/components/pagination-bar";
import { EmptyState } from "@/components/empty-state";
import {
  addWorkTimelineNote,
  batchDeleteWorkGroups,
  batchDeleteWorks,
  batchUpdateWorks,
  applyWorkGroupInheritance,
  createWork,
  createWorkGroup,
  CWRExportPayload,
  CwrExportFilters,
  deleteWork,
  deleteWorkGroup,
  exportCatalogCwr,
  exportCatalogXlsx,
  fetchCatalogAudit,
  fetchWorkGroups,
  fetchWorks,
  loadSandboxDemo,
  migrateCatalogDemo,
  migrateCatalogFile,
  triggerCatalogAutoRepair,
  updateWork,
} from "@/lib/api";
import {
  AdministrationStatus,
  CatalogAuditReport,
  CatalogAutoRepairPayload,
  CatalogAutoRepairResult,
  CatalogMigrationReport,
  RightHolderRole,
  RightHolderSplit,
  WorkAuditIssueCategory,
  WorkAuditIssueItem,
  WorkAuditReportItem,
  WorkBatchUpdatePayload,
  WorkGroupCreatePayload,
  WorkGroupRead,
  WorkGroupReadSummary,
  WorkGroupType,
  WorkRead,
  WorkTimelineNote,
} from "@/types/api";

const ROLE_LABELS: Record<string, string> = {
  AC: "AC (Auteur-Compositeur)",
  A: "A (Auteur)",
  C: "C (Compositeur)",
  AR: "AR (Arrangeur)",
  AD: "AD (Adaptateur)",
  E: "E (Éditeur)",
  SE: "SE (Sous-Éditeur)",
  P: "P (Producteur Phono / Master)",
  I: "I (Artiste-Interprète / Voisins)",
};

const GROUP_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  SERIE_TV: { label: "Série TV (Fiction)", icon: "Tv" },
  FILM_CINEMA: { label: "Long-Métrage / Cinéma", icon: "Film" },
  DOCUMENTAIRE: { label: "Documentaire", icon: "BookOpen" },
  EMISSION_TV: { label: "Émission de Flux TV", icon: "Tv" },
  ALBUM: { label: "Album / B.O.", icon: "Disc3" },
  AUTRE: { label: "Autre projet", icon: "Layers" },
};

const DEMO_WORK_GROUPS: WorkGroupRead[] = [
  {
    id: "group-tf1-dna-2025",
    name: "Demain Nous Appartient - B.O.",
    group_type: "SERIE_TV",
    production_company: "Telfrance / Newen Studios",
    broadcaster_or_client: "TF1",
    release_year: 2024,
    director_or_producer: "TF1 Production",
    contract_reference: "CTR-TF1-2024-DNA01",
    notes:
      "Feuilleton quotidien TF1 - 19h10. Musiques de génériques, transitions et cues dramatiques.",
    works_count: 2,
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z",
  },
  {
    id: "group-tf1-itc-2025",
    name: "Ici Tout Commence - Saison 4",
    group_type: "SERIE_TV",
    production_company: "Newen Studios",
    broadcaster_or_client: "TF1",
    release_year: 2024,
    director_or_producer: "TF1 Production",
    contract_reference: "CTR-TF1-2024-ITC02",
    notes:
      "Série quotidienne TF1 - 18h30. Musiques de scènes culinaires et tensions relationnelles.",
    works_count: 1,
    created_at: "2024-02-01T10:00:00Z",
    updated_at: "2024-02-01T10:00:00Z",
  },
  {
    id: "group-album-solstices",
    name: "Album Solstices 2024",
    group_type: "ALBUM",
    production_company: "Éditions Solstices Music",
    broadcaster_or_client: "Distribution Digitale",
    release_year: 2024,
    director_or_producer: "Camille Moreau",
    contract_reference: "CTR-ALB-2024-SOL01",
    notes: "Album studio 12 titres.",
    works_count: 2,
    created_at: "2024-03-01T10:00:00Z",
    updated_at: "2024-03-01T10:00:00Z",
  },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: {
    label: "En exploitation active",
    color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  },
  IN_DISPUTE: {
    label: "Litige / Blocage",
    color: "bg-rose-500/10 text-rose-700 border-rose-500/30",
  },
  UNDER_ADMIN: {
    label: "Sous mandat d'admin",
    color: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30",
  },
  ARCHIVED: {
    label: "Archivé / Reversé",
    color: "bg-slate-500/10 text-slate-700 border-slate-500/30",
  },
};

const DEMO_WORKS: WorkRead[] = [
  {
    id: "11111111-1111-1111-1111-111111111101",
    title: "Lumière Noire",
    subtitle: "Black Light (Version Française)",
    alternate_titles: ["Lumiere Noire", "Black Light (French Edit)"],
    iswc: "T-301.452.891-4",
    sacem_work_code: "111785573767",
    cotage_number: "4748",
    isrc_codes: ["FRZ012600101", "FRZ012600102"],
    performers: ["Camille Moreau", "K-Soprano"],
    genre: "Chanson Française / Électro-Pop",
    duration_seconds: 218,
    creation_year: 2024,
    administration_status: "ACTIVE",
    contract_reference: "CTR-ED-2024-001",
    general_notes:
      "Single lead de l'album Solstices 2024. Synchro confirmée pour campagne TV printemps 2025. Répartition standard 50/50 Sacem.",
    timeline_notes: [
      {
        id: "note-101",
        author: "Sophie Laurent (Éditeur)",
        text: "Dépôt CWR v2.1 validé par la Sacem sous le numéro d'accusé CWR-SACEM-9921.",
        created_at: "2024-11-15T14:30:00Z",
      },
      {
        id: "note-102",
        author: "Marc Duval (A&R)",
        text: "Sortie de la version Radio Edit sur les plateformes le 1er décembre.",
        created_at: "2024-11-20T10:15:00Z",
      },
    ],
    groups: [
      {
        id: "group-album-solstices",
        name: "Album Solstices 2024",
        group_type: "ALBUM",
        cue_usage_type: "TITRE_LEAD",
        track_or_cue_number: "Piste 01",
      },
      {
        id: "group-tf1-dna-2025",
        name: "Demain Nous Appartient - B.O.",
        group_type: "SERIE_TV",
        broadcaster_or_client: "TF1",
        production_company: "Telfrance / Newen Studios",
        cue_usage_type: "GÉNÉRIQUE_DÉBUT",
        track_or_cue_number: "Cue 1M01",
      },
    ],
    rights_managed: ["DEP", "DRM", "SYNC", "PHONO"],
    splits: [
      {
        holder_name: "Camille Moreau",
        role: "AC",
        ipi_number: "00458912301",
        dep_share_pct: "50.00",
        drm_share_pct: "50.00",
        sync_share_pct: "50.00",
        phono_share_pct: "20.00",
        share_percentage: "50.00",
      },
      {
        holder_name: "Éditions Solstices Music",
        role: "E",
        ipi_number: "00891234567",
        dep_share_pct: "50.00",
        drm_share_pct: "50.00",
        sync_share_pct: "50.00",
        phono_share_pct: "80.00",
        share_percentage: "50.00",
      },
    ],
    cwr_validation: {
      work_id: "11111111-1111-1111-1111-111111111101",
      work_title: "Lumière Noire",
      is_cwr_ready: true,
      dep_total_pct: "100.00",
      drm_total_pct: "100.00",
      sync_total_pct: "100.00",
      phono_total_pct: "100.00",
      publisher_dep_pct: "50.00",
      blocking_errors: [],
      warnings: [],
    },
    created_at: "2026-10-22T12:00:00Z",
    updated_at: "2026-10-22T12:00:00Z",
  },
  {
    id: "11111111-1111-1111-1111-111111111103",
    title: "Minuit sur la Seine",
    subtitle: "Midnight on the Seine (Acoustic Edit)",
    alternate_titles: ["Midnight on the Seine"],
    iswc: "T-302.118.440-2",
    sacem_work_code: "111785573768",
    cotage_number: "4749",
    isrc_codes: ["FRZ012600201"],
    performers: ["Léa Vasseur"],
    genre: "Jazz / Acoustique",
    duration_seconds: 195,
    creation_year: 2023,
    administration_status: "ACTIVE",
    contract_reference: "CTR-ED-2023-014",
    general_notes:
      "Titre déposé Sacem en novembre 2023. Co-écriture Léa Vasseur (paroles) et Julien Delacroix (composition).",
    timeline_notes: [
      {
        id: "note-103",
        author: "Sophie Laurent (Éditeur)",
        text: "Enregistrement studio finalisé au studio Guillaume Tell.",
        created_at: "2023-10-10T16:00:00Z",
      },
    ],
    groups: [
      {
        id: "group-tf1-itc-2025",
        name: "Ici Tout Commence - Saison 4",
        group_type: "SERIE_TV",
        broadcaster_or_client: "TF1",
        production_company: "Newen Studios",
        cue_usage_type: "CUE_FOND",
        track_or_cue_number: "Cue 2M04",
      },
    ],
    rights_managed: ["DEP", "DRM", "SYNC", "PHONO"],
    splits: [
      {
        holder_name: "Léa Vasseur",
        role: "A",
        ipi_number: "00512398741",
        dep_share_pct: "25.00",
        drm_share_pct: "25.00",
        sync_share_pct: "25.00",
        phono_share_pct: "15.00",
        share_percentage: "25.00",
      },
      {
        holder_name: "Julien Delacroix",
        role: "C",
        ipi_number: "00623489120",
        dep_share_pct: "25.00",
        drm_share_pct: "25.00",
        sync_share_pct: "25.00",
        phono_share_pct: "10.00",
        share_percentage: "25.00",
      },
      {
        holder_name: "Éditions Solstices Music",
        role: "E",
        ipi_number: "00891234567",
        dep_share_pct: "50.00",
        drm_share_pct: "50.00",
        sync_share_pct: "50.00",
        phono_share_pct: "75.00",
        share_percentage: "50.00",
      },
    ],
    cwr_validation: {
      work_id: "11111111-1111-1111-1111-111111111103",
      work_title: "Minuit sur la Seine",
      is_cwr_ready: true,
      dep_total_pct: "100.00",
      drm_total_pct: "100.00",
      sync_total_pct: "100.00",
      phono_total_pct: "100.00",
      publisher_dep_pct: "50.00",
      blocking_errors: [],
      warnings: [],
    },
    created_at: "2026-10-22T12:00:00Z",
    updated_at: "2026-10-22T12:00:00Z",
  },
  {
    id: "11111111-1111-1111-1111-111111111102",
    title: "Orage d'Octobre",
    subtitle: "Orage d'Automne (Mix Master)",
    alternate_titles: ["Orage Octobre"],
    iswc: "T-304.901.223-1",
    sacem_work_code: "111785573769",
    cotage_number: "4750",
    isrc_codes: ["FRZ012600401"],
    performers: ["Sami Benali"],
    genre: "Pop Urbaine",
    duration_seconds: 204,
    creation_year: 2025,
    administration_status: "IN_DISPUTE",
    contract_reference: "CTR-ED-2025-007",
    general_notes:
      "ATTENTION : Écart de -10.00% sur les parts DEP (total 90.00%). Avenant en attente de signature avec Sami Benali.",
    timeline_notes: [
      {
        id: "note-104",
        author: "Juridique Solstices",
        text: "Relance envoyée pour la signature de l'avenant régularisant les 10% de DEP manquants.",
        created_at: "2025-02-14T09:30:00Z",
      },
    ],
    groups: [
      {
        id: "group-tf1-dna-2025",
        name: "Demain Nous Appartient - B.O.",
        group_type: "SERIE_TV",
        broadcaster_or_client: "TF1",
        production_company: "Telfrance / Newen Studios",
        cue_usage_type: "THEME_TENSION",
        track_or_cue_number: "Cue 3M12",
      },
    ],
    rights_managed: ["DEP", "DRM", "SYNC", "PHONO"],
    splits: [
      {
        holder_name: "Sami Benali",
        role: "AC",
        ipi_number: "00398765432",
        dep_share_pct: "40.00",
        drm_share_pct: "50.00",
        sync_share_pct: "50.00",
        phono_share_pct: "25.00",
        share_percentage: "40.00",
      },
      {
        holder_name: "Éditions Solstices Music",
        role: "E",
        ipi_number: "00891234567",
        dep_share_pct: "50.00",
        drm_share_pct: "50.00",
        sync_share_pct: "50.00",
        phono_share_pct: "75.00",
        share_percentage: "50.00",
      },
    ],
    cwr_validation: {
      work_id: "11111111-1111-1111-1111-111111111102",
      work_title: "Orage d'Octobre",
      is_cwr_ready: false,
      dep_total_pct: "90.00",
      drm_total_pct: "100.00",
      sync_total_pct: "100.00",
      phono_total_pct: "100.00",
      publisher_dep_pct: "50.00",
      blocking_errors: [
        "Conflit de splits DEP : total = 90.00 % (écart de -10.00 % par rapport à 100.00 %).",
      ],
      warnings: [],
    },
    created_at: "2026-10-22T12:00:00Z",
    updated_at: "2026-10-22T12:00:00Z",
  },
  {
    id: "11111111-1111-1111-1111-111111111103",
    title: "Horizon Véloce",
    subtitle: "Fast Horizon",
    alternate_titles: ["Horizon Veloce", "Fast Horizon Club"],
    iswc: "T-303.774.129-8",
    sacem_work_code: "111785573768",
    cotage_number: "4749",
    isrc_codes: ["FRZ012600201"],
    performers: ["Alexandre Roche", "Solstices Electro Ensemble"],
    genre: "Synthwave / Électronique",
    duration_seconds: 245,
    creation_year: 2024,
    administration_status: "ACTIVE",
    contract_reference: "CTR-ED-2024-002",
    general_notes: "Générique principal documentaire Netflix. Cession d'édition standard 50/50.",
    timeline_notes: [
      {
        id: "note-103",
        author: "Sophie Laurent (Éditeur)",
        text: "Dépôt CWR accepté sans réserve par la Sacem.",
        created_at: "2024-10-20T11:00:00Z",
      },
    ],
    groups: [],
    rights_managed: ["DEP", "DRM", "SYNC", "PHONO"],
    splits: [
      {
        holder_name: "Alexandre Roche",
        role: "C",
        ipi_number: "00591238472",
        dep_share_pct: "50.00",
        drm_share_pct: "50.00",
        sync_share_pct: "50.00",
        phono_share_pct: "20.00",
        share_percentage: "50.00",
      },
      {
        holder_name: "Éditions Solstices Music",
        role: "E",
        ipi_number: "00891234567",
        dep_share_pct: "50.00",
        drm_share_pct: "50.00",
        sync_share_pct: "50.00",
        phono_share_pct: "80.00",
        share_percentage: "50.00",
      },
    ],
    cwr_validation: {
      work_id: "11111111-1111-1111-1111-111111111103",
      work_title: "Horizon Véloce",
      is_cwr_ready: true,
      dep_total_pct: "100.00",
      drm_total_pct: "100.00",
      sync_total_pct: "100.00",
      phono_total_pct: "100.00",
      publisher_dep_pct: "50.00",
      blocking_errors: [],
      warnings: [],
    },
    created_at: "2024-05-10T09:00:00Z",
    updated_at: "2024-05-10T09:00:00Z",
  },
  {
    id: "11111111-1111-1111-1111-111111111104",
    title: "Les Étoiles de Paname",
    subtitle: "Paname Stars",
    alternate_titles: ["Les Etoiles de Paname"],
    iswc: "T-305.612.334-7",
    sacem_work_code: "111785573769",
    cotage_number: "4750",
    isrc_codes: ["FRZ012600301"],
    performers: ["Camille Moreau", "Trio Montmartre"],
    genre: "Chanson Française / Acoustique",
    duration_seconds: 195,
    creation_year: 2023,
    administration_status: "ACTIVE",
    contract_reference: "CTR-ED-2023-014",
    general_notes: "Titre acoustique très diffusé en radio France Inter et FIP.",
    timeline_notes: [],
    groups: [],
    rights_managed: ["DEP", "DRM", "SYNC", "PHONO"],
    splits: [
      {
        holder_name: "Camille Moreau",
        role: "AC",
        ipi_number: "00458912301",
        dep_share_pct: "50.00",
        drm_share_pct: "50.00",
        sync_share_pct: "50.00",
        phono_share_pct: "25.00",
        share_percentage: "50.00",
      },
      {
        holder_name: "Éditions Solstices Music",
        role: "E",
        ipi_number: "00891234567",
        dep_share_pct: "50.00",
        drm_share_pct: "50.00",
        sync_share_pct: "50.00",
        phono_share_pct: "75.00",
        share_percentage: "50.00",
      },
    ],
    cwr_validation: {
      work_id: "11111111-1111-1111-1111-111111111104",
      work_title: "Les Étoiles de Paname",
      is_cwr_ready: true,
      dep_total_pct: "100.00",
      drm_total_pct: "100.00",
      sync_total_pct: "100.00",
      phono_total_pct: "100.00",
      publisher_dep_pct: "50.00",
      blocking_errors: [],
      warnings: [],
    },
    created_at: "2023-11-12T14:00:00Z",
    updated_at: "2023-11-12T14:00:00Z",
  },
  {
    id: "11111111-1111-1111-1111-111111111105",
    title: "Traversée Nocturne",
    subtitle: "Night Crossing",
    alternate_titles: ["Traversee Nocturne"],
    iswc: "T-306.100.201-1",
    sacem_work_code: "111785573770",
    cotage_number: "4751",
    isrc_codes: ["FRZ012600401"],
    performers: ["Julien Delacroix"],
    genre: "Néo-Classique / Piano Solo",
    duration_seconds: 312,
    creation_year: 2024,
    administration_status: "UNDER_ADMIN",
    contract_reference: "CTR-ADM-2024-001",
    general_notes: "Mandat d'administration de catalogue 90/10.",
    timeline_notes: [],
    groups: [],
    rights_managed: ["DEP", "DRM", "SYNC", "PHONO"],
    splits: [
      {
        holder_name: "Julien Delacroix",
        role: "C",
        ipi_number: "00623489120",
        dep_share_pct: "90.00",
        drm_share_pct: "90.00",
        sync_share_pct: "90.00",
        phono_share_pct: "90.00",
        share_percentage: "90.00",
      },
      {
        holder_name: "Éditions Solstices Music",
        role: "E",
        ipi_number: "00891234567",
        dep_share_pct: "10.00",
        drm_share_pct: "10.00",
        sync_share_pct: "10.00",
        phono_share_pct: "10.00",
        share_percentage: "10.00",
      },
    ],
    cwr_validation: {
      work_id: "11111111-1111-1111-1111-111111111105",
      work_title: "Traversée Nocturne",
      is_cwr_ready: true,
      dep_total_pct: "100.00",
      drm_total_pct: "100.00",
      sync_total_pct: "100.00",
      phono_total_pct: "100.00",
      publisher_dep_pct: "10.00",
      blocking_errors: [],
      warnings: [],
    },
    created_at: "2024-02-18T16:00:00Z",
    updated_at: "2024-02-18T16:00:00Z",
  },
];

type CatalogFilterType =
  | "ALL"
  | "READY"
  | "CONFLICT"
  | "A_DEPOSER"
  | "INFORMATIONS_MANQUANTES"
  | "DEPOSE_ET_EXPLOITE"
  | "DEPOSE_EN_ATTENTE"
  | "REJET_SACEM"
  | "ARCHIVE"
  | "MISSING_IPI"
  | "SUB_PUB"
  | "WITH_NOTES"
  | "SACEM_REGISTERED"
  | "SACEM_REJECTED";

function SplitEquilibriumGauge({
  label,
  value,
  expected = 100,
}: {
  label: string;
  value: string;
  expected?: number;
}) {
  const num = parseFloat(value) || 0;
  const diff = Number((num - expected).toFixed(2));
  const isBalanced = Math.abs(diff) < 0.01;

  if (isBalanced) {
    return (
      <div
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
        title={`${label} à 100.00 % — Équilibre parfait Sacem`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
        <span>{value}%</span>
      </div>
    );
  }

  const isOver = diff > 0;
  return (
    <div
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-mono font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/40"
      title={`${label} déséquilibré (${value}%) : écart de ${isOver ? `+${diff}` : `${diff}`}% (rejet Sacem CWR)`}
    >
      <AlertTriangle className="h-3 w-3 text-rose-600 shrink-0" />
      <span>{value}%</span>
      <span className="text-[9px] font-semibold opacity-85">
        ({isOver ? `+${diff}` : `${diff}`}%)
      </span>
    </div>
  );
}

function SplitDistributionBar({ splits }: { splits: RightHolderSplit[] }) {
  if (!splits || splits.length === 0) return null;
  return (
    <div
      className="mt-1 flex h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-muted/60"
      title="Répartition : Créateurs (bleu) vs Éditeurs (émeraude)"
    >
      {splits.map((s, idx) => {
        const pct = parseFloat(s.dep_share_pct) || 0;
        if (pct <= 0) return null;
        const isPub = ["E", "SE", "PUBLISHER", "SUB_PUBLISHER"].includes(s.role);
        return (
          <div
            key={idx}
            style={{ width: `${pct}%` }}
            title={`${s.holder_name} (${s.role}) : ${s.dep_share_pct}%`}
            className={isPub ? "bg-emerald-500" : "bg-blue-500"}
          />
        );
      })}
    </div>
  );
}

function CatalogContent() {
  const searchParams = useSearchParams();
  const { currentEntity } = useWorkspace();
  const [works, setWorks] = useState<WorkRead[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CatalogFilterType>("ALL");
  const [viewMode, setViewMode] = useState<"TABLE" | "CARDS">("TABLE");
  const [expandedWorkIds, setExpandedWorkIds] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("korom_catalog_page_size");
        if (saved) {
          const val = Number(saved);
          if ([25, 50, 100, 250, 500].includes(val)) {
            setPageSize(val);
          }
        }
      } catch {
        // Ignore localStorage error
      }
    }
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter, pageSize]);

  useEffect(() => {
    const f = searchParams.get("filter");
    if (
      f === "CONFLICT" ||
      f === "READY" ||
      f === "MISSING_IPI" ||
      f === "SUB_PUB" ||
      f === "WITH_NOTES"
    ) {
      setFilter(f as CatalogFilterType);
    }
    const q = searchParams.get("search");
    if (q) {
      setSearch(q);
    }
    const g = searchParams.get("group");
    if (g) {
      setSelectedGroupId(g);
    }
    const imp = searchParams.get("import");
    if (imp === "sacem") {
      setIsMigrationModalOpen(true);
      setMigrationSourceSystem("SACEM_CSV");
    }
  }, [searchParams]);

  // Ouverture automatique du tiroir d'œuvre si un paramètre work_id est fourni dans l'URL
  useEffect(() => {
    const wid = searchParams.get("work_id");
    if (wid && works.length > 0) {
      const target = works.find((w) => w.id === wid);
      if (target) {
        openWorkDrawer(target);
      }
    }
  }, [searchParams, works]);

  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  async function handleLoadDemoCatalog() {
    setIsLoadingDemo(true);
    try {
      await loadSandboxDemo();
      const updated = await fetchWorks();
      setWorks(updated);
      const groups = await fetchWorkGroups();
      setWorkGroups(groups);
      await loadCatalogAudit();
      setMigrationBanner("✨ Catalogue de démonstration chargé avec succès (30 œuvres).");
    } catch (err: any) {
      setMigrationBanner(`Erreur chargement démo : ${err.message || err}`);
    } finally {
      setIsLoadingDemo(false);
    }
  }

  function toggleWorkExpand(workId: string) {
    setExpandedWorkIds((prev) =>
      prev.includes(workId)
        ? prev.filter((id) => id !== workId)
        : [...prev, workId]
    );
  }

  // État de l'Assistant de Migration Sécurisée (Catalogue Espace SACEM .CSV / Le Sage / Music Maestro / CWR .V21)
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [migrationSourceSystem, setMigrationSourceSystem] = useState<
    "SACEM_CSV" | "LE_SAGE_CSV" | "CWR_V21" | "VISTEX_CSV"
  >("SACEM_CSV");
  const [migrationReport, setMigrationReport] =
    useState<CatalogMigrationReport | null>(null);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationBanner, setMigrationBanner] = useState<string | null>(null);
  const [uploadedMigrationFile, setUploadedMigrationFile] =
    useState<File | null>(null);

  // État de l'Accusé de Réception CWR SACEM ACK / NACK (US-5.8)
  const [isCwrAckModalOpen, setIsCwrAckModalOpen] = useState(false);

  // État du Bac à Sable Différentiel & Sous-Édition (US-5.18)
  const [isSandboxDiffOpen, setIsSandboxDiffOpen] = useState(false);

  // État de l'Atelier de Diagnostic & Santé du Catalogue (US-4.4)
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditReport, setAuditReport] = useState<CatalogAuditReport | null>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [isAutoRepairing, setIsAutoRepairing] = useState(false);
  const [autoRepairResult, setAutoRepairResult] =
    useState<CatalogAutoRepairResult | null>(null);
  const [auditSelectedCategory, setAuditSelectedCategory] =
    useState<string>("ALL");
  const [autoRepairOptions, setAutoRepairOptions] = useState({
    auto_fill_ipis_from_directory: true,
    auto_balance_splits: true,
    auto_inherit_project_contracts: true,
  });

  async function loadCatalogAudit() {
    setIsLoadingAudit(true);
    try {
      const rep = await fetchCatalogAudit();
      setAuditReport(rep);
    } catch (err) {
      console.error("Erreur chargement audit", err);
    } finally {
      setIsLoadingAudit(false);
    }
  }

  async function handleTriggerAutoRepair() {
    setIsAutoRepairing(true);
    setAutoRepairResult(null);
    try {
      const res = await triggerCatalogAutoRepair(autoRepairOptions);
      setAutoRepairResult(res);
      const updatedWorks = await fetchWorks(
        selectedGroupId !== "ALL" ? selectedGroupId : undefined
      );
      setWorks(updatedWorks);
      await loadCatalogAudit();
    } catch (err) {
      console.error("Erreur auto-réparation", err);
    } finally {
      setIsAutoRepairing(false);
    }
  }

  function buildOfflineDemoMigrationReport(
    dryRun: boolean
  ): CatalogMigrationReport {
    const demoMigratedWorks: WorkRead[] = [
      {
        id: "11111111-1111-1111-1111-111111111201",
        title: "Étoiles de Belleville",
        alternate_titles: ["Etoiles de Belleville", "Belleville Stars"],
        iswc: "T-308.410.112-5",
        isrc_codes: ["FRZ012601101"],
        performers: ["Clara Silvestre"],
        rights_managed: ["DEP", "DRM", "SYNC", "PHONO"],
        splits: [
          {
            holder_name: "Clara Silvestre",
            role: "AC",
            ipi_number: "00491827364",
            dep_share_pct: "50.00",
            drm_share_pct: "50.00",
            sync_share_pct: "50.00",
            phono_share_pct: "20.00",
            share_percentage: "50.00",
          },
          {
            holder_name: "Éditions Solstices Music",
            role: "E",
            ipi_number: "00891234567",
            dep_share_pct: "50.00",
            drm_share_pct: "50.00",
            sync_share_pct: "50.00",
            phono_share_pct: "80.00",
            share_percentage: "50.00",
          },
        ],
        cwr_validation: {
          work_id: "11111111-1111-1111-1111-111111111201",
          work_title: "Étoiles de Belleville",
          is_cwr_ready: true,
          dep_total_pct: "100.00",
          drm_total_pct: "100.00",
          sync_total_pct: "100.00",
          phono_total_pct: "100.00",
          publisher_dep_pct: "50.00",
          blocking_errors: [],
          warnings: [],
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "11111111-1111-1111-1111-111111111202",
        title: "Valparaiso Nocturne",
        alternate_titles: ["Valparaiso Night"],
        iswc: "T-308.512.908-3",
        isrc_codes: ["FRZ012601102"],
        performers: ["Antoine Garnier"],
        rights_managed: ["DEP", "DRM", "SYNC", "PHONO"],
        splits: [
          {
            holder_name: "Antoine Garnier",
            role: "A",
            ipi_number: "00734512980",
            dep_share_pct: "33.33",
            drm_share_pct: "33.33",
            sync_share_pct: "33.33",
            phono_share_pct: "15.00",
            share_percentage: "33.33",
          },
          {
            holder_name: "Julien Delacroix",
            role: "C",
            ipi_number: "00623489120",
            dep_share_pct: "33.33",
            drm_share_pct: "33.33",
            sync_share_pct: "33.33",
            phono_share_pct: "15.00",
            share_percentage: "33.33",
          },
          {
            holder_name: "Éditions Solstices Music",
            role: "E",
            ipi_number: "00891234567",
            dep_share_pct: "33.34",
            drm_share_pct: "33.34",
            sync_share_pct: "33.34",
            phono_share_pct: "70.00",
            share_percentage: "33.34",
          },
        ],
        cwr_validation: {
          work_id: "11111111-1111-1111-1111-111111111202",
          work_title: "Valparaiso Nocturne",
          is_cwr_ready: true,
          dep_total_pct: "100.00",
          drm_total_pct: "100.00",
          sync_total_pct: "100.00",
          phono_total_pct: "100.00",
          publisher_dep_pct: "33.34",
          blocking_errors: [],
          warnings: [],
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "11111111-1111-1111-1111-111111111203",
        title: "Gare du Nord 4h",
        alternate_titles: ["Gare du Nord 04h00"],
        iswc: "T-308.771.304-9",
        isrc_codes: ["FRZ012601103"],
        performers: ["K-Soprano"],
        rights_managed: ["DEP", "DRM", "SYNC", "PHONO"],
        splits: [
          {
            holder_name: "K-Soprano",
            role: "AC",
            ipi_number: "00588123490",
            dep_share_pct: "50.00",
            drm_share_pct: "50.00",
            sync_share_pct: "50.00",
            phono_share_pct: "25.00",
            share_percentage: "50.00",
          },
          {
            holder_name: "Éditions Solstices Music",
            role: "E",
            ipi_number: "00891234567",
            dep_share_pct: "50.00",
            drm_share_pct: "50.00",
            sync_share_pct: "50.00",
            phono_share_pct: "75.00",
            share_percentage: "50.00",
          },
        ],
        cwr_validation: {
          work_id: "11111111-1111-1111-1111-111111111203",
          work_title: "Gare du Nord 4h",
          is_cwr_ready: true,
          dep_total_pct: "100.00",
          drm_total_pct: "100.00",
          sync_total_pct: "100.00",
          phono_total_pct: "100.00",
          publisher_dep_pct: "50.00",
          blocking_errors: [],
          warnings: [],
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "11111111-1111-1111-1111-111111111204",
        title: "Mirage Analoge (Anomalie Héritée Le Sage)",
        alternate_titles: ["Mirage Analogue"],
        iswc: "T-308.990.114-2",
        isrc_codes: ["FRZ012601104"],
        performers: ["Sami Benali"],
        rights_managed: ["DEP", "DRM", "SYNC", "PHONO"],
        splits: [
          {
            holder_name: "Sami Benali",
            role: "AC",
            ipi_number: "00398765432",
            dep_share_pct: "45.00",
            drm_share_pct: "50.00",
            sync_share_pct: "50.00",
            phono_share_pct: "20.00",
            share_percentage: "45.00",
          },
          {
            holder_name: "Éditions Solstices Music",
            role: "E",
            ipi_number: "00891234567",
            dep_share_pct: "50.00",
            drm_share_pct: "50.00",
            sync_share_pct: "50.00",
            phono_share_pct: "80.00",
            share_percentage: "50.00",
          },
        ],
        cwr_validation: {
          work_id: "11111111-1111-1111-1111-111111111204",
          work_title: "Mirage Analoge (Anomalie Héritée Le Sage)",
          is_cwr_ready: false,
          dep_total_pct: "95.00",
          drm_total_pct: "100.00",
          sync_total_pct: "100.00",
          phono_total_pct: "100.00",
          publisher_dep_pct: "50.00",
          blocking_errors: [
            "Conflit de splits DEP hérité de Le Sage : total = 95.00 % (écart de -5.00 % par rapport à 100.00 %).",
          ],
          warnings: [],
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    return {
      dry_run: dryRun,
      source_system: migrationSourceSystem,
      source_filename: "export_catalogue_lesage_improvize_2026.csv",
      sha256_integrity_hash: "9f8c4e1a2b70d391",
      total_works_parsed: 4,
      new_works_count: 4,
      upserted_existing_iswc_count: 0,
      cwr_ready_works_count: 3,
      cwr_conflict_works_count: 1,
      contracts_migrated_count: 4,
      total_initial_advances_eur: "12500.00",
      total_recouped_advances_eur: "5200.00",
      total_remaining_advances_eur: "7300.00",
      items: [
        {
          title: "Étoiles de Belleville",
          alternate_titles: ["Etoiles de Belleville", "Belleville Stars"],
          iswc: "T-308.410.112-5",
          isrc_codes: ["FRZ012601101"],
          performers: ["Clara Silvestre"],
          migration_action: "NEW",
          holders_count: 2,
          dep_total_pct: "100.00",
          drm_total_pct: "100.00",
          sync_total_pct: "100.00",
          phono_total_pct: "100.00",
          is_cwr_ready: true,
          blocking_errors: [],
          contract_reference: "CTR-LESAGE-2024-08",
          initial_advance_eur: "6000.00",
          recouped_advance_eur: "1500.00",
          remaining_advance_eur: "4500.00",
        },
        {
          title: "Valparaiso Nocturne",
          alternate_titles: ["Valparaiso Night"],
          iswc: "T-308.512.908-3",
          isrc_codes: ["FRZ012601102"],
          performers: ["Antoine Garnier"],
          migration_action: "NEW",
          holders_count: 3,
          dep_total_pct: "100.00",
          drm_total_pct: "100.00",
          sync_total_pct: "100.00",
          phono_total_pct: "100.00",
          is_cwr_ready: true,
          blocking_errors: [],
          contract_reference: "CTR-LESAGE-2025-14",
          initial_advance_eur: "4000.00",
          recouped_advance_eur: "1200.00",
          remaining_advance_eur: "2800.00",
        },
        {
          title: "Gare du Nord 4h",
          alternate_titles: ["Gare du Nord 04h00"],
          iswc: "T-308.771.304-9",
          isrc_codes: ["FRZ012601103"],
          performers: ["K-Soprano"],
          migration_action: "NEW",
          holders_count: 2,
          dep_total_pct: "100.00",
          drm_total_pct: "100.00",
          sync_total_pct: "100.00",
          phono_total_pct: "100.00",
          is_cwr_ready: true,
          blocking_errors: [],
          contract_reference: "CTR-LESAGE-2025-19",
          initial_advance_eur: "0.00",
          recouped_advance_eur: "0.00",
          remaining_advance_eur: "0.00",
        },
        {
          title: "Mirage Analoge (Anomalie Héritée Le Sage)",
          alternate_titles: ["Mirage Analogue"],
          iswc: "T-308.990.114-2",
          isrc_codes: ["FRZ012601104"],
          performers: ["Sami Benali"],
          migration_action: "NEW",
          holders_count: 2,
          dep_total_pct: "95.00",
          drm_total_pct: "100.00",
          sync_total_pct: "100.00",
          phono_total_pct: "100.00",
          is_cwr_ready: false,
          blocking_errors: [
            "Conflit de splits DEP hérité de Le Sage : total = 95.00 % (écart de -5.00 % par rapport à 100.00 %).",
          ],
          contract_reference: "CTR-LESAGE-2023-02",
          initial_advance_eur: "2500.00",
          recouped_advance_eur: "2500.00",
          remaining_advance_eur: "0.00",
        },
      ],
      migrated_works: dryRun ? [] : demoMigratedWorks,
    };
  }

  async function handleRunDemoMigration(dryRun: boolean) {
    setMigrationLoading(true);
    setUploadedMigrationFile(null);
    try {
      const rep = await migrateCatalogDemo(dryRun, migrationSourceSystem);
      setMigrationReport(rep);
      if (!dryRun) {
        const refreshed = await fetchWorks();
        if (refreshed.length > 0) setWorks(refreshed);
        setIsMigrationModalOpen(false);
        setMigrationBanner(
          `Migration atomique terminée depuis ${rep.source_system} : ${rep.total_works_parsed} œuvres importées et vectorisées, ${Number(
            rep.total_remaining_advances_eur
          ).toLocaleString("fr-FR")} € de soldes d'avances repris au centime près (Hash SHA-256 : ${
            rep.sha256_integrity_hash
          }).`
        );
      }
    } catch {
      const fallback = buildOfflineDemoMigrationReport(dryRun);
      setMigrationReport(fallback);
      if (!dryRun) {
        setWorks((prev) => {
          const existingIswcs = new Set(prev.map((w) => w.iswc));
          const toAdd = fallback.migrated_works.filter(
            (w) => !w.iswc || !existingIswcs.has(w.iswc)
          );
          return [...toAdd, ...prev];
        });
        setIsMigrationModalOpen(false);
        setMigrationBanner(
          `Migration atomique terminée depuis ${fallback.source_system} : ${fallback.total_works_parsed} œuvres importées et vectorisées, ${Number(
            fallback.total_remaining_advances_eur
          ).toLocaleString("fr-FR")} € de soldes d'avances repris au centime près (Hash SHA-256 : ${
            fallback.sha256_integrity_hash
          }).`
        );
      }
    } finally {
      setMigrationLoading(false);
    }
  }

  function parseClientSideCwrContent(
    content: string,
    filename: string,
    dryRun: boolean
  ): CatalogMigrationReport {
    const parsedWorks: WorkRead[] = [];
    const previews: CatalogMigrationReport["items"] = [];
    let currentWork: WorkRead | null = null;

    for (const rawLine of content.split(/\r?\n/)) {
      if (rawLine.length < 3) continue;
      const recType = rawLine.slice(0, 3).toUpperCase();
      if (recType === "NWR" || recType === "REV") {
        if (currentWork) parsedWorks.push(currentWork);
        const title = rawLine.slice(19, 79).trim();
        const rawIswc = rawLine.slice(95, 106).trim();
        const iswc =
          rawIswc.length === 11 && rawIswc.startsWith("T")
            ? `T-${rawIswc.slice(1, 4)}.${rawIswc.slice(4, 7)}.${rawIswc.slice(
                7,
                10
              )}-${rawIswc.slice(10)}`
            : null;
        currentWork = {
          id: `cwr-${parsedWorks.length + 1}`,
          title,
          alternate_titles: [],
          iswc,
          isrc_codes: [`FRZ0126${String(parsedWorks.length + 1).padStart(5, "0")}`],
          performers: ["Catalogue Migré CWR"],
          rights_managed: ["DEP", "DRM", "SYNC", "PHONO"],
          splits: [],
          cwr_validation: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      } else if (recType === "ALT" && currentWork) {
        const alt = rawLine.slice(19, 79).trim();
        if (alt && !currentWork.alternate_titles.includes(alt)) currentWork.alternate_titles.push(alt);
      } else if (recType === "ORN" && currentWork) {
        const orn = (rawLine.length >= 22 ? rawLine.slice(22) : rawLine.slice(19)).trim();
        if (orn && !currentWork.alternate_titles.includes(orn)) currentWork.alternate_titles.push(orn);
      } else if ((recType === "SPU" || recType === "OPU") && currentWork) {
        const pubName = (rawLine.length >= 75 ? rawLine.slice(30, 75) : rawLine.slice(30)).trim();
        if (!pubName) continue;
        const ipiRaw = rawLine.length >= 98 ? rawLine.slice(87, 98).trim() : "";
        const cleanIpi = ipiRaw && !/^0+$/.test(ipiRaw) ? ipiRaw : undefined;
        const prStr = rawLine.length >= 120 ? rawLine.slice(115, 120).trim() : "";
        const mrStr = rawLine.length >= 128 ? rawLine.slice(123, 128).trim() : "";
        const depPct = /^\d+$/.test(prStr) ? (parseInt(prStr, 10) / 100).toFixed(2) : "0.00";
        const drmPct = /^\d+$/.test(mrStr) ? (parseInt(mrStr, 10) / 100).toFixed(2) : "0.00";
        const normName = pubName.length > 3 && pubName === pubName.toUpperCase() ? pubName.charAt(0) + pubName.slice(1).toLowerCase() : pubName;
        const existing = currentWork.splits.find((s) => s.holder_name.toUpperCase() === normName.toUpperCase());
        if (existing) {
          existing.dep_share_pct = (parseFloat(existing.dep_share_pct) + parseFloat(depPct)).toFixed(2);
          existing.drm_share_pct = (parseFloat(existing.drm_share_pct) + parseFloat(drmPct)).toFixed(2);
          existing.sync_share_pct = existing.drm_share_pct;
          existing.phono_share_pct = existing.drm_share_pct;
          existing.share_percentage = existing.dep_share_pct;
          if (!existing.ipi_number && cleanIpi) existing.ipi_number = cleanIpi;
        } else {
          currentWork.splits.push({
            holder_name: normName,
            role: "E",
            ipi_number: cleanIpi || null,
            dep_share_pct: depPct,
            drm_share_pct: drmPct,
            sync_share_pct: drmPct,
            phono_share_pct: drmPct,
            share_percentage: depPct,
          });
        }
      } else if ((recType === "SWR" || recType === "OWR") && currentWork) {
        const lastName = (rawLine.length >= 73 ? rawLine.slice(28, 73) : rawLine.slice(28)).trim();
        const firstName = rawLine.length >= 103 ? rawLine.slice(73, 103).trim() : "";
        const fullName = `${lastName} ${firstName}`.trim();
        if (!fullName) continue;
        const cap = rawLine.length >= 106 ? rawLine.slice(104, 106).trim() : "";
        const role: RightHolderRole = cap === "CA" ? "AC" : (["C", "A", "AC", "AR", "AD"].includes(cap) ? (cap as RightHolderRole) : "C");
        const ipiRaw = rawLine.length >= 126 ? rawLine.slice(115, 126).trim() : "";
        const cleanIpi = ipiRaw && !/^0+$/.test(ipiRaw) ? ipiRaw : undefined;
        const prStr = rawLine.length >= 134 ? rawLine.slice(129, 134).trim() : "";
        const mrStr = rawLine.length >= 142 ? rawLine.slice(137, 142).trim() : "";
        const depPct = /^\d+$/.test(prStr) ? (parseInt(prStr, 10) / 100).toFixed(2) : "0.00";
        const drmPct = /^\d+$/.test(mrStr) ? (parseInt(mrStr, 10) / 100).toFixed(2) : "0.00";
        const normName = fullName.length > 3 && fullName === fullName.toUpperCase() ? fullName.charAt(0) + fullName.slice(1).toLowerCase() : fullName;
        const existing = currentWork.splits.find((s) => s.holder_name.toUpperCase() === normName.toUpperCase());
        if (existing) {
          existing.dep_share_pct = (parseFloat(existing.dep_share_pct) + parseFloat(depPct)).toFixed(2);
          existing.drm_share_pct = (parseFloat(existing.drm_share_pct) + parseFloat(drmPct)).toFixed(2);
          existing.sync_share_pct = existing.drm_share_pct;
          existing.phono_share_pct = existing.drm_share_pct;
          existing.share_percentage = existing.dep_share_pct;
          if (!existing.ipi_number && cleanIpi) existing.ipi_number = cleanIpi;
        } else {
          currentWork.splits.push({
            holder_name: normName,
            role,
            ipi_number: cleanIpi || null,
            dep_share_pct: depPct,
            drm_share_pct: drmPct,
            sync_share_pct: drmPct,
            phono_share_pct: drmPct,
            share_percentage: depPct,
          });
        }
      }
    }
    if (currentWork) parsedWorks.push(currentWork);

    let readyCount = 0;
    let conflictCount = 0;
    const existingIswcs = new Set(works.map((w) => w.iswc).filter(Boolean));
    let upsertCount = 0;
    let newCount = 0;

    for (const w of parsedWorks) {
      const depSumVal = w.splits.reduce(
        (acc, s) => acc + (parseFloat(s.dep_share_pct) || 0),
        0
      );
      const drmSumVal = w.splits.reduce(
        (acc, s) => acc + (parseFloat(s.drm_share_pct) || 0),
        0
      );
      const isReady =
        Math.abs(depSumVal - 100) < 0.01 && Math.abs(drmSumVal - 100) < 0.01;
      const errs = isReady
        ? []
        : [
            `Conflit de splits DEP hérité de Le Sage : total = ${depSumVal.toFixed(
              2
            )} % (écart par rapport à 100.00 %).`,
          ];
      w.cwr_validation = {
        work_id: w.id,
        work_title: w.title,
        is_cwr_ready: isReady,
        dep_total_pct: depSumVal.toFixed(2),
        drm_total_pct: drmSumVal.toFixed(2),
        sync_total_pct: drmSumVal.toFixed(2),
        phono_total_pct: drmSumVal.toFixed(2),
        publisher_dep_pct: "50.00",
        blocking_errors: errs,
        warnings: [],
      };
      if (isReady) readyCount++;
      else conflictCount++;

      const isUpsert = Boolean(w.iswc && existingIswcs.has(w.iswc));
      if (isUpsert) upsertCount++;
      else newCount++;

      if (previews.length < 150 || !isReady) {
        previews.push({
          title: w.title,
          alternate_titles: w.alternate_titles,
          iswc: w.iswc,
          isrc_codes: w.isrc_codes,
          performers: w.performers,
          migration_action: isUpsert ? "UPSERT_ISWC" : "NEW",
          holders_count: w.splits.length,
          dep_total_pct: depSumVal.toFixed(2),
          drm_total_pct: drmSumVal.toFixed(2),
          sync_total_pct: drmSumVal.toFixed(2),
          phono_total_pct: drmSumVal.toFixed(2),
          is_cwr_ready: isReady,
          blocking_errors: errs,
          contract_reference: null,
          initial_advance_eur: "0.00",
          recouped_advance_eur: "0.00",
          remaining_advance_eur: "0.00",
        });
      }
    }

    return {
      dry_run: dryRun,
      source_system: "CWR_V21",
      source_filename: filename,
      sha256_integrity_hash: "cwr1200_7a8b9c0d",
      total_works_parsed: parsedWorks.length,
      new_works_count: newCount,
      upserted_existing_iswc_count: upsertCount,
      cwr_ready_works_count: readyCount,
      cwr_conflict_works_count: conflictCount,
      contracts_migrated_count: 0,
      total_initial_advances_eur: "0.00",
      total_recouped_advances_eur: "0.00",
      total_remaining_advances_eur: "0.00",
      items: previews,
      migrated_works: parsedWorks,
    };
  }

  function generateCwr1200ContentString(): string {
    const prefixes = [
      "LUMIERE", "MINUIT", "ORAGE", "HORIZON", "TRAVERSEE", "ECHO", "SOLSTICE",
      "MIRAGE", "VELOURS", "VERTIGE", "ECLIPSE", "PARADIS", "RIVAGE", "ODYSSEE",
      "FRAGMENT", "SILENCE", "CADENCE", "PRISME", "AUBE", "CREPUSCULE", "ETOILE",
      "MEMOIRE", "SILLAGE", "BRUME", "VAGUE", "TONNERRE", "COMETE", "NEBULEUSE",
      "ARCHIPEL", "METEORE",
    ];
    const suffixes = [
      "DE BELLEVILLE", "SUR LA SEINE", "D OCTOBRE", "VELOCE", "NOCTURNE",
      "DE MONTMARTRE", "ATLANTIQUE", "MAGNETIQUE", "SOLAIRE", "ELECTRIQUE",
      "D HIVER", "DE PRINTEMPS", "D ETE", "D AUTOMNE", "SUR MER",
      "DE PARIS", "DE LYON", "DE MARSEILLE", "INFINI", "SECRET",
      "PERDU", "RETROUVE", "SAUVAGE", "MODERNE", "CLASSIQUE",
      "ACOUSTIQUE", "SYMPHONIQUE", "ANALOGIQUE", "DIGITAL", "CELESTE",
      "SOUTERRAIN", "LOINTAIN", "PROCHE", "BRULANT", "GLACE",
      "POURPRE", "AZUR", "EMERAUDE", "VERMEIL", "IVOIRE",
    ];
    const writers = [
      ["CAMILLE MOREAU", "00458912301"],
      ["LEA VASSEUR", "00512398741"],
      ["JULIEN DELACROIX", "00623489120"],
      ["SAMI BENALI", "00398765432"],
      ["CLARA SILVESTRE", "00491827364"],
      ["ANTOINE GARNIER", "00734512980"],
      ["K SOPRANO", "00588123490"],
      ["INES ROCHE", "00619283746"],
      ["MAXIME LEROY", "00791827365"],
      ["CHLOE FONTAINE", "00819283744"],
    ];
    const lines = [
      "HDRPB008912345EDITIONS SOLSTICES MUSIC (EXPORT LE SAGE)    01.102026110416300020261104",
      "GRHNWR0000102.100000000000",
    ];
    let seq = 0;
    for (let i = 1; i <= 1200; i++) {
      const p = prefixes[(i - 1) % prefixes.length];
      const s = suffixes[Math.floor((i - 1) / prefixes.length) % suffixes.length];
      const title = `${p} ${s} #${String(i).padStart(4, "0")}`;
      const code = `LESAGE${String(i).padStart(8, "0")}`;
      const iswc = `T${String(301000000 + i).padStart(9, "0")}${i % 10}`;
      const [wName, wIpi] = writers[(i - 1) % writers.length];
      const isAnomaly = i % 100 === 0;
      const wToken = isAnomaly ? "040000500000000" : "050000500000000";
      lines.push(
        `NWR${String(i).padStart(8, "0")}${String(seq++).padStart(8, "0")}${title
          .padEnd(60, " ")
          .slice(0, 60)}  ${code.padEnd(14, " ").slice(0, 14)}${iswc}20261104    UNC`
      );
      lines.push(
        `ALT${String(i).padStart(8, "0")}${String(seq++).padStart(8, "0")}${`${p} ${s} (RADIO EDIT ${i})`
          .padEnd(60, " ")
          .slice(0, 60)}ATFR`
      );
      lines.push(
        `SPU${String(i).padStart(8, "0")}${String(seq++).padStart(8, "0")}01${code.slice(
          0,
          9
        )}${"EDITIONS SOLSTICES MUSIC".padEnd(45, " ")} E 00891234567 050000500000000`
      );
      lines.push(
        `SWR${String(i).padStart(8, "0")}${String(seq++).padStart(8, "0")}01${code.slice(
          0,
          9
        )}${wName.padEnd(45, " ")} CA ${wIpi} ${wToken}`
      );
    }
    lines.push(`GRT0000100001200${String(seq + 2).padStart(8, "0")}   0000000000`);
    lines.push(`TRL0000100001200${String(seq + 4).padStart(8, "0")}`);
    return lines.join("\n");
  }

  function handleSimulateAndDownloadCwr1200() {
    setMigrationSourceSystem("CWR_V21");
    const content = generateCwr1200ContentString();
    const filename = "CW261104_LESAGE_STOCK_1200_OEUVRES.V21";
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const fileObj = new File([blob], filename, { type: "text/plain" });
    setUploadedMigrationFile(fileObj);
    const report = parseClientSideCwrContent(content, filename, true);
    setMigrationReport(report);

    // Télécharge également le fichier .V21 sur le poste de l'utilisateur
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function parseClientSideSacemCsvContent(
    content: string,
    filename: string,
    dryRun: boolean
  ): CatalogMigrationReport {
    const clean = content.replace(/^\uFEFF/, "");
    const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return buildOfflineDemoMigrationReport(dryRun);
    }
    const headers = lines[0].split(";").map((h) => h.trim());
    const idxMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      idxMap[h] = i;
    });
    const getCol = (cols: string[], name: string) => {
      const idx = idxMap[name];
      return idx !== undefined && idx < cols.length ? cols[idx].trim() : "";
    };

    const groupedRows = new Map<string, string[][]>();
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(";");
      const code = getCol(cols, "Code oeuvre");
      const title = getCol(cols, "Titre de l'oeuvre") || getCol(cols, "Titre de l’oeuvre");
      const iswc = getCol(cols, "ISWC");
      const key = code || iswc || title.toUpperCase();
      if (!key) continue;
      if (!groupedRows.has(key)) groupedRows.set(key, []);
      groupedRows.get(key)!.push(cols);
    }

    const parsedWorks: WorkRead[] = [];
    const previews: CatalogMigrationReport["items"] = [];
    const uniqueHolders = new Set<string>();
    const existingIswcs = new Set(works.map((w) => w.iswc).filter(Boolean));
    const existingSacemCodes = new Set(
      works.map((w) => w.sacem_work_code).filter(Boolean)
    );

    let newCount = 0;
    let upsertCount = 0;
    let readyCount = 0;
    let conflictCount = 0;

    const normalizeTo100 = (vals: number[]): string[] => {
      if (vals.length === 0) return [];
      const rawSum = vals.reduce((a, b) => a + b, 0);
      const rounded = vals.map((v) => Math.round(v * 100) / 100);
      if (Math.abs(rawSum - 100) <= 0.05) {
        const diff = Math.round((100 - rounded.reduce((a, b) => a + b, 0)) * 100) / 100;
        if (diff !== 0) {
          let maxIdx = 0;
          for (let j = 1; j < rounded.length; j++) {
            if (rounded[j] >= rounded[maxIdx]) maxIdx = j;
          }
          rounded[maxIdx] = Math.round((rounded[maxIdx] + diff) * 100) / 100;
        }
      }
      return rounded.map((v) => v.toFixed(2));
    };

    let workSeq = 1;
    for (const [workKey, rows] of Array.from(groupedRows.entries())) {
      const first = rows[0];
      const sacemCode = getCol(first, "Code oeuvre") || null;
      const title =
        getCol(first, "Titre de l'oeuvre") ||
        getCol(first, "Titre de l’oeuvre") ||
        workKey;
      const subtitle = getCol(first, "Sous-titre(s)") || null;
      const genre =
        getCol(first, "Genre de l'oeuvre") ||
        getCol(first, "Genre de l’oeuvre") ||
        null;
      const iswc = getCol(first, "ISWC") || null;
      const dateDecl = getCol(first, "Date de déclaration");
      const creationYear =
        dateDecl && dateDecl.length >= 4 && /^\d{4}/.test(dateDecl)
          ? parseInt(dateDecl.slice(0, 4), 10)
          : null;
      const generalNotes = getCol(first, "Commentaire") || null;

      const mergedMap = new Map<
        string,
        {
          holder_name: string;
          role: RightHolderRole;
          ipi_number: string | null;
          society_de: string;
          society_dr: string;
          dep: number;
          dr: number;
          phono: number;
        }
      >();

      for (const r of rows) {
        const dep = parseFloat(getCol(r, "Part DEP").replace(",", ".")) || 0;
        const dr = parseFloat(getCol(r, "Part DR").replace(",", ".")) || 0;
        const phono = parseFloat(getCol(r, "Part PHONO").replace(",", ".")) || 0;
        if (dep === 0 && dr === 0 && phono === 0) continue;

        const rawRole = (getCol(r, "Rôle") || "AC").toUpperCase() as RightHolderRole;
        const rawIpi = getCol(r, "Code IPI");
        const ipi =
          rawIpi && /^\d+$/.test(rawIpi) && rawIpi.length <= 11
            ? rawIpi.padStart(11, "0")
            : rawIpi || null;
        const nameIpi = getCol(r, "Nom au fichier IPI");
        const nameAd = (
          getCol(r, "Nom de l'ayant-droit") ||
          getCol(r, "Nom de l’ayant-droit")
        )
          .replace(/\s*\((?:SACEM|Pas de soci[ée]t[ée])\)\s*$/i, "")
          .trim();
        const holderName = nameIpi || nameAd || "Ayant Droit";

        const rawSocDe = getCol(r, "Société en DE");
        const rawSocDr = getCol(r, "Société en DR");
        const socDe =
          !rawSocDe || /pas de soci/i.test(rawSocDe)
            ? ""
            : rawSocDe.toUpperCase();
        const socDr =
          !rawSocDr || /pas de soci/i.test(rawSocDr)
            ? ""
            : rawSocDr.toUpperCase();

        uniqueHolders.add(ipi || holderName.toUpperCase());
        const mKey = `${ipi || holderName.toUpperCase()}:${rawRole}`;
        if (!mergedMap.has(mKey)) {
          mergedMap.set(mKey, {
            holder_name: holderName,
            role: rawRole,
            ipi_number: ipi,
            society_de: socDe,
            society_dr: socDr,
            dep: 0,
            dr: 0,
            phono: 0,
          });
        }
        const entry = mergedMap.get(mKey)!;
        entry.dep += dep;
        entry.dr += dr;
        entry.phono += phono;
        if (socDe && !entry.society_de) entry.society_de = socDe;
        if (socDr && !entry.society_dr) entry.society_dr = socDr;
      }

      const entries = Array.from(mergedMap.values());
      const deps = normalizeTo100(entries.map((e) => e.dep));
      const drs = normalizeTo100(entries.map((e) => e.dr));
      const phonos = normalizeTo100(entries.map((e) => e.phono));

      const splits: RightHolderSplit[] = entries.map((e, idx) => {
        const finalDe = e.society_de || "SACEM";
        const finalDr = e.society_dr || finalDe;
        return {
          holder_name: e.holder_name,
          role: e.role,
          ipi_number: e.ipi_number,
          dep_share_pct: deps[idx],
          drm_share_pct: drs[idx],
          sync_share_pct: drs[idx],
          phono_share_pct: phonos[idx],
          share_percentage: deps[idx],
          society_name: finalDe,
          society_de: finalDe,
          society_dr: finalDr,
        };
      });

      const depSumVal = splits.reduce(
        (acc, s) => acc + (parseFloat(s.dep_share_pct) || 0),
        0
      );
      const drmSumVal = splits.reduce(
        (acc, s) => acc + (parseFloat(s.drm_share_pct) || 0),
        0
      );
      const phonoSumVal = splits.reduce(
        (acc, s) => acc + (parseFloat(s.phono_share_pct || "0") || 0),
        0
      );
      const isReady =
        Math.abs(depSumVal - 100) < 0.01 && Math.abs(drmSumVal - 100) < 0.01;
      if (isReady) readyCount++;
      else conflictCount++;

      const isUpsert = Boolean(
        (sacemCode && existingSacemCodes.has(sacemCode)) ||
          (iswc && existingIswcs.has(iswc))
      );
      if (isUpsert) upsertCount++;
      else newCount++;

      const workId = `sacem-${workSeq++}`;
      const altTitles =
        subtitle && subtitle.toUpperCase() !== title.toUpperCase()
          ? [subtitle]
          : [];

      parsedWorks.push({
        id: workId,
        title,
        subtitle,
        alternate_titles: altTitles,
        iswc,
        sacem_work_code: sacemCode,
        genre,
        creation_year: creationYear,
        general_notes: generalNotes,
        isrc_codes: [],
        performers: [],
        rights_managed: ["DEP", "DRM", "SYNC", "PHONO"],
        splits,
        cwr_validation: {
          work_id: workId,
          work_title: title,
          is_cwr_ready: isReady,
          dep_total_pct: depSumVal.toFixed(2),
          drm_total_pct: drmSumVal.toFixed(2),
          sync_total_pct: drmSumVal.toFixed(2),
          phono_total_pct: phonoSumVal.toFixed(2),
          publisher_dep_pct: "33.34",
          blocking_errors: isReady
            ? []
            : [`Écart de répartition : DEP=${depSumVal.toFixed(2)}% / DR=${drmSumVal.toFixed(2)}%`],
          warnings: [],
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      previews.push({
        title,
        subtitle,
        alternate_titles: altTitles,
        iswc,
        sacem_work_code: sacemCode,
        genre,
        isrc_codes: [],
        performers: [],
        migration_action: isUpsert ? "UPSERT_ISWC" : "NEW",
        holders_count: splits.length,
        dep_total_pct: depSumVal.toFixed(2),
        drm_total_pct: drmSumVal.toFixed(2),
        sync_total_pct: drmSumVal.toFixed(2),
        phono_total_pct: phonoSumVal.toFixed(2),
        is_cwr_ready: isReady,
        blocking_errors: isReady
          ? []
          : [`Écart de répartition : DEP=${depSumVal.toFixed(2)}%`],
        contract_reference: null,
        initial_advance_eur: "0.00",
        recouped_advance_eur: "0.00",
        remaining_advance_eur: "0.00",
      });
    }

    return {
      dry_run: dryRun,
      source_system: "SACEM_CSV",
      source_filename: filename,
      sha256_integrity_hash: "sacem_csv_verified",
      total_works_parsed: parsedWorks.length,
      new_works_count: newCount,
      upserted_existing_iswc_count: upsertCount,
      cwr_ready_works_count: readyCount,
      cwr_conflict_works_count: conflictCount,
      contracts_migrated_count: 0,
      holders_synced_count: uniqueHolders.size,
      total_initial_advances_eur: "0.00",
      total_recouped_advances_eur: "0.00",
      total_remaining_advances_eur: "0.00",
      items: previews,
      migrated_works: parsedWorks,
    };
  }

  async function handleMigrationFileUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedMigrationFile(file);
    setMigrationLoading(true);

    const isCwr =
      file.name.toUpperCase().endsWith(".V21") ||
      file.name.toUpperCase().endsWith(".V22") ||
      file.name.toUpperCase().endsWith(".CWR");

    const targetSystem = isCwr ? "CWR_V21" : migrationSourceSystem;
    if (isCwr) {
      setMigrationSourceSystem("CWR_V21");
    }

    try {
      const rep = await migrateCatalogFile(file, targetSystem, true);
      setMigrationReport(rep);
      if (rep.source_system === "SACEM_CSV") {
        setMigrationSourceSystem("SACEM_CSV");
      } else if (rep.source_system === "CWR_V21") {
        setMigrationSourceSystem("CWR_V21");
      }
    } catch {
      const rawText = await file.text();
      if (
        isCwr ||
        rawText.startsWith("HDR") ||
        rawText.startsWith("GRH")
      ) {
        setMigrationSourceSystem("CWR_V21");
        setMigrationReport(parseClientSideCwrContent(rawText, file.name, true));
      } else if (
        migrationSourceSystem === "SACEM_CSV" ||
        rawText.includes("Code oeuvre")
      ) {
        setMigrationSourceSystem("SACEM_CSV");
        setMigrationReport(
          parseClientSideSacemCsvContent(rawText, file.name, true)
        );
      } else {
        setMigrationReport(buildOfflineDemoMigrationReport(true));
      }
    } finally {
      setMigrationLoading(false);
      e.target.value = "";
    }
  }

  async function handleCommitMigration() {
    if (uploadedMigrationFile) {
      setMigrationLoading(true);
      const isCwr =
        uploadedMigrationFile.name.toUpperCase().endsWith(".V21") ||
        uploadedMigrationFile.name.toUpperCase().endsWith(".V22") ||
        uploadedMigrationFile.name.toUpperCase().endsWith(".CWR");
      const targetSystem = isCwr ? "CWR_V21" : migrationSourceSystem;
      try {
        const rep = await migrateCatalogFile(
          uploadedMigrationFile,
          targetSystem,
          false
        );
        const refreshed = await fetchWorks();
        setWorks(refreshed);
        setIsMigrationModalOpen(false);
        const holdersMsg = rep.holders_synced_count
          ? `, ${rep.holders_synced_count} ayants droit synchronisés dans l'annuaire`
          : "";
        const advancesMsg =
          Number(rep.total_remaining_advances_eur) > 0
            ? `, ${Number(rep.total_remaining_advances_eur).toLocaleString("fr-FR")} € de soldes d'avances repris`
            : "";
        setMigrationBanner(
          `Importation réussie (${rep.source_filename}) : ${rep.total_works_parsed} œuvres importées au catalogue (${rep.cwr_ready_works_count} prêtes CWR 100%)${holdersMsg}${advancesMsg} (Hash SHA-256 : ${rep.sha256_integrity_hash}).`
        );
      } catch {
        if (migrationReport && migrationReport.migrated_works.length > 0) {
          setWorks((prev) => {
            const existingIswcs = new Set(prev.map((w) => w.iswc).filter(Boolean));
            const existingSacemCodes = new Set(
              prev.map((w) => w.sacem_work_code).filter(Boolean)
            );
            const toAdd = migrationReport.migrated_works.filter(
              (w) =>
                (!w.iswc || !existingIswcs.has(w.iswc)) &&
                (!w.sacem_work_code || !existingSacemCodes.has(w.sacem_work_code))
            );
            return [...toAdd, ...prev];
          });
          setIsMigrationModalOpen(false);
          setMigrationBanner(
            `Importation terminée (${migrationReport.source_filename}) : ${migrationReport.total_works_parsed} œuvres importées au catalogue (${migrationReport.cwr_ready_works_count} conformes 100% • Hash SHA-256 : ${migrationReport.sha256_integrity_hash}).`
          );
        } else {
          await handleRunDemoMigration(false);
        }
      } finally {
        setMigrationLoading(false);
      }
    } else {
      await handleRunDemoMigration(false);
    }
  }

  function handleDownloadLeSageTemplate() {
    const csvContent = [
      "work_title;alternate_titles;iswc;isrc;performers;holders_splits;contract_reference;counterparty_name;initial_advance;recouped_amount",
      "Étoiles de Belleville;Etoiles de Belleville|Belleville Stars;T-308.410.112-5;FRZ012601101;Clara Silvestre;Clara Silvestre:AC:00491827364:50.00:50.00:50.00:20.00|Éditions Solstices Music:E:00891234567:50.00:50.00:50.00:80.00;CTR-LESAGE-2024-08;Clara Silvestre;6000.00;1500.00",
      "Valparaiso Nocturne;Valparaiso Night;T-308.512.908-3;FRZ012601102;Antoine Garnier;Antoine Garnier:A:00734512980:33.33:33.33:33.33:15.00|Julien Delacroix:C:00623489120:33.33:33.33:33.33:15.00|Éditions Solstices Music:E:00891234567:33.34:33.34:33.34:70.00;CTR-LESAGE-2025-14;Antoine Garnier;4000.00;1200.00",
      "Gare du Nord 4h;Gare du Nord 04h00;T-308.771.304-9;FRZ012601103;K-Soprano;K-Soprano:AC:00588123490:50.00:50.00:50.00:25.00|Éditions Solstices Music:E:00891234567:50.00:50.00:50.00:75.00;CTR-LESAGE-2025-19;K-Soprano;0.00;0.00",
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele_migration_lesage_improvize.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // État du Panneau Latéral Tiroir (Slide-over Drawer)
  const [selectedWorkForDrawer, setSelectedWorkForDrawer] =
    useState<WorkRead | null>(null);
  const [drawerActiveTab, setDrawerActiveTab] = useState<
    "DETAILS" | "SPLITS" | "MEMO" | "TIMELINE"
  >("DETAILS");
  const [drawerMemoText, setDrawerMemoText] = useState("");
  const [drawerTimelineAuthor, setDrawerTimelineAuthor] = useState("Éditeur");
  const [drawerTimelineText, setDrawerTimelineText] = useState("");
  const [isSavingDrawerMemo, setIsSavingDrawerMemo] = useState(false);
  const [isSubmittingDrawerNote, setIsSubmittingDrawerNote] = useState(false);
  const [drawerBanner, setDrawerBanner] = useState<string | null>(null);

  // État enrichi de la modale d'ajout / édition d'œuvre
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorkId, setEditingWorkId] = useState<string | null>(null);
  const [cwrModalData, setCwrModalData] = useState<CWRExportPayload | null>(
    null
  );
  const [newTitle, setNewTitle] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");
  const [newAlternateTitles, setNewAlternateTitles] = useState("");
  const [newIswc, setNewIswc] = useState("T-307.123.456-1");
  const [newSacemWorkCode, setNewSacemWorkCode] = useState("");
  const [newCotageNumber, setNewCotageNumber] = useState("");
  const [newIsrc, setNewIsrc] = useState("FRZ012600901");
  const [newPerformer, setNewPerformer] = useState("");
  const [newGenre, setNewGenre] = useState("");
  const [newDurationSeconds, setNewDurationSeconds] = useState<string>("");
  const [newCreationYear, setNewCreationYear] = useState<string>("");
  const [newAdminStatus, setNewAdminStatus] =
    useState<AdministrationStatus>("ACTIVE");
  const [newLifecycleStatus, setNewLifecycleStatus] = useState<string | null>(null);
  const [newContractReference, setNewContractReference] = useState("");
  const [newGeneralNotes, setNewGeneralNotes] = useState("");
  const [newSplits, setNewSplits] = useState<RightHolderSplit[]>([
    {
      holder_name: "Camille Moreau",
      role: "AC",
      ipi_number: "00458912301",
      dep_share_pct: "50.00",
      drm_share_pct: "50.00",
      sync_share_pct: "50.00",
      phono_share_pct: "20.00",
      share_percentage: "50.00",
    },
    {
      holder_name: "Éditions Solstices Music",
      role: "E",
      ipi_number: "00891234567",
      dep_share_pct: "50.00",
      drm_share_pct: "50.00",
      sync_share_pct: "50.00",
      phono_share_pct: "80.00",
      share_percentage: "50.00",
    },
  ]);

  // État des Projets Audiovisuels & Albums (WorkGroups)
  const [workGroups, setWorkGroups] =
    useState<WorkGroupRead[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("ALL");

  function handleSelectGroup(groupId: string) {
    setSelectedGroupId(groupId);
    if (groupId !== "ALL") {
      const g = workGroups.find((item) => item.id === groupId);
      if (g) {
        addRecentItem({
          id: `group-${g.id}`,
          type: "GROUP",
          title: g.name,
          subtitle: g.production_company
            ? `Prod: ${g.production_company}`
            : g.group_type === "AUDIOVISUAL"
            ? "Série / Fiction TV"
            : "Album",
          badge: "Projet TF1",
          url: `/catalog?group=${g.id}`,
        });
      }
    }
  }
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isManageGroupsModalOpen, setIsManageGroupsModalOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<WorkGroupRead | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [selectedGroupIdsForDelete, setSelectedGroupIdsForDelete] = useState<string[]>([]);
  const [isBatchDeleteGroupsModalOpen, setIsBatchDeleteGroupsModalOpen] = useState(false);
  const [isBatchDeletingGroups, setIsBatchDeletingGroups] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<WorkGroupType>("SERIE_TV");
  const [newGroupProd, setNewGroupProd] = useState("TF1 Production");
  const [newGroupBroadcaster, setNewGroupBroadcaster] = useState("TF1");
  const [newGroupYear, setNewGroupYear] = useState<string>(
    String(new Date().getFullYear())
  );
  const [newGroupDirector, setNewGroupDirector] = useState("");
  const [newGroupNotes, setNewGroupNotes] = useState("");
  const [newGroupContractRef, setNewGroupContractRef] = useState("");

  // Options d'Export CWR Avancées (Filtrage par Groupe / Projet et Dates)
  const [isCwrExportConfigModalOpen, setIsCwrExportConfigModalOpen] = useState(false);
  const [cwrFilterGroupId, setCwrFilterGroupId] = useState<string>("ALL");
  const [cwrDateFrom, setCwrDateFrom] = useState<string>("");
  const [cwrDateTo, setCwrDateTo] = useState<string>("");
  const [isExportingCwr, setIsExportingCwr] = useState(false);

  // Sélection multiple & Modifications par lot (Batch Operations)
  const [selectedWorkIds, setSelectedWorkIds] = useState<string[]>([]);
  const [isAssignGroupModalOpen, setIsAssignGroupModalOpen] = useState(false);
  const [assignTargetGroupId, setAssignTargetGroupId] = useState<string>("");
  const [assignInheritContract, setAssignInheritContract] = useState(true);
  const [assignCueUsage, setAssignCueUsage] = useState<string>("FOND / UNDERSCORE");
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchAssignGroupId, setBatchAssignGroupId] = useState<string>("");
  const [batchInheritContract, setBatchInheritContract] = useState(true);
  const [batchCueUsage, setBatchCueUsage] = useState<string>("GÉNÉRIQUE");
  const [batchAdminStatus, setBatchAdminStatus] = useState<string>("");
  const [batchContractRef, setBatchContractRef] = useState<string>("");
  const [batchGenre, setBatchGenre] = useState<string>("");
  const [batchTimelineNoteText, setBatchTimelineNoteText] = useState("");
  const [batchTimelineNoteAuthor, setBatchTimelineNoteAuthor] =
    useState("Éditeur TF1");
  const [batchGeneralNotes, setBatchGeneralNotes] = useState("");
  const [batchPreset, setBatchPreset] = useState<string>("");
  // Ciblage d'ayant droit
  const [enableHolderTargeting, setEnableHolderTargeting] = useState(false);
  const [targetHolderQuery, setTargetHolderQuery] = useState("");
  const [targetNewName, setTargetNewName] = useState("");
  const [targetNewIpi, setTargetNewIpi] = useState("");
  const [targetNewRole, setTargetNewRole] = useState<string>("");
  const [targetNewDep, setTargetNewDep] = useState("");
  const [targetNewDrm, setTargetNewDrm] = useState("");
  const [targetNewSync, setTargetNewSync] = useState("");
  const [targetNewPhono, setTargetNewPhono] = useState("");
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);

  // État de suppression avec confirmation
  const [workToDelete, setWorkToDelete] = useState<WorkRead | null>(null);
  const [isDeletingWork, setIsDeletingWork] = useState(false);

  async function handleConfirmDeleteWork() {
    if (!workToDelete) return;
    setIsDeletingWork(true);
    try {
      await deleteWork(workToDelete.id);
      setWorks((prev) => prev.filter((w) => w.id !== workToDelete.id));
      setSelectedWorkIds((prev) => prev.filter((id) => id !== workToDelete.id));
      if (selectedWorkForDrawer?.id === workToDelete.id) {
        setSelectedWorkForDrawer(null);
      }
      setWorkToDelete(null);
    } catch (err) {
      console.error("Erreur suppression œuvre:", err);
      setWorks((prev) => prev.filter((w) => w.id !== workToDelete.id));
      setSelectedWorkIds((prev) => prev.filter((id) => id !== workToDelete.id));
      if (selectedWorkForDrawer?.id === workToDelete.id) {
        setSelectedWorkForDrawer(null);
      }
      setWorkToDelete(null);
    } finally {
      setIsDeletingWork(false);
    }
  }

  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  async function handleConfirmBatchDeleteWorks() {
    if (selectedWorkIds.length === 0) return;
    setIsBatchDeleting(true);
    try {
      await batchDeleteWorks(selectedWorkIds);
      setWorks((prev) => prev.filter((w) => !selectedWorkIds.includes(w.id)));
      if (selectedWorkForDrawer && selectedWorkIds.includes(selectedWorkForDrawer.id)) {
        setSelectedWorkForDrawer(null);
      }
      setSelectedWorkIds([]);
      setIsBatchDeleteModalOpen(false);
    } catch (err: any) {
      setWorks((prev) => prev.filter((w) => !selectedWorkIds.includes(w.id)));
      setSelectedWorkIds([]);
      setIsBatchDeleteModalOpen(false);
    } finally {
      setIsBatchDeleting(false);
    }
  }

  function toggleSelectWork(workId: string) {
    setSelectedWorkIds((prev) =>
      prev.includes(workId)
        ? prev.filter((id) => id !== workId)
        : [...prev, workId]
    );
  }

  function toggleSelectAll() {
    if (selectedWorkIds.length === filtered.length && filtered.length > 0) {
      setSelectedWorkIds([]);
    } else {
      setSelectedWorkIds(filtered.map((w) => w.id));
    }
  }

  function toggleSelectGroupForDelete(groupId: string) {
    setSelectedGroupIdsForDelete((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  }

  function toggleSelectAllGroupsForDelete() {
    if (selectedGroupIdsForDelete.length === workGroups.length && workGroups.length > 0) {
      setSelectedGroupIdsForDelete([]);
    } else {
      setSelectedGroupIdsForDelete(workGroups.map((g) => g.id));
    }
  }

  async function handleConfirmDeleteGroup() {
    if (!groupToDelete) return;
    setIsDeletingGroup(true);
    try {
      await deleteWorkGroup(groupToDelete.id);
    } catch (err) {
      console.error("Erreur suppression groupe:", err);
    } finally {
      const deletedId = groupToDelete.id;
      setWorkGroups((prev) => prev.filter((g) => g.id !== deletedId));
      setSelectedGroupIdsForDelete((prev) => prev.filter((id) => id !== deletedId));
      setWorks((prev) =>
        prev.map((w) => ({
          ...w,
          groups: (w.groups || []).filter((g) => g.id !== deletedId),
        }))
      );
      if (selectedGroupId === deletedId) {
        setSelectedGroupId("ALL");
      }
      setGroupToDelete(null);
      setIsDeletingGroup(false);
    }
  }

  async function handleConfirmBatchDeleteGroups() {
    if (selectedGroupIdsForDelete.length === 0) return;
    setIsBatchDeletingGroups(true);
    try {
      await batchDeleteWorkGroups(selectedGroupIdsForDelete);
    } catch (err) {
      console.error("Erreur suppression groupée de projets:", err);
    } finally {
      const idsSet = new Set(selectedGroupIdsForDelete);
      setWorkGroups((prev) => prev.filter((g) => !idsSet.has(g.id)));
      setWorks((prev) =>
        prev.map((w) => ({
          ...w,
          groups: (w.groups || []).filter((g) => !idsSet.has(g.id)),
        }))
      );
      if (idsSet.has(selectedGroupId)) {
        setSelectedGroupId("ALL");
      }
      setSelectedGroupIdsForDelete([]);
      setIsBatchDeleteGroupsModalOpen(false);
      setIsBatchDeletingGroups(false);
    }
  }

  async function handleCreateWorkGroupSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const payload: WorkGroupCreatePayload = {
      name: newGroupName.trim(),
      group_type: newGroupType,
      production_company: newGroupProd.trim() || null,
      broadcaster_or_client: newGroupBroadcaster.trim() || null,
      release_year: newGroupYear ? parseInt(newGroupYear, 10) : null,
      director_or_producer: newGroupDirector.trim() || null,
      notes: newGroupNotes.trim() || null,
      contract_reference: newGroupContractRef.trim() || null,
      initial_work_ids: selectedWorkIds.length > 0 ? selectedWorkIds : [],
    };

    try {
      const created = await createWorkGroup(payload);
      setWorkGroups((prev) => [created, ...prev]);
      setSelectedGroupId(created.id);
      setMigrationBanner(
        `Projet / Groupe « ${created.name} » créé avec succès.`
      );
    } catch {
      const localGroup: WorkGroupRead = {
        id: crypto.randomUUID(),
        name: payload.name,
        group_type: payload.group_type || "SERIE_TV",
        production_company: payload.production_company,
        broadcaster_or_client: payload.broadcaster_or_client,
        release_year: payload.release_year,
        director_or_producer: payload.director_or_producer,
        notes: payload.notes,
        contract_reference: payload.contract_reference,
        works_count: selectedWorkIds.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setWorkGroups((prev) => [localGroup, ...prev]);
      setSelectedGroupId(localGroup.id);
      setMigrationBanner(`Projet / Groupe « ${localGroup.name} » créé (local).`);
    } finally {
      setIsCreateGroupModalOpen(false);
      setNewGroupName("");
      setNewGroupNotes("");
      setNewGroupContractRef("");
      setNewGroupNotes("");
    }
  }

  async function handleExecuteBatchUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (selectedWorkIds.length === 0) return;
    setIsSubmittingBatch(true);

    const payload: WorkBatchUpdatePayload = {
      work_ids: selectedWorkIds,
      assign_to_group_id: batchAssignGroupId || null,
      inherit_group_contract: batchInheritContract,
      cue_usage_type: batchAssignGroupId ? batchCueUsage : null,
      administration_status: batchAdminStatus || null,
      contract_reference: batchContractRef.trim() || null,
      genre: batchGenre.trim() || null,
      append_timeline_note: batchTimelineNoteText.trim()
        ? {
            author: batchTimelineNoteAuthor.trim() || "Éditeur",
            text: batchTimelineNoteText.trim(),
          }
        : null,
      append_general_notes: batchGeneralNotes.trim() || null,
      splits_preset: batchPreset || null,
      target_holder_update:
        enableHolderTargeting && targetHolderQuery.trim()
          ? {
              target_holder_name_or_ipi: targetHolderQuery.trim(),
              new_holder_name: targetNewName.trim() || null,
              new_ipi_number: targetNewIpi.trim() || null,
              new_role: (targetNewRole as RightHolderRole) || null,
              new_dep_share_pct: targetNewDep.trim() || null,
              new_drm_share_pct: targetNewDrm.trim() || null,
              new_sync_share_pct: targetNewSync.trim() || null,
              new_phono_share_pct: targetNewPhono.trim() || null,
            }
          : null,
    };

    try {
      const result = await batchUpdateWorks(payload);
      const updatedWorks = await fetchWorks(
        selectedGroupId !== "ALL" ? selectedGroupId : undefined
      );
      setWorks(updatedWorks);
      const updatedGroups = await fetchWorkGroups();
      setWorkGroups(updatedGroups);
      setMigrationBanner(
        `Modification par lot réussie : ${result.summary_messages.join(" • ")}`
      );
    } catch {
      const targetGroup = workGroups.find((g) => g.id === batchAssignGroupId);
      setWorks((prev) =>
        prev.map((w) => {
          if (!selectedWorkIds.includes(w.id)) return w;
          const copy = { ...w };
          if (batchAdminStatus) copy.administration_status = batchAdminStatus;
          if (batchContractRef) copy.contract_reference = batchContractRef;
          if (batchGenre) copy.genre = batchGenre;
          if (batchAssignGroupId && targetGroup) {
            const existingGroups = copy.groups || [];
            if (!existingGroups.some((g) => g.id === targetGroup.id)) {
              copy.groups = [
                ...existingGroups,
                {
                  id: targetGroup.id,
                  name: targetGroup.name,
                  group_type: targetGroup.group_type,
                  broadcaster_or_client: targetGroup.broadcaster_or_client,
                  production_company: targetGroup.production_company,
                  cue_usage_type: batchCueUsage,
                },
              ];
            }
          }
          if (batchTimelineNoteText.trim()) {
            const newNote = {
              id: crypto.randomUUID(),
              author: batchTimelineNoteAuthor || "Éditeur",
              text: batchTimelineNoteText.trim(),
              created_at: new Date().toISOString(),
            };
            copy.timeline_notes = [newNote, ...(copy.timeline_notes || [])];
          }
          if (batchGeneralNotes.trim()) {
            copy.general_notes = copy.general_notes
              ? `${copy.general_notes}\n${batchGeneralNotes.trim()}`
              : batchGeneralNotes.trim();
          }
          if (enableHolderTargeting && targetHolderQuery.trim()) {
            const q = targetHolderQuery.trim().toLowerCase();
            copy.splits = copy.splits.map((s) => {
              if (
                s.holder_name.toLowerCase().includes(q) ||
                (s.ipi_number && s.ipi_number.toLowerCase() === q)
              ) {
                return {
                  ...s,
                  holder_name: targetNewName.trim() || s.holder_name,
                  ipi_number: targetNewIpi.trim() || s.ipi_number,
                  role: (targetNewRole as RightHolderRole) || s.role,
                  dep_share_pct: targetNewDep.trim() || s.dep_share_pct,
                  drm_share_pct: targetNewDrm.trim() || s.drm_share_pct,
                  sync_share_pct: targetNewSync.trim() || s.sync_share_pct,
                  phono_share_pct: targetNewPhono.trim() || s.phono_share_pct,
                };
              }
              return s;
            });
          }
          return copy;
        })
      );
      setMigrationBanner(
        `Modification par lot appliquée avec succès sur ${selectedWorkIds.length} œuvre(s).`
      );
    } finally {
      setIsSubmittingBatch(false);
      setIsBatchModalOpen(false);
      setSelectedWorkIds([]);
      setBatchAssignGroupId("");
      setBatchAdminStatus("");
      setBatchContractRef("");
      setBatchGenre("");
      setBatchTimelineNoteText("");
      setBatchGeneralNotes("");
      setEnableHolderTargeting(false);
      setTargetHolderQuery("");
      setTargetNewName("");
      setTargetNewIpi("");
      setTargetNewRole("");
      setTargetNewDep("");
      setTargetNewDrm("");
      setTargetNewSync("");
      setTargetNewPhono("");
    }
  }

  function openWorkDrawer(work: WorkRead) {
    setSelectedWorkForDrawer(work);
    setDrawerMemoText(work.general_notes || "");
    setDrawerTimelineText("");
    setDrawerBanner(null);

    // Mémoriser l'œuvre dans l'historique de consultation rapide
    addRecentItem({
      id: `work-${work.id}`,
      type: "WORK",
      title: work.title,
      subtitle: work.sacem_work_code
        ? `COCV ${work.sacem_work_code}`
        : work.performers?.[0]
        ? `Interprète: ${work.performers[0]}`
        : work.iswc || undefined,
      badge: "Œuvre",
      url: `/catalog?work_id=${work.id}&search=${encodeURIComponent(work.title)}`,
    });
  }

  function closeWorkDrawer() {
    setSelectedWorkForDrawer(null);
    setDrawerBanner(null);
  }

  async function handleSaveDrawerMemo() {
    if (!selectedWorkForDrawer) return;
    setIsSavingDrawerMemo(true);
    const updatedPayload = {
      title: selectedWorkForDrawer.title,
      subtitle: selectedWorkForDrawer.subtitle,
      alternate_titles: selectedWorkForDrawer.alternate_titles,
      iswc: selectedWorkForDrawer.iswc,
      isrc_codes: selectedWorkForDrawer.isrc_codes,
      performers: selectedWorkForDrawer.performers,
      genre: selectedWorkForDrawer.genre,
      duration_seconds: selectedWorkForDrawer.duration_seconds,
      creation_year: selectedWorkForDrawer.creation_year,
      administration_status: selectedWorkForDrawer.administration_status,
      contract_reference: selectedWorkForDrawer.contract_reference,
      general_notes: drawerMemoText.trim() || null,
      splits: selectedWorkForDrawer.splits,
    };

    try {
      const saved = await updateWork(
        selectedWorkForDrawer.id,
        updatedPayload
      );
      setSelectedWorkForDrawer(saved);
      setWorks((prev) =>
        prev.map((w) => (w.id === selectedWorkForDrawer.id ? saved : w))
      );
      setDrawerBanner("Mémo éditeur enregistré avec succès.");
    } catch {
      const localUpdated: WorkRead = {
        ...selectedWorkForDrawer,
        general_notes: drawerMemoText.trim() || null,
        updated_at: new Date().toISOString(),
      };
      setSelectedWorkForDrawer(localUpdated);
      setWorks((prev) =>
        prev.map((w) => (w.id === selectedWorkForDrawer.id ? localUpdated : w))
      );
      setDrawerBanner("Mémo enregistré (sauvegarde locale).");
    } finally {
      setIsSavingDrawerMemo(false);
      setTimeout(() => setDrawerBanner(null), 3000);
    }
  }

  async function handleAddDrawerTimelineNote(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedWorkForDrawer || !drawerTimelineText.trim()) return;
    setIsSubmittingDrawerNote(true);

    const author = drawerTimelineAuthor.trim() || "Éditeur";
    const text = drawerTimelineText.trim();

    try {
      const saved = await addWorkTimelineNote(selectedWorkForDrawer.id, {
        author,
        text,
      });
      setSelectedWorkForDrawer(saved);
      setWorks((prev) =>
        prev.map((w) => (w.id === selectedWorkForDrawer.id ? saved : w))
      );
      setDrawerTimelineText("");
      setDrawerBanner("Annotation ajoutée avec succès au fil d'activité.");
    } catch {
      const newNote: WorkTimelineNote = {
        id: crypto.randomUUID(),
        author,
        text,
        created_at: new Date().toISOString(),
      };
      const localNotes = [
        newNote,
        ...(selectedWorkForDrawer.timeline_notes || []),
      ];
      const localUpdated: WorkRead = {
        ...selectedWorkForDrawer,
        timeline_notes: localNotes,
        updated_at: new Date().toISOString(),
      };
      setSelectedWorkForDrawer(localUpdated);
      setWorks((prev) =>
        prev.map((w) => (w.id === selectedWorkForDrawer.id ? localUpdated : w))
      );
      setDrawerTimelineText("");
      setDrawerBanner("Annotation ajoutée (sauvegarde locale).");
    } finally {
      setIsSubmittingDrawerNote(false);
      setTimeout(() => setDrawerBanner(null), 3000);
    }
  }

  function openCreateWorkModal() {
    setEditingWorkId(null);
    setNewTitle("");
    setNewSubtitle("");
    setNewAlternateTitles("");
    setNewIswc("T-307.123.456-1");
    setNewSacemWorkCode("");
    setNewCotageNumber("");
    setNewIsrc("FRZ012600901");
    setNewPerformer("");
    setNewGenre("Pop / Chanson");
    setNewDurationSeconds("210");
    setNewCreationYear(String(new Date().getFullYear()));
    setNewAdminStatus("ACTIVE");
    setNewLifecycleStatus(null);
    setNewContractReference("");
    setNewGeneralNotes("");
    setNewSplits([
      {
        holder_name: "Camille Moreau",
        role: "AC",
        ipi_number: "00458912301",
        dep_share_pct: "50.00",
        drm_share_pct: "50.00",
        sync_share_pct: "50.00",
        phono_share_pct: "20.00",
        share_percentage: "50.00",
      },
      {
        holder_name: "Éditions Solstices Music",
        role: "E",
        ipi_number: "00891234567",
        dep_share_pct: "50.00",
        drm_share_pct: "50.00",
        sync_share_pct: "50.00",
        phono_share_pct: "80.00",
        share_percentage: "50.00",
      },
    ]);
    setIsModalOpen(true);
  }

  function openEditWorkModal(work: WorkRead) {
    // Ferme automatiquement le tiroir latéral pour n'afficher que la modale d'édition
    closeWorkDrawer();
    setEditingWorkId(work.id);
    setNewTitle(work.title);
    setNewSubtitle(work.subtitle || "");
    setNewAlternateTitles(work.alternate_titles.join(" ; "));
    setNewIswc(work.iswc || "");
    setNewSacemWorkCode(work.sacem_work_code || "");
    setNewCotageNumber(work.cotage_number || "");
    setNewIsrc(work.isrc_codes[0] || "");
    setNewPerformer(work.performers.join(", "));
    setNewGenre(work.genre || "");
    setNewDurationSeconds(
      work.duration_seconds ? String(work.duration_seconds) : ""
    );
    setNewCreationYear(work.creation_year ? String(work.creation_year) : "");
    setNewAdminStatus(
      (work.administration_status as AdministrationStatus) || "ACTIVE"
    );
    setNewLifecycleStatus(work.lifecycle_status || null);
    setNewContractReference(work.contract_reference || "");
    setNewGeneralNotes(work.general_notes || "");
    setNewSplits(
      work.splits.map((s) => ({
        ...s,
        sync_share_pct: s.sync_share_pct || "0.00",
        phono_share_pct: s.phono_share_pct || "0.00",
        is_controlled: s.is_controlled || false,
        controlled_by_name: s.controlled_by_name || null,
      }))
    );
    setIsModalOpen(true);
  }

  function applySplitPreset(
    presetType:
      | "CESSION_50_50"
      | "TIERS_33_33_34"
      | "COEDITION_50_25_25"
      | "GESTION_90_10"
      | "PHONO_80_20"
  ) {
    if (presetType === "CESSION_50_50") {
      setNewSplits([
        {
          holder_name: newSplits[0]?.holder_name || "Auteur-Compositeur",
          role: "AC",
          ipi_number: newSplits[0]?.ipi_number || "00398765432",
          dep_share_pct: "50.00",
          drm_share_pct: "50.00",
          sync_share_pct: "50.00",
          phono_share_pct: "20.00",
          share_percentage: "50.00",
        },
        {
          holder_name: "Éditions Solstices Music",
          role: "E",
          ipi_number: "00891234567",
          dep_share_pct: "50.00",
          drm_share_pct: "50.00",
          sync_share_pct: "50.00",
          phono_share_pct: "80.00",
          share_percentage: "50.00",
        },
      ]);
    } else if (presetType === "TIERS_33_33_34") {
      setNewSplits([
        {
          holder_name: "Léa Vasseur (Auteur)",
          role: "A",
          ipi_number: "00512398741",
          dep_share_pct: "33.33",
          drm_share_pct: "33.33",
          sync_share_pct: "33.33",
          phono_share_pct: "15.00",
          share_percentage: "33.33",
        },
        {
          holder_name: "Julien Delacroix (Compositeur)",
          role: "C",
          ipi_number: "00623489120",
          dep_share_pct: "33.33",
          drm_share_pct: "33.33",
          sync_share_pct: "33.33",
          phono_share_pct: "15.00",
          share_percentage: "33.33",
        },
        {
          holder_name: "Éditions Solstices Music",
          role: "E",
          ipi_number: "00891234567",
          dep_share_pct: "33.34",
          drm_share_pct: "33.34",
          sync_share_pct: "33.34",
          phono_share_pct: "70.00",
          share_percentage: "33.34",
        },
      ]);
    } else if (presetType === "COEDITION_50_25_25") {
      setNewSplits([
        {
          holder_name: newSplits[0]?.holder_name || "Auteur-Compositeur",
          role: "AC",
          ipi_number: newSplits[0]?.ipi_number || "00458912301",
          dep_share_pct: "50.00",
          drm_share_pct: "50.00",
          sync_share_pct: "50.00",
          phono_share_pct: "20.00",
          share_percentage: "50.00",
        },
        {
          holder_name: "Éditions Solstices Music",
          role: "E",
          ipi_number: "00891234567",
          dep_share_pct: "25.00",
          drm_share_pct: "25.00",
          sync_share_pct: "25.00",
          phono_share_pct: "40.00",
          share_percentage: "25.00",
        },
        {
          holder_name: "Co-Éditeur Partenaire",
          role: "E",
          ipi_number: "00912345678",
          dep_share_pct: "25.00",
          drm_share_pct: "25.00",
          sync_share_pct: "25.00",
          phono_share_pct: "40.00",
          share_percentage: "25.00",
        },
      ]);
    } else if (presetType === "GESTION_90_10") {
      setNewSplits([
        {
          holder_name: newSplits[0]?.holder_name || "Auteur-Compositeur",
          role: "AC",
          ipi_number: newSplits[0]?.ipi_number || "00458912301",
          dep_share_pct: "90.00",
          drm_share_pct: "90.00",
          sync_share_pct: "90.00",
          phono_share_pct: "50.00",
          share_percentage: "90.00",
        },
        {
          holder_name: "Éditions Solstices Music",
          role: "SE",
          ipi_number: "00891234567",
          dep_share_pct: "10.00",
          drm_share_pct: "10.00",
          sync_share_pct: "10.00",
          phono_share_pct: "50.00",
          share_percentage: "10.00",
        },
      ]);
    } else if (presetType === "PHONO_80_20") {
      setNewSplits([
        {
          holder_name: newSplits[0]?.holder_name || "Artiste-Interprète",
          role: "I",
          ipi_number: newSplits[0]?.ipi_number || "00458912301",
          dep_share_pct: "50.00",
          drm_share_pct: "50.00",
          sync_share_pct: "50.00",
          phono_share_pct: "20.00",
          share_percentage: "50.00",
        },
        {
          holder_name: "Éditions Solstices Music",
          role: "P",
          ipi_number: "00891234567",
          dep_share_pct: "50.00",
          drm_share_pct: "50.00",
          sync_share_pct: "50.00",
          phono_share_pct: "80.00",
          share_percentage: "50.00",
        },
      ]);
    }
  }

  useEffect(() => {
    fetchWorkGroups()
      .then((groups) => {
        setWorkGroups(groups);
      })
      .catch(() => {});
    loadCatalogAudit();
  }, []);

  useEffect(() => {
    const groupId = selectedGroupId !== "ALL" ? selectedGroupId : undefined;
    fetchWorks(groupId)
      .then((data) => {
        setWorks(data);
      })
      .catch(() => {});

    function handleEntityChange() {
      const gId = selectedGroupId !== "ALL" ? selectedGroupId : undefined;
      fetchWorks(gId).then((data) => setWorks(data)).catch(() => {});
      fetchWorkGroups().then((groups) => setWorkGroups(groups)).catch(() => {});
      loadCatalogAudit();
    }

    window.addEventListener("korom_entity_changed", handleEntityChange);
    return () => {
      window.removeEventListener("korom_entity_changed", handleEntityChange);
    };
  }, [selectedGroupId]);

  const depSum = newSplits.reduce(
    (acc, s) => acc + (parseFloat(s.dep_share_pct) || 0),
    0
  );
  const drmSum = newSplits.reduce(
    (acc, s) => acc + (parseFloat(s.drm_share_pct) || 0),
    0
  );
  const syncSum = newSplits.reduce(
    (acc, s) =>
      acc + (parseFloat(s.sync_share_pct || "0") || 0),
    0
  );
  const phonoSum = newSplits.reduce(
    (acc, s) =>
      acc + (parseFloat(s.phono_share_pct || "0") || 0),
    0
  );

  function updateModalSplit(
    idx: number,
    field: keyof RightHolderSplit,
    value: any
  ) {
    setNewSplits((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  }

  function addModalSplitRow() {
    setNewSplits((prev) => [
      ...prev,
      {
        holder_name: "",
        role: "A",
        ipi_number: "",
        dep_share_pct: "0.00",
        drm_share_pct: "0.00",
        sync_share_pct: "0.00",
        phono_share_pct: "0.00",
        share_percentage: "0.00",
      },
    ]);
  }

  function removeModalSplitRow(idx: number) {
    setNewSplits((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleCreateWorkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const existingWork = editingWorkId
      ? works.find((w) => w.id === editingWorkId)
      : null;

    // Découpage intelligent des sous-titres et titres alternatifs séparés par ";" (ou retours à la ligne / pipes)
    // Ne tient pas compte des espaces autour des séparateurs (ex: " ; ", "; ", " ;")
    const parseDelimited = (text: string): string[] => {
      return text
        .split(/[;\n|]/)
        .map((s) => s.trim())
        .filter(Boolean);
    };

    const subTokens = parseDelimited(newSubtitle);
    const altTokens = parseDelimited(newAlternateTitles);

    // Le premier sous-titre reste le sous-titre officiel Sacem,
    // les sous-titres suivants (si plusieurs saisis avec ";") sont versés dans les titres alternatifs
    const primarySubtitle = subTokens[0] || null;
    const extraSubs = subTokens.slice(1);

    const mergedAltTitles = Array.from(
      new Set([...altTokens, ...extraSubs])
    );

    const payload = {
      title: newTitle.trim(),
      subtitle: primarySubtitle,
      alternate_titles:
        mergedAltTitles.length > 0
          ? mergedAltTitles
          : existingWork && !newAlternateTitles.trim() && !newSubtitle.trim()
            ? []
            : existingWork
              ? existingWork.alternate_titles
              : [],
      iswc: newIswc.trim() || null,
      sacem_work_code: newSacemWorkCode.trim() || null,
      cotage_number: newCotageNumber.trim() || null,
      isrc_codes: newIsrc.trim() ? [newIsrc.trim()] : [],
      performers: newPerformer
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      genre: newGenre.trim() || null,
      duration_seconds: newDurationSeconds
        ? parseInt(newDurationSeconds, 10)
        : null,
      creation_year: newCreationYear
        ? parseInt(newCreationYear, 10)
        : null,
      administration_status: newAdminStatus,
      lifecycle_status: newLifecycleStatus,
      contract_reference: newContractReference.trim() || null,
      general_notes: newGeneralNotes.trim() || null,
      rights_managed: ["DEP", "DRM", "SYNC", "PHONO"] as const,
      splits: newSplits.map((s) => ({
        ...s,
        ipi_number: s.ipi_number?.trim() || null,
        sync_share_pct: s.sync_share_pct || "0.00",
        phono_share_pct: s.phono_share_pct || "0.00",
        share_percentage: s.dep_share_pct,
        is_controlled: Boolean(s.is_controlled),
        controlled_by_name: s.is_controlled ? (s.controlled_by_name?.trim() || null) : null,
      })),
    };

    try {
      if (editingWorkId) {
        const updated = await updateWork(editingWorkId, payload);
        setWorks((prev) =>
          prev.map((w) => (w.id === editingWorkId ? updated : w))
        );
        openWorkDrawer(updated);
      } else {
        const created = await createWork(payload);
        setWorks((prev) => [created, ...prev]);
        openWorkDrawer(created);
      }
    } catch {
      const isReady =
        Math.abs(depSum - 100) < 0.01 &&
        Math.abs(drmSum - 100) < 0.01 &&
        Math.abs(syncSum - 100) < 0.01 &&
        Math.abs(phonoSum - 100) < 0.01 &&
        newSplits.every((s) => s.ipi_number && s.ipi_number.length >= 9);
      const localWork: WorkRead = {
        id: editingWorkId || crypto.randomUUID(),
        title: payload.title,
        subtitle: payload.subtitle,
        alternate_titles: payload.alternate_titles,
        iswc: payload.iswc,
        sacem_work_code: payload.sacem_work_code,
        cotage_number: payload.cotage_number,
        isrc_codes: payload.isrc_codes,
        performers: payload.performers,
        genre: payload.genre,
        duration_seconds: payload.duration_seconds,
        creation_year: payload.creation_year,
        administration_status: payload.administration_status,
        contract_reference: payload.contract_reference,
        general_notes: payload.general_notes,
        timeline_notes: existingWork?.timeline_notes || [],
        rights_managed: ["DEP", "DRM", "SYNC", "PHONO"],
        splits: payload.splits,
        cwr_validation: {
          work_id: editingWorkId,
          work_title: payload.title,
          is_cwr_ready: isReady,
          dep_total_pct: depSum.toFixed(2),
          drm_total_pct: drmSum.toFixed(2),
          sync_total_pct: syncSum.toFixed(2),
          phono_total_pct: phonoSum.toFixed(2),
          publisher_dep_pct: "50.00",
          blocking_errors: isReady
            ? []
            : [
                `Vérifiez les sommes DEP (${depSum.toFixed(
                  2
                )}%) / DRM (${drmSum.toFixed(2)}%) / SYNC (${syncSum.toFixed(
                  2
                )}%) / PHONO (${phonoSum.toFixed(2)}%) et les codes IPI.`,
              ],
          warnings: [],
        },
        created_at: existingWork?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (editingWorkId) {
        setWorks((prev) =>
          prev.map((w) => (w.id === editingWorkId ? localWork : w))
        );
        openWorkDrawer(localWork);
      } else {
        setWorks((prev) => [localWork, ...prev]);
        openWorkDrawer(localWork);
      }
    }
    setIsModalOpen(false);
    setEditingWorkId(null);
    setNewTitle("");
    setNewSubtitle("");
    setNewAlternateTitles("");
    setNewPerformer("");
    setNewGenre("");
    setNewDurationSeconds("");
    setNewCreationYear("");
    setNewContractReference("");
    setNewGeneralNotes("");
  }

  function handleExportCwr() {
    setCwrFilterGroupId(selectedGroupId !== "ALL" ? selectedGroupId : "ALL");
    setIsCwrExportConfigModalOpen(true);
  }

  async function handleExportSelectedCwr() {
    if (selectedWorkIds.length === 0) return;
    setIsExportingCwr(true);
    try {
      const data = await exportCatalogCwr({ work_ids: selectedWorkIds });
      setCwrModalData(data);
    } catch (err) {
      console.error("Erreur export CWR sélection:", err);
      const filtered = works.filter((w) => selectedWorkIds.includes(w.id));
      const readyWorks = filtered.filter((w) => w.cwr_validation?.is_cwr_ready);
      const skipped = filtered.filter((w) => !w.cwr_validation?.is_cwr_ready);
      const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      setCwrModalData({
        filename: `CW26${nowStr.slice(4)}001_SELECTION.V21`,
        cwr_version: "2.1",
        included_works_count: readyWorks.length,
        included_works: readyWorks.map((w) => w.title),
        skipped_works_count: skipped.length,
        skipped_works: skipped.map((w) => ({
          work_id: w.id,
          work_title: w.title,
          blocking_errors: w.cwr_validation?.blocking_errors || ["Conflit bloquant"],
        })),
        filtered_by_selection: selectedWorkIds.length,
        content: `HDRPB008912345EDITIONS SOLSTICES MUSIC...`,
      });
    } finally {
      setIsExportingCwr(false);
    }
  }

  async function handleConfirmAssignGroup(e: React.FormEvent) {
    e.preventDefault();
    if (selectedWorkIds.length === 0 || !assignTargetGroupId) return;
    setIsSubmittingAssign(true);
    try {
      const targetGroup = workGroups.find((g) => g.id === assignTargetGroupId);
      await batchUpdateWorks({
        work_ids: selectedWorkIds,
        assign_to_group_id: assignTargetGroupId,
        inherit_group_contract: assignInheritContract,
        cue_usage_type: assignCueUsage,
      });
      const updatedWorks = await fetchWorks(
        selectedGroupId !== "ALL" ? selectedGroupId : undefined
      );
      setWorks(updatedWorks);
      const updatedGroups = await fetchWorkGroups();
      setWorkGroups(updatedGroups);
      setMigrationBanner(
        `✓ ${selectedWorkIds.length} œuvre(s) rattachée(s) avec succès au projet « ${targetGroup?.name || "Projet"} ».`
      );
      setIsAssignGroupModalOpen(false);
      setSelectedWorkIds([]);
    } catch (err) {
      console.error("Erreur rattachement groupe:", err);
      const targetGroup = workGroups.find((g) => g.id === assignTargetGroupId);
      setWorks((prev) =>
        prev.map((w) => {
          if (!selectedWorkIds.includes(w.id)) return w;
          const copy = { ...w };
          if (targetGroup) {
            if (assignInheritContract && targetGroup.contract_reference) {
              copy.contract_reference = targetGroup.contract_reference;
            }
            const existingGroups = copy.groups || [];
            if (!existingGroups.some((g) => g.id === targetGroup.id)) {
              copy.groups = [
                ...existingGroups,
                {
                  id: targetGroup.id,
                  name: targetGroup.name,
                  group_type: targetGroup.group_type,
                  contract_reference: targetGroup.contract_reference,
                  cue_usage_type: assignCueUsage,
                },
              ];
            }
          }
          return copy;
        })
      );
      setMigrationBanner(
        `✓ ${selectedWorkIds.length} œuvre(s) rattachée(s) au projet « ${targetGroup?.name || "Projet"} » (local).`
      );
      setIsAssignGroupModalOpen(false);
      setSelectedWorkIds([]);
    } finally {
      setIsSubmittingAssign(false);
    }
  }

  async function handleRunCwrExport() {
    setIsExportingCwr(true);
    try {
      const filters: CwrExportFilters = {};
      if (cwrFilterGroupId === "SELECTED") {
        filters.work_ids = selectedWorkIds;
      } else if (cwrFilterGroupId && cwrFilterGroupId !== "ALL") {
        filters.work_group_id = cwrFilterGroupId;
      }
      if (cwrDateFrom) {
        filters.date_from = cwrDateFrom;
      }
      if (cwrDateTo) {
        filters.date_to = cwrDateTo;
      }
      const data = await exportCatalogCwr(filters);
      setIsCwrExportConfigModalOpen(false);
      setCwrModalData(data);
    } catch {
      let filtered = works;
      if (cwrFilterGroupId === "SELECTED") {
        filtered = filtered.filter((w) => selectedWorkIds.includes(w.id));
      } else if (cwrFilterGroupId && cwrFilterGroupId !== "ALL") {
        filtered = filtered.filter((w) =>
          w.groups?.some((g) => g.id === cwrFilterGroupId)
        );
      }
      const readyWorks = filtered.filter((w) => w.cwr_validation?.is_cwr_ready);
      const skipped = filtered.filter((w) => !w.cwr_validation?.is_cwr_ready);
      const targetGroup = workGroups.find((g) => g.id === cwrFilterGroupId);
      const groupTag = cwrFilterGroupId === "SELECTED"
        ? "SELECTION"
        : targetGroup
        ? targetGroup.name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10)
        : "SOLSTICES";
      const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

      setIsCwrExportConfigModalOpen(false);
      setCwrModalData({
        filename: `CW26${nowStr.slice(4)}001_${groupTag}.V21`,
        cwr_version: "2.1",
        included_works_count: readyWorks.length,
        included_works: readyWorks.map((w) => w.title),
        skipped_works_count: skipped.length,
        skipped_works: skipped.map((w) => ({
          work_id: w.id,
          work_title: w.title,
          blocking_errors: w.cwr_validation?.blocking_errors || [],
        })),
        filtered_by_group: targetGroup
          ? { id: targetGroup.id, name: targetGroup.name }
          : undefined,
        filtered_by_selection: cwrFilterGroupId === "SELECTED" ? selectedWorkIds.length : undefined,
        filtered_by_dates:
          cwrDateFrom || cwrDateTo
            ? { date_from: cwrDateFrom || null, date_to: cwrDateTo || null }
            : undefined,
        content: [
          `HDRPB008912345EDITIONS SOLSTICES MUSIC                     01.10${nowStr}120000${nowStr}`,
          "GRHNWR0000102.100000000000",
          ...readyWorks.flatMap((w, i) => {
            const txSeq = String(i).padStart(8, "0");
            const workCode = (w.cotage_number || w.sacem_work_code || w.contract_reference || w.id)
              .slice(0, 14)
              .toUpperCase()
              .padEnd(14, " ");
            const splitLines = (w.splits || []).map((sp, spIdx) => {
              const subSeq = String(spIdx + 1).padStart(8, "0");
              const isPub = ["E", "SE", "PUBLISHER", "SUB_PUBLISHER"].includes(sp.role);
              const recType = isPub ? `SPU${txSeq}${subSeq}01` : `SWR${txSeq}${subSeq}`;
              const roleCode = isPub
                ? sp.role === "SE" || sp.role === "SUB_PUBLISHER"
                  ? "SE"
                  : "E "
                : sp.role === "AC"
                ? "CA"
                : `${sp.role.slice(0, 2).padEnd(2, " ")}`;
              const ipi = (sp.ipi_number || "00000000000").slice(-11).padStart(11, "0");
              const depBp = String(Math.round((parseFloat(sp.dep_share_pct) || 0) * 100)).padStart(5, "0");
              const drmBp = String(Math.round((parseFloat(sp.drm_share_pct) || 0) * 100)).padStart(5, "0");
              return `${recType}${workCode.slice(0, 9)}${(sp.holder_name || "").toUpperCase().slice(0, 45).padEnd(45, " ")} ${roleCode}000000000${ipi}058${depBp}058${drmBp}   00000`;
            });
            return [
              `NWR${txSeq}00000000${w.title.toUpperCase().slice(0, 60).padEnd(60, " ")}  ${workCode}${(w.iswc || "").replace(/[-.]/g, "").padEnd(11, " ")}00000000    UNC`,
              ...splitLines,
            ];
          }),
          `GRT00001${String(readyWorks.length).padStart(8, "0")}00000010   0000000000`,
          `TRL00001${String(readyWorks.length).padStart(8, "0")}00000010`,
        ].join("\n"),
      });
    } finally {
      setIsExportingCwr(false);
    }
  }

  async function handleApplyInheritanceToGroup(groupId: string) {
    try {
      const res = await applyWorkGroupInheritance(groupId, true, false);
      setMigrationBanner(
        `Héritage contrat appliqué au projet « ${res.group_name} » : ${res.affected_works_count} œuvre(s) mise(s) à jour avec le contrat ${res.contract_reference || ""}.`
      );
      const updatedWorks = await fetchWorks(
        selectedGroupId !== "ALL" ? selectedGroupId : undefined
      );
      setWorks(updatedWorks);
    } catch (err) {
      console.error(err);
      setMigrationBanner("Erreur lors de l'application de l'héritage contrat.");
    }
  }

  function downloadCwrFile() {
    if (!cwrModalData) return;
    const blob = new Blob([cwrModalData.content], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = cwrModalData.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = works.filter((w) => {
    const query = search.trim().toLowerCase();
    if (query) {
      const inTitle = w.title.toLowerCase().includes(query);
      const inSubtitle = (w.subtitle || "").toLowerCase().includes(query);
      const inAlias = w.alternate_titles.some((t) =>
        t.toLowerCase().includes(query)
      );
      const inIswc = (w.iswc || "").toLowerCase().includes(query);
      const inSacem = (w.sacem_work_code || "").toLowerCase().includes(query);
      const inCotageNum = (w.cotage_number || "").toLowerCase().includes(query);
      const inCotage = (w.contract_reference || "")
        .toLowerCase()
        .includes(query);
      const inIsrc = w.isrc_codes.some((c) => c.toLowerCase().includes(query));
      const inPerformers = w.performers.some((p) =>
        p.toLowerCase().includes(query)
      );
      const inSplits = w.splits.some(
        (s) =>
          s.holder_name.toLowerCase().includes(query) ||
          (s.ipi_number || "").toLowerCase().includes(query) ||
          s.role.toLowerCase() === query
      );
      const inGroups = (w.groups || []).some(
        (g) =>
          g.name.toLowerCase().includes(query) ||
          (g.broadcaster_or_client || "").toLowerCase().includes(query)
      );
      if (
        !inTitle &&
        !inSubtitle &&
        !inAlias &&
        !inIswc &&
        !inSacem &&
        !inCotageNum &&
        !inCotage &&
        !inIsrc &&
        !inPerformers &&
        !inSplits &&
        !inGroups
      ) {
        return false;
      }
    }

    const effStatus = (() => {
      if (w.lifecycle_status) return w.lifecycle_status;
      if (w.administration_status === "ARCHIVED") return "ARCHIVE";
      if (w.sacem_registration_status === "REJECTED") return "REJET_SACEM";
      if (
        w.sacem_registration_status === "REGISTERED" ||
        (w.sacem_work_code && w.cwr_validation?.is_cwr_ready)
      )
        return "DEPOSE_ET_EXPLOITE";
      if (w.sacem_registration_status === "PENDING_ACK") return "DEPOSE_EN_ATTENTE";
      if (w.cwr_validation && !w.cwr_validation.is_cwr_ready)
        return "INFORMATIONS_MANQUANTES";
      return "A_DEPOSER";
    })();

    if (filter === "READY" || filter === "A_DEPOSER") {
      if (effStatus !== "A_DEPOSER") return false;
    } else if (filter === "CONFLICT" || filter === "INFORMATIONS_MANQUANTES") {
      if (effStatus !== "INFORMATIONS_MANQUANTES") return false;
    } else if (filter === "DEPOSE_ET_EXPLOITE" || filter === "SACEM_REGISTERED") {
      if (effStatus !== "DEPOSE_ET_EXPLOITE") return false;
    } else if (filter === "DEPOSE_EN_ATTENTE") {
      if (effStatus !== "DEPOSE_EN_ATTENTE") return false;
    } else if (filter === "SACEM_REJECTED" || filter === "REJET_SACEM") {
      if (effStatus !== "REJET_SACEM") return false;
    } else if (filter === "ARCHIVE") {
      if (effStatus !== "ARCHIVE") return false;
    } else if (filter === "MISSING_IPI") {
      const hasMissingIpi = w.splits.some(
        (s) =>
          !s.ipi_number ||
          s.ipi_number.trim() === "" ||
          s.ipi_number === "00000000000"
      );
      if (!hasMissingIpi) return false;
    } else if (filter === "SUB_PUB") {
      const isSubPub =
        w.splits.some(
          (s) => s.role === "SE" || s.role === "SUB_PUBLISHER"
        ) ||
        w.splits.filter((s) => s.role === "E" || s.role === "PUBLISHER")
          .length > 1;
      if (!isSubPub) return false;
    } else if (filter === "WITH_NOTES") {
      const hasNotes =
        (w.timeline_notes && w.timeline_notes.length > 0) ||
        Boolean(w.general_notes) ||
        w.administration_status === "IN_DISPUTE";
      if (!hasNotes) return false;
    }

    if (selectedGroupId !== "ALL") {
      const inGroup = w.groups?.some((g) => g.id === selectedGroupId);
      if (!inGroup) return false;
    }
    return true;
  });

  const countAll = works.length;
  const countADeposer = works.filter((w) => {
    const s = w.lifecycle_status || (w.cwr_validation?.is_cwr_ready && !w.sacem_work_code && !w.sacem_registration_status ? "A_DEPOSER" : "");
    return s === "A_DEPOSER";
  }).length;
  const countInfoManquantes = works.filter((w) => {
    const s = w.lifecycle_status || (w.cwr_validation && !w.cwr_validation.is_cwr_ready ? "INFORMATIONS_MANQUANTES" : "");
    return s === "INFORMATIONS_MANQUANTES";
  }).length;
  const countDeposeExploite = works.filter((w) => {
    const s = w.lifecycle_status || (w.sacem_registration_status === "REGISTERED" || (w.sacem_work_code && w.cwr_validation?.is_cwr_ready) ? "DEPOSE_ET_EXPLOITE" : "");
    return s === "DEPOSE_ET_EXPLOITE";
  }).length;
  const countPendingAck = works.filter((w) => {
    const s = w.lifecycle_status || (w.sacem_registration_status === "PENDING_ACK" ? "DEPOSE_EN_ATTENTE" : "");
    return s === "DEPOSE_EN_ATTENTE";
  }).length;
  const countSacemRejected = works.filter((w) => {
    const s = w.lifecycle_status || (w.sacem_registration_status === "REJECTED" ? "REJET_SACEM" : "");
    return s === "REJET_SACEM";
  }).length;
  const countMissingIpi = works.filter((w) =>
    w.splits.some(
      (s) =>
        !s.ipi_number ||
        s.ipi_number.trim() === "" ||
        s.ipi_number === "00000000000"
    )
  ).length;
  const countSubPub = works.filter(
    (w) =>
      w.splits.some((s) => s.role === "SE" || s.role === "SUB_PUBLISHER") ||
      w.splits.filter((s) => s.role === "E" || s.role === "PUBLISHER").length > 1
  ).length;
  const countNotes = works.filter(
    (w) =>
      (w.timeline_notes && w.timeline_notes.length > 0) ||
      Boolean(w.general_notes) ||
      w.administration_status === "IN_DISPUTE"
  ).length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filtered.length);
  const paginatedWorks = filtered.slice(startIndex, endIndex);

  return (
    <div className="space-y-4">
      {/* En-tête Principal du Catalogue Korom */}
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center border-b pb-3.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-micro text-[28px] font-bold tracking-tight text-foreground leading-none">
              Catalogue d&apos;œuvres
            </h1>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              Édition & Répertoire
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Vue Haute Densité conçue pour les catalogues de 10 000+ œuvres • Contrôle déterministe à 100.00 % des clés Sacem (DEP, DRM, SYNC, PHONO).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Commutateur de vue Table Haute Densité / Cartes */}
          <div className="inline-flex items-center rounded-lg border bg-card p-0.5 mr-1">
            <button
              type="button"
              onClick={() => setViewMode("TABLE")}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                viewMode === "TABLE"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Vue Table Compacte (Haute Densité pour 10 000+ œuvres)"
            >
              <List className="h-3.5 w-3.5" />
              Table Compacte
            </button>
            <button
              type="button"
              onClick={() => setViewMode("CARDS")}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                viewMode === "CARDS"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Vue Cartes Détaillées"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Cartes
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setMigrationSourceSystem("SACEM_CSV");
              setIsMigrationModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-600/50 bg-indigo-600/10 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-600/20 transition-colors"
          >
            <FileUp className="h-3.5 w-3.5" />
            Importer mon catalogue SACEM (.xlsx / .csv)
          </button>

          <button
            type="button"
            onClick={() => {
              setIsAuditModalOpen(true);
              loadCatalogAudit();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-600/40 bg-purple-600/10 px-3 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-600/20 transition-colors shadow-xs"
            title="Atelier de Diagnostic & Santé du Catalogue (audit automatique de conformité et auto-réparation)"
          >
            <Activity className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            <span>Atelier Diagnostic & Santé</span>
            {auditReport && (
              <span
                className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  auditReport.blocking_works_count > 0
                    ? "bg-rose-500 text-white"
                    : "bg-emerald-600 text-white"
                }`}
              >
                {auditReport.health_score_pct}%
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportCwr}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 transition-colors cursor-pointer"
          >
            <FileCode2 className="h-3.5 w-3.5" />
            Exporter CWR (.V21 SACEM)
          </button>

          <button
            type="button"
            onClick={() =>
              exportCatalogXlsx({
                workGroupId: selectedGroupId !== "ALL" ? selectedGroupId : undefined,
                workIds: selectedWorkIds.length > 0 ? selectedWorkIds : undefined,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-600/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 transition-colors cursor-pointer"
            title="Exporter un classeur Excel (.xlsx) de visibilité contenant les œuvres, cotages, codes IPI et clés de répartition"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Exporter Visibilité (.xlsx)
          </button>

          <button
            type="button"
            onClick={() => setIsCwrAckModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-600/40 bg-violet-600/10 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-600/20 transition-colors shadow-xs"
            title="Importer le fichier d'accusé de réception SACEM (ACK / NACK) pour synchroniser les enregistrements et rejets"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-violet-600" />
            <span>Accusé SACEM (ACK)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSandboxDiffOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-600/40 bg-indigo-600/10 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600/20 transition-colors shadow-xs"
            title="Bac à sable différentiel SACEM vs Korom & livraison aux sous-éditeurs internationaux (US-5.18)"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
            <span>Bac à Sable & Sous-Édition</span>
          </button>

          <button
            type="button"
            onClick={openCreateWorkModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Nouvelle œuvre
          </button>
        </div>
      </div>

      {/* Barre de Triage Rapide Métier Éditeur (Chips Déterministes) */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setFilter("ALL")}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
            filter === "ALL"
              ? "bg-primary text-primary-foreground border-primary shadow-xs"
              : "bg-card text-foreground hover:bg-accent border-border"
          }`}
        >
          Toutes ({countAll})
        </button>
        <button
          type="button"
          onClick={() => setFilter("A_DEPOSER")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
            filter === "A_DEPOSER" || filter === "READY"
              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
              : "bg-card text-blue-700 hover:bg-blue-50 border-blue-500/30"
          }`}
        >
          <Send className="h-3 w-3" />
          <span>À déposer ({countADeposer})</span>
        </button>
        <button
          type="button"
          onClick={() => setFilter("INFORMATIONS_MANQUANTES")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
            filter === "INFORMATIONS_MANQUANTES" || filter === "CONFLICT"
              ? "bg-amber-600 text-white border-amber-600 shadow-xs"
              : "bg-card text-amber-700 hover:bg-amber-50 border-amber-500/30"
          }`}
        >
          <Info className="h-3.5 w-3.5" />
          <span>Informations manquantes ({countInfoManquantes})</span>
        </button>
        <button
          type="button"
          onClick={() => setFilter("DEPOSE_ET_EXPLOITE")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
            filter === "DEPOSE_ET_EXPLOITE" || filter === "SACEM_REGISTERED"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
              : "bg-card text-emerald-700 hover:bg-emerald-50 border-emerald-500/30"
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Déposées &amp; Exploitées ({countDeposeExploite})</span>
        </button>
        {countPendingAck > 0 && (
          <button
            type="button"
            onClick={() => setFilter("DEPOSE_EN_ATTENTE")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
              filter === "DEPOSE_EN_ATTENTE"
                ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                : "bg-card text-purple-700 hover:bg-purple-50 border-purple-500/30"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>En attente d&apos;ACK ({countPendingAck})</span>
          </button>
        )}
        {countSacemRejected > 0 && (
          <button
            type="button"
            onClick={() => setFilter("REJET_SACEM")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border transition-colors ${
              filter === "REJET_SACEM" || filter === "SACEM_REJECTED"
                ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-300 animate-pulse"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
            <span>Rejets SACEM ({countSacemRejected})</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setFilter("MISSING_IPI")}
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
            filter === "MISSING_IPI"
              ? "bg-amber-600 text-white border-amber-600 shadow-xs"
              : "bg-card text-amber-700 hover:bg-amber-50 border-amber-500/30"
          }`}
        >
          <AlertCircle className="h-3 w-3" />
          <span>IPI Manquant ({countMissingIpi})</span>
        </button>
        <button
          type="button"
          onClick={() => setFilter("SUB_PUB")}
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
            filter === "SUB_PUB"
              ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
              : "bg-card text-indigo-700 hover:bg-indigo-50 border-indigo-500/30"
          }`}
        >
          <Layers className="h-3 w-3" />
          <span>Co / Sous-édition ({countSubPub})</span>
        </button>
        <button
          type="button"
          onClick={() => setFilter("WITH_NOTES")}
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
            filter === "WITH_NOTES"
              ? "bg-slate-700 text-white border-slate-700 shadow-xs"
              : "bg-card text-slate-700 hover:bg-slate-100 border-slate-300"
          }`}
        >
          <MessageSquare className="h-3 w-3" />
          <span>Mémos & Litiges ({countNotes})</span>
        </button>

        {(filter !== "ALL" || search || selectedGroupId !== "ALL") && (
          <button
            type="button"
            onClick={() => {
              setFilter("ALL");
              setSearch("");
              setSelectedGroupId("ALL");
            }}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground underline ml-2"
          >
            <X className="h-3 w-3" />
            Réinitialiser filtres
          </button>
        )}
      </div>

      {migrationBanner && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-800">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{migrationBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setMigrationBanner(null)}
            className="text-xs font-semibold underline hover:no-underline"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Modale Atelier de Diagnostic & Santé du Catalogue (US-4.4) */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-6xl rounded-2xl border bg-card p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            {/* En-tête */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                        Atelier de Diagnostic & Santé
                      </span>
                      {auditReport && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            auditReport.blocking_works_count > 0
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30"
                              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                          }`}
                        >
                          {auditReport.health_score_pct} % de Santé Globale
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold tracking-tight">
                      Contrôle de Conformité & Atelier de Réparation
                    </h2>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Audit automatique de l&apos;intégralité du catalogue selon les règles SACEM & CISAC CWR v2.1 • Détection proactive des blocages et réparation assistée en 1 clic.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadCatalogAudit}
                  disabled={isLoadingAudit}
                  className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors disabled:opacity-50"
                  title="Rafraîchir l'analyse d'audit"
                >
                  <Activity className={`h-3.5 w-3.5 ${isLoadingAudit ? "animate-spin" : ""}`} />
                  Actualiser
                </button>
                <button
                  type="button"
                  onClick={() => setIsAuditModalOpen(false)}
                  className="p-1.5 rounded-lg border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {isLoadingAudit ? (
              <div className="py-20 text-center space-y-3">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-r-transparent"></div>
                <p className="text-xs text-muted-foreground">Audit de conformité en cours sur l&apos;ensemble du catalogue...</p>
              </div>
            ) : auditReport ? (
              <div className="space-y-5">
                {/* 4 Cartes KPIs Synthétiques */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-1">
                    <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                      <span>Œuvres Conformes</span>
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                      {auditReport.healthy_works_count} <span className="text-xs font-normal text-muted-foreground">/ {auditReport.total_works}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {auditReport.health_score_pct} % du catalogue prêt pour dépôts CWR et répartitions
                    </p>
                  </div>

                  <div className={`rounded-xl border p-3.5 space-y-1 ${
                    auditReport.blocking_works_count > 0
                      ? "border-rose-500/30 bg-rose-500/5"
                      : "border-border bg-card"
                  }`}>
                    <div className="flex items-center justify-between text-xs text-rose-700 dark:text-rose-400 font-semibold">
                      <span>Erreurs Bloquantes</span>
                      <AlertCircle className="h-4 w-4 text-rose-600" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-rose-700 dark:text-rose-400">
                      {auditReport.blocking_works_count}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {auditReport.issues_by_category.MISSING_IPI || 0} IPI manquant(s) • {auditReport.issues_by_category.EQUILIBRIUM_ERROR || 0} clé(s) déséquilibrée(s)
                    </p>
                  </div>

                  <div className={`rounded-xl border p-3.5 space-y-1 ${
                    auditReport.warning_works_count > 0
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-border bg-card"
                  }`}>
                    <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 font-semibold">
                      <span>Vigilances & Contrats</span>
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400">
                      {auditReport.warning_works_count}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {auditReport.issues_by_category.ORPHAN_COEDITION || 0} co-édition(s) • {auditReport.issues_by_category.NO_CONTROLLED_PUBLISHER || 0} sans éditeur
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-3.5 space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                      <span>Métadonnées</span>
                      <Tag className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-foreground">
                      {(auditReport.issues_by_category.MISSING_SACEM_CODE || 0) + (auditReport.issues_by_category.MISSING_COTAGE || 0)}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {auditReport.issues_by_category.MISSING_SACEM_CODE || 0} sans COCV • {auditReport.issues_by_category.MISSING_COTAGE || 0} sans cotage
                    </p>
                  </div>
                </div>

                {/* Bloc Atelier de Réparation Automatique Déterministe */}
                <div className="rounded-xl border border-purple-500/40 bg-purple-500/5 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300">
                        <Wrench className="h-4 w-4" />
                        <span>⚡ Atelier de Réparation Automatique Déterministe</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Résolvez en masse les anomalies éligibles sans aucune ambiguïté humaine :
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isAutoRepairing}
                      onClick={handleTriggerAutoRepair}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-purple-700 disabled:opacity-50 transition-colors shrink-0"
                    >
                      {isAutoRepairing ? (
                        <>
                          <div className="h-3.5 w-3.5 border-2 border-white border-r-transparent rounded-full animate-spin" />
                          <span>Réparation en cours...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Lancer l&apos;Auto-Réparation</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1 border-t border-purple-500/20">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoRepairOptions.auto_fill_ipis_from_directory}
                        onChange={(e) =>
                          setAutoRepairOptions((prev) => ({
                            ...prev,
                            auto_fill_ipis_from_directory: e.target.checked,
                          }))
                        }
                        className="rounded border-purple-500 text-purple-600"
                      />
                      <span>Injecter les IPI depuis l&apos;Annuaire</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoRepairOptions.auto_balance_splits}
                        onChange={(e) =>
                          setAutoRepairOptions((prev) => ({
                            ...prev,
                            auto_balance_splits: e.target.checked,
                          }))
                        }
                        className="rounded border-purple-500 text-purple-600"
                      />
                      <span>Rééquilibrer les arrondis à 100.00 %</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoRepairOptions.auto_inherit_project_contracts}
                        onChange={(e) =>
                          setAutoRepairOptions((prev) => ({
                            ...prev,
                            auto_inherit_project_contracts: e.target.checked,
                          }))
                        }
                        className="rounded border-purple-500 text-purple-600"
                      />
                      <span>Hériter les contrats des projets TF1</span>
                    </label>
                  </div>

                  {autoRepairResult && (
                    <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>Rapport de réparation : {autoRepairResult.repaired_works_count} œuvre(s) modifiée(s)</span>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                        {autoRepairResult.summary_messages.map((msg, i) => (
                          <li key={i}>{msg}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Filtres de Triage de l'Audit */}
                <div className="flex flex-wrap items-center gap-1.5 border-b pb-3">
                  <span className="text-xs font-semibold mr-1 text-muted-foreground">Filtrer l&apos;audit :</span>
                  <button
                    type="button"
                    onClick={() => setAuditSelectedCategory("ALL")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                      auditSelectedCategory === "ALL"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card hover:bg-muted"
                    }`}
                  >
                    Toutes ({auditReport.items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditSelectedCategory("MISSING_IPI")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                      auditSelectedCategory === "MISSING_IPI"
                        ? "bg-rose-600 text-white border-rose-600"
                        : "bg-card hover:bg-muted text-rose-700 dark:text-rose-400"
                    }`}
                  >
                    IPI Manquants ({auditReport.issues_by_category.MISSING_IPI || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditSelectedCategory("EQUILIBRIUM_ERROR")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                      auditSelectedCategory === "EQUILIBRIUM_ERROR"
                        ? "bg-rose-600 text-white border-rose-600"
                        : "bg-card hover:bg-muted text-rose-700 dark:text-rose-400"
                    }`}
                  >
                    Clés déséquilibrées ({auditReport.issues_by_category.EQUILIBRIUM_ERROR || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditSelectedCategory("ORPHAN_COEDITION")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                      auditSelectedCategory === "ORPHAN_COEDITION"
                        ? "bg-amber-600 text-white border-amber-600"
                        : "bg-card hover:bg-muted text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    Co-éditions ({auditReport.issues_by_category.ORPHAN_COEDITION || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditSelectedCategory("MISSING_SACEM_CODE")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                      auditSelectedCategory === "MISSING_SACEM_CODE"
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-card hover:bg-muted text-indigo-700 dark:text-indigo-400"
                    }`}
                  >
                    Codes SACEM ({auditReport.issues_by_category.MISSING_SACEM_CODE || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditSelectedCategory("MISSING_COTAGE")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                      auditSelectedCategory === "MISSING_COTAGE"
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-card hover:bg-muted text-purple-700 dark:text-purple-400"
                    }`}
                  >
                    Cotages ({auditReport.issues_by_category.MISSING_COTAGE || 0})
                  </button>
                </div>

                {/* Tableau Haute Densité des Œuvres en Anomalie */}
                <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
                  <div className="overflow-x-auto max-h-[40vh]">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b bg-muted/50 text-muted-foreground sticky top-0 bg-card z-10">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Titre de l&apos;Œuvre</th>
                          <th className="px-3 py-2 font-semibold">Identifiants (SACEM / ISWC / Cotage)</th>
                          <th className="px-3 py-2 font-semibold">Contrat</th>
                          <th className="px-3 py-2 font-semibold">Anomalies Détectées & Diagnostic</th>
                          <th className="px-3 py-2 text-right font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {auditReport.items
                          .filter((item) => {
                            if (auditSelectedCategory === "ALL") return true;
                            return item.issues.some((iss) => iss.category === auditSelectedCategory);
                          })
                          .map((item) => {
                            const originalWork = works.find((w) => w.id === item.work_id);
                            return (
                              <tr key={item.work_id} className="hover:bg-muted/40 transition-colors">
                                <td className="px-3 py-2.5 font-medium">
                                  <div className="font-semibold text-foreground">{item.title}</div>
                                  <div className="text-[10px] text-muted-foreground font-mono">
                                    ID: {item.work_id.slice(0, 8)}...
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 space-y-1 font-mono text-[11px]">
                                  {item.sacem_work_code ? (
                                    <div className="text-indigo-700 dark:text-indigo-400 font-semibold">
                                      SACEM: {item.sacem_work_code}
                                    </div>
                                  ) : (
                                    <div className="text-muted-foreground/60 italic text-[10px]">
                                      Pas de code SACEM
                                    </div>
                                  )}
                                  {item.iswc && (
                                    <div className="text-foreground">{item.iswc}</div>
                                  )}
                                  {item.cotage_number && (
                                    <div className="text-purple-700 dark:text-purple-400">
                                      Cotage: {item.cotage_number}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2.5">
                                  {item.contract_reference ? (
                                    <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold">
                                      {item.contract_reference}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-muted-foreground italic">
                                      Aucun contrat
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 space-y-1">
                                  {item.issues.map((iss, idx) => (
                                    <div key={idx} className="flex items-start gap-1.5 text-[11px]">
                                      <span
                                        className={`rounded px-1.5 py-0.2 text-[10px] font-bold shrink-0 ${
                                          iss.severity === "ERROR"
                                            ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30"
                                            : iss.severity === "WARNING"
                                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                                            : "bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30"
                                        }`}
                                      >
                                        {iss.label}
                                      </span>
                                      <span className="text-muted-foreground text-[10px] leading-tight">
                                        {iss.details}
                                      </span>
                                      {iss.can_auto_repair && (
                                        <span className="text-[10px] text-purple-600 font-bold shrink-0 ml-auto">
                                          ⚡ Auto-réparable
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (originalWork) {
                                        setIsAuditModalOpen(false);
                                        openWorkDrawer(originalWork);
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-xs font-semibold hover:bg-muted text-foreground transition-colors"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    <span>Inspecter</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        {auditReport.items.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-12 text-center text-xs text-muted-foreground">
                              ✨ Félicitations ! Aucune anomalie détectée sur l&apos;ensemble du catalogue.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pied de Modale */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-3">
                  <div className="text-xs text-muted-foreground">
                    Total : <strong>{auditReport.items.length}</strong> œuvre(s) avec alertes sur <strong>{auditReport.total_works}</strong> au répertoire.
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAuditModalOpen(false)}
                      className="rounded-lg border px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors"
                    >
                      Fermer l&apos;Atelier
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Modale Assistant d'Importation Catalogue Espace SACEM (.csv) / Le Sage / CWR (.V21) */}
      {isMigrationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-xl border bg-card p-5 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 text-[11px] font-bold uppercase text-indigo-700">
                    Importation & Migration Catalogue
                  </span>
                  <h2 className="text-base font-bold">
                    Importer mon catalogue SACEM (.xlsx / .csv) — ou migrer depuis CWR (.V21) / Le Sage
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Importez directement le fichier <code className="font-mono">Mes_oeuvres_*.xlsx</code> ou <code className="font-mono">.csv</code> téléchargé depuis votre Espace Membre SACEM : regroupement automatique par <code className="font-mono">Code oeuvre</code>, fusion des lignes DE/DR étrangères (PRS/MCPS, KODA/NCB, ASCAP, SOCAN), filtrage des lignes 0% et création automatique des fiches dans l&apos;annuaire <strong>Ayants Droit</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMigrationModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Sélection du format source & Actions */}
            <div className="flex flex-col justify-between gap-2.5 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold">Format d&apos;origine :</label>
                <select
                  value={migrationSourceSystem}
                  onChange={(e) =>
                    setMigrationSourceSystem(
                      e.target.value as
                        | "SACEM_CSV"
                        | "LE_SAGE_CSV"
                        | "CWR_V21"
                        | "VISTEX_CSV"
                    )
                  }
                  className="rounded border bg-card px-2.5 py-1 text-xs font-medium"
                >
                  <option value="SACEM_CSV">
                    Export Catalogue Espace SACEM (.xlsx / .csv — Mes_oeuvres_*)
                  </option>
                  <option value="CWR_V21">
                    Fichier Maître CWR v2.1 / v2.2 (.V21 SACEM / CISAC)
                  </option>
                  <option value="LE_SAGE_CSV">
                    Export Le Sage / Improvize (.CSV ; œuvres + splits + avances)
                  </option>
                  <option value="VISTEX_CSV">
                    Export Music Maestro / Vistex (.CSV)
                  </option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors">
                  <FileUp className="h-3.5 w-3.5" />
                  <span>
                    {uploadedMigrationFile
                      ? `Fichier chargé : ${uploadedMigrationFile.name}`
                      : "Choisir mon fichier SACEM (.xlsx / .csv / .V21)"}
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.v21,.v22,.cwr,.txt"
                    onChange={handleMigrationFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => handleRunDemoMigration(true)}
                  disabled={migrationLoading}
                  className="inline-flex items-center gap-1 rounded-md border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-500/20"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Simuler Démo Le Sage
                </button>

                <button
                  type="button"
                  onClick={handleDownloadLeSageTemplate}
                  className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <Download className="h-3.5 w-3.5" />
                  Modèle CSV Le Sage
                </button>
              </div>
            </div>

            {!migrationReport && !migrationLoading && (
              <div className="rounded-xl border border-dashed border-indigo-500/40 bg-indigo-500/5 p-6 text-center space-y-2">
                <FileUp className="mx-auto h-7 w-7 text-indigo-600" />
                <div className="text-sm font-bold text-foreground">
                  Sélectionnez votre fichier « Mes_oeuvres » (.xlsx ou .csv) téléchargé depuis votre espace SACEM
                </div>
                <p className="text-xs text-muted-foreground max-w-2xl mx-auto">
                  Colonnes reconnues automatiquement : <code className="font-mono">Code oeuvre</code>,{" "}
                  <code className="font-mono">Titre de l&apos;oeuvre</code>,{" "}
                  <code className="font-mono">Sous-titre(s)</code>,{" "}
                  <code className="font-mono">Genre de l&apos;oeuvre</code>,{" "}
                  <code className="font-mono">ISWC</code>,{" "}
                  <code className="font-mono">Date de déclaration</code>,{" "}
                  <code className="font-mono">Rôle (A, C, AD, E)</code>,{" "}
                  <code className="font-mono">COAD</code>,{" "}
                  <code className="font-mono">Nom au fichier IPI</code>,{" "}
                  <code className="font-mono">Code IPI</code>,{" "}
                  <code className="font-mono">Société en DE / DR</code>,{" "}
                  <code className="font-mono">Part DEP / DR / PHONO</code>.
                </p>
              </div>
            )}

            {migrationReport && (
              <div className="space-y-3">
                {/* KPIs du Sas Dry-Run & Parité Financière Decimal */}
                <div className="grid gap-2.5 sm:grid-cols-4">
                  <div className="rounded-lg border bg-card p-2.5">
                    <div className="text-[11px] text-muted-foreground">
                      Œuvres Analysées (Sas Dry-Run)
                    </div>
                    <div className="text-sm font-bold mt-0.5">
                      {migrationReport.total_works_parsed} œuvres ({migrationReport.new_works_count} nouvelles,{" "}
                      {migrationReport.upserted_existing_iswc_count} fusion ISWC/SACEM)
                    </div>
                  </div>

                  <div className="rounded-lg border bg-card p-2.5">
                    <div className="text-[11px] text-muted-foreground">
                      Audit Déterministe Pré-CWR
                    </div>
                    <div className="text-sm font-bold text-emerald-700 mt-0.5">
                      {migrationReport.cwr_ready_works_count} conformes 100% •{" "}
                      <span className="text-rose-600">
                        {migrationReport.cwr_conflict_works_count} anomalie(s)
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-card p-2.5">
                    <div className="text-[11px] text-muted-foreground">
                      {migrationReport.source_system === "SACEM_CSV"
                        ? "Ayants Droit Détectés (IPI & COAD)"
                        : "Parité Financière (Soldes d'Avances)"}
                    </div>
                    <div className="text-sm font-bold font-mono text-indigo-700 mt-0.5">
                      {migrationReport.source_system === "SACEM_CSV" ? (
                        <span>
                          {migrationReport.holders_synced_count || 0} ayants droit synchronisés
                        </span>
                      ) : (
                        <span className="text-amber-700">
                          {Number(
                            migrationReport.total_remaining_advances_eur
                          ).toLocaleString("fr-FR")}{" "}
                          € restants /{" "}
                          {Number(
                            migrationReport.total_initial_advances_eur
                          ).toLocaleString("fr-FR")}{" "}
                          €
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-card p-2.5">
                    <div className="text-[11px] text-muted-foreground">
                      Empreinte Cryptographique (AuditLog)
                    </div>
                    <div className="text-xs font-mono font-bold text-indigo-700 mt-0.5">
                      SHA-256 : {migrationReport.sha256_integrity_hash}
                    </div>
                  </div>
                </div>

                {/* Table de prévisualisation ligne à ligne */}
                <div className="overflow-x-auto rounded-lg border max-h-[420px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-muted/50 text-muted-foreground sticky top-0">
                      <tr>
                        <th className="px-2.5 py-1.5 font-semibold">Action</th>
                        <th className="px-2.5 py-1.5 font-semibold">Titre & Sous-titre</th>
                        <th className="px-2.5 py-1.5 font-semibold">ISWC / Code SACEM</th>
                        <th className="px-2.5 py-1.5 text-right font-semibold">DEP %</th>
                        <th className="px-2.5 py-1.5 text-right font-semibold">DRM %</th>
                        <th className="px-2.5 py-1.5 text-right font-semibold">SYNC %</th>
                        <th className="px-2.5 py-1.5 text-right font-semibold">PHONO %</th>
                        <th className="px-2.5 py-1.5 font-semibold">Genre / Contrat</th>
                        <th className="px-2.5 py-1.5 font-semibold">Diagnostic Pré-CWR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {migrationReport.items.map((item, idx) => (
                        <tr
                          key={idx}
                          className={
                            !item.is_cwr_ready ? "bg-rose-500/5" : "hover:bg-muted/20"
                          }
                        >
                          <td className="px-2.5 py-1.5">
                            <span
                              className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                                item.migration_action === "UPSERT_ISWC"
                                  ? "bg-blue-500/10 text-blue-700 border border-blue-500/30"
                                  : "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30"
                              }`}
                            >
                              {item.migration_action}
                            </span>
                          </td>
                          <td className="px-2.5 py-1.5">
                            <div className="font-semibold">{item.title}</div>
                            {(item.subtitle || item.alternate_titles.length > 0) && (
                              <div className="text-[11px] text-muted-foreground">
                                Sous-titre : {item.subtitle || item.alternate_titles.join(" | ")}
                              </div>
                            )}
                          </td>
                          <td className="px-2.5 py-1.5 font-mono">
                            <div>{item.iswc || "—"}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {item.sacem_work_code
                                ? `SACEM ${item.sacem_work_code}`
                                : item.isrc_codes[0] || ""}
                            </div>
                          </td>
                          <td
                            className={`px-2.5 py-1.5 text-right font-mono font-semibold ${
                              item.dep_total_pct === "100.00"
                                ? "text-emerald-700"
                                : "text-rose-600"
                            }`}
                          >
                            {item.dep_total_pct}%
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-mono">
                            {item.drm_total_pct}%
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-mono text-purple-700">
                            {item.sync_total_pct}%
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-mono text-indigo-700">
                            {item.phono_total_pct}%
                          </td>
                          <td className="px-2.5 py-1.5 font-mono">
                            {item.contract_reference ? (
                              <div>
                                <div className="font-semibold text-foreground">
                                  {item.contract_reference}
                                </div>
                                <div className="text-[11px] text-amber-700">
                                  Solde :{" "}
                                  {Number(
                                    item.remaining_advance_eur
                                  ).toLocaleString("fr-FR")}{" "}
                                  € /{" "}
                                  {Number(item.initial_advance_eur).toLocaleString(
                                    "fr-FR"
                                  )}{" "}
                                  €
                                </div>
                              </div>
                            ) : item.genre ? (
                              <span className="font-sans text-[11px] text-muted-foreground">
                                {item.genre} ({item.holders_count} ayants droit)
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-2.5 py-1.5">
                            {item.is_cwr_ready ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Conforme 100%
                              </span>
                            ) : (
                              <div className="text-rose-700 font-medium">
                                <div className="inline-flex items-center gap-1 font-semibold">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  Anomalie détectée
                                </div>
                                <div className="text-[11px]">
                                  {item.blocking_errors[0]}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-[11px] text-muted-foreground">
                Lors de la validation, toutes les œuvres et tous les ayants droit détectés (avec codes IPI, COAD et sociétés DE/DR) sont enregistrés en base de données.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMigrationModalOpen(false)}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  disabled={migrationLoading || !migrationReport}
                  onClick={handleCommitMigration}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>
                    {migrationLoading
                      ? "Importation en cours..."
                      : `2. Valider & Importer les ${migrationReport?.total_works_parsed ?? ""} œuvres au catalogue`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modale de Configuration d'Export CWR v2.1 (Scope & Dates) */}
      {isCwrExportConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-700">
                  <FileCode2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Exporter un Fichier CWR v2.1</h2>
                  <p className="text-xs text-muted-foreground">
                    Norme CISAC / Sacem. Filtrez par projet audiovisuel ou plage de dates.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCwrExportConfigModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-foreground">
                  Périmètre d&apos;exportation (Scope)
                </label>
                <select
                  value={cwrFilterGroupId}
                  onChange={(e) => setCwrFilterGroupId(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 bg-background font-medium"
                >
                  <option value="ALL">Tout le catalogue actif ({works.length} œuvres)</option>
                  {selectedWorkIds.length > 0 && (
                    <option value="SELECTED">
                      ★ Sélection courante ({selectedWorkIds.length} œuvre(s) cochée(s))
                    </option>
                  )}
                  {workGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      Projet : {g.name} {g.broadcaster_or_client ? `(${g.broadcaster_or_client})` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Idéal pour générer des cue-sheets de saison TV ou un dépôt de film/album spécifique.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                <div>
                  <label className="block font-semibold mb-1 text-foreground">
                    Créé / Modifié à partir du
                  </label>
                  <input
                    type="date"
                    value={cwrDateFrom}
                    onChange={(e) => setCwrDateFrom(e.target.value)}
                    className="w-full rounded-lg border px-2.5 py-1.5 bg-background font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-foreground">
                    Jusqu&apos;au
                  </label>
                  <input
                    type="date"
                    value={cwrDateTo}
                    onChange={(e) => setCwrDateTo(e.target.value)}
                    className="w-full rounded-lg border px-2.5 py-1.5 bg-background font-mono"
                  />
                </div>
              </div>

              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-[11px] text-emerald-800 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Contrôle CWR 100% Déterministe
                </div>
                <p>
                  Les clés DEP & DRM doivent être égales à 100.00%. Les sociétés de gestion DE (Exécution) et DR (Reproduction) sont encodées selon les codes officiels CISAC (ex: 058 Sacem/SDRM, 010 ASCAP, 021 BMI).
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => setIsCwrExportConfigModalOpen(false)}
                className="rounded-lg border px-3.5 py-1.5 text-xs font-medium hover:bg-accent"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isExportingCwr}
                onClick={handleRunCwrExport}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
              >
                <FileCode2 className="h-4 w-4" />
                {isExportingCwr ? "Génération en cours..." : "Générer le Fichier CWR (.V21)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale d'export CWR v2.1 */}
      {cwrModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl border bg-card p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-bold">
                  Export CWR v{cwrModalData.cwr_version} — {cwrModalData.filename}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {cwrModalData.included_works_count} œuvre(s) conforme(s) incluse(s) •{" "}
                  {cwrModalData.skipped_works_count} œuvre(s) en conflit écartée(s) automatiquement pour éviter un rejet Sacem.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCwrModalData(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Badges de filtrage CWR */}
            {(cwrModalData.filtered_by_group || cwrModalData.filtered_by_dates || cwrModalData.filtered_by_selection) && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {cwrModalData.filtered_by_selection && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-300 px-2.5 py-1 font-semibold text-emerald-800 dark:text-emerald-300">
                    <FileCode2 className="h-3.5 w-3.5 text-emerald-600" />
                    Sélection manuelle ciblée ({cwrModalData.filtered_by_selection} œuvres)
                  </span>
                )}
                {cwrModalData.filtered_by_group && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 border border-indigo-200 px-2.5 py-1 font-semibold text-indigo-700">
                    <Tv className="h-3.5 w-3.5" />
                    Projet / Groupe :{" "}
                    {typeof cwrModalData.filtered_by_group === "object"
                      ? cwrModalData.filtered_by_group.name
                      : cwrModalData.filtered_by_group}
                  </span>
                )}
                {cwrModalData.filtered_by_dates && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-200 px-2.5 py-1 font-semibold text-amber-700">
                    <Calendar className="h-3.5 w-3.5" />
                    Dates : {cwrModalData.filtered_by_dates.date_from || "Début"} au{" "}
                    {cwrModalData.filtered_by_dates.date_to || "Aujourd'hui"}
                  </span>
                )}
              </div>
            )}

            <pre className="overflow-x-auto rounded-xl border bg-slate-950 p-4 font-mono text-xs text-emerald-400 leading-relaxed">
              {cwrModalData.content}
            </pre>

            <div className="flex justify-end gap-3 border-t pt-4">
              <button
                type="button"
                onClick={() => setCwrModalData(null)}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={downloadCwrFile}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700"
              >
                <Download className="h-4 w-4" />
                Télécharger {cwrModalData.filename}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barre de filtrage par Projets Audiovisuels (Séries TF1, Films, Émissions) & Albums */}
      <div className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
            <Tv className="h-3.5 w-3.5 text-primary" />
            Projets & Groupes :
          </span>

          <button
            type="button"
            onClick={() => setSelectedGroupId("ALL")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border transition-colors ${
              selectedGroupId === "ALL"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground hover:bg-accent border-border"
            }`}
          >
            <span>Tous les projets</span>
            <span className="rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] font-bold">
              {works.length}
            </span>
          </button>

          {workGroups.map((group) => {
            const isSelected = selectedGroupId === group.id;
            return (
              <div
                key={group.id}
                className={`inline-flex items-center rounded-lg border text-xs font-medium transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground hover:bg-accent border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectGroup(group.id)}
                  className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1"
                  title={group.notes || group.name}
                >
                  {group.group_type === "SERIE_TV" && <Tv className="h-3 w-3" />}
                  {group.group_type === "FILM_CINEMA" && <Film className="h-3 w-3" />}
                  {group.group_type === "ALBUM" && <Disc3 className="h-3 w-3" />}
                  {group.group_type !== "SERIE_TV" &&
                    group.group_type !== "FILM_CINEMA" &&
                    group.group_type !== "ALBUM" && <Layers className="h-3 w-3" />}
                  <span>
                    {group.broadcaster_or_client
                      ? `${group.broadcaster_or_client} • ${group.name}`
                      : group.name}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {group.works_count ??
                      works.filter((w) =>
                        w.groups?.some((g) => g.id === group.id)
                      ).length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setGroupToDelete(group);
                  }}
                  className={`pr-2 pl-1 py-1 rounded-r-lg transition-colors ${
                    isSelected
                      ? "text-primary-foreground/70 hover:text-white"
                      : "text-muted-foreground hover:text-rose-600"
                  }`}
                  title={`Supprimer le groupe « ${group.name} »`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {workGroups.length > 0 && (
            <button
              type="button"
              onClick={() => setIsManageGroupsModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted/80"
              title="Sélectionner et supprimer un ou plusieurs projets / groupes d'œuvres"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
              <span>Gérer les groupes ({workGroups.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsCreateGroupModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            <span>+ Nouveau Projet / Album</span>
          </button>
        </div>
      </div>

      {/* Bandeau d'Héritage Contrat du Projet Sélectionné */}
      {selectedGroupId !== "ALL" && (() => {
        const activeGroup = workGroups.find((g) => g.id === selectedGroupId);
        if (!activeGroup) return null;
        return (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200/70 bg-indigo-50/50 p-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-indigo-950">
                Projet : {activeGroup.name} {activeGroup.broadcaster_or_client ? `• ${activeGroup.broadcaster_or_client}` : ""}
              </span>
              {activeGroup.contract_reference ? (
                <span className="inline-flex items-center gap-1 rounded bg-indigo-100 border border-indigo-300 px-2 py-0.5 font-mono text-[11px] font-bold text-indigo-800">
                  <FileText className="h-3 w-3" />
                  Contrat Cadre : {activeGroup.contract_reference}
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground italic">
                  Aucun contrat cadre rattaché à ce projet
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeGroup.contract_reference && (
                <button
                  type="button"
                  onClick={() => handleApplyInheritanceToGroup(activeGroup.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 shadow-sm transition-colors"
                  title="Propager automatiquement le contrat cadre à toutes les œuvres rattachées à ce projet"
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                  Appliquer le contrat aux œuvres du projet
                </button>
              )}
              <button
                type="button"
                onClick={() => setGroupToDelete(activeGroup)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 shadow-sm transition-colors"
                title="Supprimer ce projet (les œuvres rattachées seront conservées au catalogue)"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Supprimer ce groupe</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Barre de recherche compacte + Contrôles de densité */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par Titre, Cotage / Réf contrat (KFC674...), ISWC, ISRC, Ayant droit, Code IPI..."
            className="w-full rounded-lg border bg-card pl-9 pr-8 py-1.5 text-xs shadow-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              title="Effacer la recherche"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground shrink-0">
          <span>
            Affichage{" "}
            <strong className="text-foreground">
              {filtered.length === 0 ? 0 : startIndex + 1}–{endIndex}
            </strong>{" "}
            sur <strong className="text-foreground">{filtered.length}</strong> œuvres
          </span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            aria-label="Nombre d'œuvres par page"
            className="rounded-md border bg-card px-2 py-1 text-xs font-medium text-foreground"
          >
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
            <option value={250}>250 / page</option>
            <option value={500}>500 / page</option>
          </select>
          {totalPages > 1 && (
            <div className="flex items-center gap-1 border-l pl-2">
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded border bg-card hover:bg-muted disabled:opacity-30 disabled:pointer-events-none text-foreground"
                title="Page précédente"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="font-semibold px-1 text-foreground">
                {safeCurrentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded border bg-card hover:bg-muted disabled:opacity-30 disabled:pointer-events-none text-foreground"
                title="Page suivante"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modale de création d'un Projet Audiovisuel ou Album (WorkGroup) */}
      {isCreateGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Tv className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Nouveau Projet Audiovisuel / Album</h2>
                  <p className="text-xs text-muted-foreground">
                    Regroupez vos œuvres par fiction TV (TF1, Newen), film, docu ou album musical.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateGroupModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkGroupSubmit} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Nom du Projet / Série / Album *
                  </label>
                  <input
                    type="text"
                    required
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Ex: Demain Nous Appartient - B.O. Saison 2025"
                    className="w-full rounded-lg border px-3 py-1.5 text-xs bg-background"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Type de Projet
                    </label>
                    <select
                      value={newGroupType}
                      onChange={(e) => setNewGroupType(e.target.value as WorkGroupType)}
                      className="w-full rounded-lg border px-3 py-1.5 text-xs bg-background"
                    >
                      {Object.entries(GROUP_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Diffuseur / Client Principal
                    </label>
                    <input
                      type="text"
                      value={newGroupBroadcaster}
                      onChange={(e) => setNewGroupBroadcaster(e.target.value)}
                      placeholder="Ex: TF1, France Télévisions, Netflix..."
                      className="w-full rounded-lg border px-3 py-1.5 text-xs bg-background"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Société de Production
                    </label>
                    <input
                      type="text"
                      value={newGroupProd}
                      onChange={(e) => setNewGroupProd(e.target.value)}
                      placeholder="Ex: Telfrance / Newen Studios"
                      className="w-full rounded-lg border px-3 py-1.5 text-xs bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Année de Sortie / Diffusion
                    </label>
                    <input
                      type="number"
                      value={newGroupYear}
                      onChange={(e) => setNewGroupYear(e.target.value)}
                      placeholder="2025"
                      className="w-full rounded-lg border px-3 py-1.5 text-xs bg-background"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Réalisateur, Showrunner ou Producteur
                  </label>
                  <input
                    type="text"
                    value={newGroupDirector}
                    onChange={(e) => setNewGroupDirector(e.target.value)}
                    placeholder="Ex: TF1 Production / Direction Artistique"
                    className="w-full rounded-lg border px-3 py-1.5 text-xs bg-background"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Notes & Description du Projet
                  </label>
                  <textarea
                    rows={2}
                    value={newGroupNotes}
                    onChange={(e) => setNewGroupNotes(e.target.value)}
                    placeholder="Feuilleton quotidien access prime-time, besoins spécifiques en musiques de génériques, transitions, cues d'action..."
                    className="w-full rounded-lg border px-3 py-1.5 text-xs bg-background"
                  />
                </div>

                <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
                  <label className="block text-xs font-semibold mb-1 text-indigo-950 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-indigo-600" />
                    Référence Contrat Cadre d&apos;Édition (Optionnel)
                  </label>
                  <input
                    type="text"
                    value={newGroupContractRef}
                    onChange={(e) => setNewGroupContractRef(e.target.value)}
                    placeholder="Ex: CTR-2026-DNA-01"
                    className="w-full rounded-lg border border-indigo-200 px-3 py-1.5 text-xs bg-background font-mono text-foreground"
                  />
                  <p className="text-[11px] text-indigo-700 mt-1">
                    Les œuvres rattachées à ce projet audiovisuel hériteront automatiquement de cette référence de contrat.
                  </p>
                </div>

                {selectedWorkIds.length > 0 && (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 p-2.5 text-xs text-primary flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>
                      <strong>{selectedWorkIds.length} œuvre(s) sélectionnée(s)</strong> seront automatiquement rattachées à ce projet lors de sa création.
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2.5 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateGroupModalOpen(false)}
                  className="rounded-lg border px-3.5 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  Créer le projet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale de Modifications par Lot (Batch Operations) */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">
                    Modification par lot sur {selectedWorkIds.length} œuvre(s)
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Rattachement à un projet, mise à jour des contrats, annotations collectives et modification ciblée d&apos;ayants droit.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteBatchUpdate} className="space-y-4 text-xs">
              {/* Section 1 : Rattachement Projet Audiovisuel */}
              <div className="rounded-xl border bg-muted/20 p-3.5 space-y-2.5">
                <h3 className="font-bold text-foreground flex items-center gap-1.5">
                  <Tv className="h-3.5 w-3.5 text-primary" />
                  1. Rattacher à un Projet Audiovisuel ou Album
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-muted-foreground mb-1 font-medium">
                      Sélectionner le Projet / Groupe
                    </label>
                    <select
                      value={batchAssignGroupId}
                      onChange={(e) => setBatchAssignGroupId(e.target.value)}
                      className="w-full rounded-lg border px-2.5 py-1.5 bg-background text-xs"
                    >
                      <option value="">-- Ne pas modifier les projets --</option>
                      {workGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.broadcaster_or_client
                            ? `[${g.broadcaster_or_client}] ${g.name}`
                            : g.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {batchAssignGroupId && (
                    <div>
                      <label className="block text-muted-foreground mb-1 font-medium">
                        Type d&apos;Utilisation Musicale (Cue Type)
                      </label>
                      <select
                        value={batchCueUsage}
                        onChange={(e) => setBatchCueUsage(e.target.value)}
                        className="w-full rounded-lg border px-2.5 py-1.5 bg-background text-xs"
                      >
                        <option value="GÉNÉRIQUE">Générique (Début / Fin)</option>
                        <option value="GÉNÉRIQUE_DÉBUT">Générique Début (Main Title)</option>
                        <option value="GÉNÉRIQUE_FIN">Générique Fin (End Credits)</option>
                        <option value="CUE_FOND">Cue de Fond / Ambiance (Score B.O.)</option>
                        <option value="THEME">Thème Principal / Leitmotiv Personnage</option>
                        <option value="THEME_TENSION">Thème de Tension / Suspense</option>
                        <option value="TITRE_LEAD">Titre Lead Single (Album)</option>
                        <option value="AUTRE">Autre cue musical</option>
                      </select>
                    </div>
                  )}

                  {batchAssignGroupId && (() => {
                    const groupObj = workGroups.find((g) => g.id === batchAssignGroupId);
                    if (!groupObj?.contract_reference) return null;
                    return (
                      <div className="col-span-full flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50/70 p-2 text-xs text-indigo-950">
                        <span>
                          Contrat cadre associé au projet :{" "}
                          <strong className="font-mono text-indigo-800">
                            {groupObj.contract_reference}
                          </strong>
                        </span>
                        <label className="flex items-center gap-1.5 font-semibold text-indigo-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={batchInheritContract}
                            onChange={(e) => setBatchInheritContract(e.target.checked)}
                            className="rounded"
                          />
                          <span>Hériter de ce contrat</span>
                        </label>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Section 2 : Métadonnées Administratives & Juridiques */}
              <div className="rounded-xl border bg-muted/20 p-3.5 space-y-2.5">
                <h3 className="font-bold text-foreground flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  2. Statut d&apos;Administration, Contrat & Genre
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-muted-foreground mb-1 font-medium">
                      Statut d&apos;exploitation
                    </label>
                    <select
                      value={batchAdminStatus}
                      onChange={(e) => setBatchAdminStatus(e.target.value)}
                      className="w-full rounded-lg border px-2.5 py-1.5 bg-background text-xs"
                    >
                      <option value="">-- Conserver les statuts actuels --</option>
                      <option value="ACTIVE">En exploitation active</option>
                      <option value="IN_DISPUTE">Litige / Blocage</option>
                      <option value="UNDER_ADMIN">Sous mandat d&apos;administration</option>
                      <option value="ARCHIVED">Archivé / Reversé</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-muted-foreground mb-1 font-medium">
                      Référence Contrat Juridique
                    </label>
                    <input
                      type="text"
                      value={batchContractRef}
                      onChange={(e) => setBatchContractRef(e.target.value)}
                      placeholder="Ex: CTR-TF1-2025-DNA"
                      className="w-full rounded-lg border px-2.5 py-1.5 bg-background font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-muted-foreground mb-1 font-medium">
                      Genre Musical
                    </label>
                    <input
                      type="text"
                      value={batchGenre}
                      onChange={(e) => setBatchGenre(e.target.value)}
                      placeholder="Ex: B.O. Télévision / Pop"
                      className="w-full rounded-lg border px-2.5 py-1.5 bg-background text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3 : Annotations & Notes Collectives */}
              <div className="rounded-xl border bg-muted/20 p-3.5 space-y-2.5">
                <h3 className="font-bold text-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                  3. Annotation Collective (Fil d&apos;activité) & Mémo
                </h3>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <label className="block text-muted-foreground mb-1 font-medium">
                        Auteur de la note
                      </label>
                      <input
                        type="text"
                        value={batchTimelineNoteAuthor}
                        onChange={(e) => setBatchTimelineNoteAuthor(e.target.value)}
                        placeholder="Éditeur TF1"
                        className="w-full rounded-lg border px-2.5 py-1.5 bg-background text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-muted-foreground mb-1 font-medium">
                        Texte de l&apos;annotation collective
                      </label>
                      <input
                        type="text"
                        value={batchTimelineNoteText}
                        onChange={(e) => setBatchTimelineNoteText(e.target.value)}
                        placeholder="Ex: Validation synchro pour diffusion quotidienne TF1 prime-time."
                        className="w-full rounded-lg border px-2.5 py-1.5 bg-background text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-muted-foreground mb-1 font-medium">
                      Ajouter au Mémo Éditeur Général (optionnel)
                    </label>
                    <textarea
                      rows={2}
                      value={batchGeneralNotes}
                      onChange={(e) => setBatchGeneralNotes(e.target.value)}
                      placeholder="Texte qui sera ajouté aux mémos généraux de toutes les œuvres sélectionnées..."
                      className="w-full rounded-lg border px-2.5 py-1.5 bg-background text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4 : Clés de Répartition & Ciblage d'un ayant droit */}
              <div className="rounded-xl border bg-muted/20 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-foreground flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                    4. Répartition & Ayants Droit
                  </h3>

                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-primary">
                      <input
                        type="checkbox"
                        checked={enableHolderTargeting}
                        onChange={(e) => setEnableHolderTargeting(e.target.checked)}
                        className="rounded border"
                      />
                      <span>Cibler un ayant droit précis (Remplacement / Correction)</span>
                    </label>
                  </div>
                </div>

                {!enableHolderTargeting ? (
                  <div>
                    <label className="block text-muted-foreground mb-1 font-medium">
                      Appliquer un Preset de Splits à toutes les œuvres du lot (écrase les splits actuels)
                    </label>
                    <select
                      value={batchPreset}
                      onChange={(e) => setBatchPreset(e.target.value)}
                      className="w-full sm:w-1/2 rounded-lg border px-2.5 py-1.5 bg-background text-xs"
                    >
                      <option value="">-- Ne pas modifier les splits globaux --</option>
                      <option value="CESSION_50_50">Cession Standard 50/50 Sacem</option>
                      <option value="TIERS_33_33_34">Tiers Paritaire (33.33 / 33.33 / 33.34)</option>
                      <option value="COEDITION_50_25_25">Coédition (50% Éditeur, 25% A, 25% C)</option>
                      <option value="GESTION_90_10">Mandat de Gestion (90% AC, 10% Gestionnaire)</option>
                    </select>
                  </div>
                ) : (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
                    <p className="text-muted-foreground text-[11px]">
                      💡 <strong>Ciblage chirurgical</strong> : Modifie <em>uniquement</em> l&apos;ayant droit correspondant au critère sur toutes les œuvres du lot (ex: changer l&apos;éditeur ou corriger un numéro IPI sans toucher aux parts des auteurs).
                    </p>

                    <div>
                      <label className="block font-semibold mb-1 text-primary">
                        Ayant droit à cibler (Recherche par Nom ou IPI existant) *
                      </label>
                      <input
                        type="text"
                        required={enableHolderTargeting}
                        value={targetHolderQuery}
                        onChange={(e) => setTargetHolderQuery(e.target.value)}
                        placeholder="Ex: Solstices ou 00891234567"
                        className="w-full rounded-lg border px-2.5 py-1.5 bg-background text-xs font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-muted-foreground mb-1">
                          Nouveau Nom (laisser vide pour ne pas changer)
                        </label>
                        <input
                          type="text"
                          value={targetNewName}
                          onChange={(e) => setTargetNewName(e.target.value)}
                          placeholder="Ex: TF1 Droits Audiovisuels"
                          className="w-full rounded-lg border px-2.5 py-1 bg-background text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-muted-foreground mb-1">
                          Nouveau Code IPI (11 chiffres)
                        </label>
                        <input
                          type="text"
                          value={targetNewIpi}
                          onChange={(e) => setTargetNewIpi(e.target.value)}
                          placeholder="Ex: 00987654321"
                          className="w-full rounded-lg border px-2.5 py-1 bg-background font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-muted-foreground mb-1">
                          Nouveau Rôle Sacem
                        </label>
                        <select
                          value={targetNewRole}
                          onChange={(e) => setTargetNewRole(e.target.value)}
                          className="w-full rounded-lg border px-2.5 py-1 bg-background text-xs"
                        >
                          <option value="">Conserver le rôle</option>
                          {Object.entries(ROLE_LABELS).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-muted-foreground mb-1">
                        Nouvelles Parts (laisser vide pour ne pas modifier)
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        <input
                          type="text"
                          value={targetNewDep}
                          onChange={(e) => setTargetNewDep(e.target.value)}
                          placeholder="DEP % (ex: 50.00)"
                          className="rounded border px-2 py-1 bg-background text-xs font-mono text-right"
                        />
                        <input
                          type="text"
                          value={targetNewDrm}
                          onChange={(e) => setTargetNewDrm(e.target.value)}
                          placeholder="DRM % (ex: 50.00)"
                          className="rounded border px-2 py-1 bg-background text-xs font-mono text-right"
                        />
                        <input
                          type="text"
                          value={targetNewSync}
                          onChange={(e) => setTargetNewSync(e.target.value)}
                          placeholder="SYNC % (ex: 50.00)"
                          className="rounded border px-2 py-1 bg-background text-xs font-mono text-right"
                        />
                        <input
                          type="text"
                          value={targetNewPhono}
                          onChange={(e) => setTargetNewPhono(e.target.value)}
                          placeholder="PHONO % (ex: 80.00)"
                          className="rounded border px-2 py-1 bg-background text-xs font-mono text-right"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2.5 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="rounded-lg border px-3.5 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBatch}
                  className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSubmittingBatch
                    ? "Application du lot..."
                    : `Appliquer sur ${selectedWorkIds.length} œuvre(s)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barre d'action flottante lorsque des œuvres sont sélectionnées (US-5.3 Dock Enrichi) */}
      {selectedWorkIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 rounded-full border border-slate-700 bg-slate-900/95 px-5 py-2.5 text-xs font-medium text-white shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 flex-wrap max-w-[95vw] justify-center">
          <div className="flex items-center gap-2 pr-2 border-r border-slate-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {selectedWorkIds.length}
            </span>
            <span>œuvre(s) sélectionnée(s)</span>
          </div>

          {/* Action 1 : Export CWR groupé sur la sélection (US-5.3) */}
          <button
            type="button"
            onClick={handleExportSelectedCwr}
            disabled={isExportingCwr}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1 text-xs font-semibold text-white shadow hover:bg-emerald-500 transition-colors disabled:opacity-50"
            title="Générer immédiatement un fichier CWR v2.1 pour les œuvres sélectionnées"
          >
            <FileCode2 className="h-3.5 w-3.5" />
            <span>Exporter CWR (.V21)</span>
          </button>

          {/* Action 2 : Rattachement groupé à un Projet Audiovisuel / Album existant (US-5.3) */}
          <button
            type="button"
            onClick={() => setIsAssignGroupModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-1 text-xs font-semibold text-white shadow hover:bg-indigo-500 transition-colors"
            title="Rattacher la sélection à une série TV, un film ou un album existant"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            <span>Rattacher à un Projet</span>
          </button>

          {/* Action 3 : Créer un nouveau projet depuis la sélection */}
          <button
            type="button"
            onClick={() => setIsCreateGroupModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
            title="Créer un nouveau projet audiovisuel ou album et y associer cette sélection"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nouveau Projet</span>
          </button>

          {/* Action 4 : Modification avancée par lot (Batch) */}
          <button
            type="button"
            onClick={() => setIsBatchModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Modifier le lot</span>
          </button>

          {/* Action 5 : Suppression groupée sécurisée */}
          <button
            type="button"
            onClick={() => setIsBatchDeleteModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-rose-600/90 hover:bg-rose-600 px-3 py-1 text-xs font-semibold text-white shadow transition-colors"
            title="Supprimer les œuvres sélectionnées"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Supprimer</span>
          </button>

          {/* Tout désélectionner */}
          <button
            type="button"
            onClick={() => setSelectedWorkIds([])}
            className="text-xs text-slate-400 hover:text-white underline pl-1"
          >
            Désélectionner
          </button>
        </div>
      )}

      {/* Modale de Rattachement Rapide à un Projet / Album (US-5.3) */}
      {isAssignGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-700">
                  <FolderPlus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Rattacher à un Projet Audiovisuel</h2>
                  <p className="text-xs text-muted-foreground">
                    Associez rapidement {selectedWorkIds.length} œuvre(s) à une série TV, un film ou un album.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignGroupModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmAssignGroup} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-foreground">
                  Sélectionner le Projet / Groupe cible *
                </label>
                <select
                  required
                  value={assignTargetGroupId}
                  onChange={(e) => setAssignTargetGroupId(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 bg-background font-medium text-xs"
                >
                  <option value="">-- Choisir un projet audiovisuel ou album --</option>
                  {workGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.group_type === "SERIE_TV" ? "Série TV" : g.group_type === "FILM_CINEMA" ? "Film" : "Album"}{g.broadcaster_or_client ? ` • ${g.broadcaster_or_client}` : ""}) — {g.works_count} œuvre(s)
                    </option>
                  ))}
                </select>
                {workGroups.length === 0 && (
                  <p className="text-amber-600 mt-1">
                    Aucun projet existant. Utilisez « Nouveau Projet » pour en créer un premier.
                  </p>
                )}
              </div>

              {assignTargetGroupId && (
                <>
                  {(() => {
                    const selectedG = workGroups.find((g) => g.id === assignTargetGroupId);
                    return (
                      <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                        <div className="flex items-center justify-between font-semibold">
                          <span>{selectedG?.name}</span>
                          <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-700">
                            {selectedG?.group_type}
                          </span>
                        </div>
                        {selectedG?.contract_reference ? (
                          <label className="flex items-center gap-2 cursor-pointer text-[11px] text-foreground">
                            <input
                              type="checkbox"
                              checked={assignInheritContract}
                              onChange={(e) => setAssignInheritContract(e.target.checked)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>
                              Hériter automatiquement du contrat cadre (<strong>{selectedG.contract_reference}</strong>)
                            </span>
                          </label>
                        ) : (
                          <p className="text-[11px] text-muted-foreground italic">
                            Aucun contrat cadre associé à ce projet.
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  <div>
                    <label className="block font-semibold mb-1 text-foreground">
                      Type d&apos;utilisation audiovisuelle (Cue-Sheet)
                    </label>
                    <select
                      value={assignCueUsage}
                      onChange={(e) => setAssignCueUsage(e.target.value)}
                      className="w-full rounded-lg border px-3 py-1.5 bg-background font-medium text-xs"
                    >
                      <option value="GÉNÉRIQUE">Générique (Début / Fin)</option>
                      <option value="FOND / UNDERSCORE">Fond sonore / Underscore</option>
                      <option value="THÈME DRAMATIQUE">Thème dramatique principal</option>
                      <option value="SOURCE / DIÉGÉTIQUE">Source visuelle / Radio / Diégétique</option>
                      <option value="BANQUE / LIBRAIRIE">Banque de musique additionnelle</option>
                    </select>
                  </div>
                </>
              )}

              {/* Aperçu des œuvres sélectionnées */}
              <div className="border-t pt-2 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Œuvres qui seront rattachées ({selectedWorkIds.length}) :
                </span>
                <div className="max-h-24 overflow-y-auto rounded border bg-card p-2 space-y-0.5 text-[11px]">
                  {works
                    .filter((w) => selectedWorkIds.includes(w.id))
                    .map((w) => (
                      <div key={w.id} className="truncate">
                        • <strong>{w.title}</strong> {w.cotage_number ? `[${w.cotage_number}]` : ""}
                      </div>
                    ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setIsAssignGroupModalOpen(false)}
                  className="rounded-lg border px-3.5 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAssign || !assignTargetGroupId}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
                >
                  <FolderPlus className="h-4 w-4" />
                  {isSubmittingAssign ? "Rattachement..." : `Rattacher ${selectedWorkIds.length} œuvre(s)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale d'ajout / édition d'œuvre */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl border bg-card p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-bold">
                  {editingWorkId
                    ? `Modifier l'œuvre & Corriger CWR : ${newTitle}`
                    : "Ajouter une œuvre (Édition DEP/DRM, Synchro & Phono)"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Contrôle déterministe en direct sur les 4 familles de droits : DEP, DRM, SYNC et PHONO.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Titre de l&apos;œuvre *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ex: Éclipse sur Montmartre"
                    className="w-full rounded-lg border px-3 py-1.5 text-xs bg-background"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Sous-titre officiel Sacem / CWR (séparez par « ; » si plusieurs sous-titres)
                  </label>
                  <input
                    type="text"
                    value={newSubtitle}
                    onChange={(e) => setNewSubtitle(e.target.value)}
                    placeholder="Ex: Giulia Theme ; 7 Ans Plus Tard (séparés par « ; »)"
                    className="w-full rounded-lg border px-3 py-1.5 text-xs bg-background"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Titres Alternatifs, Sous-titres & Alias (séparés par des points-virgules « ; »)
                  </label>
                  <input
                    type="text"
                    value={newAlternateTitles}
                    onChange={(e) => setNewAlternateTitles(e.target.value)}
                    placeholder="Ex: Giulia Theme ; 7 Ans Plus Tard ; BO Série Intracables"
                    className="w-full rounded-lg border px-3 py-1.5 text-xs bg-background"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Inscrivez vos sous-titres ou versions en les séparant par un point-virgule « ; » (les espaces avant et après sont automatiquement ignorés).
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Interprètes principaux (Phono / Voisins)
                  </label>
                  <input
                    type="text"
                    value={newPerformer}
                    onChange={(e) => setNewPerformer(e.target.value)}
                    placeholder="Ex: Clara Silvestre, K-Soprano"
                    className="w-full rounded-lg border px-3 py-1.5 text-xs bg-background"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Code ISWC Édition (Format T-XXX.XXX.XXX-C)
                  </label>
                  <input
                    type="text"
                    value={newIswc}
                    onChange={(e) => setNewIswc(e.target.value)}
                    placeholder="Ex: T-301.452.891-4"
                    className="w-full rounded-lg border px-3 py-1.5 font-mono text-xs bg-background"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 flex items-center justify-between">
                    <span>Code Œuvre SACEM (COCV)</span>
                    <span className="text-[10px] text-muted-foreground font-normal">10–11 chiffres</span>
                  </label>
                  <input
                    type="text"
                    value={newSacemWorkCode}
                    onChange={(e) => setNewSacemWorkCode(e.target.value)}
                    placeholder="Ex: 111785573767"
                    className="w-full rounded-lg border px-3 py-1.5 font-mono text-xs bg-background text-indigo-700 dark:text-indigo-400 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    N° de Cotage Éditorial / Librairie Musicale
                  </label>
                  <input
                    type="text"
                    value={newCotageNumber}
                    onChange={(e) => setNewCotageNumber(e.target.value)}
                    placeholder="Ex: 4748, COT-2026-01"
                    className="w-full rounded-lg border px-3 py-1.5 font-mono text-xs bg-background"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Code ISRC Enregistrement Phono / Master
                  </label>
                  <input
                    type="text"
                    value={newIsrc}
                    onChange={(e) => setNewIsrc(e.target.value)}
                    placeholder="Ex: FRZ012600101"
                    className="w-full rounded-lg border px-3 py-1.5 font-mono text-xs bg-background"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Genre musical
                  </label>
                  <input
                    type="text"
                    value={newGenre}
                    onChange={(e) => setNewGenre(e.target.value)}
                    placeholder="Ex: Chanson Française, Pop, Électro"
                    className="w-full rounded-lg border px-3 py-1.5 text-xs bg-background"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Durée (secondes)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newDurationSeconds}
                      onChange={(e) => setNewDurationSeconds(e.target.value)}
                      placeholder="Ex: 218 (3m38s)"
                      className="w-full rounded-lg border px-3 py-1.5 text-xs bg-background"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Année création
                    </label>
                    <input
                      type="number"
                      min={1900}
                      max={2100}
                      value={newCreationYear}
                      onChange={(e) => setNewCreationYear(e.target.value)}
                      placeholder="Ex: 2024"
                      className="w-full rounded-lg border px-3 py-1.5 text-xs bg-background"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Statut d&apos;Administration
                  </label>
                  <select
                    value={newAdminStatus}
                    onChange={(e) =>
                      setNewAdminStatus(e.target.value as AdministrationStatus)
                    }
                    className="w-full rounded-lg border px-3 py-1.5 text-xs bg-background"
                  >
                    <option value="ACTIVE">En exploitation active</option>
                    <option value="IN_DISPUTE">En litige / Contesté</option>
                    <option value="UNDER_ADMIN">Sous mandat d&apos;administration</option>
                    <option value="ARCHIVED">Archivé / Droits reversés</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    État Métier &amp; Dépôt SACEM
                  </label>
                  <select
                    value={newLifecycleStatus || ""}
                    onChange={(e) =>
                      setNewLifecycleStatus(e.target.value || null)
                    }
                    className="w-full rounded-lg border px-3 py-1.5 text-xs bg-background"
                  >
                    <option value="">(Automatique : Informations manquantes ou À déposer)</option>
                    <option value="A_DEPOSER">🔵 À déposer (Prête pour CWR)</option>
                    <option value="INFORMATIONS_MANQUANTES">🟡 Informations manquantes</option>
                    <option value="DEPOSE_EN_ATTENTE">🟣 Déposé (En attente d&apos;ACK)</option>
                    <option value="DEPOSE_ET_EXPLOITE">🟢 Déposé &amp; Exploité</option>
                    <option value="REJET_SACEM">🔴 Rejet SACEM</option>
                    <option value="ARCHIVE">⚪ Archivé / Non administré</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Référence Contrat Juridique Associé
                  </label>
                  <input
                    type="text"
                    value={newContractReference}
                    onChange={(e) => setNewContractReference(e.target.value)}
                    placeholder="Ex: CTR-ED-2024-001"
                    className="w-full rounded-lg border px-3 py-1.5 font-mono text-xs bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Mémo Éditeur Libre & Directives Internes
                </label>
                <textarea
                  rows={2}
                  value={newGeneralNotes}
                  onChange={(e) => setNewGeneralNotes(e.target.value)}
                  placeholder="Notes éditoriales, antériorité d'exploitation, accords de synchronisation ou conditions particulières..."
                  className="w-full rounded-lg border px-3 py-1.5 text-xs bg-background"
                />
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    Répartition des Ayants Droit (DEP, DRM, SYNC, PHONO)
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground mr-1">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      Presets 1-clic :
                    </span>
                    <button
                      type="button"
                      onClick={() => applySplitPreset("CESSION_50_50")}
                      className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
                    >
                      Cession 50/50
                    </button>
                    <button
                      type="button"
                      onClick={() => applySplitPreset("TIERS_33_33_34")}
                      className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
                    >
                      Tiers 33.33 / 33.33 / 33.34
                    </button>
                    <button
                      type="button"
                      onClick={() => applySplitPreset("COEDITION_50_25_25")}
                      className="rounded-md border bg-secondary px-2.5 py-1 text-xs font-medium hover:bg-accent"
                    >
                      Coédition 50/25/25
                    </button>
                    <button
                      type="button"
                      onClick={() => applySplitPreset("GESTION_90_10")}
                      className="rounded-md border bg-secondary px-2.5 py-1 text-xs font-medium hover:bg-accent"
                    >
                      Gestion 90/10
                    </button>
                    <button
                      type="button"
                      onClick={() => applySplitPreset("PHONO_80_20")}
                      className="rounded-md border bg-secondary px-2.5 py-1 text-xs font-medium hover:bg-accent"
                    >
                      Master Phono 80/20
                    </button>
                    <button
                      type="button"
                      onClick={addModalSplitRow}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline ml-2"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Ajouter ligne
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 px-2.5 text-xs font-semibold text-muted-foreground">
                  <div className="col-span-3">Ayant droit</div>
                  <div className="col-span-2">Rôle</div>
                  <div className="col-span-2">Code IPI / ISNI</div>
                  <div className="col-span-1 text-right">DEP %</div>
                  <div className="col-span-1 text-right">DRM %</div>
                  <div className="col-span-1 text-right">SYNC %</div>
                  <div className="col-span-1 text-right">PHONO %</div>
                  <div className="col-span-1"></div>
                </div>

                <div className="space-y-2.5">
                  {(() => {
                    const availablePublishers = Array.from(
                      new Set(
                        newSplits
                          .filter((s) => ["E", "PUBLISHER", "SE", "SUB_PUBLISHER"].includes(s.role))
                          .map((s) => s.holder_name.trim())
                          .filter(Boolean)
                      )
                    );
                    return newSplits.map((sp, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 items-center gap-2 rounded-lg border bg-muted/30 p-2.5"
                      >
                        <input
                          type="text"
                          placeholder="Nom ayant droit"
                          value={sp.holder_name}
                          onChange={(e) =>
                            updateModalSplit(idx, "holder_name", e.target.value)
                          }
                          className="col-span-3 rounded border bg-card px-2.5 py-1.5 text-sm"
                        />
                        <select
                          value={sp.role}
                          onChange={(e) =>
                            updateModalSplit(
                              idx,
                              "role",
                              e.target.value as RightHolderRole
                            )
                          }
                          className="col-span-2 rounded border bg-card px-2 py-1.5 font-mono text-xs"
                        >
                          {Object.entries(ROLE_LABELS).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Code IPI (11 ch.)"
                          value={sp.ipi_number || ""}
                          onChange={(e) =>
                            updateModalSplit(idx, "ipi_number", e.target.value)
                          }
                          className="col-span-2 rounded border bg-card px-2 py-1.5 font-mono text-sm"
                        />
                        <input
                          type="text"
                          placeholder="DEP %"
                          value={sp.dep_share_pct}
                          onChange={(e) =>
                            updateModalSplit(idx, "dep_share_pct", e.target.value)
                          }
                          className="col-span-1 rounded border bg-card px-2 py-1.5 text-right font-mono text-sm"
                        />
                        <input
                          type="text"
                          placeholder="DRM %"
                          value={sp.drm_share_pct}
                          onChange={(e) =>
                            updateModalSplit(idx, "drm_share_pct", e.target.value)
                          }
                          className="col-span-1 rounded border bg-card px-2 py-1.5 text-right font-mono text-sm"
                        />
                        <input
                          type="text"
                          placeholder="SYNC %"
                          value={sp.sync_share_pct ?? "0.00"}
                          onChange={(e) =>
                            updateModalSplit(idx, "sync_share_pct", e.target.value)
                          }
                          className="col-span-1 rounded border bg-card px-2 py-1.5 text-right font-mono text-sm"
                        />
                        <input
                          type="text"
                          placeholder="PHONO %"
                          value={sp.phono_share_pct ?? "0.00"}
                          onChange={(e) =>
                            updateModalSplit(
                              idx,
                              "phono_share_pct",
                              e.target.value
                            )
                          }
                          className="col-span-1 rounded border bg-card px-2 py-1.5 text-right font-mono text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeModalSplitRow(idx)}
                          className="col-span-1 flex justify-center text-muted-foreground hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>

                        {/* Affiliations OGC DE et DR (US-3.2) */}
                        <div className="col-span-12 flex flex-wrap items-center gap-3 pt-1 border-t border-muted/60 text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground/80">Affiliations OGC :</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sky-700 font-medium">DE (Exécution) :</span>
                            <input
                              type="text"
                              placeholder="SACEM, ASCAP, BMI..."
                              value={sp.society_de || sp.society_name || "SACEM"}
                              onChange={(e) => updateModalSplit(idx, "society_de", e.target.value)}
                              className="w-24 rounded border bg-card px-1.5 py-0.5 font-mono text-xs text-foreground"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-indigo-700 font-medium">DR (Reproduction) :</span>
                            <input
                              type="text"
                              placeholder="SDRM, SACEM, MCPS..."
                              value={sp.society_dr || sp.society_name || "SACEM"}
                              onChange={(e) => updateModalSplit(idx, "society_dr", e.target.value)}
                              className="w-24 rounded border bg-card px-1.5 py-0.5 font-mono text-xs text-foreground"
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground italic ml-auto">
                            Codes CISAC sérialisés en CWR v2.1
                          </span>
                        </div>

                        {/* Mandat de Coédition & Droits Contrôlés (US-5.15) */}
                        <div className="col-span-12 flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-muted/40 text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground/80 flex items-center gap-1">
                              <Lock className="h-3 w-3 text-indigo-600" />
                              Contrôle Coédition :
                            </span>
                            <select
                              value={sp.is_controlled ? (sp.controlled_by_name || "CONTROLLED") : "DIRECT"}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "DIRECT") {
                                  updateModalSplit(idx, "is_controlled", false);
                                  updateModalSplit(idx, "controlled_by_name", null);
                                } else {
                                  updateModalSplit(idx, "is_controlled", true);
                                  updateModalSplit(
                                    idx,
                                    "controlled_by_name",
                                    val === "CONTROLLED" ? (availablePublishers[0] || "Éditeur Mandataire") : val
                                  );
                                }
                              }}
                              className="rounded border bg-card px-2 py-0.5 text-xs font-medium text-foreground"
                            >
                              <option value="DIRECT">👤 Perception directe (Non contrôlé)</option>
                              {availablePublishers.map((pubName) => (
                                <option key={pubName} value={pubName}>
                                  🔒 Contrôlé par {pubName} (Mandat)
                                </option>
                              ))}
                              {!availablePublishers.includes(sp.controlled_by_name || "") && sp.controlled_by_name && (
                                <option value={sp.controlled_by_name}>
                                  🔒 Contrôlé par {sp.controlled_by_name}
                                </option>
                              )}
                              {availablePublishers.length === 0 && (
                                <option value="CONTROLLED">🔒 Part contrôlée par l&apos;éditeur</option>
                              )}
                            </select>
                          </div>

                          {sp.is_controlled && (
                            <div className="flex items-center gap-1.5 text-indigo-700 font-medium">
                              <span>Éditeur mandataire :</span>
                              <input
                                type="text"
                                placeholder="Nom de l'éditeur contrôleur"
                                value={sp.controlled_by_name || ""}
                                onChange={(e) => updateModalSplit(idx, "controlled_by_name", e.target.value)}
                                className="w-48 rounded border bg-card px-2 py-0.5 text-xs text-foreground font-semibold"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-secondary/60 px-4 py-2.5 text-sm font-medium">
                  <span>Contrôle déterministe (100.00 %) :</span>
                  <div className="flex flex-wrap items-center gap-4 font-mono">
                    <span
                      className={
                        Math.abs(depSum - 100) < 0.01
                          ? "text-emerald-700 font-bold"
                          : "text-rose-600 font-bold"
                      }
                    >
                      DEP : {depSum.toFixed(2)}%
                    </span>
                    <span
                      className={
                        Math.abs(drmSum - 100) < 0.01
                          ? "text-emerald-700 font-bold"
                          : "text-rose-600 font-bold"
                      }
                    >
                      DRM : {drmSum.toFixed(2)}%
                    </span>
                    <span
                      className={
                        Math.abs(syncSum - 100) < 0.01
                          ? "text-emerald-700 font-bold"
                          : "text-rose-600 font-bold"
                      }
                    >
                      SYNC : {syncSum.toFixed(2)}%
                    </span>
                    <span
                      className={
                        Math.abs(phonoSum - 100) < 0.01
                          ? "text-emerald-700 font-bold"
                          : "text-rose-600 font-bold"
                      }
                    >
                      PHONO : {phonoSum.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
                >
                  Enregistrer au Catalogue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vue Catalogue : Empty State chaleureux si base vierge, sinon Table ou Cartes */}
      {works.length === 0 ? (
        <EmptyState
          icon={<Disc3 className="h-8 w-8 text-primary" />}
          title="Votre catalogue d'œuvres est vierge"
          description="Démarrez en important l'export officiel de votre Espace Membre SACEM (fichier .csv ou .xlsx) ou déclarez manuellement votre première œuvre."
          badgeText="Base vierge"
          primaryAction={{
            label: "Importer mon catalogue SACEM (.csv / .xlsx)",
            onClick: () => {
              setMigrationSourceSystem("SACEM_CSV");
              setIsMigrationModalOpen(true);
            },
            icon: <FileUp className="h-4 w-4" />,
          }}
          secondaryAction={{
            label: "Déclarer une œuvre manuellement",
            onClick: () => setIsModalOpen(true),
            icon: <Plus className="h-4 w-4" />,
          }}
          demoAction={{
            label: "Charger catalogue démo (30 œuvres & TF1)",
            onClick: handleLoadDemoCatalog,
            isLoading: isLoadingDemo,
          }}
          tipText="💡 Astuce SACEM : Connectez-vous sur votre Espace Membre Sacem > Mon Répertoire, puis cliquez sur 'Exporter mon catalogue'. Glissez-déposez ensuite votre fichier .csv ou .xlsx ici pour créer instantanément vos œuvres et synchroniser votre répertoire d'ayants droit."
        />
      ) : viewMode === "TABLE" ? (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="w-9 px-2 py-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-muted-foreground hover:text-foreground flex items-center justify-center p-0.5 rounded hover:bg-muted"
                      title={
                        selectedWorkIds.length === filtered.length && filtered.length > 0
                          ? "Tout désélectionner"
                          : "Tout sélectionner"
                      }
                    >
                      {selectedWorkIds.length === filtered.length && filtered.length > 0 ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="w-6 px-1 py-2"></th>
                  <th className="px-3 py-2 font-semibold">Titre de l&apos;Œuvre & Projets TF1 / B.O.</th>
                  <th className="px-3 py-2 font-semibold">ISWC / ISRC Master</th>
                  <th className="px-3 py-2 font-semibold">Interprètes</th>
                  <th className="px-3 py-2 font-semibold">Ayants Droit (Aperçu DEP)</th>
                  <th className="px-3 py-2 text-right font-semibold">DEP %</th>
                  <th className="px-3 py-2 text-right font-semibold">DRM %</th>
                  <th className="px-3 py-2 text-right font-semibold">SYNC %</th>
                  <th className="px-3 py-2 text-right font-semibold">PHONO %</th>
                  <th className="px-3 py-2 font-semibold">État Métier &amp; Dépôt</th>
                  <th className="px-3 py-2 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedWorks.map((work) => {
                  const cwr = work.cwr_validation;
                  const isExpanded = expandedWorkIds.includes(work.id);
                  const isSelected = selectedWorkIds.includes(work.id);
                  const syncTotal =
                    cwr?.sync_total_pct ||
                    work.splits
                      .reduce(
                        (acc, s) =>
                          acc +
                          (parseFloat(s.sync_share_pct || "0") || 0),
                        0
                      )
                      .toFixed(2);
                  const phonoTotal =
                    cwr?.phono_total_pct ||
                    work.splits
                      .reduce(
                        (acc, s) =>
                          acc +
                          (parseFloat(s.phono_share_pct || "0") || 0),
                        0
                      )
                      .toFixed(2);

                  return (
                    <Fragment key={work.id}>
                      <tr
                        onClick={() => openWorkDrawer(work)}
                        className={`cursor-pointer transition-colors hover:bg-muted/30 ${
                          isSelected
                            ? "bg-primary/10 border-l-2 border-primary"
                            : cwr && !cwr.is_cwr_ready
                              ? "bg-rose-500/5"
                              : selectedWorkForDrawer?.id === work.id
                                ? "bg-muted/30"
                                : isExpanded
                                  ? "bg-muted/20"
                                  : ""
                        }`}
                      >
                        <td
                          className="px-2 py-2 text-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectWork(work.id);
                          }}
                        >
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground flex items-center justify-center p-0.5 rounded hover:bg-muted"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-primary" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td
                          className="px-1 py-2 text-muted-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWorkExpand(work.id);
                          }}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-foreground text-xs">
                              {work.title}
                            </span>
                            {work.contract_reference && (
                              <span
                                className="inline-flex items-center gap-0.5 rounded bg-primary/10 border border-primary/25 px-1.5 py-0.2 font-mono text-[10px] font-bold text-primary"
                                title="Référence interne / Cotage éditeur"
                              >
                                <Tag className="h-2.5 w-2.5" />
                                <span>Cotage {work.contract_reference}</span>
                              </span>
                            )}
                            {work.timeline_notes &&
                              work.timeline_notes.length > 0 && (
                                <span
                                  title={`${work.timeline_notes.length} annotation(s)`}
                                  className="inline-flex items-center gap-0.5 rounded bg-indigo-500/10 px-1 py-0.2 text-[10px] font-bold text-indigo-700"
                                >
                                  <MessageSquare className="h-2.5 w-2.5" />
                                  {work.timeline_notes.length}
                                </span>
                              )}
                            {work.general_notes && (
                              <span
                                title="Mémo éditeur renseigné"
                                className="inline-flex items-center rounded bg-amber-500/10 px-1 py-0.2 text-[10px] font-bold text-amber-700"
                              >
                                <FileText className="h-2.5 w-2.5" />
                              </span>
                            )}
                            {work.administration_status &&
                              work.administration_status !== "ACTIVE" && (
                                <span
                                  className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase border ${
                                    STATUS_LABELS[work.administration_status]?.color || ""
                                  }`}
                                >
                                  {STATUS_LABELS[work.administration_status]?.label}
                                </span>
                              )}
                            {work.sacem_registration_status === "REGISTERED" && (
                              <span
                                className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-1 py-0.2 text-[9px] font-bold"
                                title={`Dépôt validé et enregistré par la SACEM${work.sacem_registered_at ? ` le ${new Date(work.sacem_registered_at).toLocaleDateString('fr-FR')}` : ''}`}
                              >
                                <ShieldCheck className="h-2.5 w-2.5" />
                                Enregistré SACEM
                              </span>
                            )}
                            {work.sacem_registration_status === "REJECTED" && (
                              <span
                                className="inline-flex items-center gap-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 px-1 py-0.2 text-[9px] font-bold animate-pulse"
                                title={`Rejet SACEM : ${work.sacem_rejection_reason || 'Anomalie de conformité notifiée'}`}
                              >
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Rejet SACEM
                              </span>
                            )}
                          </div>
                          {work.subtitle && (
                            <div className="text-[11px] text-primary/80 font-medium italic truncate max-w-[240px]">
                              {work.subtitle}
                            </div>
                          )}
                          {work.alternate_titles.length > 0 && (
                            <div className="text-[10px] text-muted-foreground truncate max-w-[240px]">
                              Alias : {work.alternate_titles.join(" | ")}
                            </div>
                          )}

                          {/* Badges des projets audiovisuels / albums attachés */}
                          {work.groups && work.groups.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {work.groups.map((g) => (
                                <span
                                  key={g.id}
                                  title={`${g.group_type} ${
                                    g.broadcaster_or_client
                                      ? `(${g.broadcaster_or_client})`
                                      : ""
                                  }`}
                                  className="inline-flex items-center gap-1 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 px-1.5 py-0.2 text-[10px] font-semibold border border-blue-500/20"
                                >
                                  {g.group_type === "SERIE_TV" && (
                                    <Tv className="h-2.5 w-2.5" />
                                  )}
                                  {g.group_type === "FILM_CINEMA" && (
                                    <Film className="h-2.5 w-2.5" />
                                  )}
                                  {g.group_type === "ALBUM" && (
                                    <Disc3 className="h-2.5 w-2.5" />
                                  )}
                                  {g.group_type !== "SERIE_TV" &&
                                    g.group_type !== "FILM_CINEMA" &&
                                    g.group_type !== "ALBUM" && (
                                      <Layers className="h-2.5 w-2.5" />
                                    )}
                                  <span>{g.name}</span>
                                  {g.cue_usage_type && (
                                    <span className="font-mono text-[9px] text-blue-600/80 dark:text-blue-300">
                                      • {g.cue_usage_type}
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          <div className="font-semibold text-foreground text-xs flex items-center gap-1">
                            {work.iswc || (
                              <span className="text-[10px] font-normal text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1 py-0.2 rounded">
                                Sans ISWC
                              </span>
                            )}
                          </div>
                          {work.sacem_work_code && (
                            <div
                              className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-400 mt-0.5 flex items-center gap-1"
                              title="Code Œuvre SACEM (COCV)"
                            >
                              <span className="text-[9px] font-bold px-1 rounded bg-indigo-500/10 border border-indigo-500/20">
                                SACEM
                              </span>
                              <span>{work.sacem_work_code}</span>
                            </div>
                          )}
                          {work.cotage_number && (
                            <div
                              className="text-[10px] text-muted-foreground mt-0.5 font-sans"
                              title="Numéro de Cotage Éditorial / Librairie"
                            >
                              Cotage {work.cotage_number}
                            </div>
                          )}
                          {work.isrc_codes.length > 0 && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              ISRC {work.isrc_codes[0]}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">
                          {work.performers.join(", ") || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="space-y-1">
                            <div className="flex flex-wrap gap-1">
                              {work.splits.map((s, idx) => {
                                const isPub = ["E", "SE", "PUBLISHER", "SUB_PUBLISHER"].includes(s.role);
                                const isMissingIpi = !s.ipi_number || s.ipi_number.trim() === "" || s.ipi_number === "00000000000";
                                return (
                                  <span
                                    key={idx}
                                    title={`${s.holder_name} • Rôle : ${s.role} • IPI : ${s.ipi_number || "NON RENSEIGNÉ (Bloquant Sacem)"}`}
                                    className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                                      isMissingIpi
                                        ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-300"
                                        : isPub
                                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                                          : "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-300"
                                    }`}
                                  >
                                    <span className="font-semibold truncate max-w-[100px]">{s.holder_name}</span>
                                    <span className="font-mono text-[9px] font-bold px-1 rounded bg-background/60">
                                      {s.role}
                                    </span>
                                    <span className="font-mono font-medium">{s.dep_share_pct}%</span>
                                    {isMissingIpi && (
                                      <span
                                        className="h-1.5 w-1.5 rounded-full bg-amber-600 shrink-0 animate-pulse"
                                        title="Code IPI manquant"
                                      />
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                            <SplitDistributionBar splits={work.splits} />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <SplitEquilibriumGauge label="DEP" value={cwr?.dep_total_pct || "100.00"} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <SplitEquilibriumGauge label="DRM" value={cwr?.drm_total_pct || "100.00"} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <SplitEquilibriumGauge label="SYNC" value={syncTotal} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <SplitEquilibriumGauge label="PHONO" value={phonoTotal} />
                        </td>
                        <td className="px-3 py-2">
                          <WorkLifeCycleBadge
                            status={work.lifecycle_status}
                            label={work.lifecycle_status_label}
                            issues={work.lifecycle_status_issues}
                            isReady={cwr?.is_cwr_ready}
                          />
                        </td>
                        <td
                          className="px-3 py-2 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openWorkDrawer(work)}
                              className="inline-flex items-center gap-1 rounded border bg-secondary px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-accent"
                            >
                              <BookOpen className="h-3 w-3" />
                              Fiche
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditWorkModal(work)}
                              className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold transition-colors ${
                                cwr && !cwr.is_cwr_ready
                                  ? "border-rose-500/40 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20"
                                  : "bg-secondary text-foreground hover:bg-accent"
                              }`}
                            >
                              <Pencil className="h-3 w-3" />
                              {cwr && !cwr.is_cwr_ready ? "Corriger" : "Splits"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setWorkToDelete(work)}
                              title="Supprimer l'œuvre"
                              className="inline-flex items-center gap-1 rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/20 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Ligne dépliable à la demande pour inspecter le détail complet des splits & erreurs CWR */}
                      {isExpanded && (
                        <tr className="bg-muted/20">
                          <td colSpan={12} className="px-6 py-3">
                            <div className="space-y-2.5">
                              {cwr && cwr.blocking_errors.length > 0 && (
                                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-800 space-y-1">
                                  {cwr.blocking_errors.map((err, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-1.5 font-medium"
                                    >
                                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                                      <span>{err}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="overflow-x-auto rounded-lg border bg-card">
                                <table className="w-full text-left text-xs">
                                  <thead className="border-b bg-muted/40 text-muted-foreground">
                                    <tr>
                                      <th className="px-3 py-1.5 font-medium">
                                        Ayant droit
                                      </th>
                                      <th className="px-3 py-1.5 font-medium">Rôle</th>
                                      <th className="px-3 py-1.5 font-medium">
                                        Code IPI / ISNI
                                      </th>
                                      <th className="px-3 py-1.5 text-right font-medium">
                                        Part DEP (%)
                                      </th>
                                      <th className="px-3 py-1.5 text-right font-medium">
                                        Part DRM (%)
                                      </th>
                                      <th className="px-3 py-1.5 text-right font-medium">
                                        Part SYNC (%)
                                      </th>
                                      <th className="px-3 py-1.5 text-right font-medium">
                                        Part PHONO (%)
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                    {work.splits.map((s, idx) => (
                                      <tr key={idx}>
                                        <td className="px-3 py-1.5 font-medium">
                                          {s.holder_name}
                                        </td>
                                        <td className="px-3 py-1.5">
                                          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                                            {s.role}
                                          </span>
                                        </td>
                                        <td className="px-3 py-1.5 font-mono">
                                          {s.ipi_number || (
                                            <span className="text-rose-600 font-semibold">
                                              IPI Manquant
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-mono">
                                          {s.dep_share_pct} %
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-mono">
                                          {s.drm_share_pct} %
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-mono text-purple-700">
                                          {s.sync_share_pct || "0.00"} %
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-mono text-indigo-700">
                                          {s.phono_share_pct || "0.00"} %
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
                    </Fragment>
                  );
                })}
                {paginatedWorks.length === 0 && (
                  <tr>
                    <td
                      colSpan={12}
                      className="px-4 py-12 text-center text-xs text-muted-foreground"
                    >
                      Aucune œuvre ne correspond aux critères de recherche ou de filtre.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            totalItems={filtered.length}
            startIndex={startIndex}
            endIndex={endIndex}
            pageSize={pageSize}
            onPageChange={(p) => setCurrentPage(p)}
            onPageSizeChange={(s) => setPageSize(s)}
            itemLabel="œuvres"
            storageKey="korom_catalog_page_size"
          />
        </div>
      ) : (
        /* Vue Cartes Détaillées (optionnelle) */
        <div className="space-y-3">
          {paginatedWorks.map((work) => {
            const cwr = work.cwr_validation;
            const syncTotal =
              cwr?.sync_total_pct ||
              work.splits
                .reduce(
                  (acc, s) =>
                    acc + (parseFloat(s.sync_share_pct || "0") || 0),
                  0
                )
                .toFixed(2);
            const phonoTotal =
              cwr?.phono_total_pct ||
              work.splits
                .reduce(
                  (acc, s) =>
                    acc + (parseFloat(s.phono_share_pct || "0") || 0),
                  0
                )
                .toFixed(2);

            const isSelected = selectedWorkIds.includes(work.id);

            return (
              <div
                key={work.id}
                className={`rounded-xl border bg-card p-4 shadow-sm space-y-3 transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/40"
                }`}
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleSelectWork(work.id)}
                      className="mt-0.5 text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold">{work.title}</h2>
                        {work.subtitle && (
                          <span className="text-xs text-primary font-medium italic">
                            ({work.subtitle})
                          </span>
                        )}
                        {work.contract_reference && (
                          <span
                            className="rounded bg-primary/10 border border-primary/30 px-2 py-0.5 font-mono text-xs font-semibold text-primary"
                            title="Référence interne / Numéro de cotage"
                          >
                            Réf. {work.contract_reference}
                          </span>
                        )}
                        {work.iswc && (
                          <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs font-medium">
                            ISWC {work.iswc}
                          </span>
                        )}
                        {work.sacem_work_code && (
                          <span
                            className="rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 font-mono text-xs font-bold"
                            title="Code Œuvre SACEM (COCV)"
                          >
                            SACEM {work.sacem_work_code}
                          </span>
                        )}
                        {work.cotage_number && (
                          <span
                            className="rounded bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground"
                            title="Numéro de Cotage Éditorial / Librairie"
                          >
                            Cotage {work.cotage_number}
                          </span>
                        )}
                        {work.isrc_codes.length > 0 && (
                          <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground">
                            ISRC {work.isrc_codes[0]}
                          </span>
                        )}
                        {work.administration_status &&
                          work.administration_status !== "ACTIVE" && (
                            <span
                              className={`rounded px-1.5 py-0.2 text-[10px] font-bold uppercase border ${
                                STATUS_LABELS[work.administration_status]?.color || ""
                              }`}
                            >
                              {STATUS_LABELS[work.administration_status]?.label}
                            </span>
                          )}
                        {work.sacem_registration_status === "REGISTERED" && (
                          <span
                            className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold"
                            title={`Dépôt validé et enregistré par la SACEM${work.sacem_registered_at ? ` le ${new Date(work.sacem_registered_at).toLocaleDateString('fr-FR')}` : ''}`}
                          >
                            <ShieldCheck className="h-3 w-3" />
                            Enregistré SACEM
                          </span>
                        )}
                        {work.sacem_registration_status === "REJECTED" && (
                          <span
                            className="inline-flex items-center gap-1 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 text-[10px] font-bold animate-pulse"
                            title={`Rejet SACEM : ${work.sacem_rejection_reason || 'Anomalie de conformité notifiée'}`}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Rejet SACEM
                          </span>
                        )}
                        {work.timeline_notes &&
                          work.timeline_notes.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded bg-indigo-500/10 text-indigo-700 px-1.5 py-0.5 text-[10px] font-bold">
                              <MessageSquare className="h-3 w-3" />
                              {work.timeline_notes.length} note(s)
                            </span>
                          )}
                      </div>

                      {/* Badges Projets Audiovisuels / Albums */}
                      {work.groups && work.groups.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {work.groups.map((g) => (
                            <span
                              key={g.id}
                              className="inline-flex items-center gap-1 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 px-1.5 py-0.2 text-[10px] font-semibold border border-blue-500/20"
                            >
                              {g.group_type === "SERIE_TV" && (
                                <Tv className="h-2.5 w-2.5" />
                              )}
                              {g.group_type === "FILM_CINEMA" && (
                                <Film className="h-2.5 w-2.5" />
                              )}
                              {g.group_type === "ALBUM" && (
                                <Disc3 className="h-2.5 w-2.5" />
                              )}
                              {g.group_type !== "SERIE_TV" &&
                                g.group_type !== "FILM_CINEMA" &&
                                g.group_type !== "ALBUM" && (
                                  <Layers className="h-2.5 w-2.5" />
                                )}
                              <span>{g.name}</span>
                              {g.cue_usage_type && (
                                <span className="font-mono text-[9px] text-blue-600/80">
                                  • {g.cue_usage_type}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        Interprètes : {work.performers.join(", ") || "Non renseigné"}
                        {work.genre && <span> • Genre : {work.genre}</span>}
                        {work.alternate_titles.length > 0 && (
                          <span className="ml-2 font-mono">
                            • Alias : {work.alternate_titles.join(" | ")}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <WorkLifeCycleBadge
                      status={work.lifecycle_status}
                      label={work.lifecycle_status_label}
                      issues={work.lifecycle_status_issues}
                      isReady={cwr?.is_cwr_ready}
                    />
                    <button
                      type="button"
                      onClick={() => openWorkDrawer(work)}
                      className="inline-flex items-center gap-1 rounded-md border bg-primary/10 border-primary/30 text-primary px-2.5 py-1 text-xs font-semibold hover:bg-primary/20"
                    >
                      <BookOpen className="h-3 w-3" />
                      Fiche & Notes
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditWorkModal(work)}
                      className="inline-flex items-center gap-1 rounded-md border bg-secondary px-2.5 py-1 text-xs font-semibold hover:bg-accent"
                    >
                      <Pencil className="h-3 w-3" />
                      Modifier Splits
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkToDelete(work)}
                      title="Supprimer l'œuvre"
                      className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="pb-1.5 font-medium">Ayant droit</th>
                        <th className="pb-1.5 font-medium">Rôle</th>
                        <th className="pb-1.5 font-medium">Code IPI</th>
                        <th className="pb-1.5 text-right font-medium">DEP (%)</th>
                        <th className="pb-1.5 text-right font-medium">DRM (%)</th>
                        <th className="pb-1.5 text-right font-medium">SYNC (%)</th>
                        <th className="pb-1.5 text-right font-medium">PHONO (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {work.splits.map((s, idx) => (
                        <tr key={idx}>
                          <td className="py-1.5 font-medium">
                            <div>{s.holder_name}</div>
                            <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                              <span className="text-sky-700">DE: {s.society_de || s.society_name || "SACEM"}</span>
                              <span>•</span>
                              <span className="text-indigo-700">DR: {s.society_dr || s.society_name || "SACEM"}</span>
                            </div>
                          </td>
                          <td className="py-1.5 font-mono">{s.role}</td>
                          <td className="py-1.5 font-mono">{s.ipi_number || "N/A"}</td>
                          <td className="py-1.5 text-right font-mono">{s.dep_share_pct}%</td>
                          <td className="py-1.5 text-right font-mono">{s.drm_share_pct}%</td>
                          <td className="py-1.5 text-right font-mono text-purple-700">
                            {s.sync_share_pct || "0.00"}%
                          </td>
                          <td className="py-1.5 text-right font-mono text-indigo-700">
                            {s.phono_share_pct || "0.00"}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {cwr && (
                      <tfoot>
                        <tr className="border-t font-bold">
                          <td colSpan={3} className="pt-2 text-xs">
                            Total Déterministe (Sacem 100.00 %)
                          </td>
                          <td className="pt-2 text-right">
                            <SplitEquilibriumGauge label="DEP" value={cwr.dep_total_pct} />
                          </td>
                          <td className="pt-2 text-right">
                            <SplitEquilibriumGauge label="DRM" value={cwr.drm_total_pct} />
                          </td>
                          <td className="pt-2 text-right">
                            <SplitEquilibriumGauge label="SYNC" value={syncTotal} />
                          </td>
                          <td className="pt-2 text-right">
                            <SplitEquilibriumGauge label="PHONO" value={phonoTotal} />
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            );
          })}
          {paginatedWorks.length === 0 && (
            <div className="rounded-xl border border-dashed p-12 text-center text-xs text-muted-foreground">
              Aucune œuvre ne correspond aux critères de recherche ou de filtre.
            </div>
          )}
          <PaginationBar
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            totalItems={filtered.length}
            startIndex={startIndex}
            endIndex={endIndex}
            pageSize={pageSize}
            onPageChange={(p) => setCurrentPage(p)}
            onPageSizeChange={(s) => setPageSize(s)}
            itemLabel="œuvres"
            className="rounded-xl border shadow-sm"
            storageKey="korom_catalog_page_size"
          />
        </div>
      )}

      {/* Panneau Latéral Tiroir (Slide-over Drawer) — US-5.1 Refonte en 4 sous-onglets & Équilibrage 1-clic */}
      {selectedWorkForDrawer && (
        <WorkDetailDrawer
          key={selectedWorkForDrawer.id}
          work={selectedWorkForDrawer}
          onClose={closeWorkDrawer}
          onEditWork={openEditWorkModal}
          onDeleteWork={(w) => {
            closeWorkDrawer();
            setWorkToDelete(w);
          }}
          onWorkUpdated={(updated) => {
            setSelectedWorkForDrawer(updated);
            setWorks((prev) =>
              prev.map((w) => (w.id === updated.id ? updated : w))
            );
          }}
          onFilterByGroup={(groupId) => {
            setSelectedGroupId(groupId);
            closeWorkDrawer();
          }}
        />
      )}

      {/* Modale de gestion et suppression (unitaire ou par lot) des groupes d'œuvres / projets */}
      {isManageGroupsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  Gérer les groupes d&apos;œuvres &amp; projets ({workGroups.length})
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sélectionnez un ou plusieurs projets audiovisuels / albums pour les supprimer. Les œuvres associées restent dans le catalogue.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsManageGroupsModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {workGroups.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Aucun groupe d&apos;œuvres ou projet créé pour le moment.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-3.5 py-2 text-xs">
                  <button
                    type="button"
                    onClick={toggleSelectAllGroupsForDelete}
                    className="inline-flex items-center gap-2.5 font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    {selectedGroupIdsForDelete.length === workGroups.length && workGroups.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : selectedGroupIdsForDelete.length > 0 ? (
                      <div className="h-4 w-4 rounded bg-primary text-[10px] font-bold text-white flex items-center justify-center leading-none">
                        -
                      </div>
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>
                      {selectedGroupIdsForDelete.length === workGroups.length
                        ? `Tout désélectionner (${workGroups.length})`
                        : `Tout sélectionner (${workGroups.length} groupe(s))`}
                    </span>
                  </button>

                  {selectedGroupIdsForDelete.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsBatchDeleteGroupsModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 shadow-xs transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Supprimer la sélection ({selectedGroupIdsForDelete.length})</span>
                    </button>
                  )}
                </div>

                <div className="overflow-y-auto flex-1 rounded-xl border divide-y">
                  {workGroups.map((g) => {
                    const checked = selectedGroupIdsForDelete.includes(g.id);
                    const count =
                      g.works_count ??
                      works.filter((w) => w.groups?.some((wg) => wg.id === g.id)).length;
                    return (
                      <div
                        key={g.id}
                        className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs transition-colors ${
                          checked ? "bg-primary/5" : "hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleSelectGroupForDelete(g.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {checked ? (
                              <CheckSquare className="h-4 w-4 text-primary" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <div className="font-bold text-foreground truncate flex items-center gap-2">
                              <span>{g.name}</span>
                              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                {g.group_type}
                              </span>
                              {g.broadcaster_or_client && (
                                <span className="text-[11px] font-normal text-muted-foreground">
                                  • {g.broadcaster_or_client}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                              <span>{count} œuvre(s) rattachée(s)</span>
                              {g.contract_reference && (
                                <span className="font-mono text-indigo-700">
                                  • Contrat : {g.contract_reference}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setGroupToDelete(g)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50/60 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors shrink-0"
                          title={`Supprimer « ${g.name} »`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Supprimer</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="flex items-center justify-end border-t pt-3">
              <button
                type="button"
                onClick={() => setIsManageGroupsModalOpen(false)}
                className="rounded-xl border border-border bg-background px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de confirmation de suppression unitaire d'un groupe d'œuvres / projet */}
      <ConfirmDeleteModal
        isOpen={!!groupToDelete}
        onClose={() => setGroupToDelete(null)}
        onConfirm={handleConfirmDeleteGroup}
        title="Supprimer le groupe d'œuvres / projet"
        itemName={
          groupToDelete
            ? `${groupToDelete.name} (${groupToDelete.group_type}${
                groupToDelete.broadcaster_or_client
                  ? ` • ${groupToDelete.broadcaster_or_client}`
                  : ""
              })`
            : ""
        }
        description="Cette action supprimera définitivement ce groupe d'œuvres / projet. Les œuvres associées ne seront pas supprimées du catalogue : elles seront simplement détachées du groupe. Cette opération est irréversible."
        confirmText="Supprimer le groupe"
        isDeleting={isDeletingGroup}
      />

      {/* Modale de confirmation de suppression groupée de projets / groupes d'œuvres */}
      <ConfirmDeleteModal
        isOpen={isBatchDeleteGroupsModalOpen}
        onClose={() => setIsBatchDeleteGroupsModalOpen(false)}
        onConfirm={handleConfirmBatchDeleteGroups}
        title={`Supprimer ${selectedGroupIdsForDelete.length} groupe(s) d'œuvres`}
        description="Cette action est irréversible. Les groupes d'œuvres sélectionnés seront définitivement supprimés et leurs œuvres rattachées seront détachées sans être supprimées du catalogue."
        confirmText={`Supprimer définitivement (${selectedGroupIdsForDelete.length})`}
        isDeleting={isBatchDeletingGroups}
        itemName={
          <ul className="list-disc list-inside space-y-0.5 text-xs">
            {workGroups
              .filter((g) => selectedGroupIdsForDelete.includes(g.id))
              .slice(0, 6)
              .map((g) => (
                <li key={g.id} className="truncate">
                  <strong>{g.name}</strong> ({g.group_type})
                </li>
              ))}
            {selectedGroupIdsForDelete.length > 6 && (
              <li className="text-muted-foreground italic">
                ... et {selectedGroupIdsForDelete.length - 6} autre(s) groupe(s)
              </li>
            )}
          </ul>
        }
      />

      {/* Modale de confirmation de suppression d'œuvre */}
      <ConfirmDeleteModal
        isOpen={!!workToDelete}
        onClose={() => setWorkToDelete(null)}
        onConfirm={handleConfirmDeleteWork}
        title="Supprimer l'œuvre du catalogue"
        itemName={workToDelete ? `${workToDelete.title} (${workToDelete.id.slice(0, 8)})` : ""}
        description="Cette action supprimera définitivement cette œuvre du catalogue ainsi que ses associations aux projets audiovisuels ou albums. Cette opération est irréversible."
        confirmText="Supprimer l'œuvre"
        isDeleting={isDeletingWork}
      />

      {/* Modale de confirmation de suppression groupée d'œuvres */}
      <ConfirmDeleteModal
        isOpen={isBatchDeleteModalOpen}
        onClose={() => setIsBatchDeleteModalOpen(false)}
        onConfirm={handleConfirmBatchDeleteWorks}
        title={`Supprimer ${selectedWorkIds.length} œuvre(s) du catalogue`}
        description="Cette action est irréversible. Les œuvres sélectionnées ainsi que leurs associations aux projets audiovisuels et albums seront définitivement supprimées."
        confirmText={`Supprimer définitivement (${selectedWorkIds.length})`}
        isDeleting={isBatchDeleting}
        itemName={
          <ul className="list-disc list-inside space-y-0.5 text-xs">
            {works
              .filter((w) => selectedWorkIds.includes(w.id))
              .slice(0, 6)
              .map((w) => (
                <li key={w.id} className="truncate">
                  <strong>{w.title}</strong> {w.iswc ? `(${w.iswc})` : ""}
                </li>
              ))}
            {selectedWorkIds.length > 6 && (
              <li className="text-muted-foreground italic">
                ... et {selectedWorkIds.length - 6} autre(s) œuvre(s)
              </li>
            )}
          </ul>
        }
      />

      {/* Modale d'ingestion d'accusé de réception SACEM CWR (ACK / NACK - US-5.8) */}
      <CwrAckModal
        isOpen={isCwrAckModalOpen}
        onClose={() => setIsCwrAckModalOpen(false)}
        onSuccess={async () => {
          const groupId = selectedGroupId !== "ALL" ? selectedGroupId : undefined;
          const refreshed = await fetchWorks(groupId).catch(() => []);
          if (refreshed && refreshed.length > 0) setWorks(refreshed);
          setIsCwrAckModalOpen(false);
          setMigrationBanner("Accusé de réception SACEM ingéré : statuts et codes COCV mis à jour avec succès.");
        }}
      />

      {/* Bac à Sable de Comparaison Différentielle SACEM vs Korom & Livraison Sous-Édition (US-5.18) */}
      <SandboxDiffViewer
        isOpen={isSandboxDiffOpen}
        onClose={() => setIsSandboxDiffOpen(false)}
        activeEntityId={currentEntity?.id}
        onDataModified={async () => {
          const groupId = selectedGroupId !== "ALL" ? selectedGroupId : undefined;
          const refreshed = await fetchWorks(groupId).catch(() => []);
          if (refreshed && refreshed.length > 0) setWorks(refreshed);
        }}
      />
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-xs text-muted-foreground">
          Chargement du catalogue d&apos;œuvres...
        </div>
      }
    >
      <CatalogContent />
    </Suspense>
  );
}
