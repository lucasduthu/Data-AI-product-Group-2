"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Globe2,
  Layers,
  Printer,
  ShieldCheck,
  X,
} from "lucide-react";
import { AdvanceRecoupmentState, IndividualHolderReport } from "@/types/api";
import { fetchHolderIndividualStatement } from "@/lib/api";

interface HolderStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  holder: AdvanceRecoupmentState | null;
  statementId?: string;
  statementSource: string;
  periodLabel: string;
  onOpenInvoice?: (holder: AdvanceRecoupmentState) => void;
  initialGroupBy?: "WORK" | "PROJECT" | "TERRITORY" | "RIGHT_TYPE";
  initialLanguage?: "FR" | "EN";
  initialHideZeroLines?: boolean;
}

export function HolderStatementModal({
  isOpen,
  onClose,
  holder,
  statementId,
  statementSource,
  periodLabel,
  onOpenInvoice,
  initialGroupBy = "WORK",
  initialLanguage = "FR",
  initialHideZeroLines = false,
}: HolderStatementModalProps) {
  const [groupBy, setGroupBy] = useState<"WORK" | "PROJECT" | "TERRITORY" | "RIGHT_TYPE">(initialGroupBy);
  const [language, setLanguage] = useState<"FR" | "EN">(initialLanguage);
  const [hideZeroLines, setHideZeroLines] = useState<boolean>(initialHideZeroLines);
  const [viewMode, setViewMode] = useState<"TABLE" | "ASCII">("TABLE");
  const [reportData, setReportData] = useState<IndividualHolderReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync initial props
  useEffect(() => {
    if (isOpen) {
      setGroupBy(initialGroupBy);
      setLanguage(initialLanguage);
      setHideZeroLines(initialHideZeroLines);
    }
  }, [isOpen, initialGroupBy, initialLanguage, initialHideZeroLines]);

  // Load backend statement when parameters change
  useEffect(() => {
    if (!isOpen || !holder || !statementId) {
      setReportData(null);
      return;
    }
    let isCancelled = false;
    setLoading(true);

    fetchHolderIndividualStatement(statementId, holder.holder_name, {
      lang: language,
      groupBy,
      hideZeroLines,
    })
      .then((data) => {
        if (!isCancelled) {
          setReportData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Erreur lors de la récupération du relevé avancé:", err);
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, holder, statementId, groupBy, language, hideZeroLines]);

  if (!isOpen || !holder) return null;

  const isCompany = holder.entity_type === "SOCIETE";
  const isEn = language === "EN";
  const gross = parseFloat(reportData?.gross_royalties_allocated || holder.gross_royalties_allocated) || 0;
  const recouped = parseFloat(reportData?.recouped_in_period || holder.recouped_in_period) || 0;
  const taxableHt = parseFloat(reportData?.taxable_base_ht || holder.taxable_base_ht || "0") || Math.max(0, gross - recouped);
  const vatRate = parseFloat(reportData?.vat_rate_pct || holder.vat_rate_pct || "0") || 0;
  const vatAmount = parseFloat(reportData?.vat_amount || holder.vat_amount || "0") || 0;
  const precompte = parseFloat(reportData?.precompte_social || holder.precompte_social_amount || holder.precompte_ircec_amount || "0") || 0;
  const netPayable = parseFloat(reportData?.net_payable_amount || holder.net_payable_amount) || 0;

  function handleDownloadCsv() {
    if (!holder) return;
    let csvToDownload = reportData?.csv_content;

    if (!csvToDownload) {
      const lines = [
        `# RELEVÉ DE COMPTE DE REDEVANCES INDIVIDUEL (CPI L132-13) - ${language}`,
        `# ÉDITIONS SOLSTICES MUSIC — KOROM COPYRIGHTS & ROYALTIES`,
        `# Ayant Droit : ${holder.holder_name} (${holder.role || "Créateur"}) | IPI : ${holder.ipi_number || "N/A"}`,
        `# Source : ${statementSource} | Période : ${periodLabel} | Regroupement : ${groupBy}`,
        "",
        "group,work_title,iswc,right_type,territory,work_group,gross_line_amount,share_pct,allocated_royalty",
      ];
      if (holder.works_breakdown && holder.works_breakdown.length > 0) {
        for (const w of holder.works_breakdown) {
          if (hideZeroLines && parseFloat(w.allocated_amount || "0") <= 0) continue;
          lines.push(
            `"${w.work_group_title || w.work_title}","${w.work_title.replace(/"/g, '""')}","${w.iswc || ""}","${w.right_type}","${w.territory || "FR"}","${w.work_group_title || "Catalogue Général"}","${w.gross_line_amount}","${w.share_percentage}","${w.allocated_amount}"`
          );
        }
      }
      lines.push(
        "",
        "SYNTHESE_COMPTE,MONTANT_EUR",
        `Royalties Brutes Allouees,${gross.toFixed(2)}`,
        `Amortissement Avance,-${recouped.toFixed(2)}`,
        `Base Nette HT,${taxableHt.toFixed(2)}`,
        `TVA (${vatRate}%),${vatAmount.toFixed(2)}`,
        `Net a Payer TTC,${(taxableHt + vatAmount).toFixed(2)}`,
        `NET A PAYER SEPA,${netPayable.toFixed(2)}`
      );
      csvToDownload = lines.join("\n");
    }

    const blob = new Blob([csvToDownload], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = reportData?.filename || `releve_${groupBy.toLowerCase()}_${language.toLowerCase()}_${holder.holder_name.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadAscii() {
    if (!reportData?.printable_text) return;
    const blob = new Blob([reportData.printable_text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `releve_officiel_${language.toLowerCase()}_${holder?.holder_name.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCopyAscii() {
    if (!reportData?.printable_text) return;
    navigator.clipboard.writeText(reportData.printable_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-4xl rounded-2xl border bg-card p-6 shadow-2xl space-y-4 my-8 max-h-[92vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:p-0">
        {/* En-tête de la modale */}
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">
                CPI Art. L132-13 • US-4.6 Décomptes Avancés
              </span>
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {isCompany ? (isEn ? "Corporate Entity" : "Société Commerciale") : (isEn ? "Individual Author" : "Artiste-Auteur")}
              </span>
              <span className="rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {isEn ? "Bilingual Presentation" : "Présentation Bilingue (FR / EN)"}
              </span>
              {((reportData?.source_currency && reportData.source_currency !== "EUR") || (holder.source_currency && holder.source_currency !== "EUR")) && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-800 font-mono">
                  {isEn ? "Source Currency:" : "Devise Source :"} {reportData?.source_currency || holder.source_currency} @ {reportData?.exchange_rate || holder.exchange_rate}
                  {(reportData?.source_gross_royalties_allocated || holder.source_gross_royalties_allocated) ? ` (${Number(reportData?.source_gross_royalties_allocated || holder.source_gross_royalties_allocated).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} ${reportData?.source_currency || holder.source_currency})` : ""}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold font-micro tracking-tight text-foreground mt-1">
              {isEn ? "Individual Royalty Statement" : "Décompte Individuel de Redevances SACEM"} — {holder.holder_name}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isEn ? "Source Distribution:" : "Répartition :"} <strong>{statementSource}</strong> • {isEn ? "Period:" : "Période :"} <strong>{periodLabel}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la modale"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors print:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Barre d'Options Avancées (Regroupement, Bilingue, Filtre Solde Nul, Mode de vue) */}
        <div className="rounded-xl border bg-muted/30 p-3 flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
          {/* Sélecteur de Regroupement */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-muted-foreground flex items-center gap-1">
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span>{isEn ? "Grouping:" : "Regroupement :"}</span>
            </span>
            <div className="inline-flex rounded-lg border bg-background p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setGroupBy("WORK")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  groupBy === "WORK"
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isEn ? "Per Work" : "Par Œuvre"}
              </button>
              <button
                type="button"
                onClick={() => setGroupBy("PROJECT")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  groupBy === "PROJECT"
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isEn ? "By Project / Film" : "Par Projet / Série TV"}
              </button>
              <button
                type="button"
                onClick={() => setGroupBy("TERRITORY")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  groupBy === "TERRITORY"
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isEn ? "By Country" : "Par Territoire"}
              </button>
              <button
                type="button"
                onClick={() => setGroupBy("RIGHT_TYPE")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  groupBy === "RIGHT_TYPE"
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isEn ? "By Right Type" : "Par Famille de Droits"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Toggle Langue FR / EN */}
            <div className="flex items-center gap-1">
              <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="inline-flex rounded-lg border bg-background p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setLanguage("FR")}
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                    language === "FR"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  FR
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("EN")}
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                    language === "EN"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  EN
                </button>
              </div>
            </div>

            {/* Toggle Masquer Solde Nul */}
            <label className="inline-flex cursor-pointer items-center gap-1.5 select-none text-muted-foreground hover:text-foreground">
              <input
                type="checkbox"
                checked={hideZeroLines}
                onChange={(e) => setHideZeroLines(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary/20 h-3.5 w-3.5"
              />
              <span className="flex items-center gap-1">
                <Filter className="h-3 w-3" />
                <span>{isEn ? "Hide Zero Lines (0 €)" : "Masquer Soldes Nuls (0 €)"}</span>
              </span>
            </label>

            {/* Switch Mode Vue Tableau vs Document Imprimable ASCII */}
            <div className="inline-flex rounded-lg border bg-background p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode("TABLE")}
                className={`rounded-md px-2 py-1 text-xs font-medium ${
                  viewMode === "TABLE"
                    ? "bg-secondary text-secondary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isEn ? "Table View" : "Vue Tableau"}
              </button>
              <button
                type="button"
                onClick={() => setViewMode("ASCII")}
                className={`rounded-md px-2 py-1 text-xs font-medium ${
                  viewMode === "ASCII"
                    ? "bg-secondary text-secondary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isEn ? "Printable Document" : "Document Officiel"}
              </button>
            </div>
          </div>
        </div>

        {/* Coordonnées & Références Ayant Droit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-muted/20 p-3.5 rounded-xl border">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-0.5">
              {isEn ? "Beneficiary / Right Holder:" : "Bénéficiaire / Ayant Droit :"}
            </span>
            <div className="font-bold text-sm text-foreground">{holder.holder_name}</div>
            <div className="text-muted-foreground font-mono text-[11px] mt-0.5">
              {isEn ? "Role:" : "Rôle :"} {holder.role || "AC"} • IPI : {holder.ipi_number || "N/A"}
            </div>
            {holder.siret && (
              <div className="text-muted-foreground font-mono text-[11px]">
                SIRET : {holder.siret} {holder.vat_number ? `• TVA : ${holder.vat_number}` : ""}
              </div>
            )}
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-0.5">
              {isEn ? "Contract & Bank Details:" : "Contrat & Coordonnées Bancaires :"}
            </span>
            <div className="font-mono font-semibold text-foreground">
              {holder.contract_reference ? `${isEn ? "Contract:" : "Contrat :"} ${holder.contract_reference}` : (isEn ? "General catalog agreement" : "Catalogue direct")}
            </div>
            <div className="text-muted-foreground font-mono text-[11px] mt-0.5 truncate">
              IBAN : {holder.iban || (isEn ? "To be provided on right holder card" : "À renseigner sur la fiche ayant droit")}
            </div>
            {holder.bic && (
              <div className="text-muted-foreground font-mono text-[11px]">
                BIC : {holder.bic}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>{isEn ? "Updating statement calculation..." : "Actualisation du décompte en cours..."}</span>
          </div>
        ) : viewMode === "ASCII" && reportData?.printable_text ? (
          /* Vue Document Officiel ASCII 80-Colonnes */
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">
                {isEn ? "80-column monospace certified accounting document:" : "Relevé officiel certifié 80 colonnes (monospace) :"}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyAscii}
                  className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted font-medium"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  <span>{copied ? (isEn ? "Copied!" : "Copié !") : (isEn ? "Copy text" : "Copier le texte")}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadAscii}
                  className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted font-medium"
                >
                  <Download className="h-3 w-3" />
                  <span>{isEn ? "Download (.txt)" : "Télécharger (.txt)"}</span>
                </button>
              </div>
            </div>
            <pre className="rounded-xl border bg-black text-emerald-400 p-4 font-mono text-[11px] leading-snug overflow-x-auto select-all max-h-96 shadow-inner">
              {reportData.printable_text}
            </pre>
          </div>
        ) : (
          /* Vue Tableau Décomposé avec Sous-totaux par Groupe */
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <h3 className="font-bold uppercase tracking-wider text-muted-foreground">
                {isEn ? "Royalties Breakdown by Category" : "Ventilation Détaillée des Droits"} (
                {reportData?.groups ? `${reportData.groups.length} ${isEn ? "group(s)" : "groupe(s)"}` : `${holder.works_breakdown?.length || 0} œuvre(s)`})
              </h3>
              <span className="text-muted-foreground">
                {isEn ? "Sorted and subtotaled deterministically" : "Calcul strict micro-centime déterministe"}
              </span>
            </div>

            {reportData?.groups && reportData.groups.length > 0 ? (
              <div className="space-y-3">
                {reportData.groups.map((grp, gIdx) => (
                  <div key={gIdx} className="rounded-xl border bg-card overflow-hidden shadow-2xs">
                    {/* En-tête de Groupe avec Sous-total */}
                    <div className="flex items-center justify-between bg-muted/40 px-3.5 py-2 border-b">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-xs">{grp.group_label}</span>
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
                          {grp.works_count} {isEn ? "work(s)" : "œuvre(s)"}
                        </span>
                      </div>
                      <div className="font-mono text-xs font-bold text-emerald-700">
                        {isEn ? "Sub-total:" : "Sous-total :"} {Number(grp.total_allocated).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                      </div>
                    </div>

                    {/* Table des lignes du groupe */}
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/10 border-b text-muted-foreground text-[11px]">
                        <tr>
                          <th className="px-3 py-1.5 font-medium">{isEn ? "Work Title" : "Titre Œuvre"}</th>
                          <th className="px-3 py-1.5 font-medium">{isEn ? "Right Type" : "Famille Droit"}</th>
                          <th className="px-3 py-1.5 font-medium">{isEn ? "Territory" : "Territoire"}</th>
                          <th className="px-3 py-1.5 text-right font-medium">{isEn ? "Gross SACEM" : "Brut SACEM"}</th>
                          <th className="px-3 py-1.5 text-right font-medium">{isEn ? "Share (%)" : "Part (%)"}</th>
                          <th className="px-3 py-1.5 text-right font-medium">{isEn ? "Allocated Royalty" : "Royalty Allouée"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-[11px]">
                        {grp.lines.map((ln, lIdx) => (
                          <tr key={lIdx} className="hover:bg-muted/10">
                            <td className="px-3 py-1.5 font-semibold text-foreground">
                              {ln.work_title}
                            </td>
                            <td className="px-3 py-1.5">
                              <span className="rounded bg-secondary px-1 py-0.5 font-mono text-[10px] font-bold">
                                {ln.right_type}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 font-mono text-muted-foreground">
                              {ln.territory || "FR"}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                              {Number(ln.gross_amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono">
                              {Number(ln.share_percentage).toFixed(2)} %
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-700">
                              {Number(ln.allocated_amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ) : (
              /* Fallback direct si les groupes serveur ne sont pas disponibles */
              <div className="rounded-xl border bg-card overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">{isEn ? "Work Title" : "Œuvre déclarée"}</th>
                      <th className="px-3 py-2 font-medium">{isEn ? "ISWC / Right" : "ISWC / Droit"}</th>
                      <th className="px-3 py-2 font-medium">{isEn ? "Territory" : "Territoire"}</th>
                      <th className="px-3 py-2 text-right font-medium">{isEn ? "Gross SACEM" : "Brut SACEM"}</th>
                      <th className="px-3 py-2 text-right font-medium">{isEn ? "Share (%)" : "Part (%)"}</th>
                      <th className="px-3 py-2 text-right font-medium">{isEn ? "Quote-part (€)" : "Quote-part (€)"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {holder.works_breakdown && holder.works_breakdown.length > 0 ? (
                      holder.works_breakdown
                        .filter((wb) => !hideZeroLines || parseFloat(wb.allocated_amount || "0") > 0)
                        .map((wb, idx) => (
                          <tr key={idx} className="hover:bg-muted/10">
                            <td className="px-3 py-2 font-semibold text-foreground">
                              {wb.work_title}
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                              {wb.iswc || "Sans ISWC"} •{" "}
                              <span className="rounded bg-secondary px-1 py-0.5 font-bold text-foreground">
                                {wb.right_type}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                              {wb.territory || "FR"}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                              {Number(wb.gross_line_amount).toLocaleString("fr-FR")} €
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-medium">
                              {Number(wb.share_percentage).toFixed(2)} %
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">
                              {Number(wb.allocated_amount).toLocaleString("fr-FR")} €
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-3 py-3 text-center text-muted-foreground italic">
                          {isEn ? "Global distribution statement recorded for this right holder." : "Synthèse globale enregistrée sur ce décompte SACEM."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Synthèse Financière & Fiscale Déterministe */}
        <div className="rounded-xl border bg-card p-4 space-y-2 text-xs">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-muted-foreground font-medium">
              {isEn ? "Gross Royalties Allocated (SACEM):" : "Total Royalties Brutes Allouées (SACEM) :"}
            </span>
            <span className="font-mono font-bold text-sm">
              {Number(gross).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
            </span>
          </div>

          {((reportData?.source_currency && reportData.source_currency !== "EUR") || (holder.source_currency && holder.source_currency !== "EUR")) && (
            <div className="flex items-center justify-between text-muted-foreground bg-muted/20 p-2 rounded border">
              <span>
                {isEn ? "Source Currency Gross & Exchange Rate:" : "Montant Brut Source & Parité de Change :"}
              </span>
              <span className="font-mono font-bold text-foreground">
                {Number(reportData?.source_gross_royalties_allocated || holder.source_gross_royalties_allocated || gross).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {reportData?.source_currency || holder.source_currency} @ {reportData?.exchange_rate || holder.exchange_rate}
              </span>
            </div>
          )}

          {parseFloat(holder.initial_advance || "0") > 0 && (
            <>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>{isEn ? "Initial Contractual Advance:" : "Avance Initiale Contractuelle :"}</span>
                <span className="font-mono">{Number(holder.initial_advance).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
              </div>
              <div className="flex items-center justify-between text-amber-700 font-medium">
                <span>{isEn ? "Recouped Advance in Period:" : "Amortissement de l'avance sur la période :"}</span>
                <span className="font-mono">- {Number(recouped).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>{isEn ? "Remaining Unrecouped Advance:" : "Solde d'avance restant à amortir :"}</span>
                <span className="font-mono">{Number(holder.remaining_unrecouped_balance).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
              </div>
            </>
          )}

          <div className="flex items-center justify-between pt-1 border-t text-muted-foreground">
            <span>{isEn ? "Net Taxable Base (Excl. VAT):" : "Assiette Rémunération Nette HT (Base imposable) :"}</span>
            <span className="font-mono font-semibold">{Number(taxableHt).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
          </div>

          {vatAmount > 0 && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{isEn ? `VAT (${vatRate.toFixed(2)} %):` : `TVA (${vatRate.toFixed(2)} %) :`}</span>
              <span className="font-mono">+ {Number(vatAmount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
            </div>
          )}

          {precompte > 0 && (
            <div className="flex items-center justify-between text-indigo-700 font-medium">
              <span>
                {isEn ? "Social & Author Withholdings (URSSAF / IRCEC):" : "Précompte Social Artiste-Auteur URSSAF/IRCEC (~11,10 %) :"}
              </span>
              <span className="font-mono">- {Number(precompte).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
            </div>
          )}

          {parseFloat(holder.previous_reserve_balance || "0") > 0 && (
            <div className="flex items-center justify-between text-indigo-700 font-medium pt-1 border-t">
              <span>{isEn ? "Carried Reserve from Previous Period:" : "Solde à nouveau (Réserve reportée de la période précédente) :"}</span>
              <span className="font-mono font-semibold">+ {Number(holder.previous_reserve_balance).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
            </div>
          )}

          {holder.payout_status === "BELOW_THRESHOLD" ? (
            <div className="flex items-center justify-between pt-2 border-t text-base font-bold text-amber-800 bg-amber-500/15 -mx-4 -mb-4 p-3.5 rounded-b-xl border-amber-500/30">
              <span>{isEn ? "NET RETAINED IN RESERVE (< 50 €):" : "NET MIS EN RÉSERVE (REPORTÉ AU DÉCOMPTE SUIVANT) :"}</span>
              <span className="font-mono text-lg">{Number(holder.retained_in_reserve || "0.00").toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
            </div>
          ) : holder.payout_status === "RECOUPING" ? (
            <div className="flex items-center justify-between pt-2 border-t text-base font-bold text-blue-800 bg-blue-500/15 -mx-4 -mb-4 p-3.5 rounded-b-xl border-blue-500/30">
              <span>{isEn ? "DEBIT BALANCE (CARRIED FORWARD TO NEXT DISTRIBUTIONS):" : "SOLDE DÉBITEUR (REPORTÉ SUR PROCHAINES RÉPARTITIONS) :"}</span>
              <span className="font-mono text-lg">{Number(holder.remaining_unrecouped_balance || "0.00").toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-2 border-t text-base font-bold text-emerald-700 bg-emerald-500/10 -mx-4 -mb-4 p-3.5 rounded-b-xl border-emerald-500/20">
              <span>{isEn ? "NET PAYABLE VIA BANK WIRE (EUR):" : "NET À PAYER PAR VIREMENT SEPA :"}</span>
              <span className="font-mono text-lg">{Number(netPayable).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
            </div>
          )}
        </div>

        {/* Mention Légale Conditionnelle (CPI L132-13) */}
        {holder.legal_mention_applied && (
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-primary font-bold text-[11px] uppercase tracking-wider">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{isEn ? "Legal Compliance Notice (CPI Art. L132-13):" : "Mention Légale Appliquée au Décompte (CPI L132-13) :"}</span>
            </div>
            <p className="text-foreground italic leading-relaxed">
              &laquo; {holder.legal_mention_applied} &raquo;
            </p>
          </div>
        )}

        {/* Boutons d'action */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t print:hidden">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors shadow-2xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>{isEn ? "Download Structured CSV" : "Télécharger CSV Structuré"}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadAscii}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors shadow-2xs"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              <span>{isEn ? "Download Document (.txt)" : "Télécharger Relevé (.txt)"}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{isEn ? "Print" : "Imprimer"}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onOpenInvoice && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenInvoice(holder);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>
                  {isCompany ? (isEn ? "Generate Factur-X Invoice" : "Générer Facture Factur-X") : (isEn ? "Generate Author Note" : "Générer Note de Droits")}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors"
            >
              {isEn ? "Close" : "Fermer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
