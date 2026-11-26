"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Music,
  User,
  Building,
  Wand2,
} from "lucide-react";

import {
  StatementLineMatch,
  RightHolderSplit,
  RightHolderRole,
} from "@/types/api";
import { createWorkAndMatchStatementLine, fetchRightHolders } from "@/lib/api";

interface BlackBoxCreateModalProps {
  isOpen: boolean;
  line: StatementLineMatch | null;
  onClose: () => void;
  onWorkCreatedAndMatched: (
    matchedLine: StatementLineMatch,
    workTitle: string,
    iswc?: string | null
  ) => void;
}

export function BlackBoxCreateModal({
  isOpen,
  line,
  onClose,
  onWorkCreatedAndMatched,
}: BlackBoxCreateModalProps) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [performers, setPerformers] = useState("");
  const [isrc, setIsrc] = useState("");
  const [iswc, setIswc] = useState("");
  const [sacemCode, setSacemCode] = useState("");
  const [cotage, setCotage] = useState("");
  const [genre, setGenre] = useState("Pop / Variété");
  const [splits, setSplits] = useState<RightHolderSplit[]>([]);
  const [directoryHolders, setDirectoryHolders] = useState<
    Array<{ name: string; ipi_number?: string | null; role?: string | null }>
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Charger les ayants droit du répertoire pour l'autocomplétion
  useEffect(() => {
    if (!isOpen) return;
    fetchRightHolders()
      .then((holders) => {
        setDirectoryHolders(
          holders.map((h) => ({
            name: h.stage_name_or_trade_name || h.full_name,
            ipi_number: h.ipi_number,
            role: h.primary_role,
          }))
        );
      })
      .catch(() => {});
  }, [isOpen]);

  // Initialisation à partir de la ligne de relevé
  useEffect(() => {
    if (!line || !isOpen) return;

    // Nettoyage intelligent du titre brut (suppression des tags (Remix), etc.)
    const cleanTitle = line.raw_work_title
      .replace(
        /\s*[\(\[](remix|live|radio edit|club mix|acoustic|bonus track|instrumental)[\)\]]/gi,
        ""
      )
      .trim();

    // Titrage propre (si TOUT EN MAJUSCULES, mise en forme Title Case)
    const formattedTitle =
      cleanTitle === cleanTitle.toUpperCase() && cleanTitle.length > 3
        ? cleanTitle
            .toLowerCase()
            .split(" ")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ")
        : cleanTitle;

    setTitle(formattedTitle);
    setSubtitle("");
    setPerformers(line.raw_performer || "");
    setIsrc(line.raw_isrc || "");
    setIswc(line.raw_iswc || "");
    setSacemCode(line.raw_sacem_code || "");
    setCotage("");
    setGenre("Pop / Variété");
    setErrorMessage(null);

    // Splits initiaux par défaut : 50% Auteur/Interprète et 50% Éditeur TF1
    const authorName = line.raw_performer?.trim() || "Auteur / Compositeur";
    const initialSplits: RightHolderSplit[] = [
      {
        holder_name: authorName,
        ipi_number: null,
        role: "AC",
        dep_share_pct: "50.00",
        drm_share_pct: "50.00",
        sync_share_pct: "50.00",
        phono_share_pct: "50.00",
        share_percentage: "50.00",
        society_name: "SACEM",
        society_de: "SACEM",
        society_dr: "SACEM",
      },
      {
        holder_name: "TF1 DROITS AUDIOVISUELS",
        ipi_number: "00123456789",
        role: "E",
        dep_share_pct: "50.00",
        drm_share_pct: "50.00",
        sync_share_pct: "50.00",
        phono_share_pct: "50.00",
        share_percentage: "50.00",
        society_name: "SACEM",
        society_de: "SACEM",
        society_dr: "SACEM",
      },
    ];
    setSplits(initialSplits);
  }, [line, isOpen]);

  if (!isOpen || !line) return null;

  // Calcul des totaux de splits
  const depTotal = splits.reduce(
    (acc, s) => acc + parseFloat(s.dep_share_pct || "0"),
    0
  );
  const drmTotal = splits.reduce(
    (acc, s) => acc + parseFloat(s.drm_share_pct || "0"),
    0
  );
  const isDepBalanced = Math.abs(100 - depTotal) < 0.01;
  const isDrmBalanced = Math.abs(100 - drmTotal) < 0.01;
  const canSubmit = isDepBalanced && isDrmBalanced && title.trim().length > 0;

  function updateSplitField(
    idx: number,
    field: keyof RightHolderSplit,
    value: string
  ) {
    setSplits((prev) => {
      const copy = [...prev];
      const updated = { ...copy[idx], [field]: value };
      if (field === "holder_name" && value.trim()) {
        const found = directoryHolders.find(
          (dh) => dh.name.toLowerCase() === value.trim().toLowerCase()
        );
        if (found) {
          if (found.ipi_number) updated.ipi_number = found.ipi_number;
          if (found.role) updated.role = found.role as RightHolderRole;
        }
      }
      copy[idx] = updated;
      return copy;
    });
  }

  function handleAddSplit() {
    setSplits((prev) => [
      ...prev,
      {
        holder_name: "",
        ipi_number: null,
        role: "C",
        dep_share_pct: "0.00",
        drm_share_pct: "0.00",
        sync_share_pct: "0.00",
        phono_share_pct: "0.00",
        share_percentage: "0.00",
        society_name: "SACEM",
        society_de: "SACEM",
        society_dr: "SACEM",
      },
    ]);
  }

  function handleRemoveSplit(idx: number) {
    setSplits((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleBalanceOnPublisher() {
    const depDiff = Math.round((100 - depTotal) * 100) / 100;
    const drmDiff = Math.round((100 - drmTotal) * 100) / 100;
    if (depDiff === 0 && drmDiff === 0) return;

    setSplits((prev) => {
      const copy = [...prev];
      let pubIdx = copy.findIndex(
        (s) =>
          s.role === "E" ||
          s.role === "PUBLISHER" ||
          s.role === "SE" ||
          s.role === "SUB_PUBLISHER"
      );
      if (pubIdx >= 0) {
        const pub = copy[pubIdx];
        const newDep = Math.max(
          0,
          Math.round((parseFloat(pub.dep_share_pct || "0") + depDiff) * 100) / 100
        );
        const newDrm = Math.max(
          0,
          Math.round((parseFloat(pub.drm_share_pct || "0") + drmDiff) * 100) / 100
        );
        copy[pubIdx] = {
          ...pub,
          dep_share_pct: newDep.toFixed(2),
          drm_share_pct: newDrm.toFixed(2),
          sync_share_pct: newDrm.toFixed(2),
          phono_share_pct: newDrm.toFixed(2),
          share_percentage: newDep.toFixed(2),
        };
      } else {
        copy.push({
          holder_name: "TF1 DROITS AUDIOVISUELS",
          ipi_number: "00123456789",
          role: "E",
          dep_share_pct: Math.max(0, depDiff).toFixed(2),
          drm_share_pct: Math.max(0, drmDiff).toFixed(2),
          sync_share_pct: Math.max(0, drmDiff).toFixed(2),
          phono_share_pct: Math.max(0, drmDiff).toFixed(2),
          share_percentage: Math.max(0, depDiff).toFixed(2),
          society_name: "SACEM",
          society_de: "SACEM",
          society_dr: "SACEM",
        });
      }
      return copy;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!line || !canSubmit) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        alternate_titles:
          line.raw_work_title.trim() !== title.trim()
            ? [line.raw_work_title.trim()]
            : [],
        performers: performers
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        isrc_codes: isrc ? [isrc.trim()] : [],
        iswc: iswc.trim() || null,
        sacem_work_code: sacemCode.trim() || null,
        cotage_number: cotage.trim() || null,
        genre: genre || "Pop / Variété",
        splits: splits.map((s) => ({
          ...s,
          holder_name: s.holder_name.trim(),
          dep_share_pct: s.dep_share_pct,
          drm_share_pct: s.drm_share_pct,
          sync_share_pct: s.sync_share_pct || "0.00",
          phono_share_pct: s.phono_share_pct || "0.00",
          share_percentage: s.dep_share_pct,
        })),
        validated_by: "Opérateur Black Box",
        review_notes: `Création d'œuvre 1-clic depuis la ligne #${line.row_number} (Black Box)`,
      };

      const statementId = line.statement_id;
      if (!statementId) {
        throw new Error("Identifiant de décompte manquant.");
      }

      const updatedLine = await createWorkAndMatchStatementLine(
        statementId,
        line.id,
        payload
      );
      onWorkCreatedAndMatched(updatedLine, title.trim(), iswc.trim() || null);
      onClose();
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Une erreur est survenue lors de la création de l'œuvre.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-2xl space-y-5">
        {/* En-tête */}
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                Passerelle Black Box 1-Clic
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                Ligne #{line.row_number} • {Number(line.gross_amount).toFixed(2)} €
              </span>
            </div>
            <h2 className="text-lg font-bold text-foreground mt-1">
              Créer l&apos;œuvre au catalogue &amp; Apparier
            </h2>
            <p className="text-xs text-muted-foreground">
              Pré-remplissage automatique depuis la ligne de relevé orpheline.
              L&apos;œuvre sera créée et la ligne passera instantanément en statut{" "}
              <strong className="text-emerald-700">VALIDATED</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Champs Métadonnées de l'œuvre */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                Titre Officiel de l&apos;Œuvre *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                Artiste(s) / Interprète(s)
              </label>
              <input
                type="text"
                value={performers}
                onChange={(e) => setPerformers(e.target.value)}
                placeholder="Ex: Camille Moreau, K-Soprano"
                className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                Genre Musical
              </label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Pop / Variété">Pop / Variété</option>
                <option value="Électro / Danse">Électro / Danse</option>
                <option value="Musique de Film / TV">Musique de Film / TV</option>
                <option value="Urbain / Hip-Hop">Urbain / Hip-Hop</option>
                <option value="Rock / Alternatif">Rock / Alternatif</option>
                <option value="Classique / Jazz">Classique / Jazz</option>
                <option value="Autre">Autre</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                Code ISRC Master
              </label>
              <input
                type="text"
                value={isrc}
                onChange={(e) => setIsrc(e.target.value)}
                placeholder="Ex: FRZ012600101"
                className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                Code ISWC Édition
              </label>
              <input
                type="text"
                value={iswc}
                onChange={(e) => setIswc(e.target.value)}
                placeholder="Ex: T-123.456.789-0"
                className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                Code SACEM (COCV)
              </label>
              <input
                type="text"
                value={sacemCode}
                onChange={(e) => setSacemCode(e.target.value)}
                placeholder="Ex: 11178557376"
                className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                N° de Cotage Éditeur
              </label>
              <input
                type="text"
                value={cotage}
                onChange={(e) => setCotage(e.target.value)}
                placeholder="Ex: COT-2026-001"
                className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Section Quotes-Parts & Splits */}
          <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Quotes-Parts &amp; Ayants Droit (100.00 %)
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isDepBalanced && isDrmBalanced
                      ? "bg-emerald-500/10 text-emerald-800 border border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-800 border border-amber-500/30"
                  }`}
                >
                  DEP : {depTotal.toFixed(2)}% • DRM : {drmTotal.toFixed(2)}%
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {(!isDepBalanced || !isDrmBalanced) && (
                  <button
                    type="button"
                    onClick={handleBalanceOnPublisher}
                    className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-1 text-[11px] font-bold text-foreground hover:bg-accent"
                  >
                    <Wand2 className="h-3 w-3 text-primary" />
                    Équilibrer sur éditeur
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddSplit}
                  className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-3 w-3" />
                  Ajouter ayant droit
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {splits.map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-lg border bg-card p-2 text-xs"
                >
                  <div className="flex-1">
                    <input
                      type="text"
                      list="directory-holders-list"
                      required
                      placeholder="Nom ayant droit..."
                      value={s.holder_name}
                      onChange={(e) =>
                        updateSplitField(idx, "holder_name", e.target.value)
                      }
                      className="w-full rounded border bg-background px-2 py-1 text-xs font-medium"
                    />
                    {s.ipi_number && (
                      <span className="text-[10px] text-emerald-700 font-mono block mt-0.5">
                        IPI : {s.ipi_number}
                      </span>
                    )}
                  </div>

                  <select
                    value={s.role}
                    onChange={(e) =>
                      updateSplitField(idx, "role", e.target.value as RightHolderRole)
                    }
                    className="rounded border bg-background px-2 py-1 text-xs font-mono font-bold w-20"
                  >
                    <option value="AC">AC (A/C)</option>
                    <option value="A">A (Auteur)</option>
                    <option value="C">C (Comp.)</option>
                    <option value="E">E (Éditeur)</option>
                    <option value="SE">SE (Sous-Éd.)</option>
                    <option value="P">P (Producteur)</option>
                    <option value="I">I (Interprète)</option>
                  </select>

                  <div className="flex items-center gap-1 w-24">
                    <span className="text-[10px] text-muted-foreground font-bold">
                      DEP%
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={s.dep_share_pct}
                      onChange={(e) =>
                        updateSplitField(idx, "dep_share_pct", e.target.value)
                      }
                      className="w-full rounded border bg-background px-1.5 py-1 text-xs font-mono text-right"
                    />
                  </div>

                  <div className="flex items-center gap-1 w-24">
                    <span className="text-[10px] text-muted-foreground font-bold">
                      DRM%
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={s.drm_share_pct}
                      onChange={(e) =>
                        updateSplitField(idx, "drm_share_pct", e.target.value)
                      }
                      className="w-full rounded border bg-background px-1.5 py-1 text-xs font-mono text-right"
                    />
                  </div>

                  {splits.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSplit(idx)}
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <datalist id="directory-holders-list">
              {directoryHolders.map((dh, i) => (
                <option key={i} value={dh.name} />
              ))}
            </datalist>
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-xs text-muted-foreground">
              {!canSubmit && (
                <span className="text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Les parts DEP et DRM doivent valoir exactement 100.00 %.
                </span>
              )}
              {canSubmit && (
                <span className="text-emerald-700 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Prêt pour création &amp; validation immédiate.
                </span>
              )}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!canSubmit || isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>
                  {isSubmitting
                    ? "Création & Appariement..."
                    : "Créer l'Œuvre & Apparier (VALIDÉ)"}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
