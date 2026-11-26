"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  CheckSquare,
  Download,
  Edit3,
  ExternalLink,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FileUp,
  FolderKanban,
  Layers,
  Link2,
  Music,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Square,
  Tag,
  Trash2,
  UploadCloud,
  Users,
  Wand2,
  X,
  XCircle,
} from "lucide-react";
import {
  ConfidenceBadge,
  ValidationStatusBadge,
} from "@/components/confidence-badge";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { EmptyState } from "@/components/empty-state";
import { addRecentItem } from "@/lib/recent-history";
import {
  batchDeleteContracts,
  createWorkGroupFromContract,
  deleteContract,
  exportCatalogCwr,
  exportCatalogXlsx,
  extractDemoContract,
  fetchContracts,
  fetchWorkGroups,
  fetchWorks,
  importCGP1Contracts,
  linkContractToWorks,
  loadSandboxDemo,
  uploadContractPdf,
  validateContract,
} from "@/lib/api";
import {
  CGP1ImportReport,
  ContractPartyExtraction,
  ContractRead,
  ExpectedCessionContract,
  RightHolderRole,
  WorkGroupRead,
  WorkRead,
} from "@/types/api";

function SplitEquilibriumGauge({
  label,
  value,
  expected = 100,
}: {
  label: string;
  value: number;
  expected?: number;
}) {
  const diff = Number((value - expected).toFixed(2));
  const isBalanced = Math.abs(diff) < 0.01;

  if (label === "SYNC" && value === 0) {
    return (
      <div
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30"
        title="Part Synchro non définie au contrat d'édition — En attente Lettre-Accord Artiste-Interprète (LAI) ou saisie manuelle"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
        <span>En attente LAI</span>
      </div>
    );
  }

  if (isBalanced) {
    return (
      <div
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
        title={`${label} à 100.00 % — Équilibre parfait Sacem`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
        <span>{value.toFixed(2)}%</span>
      </div>
    );
  }

  const isOver = diff > 0;
  return (
    <div
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-mono font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/40"
      title={`${label} déséquilibré (${value.toFixed(2)}%) : écart de ${isOver ? `+${diff}` : `${diff}`}% (rejet Sacem CWR)`}
    >
      <AlertTriangle className="h-3 w-3 text-rose-600 shrink-0" />
      <span>{value.toFixed(2)}%</span>
      <span className="text-[9px] font-semibold opacity-85">
        ({isOver ? `+${diff}` : `${diff}`}%)
      </span>
    </div>
  );
}

const DEMO_CONTRACTS: ContractRead[] = [
  {
    id: "22222222-2222-2222-2222-222222222202",
    contract_reference: "CTR-2026-OO04",
    contract_type: "CESSION_EDITION",
    publisher_name: "Éditions Solstices Music",
    counterparty_name: "Sami Benali",
    signature_date: "2026-09-10",
    start_date: "2026-09-10",
    end_date: null,
    territory: "WORLD",
    duration_years: 15,
    advance_amount: "3000.00",
    recouped_amount: "0.00",
    remaining_advance_balance: "3000.00",
    currency: "EUR",
    parties: [
      {
        party_name: "Sami Benali",
        role: "AC",
        ipi_number: "00398765432",
        dep_share_pct: "40.00",
        drm_share_pct: "50.00",
        sync_share_pct: "50.00",
        phono_share_pct: "0.00",
        source_clause_quote:
          "Article 4 : Sami Benali (AC, IPI 00398765432) : DEP 40.00% | DRM 50.00%",
      },
      {
        party_name: "Éditions Solstices Music",
        role: "E",
        ipi_number: "00891234567",
        dep_share_pct: "50.00",
        drm_share_pct: "50.00",
        sync_share_pct: "50.00",
        phono_share_pct: "100.00",
        source_clause_quote:
          "Article 4 : Éditions Solstices Music (E, IPI 00891234567) : DEP 50.00% | DRM 50.00%",
      },
    ],
    advance: {
      has_advance: true,
      advance_amount: "3000.00",
      beneficiary_name: "Sami Benali",
      recoupable_streams: ["STREAMING", "PUBLIC_PERFORMANCE"],
      source_clause_quote: "Article 6 : Avance récupérable de 3 000 EUR HT.",
    },
    work_titles: ["Orage d'Octobre"],
    source_filename: "contrat_pacte_orage_octobre_anomalie.pdf",
    extracted_clauses_summary:
      "• Œuvre & Référence : Titre « Orage d'Octobre » rattaché au contrat CTR-2026-OO04.\n• Cession Éditoriale (DEP / DRM) : Article 4 — Sami Benali (40% DEP / 50% DRM) et Éditions Solstices Music (50% DEP / 50% DRM).\n• Synchronisation (SYNC) : 50% Éditeur / 50% Auteur-Compositeur.\n• Droits Voisins & Master (PHONO) : 100% Éditeur / Producteur.\n• Avance Récupérable : Article 6 — Avance de 3 000,00 EUR HT amortissable sur streaming et exécution publique.",
    cwr_split_warnings: [
      "Conflit de splits DEP : total = 90.00 % (écart de -10.00 % par rapport à 100.00 %).",
    ],
    confidence_score: 0.74,
    validation_status: "PENDING_REVIEW",
    validated_by: null,
    validated_at: null,
    review_notes: null,
    created_at: "2026-10-22T12:00:00Z",
    updated_at: "2026-10-22T12:00:00Z",
  },
  {
    id: "22222222-2222-2222-2222-222222222201",
    contract_reference: "CTR-2026-LN01",
    contract_type: "CO_EDITION",
    publisher_name: "Éditions Solstices Music",
    counterparty_name: "Camille Moreau",
    signature_date: "2026-01-15",
    start_date: "2026-01-15",
    end_date: null,
    territory: "WORLD",
    duration_years: 10,
    advance_amount: "15000.00",
    recouped_amount: "3200.00",
    remaining_advance_balance: "11800.00",
    currency: "EUR",
    parties: [
      {
        party_name: "Camille Moreau",
        role: "AC",
        ipi_number: "00458912301",
        dep_share_pct: "50.00",
        drm_share_pct: "50.00",
        sync_share_pct: "50.00",
        phono_share_pct: "0.00",
        source_clause_quote:
          "Article 4 : Camille Moreau (AC, IPI 00458912301) : DEP 50.00% / DRM 50.00%",
      },
      {
        party_name: "Éditions Solstices Music",
        role: "E",
        ipi_number: "00891234567",
        dep_share_pct: "50.00",
        drm_share_pct: "50.00",
        sync_share_pct: "50.00",
        phono_share_pct: "100.00",
        source_clause_quote:
          "Article 4 : Éditions Solstices Music (E, IPI 00891234567) : DEP 50.00% / DRM 50.00%",
      },
    ],
    advance: {
      has_advance: true,
      advance_amount: "15000.00",
      beneficiary_name: "Camille Moreau",
      recoupable_streams: ["STREAMING", "SYNCHRONIZATION", "PUBLIC_PERFORMANCE"],
      source_clause_quote:
        "Article 6 : Avance récupérable de 15 000 EUR HT amortissable sur tous revenus.",
    },
    work_titles: ["Lumière Noire"],
    source_filename: "contrat_coedition_lumiere_noire.pdf",
    extracted_clauses_summary:
      "• Œuvre & Référence : Titre « Lumière Noire » rattaché au contrat CTR-2026-LN01.\n• Cession Éditoriale (DEP / DRM) : Article 4 — Camille Moreau (50% DEP / 50% DRM) et Éditions Solstices Music (50% DEP / 50% DRM).\n• Synchronisation (SYNC) & Droits Voisins : 50% Éditeur / 50% Autrice-Compositrice.\n• Droits Voisins & Master (PHONO) : 100% Éditeur / Producteur.\n• Avance Récupérable : Article 6 — Avance amortissable de 15 000,00 EUR HT sur l'ensemble des revenus nets.",
    cwr_split_warnings: [],
    confidence_score: 0.96,
    validation_status: "VALIDATED",
    validated_by: "directeur.juridique@solstices-music.fr",
    validated_at: "2026-10-22T14:00:00Z",
    review_notes: null,
    created_at: "2026-10-22T12:00:00Z",
    updated_at: "2026-10-22T14:00:00Z",
  },
];

const AVAILABLE_ROLES: { value: RightHolderRole; label: string }[] = [
  { value: "A", label: "A — Auteur" },
  { value: "C", label: "C — Compositeur" },
  { value: "AC", label: "AC — Auteur-Compositeur" },
  { value: "AR", label: "AR — Arrangeur" },
  { value: "E", label: "E — Éditeur" },
  { value: "SE", label: "SE — Sous-Éditeur" },
  { value: "P", label: "P — Producteur Phono (Master)" },
  { value: "I", label: "I — Interprète (Droits voisins)" },
];

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractRead[]>([]);
  const [editingContractIds, setEditingContractIds] = useState<Set<string>>(new Set());
  const [selectedSubgroup, setSelectedSubgroup] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [contractFilter, setContractFilter] = useState<
    "ALL" | "PENDING" | "VALIDATED" | "REJECTED"
  >("ALL");
  const [contractSearch, setContractSearch] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetCessionContext, setTargetCessionContext] = useState<{
    contractId: string;
    subgroupName: string;
  } | null>(null);

  function triggerContractUpload(context?: { contractId: string; subgroupName: string }) {
    setTargetCessionContext(context || null);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      const el = document.getElementById("pdf-contract-upload-input") as HTMLInputElement | null;
      if (el) el.click();
    }
  }

  // Création de groupe d'œuvres depuis le contrat
  const [groupModalContract, setGroupModalContract] = useState<ContractRead | null>(null);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [groupTypeInput, setGroupTypeInput] = useState<"AUDIOVISUAL" | "ALBUM">("AUDIOVISUAL");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  async function handleCreateGroupFromContract() {
    if (!groupModalContract || !groupNameInput.trim()) return;
    setIsCreatingGroup(true);
    try {
      const result = await createWorkGroupFromContract(groupModalContract.id, {
        name: groupNameInput.trim(),
        group_type: groupTypeInput,
      });
      setContracts((prev) =>
        prev.map((c) =>
          c.id === groupModalContract.id
            ? { ...c, audiovisual_program: result.work_group_name }
            : c
        )
      );
      setFeedback(
        `Groupe d'œuvres « ${result.work_group_name} » créé avec succès (${result.linked_works_count} œuvre(s) rattachée(s)).`
      );
      setGroupModalContract(null);
    } catch (err) {
      console.error("Erreur création groupe d'œuvres:", err);
      setFeedback("Erreur lors de la création du groupe d'œuvres.");
    } finally {
      setIsCreatingGroup(false);
    }
  }

  // Suppression de contrat avec confirmation
  const [contractToDelete, setContractToDelete] = useState<ContractRead | null>(null);
  const [isDeletingContract, setIsDeletingContract] = useState(false);

  function applyPresetSacem5050(contractId: string) {
    setContracts((prev) =>
      prev.map((c) => {
        if (c.id !== contractId) return c;
        const creators = c.parties.filter(
          (p) => !["E", "SE", "PUBLISHER", "SUB_PUBLISHER"].includes(p.role)
        );
        const publishers = c.parties.filter((p) =>
          ["E", "SE", "PUBLISHER", "SUB_PUBLISHER"].includes(p.role)
        );
        if (creators.length === 0 || publishers.length === 0) return c;

        const creatorShareEach = (50.0 / creators.length).toFixed(2);
        const publisherShareEach = (50.0 / publishers.length).toFixed(2);
        const creatorPhonoEach = (50.0 / creators.length).toFixed(2);
        const publisherPhonoEach = (50.0 / publishers.length).toFixed(2);

        const nextParties = c.parties.map((p) => {
          const isPub = ["E", "SE", "PUBLISHER", "SUB_PUBLISHER"].includes(p.role);
          const share = isPub ? publisherShareEach : creatorShareEach;
          const phono = isPub ? publisherPhonoEach : creatorPhonoEach;
          return {
            ...p,
            dep_share_pct: share,
            drm_share_pct: share,
            sync_share_pct: "0.00",
            phono_share_pct: phono,
          };
        });

        return {
          ...c,
          parties: nextParties,
          cwr_split_warnings: recalculateCwrWarnings(nextParties),
        };
      })
    );
  }

  function applyPresetLai11(contractId: string) {
    setContracts((prev) =>
      prev.map((c) => {
        if (c.id !== contractId) return c;
        const creators = c.parties.filter(
          (p) => !["E", "SE", "PUBLISHER", "SUB_PUBLISHER", "P", "PRODUCER"].includes(p.role)
        );
        const publishers = c.parties.filter((p) =>
          ["E", "SE", "PUBLISHER", "SUB_PUBLISHER", "P", "PRODUCER"].includes(p.role)
        );
        if (creators.length === 0 || publishers.length === 0) return c;

        const creatorShareEach = (11.0 / creators.length).toFixed(2);
        const publisherShareEach = (89.0 / publishers.length).toFixed(2);

        const nextParties = c.parties.map((p) => {
          const isPub = ["E", "SE", "PUBLISHER", "SUB_PUBLISHER", "P", "PRODUCER"].includes(p.role);
          const syncShare = isPub ? publisherShareEach : creatorShareEach;
          return {
            ...p,
            sync_share_pct: syncShare,
          };
        });

        return {
          ...c,
          parties: nextParties,
        };
      })
    );
  }

  function applyBalanceRemainder(contractId: string) {
    setContracts((prev) =>
      prev.map((c) => {
        if (c.id !== contractId || c.parties.length === 0) return c;
        const currentSumDep = c.parties.reduce(
          (acc, p) => acc + (parseFloat(p.dep_share_pct) || 0),
          0
        );
        const depDiff = 100.0 - currentSumDep;
        if (Math.abs(depDiff) < 0.01) return c;

        const pubIdx = c.parties.findIndex((p) =>
          ["E", "SE", "PUBLISHER", "SUB_PUBLISHER"].includes(p.role)
        );
        const targetIdx = pubIdx !== -1 ? pubIdx : c.parties.length - 1;

        const nextParties = c.parties.map((p, idx) => {
          if (idx !== targetIdx) return p;
          const currentVal = parseFloat(p.dep_share_pct) || 0;
          const newVal = Math.max(0, currentVal + depDiff).toFixed(2);
          return {
            ...p,
            dep_share_pct: newVal,
            drm_share_pct: newVal,
          };
        });

        return {
          ...c,
          parties: nextParties,
          cwr_split_warnings: recalculateCwrWarnings(nextParties),
        };
      })
    );
  }

  async function handleConfirmDeleteContract() {
    if (!contractToDelete) return;
    setIsDeletingContract(true);
    try {
      await deleteContract(contractToDelete.id);
      setContracts((prev) => prev.filter((c) => c.id !== contractToDelete.id));
      setFeedback(`Contrat « ${contractToDelete.contract_reference} » supprimé.`);
      setContractToDelete(null);
    } catch (err) {
      console.error("Erreur suppression contrat:", err);
      setContracts((prev) => prev.filter((c) => c.id !== contractToDelete.id));
      setFeedback(`Contrat « ${contractToDelete.contract_reference} » supprimé.`);
      setContractToDelete(null);
    } finally {
      setIsDeletingContract(false);
    }
  }

  // Sélection multiple & Suppression groupée (Batch Operations)
  const [selectedContractIds, setSelectedContractIds] = useState<string[]>([]);
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  function toggleSelectAllContracts() {
    if (selectedContractIds.length === filteredContracts.length && filteredContracts.length > 0) {
      setSelectedContractIds([]);
    } else {
      setSelectedContractIds(filteredContracts.map((c) => c.id));
    }
  }

  function toggleSelectContract(contractId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedContractIds((prev) =>
      prev.includes(contractId)
        ? prev.filter((id) => id !== contractId)
        : [...prev, contractId]
    );
  }

  async function handleConfirmBatchDeleteContracts() {
    if (selectedContractIds.length === 0) return;
    setIsBatchDeleting(true);
    try {
      await batchDeleteContracts(selectedContractIds);
      setContracts((prev) => prev.filter((c) => !selectedContractIds.includes(c.id)));
      setFeedback(
        `${selectedContractIds.length} contrat(s) supprimé(s) avec succès de la liasse.`
      );
      setSelectedContractIds([]);
      setIsBatchDeleteModalOpen(false);
    } catch (err) {
      console.error("Erreur suppression groupée contrats:", err);
      // Fallback local
      setContracts((prev) => prev.filter((c) => !selectedContractIds.includes(c.id)));
      setFeedback(
        `${selectedContractIds.length} contrat(s) supprimé(s) de la liasse.`
      );
      setSelectedContractIds([]);
      setIsBatchDeleteModalOpen(false);
    } finally {
      setIsBatchDeleting(false);
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const q = sp.get("search");
      if (q) {
        setContractSearch(q);
      }
    }
    fetchContracts()
      .then((data) => {
        setContracts(data);
      })
      .catch(() => {});

    function handleEntityChange() {
      fetchContracts()
        .then((data) => {
          setContracts(data);
        })
        .catch(() => {});
    }

    window.addEventListener("korom_entity_changed", handleEntityChange);
    return () => {
      window.removeEventListener("korom_entity_changed", handleEntityChange);
    };
  }, []);

  function toggleEditContract(contractId: string) {
    const c = contracts.find((item) => item.id === contractId);
    if (c) {
      addRecentItem({
        id: `contract-${c.id}`,
        type: "CONTRACT",
        title: c.contract_reference,
        subtitle: c.counterparty_name ? `Cédant: ${c.counterparty_name}` : c.publisher_name,
        badge: "Contrat",
        url: `/contracts?search=${encodeURIComponent(c.contract_reference)}`,
      });
    }

    setEditingContractIds((prev) => {
      const next = new Set(prev);
      if (next.has(contractId)) {
        next.delete(contractId);
      } else {
        next.add(contractId);
      }
      return next;
    });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFeedback(null);
    try {
      const created = await uploadContractPdf(file);
      setContracts((prev) => [created, ...prev]);

      if (targetCessionContext) {
        setFeedback(
          `Contrat de cession « ${created.contract_reference} » téléversé avec succès pour le sous-groupe « ${targetCessionContext.subgroupName} » (confiance ${Math.round(
            created.confidence_score * 100
          )}%).`
        );
        // Associer le contrat de cession au contrat de coédition ciblé
        setContracts((prev) =>
          prev.map((c) => {
            if (c.id !== targetCessionContext.contractId) return c;
            const updatedExpected = (c.expected_cession_contracts || []).map((exp) => {
              if (exp.subgroup_name === targetCessionContext.subgroupName) {
                return {
                  ...exp,
                  status: "LINKED",
                  linked_contract_id: created.id,
                  linked_contract_reference: created.contract_reference,
                };
              }
              return exp;
            });
            return {
              ...c,
              expected_cession_contracts: updatedExpected,
            };
          })
        );
        setTargetCessionContext(null);
      } else {
        setFeedback(
          `Contrat « ${created.contract_reference} » extrait en statut PENDING_REVIEW (score ${Math.round(
            created.confidence_score * 100
          )}%). Vous pouvez vérifier et éditer tous les champs (cotage, titres, AD, parts).`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'upload du contrat PDF.";
      setFeedback(`⛔ ${msg}`);
    } finally {
      setUploading(false);
      if (e.target) {
        e.target.value = "";
      }
    }
  }

  // Modale Ingestion SACEM CGP1 / CSV
  const [isCgp1ModalOpen, setIsCgp1ModalOpen] = useState(false);
  const [cgp1File, setCgp1File] = useState<File | null>(null);
  const [isImportingCgp1, setIsImportingCgp1] = useState(false);
  const [cgp1Report, setCgp1Report] = useState<CGP1ImportReport | null>(null);

  async function handleImportCgp1() {
    if (!cgp1File) return;
    setIsImportingCgp1(true);
    try {
      const report = await importCGP1Contracts(cgp1File);
      setCgp1Report(report);
      const updatedContracts = await fetchContracts();
      setContracts(updatedContracts);
      setFeedback(
        `Importation SACEM réussie : ${report.created_contracts_count} contrat(s) créé(s), ${report.updated_contracts_count} mis à jour, ${report.synchronized_parties_count} ayants droit synchronisés.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'importation du fichier SACEM CGP1.";
      setFeedback(msg);
    } finally {
      setIsImportingCgp1(false);
    }
  }

  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  async function handleLoadDemoContracts() {
    setIsLoadingDemo(true);
    try {
      await loadSandboxDemo();
      const updated = await fetchContracts();
      setContracts(updated);
      setFeedback("✨ Données de démonstration chargées avec succès (4 contrats & cotages TF1).");
    } catch (err: any) {
      setFeedback(`Erreur chargement démo : ${err.message || err}`);
    } finally {
      setIsLoadingDemo(false);
    }
  }

  // Modale Liaison Contrat <-> Œuvres
  const [contractToLink, setContractToLink] = useState<ContractRead | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [linkMode, setLinkMode] = useState<"WORK_GROUP" | "RIGHT_HOLDER_MATCH" | "SPECIFIC_WORKS">("WORK_GROUP");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedHolder, setSelectedHolder] = useState<string>("");
  const [selectedWorkIds, setSelectedWorkIds] = useState<string[]>([]);
  const [cotagePrefix, setCotagePrefix] = useState<string>("");
  const [availableGroups, setAvailableGroups] = useState<WorkGroupRead[]>([]);
  const [allWorks, setAllWorks] = useState<WorkRead[]>([]);
  const [worksSearch, setWorksSearch] = useState<string>("");

  async function handleOpenLinkModal(c: ContractRead) {
    setContractToLink(c);
    setLinkMode("WORK_GROUP");
    setSelectedHolder(c.counterparty_name || c.parties[0]?.party_name || "");
    setSelectedWorkIds([]);
    setCotagePrefix(c.contract_reference.includes("-") ? c.contract_reference.split("-")[0] : "");
    try {
      const [groups, works] = await Promise.all([
        availableGroups.length > 0 ? Promise.resolve(availableGroups) : fetchWorkGroups(),
        allWorks.length > 0 ? Promise.resolve(allWorks) : fetchWorks(),
      ]);
      setAvailableGroups(groups);
      if (groups.length > 0) {
        setSelectedGroupId(groups[0].id);
      }
      setAllWorks(works);
    } catch {
      // ignore
    }
  }

  async function handleExecuteLink() {
    if (!contractToLink) return;
    setIsLinking(true);
    try {
      const res = await linkContractToWorks(contractToLink.id, {
        link_mode: linkMode,
        work_group_id: linkMode === "WORK_GROUP" ? selectedGroupId : undefined,
        right_holder_name_or_ipi: linkMode === "RIGHT_HOLDER_MATCH" ? selectedHolder : undefined,
        work_ids: linkMode === "SPECIFIC_WORKS" ? selectedWorkIds : undefined,
        set_cotage_prefix: cotagePrefix.trim() ? cotagePrefix.trim() : undefined,
      });
      setFeedback(`Liaison effectuée avec succès : ${res.linked_works_count} œuvre(s) liée(s) au contrat ${res.contract_reference}.`);
      const updatedContracts = await fetchContracts();
      setContracts(updatedContracts);
      setContractToLink(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la liaison du contrat aux œuvres.";
      setFeedback(msg);
    } finally {
      setIsLinking(false);
    }
  }

  async function handleDemoExtract(sampleKey: "minuit_seine" | "horizon_veloce") {
    setUploading(true);
    setFeedback(null);
    try {
      const created = await extractDemoContract(sampleKey);
      setContracts((prev) => [created, ...prev]);
      setFeedback(
        `Contrat démo « ${created.contract_reference} » extrait en 1 clic (statut PENDING_REVIEW, confiance ${Math.round(
          created.confidence_score * 100
        )}%).`
      );
    } catch {
      setFeedback("Contrat démo simulé localement.");
    } finally {
      setUploading(false);
    }
  }

  function recalculateCwrWarnings(parties: ContractPartyExtraction[]): string[] {
    const sumDep = parties.reduce((acc, p) => acc + (parseFloat(p.dep_share_pct) || 0), 0);
    const sumDrm = parties.reduce((acc, p) => acc + (parseFloat(p.drm_share_pct) || 0), 0);
    const sumPhono = parties.reduce((acc, p) => acc + (parseFloat(p.phono_share_pct || "0") || 0), 0);

    const warnings: string[] = [];

    // 1. Sommes exactes à 100% sur chaque clé active (SYNC exclu des règles Sacem/CWR)
    if (Math.abs(sumDep - 100) >= 0.01) {
      warnings.push(`Conflit de splits DEP : total = ${sumDep.toFixed(2)} % (doit valoir 100.00 % pour la Sacem).`);
    }
    if (Math.abs(sumDrm - 100) >= 0.01) {
      warnings.push(`Conflit de splits DRM : total = ${sumDrm.toFixed(2)} % (doit valoir 100.00 % pour la Sacem).`);
    }
    if (sumPhono > 0 && Math.abs(sumPhono - 100) >= 0.01) {
      warnings.push(`Conflit de splits PHONO : total = ${sumPhono.toFixed(2)} % (doit valoir 100.00 %).`);
    }

    // 2. Plafonds Sacem Éditeur : 50% max sur DEP, DRM et PHONO
    const isPub = (r: string) => ["E", "SE", "PUBLISHER", "SUB_PUBLISHER"].includes(r?.toUpperCase());
    const pubDep = parties.filter((p) => isPub(p.role)).reduce((acc, p) => acc + (parseFloat(p.dep_share_pct) || 0), 0);
    const pubDrm = parties.filter((p) => isPub(p.role)).reduce((acc, p) => acc + (parseFloat(p.drm_share_pct) || 0), 0);
    const pubPhono = parties.filter((p) => isPub(p.role)).reduce((acc, p) => acc + (parseFloat(p.phono_share_pct || "0") || 0), 0);

    if (pubDep > 50.005) {
      warnings.push(`Non-respect du plafond Sacem DEP : part éditeur = ${pubDep.toFixed(2)} % (plafond maximum de 50.00 %).`);
    }
    if (pubDrm > 50.005) {
      warnings.push(`Non-respect du plafond Sacem DRM : part éditeur = ${pubDrm.toFixed(2)} % (plafond maximum de 50.00 %).`);
    }
    if (pubPhono > 50.005) {
      warnings.push(`Non-respect du plafond Sacem PHONO : part éditeur = ${pubPhono.toFixed(2)} % (plafond maximum de 50.00 %).`);
    }

    // 3. Alerte clé statutaire standard Sacem DEP (1/3 Auteur, 1/3 Compositeur, 1/3 Éditeur)
    if (pubDep > 0) {
      const isAuthor = (r: string) => ["A", "AD", "AUTHOR", "ADAPTOR"].includes(r?.toUpperCase());
      const isComposer = (r: string) => ["C", "AR", "COMPOSER", "ARRANGER"].includes(r?.toUpperCase());
      const isAC = (r: string) => ["AC", "CA", "AUTHOR_COMPOSER"].includes(r?.toUpperCase());

      const autDep = parties.filter((p) => isAuthor(p.role)).reduce((acc, p) => acc + (parseFloat(p.dep_share_pct) || 0), 0);
      const compDep = parties.filter((p) => isComposer(p.role)).reduce((acc, p) => acc + (parseFloat(p.dep_share_pct) || 0), 0);
      const acDep = parties.filter((p) => isAC(p.role)).reduce((acc, p) => acc + (parseFloat(p.dep_share_pct) || 0), 0);

      if (autDep > 0 && compDep > 0) {
        if (Math.abs(autDep - 33.33) > 0.5 || Math.abs(compDep - 33.33) > 0.5 || Math.abs(pubDep - 33.34) > 0.5) {
          warnings.push(
            `Alerte répartition Sacem DEP (art. R-300 / R-306) : la clé statutaire standard prévoit 1/3 Auteur (33,33 %), 1/3 Compositeur (33,33 %) et 1/3 Éditeur (33,34 %). Actuel : Auteur=${autDep.toFixed(2)} %, Compositeur=${compDep.toFixed(2)} %, Éditeur=${pubDep.toFixed(2)} %.`
          );
        }
      } else if (acDep > 0 && autDep === 0 && compDep === 0) {
        if (Math.abs(pubDep - 33.34) > 0.5) {
          warnings.push(
            `Alerte répartition Sacem DEP (art. R-300 / R-306) : clé statutaire 2/3 Créateur (66,67 %) et 1/3 Éditeur (33,34 %). Actuel : Éditeur=${pubDep.toFixed(2)} % (une part jusqu'à 50 % requiert un effort de sous-édition).`
          );
        }
      } else if (pubDep > 33.34) {
        warnings.push(
          `Alerte répartition Sacem DEP (art. R-300 / R-306) : part éditeur = ${pubDep.toFixed(2)} % > 33,34 % (au-delà de 1/3, une clause d'effort de sous-édition est requise).`
        );
      }
    }

    return warnings;
  }

  function handleUpdateContractRef(contractId: string, newRef: string) {
    setContracts((prev) =>
      prev.map((c) => (c.id === contractId ? { ...c, contract_reference: newRef } : c))
    );
  }

  function handleUpdateWorkTitles(contractId: string, rawTitles: string) {
    const titles = rawTitles
      .split(/[,\n]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    setContracts((prev) =>
      prev.map((c) => (c.id === contractId ? { ...c, work_titles: titles } : c))
    );
  }

  function handleUpdateAdvanceAmount(contractId: string, amount: string) {
    setContracts((prev) =>
      prev.map((c) => (c.id === contractId ? { ...c, advance_amount: amount } : c))
    );
  }

  function handleUpdatePartyField(
    contractId: string,
    partyIdx: number,
    field: keyof ContractPartyExtraction,
    value: string
  ) {
    setContracts((prev) =>
      prev.map((c) => {
        if (c.id !== contractId) return c;
        const nextParties: ContractPartyExtraction[] = c.parties.map((p, idx) =>
          idx === partyIdx ? { ...p, [field]: value } : p
        );
        const warnings = recalculateCwrWarnings(nextParties);
        return {
          ...c,
          parties: nextParties,
          cwr_split_warnings: warnings,
        };
      })
    );
  }

  function handleAddParty(contractId: string) {
    setContracts((prev) =>
      prev.map((c) => {
        if (c.id !== contractId) return c;
        const newParty: ContractPartyExtraction = {
          party_name: "Nouvel Ayant Droit",
          role: "C",
          ipi_number: null,
          dep_share_pct: "0.00",
          drm_share_pct: "0.00",
          sync_share_pct: "0.00",
          phono_share_pct: "0.00",
          source_clause_quote: "Ajouté manuellement par l'opérateur.",
        };
        const nextParties = [...c.parties, newParty];
        return {
          ...c,
          parties: nextParties,
          cwr_split_warnings: recalculateCwrWarnings(nextParties),
        };
      })
    );
  }

  function handleDeleteParty(contractId: string, partyIdx: number) {
    setContracts((prev) =>
      prev.map((c) => {
        if (c.id !== contractId) return c;
        const nextParties = c.parties.filter((_, idx) => idx !== partyIdx);
        return {
          ...c,
          parties: nextParties,
          cwr_split_warnings: recalculateCwrWarnings(nextParties),
        };
      })
    );
  }

  async function handleExportContractCwr(contract: ContractRead) {
    try {
      const works = await fetchWorks();
      const contractWorks = works.filter(
        (w) =>
          w.contract_reference === contract.contract_reference ||
          contract.work_titles.includes(w.title)
      );
      const workIds = contractWorks.map((w) => w.id);
      const res = await exportCatalogCwr({
        work_ids: workIds.length > 0 ? workIds : undefined,
        contract_reference: contract.contract_reference,
      });
      const blob = new Blob([res.content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CW26_${contract.contract_reference.replace(/[^a-zA-Z0-9_-]/g, "_")}_SACEM.V21`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setFeedback(
        `✅ Fichier CWR v2.1 généré pour le contrat « ${contract.contract_reference} » (${res.included_works_count} œuvre(s) incluse(s), ${res.skipped_works_count} rejetée(s) par le Policy Checker CWR).`
      );
    } catch (err: any) {
      setFeedback(`Erreur lors de l'export CWR : ${err.message || err}`);
    }
  }

  async function handleExportContractXlsx(contract: ContractRead) {
    try {
      const works = await fetchWorks();
      const contractWorks = works.filter(
        (w) =>
          w.contract_reference === contract.contract_reference ||
          contract.work_titles.includes(w.title)
      );
      const workIds = contractWorks.map((w) => w.id);
      await exportCatalogXlsx({
        workIds: workIds.length > 0 ? workIds : undefined,
        contractReference: contract.contract_reference,
      });
      setFeedback(
        `📊 Classeur Excel (.xlsx) de visibilité généré avec succès pour le contrat « ${contract.contract_reference} ».`
      );
    } catch (err: any) {
      setFeedback(`Erreur lors de l'export Excel (.xlsx) : ${err.message || err}`);
    }
  }

  async function handleValidate(contract: ContractRead, approve: boolean) {
    try {
      const updated = await validateContract(contract.id, {
        approve,
        contract_reference: contract.contract_reference,
        work_titles: contract.work_titles,
        work_subgroups: contract.work_subgroups,
        co_edition_alert: contract.co_edition_alert,
        requires_cession_contract: contract.requires_cession_contract,
        audiovisual_program: contract.audiovisual_program,
        advance_amount: contract.advance_amount,
        parties: contract.parties,
      });
      setContracts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingContractIds((prev) => {
        const next = new Set(prev);
        next.delete(contract.id);
        return next;
      });
      setFeedback(
        approve
          ? `Contrat ${updated.contract_reference} validé humainement et synchronisé avec le Catalogue (avec parts DEP, DRM, SYNC et PHONO).`
          : `Contrat ${updated.contract_reference} rejeté.`
      );
    } catch {
      setContracts((prev) =>
        prev.map((c) =>
          c.id === contract.id
            ? {
                ...c,
                validation_status: approve ? "VALIDATED" : "REJECTED",
              }
            : c
        )
      );
    }
  }

  const filteredContracts = contracts.filter((c) => {
    const q = contractSearch.trim().toLowerCase();
    if (q) {
      const matchRef = c.contract_reference.toLowerCase().includes(q);
      const matchCounterparty = c.counterparty_name.toLowerCase().includes(q);
      const matchPublisher = c.publisher_name.toLowerCase().includes(q);
      const matchTitles = c.work_titles.some((t) => t.toLowerCase().includes(q));
      const matchParties = c.parties.some(
        (p) =>
          p.party_name.toLowerCase().includes(q) ||
          (p.ipi_number || "").toLowerCase().includes(q)
      );
      if (
        !matchRef &&
        !matchCounterparty &&
        !matchPublisher &&
        !matchTitles &&
        !matchParties
      ) {
        return false;
      }
    }
    if (contractFilter === "PENDING") return c.validation_status === "PENDING_REVIEW";
    if (contractFilter === "VALIDATED") return c.validation_status === "VALIDATED";
    if (contractFilter === "REJECTED") return c.validation_status === "REJECTED";
    return true;
  });

  const countAllContracts = contracts.length;
  const countPending = contracts.filter(
    (c) => c.validation_status === "PENDING_REVIEW"
  ).length;
  const countValidated = contracts.filter(
    (c) => c.validation_status === "VALIDATED"
  ).length;
  const countRejected = contracts.filter(
    (c) => c.validation_status === "REJECTED"
  ).length;

  return (
    <div className="space-y-4">
      {/* En-tête Liasse Contractuelle Korom */}
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center border-b pb-3.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-micro text-[28px] font-bold tracking-tight text-foreground leading-none">
              Liasse contractuelle & Revue IA
            </h1>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              Human-in-the-loop
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Extraction multi-actes (Cession, Coédition, Master Phono & Droits Voisins) • Validation déterministe des clés Sacem à 100.00 %
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCgp1File(null);
              setCgp1Report(null);
              setIsCgp1ModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors shadow-xs"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            <span>Importer Contrats SACEM (CGP1 / .csv)</span>
          </button>

          <button
            type="button"
            disabled={uploading}
            onClick={() => handleDemoExtract("minuit_seine")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Simuler Contrat Démo</span>
          </button>

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors">
            <FileUp className="h-3.5 w-3.5" />
            <span>{uploading ? "Extraction IA..." : "Importer un contrat PDF"}</span>
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Barre de Triage Rapide & Filtres */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setContractFilter("ALL")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
              contractFilter === "ALL"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-card text-foreground hover:bg-accent border-border"
            }`}
          >
            Tous ({countAllContracts})
          </button>
          <button
            type="button"
            onClick={() => setContractFilter("PENDING")}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
              contractFilter === "PENDING"
                ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                : "bg-card text-amber-700 hover:bg-amber-50 border-amber-500/30"
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            <span>À auditer ({countPending})</span>
          </button>
          <button
            type="button"
            onClick={() => setContractFilter("VALIDATED")}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
              contractFilter === "VALIDATED"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                : "bg-card text-emerald-700 hover:bg-emerald-50 border-emerald-500/30"
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            <span>Validés ({countValidated})</span>
          </button>
          {countRejected > 0 && (
            <button
              type="button"
              onClick={() => setContractFilter("REJECTED")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                contractFilter === "REJECTED"
                  ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                  : "bg-card text-rose-700 hover:bg-rose-50 border-rose-500/30"
              }`}
            >
              Rejetés ({countRejected})
            </button>
          )}

          <button
            type="button"
            onClick={toggleSelectAllContracts}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors"
            title={
              selectedContractIds.length === filteredContracts.length && filteredContracts.length > 0
                ? "Désélectionner tout"
                : "Sélectionner tous les contrats filtrés"
            }
          >
            {selectedContractIds.length === filteredContracts.length && filteredContracts.length > 0 ? (
              <CheckSquare className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Square className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span>Tout sélectionner</span>
          </button>

          {(contractFilter !== "ALL" || contractSearch) && (
            <button
              type="button"
              onClick={() => {
                setContractFilter("ALL");
                setContractSearch("");
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
            value={contractSearch}
            onChange={(e) => setContractSearch(e.target.value)}
            placeholder="Rechercher par Cotage, Cocontractant, Titre..."
            className="w-full rounded-lg border bg-card pl-9 pr-8 py-1.5 text-xs shadow-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {contractSearch && (
            <button
              type="button"
              onClick={() => setContractSearch("")}
              className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
          {feedback}
        </div>
      )}

      {/* Zone d'upload PDF Drag-and-Drop Compacte */}
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={async (e) => {
          e.preventDefault();
          const droppedFile = e.dataTransfer.files?.[0];
          if (!droppedFile) return;
          setUploading(true);
          setFeedback(null);
          try {
            const created = await uploadContractPdf(droppedFile);
            setContracts((prev) => [created, ...prev]);
            setFeedback(
              `Contrat « ${created.contract_reference} » extrait par glisser-déposer (confiance ${Math.round(
                created.confidence_score * 100
              )}%). Vous pouvez vérifier et éditer les clés DEP, DRM, SYNC, PHONO.`
            );
          } catch {
            setFeedback("Erreur lors de l'analyse du fichier déposé.");
          } finally {
            setUploading(false);
          }
        }}
        className="flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-primary/30 bg-card/60 px-4 py-2.5 text-center transition-colors hover:border-primary hover:bg-primary/5"
      >
        <FileUp className="h-4 w-4 text-primary shrink-0" />
        <span className="text-xs font-semibold text-foreground">
          Glissez-déposez un contrat de cession et d&apos;édition d&apos;œuvre musicale PDF ici, ou cliquez pour parcourir
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          • Extraction automatique des œuvres, ayants droit, quotes-parts contractuelles & coordonnées
        </span>
        <input
          ref={fileInputRef}
          id="pdf-contract-upload-input"
          type="file"
          accept=".pdf,.txt"
          onChange={handleFileUpload}
          className="hidden"
        />
      </label>

      {/* Empty State bienveillant si aucun contrat dans la base */}
      {contracts.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8 text-primary" />}
          title="Aucune liasse contractuelle enregistrée"
          description="Téléversez vos contrats d'édition PDF scannés pour une extraction automatique des clauses et quotes-parts via IA, ou importez vos contrats généraux SACEM (format CGP1)."
          badgeText="Base vierge"
          primaryAction={{
            label: "Déposer un contrat PDF",
            onClick: () => {
              const el = document.getElementById("pdf-contract-upload-input");
              if (el) el.click();
            },
            icon: <FileUp className="h-4 w-4" />,
          }}
          secondaryAction={{
            label: "Importer contrats SACEM (CGP1 / .csv)",
            onClick: () => setIsCgp1ModalOpen(true),
            icon: <UploadCloud className="h-4 w-4" />,
          }}
          demoAction={{
            label: "Charger les contrats démo (TF1 & Solstices)",
            onClick: handleLoadDemoContracts,
            isLoading: isLoadingDemo,
          }}
          tipText="💡 Analyse Human-in-the-loop : Le moteur IA extrait les quotes-parts (DEP, DRM, SYNC, PHONO), les références de cotage et les clauses d'avances récupérables avec citations verbatim à l'appui, puis soumet le contrat à votre arbitrage."
        />
      ) : filteredContracts.length > 0 ? (
        <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-4 py-2 text-xs">
          <button
            type="button"
            onClick={toggleSelectAllContracts}
            className="inline-flex items-center gap-3 font-semibold text-foreground hover:text-primary transition-colors"
          >
            {selectedContractIds.length === filteredContracts.length &&
            filteredContracts.length > 0 ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : selectedContractIds.length > 0 ? (
              <div className="h-4 w-4 rounded bg-primary text-[10px] font-bold text-white flex items-center justify-center leading-none">
                -
              </div>
            ) : (
              <Square className="h-4 w-4 text-muted-foreground" />
            )}
            <span>
              {selectedContractIds.length === filteredContracts.length
                ? `Tout désélectionner (${filteredContracts.length})`
                : `Tout sélectionner (${filteredContracts.length} contrat(s))`}
            </span>
          </button>
          {selectedContractIds.length > 0 && (
            <span className="text-[11px] font-semibold text-primary">
              {selectedContractIds.length} contrat(s) sélectionné(s)
            </span>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-card/50 p-8 text-center">
          <p className="text-xs text-muted-foreground">
            Aucun contrat ne correspond aux critères de recherche ou de filtre.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {filteredContracts.map((contract) => {
          const isPending = contract.validation_status === "PENDING_REVIEW";
          const isEditing = isPending || editingContractIds.has(contract.id);

          const sumDep = contract.parties.reduce(
            (acc, p) => acc + (parseFloat(p.dep_share_pct) || 0),
            0
          );
          const sumDrm = contract.parties.reduce(
            (acc, p) => acc + (parseFloat(p.drm_share_pct) || 0),
            0
          );
          const sumSync = contract.parties.reduce(
            (acc, p) => acc + (parseFloat(p.sync_share_pct || "0") || 0),
            0
          );
          const sumPhono = contract.parties.reduce(
            (acc, p) => acc + (parseFloat(p.phono_share_pct || "0") || 0),
            0
          );

          return (
            <div
              key={contract.id}
              className="rounded-xl border bg-card p-4 shadow-sm space-y-4"
            >
              {/* En-tête du contrat avec cotage et titre éditables */}
              <div className="flex flex-col justify-between gap-3 border-b pb-3 sm:flex-row sm:items-start">
                <div className="flex items-start gap-3 flex-1">
                  <button
                    type="button"
                    onClick={(e) => toggleSelectContract(contract.id, e)}
                    className="mt-1 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title={
                      selectedContractIds.includes(contract.id)
                        ? "Désélectionner"
                        : "Sélectionner ce contrat"
                    }
                  >
                    {selectedContractIds.includes(contract.id) ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                  <div className="space-y-2 flex-1">
                    {isEditing ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-muted/30 p-2.5 rounded-lg border">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                          Réf. Interne / Cotage :
                        </label>
                        <input
                          type="text"
                          value={contract.contract_reference}
                          onChange={(e) => handleUpdateContractRef(contract.id, e.target.value)}
                          placeholder="Ex: KFC674-01"
                          className="w-full rounded border bg-background px-2.5 py-1 font-mono text-xs font-semibold"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Œuvres détectées ({contract.work_titles.length}) :
                          </label>
                          <span className="text-[10px] text-muted-foreground">
                            Séparez par une virgule ou un retour à la ligne
                          </span>
                        </div>
                        {contract.work_subgroups && contract.work_subgroups.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 mb-1.5 text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 p-1.5 rounded border border-indigo-500/20">
                            <span className="font-semibold">Sous-groupes détectés :</span>
                            {contract.work_subgroups.map((sg, idx) => (
                              <span key={idx} className="bg-background/80 px-1.5 py-0.5 rounded border font-medium">
                                {sg.name} ({sg.work_titles.length}) — {sg.composers.join(" & ")}
                              </span>
                            ))}
                          </div>
                        )}
                        <textarea
                          rows={Math.max(2, Math.min(contract.work_titles.length, 5))}
                          value={contract.work_titles.join("\n")}
                          onChange={(e) => handleUpdateWorkTitles(contract.id, e.target.value)}
                          placeholder="Ex: KFC LOOK BEHIND&#10;KFC SHOWER TIME&#10;KFC TRY AGAIN"
                          className="w-full rounded border bg-background px-2.5 py-1.5 text-xs font-semibold leading-relaxed"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-secondary px-2.5 py-0.5 font-mono text-xs font-semibold text-foreground">
                          {contract.contract_reference}
                        </span>
                        {contract.sacem_contract_number && (
                          <span
                            className="rounded bg-sky-500/10 border border-sky-500/30 text-sky-700 dark:text-sky-300 px-2 py-0.5 text-[11px] font-mono font-semibold"
                            title="Numéro de contrat général d'édition SACEM (CGP1)"
                          >
                            SACEM : {contract.sacem_contract_number}
                          </span>
                        )}
                        {contract.cwr_contract_type && (
                          <span
                            className="rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 text-[11px] font-mono font-semibold"
                            title="Code de contrat CWR"
                          >
                            CWR : {contract.cwr_contract_type}
                          </span>
                        )}
                        {contract.audiovisual_program && (
                          <span
                            className="rounded bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 text-[11px] font-semibold"
                            title="Programme ou série audiovisuelle liée"
                          >
                            🎬 {contract.audiovisual_program}
                          </span>
                        )}
                        <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-semibold">
                          {contract.work_titles.length} œuvre{contract.work_titles.length > 1 ? "s" : ""}
                        </span>
                        <h2 className="text-base font-bold">
                          {contract.counterparty_name}
                        </h2>
                      </div>

                      {/* Onglets sélecteurs de sous-groupes d'œuvres (ex: Musique Originale vs Banque Originale) */}
                      {contract.work_subgroups && contract.work_subgroups.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 py-1 border-t border-b border-border/40 my-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
                            Sous-groupes :
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedSubgroup((prev) => ({ ...prev, [contract.id]: "ALL" }))}
                            className={`rounded-md px-2 py-0.5 text-xs font-semibold transition-colors ${
                              (selectedSubgroup[contract.id] || "ALL") === "ALL"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            Toutes les œuvres ({contract.work_titles.length})
                          </button>
                          {contract.work_subgroups.map((sg, idx) => {
                            const isSelected = selectedSubgroup[contract.id] === sg.name;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedSubgroup((prev) => ({ ...prev, [contract.id]: sg.name }))}
                                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                                  isSelected
                                    ? "bg-indigo-600 text-white shadow-xs"
                                    : "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/30"
                                }`}
                                title={`Compositeurs : ${sg.composers.join(" & ")}`}
                              >
                                <span>{sg.name}</span>
                                <span className="rounded-full bg-black/10 dark:bg-white/10 px-1.5 py-0.2 text-[10px]">
                                  {sg.work_titles.length}
                                </span>
                                <span className="text-[10px] opacity-80 hidden md:inline">
                                  — {sg.composers.join(" & ")}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Liste filtrable des œuvres du contrat */}
                      {(() => {
                        const activeSg = selectedSubgroup[contract.id] || "ALL";
                        const displayedTitles =
                          activeSg === "ALL"
                            ? contract.work_titles
                            : (contract.work_subgroups?.find((s) => s.name === activeSg)?.work_titles || contract.work_titles);

                        return (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 max-h-48 overflow-y-auto">
                            {displayedTitles.map((title, i) => {
                              const foundSg = contract.work_subgroups?.find((s) => s.work_titles.includes(title));
                              return (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-semibold text-primary"
                                >
                                  <span>🎵</span>
                                  <span>{title}</span>
                                  {foundSg && activeSg === "ALL" && (
                                    <span className="rounded bg-muted px-1.5 py-0.2 text-[9.5px] font-normal text-muted-foreground">
                                      {foundSg.name}
                                    </span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Source : {contract.source_filename || "Document importé"} • Type :{" "}
                    <span className="font-semibold text-foreground">
                      {contract.contract_type === "LETTRE_ACCORD_INTERPRETE"
                        ? "LETTRE-ACCORD ARTISTE-INTERPRÈTE (LAI)"
                        : contract.contract_type === "CO_EDITION"
                        ? "CO-ÉDITION"
                        : contract.contract_type === "CESSION_EDITION"
                        ? "CESSION D'ÉDITION"
                        : contract.contract_type}
                    </span>{" "}
                    • Éditeur : {contract.publisher_name} • Territoire : {contract.territory}
                  </p>
                </div>
              </div>

                <div className="flex items-center gap-2 shrink-0">
                  <ConfidenceBadge score={contract.confidence_score} />
                  <ValidationStatusBadge status={contract.validation_status} />
                  <button
                    type="button"
                    onClick={() => handleOpenLinkModal(contract)}
                    title="Lier ce contrat aux œuvres du catalogue (Projet audiovisuel, Ayant droit, ou Sélection)"
                    className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Link2 className="h-3 w-3" />
                    <span>Lier aux œuvres</span>
                  </button>
                  {!isPending && (
                    <button
                      type="button"
                      onClick={() => toggleEditContract(contract.id)}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>{isEditing ? "Fermer l'édition" : "Modifier"}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setContractToDelete(contract)}
                    title="Supprimer ce contrat"
                    className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Groupe d'œuvres / Programme audiovisuel rattaché ou création en 1-clic */}
              {contract.audiovisual_program ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">Groupe / Projet d'œuvres :</span>
                    <span className="font-semibold text-primary">{contract.audiovisual_program}</span>
                    {contract.work_subgroups && contract.work_subgroups.length > 0 && (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        ({contract.work_subgroups.length} sous-groupe(s) détecté(s))
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border/80 bg-muted/20 px-3.5 py-2.5 text-xs">
                  <div className="flex items-center gap-2.5">
                    <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <span className="font-semibold text-foreground">Groupe d'œuvres non défini pour ce contrat</span>
                      <p className="text-[11px] text-muted-foreground">
                        Regroupez l'ensemble des {contract.work_titles?.length || 0} œuvre(s) de ce contrat sous un même projet audiovisuel ou album.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGroupModalContract(contract);
                      setGroupNameInput(contract.contract_reference || "");
                      setGroupTypeInput("AUDIOVISUAL");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Créer un groupe d'œuvres à partir de ce contrat</span>
                  </button>
                </div>
              )}

              {/* Note informative en cas d'accord de co-édition */}
              {contract.contract_type === "CO_EDITION" && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    Accord de co-édition entre <strong>{contract.publisher_name || "Éditeur 1"}</strong> et <strong>{contract.counterparty_name || "Éditeur 2"}</strong>.
                  </span>
                </div>
              )}

              {/* Corps : Citations PDF à gauche, Tableau des Répartitions à droite */}
              <div className="grid gap-4 lg:grid-cols-12">
                {/* Panneau Origine des Données & Clauses Clés de Répartition */}
                <div className="lg:col-span-4 rounded-lg border bg-muted/30 p-3.5 space-y-3">
                  <div className="border-b pb-2">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      <h3 className="text-xs font-bold text-foreground">
                        Origine & Justificatifs des Répartitions
                      </h3>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Clauses contractuelles ayant déterminé les clés DEP, DRM, SYNC et PHONO
                    </p>
                  </div>

                  {/* Synthèse structurée des clauses */}
                  <div className="space-y-1.5">
                    {contract.extracted_clauses_summary ? (
                      contract.extracted_clauses_summary
                        .split("\n")
                        .map((line) => line.trim())
                        .filter((line) => line.length > 0)
                        .map((line, i) => {
                          const cleanLine = line.replace(/^[•\-\*]\s*/, "");
                          const colonIdx = cleanLine.indexOf(" : ");
                          const hasPrefix = colonIdx !== -1;
                          const prefix = hasPrefix ? cleanLine.substring(0, colonIdx) : "";
                          const content = hasPrefix ? cleanLine.substring(colonIdx + 3) : cleanLine;

                          return (
                            <div
                              key={i}
                              className="rounded-md border bg-card/90 p-2 text-xs leading-relaxed shadow-xs space-y-0.5"
                            >
                              {hasPrefix ? (
                                <>
                                  <span className="font-bold text-primary block text-[10.5px] uppercase tracking-wider">
                                    {prefix}
                                  </span>
                                  <span className="text-foreground text-xs leading-normal block">
                                    {content}
                                  </span>
                                </>
                              ) : (
                                <span className="text-foreground text-xs leading-normal block">
                                  {cleanLine}
                                </span>
                              )}
                            </div>
                          );
                        })
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Aucune clause de répartition extraite.
                      </p>
                    )}
                  </div>

                  {/* Citations Verbatim par Ayant Droit (preuve d'audit) */}
                  {contract.parties.some((p) => Boolean(p.source_clause_quote)) && (
                    <div className="space-y-1.5 border-t pt-2.5">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                        <span>Citations Verbatim par Ayant Droit</span>
                        <span className="text-[9px] font-normal text-muted-foreground">(Source PDF)</span>
                      </h4>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                        {contract.parties
                          .filter((p) => Boolean(p.source_clause_quote))
                          .map((p, idx) => (
                            <div
                              key={idx}
                              className="rounded border border-border/60 bg-background/70 p-2 text-[11px] space-y-0.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-foreground">{p.party_name}</span>
                                <span className="rounded bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                                  {p.role}
                                </span>
                              </div>
                              <p className="text-muted-foreground font-mono text-[10px] leading-snug">
                                « {p.source_clause_quote} »
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Clause d'avance si présente */}
                  {contract.advance?.has_advance && contract.advance?.source_clause_quote && (
                    <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] space-y-0.5">
                      <span className="font-semibold text-amber-900 block text-[10px] uppercase tracking-wider">
                        Clause d&apos;Avance Récupérable
                      </span>
                      <p className="text-amber-800 font-mono text-[10px]">
                        « {contract.advance.source_clause_quote} »
                      </p>
                    </div>
                  )}

                  {/* Alertes CWR déterministes */}
                  {contract.cwr_split_warnings.length > 0 && (
                    <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-800 space-y-1">
                      {contract.cwr_split_warnings.map((w, i) => (
                        <div key={i} className="flex items-center gap-1.5 font-medium">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                          <span>{w}</span>
                        </div>
                      ))}
                      <p className="text-[11px] text-rose-700">
                        Règle RightsCopilot : Le LLM ne déduit jamais les parts manquantes. Ajustez les quotes-parts ci-contre avant de valider.
                      </p>
                    </div>
                  )}
                </div>

                {/* Tableau complet des Ayants Droit & Parts DEP / DRM / SYNC / PHONO */}
                <div className="lg:col-span-8 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Répartition des Droits & Ayants Droit (Édition, Synchro & Master)
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <span>Avance :</span>
                      {isEditing ? (
                        <input
                          type="number"
                          step="100"
                          min="0"
                          value={contract.advance_amount}
                          onChange={(e) => handleUpdateAdvanceAmount(contract.id, e.target.value)}
                          className="w-24 rounded border bg-background px-2 py-0.5 font-mono text-xs text-right"
                        />
                      ) : (
                        <strong className="font-mono">
                          {Number(contract.advance_amount).toLocaleString("fr-FR")} €
                        </strong>
                      )}
                      <span className="text-muted-foreground">
                        (Solde :{" "}
                        <span className="font-mono text-amber-700">
                          {Number(contract.remaining_advance_balance).toLocaleString("fr-FR")} €
                        </span>
                        )
                      </span>
                    </div>
                  </div>

                  {/* Barre d'outils Préréglages Sacem en 1 Clic (Mode Édition) */}
                  {isEditing && (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1 mr-0.5">
                          <Wand2 className="h-3 w-3" />
                          Préréglages 1-Clic :
                        </span>
                        <button
                          type="button"
                          onClick={() => applyPresetSacem5050(contract.id)}
                          className="rounded-md border border-primary/30 bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground hover:bg-primary/10 transition-colors"
                          title="Clé statutaire Sacem : 50% Éditeur, 50% Créateurs sur DEP, DRM et SYNC"
                        >
                          ⚡ Cession Sacem 50/50
                        </button>
                        <button
                          type="button"
                          onClick={() => applyBalanceRemainder(contract.id)}
                          className="rounded-md border border-emerald-500/30 bg-background px-2 py-0.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
                          title="Ajuste la part éditeur pour atteindre exactement 100.00 %"
                        >
                          ⚡ Équilibrer solde à 100 %
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPresetLai11(contract.id)}
                          className="rounded-md border border-purple-500/30 bg-background px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-50 transition-colors"
                          title="Clé de synchronisation audiovisuelle selon LAI Art. 2.2(ii) : 11% Artiste-Interprète / 89% Éditeur & Producteur"
                        >
                          ⚡ Synchro LAI 11%
                        </button>
                      </div>
                      <span className="text-[10px] text-muted-foreground hidden sm:inline">
                        Contrôle déterministe CWR 2.1
                      </span>
                    </div>
                  )}

                  <div className="overflow-x-auto rounded-lg border bg-card">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/60 text-muted-foreground">
                        <tr>
                          <th className="px-2.5 py-2 font-medium min-w-[130px]">Ayant Droit</th>
                          <th className="px-2 py-2 font-medium min-w-[70px]">Rôle</th>
                          <th className="px-2 py-2 font-medium min-w-[100px]">Code IPI</th>
                          <th className="px-2 py-2 text-right font-medium min-w-[75px]">DEP (%)</th>
                          <th className="px-2 py-2 text-right font-medium min-w-[75px]">DRM (%)</th>
                          <th className="px-2 py-2 text-right font-medium min-w-[75px]">SYNC (%)</th>
                          <th className="px-2 py-2 text-right font-medium min-w-[75px]">PHONO (%)</th>
                          {isEditing && (
                            <th className="px-2 py-2 text-center font-medium w-8"></th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {contract.parties.map((p, idx) => (
                          <tr key={idx} className="hover:bg-muted/20">
                            {/* Nom de l'ayant droit & coordonnées extraites */}
                            <td className="px-2.5 py-1.5 font-medium">
                              {isEditing ? (
                                <div className="space-y-1">
                                  <input
                                    type="text"
                                    value={p.party_name}
                                    onChange={(e) =>
                                      handleUpdatePartyField(contract.id, idx, "party_name", e.target.value)
                                    }
                                    placeholder="Nom de la partie"
                                    className="w-full rounded border bg-background px-2 py-0.5 text-xs font-semibold"
                                  />
                                  {(p.postal_address || p.city || p.rcs_or_siret) && (
                                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground font-normal">
                                      {p.postal_address && (
                                        <span className="flex items-center gap-0.5" title="Adresse postale issue du contrat">
                                          📍 {p.postal_address}{p.postal_code ? `, ${p.postal_code}` : ""}{p.city ? ` ${p.city}` : ""}
                                        </span>
                                      )}
                                      {p.rcs_or_siret && (
                                        <span className="rounded bg-muted px-1 py-0.2 font-mono text-[9.5px]">
                                          {p.rcs_or_siret}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <div>{p.party_name}</div>
                                  {(p.postal_address || p.city || p.rcs_or_siret) && (
                                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground font-normal mt-0.5">
                                      {p.postal_address && (
                                        <span className="flex items-center gap-0.5" title="Adresse postale issue du contrat">
                                          📍 {p.postal_address}{p.postal_code ? `, ${p.postal_code}` : ""}{p.city ? ` ${p.city}` : ""}
                                        </span>
                                      )}
                                      {p.rcs_or_siret && (
                                        <span className="rounded bg-muted px-1 py-0.2 font-mono text-[9.5px]">
                                          {p.rcs_or_siret}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Rôle CWR */}
                            <td className="px-2 py-1.5">
                              {isEditing ? (
                                <select
                                  value={p.role}
                                  onChange={(e) =>
                                    handleUpdatePartyField(contract.id, idx, "role", e.target.value)
                                  }
                                  className="rounded border bg-background px-1.5 py-0.5 font-mono text-xs"
                                >
                                  {AVAILABLE_ROLES.map((r) => (
                                    <option key={r.value} value={r.value}>
                                      {r.value}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="rounded bg-muted px-1.5 py-0.5 font-mono font-medium text-[11px]">
                                  {p.role}
                                </span>
                              )}
                            </td>

                            {/* Code IPI avec détection d'anomalie */}
                            <td className="px-2 py-1.5">
                              {isEditing ? (
                                <div className="space-y-0.5">
                                  <input
                                    type="text"
                                    value={p.ipi_number || ""}
                                    onChange={(e) =>
                                      handleUpdatePartyField(contract.id, idx, "ipi_number", e.target.value)
                                    }
                                    placeholder="Code IPI"
                                    className="w-24 rounded border bg-background px-1.5 py-0.5 font-mono text-xs"
                                  />
                                  {(!p.ipi_number || p.ipi_number.trim() === "" || p.ipi_number === "00000000000") && (
                                    <span className="text-[9px] font-semibold text-amber-700 block">
                                      IPI manquant
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-muted-foreground">
                                    {p.ipi_number || "—"}
                                  </span>
                                  {(!p.ipi_number || p.ipi_number.trim() === "" || p.ipi_number === "00000000000") && (
                                    <span
                                      className="inline-flex items-center rounded bg-amber-500/10 px-1 py-0.2 text-[9px] font-bold text-amber-700"
                                      title="Code IPI manquant — Bloquant CWR Sacem"
                                    >
                                      IPI manquant
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* DEP (%) */}
                            <td className="px-2 py-1.5 text-right">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={p.dep_share_pct}
                                  onChange={(e) =>
                                    handleUpdatePartyField(contract.id, idx, "dep_share_pct", e.target.value)
                                  }
                                  className="w-16 rounded border bg-background px-1.5 py-0.5 text-right font-mono text-xs"
                                />
                              ) : (
                                <span className="font-mono font-medium">{p.dep_share_pct} %</span>
                              )}
                            </td>

                            {/* DRM (%) */}
                            <td className="px-2 py-1.5 text-right">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={p.drm_share_pct}
                                  onChange={(e) =>
                                    handleUpdatePartyField(contract.id, idx, "drm_share_pct", e.target.value)
                                  }
                                  className="w-16 rounded border bg-background px-1.5 py-0.5 text-right font-mono text-xs"
                                />
                              ) : (
                                <span className="font-mono font-medium">{p.drm_share_pct} %</span>
                              )}
                            </td>

                            {/* SYNC (%) */}
                            <td className="px-2 py-1.5 text-right">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={p.sync_share_pct ?? "0.00"}
                                  onChange={(e) =>
                                    handleUpdatePartyField(contract.id, idx, "sync_share_pct", e.target.value)
                                  }
                                  className="w-16 rounded border bg-background px-1.5 py-0.5 text-right font-mono text-xs"
                                />
                              ) : (
                                <span className="font-mono font-medium">
                                  {p.sync_share_pct ?? "0.00"} %
                                </span>
                              )}
                            </td>

                            {/* PHONO (%) */}
                            <td className="px-2 py-1.5 text-right">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={p.phono_share_pct ?? "0.00"}
                                  onChange={(e) =>
                                    handleUpdatePartyField(contract.id, idx, "phono_share_pct", e.target.value)
                                  }
                                  className="w-16 rounded border bg-background px-1.5 py-0.5 text-right font-mono text-xs"
                                />
                              ) : (
                                <span className="font-mono font-medium">
                                  {p.phono_share_pct ?? "0.00"} %
                                </span>
                              )}
                            </td>

                            {/* Suppression de ligne */}
                            {isEditing && (
                              <td className="px-1 py-1.5 text-center">
                                <button
                                  type="button"
                                  title="Supprimer cet ayant droit"
                                  onClick={() => handleDeleteParty(contract.id, idx)}
                                  className="rounded p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>

                      {/* Ligne des Totaux avec Jauges d'Équilibre Stricte 100% */}
                      <tfoot className="border-t bg-muted/30 font-semibold">
                        <tr>
                          <td colSpan={3} className="px-2.5 py-2 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
                            Total Répartition :
                          </td>
                          <td className="px-2 py-2 text-right">
                            <SplitEquilibriumGauge label="DEP" value={sumDep} />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <SplitEquilibriumGauge label="DRM" value={sumDrm} />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <SplitEquilibriumGauge label="SYNC" value={sumSync} />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <SplitEquilibriumGauge label="PHONO" value={sumPhono} />
                          </td>
                          {isEditing && <td></td>}
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Actions & Bouton d'ajout */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div>
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => handleAddParty(contract.id)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-primary/50 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Ajouter un ayant droit</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isPending ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleValidate(contract, false)}
                            className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-500/20"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Rejeter l&apos;extraction
                          </button>
                          <button
                            type="button"
                            onClick={() => handleValidate(contract, true)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Valider & Enregistrer au Catalogue
                          </button>
                        </>
                      ) : isEditing ? (
                        <button
                          type="button"
                          onClick={() => handleValidate(contract, true)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Enregistrer les modifications
                        </button>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mr-1">
                            <ShieldAlert className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Validé (⊘ L2)</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleExportContractCwr(contract)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors cursor-pointer"
                            title="Exporter les œuvres de ce contrat au format CWR v2.1 officiel pour dépôt SACEM"
                          >
                            <FileCode2 className="h-3.5 w-3.5" />
                            <span>Exporter CWR (.V21 SACEM)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportContractXlsx(contract)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 transition-colors cursor-pointer"
                            title="Exporter un tableau Excel (.xlsx) lisible des œuvres, codes IPI et clés DEP/DRM/SYNC/PHONO"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                            <span>Exporter Visibilité (.xlsx)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modale de confirmation de suppression de contrat */}
      <ConfirmDeleteModal
        isOpen={!!contractToDelete}
        onClose={() => setContractToDelete(null)}
        onConfirm={handleConfirmDeleteContract}
        title="Supprimer le contrat d'édition"
        itemName={contractToDelete ? `${contractToDelete.contract_reference} — ${contractToDelete.counterparty_name}` : ""}
        description="Cette action supprimera définitivement le contrat ainsi que ses comptes d'avances récupérables associés. Les œuvres enregistrées au catalogue resteront conservées. Cette opération est irréversible."
        confirmText="Supprimer le contrat"
        isDeleting={isDeletingContract}
      />

      {/* Barre d'action flottante de sélection multiple (poubelle en bas) */}
      {selectedContractIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full border border-slate-700 bg-slate-900/95 px-5 py-2.5 text-xs font-medium text-white shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2 pr-2 border-r border-slate-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {selectedContractIds.length}
            </span>
            <span>contrat(s) sélectionné(s)</span>
          </div>

          <button
            type="button"
            onClick={() => setIsBatchDeleteModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-rose-600/90 hover:bg-rose-600 px-3.5 py-1 text-xs font-semibold text-white shadow transition-colors"
            title="Supprimer les contrats sélectionnés"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Supprimer ({selectedContractIds.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedContractIds([])}
            className="text-xs text-slate-400 hover:text-white underline pl-1"
          >
            Tout désélectionner
          </button>
        </div>
      )}

      {/* Modale de confirmation de suppression groupée de contrats */}
      <ConfirmDeleteModal
        isOpen={isBatchDeleteModalOpen}
        onClose={() => setIsBatchDeleteModalOpen(false)}
        onConfirm={handleConfirmBatchDeleteContracts}
        title={`Supprimer ${selectedContractIds.length} contrat(s) d'édition`}
        description="Cette action supprimera définitivement les contrats d'édition sélectionnés ainsi que leurs registres d'avances associés. Les œuvres enregistrées au catalogue resteront conservées. Cette opération est irréversible."
        confirmText={`Supprimer définitivement (${selectedContractIds.length})`}
        isDeleting={isBatchDeleting}
        itemName={
          <ul className="list-disc list-inside space-y-0.5 text-xs">
            {contracts
              .filter((c) => selectedContractIds.includes(c.id))
              .slice(0, 6)
              .map((c) => (
                <li key={c.id} className="truncate">
                  <strong>{c.contract_reference}</strong> — {c.counterparty_name} ({c.work_titles.length} œuvre{c.work_titles.length > 1 ? "s" : ""})
                </li>
              ))}
            {selectedContractIds.length > 6 && (
              <li className="text-muted-foreground italic">
                ... et {selectedContractIds.length - 6} autre(s) contrat(s)
              </li>
            )}
          </ul>
        }
      />

      {/* Modale Ingestion SACEM Contrats Généraux CGP1 / .csv */}
      {isCgp1ModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Importer Contrats SACEM (CGP1 / .csv)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Ingestion des contrats généraux d&apos;édition & sous-édition SACEM
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCgp1ModalOpen(false);
                  setCgp1File(null);
                  setCgp1Report(null);
                }}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="text-xs text-muted-foreground space-y-2 bg-muted/40 p-3.5 rounded-xl border">
              <p>
                Ce module analyse soit un <strong>fichier SACEM CGP1 Détail</strong> (format officiel à colonnes fixes avec enregistrements 30, 31 et 40), soit un <strong>fichier CSV</strong> listant vos contrats d&apos;édition générale.
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px]">
                <li>Reconnaissance automatique des numéros de contrats SACEM et codes CWR</li>
                <li>Création ou mise à jour instantanée dans la liasse contractuelle</li>
                <li>Synchronisation automatique des ayants droit au Répertoire</li>
              </ul>
            </div>

            {/* Zone de dépôt / sélection de fichier */}
            <div className="rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors p-6 text-center space-y-3 bg-muted/20">
              <input
                type="file"
                id="cgp1-file-input"
                accept=".txt,.cgp1,.csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setCgp1File(f);
                    setCgp1Report(null);
                  }
                }}
                className="hidden"
              />
              <label
                htmlFor="cgp1-file-input"
                className="cursor-pointer flex flex-col items-center justify-center space-y-2"
              >
                <FileText className="h-8 w-8 text-primary/70" />
                <span className="text-xs font-semibold text-foreground">
                  {cgp1File ? cgp1File.name : "Cliquez ou glissez-déposez votre fichier SACEM (.txt, .cgp1, .csv)"}
                </span>
                {cgp1File && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {(cgp1File.size / 1024).toFixed(1)} Ko
                  </span>
                )}
              </label>
            </div>

            {/* Rapport d'importation */}
            {cgp1Report && (
              <div className="rounded-xl border bg-emerald-500/10 border-emerald-500/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Rapport d&apos;ingestion SACEM :</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="bg-background/80 rounded-lg p-2 border">
                    <div className="text-base font-bold text-foreground">
                      {cgp1Report.created_contracts_count}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Créés</div>
                  </div>
                  <div className="bg-background/80 rounded-lg p-2 border">
                    <div className="text-base font-bold text-foreground">
                      {cgp1Report.updated_contracts_count}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Mis à jour</div>
                  </div>
                  <div className="bg-background/80 rounded-lg p-2 border">
                    <div className="text-base font-bold text-foreground">
                      {cgp1Report.synchronized_parties_count}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Ayants droit</div>
                  </div>
                </div>
                {cgp1Report.contract_references.length > 0 && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono pt-1 truncate">
                    Contrats : {cgp1Report.contract_references.join(", ")}
                  </p>
                )}
                {cgp1Report.errors.length > 0 && (
                  <div className="text-[11px] text-rose-600 space-y-0.5 pt-1">
                    {cgp1Report.errors.map((err, i) => (
                      <p key={i}>⚠️ {err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Boutons d'action */}
            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={() => {
                  setIsCgp1ModalOpen(false);
                  setCgp1File(null);
                  setCgp1Report(null);
                }}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                Fermer
              </button>
              <button
                type="button"
                disabled={!cgp1File || isImportingCgp1}
                onClick={handleImportCgp1}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
              >
                {isImportingCgp1 ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Ingestion en cours...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-3.5 w-3.5" />
                    <span>Lancer l&apos;ingestion</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Liaison Contrat <-> Œuvres du Catalogue */}
      {contractToLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Lier le contrat aux œuvres du catalogue
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {contractToLink.contract_reference} • {contractToLink.counterparty_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setContractToLink(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Choix du mode de liaison */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setLinkMode("WORK_GROUP")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  linkMode === "WORK_GROUP"
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                  <FolderKanban className="h-4 w-4 text-primary" />
                  <span>Projet / Groupe</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Lier à toutes les œuvres d&apos;un projet audiovisuel ou album
                </p>
              </button>

              <button
                type="button"
                onClick={() => setLinkMode("RIGHT_HOLDER_MATCH")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  linkMode === "RIGHT_HOLDER_MATCH"
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                  <Users className="h-4 w-4 text-primary" />
                  <span>Ayant Droit</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Lier aux œuvres où l&apos;ayant droit est crédité au catalogue
                </p>
              </button>

              <button
                type="button"
                onClick={() => setLinkMode("SPECIFIC_WORKS")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  linkMode === "SPECIFIC_WORKS"
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                  <Music className="h-4 w-4 text-primary" />
                  <span>Sélection Manuelle</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Choisir directement les œuvres dans une liste de recherche
                </p>
              </button>
            </div>

            {/* Contenu spécifique au mode choisi */}
            {linkMode === "WORK_GROUP" && (
              <div className="space-y-3 bg-muted/30 p-4 rounded-xl border">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Sélectionner le projet audiovisuel / album :
                  </label>
                  {availableGroups.length > 0 ? (
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-semibold"
                    >
                      {availableGroups.map((grp) => (
                        <option key={grp.id} value={grp.id}>
                          {grp.name} ({grp.group_type}) — {grp.works_count} œuvre(s)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Aucun groupe ou projet créé. Créez-en un depuis l&apos;onglet Catalogue ou utilisez un autre mode de liaison.
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Préfixe de Cotage (optionnel) :
                  </label>
                  <input
                    type="text"
                    value={cotagePrefix}
                    onChange={(e) => setCotagePrefix(e.target.value)}
                    placeholder="Ex: KFC, CLARA, ALB"
                    className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Attribue automatiquement un cotage séquentiel (ex: KFC-001) aux œuvres sans cotage.
                  </p>
                </div>
              </div>
            )}

            {linkMode === "RIGHT_HOLDER_MATCH" && (
              <div className="space-y-3 bg-muted/30 p-4 rounded-xl border">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Ayant droit cocontractant cible (Nom ou IPI) :
                  </label>
                  <input
                    type="text"
                    value={selectedHolder}
                    onChange={(e) => setSelectedHolder(e.target.value)}
                    placeholder="Ex: Sami Benali ou 00398765432"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-semibold"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Toutes les œuvres du catalogue mentionnant cet ayant droit recevront la référence contractuelle <strong>{contractToLink.contract_reference}</strong>.
                  </p>
                </div>
                {contractToLink.parties.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-muted-foreground">Suggestions du contrat :</span>
                    {contractToLink.parties.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedHolder(p.party_name)}
                        className="rounded-md border bg-background px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/10"
                      >
                        {p.party_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {linkMode === "SPECIFIC_WORKS" && (
              <div className="space-y-3 bg-muted/30 p-4 rounded-xl border">
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={worksSearch}
                      onChange={(e) => setWorksSearch(e.target.value)}
                      placeholder="Rechercher une œuvre par titre, ISWC ou code SACEM..."
                      className="w-full rounded-lg border bg-background pl-8 pr-3 py-1.5 text-xs"
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-primary shrink-0">
                    {selectedWorkIds.length} sélectionnée(s)
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1 pr-1 border rounded-lg p-2 bg-background">
                  {allWorks
                    .filter((w) => {
                      if (!worksSearch.trim()) return true;
                      const q = worksSearch.toLowerCase();
                      return (
                        w.title.toLowerCase().includes(q) ||
                        (w.iswc && w.iswc.toLowerCase().includes(q)) ||
                        (w.sacem_work_code && w.sacem_work_code.toLowerCase().includes(q))
                      );
                    })
                    .slice(0, 100)
                    .map((work) => {
                      const isChecked = selectedWorkIds.includes(work.id);
                      return (
                        <div
                          key={work.id}
                          onClick={() => {
                            setSelectedWorkIds((prev) =>
                              isChecked ? prev.filter((id) => id !== work.id) : [...prev, work.id]
                            );
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                            isChecked ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isChecked ? (
                              <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <div>
                              <span className="font-semibold text-foreground">{work.title}</span>
                              {work.sacem_work_code && (
                                <span className="ml-2 text-[10px] text-muted-foreground font-mono">
                                  SACEM: {work.sacem_work_code}
                                </span>
                              )}
                            </div>
                          </div>
                          {work.contract_reference && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              Actuel: {work.contract_reference}
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Boutons d'action */}
            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setContractToLink(null)}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={
                  isLinking ||
                  (linkMode === "WORK_GROUP" && !selectedGroupId) ||
                  (linkMode === "RIGHT_HOLDER_MATCH" && !selectedHolder.trim()) ||
                  (linkMode === "SPECIFIC_WORKS" && selectedWorkIds.length === 0)
                }
                onClick={handleExecuteLink}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
              >
                {isLinking ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Liaison en cours...</span>
                  </>
                ) : (
                  <>
                    <Link2 className="h-3.5 w-3.5" />
                    <span>Lier au catalogue</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Créer un groupe d'œuvres à partir de ce contrat */}
      {groupModalContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                <h2 className="text-sm font-bold">Créer un groupe d&apos;œuvres</h2>
              </div>
              <button
                type="button"
                onClick={() => setGroupModalContract(null)}
                className="rounded-md p-1 hover:bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Ce contrat contient <strong>{groupModalContract.work_titles?.length || 0} œuvre(s)</strong>.
              Créez un projet ou album pour les regrouper automatiquement dans le catalogue.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Nom du projet / programme ou album *
                </label>
                <input
                  type="text"
                  value={groupNameInput}
                  onChange={(e) => setGroupNameInput(e.target.value)}
                  placeholder="Ex: ERICA (Saison 2) ou Score Original"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-semibold focus:border-primary focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Type de groupe
                </label>
                <select
                  value={groupTypeInput}
                  onChange={(e) => setGroupTypeInput(e.target.value as "AUDIOVISUAL" | "ALBUM")}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-hidden"
                >
                  <option value="AUDIOVISUAL">🎬 Audiovisuel (Série, Téléfilm, Film, Docu)</option>
                  <option value="ALBUM">💿 Album / EP Commercial</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setGroupModalContract(null)}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isCreatingGroup || !groupNameInput.trim()}
                onClick={handleCreateGroupFromContract}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
              >
                {isCreatingGroup ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Création...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    <span>Créer et rattacher les œuvres</span>
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