"use client";

import { CheckCircle2, Download, Printer, X } from "lucide-react";
import { ReadyToUseInvoicePayload } from "@/types/api";

interface HolderInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceData: ReadyToUseInvoicePayload | null;
  onDownloadTxt?: () => void;
}

export function HolderInvoiceModal({
  isOpen,
  onClose,
  invoiceData,
  onDownloadTxt,
}: HolderInvoiceModalProps) {
  if (!isOpen || !invoiceData) return null;

  const isCompany = invoiceData.document_type === "FACTURE_REDEVANCES_FACTURX";

  function defaultDownloadTxt() {
    if (!invoiceData) return;
    const blob = new Blob([invoiceData.printable_text], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoiceData.invoice_number}_${invoiceData.holder_name.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-3xl rounded-2xl border bg-card p-6 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:p-0">
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-800">
                {invoiceData.invoice_number}
              </span>
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {isCompany ? "Facture Factur-X B2B (Société)" : "Note de Droits d'Auteur (Autofacturation)"}
              </span>
            </div>
            <h2 className="text-xl font-bold font-micro text-foreground mt-1">
              {isCompany ? "Facture de Redevances d'Édition" : "Note de Droits d'Auteur"} — {invoiceData.holder_name}
            </h2>
            <p className="text-xs text-muted-foreground">
              Période : {invoiceData.period_label} • Émise le {invoiceData.issue_date}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors print:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Synthèse visuelle des montants calculés */}
        <div className="grid gap-2.5 sm:grid-cols-4 text-xs">
          <div className="rounded-xl border bg-card p-3">
            <div className="text-[11px] text-muted-foreground">
              Base Payable HT (Après Avance)
            </div>
            <div className="text-sm font-bold font-mono mt-0.5 text-foreground">
              {Number(invoiceData.taxable_base_ht_eur).toLocaleString("fr-FR")} €
            </div>
          </div>
          <div className="rounded-xl border bg-card p-3">
            <div className="text-[11px] text-muted-foreground">
              TVA ({Number(invoiceData.vat_rate_pct).toFixed(2)} %)
            </div>
            <div className="text-sm font-bold font-mono text-primary mt-0.5">
              + {Number(invoiceData.vat_amount_eur).toLocaleString("fr-FR")} €
            </div>
          </div>
          <div className="rounded-xl border bg-card p-3">
            <div className="text-[11px] text-muted-foreground">
              Précompte Social URSSAF/IRCEC
            </div>
            <div className="text-sm font-bold font-mono text-amber-700 mt-0.5">
              - {Number(invoiceData.total_precompte_social_eur).toLocaleString("fr-FR")} €
            </div>
          </div>
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3">
            <div className="text-[11px] font-semibold text-emerald-800">
              Net à Payer (Virement SEPA)
            </div>
            <div className="text-base font-bold font-mono text-emerald-700 mt-0.5">
              {Number(invoiceData.net_payable_to_holder_eur).toLocaleString("fr-FR")} €
            </div>
          </div>
        </div>

        {/* Aperçu du document prêt à imprimer / télécharger */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Texte officiel normalisé (Factur-X / Autofacturation) :</span>
            <span>Coordonnées bancaires &amp; Mentions légales intégrées</span>
          </div>
          <pre className="overflow-x-auto rounded-xl border bg-slate-950 p-4 font-mono text-xs text-emerald-400 leading-relaxed max-h-72 overflow-y-auto">
            {invoiceData.printable_text}
          </pre>
        </div>

        {/* Pied de modale */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 print:hidden">
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Conforme Factur-X 2026 / Mandat d&apos;Autofacturation Éditeur
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-accent transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimer / PDF</span>
            </button>
            <button
              type="button"
              onClick={onDownloadTxt || defaultDownloadTxt}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Télécharger Document ({invoiceData.invoice_number})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
