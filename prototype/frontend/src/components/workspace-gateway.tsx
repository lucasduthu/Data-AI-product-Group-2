"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Check,
  Disc3,
  FileText,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { KoromKLogo } from "@/components/korom-logo";
import { useWorkspace } from "@/context/workspace-context";
import { PublishingEntity, PublishingEntityCreatePayload } from "@/types/api";

const PRESET_COLORS = [
  "#8B5CF6", // Violet
  "#3B82F6", // Bleu
  "#10B981", // Émeraude
  "#F59E0B", // Ambre
  "#EC4899", // Rose
  "#6366F1", // Indigo
];

export function WorkspaceGateway() {
  const {
    entities,
    currentEntity,
    switchEntity,
    createEntity,
    deleteEntity,
    setIsGatewayOpen,
  } = useWorkspace();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [entityToDelete, setEntityToDelete] = useState<PublishingEntity | null>(null);
  const [isDeletingEntity, setIsDeletingEntity] = useState(false);

  function handleSelectEntity(id: string) {
    switchEntity(id);
    setIsGatewayOpen(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("gateway");
      window.history.replaceState({}, "", url.pathname);
    }
  }

  function handleCloseGateway() {
    setIsGatewayOpen(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("gateway");
      window.history.replaceState({}, "", url.pathname);
    }
  }

  async function handleConfirmDelete() {
    if (!entityToDelete) return;
    setIsDeletingEntity(true);
    try {
      await deleteEntity(entityToDelete.id);
      setEntityToDelete(null);
    } catch (err: any) {
      alert("Erreur lors de la suppression du catalogue : " + (err.message || err));
    } finally {
      setIsDeletingEntity(false);
    }
  }

  // Form state
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [sacemIpi, setSacemIpi] = useState("");
  const [sacemAccountNumber, setSacemAccountNumber] = useState("");
  const [cwrSenderCode, setCwrSenderCode] = useState("");
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [color, setColor] = useState("#8B5CF6");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!name.trim()) {
      setErrorMsg("Le nom d'usage de l'entité est obligatoire.");
      return;
    }
    if (!sacemIpi.trim()) {
      setErrorMsg("Le code IPI Éditeur SACEM (11 chiffres) est obligatoire.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: PublishingEntityCreatePayload = {
        name: name.trim(),
        legal_name: legalName.trim() || undefined,
        sacem_ipi: sacemIpi.trim(),
        sacem_account_number: sacemAccountNumber.trim() || undefined,
        cwr_sender_code: (cwrSenderCode.trim() || name.trim().slice(0, 8)).toUpperCase(),
        iban: iban.trim() || undefined,
        bic: bic.trim() || undefined,
        color,
        description: description.trim() || undefined,
      };

      await createEntity(payload);
      setIsCreateModalOpen(false);
      setName("");
      setLegalName("");
      setSacemIpi("");
      setSacemAccountNumber("");
      setCwrSenderCode("");
      setIban("");
      setBic("");
      setDescription("");
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de la création.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8 max-w-5xl mx-auto">
      {/* En-tête Gateway */}
      <div className="text-center space-y-3 mb-10">
        <div className="inline-flex items-center gap-2.5 mb-1">
          <KoromKLogo size="lg" variant="solid" />
          <span className="font-micro text-3xl font-bold tracking-tight text-foreground">
            Korom
          </span>
        </div>
        <h1 className="font-micro text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
          Sélectionnez votre entité éditoriale
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          Chaque catalogue dispose de son propre code IPI Sacem, de ses liasses de contrats et de ses bases de données étanches.
        </p>
      </div>

      {/* Grille des profils éditoriaux */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 w-full">
        {entities.map((entity) => {
          const isSelected = currentEntity?.id === entity.id;
          return (
            <div
              key={entity.id}
              onClick={() => handleSelectEntity(entity.id)}
              className={`group relative flex flex-col justify-between rounded-3xl border bg-card p-6 shadow-sm transition-all duration-200 hover:shadow-md cursor-pointer ${
                isSelected
                  ? "border-primary/50 ring-2 ring-primary/20 bg-gradient-to-b from-card to-primary/[0.04]"
                  : "border-border/80 hover:border-primary/30"
              }`}
            >
              <div className="space-y-4">
                {/* En-tête de carte avec pastille, badge défaut et action de suppression */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-3.5 w-3.5 rounded-full shadow-xs"
                      style={{ backgroundColor: entity.color || "#3B82F6" }}
                    />
                    <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-muted-foreground">
                      {entity.cwr_sender_code}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {entity.is_default && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        Par défaut
                      </span>
                    )}
                    {entities.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEntityToDelete(entity);
                        }}
                        className="p-1 rounded-lg text-muted-foreground/60 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Supprimer ce profil éditorial"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Nom et description */}
                <div>
                  <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors font-micro">
                    {entity.name}
                  </h3>
                  {entity.legal_name && (
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                      {entity.legal_name}
                    </p>
                  )}
                  {entity.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                      {entity.description}
                    </p>
                  )}
                </div>

                {/* Badges d'identifiants SACEM */}
                <div className="rounded-2xl bg-muted/40 p-3 space-y-1.5 text-xs font-mono border border-border/40">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>IPI SACEM :</span>
                    <strong className="text-foreground">{entity.sacem_ipi}</strong>
                  </div>
                  {entity.sacem_account_number && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>N° Compte :</span>
                      <strong className="text-foreground">{entity.sacem_account_number}</strong>
                    </div>
                  )}
                </div>

                {/* Statistiques du catalogue */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1.5">
                    <Disc3 className="h-3.5 w-3.5 text-primary" />
                    <strong>{entity.works_count}</strong> œuvre(s)
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <strong>{entity.contracts_count}</strong> contrat(s)
                  </span>
                </div>
              </div>

              {/* Bouton d'ouverture */}
              <div className="mt-6 pt-3 border-t flex items-center justify-between text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform">
                <span>Ouvrir ce catalogue</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          );
        })}

        {/* Carte : Créer une nouvelle entité */}
        <div
          onClick={() => setIsCreateModalOpen(true)}
          className="group relative flex flex-col items-center justify-center text-center rounded-3xl border-2 border-dashed border-border/80 hover:border-primary/50 bg-card/50 hover:bg-muted/40 p-6 shadow-2xs transition-all duration-200 cursor-pointer min-h-[260px]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform mb-3 shadow-xs">
            <Plus className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
            Créer un nouveau profil
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
            Configurez une filiale ou une société co-éditrice avec son propre compte SACEM.
          </p>
        </div>
      </div>

      {/* Raccourci vers Dashboard si un profil est actif */}
      {currentEntity && (
        <div className="mt-8">
          <button
            type="button"
            onClick={handleCloseGateway}
            className="text-xs text-muted-foreground hover:text-foreground font-medium underline transition-colors cursor-pointer"
          >
            Poursuivre avec le catalogue actif ({currentEntity.name}) →
          </button>
        </div>
      )}

      {/* Modale de création d'entité éditoriale - Centrée au milieu de l'écran avec scroll fluide */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs p-4 sm:p-6 flex min-h-screen items-center justify-center animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-foreground font-micro">
                    Créer un nouveau profil éditorial
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Ajoutez une entité juridique avec son propre code IPI SACEM et catalogue cloisonné
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              {errorMsg && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700">
                  {errorMsg}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-muted-foreground">
                    Nom d&apos;usage / Marque *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ex: KAPTAIN MUSIC"
                    className="w-full rounded-xl border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-muted-foreground">
                    Dénomination Sociale
                  </label>
                  <input
                    type="text"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="ex: KAPTAIN MUSIC SAS"
                    className="w-full rounded-xl border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-muted-foreground">
                    Code IPI Société SACEM *
                  </label>
                  <input
                    type="text"
                    required
                    value={sacemIpi}
                    onChange={(e) => setSacemIpi(e.target.value)}
                    placeholder="ex: 00891234567 (11 chiffres)"
                    className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-muted-foreground">
                    N° Compte Sociétaire SACEM
                  </label>
                  <input
                    type="text"
                    value={sacemAccountNumber}
                    onChange={(e) => setSacemAccountNumber(e.target.value)}
                    placeholder="ex: SC-98745"
                    className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-muted-foreground">
                    Code Émetteur CWR v2.1
                  </label>
                  <input
                    type="text"
                    value={cwrSenderCode}
                    onChange={(e) => setCwrSenderCode(e.target.value.toUpperCase())}
                    placeholder="ex: KAPTAIN (8 car. max)"
                    className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-muted-foreground">
                    Couleur de profil
                  </label>
                  <div className="flex items-center gap-2 pt-1">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`h-6 w-6 rounded-full transition-transform cursor-pointer ${
                          color === c ? "scale-125 ring-2 ring-primary ring-offset-2" : "hover:scale-110"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-muted-foreground">
                    IBAN Débiteur Éditeur (SEPA)
                  </label>
                  <input
                    type="text"
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    placeholder="ex: FR0830004019920005554443210"
                    className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-muted-foreground">
                    BIC / SWIFT Banque Éditeur
                  </label>
                  <input
                    type="text"
                    value={bic}
                    onChange={(e) => setBic(e.target.value)}
                    placeholder="ex: BNPAFRPPXXX"
                    className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-muted-foreground">
                  Description / Ligne éditoriale
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ex: Musique d'illustration sonore & librairie TF1..."
                  className="w-full rounded-xl border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              {/* Raccourci vers Configuration */}
              <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground text-[11px]">
                  Besoin de configurer la fiscalité, TVA ou seuils IA ?
                </span>
                <Link
                  href="/settings"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline text-[11px]"
                >
                  <Settings className="h-3 w-3" />
                  <span>Aller dans Configuration</span>
                </Link>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim() || !sacemIpi.trim()}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Création en cours..." : "Créer l'entité & ouvrir"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modale d'alerte et de confirmation de suppression */}
      <ConfirmDeleteModal
        isOpen={Boolean(entityToDelete)}
        onClose={() => setEntityToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Supprimer le profil éditorial"
        itemName={entityToDelete ? `${entityToDelete.name} (IPI SACEM : ${entityToDelete.sacem_ipi})` : ""}
        description="Êtes-vous sûr de vouloir supprimer cette entité éditoriale ? Ses œuvres et contrats seront automatiquement réassignés vers le catalogue par défaut. Cette action est irréversible."
        confirmText="Supprimer ce catalogue"
        isDeleting={isDeletingEntity}
      />
    </div>
  );
}
