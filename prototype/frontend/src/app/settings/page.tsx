"use client";

import { useEffect, useState } from "react";
import {
  ArrowRightLeft,
  Building2,
  Calculator,
  CheckCircle2,
  Coins,
  Edit3,
  FileSpreadsheet,
  FileText,
  History,
  Layers,
  Plus,
  RefreshCw,
  Save,
  Sliders,
  X,
} from "lucide-react";
import {
  convertCurrencyAmount,
  createCsvProfile,
  fetchAuditLogs,
  fetchCsvProfiles,
  fetchCurrencyParities,
  fetchWorkspaceSettings,
  resetCurrencyParitiesToBce,
  updateCurrencyParity,
  updateEntity,
  updateWorkspaceSettings,
} from "@/lib/api";
import { useWorkspace } from "@/context/workspace-context";
import {
  AuditLogEntry,
  CSVImportProfile,
  CurrencyConvertResponse,
  CurrencyRateItem,
  SplitPreset,
  WorkspaceSettings,
} from "@/types/api";

const DEFAULT_PRESETS: SplitPreset[] = [
  {
    id: "sacem-statutaire-1-3-dep-50-dr",
    name: "Barème Statutaire Sacem (1/3 DEP, 50% DR)",
    description:
      "Répartition statutaire officielle Sacem 2026 (Statuts art. 9, RG art. 57 & 76) : 33.33% Éditeur en DEP (1/3) et 50% Éditeur en DR.",
    admin_fee_pct: "0.00",
    splits: [
      {
        holder_name: "Auteur-Compositeur",
        role: "AC",
        ipi_number: "00458912301",
        dep_share_pct: "66.67",
        drm_share_pct: "50.00",
        sync_share_pct: "50.00",
        phono_share_pct: "50.00",
        share_percentage: "66.67",
      },
      {
        holder_name: "Éditions Solstices Music",
        role: "E",
        ipi_number: "00891234567",
        dep_share_pct: "33.33",
        drm_share_pct: "50.00",
        sync_share_pct: "50.00",
        phono_share_pct: "50.00",
        share_percentage: "33.33",
      },
    ],
  },
  {
    id: "cession-standard-50-50",
    name: "Cession d'Édition Standard / Sous-Édition (50/50)",
    description:
      "Répartition 50% Auteur-Compositeur / 50% Éditeur en DEP (plafond R-306), DRM et SYNC.",
    admin_fee_pct: "0.00",
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
  },
  {
    id: "coedition-50-25-25",
    name: "Coédition 50 / 25 / 25",
    description:
      "50% Auteur-Compositeur, 25% Éditeur principal, 25% Co-Éditeur.",
    admin_fee_pct: "0.00",
    splits: [
      {
        holder_name: "Antoine Garnier",
        role: "AC",
        ipi_number: "00734512980",
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
        holder_name: "Belleville Publishing",
        role: "E",
        ipi_number: "00911223344",
        dep_share_pct: "25.00",
        drm_share_pct: "25.00",
        sync_share_pct: "25.00",
        phono_share_pct: "40.00",
        share_percentage: "25.00",
      },
    ],
  },
  {
    id: "contrat-gestion-admin-90-10",
    name: "Contrat de Gestion / Administration (90/10)",
    description:
      "Catalogue administré avec commission d'administration éditoriale déterministe de 10%.",
    admin_fee_pct: "10.00",
    splits: [
      {
        holder_name: "Léa Vasseur",
        role: "AC",
        ipi_number: "00512398741",
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
  },
  {
    id: "master-phono-80-20",
    name: "Master Phono & Droits Voisins (80/20)",
    description:
      "Répartition Producteur Phonographique (80% Master) / Artiste-Interprète (20% Royalties).",
    admin_fee_pct: "0.00",
    splits: [
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
      {
        holder_name: "Camille Moreau",
        role: "I",
        ipi_number: "00458912301",
        dep_share_pct: "50.00",
        drm_share_pct: "50.00",
        sync_share_pct: "50.00",
        phono_share_pct: "20.00",
        share_percentage: "50.00",
      },
    ],
  },
];

const DEFAULT_STATEMENT_MESSAGES: Record<string, string> = {
  paid_fr:
    "Règlement effectué par virement bancaire sous réserve d'encaissement et déduction faite des cotisations sociales et précomptes légaux.",
  paid_en:
    "Payment processed by bank transfer subject to clearance and deduction of statutory social contributions.",
  below_threshold_fr:
    "Le montant net étant inférieur au seuil de paiement minimum de {threshold} €, ce solde est conservé en réserve et reporté au décompte de la période suivante.",
  below_threshold_en:
    "As the net amount is below the minimum payment threshold of {threshold} €, this balance is held in reserve and carried forward to the next period.",
  recoupment_fr:
    "Solde débiteur reporté à nouveau sur les prochaines répartitions conformément aux conditions particulières du contrat de cession.",
  recoupment_en:
    "Debit balance carried forward to upcoming distributions in accordance with the terms of the publishing agreement.",
};

const INITIAL_SETTINGS: WorkspaceSettings = {
  id: "99999999-9999-9999-9999-999999999901",
  publisher_name: "Éditions Solstices Music",
  publisher_ipi: "00891234567",
  publisher_iban: "FR0830004019920005554443210",
  publisher_bic: "BNPAFRPPXXX",
  cwr_sender_code: "SOLSTICES",
  affiliated_societies: ["SACEM", "SDRM", "SCPP"],
  default_currency: "EUR",
  default_operator_email: "royalty.manager@solstices-music.fr",
  max_publisher_dep_pct: "50.00",
  default_admin_fee_pct: "10.00",
  vat_rate_pct: "10.00",
  min_payment_threshold: "50.00",
  statement_messages: DEFAULT_STATEMENT_MESSAGES,
  openrouter_model: "anthropic/claude-3.5-sonnet",
  high_confidence_threshold: 0.9,
  anomaly_threshold: 0.65,
  vector_weight: 0.45,
  lexical_weight: 0.55,
  split_presets: DEFAULT_PRESETS,
  updated_at: "2026-11-02T09:00:00Z",
};

const INITIAL_CSV_PROFILES: CSVImportProfile[] = [
  {
    id: "88888888-8888-8888-8888-888888888801",
    profile_name: "Standard SACEM / DSP (Virgule)",
    source_organism: "SACEM",
    delimiter: ",",
    decimal_separator: ".",
    default_right_type: "DEP",
    title_column: "work_title",
    iswc_column: "iswc",
    isrc_column: "isrc",
    performer_column: "performer",
    right_type_column: "right_type",
    exploitation_type_column: "exploitation_type",
    gross_amount_column: "gross_amount",
    units_column: "units",
    territory_column: "territory",
    created_at: "2026-11-02T09:00:00Z",
  },
  {
    id: "88888888-8888-8888-8888-888888888802",
    profile_name: "Export Français Point-Virgule (SACEM / SCPP Phono)",
    source_organism: "SCPP",
    delimiter: ";",
    decimal_separator: ",",
    default_right_type: "PHONO",
    title_column: "titre",
    iswc_column: "code_iswc",
    isrc_column: "code_isrc",
    performer_column: "interprete",
    right_type_column: "type_droit",
    exploitation_type_column: "exploitation",
    gross_amount_column: "montant_brut",
    units_column: "quantite",
    territory_column: "territoire",
    created_at: "2026-11-02T09:00:00Z",
  },
];

const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: "77777777-7777-7777-7777-777777777701",
    action_type: "CONTRACT_VALIDATED",
    entity_type: "CONTRACT",
    entity_id: "CTR-2026-LN01",
    actor: "directeur.juridique@solstices-music.fr",
    summary:
      "Contrat CTR-2026-LN01 (« Lumière Noire ») validé humainement et avance de 15 000 € initialisée.",
    details: {},
    created_at: "2026-10-28T16:15:00Z",
  },
  {
    id: "77777777-7777-7777-7777-777777777702",
    action_type: "STATEMENT_LINE_VALIDATED",
    entity_type: "STATEMENT_LINE",
    entity_id: "ROW-1",
    actor: "royalty.manager@solstices-music.fr",
    summary:
      "Ligne #1 « LUMIERE NOIRE » (ISWC T-301.452.891-4) validée -> 4 250,00 € alloués.",
    details: {},
    created_at: "2026-10-28T17:30:00Z",
  },
];

