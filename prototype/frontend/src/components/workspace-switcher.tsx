"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Check,
  ChevronDown,
  LayoutGrid,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { useWorkspace } from "@/context/workspace-context";
import { PublishingEntityCreatePayload } from "@/types/api";

const PRESET_COLORS = [
  "#3B82F6", // Bleu
  "#8B5CF6", // Violet
  "#10B981", // Émeraude
  "#F59E0B", // Ambre
  "#EC4899", // Rose
  "#6366F1", // Indigo
];

export function WorkspaceSwitcher() {
  const {
    entities,
    currentEntity,
    switchEntity,
    createEntity,
    deleteEntity,
    setIsGatewayOpen,
  } = useWorkspace();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [entityToDelete, setEntityToDelete] = useState<any | null>(null);
  const [isDeletingEntity, setIsDeletingEntity] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Formulaire de création
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [sacemIpi, setSacemIpi] = useState("");
  const [sacemAccountNumber, setSacemAccountNumber] = useState("");
  const [cwrSenderCode, setCwrSenderCode] = useState("");
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fermeture au clic extérieur
  useEffect(() => {
    setMounted(true);
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      setIsOpen(false);
      // Reset form
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

  if (!currentEntity) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton principal de bascule Navbar */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="group flex items-center gap-2 rounded-xl border border-border/80 bg-card hover:bg-muted/70 px-3 py-1.5 text-xs font-semibold text-foreground transition-all duration-150 shadow-2xs cursor-pointer"
        title="Basculer de catalogue / entité éditoriale"
      >
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0 shadow-xs"
          style={{ backgroundColor: currentEntity.color || "#3B82F6" }}
        />
        <span className="font-micro tracking-tight truncate max-w-[130px] sm:max-w-[160px]">
          {currentEntity.name}
        </span>
        <ChevronDown
          className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Menu déroulant */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-border bg-card p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1.5 border-b mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Catalogues &amp; Sociétés ({entities.length})
            </span>
            <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[9px] font-mono font-bold text-primary">
              Multi-Entités
            </span>
          </div>

          {/* Liste des entités disponibles */}
          <div className="space-y-1 max-h-60 overflow-y-auto pr-0.5">
            {entities.map((entity) => {
              const isSelected = entity.id === currentEntity.id;
              return (
                <button
                  key={entity.id}
                  type="button"
                  onClick={() => {
                    switchEntity(entity.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${
                    isSelected
                      ? "bg-primary/10 text-primary font-bold border border-primary/25"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="h-3 w-3 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: entity.color || "#3B82F6" }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs truncate font-semibold leading-tight">
                        {entity.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
                        IPI : {entity.sacem_ipi} • {entity.works_count} œuvre(s)
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    )}
                    {entities.length > 1 && (
                      <span
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsOpen(false);
                          setEntityToDelete(entity);
                        }}
                        className="p-1 rounded text-muted-foreground/40 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Supprimer ce profil éditorial"
                      >
                        <Trash2 className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Actions : Ajouter une entité & Écran d'accueil Gateway */}
          <div className="pt-2 mt-1 border-t space-y-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsCreateModalOpen(true);
              }}
              className="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Créer une nouvelle entité...</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsGatewayOpen(true);
                router.push("/?gateway=true");
              }}
              className="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Écran d&apos;accueil des catalogues</span>
            </button>
          </div>
        </div>
      )}

      {/* Modale de création d'entité éditoriale - Centrée au milieu de l'écran avec scroll fluide */}
      {isCreateModalOpen && mounted && createPortal(
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
        </div>,
        document.body
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
