"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  HelpCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import { importCwrAck } from "@/lib/api";
import { CwrAckReport } from "@/types/api";

interface CwrAckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CwrAckModal({ isOpen, onClose, onSuccess }: CwrAckModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<CwrAckReport | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setReport(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
      setReport(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Veuillez sélectionner un fichier d'accusé de réception.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await importCwrAck(file, dryRun);
      setReport(res);
      if (!dryRun) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue lors de l'ingestion.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setReport(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-50/60 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center text-white shadow-md shadow-violet-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-800 text-lg">
                  Accusé de Réception SACEM CWR (ACK / NACK)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
                  CISAC CWR 2.1
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Synchronisez les enregistrements, attribuez les codes COCV officiels et traitez les rejets de dépôt
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps de la modale */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
              <div>
                <p className="font-semibold">Erreur de traitement</p>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {!report ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Zone Drag & Drop */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                  file
                    ? "border-violet-500 bg-violet-50/30"
                    : "border-slate-200 hover:border-violet-400 hover:bg-slate-50/60"
                }`}
              >
                <input
                  type="file"
                  id="cwr-ack-file"
                  onChange={handleFileChange}
                  accept=".ack,.v21,.v22,.cwr,.csv,.txt,.xlsx"
                  className="hidden"
                />
                <label
                  htmlFor="cwr-ack-file"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-3"
                >
                  <div className="w-14 h-14 rounded-full bg-violet-100 flex items-center justify-center text-violet-600">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {file ? file.name : "Glissez-déposez l'accusé de réception SACEM ici"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {file
                        ? `${(file.size / 1024).toFixed(1)} Ko - Prêt à analyser`
                        : "Formats acceptés : CWR ACK (.V21, .ACK), CSV de dépôt SACEM, .TXT ou .XLSX"}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 text-white shadow-sm hover:bg-violet-700 transition-colors">
                    <FileCheck2 className="w-4 h-4" />
                    Parcourir les fichiers
                  </span>
                </label>
              </div>

              {/* Options */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dryRun}
                    onChange={(e) => setDryRun(e.target.checked)}
                    className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 border-slate-300"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Mode simulation (Dry Run)
                    </p>
                    <p className="text-xs text-slate-500">
                      Vérifie l'appariement des œuvres et les anomalies sans modifier le catalogue en base
                    </p>
                  </div>
                </label>
              </div>

              {/* Bouton d'action */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!file || loading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-violet-600 rounded-xl shadow-md hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyse en cours...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      {dryRun ? "Lancer la simulation" : "Ingérer & Synchroniser le catalogue"}
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Synthèse 4 KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Transactions
                  </p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">
                    {report.total_transactions}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Analysées au total</p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                    Enregistrées
                  </p>
                  <p className="text-2xl font-bold text-emerald-800 mt-1">
                    {report.registered_count}
                  </p>
                  <p className="text-xs text-emerald-600 mt-0.5">Validées SACEM</p>
                </div>

                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                  <p className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
                    Rejets / Erreurs
                  </p>
                  <p className="text-2xl font-bold text-rose-800 mt-1">
                    {report.rejected_count}
                  </p>
                  <p className="text-xs text-rose-600 mt-0.5">Codes d'anomalies CISAC</p>
                </div>

                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                    Orphelines
                  </p>
                  <p className="text-2xl font-bold text-amber-800 mt-1">
                    {report.unmatched_count}
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">Non appariées au catalogue</p>
                </div>
              </div>

              {/* Messages de résumé */}
              <div className="p-4 rounded-xl bg-violet-50/50 border border-violet-100 space-y-1">
                {report.summary_messages.map((msg, i) => (
                  <p key={i} className="text-xs text-slate-700 font-medium">
                    {msg}
                  </p>
                ))}
              </div>

              {/* Tableau détaillé des transactions */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3">Statut</th>
                        <th className="px-4 py-3">Titre de l'œuvre</th>
                        <th className="px-4 py-3">Code SACEM (COCV)</th>
                        <th className="px-4 py-3">ISWC</th>
                        <th className="px-4 py-3">Détails / Motif</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.items.map((item, idx) => {
                        const isReg = item.status === "REGISTERED";
                        const isRej = item.status === "REJECTED";
                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-slate-50/60 transition-colors ${
                              isRej ? "bg-rose-50/20" : ""
                            }`}
                          >
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              {isReg ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Enregistré SACEM
                                </span>
                              ) : isRej ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Rejeté
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                                  <HelpCircle className="w-3.5 h-3.5" />
                                  Orphelin
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 font-medium text-slate-800">
                              {item.work_title}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-slate-600">
                              {item.sacem_work_code ? (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">
                                  {item.sacem_work_code}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-slate-500">
                              {item.iswc || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-slate-600 max-w-xs truncate">
                              {item.rejection_reason ? (
                                <span className="text-rose-700 font-medium" title={item.rejection_reason}>
                                  {item.cisac_error_code && `[${item.cisac_error_code}] `}
                                  {item.rejection_reason}
                                </span>
                              ) : isReg ? (
                                <span className="text-emerald-700">Dépôt validé avec succès</span>
                              ) : (
                                <span className="text-slate-400">Non trouvée au catalogue</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Boutons en fin de rapport */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Analyser un autre fichier
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-xl shadow-md transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