export default function SettingsPage() {
  const { currentEntity, refreshEntities } = useWorkspace();
  const [settings, setSettings] = useState<WorkspaceSettings>(INITIAL_SETTINGS);
  const [csvProfiles, setCsvProfiles] =
    useState<CSVImportProfile[]>(INITIAL_CSV_PROFILES);
  const [auditLogs, setAuditLogs] =
    useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  // Table des Parités de Change & Multi-Devises (US-4.5)
  const [currencyRates, setCurrencyRates] = useState<CurrencyRateItem[]>([]);
  const [editingCurrency, setEditingCurrency] = useState<CurrencyRateItem | null>(null);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
  const [currencySaving, setCurrencySaving] = useState(false);
  const [resettingRates, setResettingRates] = useState(false);

  // Simulateur de conversion déterministe
  const [simulatorAmount, setSimulatorAmount] = useState("1000.00");
  const [simulatorFrom, setSimulatorFrom] = useState("USD");
  const [simulatorTo, setSimulatorTo] = useState("EUR");
  const [simulatorCustomRate, setSimulatorCustomRate] = useState("");
  const [simulatorResult, setSimulatorResult] = useState<CurrencyConvertResponse | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Formulaire de nouveau profil CSV
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileOrganism, setNewProfileOrganism] = useState("BELIEVE_DSP");
  const [newProfileDelimiter, setNewProfileDelimiter] = useState(";");
  const [newProfileDecimal, setNewProfileDecimal] = useState(",");
  const [newProfileTitleCol, setNewProfileTitleCol] = useState("track_title");
  const [newProfileGrossCol, setNewProfileGrossCol] = useState("net_revenue");

  function loadSettingsData() {
    fetchWorkspaceSettings()
      .then((s) => {
        setSettings((prev) => ({
          ...s,
          publisher_name: currentEntity?.name || s.publisher_name,
          publisher_ipi: currentEntity?.sacem_ipi || s.publisher_ipi,
          cwr_sender_code: currentEntity?.cwr_sender_code || s.cwr_sender_code,
          publisher_iban: currentEntity?.iban || s.publisher_iban,
          publisher_bic: currentEntity?.bic || s.publisher_bic,
        }));
      })
      .catch(() => {});
    fetchCsvProfiles()
      .then((p) => {
        if (p.length > 0) setCsvProfiles(p);
      })
      .catch(() => {});
    fetchAuditLogs()
      .then((logs) => {
        if (logs.length > 0) setAuditLogs(logs);
      })
      .catch(() => {});
    fetchCurrencyParities()
      .then((rates) => {
        if (rates && rates.length > 0) setCurrencyRates(rates);
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadSettingsData();

    window.addEventListener("korom_entity_changed", loadSettingsData);
    return () => {
      window.removeEventListener("korom_entity_changed", loadSettingsData);
    };
  }, [currentEntity]);

  function handleOpenEditCurrency(curr?: CurrencyRateItem) {
    if (curr) {
      setEditingCurrency({ ...curr });
    } else {
      setEditingCurrency({
        currency: "",
        label: "",
        symbol: "",
        rate_to_eur: "1.000000",
        rate_bce: "1.000000",
        source: "Manuel",
        last_updated: new Date().toISOString().split("T")[0],
      });
    }
    setIsCurrencyModalOpen(true);
  }

  function handleCurrencyRateChange(field: "rate_to_eur" | "rate_bce", value: string) {
    if (!editingCurrency) return;
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      if (field === "rate_to_eur") {
        const reciprocal = (1 / num).toFixed(6);
        setEditingCurrency({
          ...editingCurrency,
          rate_to_eur: value,
          rate_bce: reciprocal,
        });
      } else {
        const reciprocal = (1 / num).toFixed(6);
        setEditingCurrency({
          ...editingCurrency,
          rate_bce: value,
          rate_to_eur: reciprocal,
        });
      }
    } else {
      setEditingCurrency({
        ...editingCurrency,
        [field]: value,
      });
    }
  }

  async function handleSaveCurrency(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCurrency || !editingCurrency.currency.trim()) return;
    setCurrencySaving(true);
    try {
      const updated = await updateCurrencyParity(editingCurrency);
      setCurrencyRates((prev) => {
        const idx = prev.findIndex((c) => c.currency === updated.currency);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [...prev, updated];
      });
      setIsCurrencyModalOpen(false);
      setEditingCurrency(null);
      setSavedBanner(`Parité de change ${updated.currency} (${updated.label}) mise à jour avec succès.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur de sauvegarde de la parité";
      alert(msg);
    } finally {
      setCurrencySaving(false);
    }
  }

  async function handleResetBceRates() {
    if (!confirm("Voulez-vous réinitialiser toutes les parités de change aux taux BCE officiels de référence ?")) {
      return;
    }
    setResettingRates(true);
    try {
      const bceRates = await resetCurrencyParitiesToBce();
      setCurrencyRates(bceRates);
      setSavedBanner("Parités de change réinitialisées avec succès aux cours BCE officiels (Fixing EUR).");
    } catch {
      alert("Échec de la réinitialisation des cours BCE.");
    } finally {
      setResettingRates(false);
    }
  }

  async function handleSimulateConversion() {
    setIsSimulating(true);
    try {
      const res = await convertCurrencyAmount({
        amount: simulatorAmount,
        from_currency: simulatorFrom,
        to_currency: simulatorTo,
        custom_rate: simulatorCustomRate.trim() || undefined,
      });
      setSimulatorResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur de conversion";
      alert(msg);
    } finally {
      setIsSimulating(false);
    }
  }

  function handleVectorWeightChange(val: number) {
    const vWeight = Math.round(val * 100) / 100;
    const lWeight = Math.round((1 - vWeight) * 100) / 100;
    setSettings((prev) => ({
      ...prev,
      vector_weight: vWeight,
      lexical_weight: lWeight,
    }));
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedBanner(null);
    try {
      const currentSteps = settings.onboarding_completed_steps || [];
      const updatedSteps = currentSteps.includes("step_identity")
        ? currentSteps
        : [...currentSteps, "step_identity"];
      const { id: _id, updated_at: _u, ...payload } = {
        ...settings,
        onboarding_completed_steps: updatedSteps,
      };
      const updated = await updateWorkspaceSettings(payload);
      setSettings(updated);

      if (currentEntity) {
        try {
          await updateEntity(currentEntity.id, {
            name: settings.publisher_name,
            sacem_ipi: settings.publisher_ipi,
            cwr_sender_code: settings.cwr_sender_code,
            iban: settings.publisher_iban,
            bic: settings.publisher_bic,
          });
          await refreshEntities();
          window.dispatchEvent(new Event("korom_entity_changed"));
        } catch (entErr) {
          console.error("Erreur sync entity:", entErr);
        }
      }

      setSavedBanner(
        "Configuration éditeur, règles CWR et seuils IA enregistrés avec succès."
      );
      const logs = await fetchAuditLogs();
      if (logs.length > 0) setAuditLogs(logs);
    } catch {
      // Sauvegarde locale dans localStorage si hors-ligne
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "rightscopilot_settings",
          JSON.stringify(settings)
        );
      }
      setSavedBanner(
        "Configuration enregistrée localement (active sur le Catalogue, l'Export CWR et la Réconciliation)."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCsvProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    const payload = {
      profile_name: newProfileName.trim(),
      source_organism: newProfileOrganism,
      delimiter: newProfileDelimiter,
      decimal_separator: newProfileDecimal,
      default_right_type: "DRM",
      title_column: newProfileTitleCol,
      iswc_column: "iswc",
      isrc_column: "isrc",
      performer_column: "artist",
      right_type_column: "right_type",
      exploitation_type_column: "exploitation_type",
      gross_amount_column: newProfileGrossCol,
      units_column: "streams",
      territory_column: "country",
    };
    try {
      const created = await createCsvProfile(payload);
      setCsvProfiles((prev) => [...prev, created]);
    } catch {
      setCsvProfiles((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...payload,
        },
      ]);
    }
    setNewProfileName("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center border-b pb-3.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-micro text-[28px] font-bold tracking-tight text-foreground leading-none">
              Configuration &amp; Personnalisation Éditeur
            </h1>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              Paramètres &amp; Règles Métier
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Paramétrez votre identité CWR/OGC, vos règles statutaires déterministes, vos seuils IA Human-in-the-loop et vos profils d&apos;import CSV.
          </p>
          {currentEntity && (
            <div className="pt-1 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-2xs"
                style={{
                  borderColor: `${currentEntity.color || "#8B5CF6"}40`,
                  backgroundColor: `${currentEntity.color || "#8B5CF6"}15`,
                  color: currentEntity.color || "#8B5CF6",
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: currentEntity.color || "#8B5CF6" }}
                />
                <span>Catalogue actif configuré : {currentEntity.name}</span>
                <span className="font-mono text-[10px] opacity-75">
                  • IPI {currentEntity.sacem_ipi}
                </span>
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <Save className="h-3.5 w-3.5" />
          <span>
            {saving
              ? "Enregistrement..."
              : "Enregistrer toute la configuration"}
          </span>
        </button>
      </div>

      {savedBanner && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{savedBanner}</span>
        </div>
      )}

      {/* Volet 1 & 2 : Identité Éditeur / Règles CWR + Seuils IA & Smart Matching */}
      <form
        onSubmit={handleSaveSettings}
        className="grid gap-4 lg:grid-cols-2"
      >
        {/* Carte 1 : Identité Éditeur & Règles Déterministes */}
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3.5">
          <div className="flex items-center gap-2 border-b pb-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold">
              1. Identité Éditeur, Règles CWR & Fiscalité
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">
                Nom de la Maison d&apos;Édition / Label Principal
              </label>
              <input
                type="text"
                value={settings.publisher_name}
                onChange={(e) =>
                  setSettings({ ...settings, publisher_name: e.target.value })
                }
                className="w-full rounded-md border px-2.5 py-1.5 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Code IPI Éditeur (9–11 chiffres)
              </label>
              <input
                type="text"
                value={settings.publisher_ipi}
                onChange={(e) =>
                  setSettings({ ...settings, publisher_ipi: e.target.value })
                }
                className="w-full rounded-md border px-2.5 py-1.5 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Code Émetteur CWR v2.1 (HDR)
              </label>
              <input
                type="text"
                value={settings.cwr_sender_code}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    cwr_sender_code: e.target.value.toUpperCase(),
                  })
                }
                className="w-full rounded-md border px-2.5 py-1.5 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                IBAN Débiteur Éditeur (Virements SEPA pain.001)
              </label>
              <input
                type="text"
                placeholder="FR76 3000 4019 9200 0555 4443 210"
                value={settings.publisher_iban || ""}
                onChange={(e) =>
                  setSettings({ ...settings, publisher_iban: e.target.value.toUpperCase() })
                }
                className="w-full rounded-md border px-2.5 py-1.5 font-mono text-xs uppercase"
              />
              <span className="text-[11px] text-muted-foreground">
                Compte émetteur pour la télétransmission bancaire ISO 20022
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                BIC / SWIFT Banque Éditeur
              </label>
              <input
                type="text"
                placeholder="BNPAFRPPXXX"
                value={settings.publisher_bic || ""}
                onChange={(e) =>
                  setSettings({ ...settings, publisher_bic: e.target.value.toUpperCase() })
                }
                className="w-full rounded-md border px-2.5 py-1.5 font-mono text-xs uppercase"
              />
              <span className="text-[11px] text-muted-foreground">
                Code banque ISO 9362 (8 ou 11 caractères)
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Plafond Éditorial DEP (%)
              </label>
              <input
                type="text"
                value={settings.max_publisher_dep_pct}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    max_publisher_dep_pct: e.target.value,
                  })
                }
                className="w-full rounded-md border px-2.5 py-1.5 font-mono text-xs"
              />
              <span className="text-[11px] text-muted-foreground">
                Statut Sacem standard = 50.00 %
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Commission Contrat de Gestion (%)
              </label>
              <input
                type="text"
                value={settings.default_admin_fee_pct}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    default_admin_fee_pct: e.target.value,
                  })
                }
                className="w-full rounded-md border px-2.5 py-1.5 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Taux de TVA sur Relevés (%)
              </label>
              <input
                type="text"
                value={settings.vat_rate_pct}
                onChange={(e) =>
                  setSettings({ ...settings, vat_rate_pct: e.target.value })
                }
                className="w-full rounded-md border px-2.5 py-1.5 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Email Opérateur Human-in-the-loop
              </label>
              <input
                type="email"
                value={settings.default_operator_email}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    default_operator_email: e.target.value,
                  })
                }
                className="w-full rounded-md border px-2.5 py-1.5 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Carte 2 : Seuils IA & Pondération du Smart Matching */}
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3.5">
          <div className="flex items-center gap-2 border-b pb-2">
            <Sliders className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold">
              2. Seuils IA, OpenRouter & Pondération Smart Matching
            </h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1">
                Modèle LLM OpenRouter (Parsing PDF Contrats uniquement)
              </label>
              <select
                value={settings.openrouter_model}
                onChange={(e) =>
                  setSettings({ ...settings, openrouter_model: e.target.value })
                }
                className="w-full rounded-md border bg-card px-2.5 py-1.5 font-mono text-xs"
              >
                <option value="anthropic/claude-3.5-sonnet">
                  anthropic/claude-3.5-sonnet (Haute Précision Juridique ~0,004 $/contrat)
                </option>
                <option value="openai/gpt-4o-mini">
                  openai/gpt-4o-mini (Éco-Budget 10 € : ~0,0002 $/contrat)
                </option>
                <option value="google/gemini-2.5-flash">
                  google/gemini-2.5-flash (Ultra-Rapide & Éco-Budget 10 €)
                </option>
                <option value="mistralai/mistral-large-2411">
                  mistralai/mistral-large-2411 (Souverain FR / EU)
                </option>
                <option value="meta-llama/llama-3.3-70b-instruct">
                  meta-llama/llama-3.3-70b-instruct (Open-Weights via OpenRouter)
                </option>
              </select>
              <p className="mt-1 text-[11px] text-emerald-700 font-medium">
                Clé OpenRouter (.env) connectée sur <code className="font-mono">https://openrouter.ai/api/v1</code> • Protection du budget 10 € (~$11.13) activée : cache SHA-256, plafond <code className="font-mono">max_tokens=1200</code>, et 0 appel LLM sur la réconciliation CSV.
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span>Seuil de Haute Confiance (Validation en lot)</span>
                <span className="font-mono font-bold text-emerald-700">
                  {Math.round(settings.high_confidence_threshold * 100)} %
                </span>
              </div>
              <input
                type="range"
                min={0.7}
                max={0.99}
                step={0.01}
                value={settings.high_confidence_threshold}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    high_confidence_threshold: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-emerald-600"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span>Seuil d&apos;Alerte Anomalie / Black Box</span>
                <span className="font-mono font-bold text-rose-600">
                  {Math.round(settings.anomaly_threshold * 100)} %
                </span>
              </div>
              <input
                type="range"
                min={0.3}
                max={0.85}
                step={0.01}
                value={settings.anomaly_threshold}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    anomaly_threshold: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-rose-600"
              />
            </div>

            <div className="space-y-1 pt-1.5 border-t">
              <div className="flex justify-between text-xs font-medium">
                <span>
                  Équilibre Smart Matching (Embeddings Cosinus vs Lexical Fuzzy)
                </span>
                <span className="font-mono text-primary font-bold">
                  {Math.round(settings.vector_weight * 100)}% Vector /{" "}
                  {Math.round(settings.lexical_weight * 100)}% Lexical
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.05}
                value={settings.vector_weight}
                onChange={(e) =>
                  handleVectorWeightChange(parseFloat(e.target.value))
                }
                className="w-full accent-primary"
              />
            </div>
          </div>
        </div>

        {/* Carte 3 : Clôture Comptable & Mentions Légales Conditionnelles (US-2.1, US-2.2, US-2.3) */}
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3.5 lg:col-span-2">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <div>
                <h2 className="text-sm font-bold">
                  3. Clôture Comptable, Seuil de Paiement &amp; Mentions Légales Conditionnelles
                </h2>
                <p className="text-xs text-muted-foreground">
                  Gestion déterministe des réserves sous-seuil (Report à nouveau) et personnalisation des messages de décomptes (FR/EN).
                </p>
              </div>
            </div>
            <span className="rounded-full bg-primary/10 border border-primary/30 px-2 py-0.5 text-[11px] font-semibold text-primary">
              CPI L132-13 &amp; Factur-X
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-medium mb-1">
                Seuil Minimal de Paiement (€)
              </label>
              <input
                type="text"
                value={settings.min_payment_threshold || "50.00"}
                onChange={(e) =>
                  setSettings({ ...settings, min_payment_threshold: e.target.value })
                }
                className="w-full rounded-md border px-2.5 py-1.5 font-mono text-xs"
              />
              <span className="text-[11px] text-muted-foreground">
                En-deçà, le montant net est conservé en réserve et reporté à nouveau (défaut : 50,00 €)
              </span>
            </div>

            <div className="sm:col-span-1 lg:col-span-2 text-xs text-muted-foreground flex items-center bg-muted/20 rounded-lg p-2.5 border">
              <p>
                <strong>Principe de continuité comptable :</strong> Lorsqu&apos;un ayant droit totalise moins que le seuil de paiement sur un semestre, son solde est mis en réserve (statut « En réserve ») et reporté sur le décompte suivant. Dès que le seuil est franchi, l&apos;intégralité de la réserve accumulée est débloquée et apurée.
              </p>
            </div>
          </div>

          {/* Messages conditionnels FR / EN */}
          <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t">
            {/* Mention Règlement Validé (Payable) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Mention Décompte — Règlement Effectué (FR)
              </label>
              <textarea
                rows={2}
                value={settings.statement_messages?.paid_fr ?? DEFAULT_STATEMENT_MESSAGES.paid_fr}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    statement_messages: {
                      ...(settings.statement_messages || DEFAULT_STATEMENT_MESSAGES),
                      paid_fr: e.target.value,
                    },
                  })
                }
                className="w-full rounded-md border px-2.5 py-1.5 text-xs text-foreground bg-card"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Statement Note — Payment Processed (EN)
              </label>
              <textarea
                rows={2}
                value={settings.statement_messages?.paid_en ?? DEFAULT_STATEMENT_MESSAGES.paid_en}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    statement_messages: {
                      ...(settings.statement_messages || DEFAULT_STATEMENT_MESSAGES),
                      paid_en: e.target.value,
                    },
                  })
                }
                className="w-full rounded-md border px-2.5 py-1.5 text-xs text-foreground bg-card"
              />
            </div>

            {/* Mention En réserve sous le seuil */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Mention Décompte — Sous le Seuil Minimal (FR)
              </label>
              <textarea
                rows={2}
                value={settings.statement_messages?.below_threshold_fr ?? DEFAULT_STATEMENT_MESSAGES.below_threshold_fr}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    statement_messages: {
                      ...(settings.statement_messages || DEFAULT_STATEMENT_MESSAGES),
                      below_threshold_fr: e.target.value,
                    },
                  })
                }
                className="w-full rounded-md border px-2.5 py-1.5 text-xs text-foreground bg-card"
              />
              <span className="text-[10px] text-muted-foreground">
                Utilisez <code className="font-mono text-primary font-bold">{"{threshold}"}</code> pour insérer dynamiquement le montant du seuil.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Statement Note — Below Minimum Threshold (EN)
              </label>
              <textarea
                rows={2}
                value={settings.statement_messages?.below_threshold_en ?? DEFAULT_STATEMENT_MESSAGES.below_threshold_en}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    statement_messages: {
                      ...(settings.statement_messages || DEFAULT_STATEMENT_MESSAGES),
                      below_threshold_en: e.target.value,
                    },
                  })
                }
                className="w-full rounded-md border px-2.5 py-1.5 text-xs text-foreground bg-card"
              />
              <span className="text-[10px] text-muted-foreground">
                Use <code className="font-mono text-primary font-bold">{"{threshold}"}</code> for dynamic threshold insertion.
              </span>
            </div>

            {/* Mention Amortissement Avance en cours */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Mention Décompte — Solde Débiteur / Avance en Amortissement (FR)
              </label>
              <textarea
                rows={2}
                value={settings.statement_messages?.recoupment_fr ?? DEFAULT_STATEMENT_MESSAGES.recoupment_fr}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    statement_messages: {
                      ...(settings.statement_messages || DEFAULT_STATEMENT_MESSAGES),
                      recoupment_fr: e.target.value,
                    },
                  })
                }
                className="w-full rounded-md border px-2.5 py-1.5 text-xs text-foreground bg-card"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Statement Note — Debit Balance / Advance Recoupment (EN)
              </label>
              <textarea
                rows={2}
                value={settings.statement_messages?.recoupment_en ?? DEFAULT_STATEMENT_MESSAGES.recoupment_en}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    statement_messages: {
                      ...(settings.statement_messages || DEFAULT_STATEMENT_MESSAGES),
                      recoupment_en: e.target.value,
                    },
                  })
                }
                className="w-full rounded-md border px-2.5 py-1.5 text-xs text-foreground bg-card"
              />
            </div>
          </div>
        </div>
      </form>

      {/* Volet 4 : Templates de Répartition (Split Presets) */}
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 border-b pb-2">
          <Layers className="h-4 w-4 text-primary" />
          <div>
            <h2 className="text-sm font-bold">
              4. Modèles de Répartition Favoris (Split Presets en 1 clic)
            </h2>
            <p className="text-xs text-muted-foreground">
              Ces modèles sont disponibles en 1 clic lors de la création ou de la correction d&apos;une œuvre dans le Catalogue.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {settings.split_presets.map((preset) => (
            <div
              key={preset.id}
              className="rounded-lg border bg-muted/20 p-3 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs">{preset.name}</h3>
                {Number(preset.admin_fee_pct) > 0 && (
                  <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    Admin Fee {preset.admin_fee_pct}%
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {preset.description}
              </p>
              <div className="space-y-1 pt-0.5">
                {preset.splits.map((sp, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded bg-card px-2.5 py-1 text-[11px] font-mono border"
                  >
                    <span>
                      <strong>{sp.holder_name}</strong> ({sp.role})
                    </span>
                    <span>
                      DEP {sp.dep_share_pct}% | DRM {sp.drm_share_pct}% | SYNC{" "}
                      {sp.sync_share_pct || "0.00"}% | PHONO{" "}
                      {sp.phono_share_pct || "0.00"}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Volet 5 : Profils de Mapping de Colonnes CSV */}
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 border-b pb-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          <div>
            <h2 className="text-sm font-bold">
              5. Profils de Mapping de Colonnes CSV (Sacem, DSP, Distributeurs Phono)
            </h2>
            <p className="text-xs text-muted-foreground">
              Adaptez l&apos;ingestion aux formats CSV de chaque partenaire (séparateurs virgule ou point-virgule, noms de colonnes personnalisés).
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {csvProfiles.map((prof) => (
            <div
              key={prof.id}
              className="rounded-lg border bg-muted/20 p-3 space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs">{prof.profile_name}</span>
                <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                  {prof.source_organism} • Séparateur &laquo; {prof.delimiter} &raquo;
                </span>
              </div>
              <p className="text-[11px] font-mono text-muted-foreground">
                Titre: <strong>{prof.title_column}</strong> | ISWC:{" "}
                <strong>{prof.iswc_column}</strong> | Brut:{" "}
                <strong>{prof.gross_amount_column}</strong> | Droit:{" "}
                <strong>{prof.default_right_type}</strong>
              </p>
            </div>
          ))}
        </div>

        <form
          onSubmit={handleAddCsvProfile}
          className="grid gap-2.5 rounded-lg border bg-muted/30 p-3 sm:grid-cols-6 items-end"
        >
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-medium mb-1">
              Nom du nouveau profil CSV
            </label>
            <input
              type="text"
              placeholder="Ex: Believe Digital Phono"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              className="w-full rounded-md border bg-card px-2.5 py-1 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1">Séparateur</label>
            <select
              value={newProfileDelimiter}
              onChange={(e) => setNewProfileDelimiter(e.target.value)}
              className="w-full rounded-md border bg-card px-2 py-1 font-mono text-xs"
            >
              <option value=";">; (Point-virgule)</option>
              <option value=",">, (Virgule)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1">
              Colonne Titre
            </label>
            <input
              type="text"
              value={newProfileTitleCol}
              onChange={(e) => setNewProfileTitleCol(e.target.value)}
              className="w-full rounded-md border bg-card px-2 py-1 font-mono text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1">
              Colonne Montant
            </label>
            <input
              type="text"
              value={newProfileGrossCol}
              onChange={(e) => setNewProfileGrossCol(e.target.value)}
              className="w-full rounded-md border bg-card px-2 py-1 font-mono text-xs"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter Profil
          </button>
        </form>
      </div>

      {/* Volet 6 : Table des Parités de Change & Multi-Devises (US-4.5) */}
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3.5">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center border-b pb-2">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold">
                  6. Table des Parités de Change &amp; Multi-Devises (USD / GBP / EUR)
                </h2>
                <span className="rounded-full bg-primary/10 border border-primary/30 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Inspiré Le Sage &bull; US-4.5
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Taux de parité officiels (BCE) pour la conversion déterministe des relevés internationaux (Spotify US, Apple Worldwide, PRS, BMI, ASCAP).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetBceRates}
              disabled={resettingRates}
              className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground shadow-2xs transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${resettingRates ? "animate-spin" : ""}`} />
              <span>{resettingRates ? "Réinitialisation..." : "Réinitialiser taux BCE"}</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenEditCurrency()}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-2xs hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Ajouter une Devise</span>
            </button>
          </div>
        </div>

        {/* Grille des Devises */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {currencyRates.map((c) => (
            <div
              key={c.currency}
              className="rounded-lg border bg-muted/20 p-3 space-y-2 relative group hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-bold text-primary">
                      {c.currency} ({c.symbol})
                    </span>
                    <span className="font-semibold text-xs text-foreground">
                      {c.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    Source : {c.source || "BCE"} &bull; {c.last_updated || "Quotidien"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenEditCurrency(c)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Modifier cette parité"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t text-[11px] font-mono">
                <div className="bg-card rounded p-1.5 border">
                  <span className="text-[10px] text-muted-foreground block font-sans">
                    Cotation BCE (1 € =)
                  </span>
                  <span className="font-bold text-foreground">
                    {c.rate_bce || (c.rate_to_eur ? (1 / Number(c.rate_to_eur)).toFixed(4) : "1.0000")} {c.symbol}
                  </span>
                </div>
                <div className="bg-card rounded p-1.5 border">
                  <span className="text-[10px] text-muted-foreground block font-sans">
                    Multiplicateur (1 {c.currency} =)
                  </span>
                  <span className="font-bold text-emerald-700">
                    {Number(c.rate_to_eur).toFixed(6)} €
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Simulateur Déterministe de Conversion */}
        <div className="rounded-xl border bg-gradient-to-r from-card via-muted/20 to-card p-3.5 space-y-3">
          <div className="flex items-center gap-1.5">
            <Calculator className="h-4 w-4 text-primary" />
            <span className="font-bold text-xs text-foreground">
              Simulateur de Conversion Déterministe (Zéro Erreur d&apos;Arrondi)
            </span>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-5 items-end">
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Montant Brut
              </label>
              <input
                type="text"
                value={simulatorAmount}
                onChange={(e) => setSimulatorAmount(e.target.value)}
                className="w-full rounded-md border bg-card px-2.5 py-1 text-xs font-mono"
                placeholder="1000.00"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Devise Source
              </label>
              <select
                value={simulatorFrom}
                onChange={(e) => setSimulatorFrom(e.target.value)}
                className="w-full rounded-md border bg-card px-2 py-1 text-xs font-mono"
              >
                {currencyRates.map((c) => (
                  <option key={c.currency} value={c.currency}>
                    {c.currency} - {c.label} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-center pb-1">
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Taux Manuel (Optionnel)
              </label>
              <input
                type="text"
                value={simulatorCustomRate}
                onChange={(e) => setSimulatorCustomRate(e.target.value)}
                placeholder="Auto (Parité BCE)"
                className="w-full rounded-md border bg-card px-2.5 py-1 text-xs font-mono"
              />
            </div>

            <button
              type="button"
              onClick={handleSimulateConversion}
              disabled={isSimulating}
              className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-2xs hover:bg-primary/90"
            >
              <Calculator className="h-3.5 w-3.5" />
              <span>{isSimulating ? "Calcul..." : "Simuler"}</span>
            </button>
          </div>

          {simulatorResult && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-foreground">
                  {Number(simulatorResult.source_amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {simulatorResult.source_currency}
                </span>
                <span className="text-muted-foreground">&rarr;</span>
                <span className="font-mono text-base font-bold text-emerald-800">
                  {Number(simulatorResult.target_amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {simulatorResult.target_currency}
                </span>
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">
                Taux appliqué : <strong>{simulatorResult.effective_rate}</strong>
                {simulatorResult.rate_bce && (
                  <span> &bull; (1 € = {simulatorResult.rate_bce} {simulatorResult.source_currency})</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Volet 7 : Journal d'Audit Human-in-the-loop */}
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2.5">
        <div className="flex items-center gap-2 border-b pb-2">
          <History className="h-4 w-4 text-primary" />
          <div>
            <h2 className="text-sm font-bold">
              7. Journal d&apos;Audit Human-in-the-loop (Audit Trail)
            </h2>
            <p className="text-xs text-muted-foreground">
              Traçabilité immuable des validations humaines de contrats, rapprochements CSV et modifications de règles.
            </p>
          </div>
        </div>

        <div className="divide-y">
          {auditLogs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col justify-between gap-1.5 py-2 sm:flex-row sm:items-center text-xs"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                    {log.action_type}
                  </span>
                  <span className="font-medium text-foreground">
                    {log.summary}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Opérateur : <strong>{log.actor}</strong>
                </p>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                {new Date(log.created_at).toLocaleString("fr-FR")}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Modale d'édition / ajout d'une Parité de Change */}
      {isCurrencyModalOpen && editingCurrency && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="relative w-full max-w-md rounded-2xl border bg-card p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm text-foreground">
                  {editingCurrency.currency ? `Ajuster la Parité ${editingCurrency.currency}` : "Ajouter une Devise"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCurrencyModalOpen(false);
                  setEditingCurrency(null);
                }}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCurrency} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Code ISO Devise (3 lettres)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    value={editingCurrency.currency}
                    onChange={(e) =>
                      setEditingCurrency({
                        ...editingCurrency,
                        currency: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full rounded-md border bg-card px-2.5 py-1.5 font-mono text-xs uppercase"
                    placeholder="USD"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Symbole Monétaire
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={5}
                    value={editingCurrency.symbol}
                    onChange={(e) =>
                      setEditingCurrency({
                        ...editingCurrency,
                        symbol: e.target.value,
                      })
                    }
                    className="w-full rounded-md border bg-card px-2.5 py-1.5 font-mono text-xs"
                    placeholder="$"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  Nom Complet / Libellé
                </label>
                <input
                  type="text"
                  required
                  value={editingCurrency.label}
                  onChange={(e) =>
                    setEditingCurrency({
                      ...editingCurrency,
                      label: e.target.value,
                    })
                  }
                  className="w-full rounded-md border bg-card px-2.5 py-1.5 text-xs"
                  placeholder="Dollar américain"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 p-3 rounded-lg bg-muted/20 border">
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Taux Multiplicateur vers EUR (1 Devise = X €)
                  </label>
                  <input
                    type="text"
                    required
                    value={editingCurrency.rate_to_eur}
                    onChange={(e) => handleCurrencyRateChange("rate_to_eur", e.target.value)}
                    className="w-full rounded-md border bg-card px-2.5 py-1.5 font-mono text-xs font-bold text-emerald-700"
                    placeholder="0.921659"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Cotation BCE (1 € = Y Devises)
                  </label>
                  <input
                    type="text"
                    value={editingCurrency.rate_bce || ""}
                    onChange={(e) => handleCurrencyRateChange("rate_bce", e.target.value)}
                    className="w-full rounded-md border bg-card px-2.5 py-1.5 font-mono text-xs font-bold text-foreground"
                    placeholder="1.085000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  Source / Organisme de Cotation
                </label>
                <input
                  type="text"
                  value={editingCurrency.source || ""}
                  onChange={(e) =>
                    setEditingCurrency({
                      ...editingCurrency,
                      source: e.target.value,
                    })
                  }
                  className="w-full rounded-md border bg-card px-2.5 py-1.5 text-xs"
                  placeholder="Banque Centrale Européenne (BCE)"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setIsCurrencyModalOpen(false);
                    setEditingCurrency(null);
                  }}
                  className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={currencySaving}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  {currencySaving ? "Enregistrement..." : "Enregistrer la Parité"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
