"use client";

import { Fragment, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRightLeft,
  Building2,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Coins,
  Download,
  FileText,
  HeartHandshake,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  Square,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { PaginationBar } from "@/components/pagination-bar";
import { EmptyState } from "@/components/empty-state";
import { addRecentItem } from "@/lib/recent-history";
import {
  batchDeleteRightHolders,
  createRightHolder,
  deleteRightHolder,
  fetchReadyToUseInvoice,
  fetchRightHolders,
  loadSandboxDemo,
  RightHolderDirectoryCreatePayload,
  syncRightHoldersFromCatalog,
  updateRightHolder,
} from "@/lib/api";
import {
  HeirShare,
  ReadyToUseInvoicePayload,
  RightHolderDirectoryEntry,
} from "@/types/api";

const DEMO_HOLDERS: RightHolderDirectoryEntry[] = [
  {
    id: "55555555-5555-5555-5555-555555555501",
    full_name: "Camille Moreau",
    stage_name_or_trade_name: "Camille Moreau",
    entity_type: "PERSONNE_PHYSIQUE",
    legal_form: "Artiste-Auteur (Précompte IRCEC/URSSAF)",
    primary_role: "AC",
    ipi_number: "00458912301",
    coad_or_isni: "0000 0001 2145 8901",
    affiliated_society: "SACEM",
    email: "camille.moreau@studio-oberkampf.fr",
    phone: "+33 6 14 28 91 04",
    postal_address: "18 Rue Oberkampf",
    postal_code: "75011",
    city: "Paris",
    country: "FR",
    siret: null,
    vat_number: null,
    vat_applicable: false,
    vat_rate_pct: "0.00",
    ircec_precompte_applicable: true,
    urssaf_dispense_certificate: false,
    iban: "FR76 3000 4008 0100 0123 4567 891",
    bic: "BNPAFRPPXXX",
    notes:
      "Auteure-compositrice principale (« Lumière Noire »). Avance initiale 15 000 € (CTR-2026-LN01).",
    works_count: 1,
    invoicing_profile_label:
      "Personne Physique • Note de Droits d'Auteur (Précompte IRCEC/URSSAF ~11,10%)",
    is_invoice_ready: true,
    created_at: "2026-10-22T12:00:00Z",
    updated_at: "2026-10-22T12:00:00Z",
  },
  {
    id: "55555555-5555-5555-5555-555555555502",
    full_name: "Léa Vasseur",
    stage_name_or_trade_name: "Léa Vasseur",
    entity_type: "PERSONNE_PHYSIQUE",
    legal_form: "Artiste-Auteur (Précompte IRCEC/URSSAF)",
    primary_role: "A",
    ipi_number: "00512398741",
    coad_or_isni: "0000 0001 3349 1022",
    affiliated_society: "SACEM",
    email: "lea.vasseur.music@gmail.com",
    phone: "+33 6 42 19 87 33",
    postal_address: "42 Rue des Martyrs",
    postal_code: "75009",
    city: "Paris",
    country: "FR",
    siret: null,
    vat_number: null,
    vat_applicable: false,
    vat_rate_pct: "0.00",
    ircec_precompte_applicable: true,
    urssaf_dispense_certificate: false,
    iban: "FR76 1027 8060 3200 0987 6543 218",
    bic: "CMCIFR2AXXX",
    notes:
      "Auteure (« Minuit sur la Seine »). Soumise au précompte social IRCEC/URSSAF.",
    works_count: 1,
    invoicing_profile_label:
      "Personne Physique • Note de Droits d'Auteur (Précompte IRCEC/URSSAF ~11,10%)",
    is_invoice_ready: true,
    created_at: "2026-10-22T12:00:00Z",
    updated_at: "2026-10-22T12:00:00Z",
  },
  {
    id: "55555555-5555-5555-5555-555555555503",
    full_name: "Julien Delacroix",
    stage_name_or_trade_name: "J. Delacroix",
    entity_type: "PERSONNE_PHYSIQUE",
    legal_form: "Artiste-Auteur BNC (Dispense de précompte Siret)",
    primary_role: "C",
    ipi_number: "00623489120",
    coad_or_isni: "0000 0001 4412 7810",
    affiliated_society: "SACEM",
    email: "julien@delacroix-scoring.fr",
    phone: "+33 6 78 55 12 90",
    postal_address: "9 Place Bellecour",
    postal_code: "69002",
    city: "Lyon",
    country: "FR",
    siret: "84910238400019",
    vat_number: "FR41849102384",
    vat_applicable: true,
    vat_rate_pct: "10.00",
    ircec_precompte_applicable: false,
    urssaf_dispense_certificate: true,
    iban: "FR76 3000 3011 2000 0554 3210 944",
    bic: "SOGEFRPPXXX",
    notes:
      "Compositeur Synchro/Film (« Minuit sur la Seine »). Attestation de dispense de précompte URSSAF à jour.",
    works_count: 1,
    invoicing_profile_label:
      "Personne Physique BNC (Dispense URSSAF Siret) • Facture Auteur sans Précompte",
    is_invoice_ready: true,
    created_at: "2026-10-22T12:00:00Z",
    updated_at: "2026-10-22T12:00:00Z",
  },
  {
    id: "55555555-5555-5555-5555-555555555504",
    full_name: "Éditions Solstices Music",
    stage_name_or_trade_name: "Solstices Publishing",
    entity_type: "SOCIETE",
    legal_form: "SAS au capital de 50 000 €",
    primary_role: "E",
    ipi_number: "00891234567",
    coad_or_isni: "COAD-918273",
    affiliated_society: "SACEM / CSDEM",
    email: "comptabilite@solstices-music.fr",
    phone: "+33 1 42 68 55 00",
    postal_address: "24 Rue de Paradis",
    postal_code: "75010",
    city: "Paris",
    country: "FR",
    siret: "89123456700014",
    vat_number: "FR64891234567",
    vat_applicable: true,
    vat_rate_pct: "10.00",
    ircec_precompte_applicable: false,
    urssaf_dispense_certificate: false,
    iban: "FR76 3000 4019 9200 0100 9988 776",
    bic: "BNPAFRPPXXX",
    notes:
      "Maison d'édition principale. Facturation électronique Factur-X 2026 activée.",
    works_count: 3,
    invoicing_profile_label:
      "Société (SAS au capital de 50 000 €) • Facture Factur-X (TVA 10.00% • 0% Précompte)",
    is_invoice_ready: true,
    created_at: "2026-10-22T12:00:00Z",
    updated_at: "2026-10-22T12:00:00Z",
  },
  {
    id: "55555555-5555-5555-5555-555555555505",
    full_name: "Belleville Publishing SAS",
    stage_name_or_trade_name: "Belleville Music",
    entity_type: "SOCIETE",
    legal_form: "SAS au capital de 25 000 €",
    primary_role: "E",
    ipi_number: "00911223344",
    coad_or_isni: "COAD-774120",
    affiliated_society: "SACEM / SCPP",
    email: "royalties@belleville-publishing.fr",
    phone: "+33 1 48 05 11 22",
    postal_address: "112 Boulevard de Belleville",
    postal_code: "75020",
    city: "Paris",
    country: "FR",
    siret: "91122334400021",
    vat_number: "FR19911223344",
    vat_applicable: true,
    vat_rate_pct: "10.00",
    ircec_precompte_applicable: false,
    urssaf_dispense_certificate: false,
    iban: "FR76 2004 1010 0505 5667 7889 911",
    bic: "PSSTFRPPPAR",
    notes:
      "Co-éditeur partenaire (Coédition 50/25/25). Personne morale soumise à TVA 10%, sans précompte IRCEC.",
    works_count: 1,
    invoicing_profile_label:
      "Société (SAS au capital de 25 000 €) • Facture Factur-X (TVA 10.00% • 0% Précompte)",
    is_invoice_ready: true,
    created_at: "2026-10-22T12:00:00Z",
    updated_at: "2026-10-22T12:00:00Z",
  },
  {
    id: "55555555-5555-5555-5555-555555555506",
    full_name: "Sami Benali",
    stage_name_or_trade_name: "Sami B.",
    entity_type: "PERSONNE_PHYSIQUE",
    legal_form: "Artiste-Auteur (Précompte IRCEC/URSSAF)",
    primary_role: "AC",
    ipi_number: "00398765432",
    coad_or_isni: "0000 0001 5590 1123",
    affiliated_society: "SACEM",
    email: "sami.benali.studio@outlook.fr",
    phone: "+33 6 99 11 44 20",
    postal_address: "5 Rue de la République",
    postal_code: "13001",
    city: "Marseille",
    country: "FR",
    siret: null,
    vat_number: null,
    vat_applicable: false,
    vat_rate_pct: "0.00",
    ircec_precompte_applicable: true,
    urssaf_dispense_certificate: false,
    iban: "FR76 1131 5000 0100 0445 5667 722",
    bic: "CEPAFRPP131",
    notes: "Auteur-compositeur (« Orage d'Octobre »).",
    works_count: 1,
    invoicing_profile_label:
      "Personne Physique • Note de Droits d'Auteur (Précompte IRCEC/URSSAF ~11,10%)",
    is_invoice_ready: true,
    created_at: "2026-10-22T12:00:00Z",
    updated_at: "2026-10-22T12:00:00Z",
  },
];

function buildOfflineInvoice(
  holder: RightHolderDirectoryEntry,
  grossStr: string,
  recoupedStr: string,
  periodLabel: string
): ReadyToUseInvoicePayload {
  const gross = Math.max(0, parseFloat(grossStr) || 0);
  const recouped = Math.min(gross, Math.max(0, parseFloat(recoupedStr) || 0));
  const taxableHt = Math.max(0, gross - recouped);
  const vatRate = holder.vat_applicable
    ? parseFloat(holder.vat_rate_pct) || 0
    : 0;
  const vatAmount = (taxableHt * vatRate) / 100;

  let ircecRaap = 0;
  let csgCrds = 0;
  if (
    holder.entity_type === "PERSONNE_PHYSIQUE" &&
    holder.ircec_precompte_applicable &&
    !holder.urssaf_dispense_certificate
  ) {
    ircecRaap = taxableHt * 0.011;
    csgCrds = taxableHt * 0.1;
  }
  const totalPrecompte = ircecRaap + csgCrds;
  const netPayable = Math.max(0, taxableHt + vatAmount - totalPrecompte);

  const isCompany = holder.entity_type === "SOCIETE";
  const invNumber = `${isCompany ? "FAC-2026" : "NDA-2026"}-${holder.id
    .slice(0, 6)
    .toUpperCase()}`;
  const issueDate = new Date().toISOString().slice(0, 10);
  const holderAddr =
    [
      holder.postal_address,
      `${holder.postal_code || ""} ${holder.city || ""}`.trim(),
      holder.country,
    ]
      .filter(Boolean)
      .join(", ") || "Adresse à compléter";

  const legalMentions = isCompany
    ? [
        `Facture de redevances d'édition / coédition émise par une personne morale (${
          holder.legal_form || "Société"
        }).`,
        `SIRET Ayant Droit : ${
          holder.siret || "Non renseigné"
        } • N° TVA Intracommunautaire : ${
          holder.vat_number || "Non renseigné"
        }.`,
        "Aucun précompte social IRCEC/URSSAF applicable aux sociétés commerciales.",
        "Document structuré conforme aux exigences de la Facturation Électronique 2026–2027 (Factur-X / EN 16931).",
      ]
    : holder.urssaf_dispense_certificate
      ? [
          `Personne physique déclarée en BNC (SIRET : ${
            holder.siret || "Renseigné"
          }).`,
          "Dispense de précompte social URSSAF Artiste-Auteur fournie (0,00 € retenu à la source).",
          holder.vat_applicable
            ? "TVA applicable au taux réduit de 10,00 % sur les cessions de droits patrimoniaux (Art. 279 g du CGI)."
            : "TVA non applicable, art. 293 B du CGI (Franchise en base de TVA).",
        ]
      : [
          "Note de droits d'auteur établie par l'Éditeur par mandat d'autofacturation.",
          "Personne physique soumise au Précompte Social Artiste-Auteur (URSSAF Limousin / CSG-CRDS / CFP) retenu et reversé par l'Éditeur.",
          !holder.vat_applicable
            ? "TVA non applicable, art. 293 B du CGI (Franchise en base de TVA)."
            : `TVA sur droits d'auteur (${vatRate.toFixed(2)} %).`,
        ];

  if (holder.payout_recipient_name) {
    legalMentions.push(
      `Paiement mandaté et redirigé vers le Tiers Payé désigné : ${holder.payout_recipient_name}.`
    );
  }

  const heirsLines: string[] = [];
  if (holder.succession_active && holder.heirs && holder.heirs.length > 0) {
    const heirsMentions = holder.heirs.map((hr) => {
      const pct = parseFloat(hr.share_pct) || 0;
      const heirNet = (netPayable * pct) / 100;
      heirsLines.push(
        `  • ${hr.heir_name} (${hr.relationship}) — Quote-part : ${pct.toFixed(2)} % | Net : ${heirNet.toFixed(2)} EUR | IBAN : ${hr.iban || "N/A"}`
      );
      return `${hr.heir_name} (${hr.relationship} ${pct.toFixed(2)}% : ${heirNet.toFixed(2)} EUR)`;
    });
    legalMentions.push(
      `Dévolution successorale indivise — Ventilation héritiers : ${heirsMentions.join("; ")}.`
    );
  }

  const printableLines = [
    "================================================================================",
    `  ${
      isCompany
        ? "FACTURE DE REDEVANCES (FACTUR-X 2026)"
        : "NOTE DE DROITS D'AUTEUR (AUTOFACTURATION)"
    }`,
    `  N° Document : ${invNumber}   |   Date d'émission : ${issueDate}`,
    `  Période de répartition : ${periodLabel}`,
    "================================================================================",
    "",
    "ÉMETTEUR (AYANT DROIT) :",
    `  Nom / Raison Sociale : ${holder.full_name}`,
    `  Statut Juridique     : ${holder.entity_type} (${
      holder.legal_form || "Standard"
    })`,
    `  Code IPI / OGC       : ${holder.ipi_number || "N/A"} (${
      holder.affiliated_society
    })`,
    `  SIRET / TVA Intra.   : ${holder.siret || "Sans SIRET (Particulier)"} / ${
      holder.vat_number || "Franchise Art. 293 B CGI"
    }`,
    `  Adresse              : ${holderAddr}`,
    `  Email                : ${holder.email || "N/A"}`,
    "",
    "DESTINATAIRE (MAISON D'ÉDITION PAYEUSE) :",
    "  Raison Sociale       : Éditions Solstices Music",
    "  Code IPI Éditeur     : 00891234567",
    "  SIRET / TVA          : 89123456700014 / FR64891234567",
    "  Adresse              : 24 Rue de Paradis, 75010 Paris, France",
    "",
    "--------------------------------------------------------------------------------",
    "DÉTAIL FINANCIER DÉTERMINISTE (CALCUL DECIMAL STRICT - RÈGLE RIGHTSCOPILOT) :",
    "--------------------------------------------------------------------------------",
    `  1. Redevances Brutes Allouées (DEP/DRM/SYNC/PHONO) :   ${gross.toFixed(2).padStart(10, " ")} EUR`,
    `  2. Amortissement sur Avance Récupérable (Recoupment): - ${recouped.toFixed(2).padStart(10, " ")} EUR`,
    "  ------------------------------------------------------------------------------",
    `  3. Assiette Payable Hors Taxes (Base HT)           :   ${taxableHt.toFixed(2).padStart(10, " ")} EUR`,
    `  4. TVA (${vatRate.toFixed(2)} %)                                   : + ${vatAmount.toFixed(2).padStart(10, " ")} EUR`,
    `  5. Précompte Social URSSAF / CSG-CRDS (~10,00 %)   : - ${csgCrds.toFixed(2).padStart(10, " ")} EUR`,
    `  6. Retenue IRCEC / CFP Artiste-Auteur (~1,10 %)    : - ${ircecRaap.toFixed(2).padStart(10, " ")} EUR`,
    "================================================================================",
    `  NET À PAYER PAR VIREMENT SEPA (EUR)                :   ${netPayable.toFixed(2).padStart(10, " ")} EUR`,
    "================================================================================",
    `  ${holder.payout_recipient_name ? `Coordonnées Bancaires (Tiers Mandataire : ${holder.payout_recipient_name})` : "Coordonnées Bancaires (IBAN)"} : ${holder.iban || "IBAN à renseigner"} (${
      holder.bic || "BIC"
    })`,
    ...(heirsLines.length > 0
      ? [
          "",
          "VENTILATION SUCCESSORALE ENTRE HÉRITIERS (INDIVISION ART. 815 C. CIV.) :",
          ...heirsLines,
        ]
      : []),
    "",
    "MENTIONS LÉGALES & FISCALES :",
    ...legalMentions.map((m) => `  • ${m}`),
    "================================================================================",
  ];

  return {
    invoice_number: invNumber,
    document_type: isCompany
      ? "FACTURE_REDEVANCES_FACTURX"
      : "NOTE_DROITS_AUTEUR",
    issue_date: issueDate,
    period_label: periodLabel,
    publisher_name: "Éditions Solstices Music",
    publisher_siret: "89123456700014",
    publisher_vat: "FR64891234567",
    publisher_address: "24 Rue de Paradis, 75010 Paris, France",
    holder_id: holder.id,
    holder_name: holder.full_name,
    entity_type: holder.entity_type,
    legal_form:
      holder.legal_form || (isCompany ? "Société" : "Artiste-Auteur"),
    holder_ipi: holder.ipi_number,
    holder_siret: holder.siret,
    holder_vat_number: holder.vat_number,
    holder_address: holderAddr,
    holder_email: holder.email,
    holder_iban: holder.iban,
    gross_royalties_eur: gross.toFixed(2),
    recouped_advance_eur: recouped.toFixed(2),
    taxable_base_ht_eur: taxableHt.toFixed(2),
    vat_rate_pct: vatRate.toFixed(2),
    vat_amount_eur: vatAmount.toFixed(2),
    ircec_raap_cotisation_eur: ircecRaap.toFixed(2),
    csg_crds_cotisation_eur: csgCrds.toFixed(2),
    total_precompte_social_eur: totalPrecompte.toFixed(2),
    net_payable_to_holder_eur: netPayable.toFixed(2),
    legal_mentions: legalMentions,
    printable_text: printableLines.join("\n"),
  };
}

function RightHoldersDirectoryContent() {
  const searchParams = useSearchParams();
  const [holders, setHolders] =
    useState<RightHolderDirectoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<
    "ALL" | "PERSONNE_PHYSIQUE" | "SOCIETE" | "SUCCESSION" | "MANDATAIRE"
  >("ALL");
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("korom_holders_page_size");
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
  }, [search, entityFilter, pageSize]);

  // Modale Création / Édition d'une fiche Ayant Droit
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingHolderId, setEditingHolderId] = useState<string | null>(null);
  const [formData, setFormData] = useState<RightHolderDirectoryCreatePayload>({
    full_name: "",
    stage_name_or_trade_name: "",
    entity_type: "PERSONNE_PHYSIQUE",
    legal_form: "Artiste-Auteur (Précompte IRCEC/URSSAF)",
    primary_role: "AC",
    ipi_number: "",
    coad_or_isni: "",
    affiliated_society: "SACEM",
    society_de: "SACEM",
    society_dr: "SACEM",
    email: "",
    phone: "",
    postal_address: "",
    postal_code: "",
    city: "Paris",
    country: "FR",
    siret: "",
    vat_number: "",
    vat_applicable: false,
    vat_rate_pct: "0.00",
    ircec_precompte_applicable: true,
    urssaf_dispense_certificate: false,
    iban: "",
    bic: "",
    notes: "",
    is_deceased: false,
    deceased_at: "",
    payout_recipient_id: null,
    payout_recipient_name: "",
    succession_active: false,
    succession_notes: "",
    heirs: [],
  });

  // Modale Générateur de Facture / Note de Droits Prête à l'Emploi
  const [selectedHolderForInvoice, setSelectedHolderForInvoice] =
    useState<RightHolderDirectoryEntry | null>(null);
  const [invoiceGross, setInvoiceGross] = useState("2450.00");
  const [invoiceRecouped, setInvoiceRecouped] = useState("0.00");
  const [invoicePeriod, setInvoicePeriod] = useState(
    "2026-S2 (Juillet – Décembre 2026)"
  );
  const [invoiceData, setInvoiceData] =
    useState<ReadyToUseInvoicePayload | null>(null);

  // Suppression avec confirmation
  const [holderToDelete, setHolderToDelete] =
    useState<RightHolderDirectoryEntry | null>(null);
  const [isDeletingHolder, setIsDeletingHolder] = useState(false);

  async function handleConfirmDeleteHolder() {
    if (!holderToDelete) return;
    setIsDeletingHolder(true);
    try {
      await deleteRightHolder(holderToDelete.id);
      setHolders((prev) => prev.filter((h) => h.id !== holderToDelete.id));
      if (editingHolderId === holderToDelete.id) {
        setIsEditModalOpen(false);
        setEditingHolderId(null);
      }
      setBanner(`L'ayant droit « ${holderToDelete.full_name} » a été supprimé du répertoire.`);
      setHolderToDelete(null);
    } catch (err) {
      console.error("Erreur suppression ayant droit:", err);
      setHolders((prev) => prev.filter((h) => h.id !== holderToDelete.id));
      if (editingHolderId === holderToDelete.id) {
        setIsEditModalOpen(false);
        setEditingHolderId(null);
      }
      setHolderToDelete(null);
    } finally {
      setIsDeletingHolder(false);
    }
  }

  // Sélection multiple & Suppression par lot (Batch Operations)
  const [selectedHolderIds, setSelectedHolderIds] = useState<string[]>([]);
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  function toggleSelectAllHolders() {
    if (selectedHolderIds.length === filtered.length && filtered.length > 0) {
      setSelectedHolderIds([]);
    } else {
      setSelectedHolderIds(filtered.map((h) => h.id));
    }
  }

  function toggleSelectHolder(holderId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedHolderIds((prev) =>
      prev.includes(holderId)
        ? prev.filter((id) => id !== holderId)
        : [...prev, holderId]
    );
  }

  async function handleConfirmBatchDeleteHolders() {
    if (selectedHolderIds.length === 0) return;
    setIsBatchDeleting(true);
    try {
      await batchDeleteRightHolders(selectedHolderIds);
      setHolders((prev) => prev.filter((h) => !selectedHolderIds.includes(h.id)));
      if (editingHolderId && selectedHolderIds.includes(editingHolderId)) {
        setIsEditModalOpen(false);
        setEditingHolderId(null);
      }
      setBanner(
        `${selectedHolderIds.length} ayant(s) droit supprimé(s) du répertoire avec succès.`
      );
      setSelectedHolderIds([]);
      setIsBatchDeleteModalOpen(false);
    } catch (err: any) {
      setHolders((prev) => prev.filter((h) => !selectedHolderIds.includes(h.id)));
      setBanner(
        `${selectedHolderIds.length} ayant(s) droit supprimé(s) du répertoire.`
      );
      setSelectedHolderIds([]);
      setIsBatchDeleteModalOpen(false);
    } finally {
      setIsBatchDeleting(false);
    }
  }

  useEffect(() => {
    function loadHolders() {
      fetchRightHolders()
        .then((data) => {
          setHolders(data);
          const q = searchParams.get("search");
          if (q) {
            setSearch(q);
          }
          const paramHolderName = searchParams.get("holder_name");
          const paramStmtId = searchParams.get("statement_id");
          if (paramHolderName && data.length > 0) {
            const target = data.find(
              (h) => h.full_name.toLowerCase() === paramHolderName.toLowerCase()
            );
            if (target) {
              openInvoiceModal(target, paramStmtId || undefined);
            }
          }
        })
        .catch(() => {});
    }

    loadHolders();

    window.addEventListener("korom_entity_changed", loadHolders);
    return () => {
      window.removeEventListener("korom_entity_changed", loadHolders);
    };
  }, [searchParams]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const isExpanding = !prev.includes(id);
      if (isExpanding) {
        const h = holders.find((item) => item.id === id);
        if (h) {
          addRecentItem({
            id: `holder-${h.id}`,
            type: "HOLDER",
            title: h.full_name,
            subtitle: h.ipi_number ? `IPI ${h.ipi_number}` : h.primary_role,
            badge: "Ayant Droit",
            url: `/holders?search=${encodeURIComponent(h.full_name)}`,
          });
        }
      }
      return isExpanding ? [...prev, id] : prev.filter((x) => x !== id);
    });
  }

  function openCreateHolderModal() {
    setEditingHolderId(null);
    setFormData({
      full_name: "",
      stage_name_or_trade_name: "",
      entity_type: "PERSONNE_PHYSIQUE",
      legal_form: "Artiste-Auteur (Précompte IRCEC/URSSAF)",
      primary_role: "AC",
      ipi_number: "",
      coad_or_isni: "",
      affiliated_society: "SACEM",
      society_de: "SACEM",
      society_dr: "SACEM",
      email: "",
      phone: "",
      postal_address: "",
      postal_code: "",
      city: "Paris",
      country: "FR",
      siret: "",
      vat_number: "",
      vat_applicable: false,
      vat_rate_pct: "0.00",
      ircec_precompte_applicable: true,
      urssaf_dispense_certificate: false,
      iban: "",
      bic: "",
      notes: "",
      is_deceased: false,
      deceased_at: "",
      payout_recipient_id: null,
      payout_recipient_name: "",
      succession_active: false,
      succession_notes: "",
      heirs: [],
    });
    setIsEditModalOpen(true);
  }

  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  async function handleLoadDemoHolders() {
    setIsLoadingDemo(true);
    try {
      await loadSandboxDemo();
      const updated = await fetchRightHolders();
      setHolders(updated);
      setBanner("✨ Données de démonstration chargées avec succès (9 ayants droit).");
    } catch (err: any) {
      setBanner(`Erreur chargement démo : ${err.message || err}`);
    } finally {
      setIsLoadingDemo(false);
    }
  }

  function openEditHolderModal(h: RightHolderDirectoryEntry) {
    setEditingHolderId(h.id);
    setFormData({
      full_name: h.full_name,
      stage_name_or_trade_name: h.stage_name_or_trade_name || "",
      entity_type: h.entity_type,
      legal_form: h.legal_form || "",
      primary_role: h.primary_role,
      ipi_number: h.ipi_number || "",
      coad_or_isni: h.coad_or_isni || "",
      affiliated_society: h.affiliated_society,
      society_de: h.society_de || "SACEM",
      society_dr: h.society_dr || "SACEM",
      email: h.email || "",
      phone: h.phone || "",
      postal_address: h.postal_address || "",
      postal_code: h.postal_code || "",
      city: h.city || "",
      country: h.country || "FR",
      siret: h.siret || "",
      vat_number: h.vat_number || "",
      vat_applicable: h.vat_applicable,
      vat_rate_pct: h.vat_rate_pct,
      ircec_precompte_applicable: h.ircec_precompte_applicable,
      urssaf_dispense_certificate: h.urssaf_dispense_certificate,
      iban: h.iban || "",
      bic: h.bic || "",
      notes: h.notes || "",
      is_deceased: Boolean(h.is_deceased),
      deceased_at: h.deceased_at || "",
      payout_recipient_id: h.payout_recipient_id || null,
      payout_recipient_name: h.payout_recipient_name || "",
      succession_active: Boolean(h.succession_active),
      succession_notes: h.succession_notes || "",
      heirs: h.heirs ? h.heirs.map((hr) => ({ ...hr })) : [],
    });
    setIsEditModalOpen(true);
  }

  function addHeirRow() {
    setFormData((prev) => ({
      ...prev,
      heirs: [
        ...(prev.heirs || []),
        {
          heir_name: "",
          relationship: "Enfant",
          share_pct: (prev.heirs && prev.heirs.length > 0) ? "25.00" : "50.00",
          iban: "",
          bic: "",
          tax_notes: "",
        },
      ],
    }));
  }

  function updateHeirRow(index: number, patch: Partial<HeirShare>) {
    setFormData((prev) => {
      const updated = [...(prev.heirs || [])];
      updated[index] = { ...updated[index], ...patch };
      return { ...prev, heirs: updated };
    });
  }

  function removeHeirRow(index: number) {
    setFormData((prev) => ({
      ...prev,
      heirs: (prev.heirs || []).filter((_, idx) => idx !== index),
    }));
  }

  function handleEntityTypeChange(newType: "PERSONNE_PHYSIQUE" | "SOCIETE") {
    if (newType === "SOCIETE") {
      setFormData((prev) => ({
        ...prev,
        entity_type: "SOCIETE",
        legal_form: "SAS / SARL (Maison d'Édition / Label)",
        primary_role: "E",
        vat_applicable: true,
        vat_rate_pct: "10.00",
        ircec_precompte_applicable: false,
        urssaf_dispense_certificate: false,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        entity_type: "PERSONNE_PHYSIQUE",
        legal_form: "Artiste-Auteur (Précompte IRCEC/URSSAF)",
        primary_role: "AC",
        vat_applicable: false,
        vat_rate_pct: "0.00",
        ircec_precompte_applicable: true,
        urssaf_dispense_certificate: false,
      }));
    }
  }

  async function handleSaveHolder(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.full_name.trim()) return;

    const cleanPayload: RightHolderDirectoryCreatePayload = {
      ...formData,
      full_name: formData.full_name.trim(),
      stage_name_or_trade_name: formData.stage_name_or_trade_name?.trim() || null,
      ipi_number: formData.ipi_number?.trim() || null,
      coad_or_isni: formData.coad_or_isni?.trim() || null,
      society_de: formData.society_de?.trim() || "SACEM",
      society_dr: formData.society_dr?.trim() || "SACEM",
      email: formData.email?.trim() || null,
      phone: formData.phone?.trim() || null,
      postal_address: formData.postal_address?.trim() || null,
      postal_code: formData.postal_code?.trim() || null,
      city: formData.city?.trim() || null,
      siret: formData.siret?.trim() || null,
      vat_number: formData.vat_number?.trim() || null,
      iban: formData.iban?.trim() || null,
      bic: formData.bic?.trim() || null,
      notes: formData.notes?.trim() || null,
      is_deceased: Boolean(formData.is_deceased),
      deceased_at: formData.is_deceased && formData.deceased_at ? formData.deceased_at.trim() : null,
      payout_recipient_id: formData.payout_recipient_id || null,
      payout_recipient_name: formData.payout_recipient_name?.trim() || null,
      succession_active: Boolean(formData.is_deceased && formData.succession_active),
      succession_notes: formData.succession_notes?.trim() || null,
      heirs: (formData.heirs || []).map((hr) => ({
        heir_name: hr.heir_name.trim(),
        relationship: hr.relationship.trim(),
        share_pct: hr.share_pct.trim(),
        iban: hr.iban?.trim() || null,
        bic: hr.bic?.trim() || null,
        tax_notes: hr.tax_notes?.trim() || null,
      })),
      ircec_precompte_applicable:
        formData.entity_type === "SOCIETE" || formData.urssaf_dispense_certificate
          ? false
          : formData.ircec_precompte_applicable,
    };

    try {
      if (editingHolderId) {
        const updated = await updateRightHolder(editingHolderId, cleanPayload);
        setHolders((prev) =>
          prev.map((h) => (h.id === editingHolderId ? updated : h))
        );
        setBanner(
          `Fiche ayant droit « ${updated.full_name} » (${updated.entity_type}) mise à jour.`
        );
      } else {
        const created = await createRightHolder(cleanPayload);
        setHolders((prev) => [created, ...prev]);
        setBanner(
          `Nouvel ayant droit « ${created.full_name} » (${created.entity_type}) ajouté au répertoire.`
        );
      }
    } catch {
      const profileLabel =
        cleanPayload.entity_type === "SOCIETE"
          ? `Société (${cleanPayload.legal_form || "SAS"}) • Facture Factur-X (TVA ${cleanPayload.vat_rate_pct}% • 0% Précompte)`
          : cleanPayload.urssaf_dispense_certificate
            ? "Personne Physique BNC (Dispense URSSAF Siret) • Facture Auteur sans Précompte"
            : "Personne Physique • Note de Droits d'Auteur (Précompte IRCEC/URSSAF ~11,10%)";
      const localEntry: RightHolderDirectoryEntry = {
        id: editingHolderId || crypto.randomUUID(),
        ...cleanPayload,
        works_count: 1,
        invoicing_profile_label: profileLabel,
        is_invoice_ready: Boolean(cleanPayload.postal_address && cleanPayload.iban),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (editingHolderId) {
        setHolders((prev) =>
          prev.map((h) => (h.id === editingHolderId ? localEntry : h))
        );
      } else {
        setHolders((prev) => [localEntry, ...prev]);
      }
      setBanner(
        `Fiche ayant droit « ${localEntry.full_name} » (${localEntry.entity_type}) enregistrée.`
      );
    }
    setIsEditModalOpen(false);
  }

  async function handleSyncFromCatalog() {
    try {
      const synced = await syncRightHoldersFromCatalog();
      setHolders(synced);
      setBanner(
        `Synchronisation terminée : ${synced.length} ayants droit (Personnes Physiques & Sociétés) référencés depuis le Catalogue.`
      );
    } catch {
      setBanner(
        `Répertoire synchronisé avec le Catalogue (${holders.length} fiches actives).`
      );
    }
  }

  async function openInvoiceModal(holder: RightHolderDirectoryEntry, statementId?: string) {
    setSelectedHolderForInvoice(holder);
    const defaultGross =
      holder.full_name === "Camille Moreau"
        ? "3715.25"
        : holder.entity_type === "SOCIETE"
          ? "4250.00"
          : "1890.00";
    const defaultRecouped =
      holder.full_name === "Camille Moreau" ? "1500.00" : "0.00";

    try {
      const data = await fetchReadyToUseInvoice(
        holder.id,
        statementId ? undefined : defaultGross,
        statementId ? undefined : defaultRecouped,
        invoicePeriod,
        statementId
      );
      setInvoiceGross(data.gross_royalties_eur);
      setInvoiceRecouped(data.recouped_advance_eur);
      setInvoicePeriod(data.period_label);
      setInvoiceData(data);
    } catch {
      setInvoiceGross(defaultGross);
      setInvoiceRecouped(defaultRecouped);
      setInvoiceData(
        buildOfflineInvoice(holder, defaultGross, defaultRecouped, invoicePeriod)
      );
    }
  }

  async function handleRecalculateInvoice(
    newGross: string,
    newRecouped: string,
    newPeriod: string
  ) {
    setInvoiceGross(newGross);
    setInvoiceRecouped(newRecouped);
    setInvoicePeriod(newPeriod);
    if (!selectedHolderForInvoice) return;
    try {
      const data = await fetchReadyToUseInvoice(
        selectedHolderForInvoice.id,
        newGross,
        newRecouped,
        newPeriod
      );
      setInvoiceData(data);
    } catch {
      setInvoiceData(
        buildOfflineInvoice(
          selectedHolderForInvoice,
          newGross,
          newRecouped,
          newPeriod
        )
      );
    }
  }

  function handleDownloadInvoiceTxt() {
    if (!invoiceData) return;
    const blob = new Blob([invoiceData.printable_text], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoiceData.invoice_number}_${invoiceData.holder_name.replace(
      /\s+/g,
      "_"
    )}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = holders.filter((h) => {
    const q = search.toLowerCase();
    const matchesSearch =
      h.full_name.toLowerCase().includes(q) ||
      (h.ipi_number || "").toLowerCase().includes(q) ||
      (h.email || "").toLowerCase().includes(q) ||
      (h.siret || "").toLowerCase().includes(q) ||
      (h.city || "").toLowerCase().includes(q) ||
      (h.payout_recipient_name || "").toLowerCase().includes(q) ||
      (h.heirs || []).some((hr) => hr.heir_name.toLowerCase().includes(q));
    if (!matchesSearch) return false;
    if (entityFilter === "PERSONNE_PHYSIQUE") return h.entity_type === "PERSONNE_PHYSIQUE";
    if (entityFilter === "SOCIETE") return h.entity_type === "SOCIETE";
    if (entityFilter === "SUCCESSION") return Boolean(h.is_deceased || h.succession_active);
    if (entityFilter === "MANDATAIRE") return Boolean(h.payout_recipient_name || h.payout_recipient_id);
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filtered.length);
  const paginatedHolders = filtered.slice(startIndex, endIndex);

  return (
    <div className="space-y-4">
      {/* En-tête Principal Répertoire Korom */}
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center border-b pb-3.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-micro text-[28px] font-bold tracking-tight text-foreground leading-none">
              Répertoire des ayants droit
            </h1>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              Fiscalité & Règlements
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Annuaire centralisé des auteurs, compositeurs et éditeurs • Statuts fiscaux (Artiste-Auteur URSSAF/IRCEC, BNC, Factur-X) & Coordonnées bancaires
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSyncFromCatalog}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Synchroniser depuis Catalogue
          </button>

          <button
            type="button"
            onClick={openCreateHolderModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Nouvel ayant droit
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setEntityFilter("ALL")}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
            entityFilter === "ALL"
              ? "bg-primary text-primary-foreground border-primary shadow-xs"
              : "bg-card text-foreground hover:bg-accent border-border"
          }`}
        >
          Tous ({holders.length})
        </button>
        <button
          type="button"
          onClick={() => setEntityFilter("PERSONNE_PHYSIQUE")}
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
            entityFilter === "PERSONNE_PHYSIQUE"
              ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
              : "bg-card text-indigo-700 hover:bg-indigo-50 border-indigo-500/30"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Personnes Physiques (
          {holders.filter((h) => h.entity_type === "PERSONNE_PHYSIQUE").length}
          )
        </button>
        <button
          type="button"
          onClick={() => setEntityFilter("SOCIETE")}
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
            entityFilter === "SOCIETE"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
              : "bg-card text-emerald-700 hover:bg-emerald-50 border-emerald-500/30"
          }`}
        >
          <Building2 className="h-3.5 w-3.5" />
          Sociétés / Éditeurs (
          {holders.filter((h) => h.entity_type === "SOCIETE").length})
        </button>
        <button
          type="button"
          onClick={() => setEntityFilter("SUCCESSION")}
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
            entityFilter === "SUCCESSION"
              ? "bg-purple-600 text-white border-purple-600 shadow-xs"
              : "bg-card text-purple-700 hover:bg-purple-50 border-purple-500/30"
          }`}
        >
          <ScrollText className="h-3.5 w-3.5" />
          Successions & Décédés (
          {holders.filter((h) => h.is_deceased || h.succession_active).length})
        </button>
        <button
          type="button"
          onClick={() => setEntityFilter("MANDATAIRE")}
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
            entityFilter === "MANDATAIRE"
              ? "bg-sky-600 text-white border-sky-600 shadow-xs"
              : "bg-card text-sky-700 hover:bg-sky-50 border-sky-500/30"
          }`}
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Tiers Payé / Mandataires (
          {holders.filter((h) => h.payout_recipient_name || h.payout_recipient_id).length})
        </button>
      </div>

      {banner && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-800">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{banner}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-xs font-semibold underline hover:no-underline"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Barre de recherche compacte + Contrôles de pagination / densité */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un ayant droit par nom, raison sociale, code IPI, numéro SIRET, email ou ville..."
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
            sur <strong className="text-foreground">{filtered.length}</strong> ayants droit
          </span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            aria-label="Nombre d'ayants droit par page"
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
              <span className="font-mono text-[11px] px-1 text-foreground">
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

      {/* Tableau Haute Densité du Répertoire des Ayants Droit ou Empty State si base vierge */}
      {holders.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8 text-primary" />}
          title="Répertoire des ayants droit vide"
          description="L'annuaire se synchronise automatiquement lors de l'import de votre catalogue SACEM ou de la validation de vos contrats d'édition. Vous pouvez également créer manuellement un auteur, compositeur ou éditeur."
          badgeText="Base vierge"
          primaryAction={{
            label: "Créer un ayant droit manuellement",
            onClick: openCreateHolderModal,
            icon: <Plus className="h-4 w-4" />,
          }}
          secondaryAction={{
            label: "Importer mon catalogue SACEM",
            href: "/catalog?import=sacem",
            icon: <FileText className="h-4 w-4" />,
          }}
          demoAction={{
            label: "Charger les ayants droit démo (9 profils)",
            onClick: handleLoadDemoHolders,
            isLoading: isLoadingDemo,
          }}
          tipText="💡 Régime fiscal Artiste-Auteur vs Société : Chaque ayant droit porte son statut fiscal officiel (Artiste-Auteur avec précompte IRCEC/URSSAF ~11,10 %, dispense BNC, ou société assujettie TVA 20 %) et ses coordonnées bancaires pour la télétransmission des virements SEPA."
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/50 text-muted-foreground">
              <tr>
                <th className="w-9 px-3 py-2 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAllHolders}
                    className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    title={
                      selectedHolderIds.length === filtered.length && filtered.length > 0
                        ? "Tout désélectionner"
                        : "Tout sélectionner"
                    }
                  >
                    {selectedHolderIds.length === filtered.length && filtered.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : selectedHolderIds.length > 0 ? (
                      <div className="h-3.5 w-3.5 rounded bg-primary text-[10px] font-bold text-white flex items-center justify-center leading-none">
                        -
                      </div>
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="w-8 px-2 py-2"></th>
                <th className="px-3 py-2 font-semibold">
                  Nom / Raison Sociale & Rôle
                </th>
                <th className="px-3 py-2 font-semibold">
                  Statut Juridique (Personne vs Société)
                </th>
                <th className="px-3 py-2 font-semibold">Code IPI / OGC</th>
                <th className="px-3 py-2 font-semibold">Contact & Ville</th>
                <th className="px-3 py-2 font-semibold">
                  Régime Fiscal & Précompte / TVA
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  Actions & Facturation
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginatedHolders.map((h) => {
                const isExpanded = expandedIds.includes(h.id);
                const isCompany = h.entity_type === "SOCIETE";
                const isSelected = selectedHolderIds.includes(h.id);

                return (
                  <Fragment key={h.id}>
                    <tr
                      onClick={() => toggleExpand(h.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"
                      }`}
                    >
                      <td
                        className="w-9 px-3 py-2 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => toggleSelectHolder(h.id, e)}
                          className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-foreground">
                            {h.full_name}
                          </span>
                          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-bold">
                            {h.primary_role}
                          </span>
                          {(h.is_deceased || h.succession_active) && (
                            <span className="inline-flex items-center gap-1 rounded bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
                              <ScrollText className="h-3 w-3" />
                              Décédé / Succession {h.heirs && h.heirs.length > 0 ? `(${h.heirs.length})` : ""}
                            </span>
                          )}
                          {h.payout_recipient_name && (
                            <span className="inline-flex items-center gap-1 rounded bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700" title={`Paiement redirigé vers : ${h.payout_recipient_name}`}>
                              <ArrowRightLeft className="h-3 w-3" />
                              Tiers Payé ➔ {h.payout_recipient_name}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {h.works_count} œuvre(s) liée(s) au catalogue
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {isCompany ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            <Building2 className="h-3 w-3" />
                            Société ({h.legal_form || "SAS"})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                            <UserCheck className="h-3 w-3" />
                            Personne Physique
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        <div className="font-medium text-foreground">
                          IPI {h.ipi_number || "Non renseigné"}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1 mt-0.5">
                          <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                            DE: {h.society_de || "SACEM"}
                          </span>
                          <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                            DR: {h.society_dr || "SACEM"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-foreground">
                          {h.email || "Email non renseigné"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {h.city ? `${h.postal_code || ""} ${h.city} (${h.country})` : h.phone || "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {isCompany ? (
                          <div>
                            <div className="font-semibold text-emerald-700">
                              Facture Factur-X • TVA {h.vat_rate_pct}%
                            </div>
                            <div className="font-mono text-[11px] text-muted-foreground">
                              SIRET {h.siret || "À compléter"} • 0% Précompte
                            </div>
                          </div>
                        ) : h.urssaf_dispense_certificate ? (
                          <div>
                            <div className="font-semibold text-blue-700">
                              Dispense Précompte URSSAF (BNC)
                            </div>
                            <div className="font-mono text-[11px] text-muted-foreground">
                              SIRET {h.siret || "Renseigné"} • TVA {h.vat_rate_pct}%
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-amber-700">
                              Note d&apos;Auteur • Précompte IRCEC/URSSAF
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Franchise TVA Art. 293 B CGI • Retenue ~11,10%
                            </div>
                          </div>
                        )}
                      </td>
                      <td
                        className="px-3 py-2 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openInvoiceModal(h)}
                            className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20"
                          >
                            <FileText className="h-3 w-3" />
                            {isCompany
                              ? "Facture Prête"
                              : "Note de Droits"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditHolderModal(h)}
                            className="inline-flex items-center gap-1 rounded border bg-secondary px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-accent"
                          >
                            <Pencil className="h-3 w-3" />
                            Fiche
                          </button>
                          <button
                            type="button"
                            onClick={() => setHolderToDelete(h)}
                            title="Supprimer cet ayant droit"
                            className="inline-flex items-center gap-1 rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/20 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Ligne dépliée : Coordonnées complètes, Adresse postale, IBAN/BIC, SIRET/TVA */}
                    {isExpanded && (
                      <tr className="bg-muted/20">
                        <td colSpan={8} className="px-6 py-3">
                          <div className="grid gap-3 sm:grid-cols-3 text-xs">
                            <div className="rounded-lg border bg-card p-2.5 space-y-1">
                              <div className="font-semibold text-muted-foreground uppercase text-[10px]">
                                Coordonnées de Contact & Adresse Facturation
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5 text-primary" />
                                <span>{h.email || "Non renseigné"}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Phone className="h-3.5 w-3.5 text-primary" />
                                <span>{h.phone || "Non renseigné"}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-primary" />
                                <span>
                                  {h.postal_address || "Adresse non renseignée"},{" "}
                                  {h.postal_code} {h.city} ({h.country})
                                </span>
                              </div>
                            </div>

                            <div className="rounded-lg border bg-card p-2.5 space-y-1">
                              <div className="font-semibold text-muted-foreground uppercase text-[10px]">
                                Identification Légale & Fiscale
                              </div>
                              <div>
                                Type :{" "}
                                <strong>
                                  {isCompany
                                    ? `Société (${h.legal_form})`
                                    : `Personne Physique (${h.legal_form})`}
                                </strong>
                              </div>
                              <div className="font-mono">
                                SIRET : <strong>{h.siret || "Sans SIRET"}</strong> •
                                TVA :{" "}
                                <strong>
                                  {h.vat_number || "Franchise Art. 293 B"}
                                </strong>
                              </div>
                              <div>
                                Précompte IRCEC :{" "}
                                <strong>
                                  {h.ircec_precompte_applicable
                                    ? "Applicable (retenu par l'éditeur)"
                                    : "Non applicable (Société ou Dispense URSSAF)"}
                                </strong>
                              </div>
                            </div>

                            <div className="rounded-lg border bg-card p-2.5 space-y-1">
                              <div className="font-semibold text-muted-foreground uppercase text-[10px]">
                                Coordonnées Bancaires SEPA & Notes
                              </div>
                              <div className="font-mono">
                                IBAN : <strong>{h.iban || "À compléter"}</strong>
                              </div>
                              <div className="font-mono">
                                BIC : <strong>{h.bic || "—"}</strong>
                              </div>
                              {h.notes && (
                                <div className="text-[11px] text-muted-foreground pt-0.5">
                                  {h.notes}
                                </div>
                              )}
                            </div>

                            {(h.is_deceased || h.succession_active || h.payout_recipient_name) && (
                              <div className="sm:col-span-3 rounded-lg border border-purple-500/30 bg-purple-500/5 p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <ScrollText className="h-4 w-4 text-purple-700" />
                                    <span className="font-bold text-purple-900 text-[11px] uppercase tracking-wide">
                                      Dévolution Successorale & Tiers Mandataire
                                    </span>
                                  </div>
                                  {h.deceased_at && (
                                    <span className="text-[11px] text-purple-700 font-medium">
                                      Décédé(e) le : <strong>{h.deceased_at}</strong>
                                    </span>
                                  )}
                                </div>

                                {h.payout_recipient_name && (
                                  <div className="flex items-center gap-2 rounded-md bg-sky-500/10 border border-sky-500/20 px-2.5 py-1.5 text-xs text-sky-800">
                                    <ArrowRightLeft className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                                    <span>
                                      <strong>Tiers Payé / Mandataire désigné :</strong> {h.payout_recipient_name}
                                      {h.iban ? ` (Virements SEPA émis vers l'IBAN : ${h.iban})` : ""}
                                    </span>
                                  </div>
                                )}

                                {h.succession_active && h.heirs && h.heirs.length > 0 ? (
                                  <div className="space-y-1.5 pt-1">
                                    <div className="text-[11px] font-semibold text-purple-800">
                                      Quotes-parts successorales réparties ({h.heirs.length} héritier{h.heirs.length > 1 ? "s" : ""}) :
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                                      {h.heirs.map((hr, idx) => (
                                        <div key={idx} className="rounded-md border bg-card p-2 text-xs space-y-0.5">
                                          <div className="flex items-center justify-between font-bold text-foreground">
                                            <span>{hr.heir_name}</span>
                                            <span className="font-mono text-purple-700">{hr.share_pct} %</span>
                                          </div>
                                          <div className="text-[10px] text-muted-foreground">{hr.relationship}</div>
                                          {hr.iban && (
                                            <div className="font-mono text-[10px] text-muted-foreground truncate" title={hr.iban}>
                                              IBAN: {hr.iban}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                    {h.succession_notes && (
                                      <div className="text-[10px] text-muted-foreground italic">
                                        Réf: {h.succession_notes}
                                      </div>
                                    )}
                                  </div>
                                ) : h.is_deceased ? (
                                  <div className="text-xs text-muted-foreground italic">
                                    Auteur décédé enregistré sans indivision successorale active (les droits sont liquidés au compte principal).
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {paginatedHolders.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-xs text-muted-foreground"
                  >
                    Aucun ayant droit ne correspond aux critères de recherche ou de filtre.
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
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          pageSizeOptions={[25, 50, 100, 250, 500]}
          itemLabel="ayants droit"
          storageKey="korom_holders_page_size"
        />
      </div>
      )}

      {/* Modale de Création / Édition d'une fiche Ayant Droit */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-xl border bg-card p-5 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-base font-bold">
                  {editingHolderId
                    ? `Modifier la fiche Ayant Droit : ${formData.full_name}`
                    : "Ajouter un Ayant Droit au Répertoire (Personne Physique ou Société)"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Configurez les coordonnées de contact et le statut juridique afin d&apos;automatiser les Factures Factur-X et Notes de Droits d&apos;Auteur.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveHolder} className="space-y-3.5 text-xs">
              {/* Choix Personne Physique vs Société */}
              <div className="grid grid-cols-2 gap-2.5 rounded-lg border bg-muted/30 p-2.5">
                <button
                  type="button"
                  onClick={() => handleEntityTypeChange("PERSONNE_PHYSIQUE")}
                  className={`flex items-center justify-center gap-2 rounded-md border py-2 font-semibold transition-colors ${
                    formData.entity_type === "PERSONNE_PHYSIQUE"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-card text-foreground hover:bg-accent"
                  }`}
                >
                  <UserCheck className="h-4 w-4" />
                  Personne Physique (Auteur, Compositeur, Interprète)
                </button>
                <button
                  type="button"
                  onClick={() => handleEntityTypeChange("SOCIETE")}
                  className={`flex items-center justify-center gap-2 rounded-md border py-2 font-semibold transition-colors ${
                    formData.entity_type === "SOCIETE"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-card text-foreground hover:bg-accent"
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  Société / Personne Morale (Éditeur, Coéditeur, Label)
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block font-medium mb-1">
                    {formData.entity_type === "SOCIETE"
                      ? "Raison Sociale de la Société *"
                      : "Nom & Prénom de l'Ayant Droit *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    placeholder={
                      formData.entity_type === "SOCIETE"
                        ? "Ex: Éditions Solstices Music SAS"
                        : "Ex: Camille Moreau"
                    }
                    className="w-full rounded-md border px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Rôle Principal</label>
                  <select
                    value={formData.primary_role}
                    onChange={(e) =>
                      setFormData({ ...formData, primary_role: e.target.value })
                    }
                    className="w-full rounded-md border bg-card px-2.5 py-1.5 font-mono"
                  >
                    <option value="AC">AC (Auteur-Compositeur)</option>
                    <option value="A">A (Auteur)</option>
                    <option value="C">C (Compositeur)</option>
                    <option value="E">E (Éditeur)</option>
                    <option value="SE">SE (Sous-Éditeur)</option>
                    <option value="P">P (Producteur Phono)</option>
                    <option value="I">I (Artiste-Interprète)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">
                    Code IPI (9–11 chiffres)
                  </label>
                  <input
                    type="text"
                    value={formData.ipi_number || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, ipi_number: e.target.value })
                    }
                    placeholder="00458912301"
                    className="w-full rounded-md border px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Société DE (Exécution Publique)
                  </label>
                  <input
                    type="text"
                    value={formData.society_de || "SACEM"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        society_de: e.target.value,
                        affiliated_society: `${e.target.value} / ${formData.society_dr || "SACEM"}`,
                      })
                    }
                    placeholder="SACEM, ASCAP, BMI, PRS, GEMA..."
                    className="w-full rounded-md border px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Société DR (Reproduction Mécanique)
                  </label>
                  <input
                    type="text"
                    value={formData.society_dr || "SACEM"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        society_dr: e.target.value,
                        affiliated_society: `${formData.society_de || "SACEM"} / ${e.target.value}`,
                      })
                    }
                    placeholder="SDRM, SACEM, MCPS, Harry Fox..."
                    className="w-full rounded-md border px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Forme Juridique</label>
                  <input
                    type="text"
                    value={formData.legal_form || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, legal_form: e.target.value })
                    }
                    placeholder="SAS, SARL, Artiste-Auteur BNC..."
                    className="w-full rounded-md border px-2.5 py-1.5"
                  />
                </div>
              </div>

              {/* Coordonnées de Contact & Adresse */}
              <div className="grid gap-3 sm:grid-cols-3 border-t pt-3">
                <div>
                  <label className="block font-medium mb-1">Email de Contact / Décomptes</label>
                  <input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="contact@exemple.fr"
                    className="w-full rounded-md border px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={formData.phone || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="+33 6..."
                    className="w-full rounded-md border px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Adresse Postale</label>
                  <input
                    type="text"
                    value={formData.postal_address || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        postal_address: e.target.value,
                      })
                    }
                    placeholder="18 Rue Oberkampf"
                    className="w-full rounded-md border px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Code Postal</label>
                  <input
                    type="text"
                    value={formData.postal_code || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, postal_code: e.target.value })
                    }
                    placeholder="75011"
                    className="w-full rounded-md border px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Ville</label>
                  <input
                    type="text"
                    value={formData.city || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    placeholder="Paris"
                    className="w-full rounded-md border px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Pays (ISO)</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                    placeholder="FR"
                    className="w-full rounded-md border px-2.5 py-1.5 font-mono"
                  />
                </div>
              </div>

              {/* Paramètres Fiscaux & Bancaires */}
              <div className="grid gap-3 sm:grid-cols-3 border-t pt-3">
                <div>
                  <label className="block font-medium mb-1">
                    N° SIRET (Société ou Auteur BNC)
                  </label>
                  <input
                    type="text"
                    value={formData.siret || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, siret: e.target.value })
                    }
                    placeholder="89123456700014"
                    className="w-full rounded-md border px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    N° TVA Intracommunautaire
                  </label>
                  <input
                    type="text"
                    value={formData.vat_number || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, vat_number: e.target.value })
                    }
                    placeholder="FR64891234567"
                    className="w-full rounded-md border px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Taux de TVA (%)</label>
                  <input
                    type="text"
                    value={formData.vat_rate_pct}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        vat_rate_pct: e.target.value,
                        vat_applicable: parseFloat(e.target.value) > 0,
                      })
                    }
                    placeholder="10.00 ou 0.00"
                    className="w-full rounded-md border px-2.5 py-1.5 font-mono"
                  />
                </div>

                {formData.entity_type === "PERSONNE_PHYSIQUE" && (
                  <div className="sm:col-span-3 flex flex-wrap items-center gap-4 rounded-lg border bg-indigo-500/5 px-3 py-2">
                    <label className="inline-flex items-center gap-2 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.urssaf_dispense_certificate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            urssaf_dispense_certificate: e.target.checked,
                            ircec_precompte_applicable: !e.target.checked,
                          })
                        }
                      />
                      <span>
                        Attestation de dispense de précompte URSSAF fournie (Auteur déclaré en BNC avec SIRET)
                      </span>
                    </label>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block font-medium mb-1">
                    IBAN (Virement SEPA Royalties)
                  </label>
                  <input
                    type="text"
                    value={formData.iban || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, iban: e.target.value })
                    }
                    placeholder="FR76 3000 4008..."
                    className="w-full rounded-md border px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Code BIC / SWIFT</label>
                  <input
                    type="text"
                    value={formData.bic || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, bic: e.target.value })
                    }
                    placeholder="BNPAFRPPXXX"
                    className="w-full rounded-md border px-2.5 py-1.5 font-mono"
                  />
                </div>
              </div>

              {/* Section Succession & Tiers Mandataires (Redirection de Paiement) */}
              <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3.5 space-y-3.5">
                <div className="flex items-center gap-2 border-b border-purple-500/20 pb-2">
                  <ScrollText className="h-4 w-4 text-purple-700" />
                  <span className="font-bold text-xs text-purple-900 uppercase tracking-wide">
                    Module Successions d&apos;Auteurs, Héritiers & Tiers Mandataires
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Option Décédé */}
                  <div className="space-y-2 rounded-lg border bg-card p-3">
                    <label className="inline-flex items-center gap-2 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(formData.is_deceased)}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            is_deceased: e.target.checked,
                            succession_active: e.target.checked ? formData.succession_active : false,
                          })
                        }
                      />
                      <span className="text-xs font-bold text-foreground">
                        Auteur décédé (Protection post-mortem 70 ans)
                      </span>
                    </label>

                    {formData.is_deceased && (
                      <div className="space-y-2 pt-2 border-t">
                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Date du décès
                          </label>
                          <input
                            type="date"
                            value={formData.deceased_at || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, deceased_at: e.target.value })
                            }
                            className="w-full rounded-md border px-2.5 py-1.5 text-xs font-mono"
                          />
                        </div>

                        <label className="inline-flex items-center gap-2 font-medium cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={Boolean(formData.succession_active)}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                succession_active: e.target.checked,
                                heirs: e.target.checked && (!formData.heirs || formData.heirs.length === 0)
                                  ? [
                                      { heir_name: "Conjoint(e) survivant(e)", relationship: "Conjoint survivant", share_pct: "50.00", iban: "", bic: "" },
                                      { heir_name: "Héritier(ère) 1", relationship: "Enfant", share_pct: "50.00", iban: "", bic: "" },
                                    ]
                                  : formData.heirs,
                              })
                            }
                          />
                          <span className="text-xs font-semibold text-purple-800">
                            Activer l&apos;indivision successorale (ventilation entre héritiers)
                          </span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Option Tiers Payé / Mandataire */}
                  <div className="space-y-2 rounded-lg border bg-card p-3">
                    <label className="inline-flex items-center gap-2 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(formData.payout_recipient_name || formData.payout_recipient_id)}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            payout_recipient_name: e.target.checked ? (formData.payout_recipient_name || "Étude Notariale SCP Martin") : "",
                            payout_recipient_id: e.target.checked ? formData.payout_recipient_id : null,
                          })
                        }
                      />
                      <span className="text-xs font-bold text-foreground">
                        Redirection de paiement vers un Tiers Mandataire (Tiers Payé)
                      </span>
                    </label>

                    {(formData.payout_recipient_name || formData.payout_recipient_id) && (
                      <div className="space-y-2 pt-2 border-t">
                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Nom du Tiers Mandataire / Notaire / Mandat *
                          </label>
                          <input
                            type="text"
                            value={formData.payout_recipient_name || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, payout_recipient_name: e.target.value })
                            }
                            placeholder="Ex: Étude Notariale SCP Martin, Mandataire..."
                            className="w-full rounded-md border px-2.5 py-1.5 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Ou sélectionner un ayant droit existant dans l&apos;annuaire :
                          </label>
                          <select
                            value={formData.payout_recipient_id || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              const matched = holders.find((h) => h.id === val);
                              setFormData({
                                ...formData,
                                payout_recipient_id: val || null,
                                payout_recipient_name: matched ? matched.full_name : formData.payout_recipient_name,
                                iban: matched?.iban || formData.iban,
                                bic: matched?.bic || formData.bic,
                              });
                            }}
                            className="w-full rounded-md border bg-card px-2.5 py-1.5 text-xs"
                          >
                            <option value="">(Saisie manuelle du tiers)</option>
                            {holders
                              .filter((h) => h.id !== editingHolderId)
                              .map((h) => (
                                <option key={h.id} value={h.id}>
                                  {h.full_name} ({h.entity_type === "SOCIETE" ? "Société" : "Personne"} • {h.iban || "Sans IBAN"})
                                </option>
                              ))}
                          </select>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">
                          L&apos;auteur conserve sa titularité et ses crédits sur toutes les œuvres et dépôts CWR. Les virements sont redirigés vers le tiers mandataire.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Détail de l'indivision successorale et des héritiers */}
                {formData.is_deceased && formData.succession_active && (
                  <div className="space-y-3 rounded-lg border bg-card p-3 border-purple-500/30">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
                      <div>
                        <div className="text-xs font-bold text-foreground">
                          Ventilation des quotes-parts successorales (Indivision Art. 815 C. Civ.)
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Définissez les héritiers et leurs pourcentages respectifs. Le total doit être égal à 100.00 %.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const totalPct = (formData.heirs || []).reduce(
                            (acc, h) => acc + (parseFloat(h.share_pct) || 0),
                            0
                          );
                          const isComplete = Math.abs(totalPct - 100) < 0.01;
                          return (
                            <span
                              className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                                isComplete
                                  ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30"
                                  : "bg-amber-500/10 text-amber-700 border border-amber-500/30"
                              }`}
                            >
                              Total : {totalPct.toFixed(2)} % {isComplete ? "✓ (Équilibré)" : "⚠ (Doit faire 100%)"}
                            </span>
                          );
                        })()}
                        <button
                          type="button"
                          onClick={addHeirRow}
                          className="inline-flex items-center gap-1 rounded bg-purple-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-purple-700 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          Ajouter un héritier
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        Références notariales / Notes de la succession
                      </label>
                      <input
                        type="text"
                        value={formData.succession_notes || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, succession_notes: e.target.value })
                        }
                        placeholder="Ex: Acte de notoriété Me Laurent (Paris), succession ouverte le 12/04/2024"
                        className="w-full rounded-md border px-2.5 py-1.5 text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      {(formData.heirs || []).map((hr, idx) => (
                        <div
                          key={idx}
                          className="grid gap-2 sm:grid-cols-12 items-center rounded-md border bg-muted/20 p-2 text-xs"
                        >
                          <div className="sm:col-span-4">
                            <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                              Nom de l&apos;héritier *
                            </label>
                            <input
                              type="text"
                              required
                              value={hr.heir_name}
                              onChange={(e) => updateHeirRow(idx, { heir_name: e.target.value })}
                              placeholder="Ex: Marie Dupont"
                              className="w-full rounded border px-2 py-1 text-xs"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                              Lien de parenté
                            </label>
                            <input
                              type="text"
                              value={hr.relationship}
                              onChange={(e) => updateHeirRow(idx, { relationship: e.target.value })}
                              placeholder="Ex: Conjoint survivant, Enfant..."
                              className="w-full rounded border px-2 py-1 text-xs"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                              Quote-part (%) *
                            </label>
                            <input
                              type="text"
                              required
                              value={hr.share_pct}
                              onChange={(e) => updateHeirRow(idx, { share_pct: e.target.value })}
                              placeholder="50.00"
                              className="w-full rounded border px-2 py-1 text-xs font-mono"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                              IBAN Héritier
                            </label>
                            <input
                              type="text"
                              value={hr.iban || ""}
                              onChange={(e) => updateHeirRow(idx, { iban: e.target.value })}
                              placeholder="FR76..."
                              className="w-full rounded border px-2 py-1 text-xs font-mono"
                            />
                          </div>
                          <div className="sm:col-span-1 flex justify-end pt-3 sm:pt-0">
                            <button
                              type="button"
                              onClick={() => removeHeirRow(idx)}
                              className="rounded p-1 text-destructive hover:bg-destructive/10"
                              title="Retirer cet héritier"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t pt-3">
                {editingHolderId ? (
                  <button
                    type="button"
                    onClick={() => {
                      const current = holders.find((h) => h.id === editingHolderId);
                      if (current) setHolderToDelete(current);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 font-semibold text-destructive hover:bg-destructive/20 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer cet ayant droit
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="rounded-md border px-3 py-1.5 font-medium hover:bg-accent"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-primary px-4 py-1.5 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                  >
                    Enregistrer la Fiche Ayant Droit
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale de Génération de Facture (Société Factur-X) / Note de Droits d'Auteur (Personne Physique) Prête à l'Emploi */}
      {selectedHolderForInvoice && invoiceData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-xl border bg-card p-5 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase ${
                      invoiceData.entity_type === "SOCIETE"
                        ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30"
                        : "bg-indigo-500/10 text-indigo-700 border border-indigo-500/30"
                    }`}
                  >
                    {invoiceData.entity_type === "SOCIETE"
                      ? "Facture Société Factur-X 2026"
                      : "Note de Droits d'Auteur (Personne Physique)"}
                  </span>
                  <h2 className="text-base font-bold">
                    {invoiceData.invoice_number} — {invoiceData.holder_name}
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Document prêt à l&apos;emploi généré par moteur 100 % déterministe (<code className="font-mono">Decimal</code>) à partir de la fiche juridique de l&apos;ayant droit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedHolderForInvoice(null);
                  setInvoiceData(null);
                }}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Paramètres de simulation en direct */}
            <div className="grid gap-2.5 rounded-lg border bg-muted/30 p-3 sm:grid-cols-3 text-xs">
              <div>
                <label className="block font-medium mb-1">
                  Période de Répartition
                </label>
                <input
                  type="text"
                  value={invoicePeriod}
                  onChange={(e) =>
                    handleRecalculateInvoice(
                      invoiceGross,
                      invoiceRecouped,
                      e.target.value
                    )
                  }
                  className="w-full rounded border bg-card px-2.5 py-1"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">
                  Redevances Brutes Allouées (EUR)
                </label>
                <input
                  type="text"
                  value={invoiceGross}
                  onChange={(e) =>
                    handleRecalculateInvoice(
                      e.target.value,
                      invoiceRecouped,
                      invoicePeriod
                    )
                  }
                  className="w-full rounded border bg-card px-2.5 py-1 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">
                  Retenu sur Avance Récupérable (EUR)
                </label>
                <input
                  type="text"
                  value={invoiceRecouped}
                  onChange={(e) =>
                    handleRecalculateInvoice(
                      invoiceGross,
                      e.target.value,
                      invoicePeriod
                    )
                  }
                  className="w-full rounded border bg-card px-2.5 py-1 font-mono"
                />
              </div>
            </div>

            {/* Synthèse visuelle des montants calculés */}
            <div className="grid gap-2.5 sm:grid-cols-4 text-xs">
              <div className="rounded-lg border bg-card p-2.5">
                <div className="text-[11px] text-muted-foreground">
                  Base Payable HT (Après Avance)
                </div>
                <div className="text-sm font-bold font-mono mt-0.5">
                  {Number(invoiceData.taxable_base_ht_eur).toLocaleString(
                    "fr-FR"
                  )}{" "}
                  €
                </div>
              </div>
              <div className="rounded-lg border bg-card p-2.5">
                <div className="text-[11px] text-muted-foreground">
                  TVA ({invoiceData.vat_rate_pct} %)
                </div>
                <div className="text-sm font-bold font-mono text-primary mt-0.5">
                  + {Number(invoiceData.vat_amount_eur).toLocaleString("fr-FR")} €
                </div>
              </div>
              <div className="rounded-lg border bg-card p-2.5">
                <div className="text-[11px] text-muted-foreground">
                  Précompte Social IRCEC / URSSAF
                </div>
                <div className="text-sm font-bold font-mono text-amber-700 mt-0.5">
                  -{" "}
                  {Number(
                    invoiceData.total_precompte_social_eur
                  ).toLocaleString("fr-FR")}{" "}
                  €
                </div>
              </div>
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-2.5">
                <div className="text-[11px] font-semibold text-emerald-800">
                  Net à Payer (Virement SEPA)
                </div>
                <div className="text-base font-bold font-mono text-emerald-700 mt-0.5">
                  {Number(
                    invoiceData.net_payable_to_holder_eur
                  ).toLocaleString("fr-FR")}{" "}
                  €
                </div>
              </div>
            </div>

            {/* Aperçu du document prêt à imprimer / télécharger */}
            <pre className="overflow-x-auto rounded-lg border bg-slate-950 p-4 font-mono text-xs text-emerald-400 leading-relaxed">
              {invoiceData.printable_text}
            </pre>

            <div className="flex items-center justify-between border-t pt-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Conforme Factur-X 2026 / Mandat d&apos;Autofacturation Éditeur
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-accent"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimer / PDF
                </button>
                <button
                  type="button"
                  onClick={handleDownloadInvoiceTxt}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  Télécharger Document ({invoiceData.invoice_number})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modale de confirmation de suppression d'ayant droit */}
      <ConfirmDeleteModal
        isOpen={!!holderToDelete}
        onClose={() => setHolderToDelete(null)}
        onConfirm={handleConfirmDeleteHolder}
        title="Supprimer l'ayant droit"
        itemName={holderToDelete ? `${holderToDelete.full_name} (${holderToDelete.ipi_number || "Sans IPI"})` : ""}
        description="Cette action supprimera définitivement cette fiche ayant droit du répertoire. Les références dans les contrats existants seront découplées en toute sécurité. Cette opération est irréversible."
        confirmText="Supprimer l'ayant droit"
        isDeleting={isDeletingHolder}
      />

      {/* Barre d'action flottante lorsque des ayants droit sont sélectionnés */}
      {selectedHolderIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full border border-slate-700 bg-slate-900/95 px-5 py-2.5 text-xs font-medium text-white shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2 pr-2 border-r border-slate-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {selectedHolderIds.length}
            </span>
            <span>ayant(s) droit sélectionné(s)</span>
          </div>

          <button
            type="button"
            onClick={() => setIsBatchDeleteModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-rose-600/90 hover:bg-rose-600 px-3.5 py-1 text-xs font-semibold text-white shadow transition-colors"
            title="Supprimer les ayants droit sélectionnés"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Supprimer ({selectedHolderIds.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedHolderIds([])}
            className="text-xs text-slate-400 hover:text-white underline pl-1"
          >
            Tout désélectionner
          </button>
        </div>
      )}

      {/* Modale de confirmation de suppression groupée d'ayants droit */}
      <ConfirmDeleteModal
        isOpen={isBatchDeleteModalOpen}
        onClose={() => setIsBatchDeleteModalOpen(false)}
        onConfirm={handleConfirmBatchDeleteHolders}
        title={`Supprimer ${selectedHolderIds.length} ayant(s) droit`}
        description="Cette action supprimera définitivement les fiches des ayants droit sélectionnés. Les références dans les contrats et registres d'avances associés seront découplées en toute sécurité. Cette opération est irréversible."
        confirmText={`Supprimer définitivement (${selectedHolderIds.length})`}
        isDeleting={isBatchDeleting}
        itemName={
          <ul className="list-disc list-inside space-y-0.5 text-xs">
            {holders
              .filter((h) => selectedHolderIds.includes(h.id))
              .slice(0, 6)
              .map((h) => (
                <li key={h.id} className="truncate">
                  <strong>{h.full_name}</strong> {h.ipi_number ? `(IPI ${h.ipi_number})` : ""}
                </li>
              ))}
            {selectedHolderIds.length > 6 && (
              <li className="text-muted-foreground italic">
                ... et {selectedHolderIds.length - 6} autre(s) ayant(s) droit
              </li>
            )}
          </ul>
        }
      />
    </div>
  );
}

export default function RightHoldersDirectoryPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-xs text-muted-foreground">
          Chargement de l&apos;annuaire des ayants droit...
        </div>
      }
    >
      <RightHoldersDirectoryContent />
    </Suspense>
  );
}
