"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Disc3,
  FileText,
  FolderGit2,
  History,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  Tv,
  User,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { searchUniversal } from "@/lib/api";
import {
  addRecentItem,
  addRecentSearch,
  clearRecentItems,
  getRecentItems,
  getRecentSearches,
  RecentItem,
} from "@/lib/recent-history";
import {
  UnifiedSearchContractItem,
  UnifiedSearchGroupItem,
  UnifiedSearchHolderItem,
  UnifiedSearchResponse,
  UnifiedSearchWorkItem,
} from "@/types/api";

interface UniversalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FlatItem =
  | { type: "WORK"; data: UnifiedSearchWorkItem }
  | { type: "HOLDER"; data: UnifiedSearchHolderItem }
  | { type: "CONTRACT"; data: UnifiedSearchContractItem }
  | { type: "GROUP"; data: UnifiedSearchGroupItem }
  | { type: "RECENT"; data: RecentItem };

const QUICK_SEARCH_SUGGESTIONS = [
  "Fabien NATAF",
  "UNE MUSIQUE",
  "LVA MUSIQUE",
  "ERICA",
  "4770",
  "Minuit sur la Seine",
];

export function UniversalSearchModal({ isOpen, onClose }: UniversalSearchModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<UnifiedSearchResponse | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Historique dynamique des éléments récemment consultés et recherches récentes
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Charger l'historique récent dès l'ouverture
  useEffect(() => {
    if (isOpen) {
      setRecentItems(getRecentItems());
      setRecentSearches(getRecentSearches());
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } else {
      setQuery("");
      setResults(null);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Debounce de recherche universelle
  useEffect(() => {
    if (!isOpen) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setIsLoading(false);
      setSelectedIndex(0);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(() => {
      searchUniversal(trimmed, 8)
        .then((data) => {
          setResults(data);
          setSelectedIndex(0);
          addRecentSearch(trimmed);
        })
        .catch((err) => {
          console.error("Erreur recherche universelle:", err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }, 120);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  // Aplatir les résultats pour la navigation au clavier (↑ / ↓)
  const flatItems: FlatItem[] = [];
  if (query.trim() && results) {
    results.works.forEach((w) => flatItems.push({ type: "WORK", data: w }));
    results.holders.forEach((h) => flatItems.push({ type: "HOLDER", data: h }));
    results.contracts.forEach((c) => flatItems.push({ type: "CONTRACT", data: c }));
    results.groups.forEach((g) => flatItems.push({ type: "GROUP", data: g }));
  } else if (!query.trim() && recentItems.length > 0) {
    // Si la recherche est vide, les éléments récemment consultés sont directement navigables au clavier !
    recentItems.forEach((r) => flatItems.push({ type: "RECENT", data: r }));
  }

  // Navigation vers l'élément sélectionné
  function handleSelect(item: FlatItem) {
    onClose();
    switch (item.type) {
      case "WORK": {
        const url = `/catalog?work_id=${item.data.id}&search=${encodeURIComponent(item.data.title)}`;
        addRecentItem({
          id: `work-${item.data.id}`,
          type: "WORK",
          title: item.data.title,
          subtitle: item.data.sacem_work_code ? `COCV ${item.data.sacem_work_code}` : (item.data.performers?.[0] ? `Interprète: ${item.data.performers[0]}` : item.data.iswc || undefined),
          badge: "Œuvre",
          url,
        });
        router.push(url);
        break;
      }
      case "HOLDER": {
        const url = `/holders?search=${encodeURIComponent(item.data.full_name)}`;
        addRecentItem({
          id: `holder-${item.data.id}`,
          type: "HOLDER",
          title: item.data.full_name,
          subtitle: item.data.ipi_number ? `IPI ${item.data.ipi_number}` : item.data.primary_role,
          badge: "Ayant Droit",
          url,
        });
        router.push(url);
        break;
      }
      case "CONTRACT": {
        const url = `/contracts?search=${encodeURIComponent(item.data.contract_reference)}`;
        addRecentItem({
          id: `contract-${item.data.id}`,
          type: "CONTRACT",
          title: item.data.contract_reference,
          subtitle: item.data.counterparty_name ? `Cédant: ${item.data.counterparty_name}` : item.data.publisher_name,
          badge: "Contrat",
          url,
        });
        router.push(url);
        break;
      }
      case "GROUP": {
        const url = `/catalog?group=${item.data.id}`;
        addRecentItem({
          id: `group-${item.data.id}`,
          type: "GROUP",
          title: item.data.name,
          subtitle: item.data.production_company ? `Prod: ${item.data.production_company}` : (item.data.group_type === "AUDIOVISUAL" ? "Série / Fiction TV" : "Album"),
          badge: "Projet TF1",
          url,
        });
        router.push(url);
        break;
      }
      case "RECENT": {
        router.push(item.data.url);
        break;
      }
    }
  }

  function handleClearHistory() {
    clearRecentItems();
    setRecentItems([]);
  }

  // Gestion des raccourcis clavier dans la modale
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (flatItems.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % flatItems.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (flatItems.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatItems.length > 0 && flatItems[selectedIndex]) {
        handleSelect(flatItems[selectedIndex]);
      } else if (query.trim()) {
        onClose();
        router.push(`/catalog?search=${encodeURIComponent(query.trim())}`);
      }
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-4 bg-black/60 backdrop-blur-xs transition-opacity duration-150 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#8067DC]/30 bg-card shadow-2xl transition-all duration-200 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Barre de saisie Omnibar */}
        <div className="relative flex items-center border-b border-border/80 px-4 py-3.5 bg-muted/20">
          <Search className="h-5 w-5 text-[#8067DC] shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une œuvre, ISWC, COCV, un ayant droit, contrat, projet..."
            className="w-full bg-transparent text-sm sm:text-base font-medium text-foreground placeholder:text-muted-foreground focus:outline-hidden"
          />
          <div className="flex items-center gap-2 ml-2 shrink-0">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#8067DC]" />
            ) : query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Effacer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border/80 bg-muted px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>
        </div>

        {/* Zone de contenu des résultats */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto p-3 space-y-4 divide-y divide-border/40"
        >
          {/* État initial : Pas de requête saisie -> Récemment consultés & Recherches récentes */}
          {!query.trim() && (
            <div className="space-y-4 pt-1">
              {/* Section 1 : Éléments Récemment Consultés */}
              {recentItems.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span className="flex items-center gap-1.5 text-foreground font-semibold">
                      <Clock className="h-3.5 w-3.5 text-[#8067DC]" />
                      Récemment consultés ({recentItems.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleClearHistory}
                      className="text-[10px] font-medium text-muted-foreground hover:text-rose-600 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Effacer l'historique"
                    >
                      <Trash2 className="h-3 w-3" />
                      Effacer
                    </button>
                  </div>
                  <div className="space-y-1">
                    {recentItems.map((item, idx) => {
                      const isSelected = selectedIndex === idx;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelect({ type: "RECENT", data: item })}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`group flex items-center justify-between rounded-xl px-3 py-2 cursor-pointer transition-all duration-150 ${
                            isSelected
                              ? "bg-[#EFEAFF] text-[#8067DC] shadow-xs"
                              : "hover:bg-muted/50 text-foreground"
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div
                              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                                isSelected
                                  ? "bg-[#8067DC] text-white"
                                  : item.type === "WORK"
                                  ? "bg-purple-50 text-purple-600"
                                  : item.type === "HOLDER"
                                  ? "bg-blue-50 text-blue-600"
                                  : item.type === "CONTRACT"
                                  ? "bg-amber-50 text-amber-600"
                                  : "bg-emerald-50 text-emerald-600"
                              }`}
                            >
                              {item.type === "WORK" && <Disc3 className="h-4 w-4" />}
                              {item.type === "HOLDER" && <User className="h-4 w-4" />}
                              {item.type === "CONTRACT" && <FileText className="h-4 w-4" />}
                              {item.type === "GROUP" && <Tv className="h-4 w-4" />}
                            </div>
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm truncate">
                                  {item.title}
                                </span>
                                {item.badge && (
                                  <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              {item.subtitle && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {item.subtitle}
                                </div>
                              )}
                            </div>
                          </div>

                          <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-[#8067DC]" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section 2 : Dernières Recherches Textuelles */}
              {recentSearches.length > 0 && (
                <div className="pt-2 px-2 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    <History className="h-3.5 w-3.5 text-[#8067DC]" />
                    <span>Dernières recherches :</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {recentSearches.map((sq) => (
                      <button
                        key={sq}
                        type="button"
                        onClick={() => setQuery(sq)}
                        className="rounded-full border border-border/80 bg-muted/30 hover:bg-[#EFEAFF] hover:border-[#8067DC]/40 hover:text-[#8067DC] px-2.5 py-1 text-xs font-medium text-muted-foreground transition-all duration-150 cursor-pointer"
                      >
                        {sq}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 3 : Suggestions de démarrage si historique vide */}
              {recentItems.length === 0 && (
                <div className="py-6 px-4 space-y-4 text-center">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EFEAFF] text-[#8067DC] shadow-xs">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-foreground">
                      Recherche Universelle &amp; Navigation Rapide
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      Indexe simultanément les œuvres du catalogue, ayants droit, contrats d'édition et projets TF1.
                    </p>
                  </div>

                  <div className="pt-2">
                    <div className="text-[11px] font-semibold text-muted-foreground mb-2">
                      Suggestions de recherche rapide :
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      {QUICK_SEARCH_SUGGESTIONS.map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => setQuery(sug)}
                          className="rounded-full border border-border/80 bg-muted/40 hover:bg-[#EFEAFF] hover:border-[#8067DC]/40 hover:text-[#8067DC] px-2.5 py-1 text-xs font-medium text-muted-foreground transition-all duration-150 cursor-pointer"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Aucun résultat trouvé */}
          {query.trim() && !isLoading && flatItems.length === 0 && (
            <div className="py-12 px-4 text-center space-y-2">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Search className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">
                Aucun résultat pour « {query} »
              </h4>
              <p className="text-xs text-muted-foreground">
                Vérifiez l'orthographe du titre, du cotage, du numéro SACEM ou du nom d'ayant droit.
              </p>
            </div>
          )}

          {/* Catégorie 1 : ŒUVRES */}
          {results && results.works.length > 0 && (
            <div className="space-y-1 pt-1 first:pt-0">
              <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Disc3 className="h-3.5 w-3.5 text-[#8067DC]" />
                  Œuvres du Catalogue ({results.works.length})
                </span>
                <span className="text-[10px] font-normal text-muted-foreground">Catalogue</span>
              </div>
              <div className="space-y-1">
                {results.works.map((work) => {
                  const itemIndex = flatItems.findIndex(
                    (it) => it.type === "WORK" && it.data.id === work.id
                  );
                  const isSelected = selectedIndex === itemIndex;

                  return (
                    <div
                      key={work.id}
                      onClick={() => handleSelect({ type: "WORK", data: work })}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      className={`group flex items-center justify-between rounded-xl px-3 py-2 cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? "bg-[#EFEAFF] text-[#8067DC] shadow-xs"
                          : "hover:bg-muted/50 text-foreground"
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                            isSelected
                              ? "bg-[#8067DC] text-white"
                              : "bg-muted text-muted-foreground group-hover:text-foreground"
                          }`}
                        >
                          <Disc3 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm truncate">
                              {work.title}
                            </span>
                            {work.sacem_work_code && (
                              <span className="rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 text-[10px] font-mono font-semibold text-indigo-700">
                                COCV {work.sacem_work_code}
                              </span>
                            )}
                            {work.iswc && (
                              <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.2 text-[10px] font-mono text-slate-700">
                                {work.iswc}
                              </span>
                            )}
                            {work.cotage_number && (
                              <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
                                Cotage {work.cotage_number}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            {work.performers.length > 0 && (
                              <span>Interprète: {work.performers.join(", ")}</span>
                            )}
                            {work.contract_reference && (
                              <span>• Contrat {work.contract_reference}</span>
                            )}
                            <span>• {work.holders_count} ayant(s) droit</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {work.sacem_registration_status === "REGISTERED" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5">
                            <CheckCircle2 className="h-3 w-3" />
                            Enregistré
                          </span>
                        ) : work.sacem_registration_status === "REJECTED" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-semibold px-2 py-0.5">
                            <XCircle className="h-3 w-3" />
                            Rejet
                          </span>
                        ) : work.is_cwr_ready ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium px-2 py-0.5">
                            ✓ CWR Prêt
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium px-2 py-0.5">
                            Clés incomplètes
                          </span>
                        )}
                        <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-[#8067DC]" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Catégorie 2 : AYANTS DROIT */}
          {results && results.holders.length > 0 && (
            <div className="space-y-1 pt-3">
              <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-blue-600" />
                  Répertoire des Ayants Droit ({results.holders.length})
                </span>
                <span className="text-[10px] font-normal text-muted-foreground">Ayants Droit</span>
              </div>
              <div className="space-y-1">
                {results.holders.map((holder) => {
                  const itemIndex = flatItems.findIndex(
                    (it) => it.type === "HOLDER" && it.data.id === holder.id
                  );
                  const isSelected = selectedIndex === itemIndex;

                  return (
                    <div
                      key={holder.id}
                      onClick={() => handleSelect({ type: "HOLDER", data: holder })}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      className={`group flex items-center justify-between rounded-xl px-3 py-2 cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? "bg-[#EFEAFF] text-[#8067DC] shadow-xs"
                          : "hover:bg-muted/50 text-foreground"
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                            isSelected
                              ? "bg-[#8067DC] text-white"
                              : "bg-blue-50 text-blue-600 group-hover:text-blue-700"
                          }`}
                        >
                          <User className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm truncate">
                              {holder.full_name}
                            </span>
                            <span className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.2 text-[10px] font-semibold text-blue-700">
                              {holder.primary_role}
                            </span>
                            {holder.ipi_number ? (
                              <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.2 text-[10px] font-mono text-slate-700">
                                IPI {holder.ipi_number}
                              </span>
                            ) : (
                              <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.2 text-[10px] font-semibold text-amber-700">
                                Sans IPI
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{holder.associated_works_count} œuvre(s) associée(s)</span>
                            <span>• {holder.associated_contracts_count} contrat(s)</span>
                          </div>
                        </div>
                      </div>

                      <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-[#8067DC]" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Catégorie 3 : CONTRATS */}
          {results && results.contracts.length > 0 && (
            <div className="space-y-1 pt-3">
              <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-amber-600" />
                  Contrats d'Édition &amp; Cessions ({results.contracts.length})
                </span>
                <span className="text-[10px] font-normal text-muted-foreground">Contrats</span>
              </div>
              <div className="space-y-1">
                {results.contracts.map((contract) => {
                  const itemIndex = flatItems.findIndex(
                    (it) => it.type === "CONTRACT" && it.data.id === contract.id
                  );
                  const isSelected = selectedIndex === itemIndex;

                  return (
                    <div
                      key={contract.id}
                      onClick={() => handleSelect({ type: "CONTRACT", data: contract })}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      className={`group flex items-center justify-between rounded-xl px-3 py-2 cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? "bg-[#EFEAFF] text-[#8067DC] shadow-xs"
                          : "hover:bg-muted/50 text-foreground"
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                            isSelected
                              ? "bg-[#8067DC] text-white"
                              : "bg-amber-50 text-amber-600 group-hover:text-amber-700"
                          }`}
                        >
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm font-mono truncate">
                              {contract.contract_reference}
                            </span>
                            <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground">
                              {contract.contract_type}
                            </span>
                            {contract.audiovisual_program && (
                              <span className="rounded bg-purple-50 border border-purple-200 px-1.5 py-0.2 text-[10px] font-semibold text-purple-700">
                                🎬 {contract.audiovisual_program}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Éditeur: {contract.publisher_name}</span>
                            <span>• Cédant: {contract.counterparty_name}</span>
                            <span>• {contract.works_count} œuvre(s)</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            contract.validation_status === "VALIDATED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {contract.validation_status === "VALIDATED"
                            ? "✓ Validé Humain"
                            : "En revue"}
                        </span>
                        <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-[#8067DC]" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Catégorie 4 : GROUPES & PROJETS TF1 */}
          {results && results.groups.length > 0 && (
            <div className="space-y-1 pt-3">
              <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Tv className="h-3.5 w-3.5 text-purple-600" />
                  Projets TF1, Séries &amp; Albums ({results.groups.length})
                </span>
                <span className="text-[10px] font-normal text-muted-foreground">Projets</span>
              </div>
              <div className="space-y-1">
                {results.groups.map((group) => {
                  const itemIndex = flatItems.findIndex(
                    (it) => it.type === "GROUP" && it.data.id === group.id
                  );
                  const isSelected = selectedIndex === itemIndex;

                  return (
                    <div
                      key={group.id}
                      onClick={() => handleSelect({ type: "GROUP", data: group })}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      className={`group flex items-center justify-between rounded-xl px-3 py-2 cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? "bg-[#EFEAFF] text-[#8067DC] shadow-xs"
                          : "hover:bg-muted/50 text-foreground"
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                            isSelected
                              ? "bg-[#8067DC] text-white"
                              : "bg-purple-50 text-purple-600 group-hover:text-purple-700"
                          }`}
                        >
                          <Tv className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm truncate">
                              {group.name}
                            </span>
                            <span className="rounded bg-purple-50 border border-purple-200 px-1.5 py-0.2 text-[10px] font-semibold text-purple-700">
                              {group.group_type === "AUDIOVISUAL" ? "Série / Fiction TV" : "Album"}
                            </span>
                            {group.contract_reference && (
                              <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
                                Réf {group.contract_reference}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {group.production_company && (
                              <span>Production: {group.production_company}</span>
                            )}
                            <span>• {group.works_count} œuvre(s) rattachée(s)</span>
                          </div>
                        </div>
                      </div>

                      <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-[#8067DC]" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Omnibar avec raccourcis d'aide */}
        <div className="flex items-center justify-between border-t border-border/80 px-4 py-2.5 bg-muted/30 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-border bg-card px-1 py-0.5 font-mono text-[9px] shadow-2xs">
                ↑
              </kbd>
              <kbd className="rounded border border-border bg-card px-1 py-0.5 font-mono text-[9px] shadow-2xs">
                ↓
              </kbd>
              <span>Naviguer</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-border bg-card px-1 py-0.5 font-mono text-[9px] shadow-2xs">
                ↵
              </kbd>
              <span>Ouvrir</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-border bg-card px-1 py-0.5 font-mono text-[9px] shadow-2xs">
                esc
              </kbd>
              <span>Fermer</span>
            </span>
          </div>

          <div className="text-[10px] font-medium text-[#745DCA]">
            Korom Omnibar ⌘K
          </div>
        </div>
      </div>
    </div>
  );
}
