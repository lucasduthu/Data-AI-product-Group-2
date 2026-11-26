"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Disc3,
  FileText,
  Power,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { KoromKLogo } from "@/components/korom-logo";
import { UniversalSearchModal } from "@/components/universal-search-modal";
import { fetchWorkspaceSettings, toggleAiOverrideSwitch } from "@/lib/api";

const navItems = [
  {
    name: "1. Contrats PDF & IA",
    href: "/contracts",
    icon: FileText,
  },
  {
    name: "2. Œuvres & Export CWR / XLSX",
    href: "/catalog",
    icon: Disc3,
  },
  {
    name: "Ayants Droit & IPI",
    href: "/holders",
    icon: Users,
  },
  {
    name: "Paramètres CWR & Audit",
    href: "/settings",
    icon: Settings,
  },
];

export function Navbar() {
  const pathname = usePathname();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [deterministicOnly, setDeterministicOnly] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    fetchWorkspaceSettings()
      .then((ws) => {
        setDeterministicOnly(
          ws.openrouter_model?.toLowerCase() === "deterministic"
        );
      })
      .catch(() => {});
  }, []);

  async function handleToggleOverrideSwitch() {
    const nextState = !deterministicOnly;
    setIsSwitching(true);
    try {
      const res = await toggleAiOverrideSwitch(nextState);
      setDeterministicOnly(res.deterministic_only);
    } catch {
      setDeterministicOnly(nextState);
    } finally {
      setIsSwitching(false);
    }
  }

  // Raccourci clavier universel Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="mx-auto flex min-h-[68px] max-w-[1600px] items-center justify-between px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-7">
            <Link href="/" className="group flex items-center gap-2.5" title="Accueil Korom Contract-to-CWR Copilot">
              <KoromKLogo size="md" variant="solid" />
              <div className="flex flex-col">
                <span className="font-micro text-[22px] font-bold tracking-tight text-foreground group-hover:text-primary transition-colors leading-none">
                  Korom
                </span>
                <span className="text-[11.5px] italic font-medium text-[#745DCA] mt-0.5 leading-none tracking-wide">
                  Contract-to-CWR AI Copilot
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-1" aria-label="Navigation principale">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[14px] font-micro font-medium transition-all duration-150",
                      isActive
                        ? "bg-[#EFEAFF] text-[#8067DC] font-bold border border-[#8067DC]/25 shadow-xs"
                        : "text-muted-foreground hover:bg-[#EFEAFF]/50 hover:text-[#8067DC]"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 transition-colors",
                        isActive ? "text-[#8067DC]" : "text-muted-foreground group-hover:text-[#8067DC]"
                      )}
                    />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Bouton Recherche Universelle Cmd+K */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="group flex items-center gap-2 rounded-xl border border-border/80 bg-muted/40 hover:bg-[#EFEAFF] hover:border-[#8067DC]/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-[#8067DC] transition-all duration-150 shadow-2xs cursor-pointer"
              title="Recherche universelle (⌘K)"
            >
              <Search className="h-3.5 w-3.5 text-muted-foreground group-hover:text-[#8067DC] transition-colors" />
              <span className="hidden md:inline font-medium">Rechercher...</span>
              <kbd className="inline-flex items-center gap-0.5 rounded border border-border/80 bg-background/80 px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground shadow-2xs">
                <span className="text-[11px]">⌘</span>K
              </kbd>
            </button>

            {/* Interrupteur d'urgence IA (⏻ Override Switch - Class 4 & 7) */}
            <button
              type="button"
              disabled={isSwitching}
              onClick={handleToggleOverrideSwitch}
              title={
                deterministicOnly
                  ? "⏻ Override Switch ACTIF : Le LLM est désactivé (Mode Regex Déterministe Rung 1 uniquement). Cliquez pour réactiver le Copilot IA."
                  : "⏻ Override Switch : Cliquez pour désactiver immédiatement le LLM en cas d'incident et basculer sur le parseur déterministe (Rung 1)."
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all cursor-pointer shadow-2xs",
                deterministicOnly
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-800 hover:bg-amber-500/25"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20"
              )}
            >
              <Power className="h-3.5 w-3.5" />
              <span>
                {deterministicOnly
                  ? "⏻ Switch : Mode Déterministe (Rung 1)"
                  : "⏻ IA Active (Rung 3 + Gate CWR)"}
              </span>
            </button>

            <span className="hidden xl:inline-flex items-center gap-1.5 rounded-full border border-[#8067DC]/20 bg-[#EFEAFF]/70 px-3 py-1 text-xs font-medium text-[#745DCA] shadow-2xs">
              <ShieldCheck className="h-3.5 w-3.5 text-[#8067DC]" />
              <span>⊘ Human-in-the-loop (L2)</span>
            </span>
          </div>
        </div>
      </header>

      {/* Omnibar Modal */}
      <UniversalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
}
