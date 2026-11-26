import {
  AuditLogEntry,
  CatalogAuditReport,
  CatalogAutoRepairPayload,
  CatalogAutoRepairResult,
  CatalogMigrationReport,
  CGP1ImportReport,
  ContractLinkToWorksPayload,
  ContractLinkToWorksResult,
  ContractPartyExtraction,
  ContractRead,
  CurrencyConvertRequest,
  CurrencyConvertResponse,
  CurrencyRateItem,
  CSVImportProfile,
  CwrAckReport,
  DashboardSummary,
  IndividualHolderReport,
  MarkStatementPaidPayload,
  ReadyToUseInvoicePayload,
  RightHolderDirectoryEntry,
  RightHolderSplit,
  RoyaltyRunReport,
  SandboxActionResponse,
  SandboxLoadDemoResult,
  SandboxResetResult,
  SandboxStatus,
  SepaExportRequest,
  SepaExportResponse,
  SepaValidationReport,
  StatementLineMatch,
  StatementLockPayload,
  StatementRead,
  WorkBatchUpdatePayload,
  WorkBatchUpdateResult,
  WorkGroupCreatePayload,
  WorkGroupRead,
  WorkRead,
  WorkspaceSettings,
  UnifiedSearchResponse,
  DistributionCampaign,
  ConsolidatedCampaignReport,
  DashboardTaskRead,
  DashboardTaskCreatePayload,
  DashboardDeadlinesReport,
  PublishingEntity,
  PublishingEntityCreatePayload,
  PublishingEntityUpdatePayload,
  ApplySacemCodesPayload,
  ApplySacemCodesResult,
  CatalogDiffReport,
  SubpublishingDeliveryPayload,
} from "@/types/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getActiveEntityId(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("korom_active_entity_id");
  }
  return null;
}

export function getEntityHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const activeId = getActiveEntityId();
  if (activeId) {
    return {
      "X-Entity-Id": activeId,
      ...customHeaders,
    };
  }
  return customHeaders;
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await fetch(`${API_BASE_URL}/api/v1/royalties/summary`, {
    cache: "no-store",
    headers: getEntityHeaders(),
  });
  if (!res.ok) {
    throw new Error("Impossible de charger la synthèse du tableau de bord.");
  }
  return res.json();
}

export async function fetchWorks(groupId?: string): Promise<WorkRead[]> {
  const url = groupId
    ? `${API_BASE_URL}/api/v1/works?group_id=${encodeURIComponent(groupId)}`
    : `${API_BASE_URL}/api/v1/works`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: getEntityHeaders(),
  });
  if (!res.ok) {
    throw new Error("Impossible de charger le catalogue d'œuvres.");
  }
  return res.json();
}

export async function fetchWorkGroups(): Promise<WorkGroupRead[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/work-groups`, {
    cache: "no-store",
    headers: getEntityHeaders(),
  });
  if (!res.ok) {
    throw new Error("Impossible de charger les groupes et projets.");
  }
  return res.json();
}

export async function createWorkGroup(
  payload: WorkGroupCreatePayload
): Promise<WorkGroupRead> {
  const res = await fetch(`${API_BASE_URL}/api/v1/work-groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("Impossible de créer le groupe / projet audiovisuel.");
  }
  return res.json();
}

export async function updateWorkGroup(
  groupId: string,
  payload: Partial<WorkGroupCreatePayload>
): Promise<WorkGroupRead> {
  const res = await fetch(`${API_BASE_URL}/api/v1/work-groups/${groupId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("Impossible de mettre à jour le groupe d'œuvres.");
  }
  return res.json();
}

export async function deleteWorkGroup(groupId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/work-groups/${groupId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Impossible de supprimer le groupe d'œuvres.");
  }
}

export async function batchDeleteWorkGroups(
  groupIds: string[]
): Promise<{ deleted_count: number; deleted_ids: string[]; detached_works_count: number; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/work-groups/batch-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ group_ids: groupIds }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData.detail || "Impossible de supprimer le lot de projets / groupes."
    );
  }
  return res.json();
}

export async function deleteStatement(statementId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/statements/${statementId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Impossible de supprimer le relevé de royalties.");
  }
}

export async function applyWorkGroupInheritance(
  groupId: string,
  applyContract: boolean = true,
  applySplits: boolean = false
): Promise<{
  group_id: string;
  group_name: string;
  contract_reference?: string | null;
  affected_works_count: number;
  total_group_works: number;
}> {
  const params = new URLSearchParams({
    apply_contract_ref: String(applyContract),
    apply_default_splits: String(applySplits),
  });
  const res = await fetch(
    `${API_BASE_URL}/api/v1/work-groups/${groupId}/apply-inheritance?${params.toString()}`,
    { method: "POST" }
  );
  if (!res.ok) {
    throw new Error("Impossible d'appliquer l'héritage contrat/splits au projet.");
  }
  return res.json();
}

export async function batchUpdateWorks(
  payload: WorkBatchUpdatePayload
): Promise<WorkBatchUpdateResult> {
  const res = await fetch(`${API_BASE_URL}/api/v1/works/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("Impossible d'appliquer la mise à jour par lot sur les œuvres.");
  }
  return res.json();
}

export async function createWork(payload: {
  title: string;
  subtitle?: string | null;
  alternate_titles?: string[];
  iswc?: string | null;
  sacem_work_code?: string | null;
  cotage_number?: string | null;
  isrc_codes?: string[];
  performers?: string[];
  genre?: string | null;
  duration_seconds?: number | null;
  creation_year?: number | null;
  administration_status?: string;
  contract_reference?: string | null;
  general_notes?: string | null;
  lifecycle_status?: string | null;
  splits: RightHolderSplit[];
}): Promise<WorkRead> {
  const res = await fetch(`${API_BASE_URL}/api/v1/works`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("Impossible de créer l'œuvre au catalogue.");
  }
  return res.json();
}

export async function updateWork(
  workId: string,
  payload: {
    title: string;
    subtitle?: string | null;
    alternate_titles?: string[];
    iswc?: string | null;
    sacem_work_code?: string | null;
    cotage_number?: string | null;
    isrc_codes?: string[];
    performers?: string[];
    genre?: string | null;
    duration_seconds?: number | null;
    creation_year?: number | null;
    administration_status?: string;
    contract_reference?: string | null;
    general_notes?: string | null;
    lifecycle_status?: string | null;
    splits: RightHolderSplit[];
  }
): Promise<WorkRead> {
  const res = await fetch(`${API_BASE_URL}/api/v1/works/${workId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("Impossible de mettre à jour l'œuvre.");
  }
  return res.json();
}

export async function addWorkTimelineNote(
  workId: string,
  payload: {
    author?: string;
    text: string;
  }
): Promise<WorkRead> {
  const res = await fetch(`${API_BASE_URL}/api/v1/works/${workId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("Impossible d'ajouter une annotation à l'œuvre.");
  }
  return res.json();
}

export async function deleteWork(workId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/works/${workId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Impossible de supprimer l'œuvre du catalogue.");
  }
}

export async function batchDeleteWorks(
  workIds: string[]
): Promise<{ deleted_count: number; deleted_ids: string[]; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/works/batch-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ work_ids: workIds }),
  });
  if (!res.ok) {
    throw new Error("Impossible de supprimer le lot d'œuvres.");
  }
  return res.json();
}

export async function fetchContracts(): Promise<ContractRead[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/contracts`, {
    cache: "no-store",
    headers: getEntityHeaders(),
  });
  if (!res.ok) {
    throw new Error("Impossible de charger les contrats.");
  }
  return res.json();
}

export async function uploadContractPdf(file: File): Promise<ContractRead> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE_URL}/api/v1/contracts/upload`, {
    method: "POST",
    headers: getEntityHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || "Échec de l'analyse du document (contrat invalide ou non reconnu)."
    );
  }
  return res.json();
}

export async function importCGP1Contracts(file: File): Promise<CGP1ImportReport> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE_URL}/api/v1/contracts/import-cgp1`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Échec de l'importation des contrats SACEM CGP1.");
  }
  return res.json();
}

export async function linkContractToWorks(
  contractId: string,
  payload: ContractLinkToWorksPayload
): Promise<ContractLinkToWorksResult> {
  const res = await fetch(`${API_BASE_URL}/api/v1/contracts/${contractId}/link-works`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Échec de la liaison du contrat aux œuvres.");
  }
  return res.json();
}

export async function validateContract(
  contractId: string,
  payload: {
    approve: boolean;
    validated_by?: string;
    review_notes?: string;
    contract_reference?: string;
    work_titles?: string[];
    work_subgroups?: import("@/types/api").ContractWorkSubgroup[];
    co_edition_alert?: string | null;
    requires_cession_contract?: boolean;
    expected_cession_contracts?: import("@/types/api").ExpectedCessionContract[];
    audiovisual_program?: string | null;
    advance_amount?: string;
    parties?: ContractPartyExtraction[];
  }
): Promise<ContractRead> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/contracts/${contractId}/validate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    throw new Error("Échec de la validation humaine du contrat.");
  }
  return res.json();
}

export async function createWorkGroupFromContract(
  contractId: string,
  payload: {
    name?: string;
    group_type?: "AUDIOVISUAL" | "ALBUM";
    production_company?: string;
    notes?: string;
  }
): Promise<{
  work_group_id: string;
  work_group_name: string;
  group_type: string;
  contract_reference: string;
  linked_works_count: number;
  work_titles: string[];
  summary_message: string;
}> {
  const res = await fetch(`${API_BASE_URL}/api/v1/contracts/${contractId}/create-work-group`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Échec de la création du groupe d'œuvres depuis le contrat.");
  }
  return res.json();
}

export async function deleteContract(contractId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/contracts/${contractId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Impossible de supprimer le contrat.");
  }
}

export async function batchDeleteContracts(
  contractIds: string[]
): Promise<{ deleted_count: number; deleted_ids: string[]; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/contracts/batch-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contract_ids: contractIds }),
  });
  if (!res.ok) {
    throw new Error("Impossible de supprimer le lot de contrats.");
  }
  return res.json();
}

export async function fetchStatements(): Promise<StatementRead[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/statements`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Impossible de charger les relevés CSV.");
  }
  return res.json();
}

export async function loadStressTestSample(): Promise<StatementRead> {
  const res = await fetch(`${API_BASE_URL}/api/v1/statements/stress-test-sample`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("Échec du chargement du jeu de données Stress-Test 5 000 lignes.");
  }
  return res.json();
}

export async function uploadStatementCsv(
  file: File,
  sourceName: string,
  currency?: string,
  exchangeRate?: string
): Promise<StatementRead> {
  const formData = new FormData();
  formData.append("source_name", sourceName);
  formData.append("file", file);
  if (currency) {
    formData.append("currency", currency);
  }
  if (exchangeRate) {
    formData.append("exchange_rate", exchangeRate);
  }
  const res = await fetch(`${API_BASE_URL}/api/v1/statements/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    throw new Error("Échec de l'import du relevé CSV.");
  }
  return res.json();
}

export async function validateStatementLine(
  lineId: string,
  payload: {
    approve: boolean;
    matched_work_id?: string | null;
    validated_by?: string;
    review_notes?: string;
  }
): Promise<StatementLineMatch> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/statements/lines/${lineId}/validate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    throw new Error("Échec de la validation de la ligne de relevé.");
  }
  return res.json();
}

export async function createWorkAndMatchStatementLine(
  statementId: string,
  lineId: string,
  payload: {
    title: string;
    subtitle?: string | null;
    alternate_titles?: string[];
    iswc?: string | null;
    sacem_work_code?: string | null;
    cotage_number?: string | null;
    isrc_codes?: string[];
    performers?: string[];
    genre?: string | null;
    duration_seconds?: number | null;
    creation_year?: number | null;
    administration_status?: string;
    contract_reference?: string | null;
    general_notes?: string | null;
    splits?: RightHolderSplit[];
    validated_by?: string;
    review_notes?: string | null;
  }
): Promise<StatementLineMatch> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/statements/${statementId}/lines/${lineId}/create-work-and-match`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Échec de la création d'œuvre et de l'appariement.");
  }
  return res.json();
}

export async function fetchStatementLines(
  statementId: string,
  options?: {
    minConfidence?: number;
    maxConfidence?: number;
    sortBy?: string;
  }
): Promise<StatementLineMatch[]> {
  const params = new URLSearchParams();
  if (options?.minConfidence !== undefined)
    params.append("min_confidence", String(options.minConfidence));
  if (options?.maxConfidence !== undefined)
    params.append("max_confidence", String(options.maxConfidence));
  if (options?.sortBy) params.append("sort_by", options.sortBy);

  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(
    `${API_BASE_URL}/api/v1/statements/${statementId}/lines${qs}`
  );
  if (!res.ok) {
    throw new Error("Échec du chargement des lignes de relevé.");
  }
  return res.json();
}

export interface CWRExportPayload {
  filename: string;
  cwr_version: string;
  included_works_count: number;
  included_works: string[];
  skipped_works_count: number;
  skipped_works: {
    work_id: string;
    work_title: string;
    blocking_errors: string[];
  }[];
  content: string;
  filtered_by_group?: { id: string; name: string } | string;
  filtered_by_dates?: { date_from?: string | null; date_to?: string | null };
  filtered_by_selection?: number;
}

export interface CwrExportFilters {
  work_group_id?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  work_ids?: string[] | null;
  contract_reference?: string | null;
}

export async function exportCatalogCwr(
  filters?: CwrExportFilters
): Promise<CWRExportPayload> {
  const params = new URLSearchParams();
  if (filters?.work_group_id) params.set("work_group_id", filters.work_group_id);
  if (filters?.date_from) params.set("date_from", filters.date_from);
  if (filters?.date_to) params.set("date_to", filters.date_to);
  if (filters?.work_ids && filters.work_ids.length > 0) {
    params.set("work_ids", filters.work_ids.join(","));
  }
  if (filters?.contract_reference) {
    params.set("contract_reference", filters.contract_reference);
  }

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE_URL}/api/v1/works/export/cwr${query}`, {
    cache: "no-store",
    headers: getEntityHeaders(),
  });
  if (!res.ok) {
    throw new Error("Impossible de générer l'export CWR v2.1.");
  }
  return res.json();
}

export async function migrateCatalogFile(
  file: File,
  sourceSystem: string = "LE_SAGE_CSV",
  dryRun: boolean = true
): Promise<CatalogMigrationReport> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("source_system", sourceSystem);
  formData.append("dry_run", String(dryRun));
  const res = await fetch(`${API_BASE_URL}/api/v1/works/migrate`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    throw new Error("Échec de l'analyse ou de la migration du catalogue.");
  }
  return res.json();
}

export async function migrateCatalogDemo(
  dryRun: boolean = true,
  sourceSystem: string = "LE_SAGE_CSV"
): Promise<CatalogMigrationReport> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/works/migrate-demo?dry_run=${dryRun}&source_system=${encodeURIComponent(
      sourceSystem
    )}`,
    {
      method: "POST",
    }
  );
  if (!res.ok) {
    throw new Error("Échec de la simulation de migration Le Sage.");
  }
  return res.json();
}

export async function extractDemoContract(
  sampleKey: "minuit_seine" | "horizon_veloce"
): Promise<ContractRead> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/contracts/demo/${sampleKey}`,
    {
      method: "POST",
    }
  );
  if (!res.ok) {
    throw new Error("Échec de l'extraction du contrat de démo.");
  }
  return res.json();
}

export async function validateHighConfidenceLines(
  statementId: string
): Promise<StatementRead> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/statements/${statementId}/validate-high-confidence`,
    {
      method: "POST",
    }
  );
  if (!res.ok) {
    throw new Error("Échec de la validation par lot >= 90%.");
  }
  return res.json();
}

export async function computeStatementRoyalties(
  statementId: string
): Promise<RoyaltyRunReport> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/statements/${statementId}/compute-royalties`,
    {
      method: "POST",
    }
  );
  if (!res.ok) {
    throw new Error("Échec du calcul déterministe des royalties.");
  }
  return res.json();
}

export async function lockAndPostStatementRoyalties(
  statementId: string,
  payload?: StatementLockPayload
): Promise<RoyaltyRunReport> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/statements/${statementId}/lock-and-post`,
    {
      method: "POST",
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    }
  );
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Échec de la clôture comptable du relevé.");
  }
  return res.json();
}

export async function markStatementAsPaid(
  statementId: string,
  payload: MarkStatementPaidPayload
): Promise<RoyaltyRunReport> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/statements/${statementId}/mark-as-paid`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Échec de l'enregistrement du règlement bancaire.");
  }
  return res.json();
}

export async function reopenStatementToDraft(
  statementId: string
): Promise<RoyaltyRunReport> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/statements/${statementId}/reopen-draft`,
    {
      method: "POST",
    }
  );
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Échec de la réouverture en mode simulation (DRAFT).");
  }
  return res.json();
}

export async function fetchHolderIndividualStatement(
  statementId: string,
  holderName: string,
  options?: {
    lang?: string;
    groupBy?: string;
    hideZeroLines?: boolean;
  }
): Promise<IndividualHolderReport> {
  const params = new URLSearchParams();
  if (options?.lang) params.set("lang", options.lang);
  if (options?.groupBy) params.set("group_by", options.groupBy);
  if (options?.hideZeroLines !== undefined) params.set("hide_zero_lines", String(options.hideZeroLines));
  const qs = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(
    `${API_BASE_URL}/api/v1/statements/${statementId}/holder-report/${encodeURIComponent(
      holderName
    )}${qs}`,
    {
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error("Impossible de générer le relevé individuel.");
  }
  return res.json();
}

export async function fetchStatementHolderInvoice(
  statementId: string,
  holderName: string
): Promise<ReadyToUseInvoicePayload> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/statements/${statementId}/holder-invoice/${encodeURIComponent(
      holderName
    )}`,
    {
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error("Impossible de générer la facture ou note de droits.");
  }
  return res.json();
}

export async function fetchWorkspaceSettings(): Promise<WorkspaceSettings> {
  const res = await fetch(`${API_BASE_URL}/api/v1/settings`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Impossible de charger la configuration.");
  }
  return res.json();
}

export async function updateWorkspaceSettings(
  payload: Omit<WorkspaceSettings, "id" | "updated_at">
): Promise<WorkspaceSettings> {
  const res = await fetch(`${API_BASE_URL}/api/v1/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("Échec de la sauvegarde de la configuration.");
  }
  return res.json();
}

export async function fetchCurrencyParities(): Promise<CurrencyRateItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/settings/currencies`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Impossible de charger les parités de devises.");
  }
  return res.json();
}

export async function updateCurrencyParity(
  payload: CurrencyRateItem
): Promise<CurrencyRateItem> {
  const res = await fetch(`${API_BASE_URL}/api/v1/settings/currencies`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Échec de mise à jour de la parité.");
  }
  return res.json();
}

export async function resetCurrencyParitiesToBce(): Promise<CurrencyRateItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/settings/currencies/reset-bce`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("Échec de réinitialisation des parités BCE.");
  }
  return res.json();
}

export async function convertCurrencyAmount(
  payload: CurrencyConvertRequest
): Promise<CurrencyConvertResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/settings/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Échec de conversion de devise.");
  }
  return res.json();
}

export async function fetchCsvProfiles(): Promise<CSVImportProfile[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/settings/csv-profiles`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Impossible de charger les profils CSV.");
  }
  return res.json();
}

export async function createCsvProfile(
  payload: Omit<CSVImportProfile, "id" | "created_at">
): Promise<CSVImportProfile> {
  const res = await fetch(`${API_BASE_URL}/api/v1/settings/csv-profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("Échec de la création du profil CSV.");
  }
  return res.json();
}

export async function fetchAuditLogs(): Promise<AuditLogEntry[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/settings/audit-logs`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Impossible de charger le journal d'audit.");
  }
  return res.json();
}

export interface PocUserFeedbackPayload {
  tester_name: string;
  tester_role: string;
  current_tool: string;
  pain_severity_score: number;
  verdict: string;
  edge_case_notes?: string;
}

export async function submitPocUserFeedback(
  payload: PocUserFeedbackPayload
): Promise<AuditLogEntry> {
  const res = await fetch(`${API_BASE_URL}/api/v1/settings/user-feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("Échec de l'enregistrement du retour utilisateur.");
  }
  return res.json();
}

export type RightHolderDirectoryCreatePayload = Omit<
  RightHolderDirectoryEntry,
  | "id"
  | "works_count"
  | "invoicing_profile_label"
  | "is_invoice_ready"
  | "created_at"
  | "updated_at"
>;

export async function fetchRightHolders(): Promise<
  RightHolderDirectoryEntry[]
> {
  const res = await fetch(`${API_BASE_URL}/api/v1/holders`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Impossible de charger le répertoire des ayants droit.");
  }
  return res.json();
}

export async function createRightHolder(
  payload: RightHolderDirectoryCreatePayload
): Promise<RightHolderDirectoryEntry> {
  const res = await fetch(`${API_BASE_URL}/api/v1/holders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("Impossible d'ajouter l'ayant droit au répertoire.");
  }
  return res.json();
}

export async function updateRightHolder(
  holderId: string,
  payload: RightHolderDirectoryCreatePayload
): Promise<RightHolderDirectoryEntry> {
  const res = await fetch(`${API_BASE_URL}/api/v1/holders/${holderId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("Impossible de mettre à jour la fiche ayant droit.");
  }
  return res.json();
}

export async function syncRightHoldersFromCatalog(): Promise<
  RightHolderDirectoryEntry[]
> {
  const res = await fetch(`${API_BASE_URL}/api/v1/holders/sync-from-catalog`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("Impossible de synchroniser les ayants droit du catalogue.");
  }
  return res.json();
}

export async function fetchReadyToUseInvoice(
  holderId: string,
  grossAmount?: string,
  recoupedAdvance?: string,
  periodLabel: string = "2026-S2 (Juillet – Décembre 2026)",
  statementId?: string
): Promise<ReadyToUseInvoicePayload> {
  const params = new URLSearchParams();
  if (grossAmount !== undefined) params.append("gross_amount", grossAmount);
  if (recoupedAdvance !== undefined) params.append("recouped_advance", recoupedAdvance);
  if (periodLabel) params.append("period_label", periodLabel);
  if (statementId) params.append("statement_id", statementId);

  const res = await fetch(
    `${API_BASE_URL}/api/v1/holders/${holderId}/ready-invoice?${params.toString()}`,
    {
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error("Impossible de générer la facture / note de droits.");
  }
  return res.json();
}

export async function deleteRightHolder(holderId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/holders/${holderId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Impossible de supprimer l'ayant droit.");
  }
}

export async function batchDeleteRightHolders(
  holderIds: string[]
): Promise<{ deleted_count: number; deleted_ids: string[]; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/holders/batch-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ holder_ids: holderIds }),
  });
  if (!res.ok) {
    throw new Error("Impossible de supprimer le lot d'ayants droit.");
  }
  return res.json();
}

export async function fetchCatalogAudit(): Promise<CatalogAuditReport> {
  const res = await fetch(`${API_BASE_URL}/api/v1/works/audit`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Impossible de récupérer l'audit de conformité du catalogue.");
  }
  return res.json();
}

export async function triggerCatalogAutoRepair(
  payload: CatalogAutoRepairPayload = {}
): Promise<CatalogAutoRepairResult> {
  const res = await fetch(`${API_BASE_URL}/api/v1/works/audit/auto-repair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("Échec de l'auto-réparation du catalogue.");
  }
  return res.json();
}

export async function fetchStatementSepaPreview(
  statementId: string,
  options?: {
    allowUnverifiedIbans?: boolean;
    debtorName?: string;
    debtorIban?: string;
    debtorBic?: string;
  }
): Promise<SepaValidationReport> {
  const params = new URLSearchParams();
  if (options?.allowUnverifiedIbans !== undefined) {
    params.set("allow_unverified_ibans", String(options.allowUnverifiedIbans));
  }
  if (options?.debtorName) params.set("debtor_name", options.debtorName);
  if (options?.debtorIban) params.set("debtor_iban", options.debtorIban);
  if (options?.debtorBic) params.set("debtor_bic", options.debtorBic);
  const qs = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(
    `${API_BASE_URL}/api/v1/statements/${statementId}/sepa-preview${qs}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Impossible de charger la prévisualisation du virement SEPA.");
  }
  return res.json();
}

export async function exportStatementSepaXml(
  statementId: string,
  payload: SepaExportRequest = {}
): Promise<SepaExportResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/statements/${statementId}/export-sepa`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Échec de la génération du fichier SEPA XML pain.001.");
  }
  return res.json();
}

export async function fetchSandboxStatus(): Promise<SandboxStatus> {
  const res = await fetch(`${API_BASE_URL}/api/v1/sandbox/status`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Impossible de récupérer l'état du bac à sable.");
  }
  return res.json();
}

export async function loadSandboxDemo(): Promise<SandboxLoadDemoResult> {
  const res = await fetch(`${API_BASE_URL}/api/v1/sandbox/load-demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Impossible de charger le catalogue de démonstration.");
  }
  return res.json();
}

export async function resetSandbox(): Promise<SandboxResetResult> {
  const res = await fetch(`${API_BASE_URL}/api/v1/sandbox/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Impossible de réinitialiser le bac à sable.");
  }
  return res.json();
}

export async function updateOnboardingState(payload: {
  completed?: boolean;
  dismissed?: boolean;
  completed_steps?: string[];
}): Promise<WorkspaceSettings> {
  const res = await fetch(`${API_BASE_URL}/api/v1/settings/onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Impossible de mettre à jour l'état d'onboarding.");
  }
  return res.json();
}

export async function importCwrAck(file: File, dryRun: boolean = false): Promise<CwrAckReport> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("dry_run", String(dryRun));

  const res = await fetch(`${API_BASE_URL}/api/v1/works/import-cwr-ack`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Échec de l'analyse du fichier d'accusé de réception SACEM.");
  }

  return res.json();
}

export async function searchUniversal(
  query: string,
  limitPerCategory: number = 8
): Promise<UnifiedSearchResponse> {
  const params = new URLSearchParams({
    q: query,
    limit_per_category: String(limitPerCategory),
  });
  const res = await fetch(`${API_BASE_URL}/api/v1/search?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Échec de la recherche universelle.");
  }
  return res.json();
}

// ==========================================
// CAMPAGNES DE RÉPARTITION MULTI-RELEVÉS (US-5.7)
// ==========================================

export async function fetchCampaigns(): Promise<DistributionCampaign[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/campaigns`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Échec de récupération des campagnes de répartition.");
  }
  return res.json();
}

export async function createCampaign(payload: {
  name: string;
  period_start?: string | null;
  period_end?: string | null;
  notes?: string | null;
  statement_ids?: string[];
}): Promise<DistributionCampaign> {
  const res = await fetch(`${API_BASE_URL}/api/v1/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Échec de création de la campagne de répartition.");
  }
  return res.json();
}

export async function fetchCampaignById(campaignId: string): Promise<DistributionCampaign> {
  const res = await fetch(`${API_BASE_URL}/api/v1/campaigns/${campaignId}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Échec de récupération du détail de la campagne.");
  }
  return res.json();
}

export async function updateCampaign(
  campaignId: string,
  payload: { name?: string; period_start?: string | null; period_end?: string | null; notes?: string | null }
): Promise<DistributionCampaign> {
  const res = await fetch(`${API_BASE_URL}/api/v1/campaigns/${campaignId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Échec de mise à jour de la campagne.");
  }
  return res.json();
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/campaigns/${campaignId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Échec de suppression de la campagne.");
  }
}

export async function attachStatementsToCampaign(
  campaignId: string,
  statementIds: string[]
): Promise<DistributionCampaign> {
  const res = await fetch(`${API_BASE_URL}/api/v1/campaigns/${campaignId}/statements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ statement_ids: statementIds }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Échec du rattachement des relevés à la campagne.");
  }
  return res.json();
}

export async function detachStatementFromCampaign(
  campaignId: string,
  statementId: string
): Promise<DistributionCampaign> {
  const res = await fetch(`${API_BASE_URL}/api/v1/campaigns/${campaignId}/statements/${statementId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Échec du détachement du relevé de la campagne.");
  }
  return res.json();
}

export async function fetchCampaignConsolidatedPayouts(
  campaignId: string
): Promise<ConsolidatedCampaignReport> {
  const res = await fetch(`${API_BASE_URL}/api/v1/campaigns/${campaignId}/consolidated-payouts`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Échec du calcul consolidé de la campagne.");
  }
  return res.json();
}

export async function lockCampaign(
  campaignId: string,
  payload?: { payment_reference?: string; payment_method?: string; payment_notes?: string }
): Promise<ConsolidatedCampaignReport> {
  const res = await fetch(`${API_BASE_URL}/api/v1/campaigns/${campaignId}/lock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Échec de la clôture comptable de la campagne.");
  }
  return res.json();
}

export async function previewCampaignSepa(campaignId: string): Promise<SepaValidationReport> {
  const res = await fetch(`${API_BASE_URL}/api/v1/campaigns/${campaignId}/sepa-preview`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Échec de prévisualisation SEPA de la campagne.");
  }
  return res.json();
}

export async function exportCampaignSepa(
  campaignId: string,
  payload: SepaExportRequest
): Promise<SepaExportResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/campaigns/${campaignId}/export-sepa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Échec de la génération SEPA pour la campagne.");
  }
  return res.json();
}

export async function fetchDashboardTasks(): Promise<DashboardTaskRead[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboard/tasks`, {
    cache: "no-store",
    headers: getEntityHeaders(),
  });
  if (!res.ok) {
    throw new Error("Impossible de charger les tâches du tableau de bord.");
  }
  return res.json();
}

export async function createDashboardTask(
  payload: DashboardTaskCreatePayload
): Promise<DashboardTaskRead> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboard/tasks`, {
    method: "POST",
    headers: getEntityHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("Impossible de créer la tâche.");
  }
  return res.json();
}

export async function toggleDashboardTask(taskId: string): Promise<DashboardTaskRead> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboard/tasks/${taskId}/toggle`, {
    method: "PATCH",
  });
  if (!res.ok) {
    throw new Error("Impossible de mettre à jour la tâche.");
  }
  return res.json();
}

export async function deleteDashboardTask(taskId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboard/tasks/${taskId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Impossible de supprimer la tâche.");
  }
}

export async function fetchDashboardDeadlines(): Promise<DashboardDeadlinesReport> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboard/deadlines`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Impossible de charger l'échéancier des répartitions.");
  }
  return res.json();
}

// =========================================================================
// Multi-Catalogues & Entités Éditoriales (US-5.14)
// =========================================================================

export async function fetchEntities(): Promise<PublishingEntity[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/entities`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Impossible de charger la liste des entités éditoriales.");
  }
  return res.json();
}

export async function createEntity(
  payload: PublishingEntityCreatePayload
): Promise<PublishingEntity> {
  const res = await fetch(`${API_BASE_URL}/api/v1/entities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Impossible de créer la nouvelle entité éditoriale.");
  }
  return res.json();
}

export async function updateEntity(
  entityId: string,
  payload: PublishingEntityUpdatePayload
): Promise<PublishingEntity> {
  const res = await fetch(`${API_BASE_URL}/api/v1/entities/${entityId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Impossible de mettre à jour l'entité.");
  }
  return res.json();
}

export async function deleteEntity(entityId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/entities/${entityId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Impossible de supprimer cette entité éditoriale.");
  }
}

export async function setDefaultEntity(entityId: string): Promise<PublishingEntity> {
  const res = await fetch(`${API_BASE_URL}/api/v1/entities/${entityId}/set-default`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("Impossible de définir cette entité par défaut.");
  }
  return res.json();
}

// -------------------------------------------------------------
// US-5.18 : Bac à Sable Comparaison Différentielle & Sous-Édition
// -------------------------------------------------------------

export async function compareCatalogWithSacem(
  file: File,
  params?: { entityId?: string; dateFrom?: string; dateTo?: string }
): Promise<CatalogDiffReport> {
  const formData = new FormData();
  formData.append("file", file);
  if (params?.entityId) formData.append("entity_id", params.entityId);
  if (params?.dateFrom) formData.append("date_from", params.dateFrom);
  if (params?.dateTo) formData.append("date_to", params.dateTo);

  const res = await fetch(`${API_BASE_URL}/api/v1/subpublishing/compare-sacem`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Erreur lors de la comparaison avec l'export SACEM.");
  }
  return res.json();
}

export async function applySacemCodes(
  payload: ApplySacemCodesPayload
): Promise<ApplySacemCodesResult> {
  const res = await fetch(`${API_BASE_URL}/api/v1/subpublishing/apply-sacem-codes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Impossible d'appliquer les identifiants officiels SACEM.");
  }
  return res.json();
}

export async function exportSubpublishingDeliveryXlsx(
  payload: SubpublishingDeliveryPayload
): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/api/v1/subpublishing/export-delivery-xlsx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Erreur lors de la génération du bordereau Excel.");
  }
  return res.blob();
}

export async function exportSubpublishingDeliveryCwr(
  payload: SubpublishingDeliveryPayload
): Promise<{
  filename: string;
  cwr_version: string;
  included_works_count: number;
  skipped_works_count: number;
  content: string;
  sub_publisher?: any;
}> {
  const res = await fetch(`${API_BASE_URL}/api/v1/subpublishing/export-delivery-cwr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Erreur lors de la génération du CWR de sous-édition.");
  }
  return res.json();
}

export async function exportCatalogXlsx(params?: {
  workGroupId?: string;
  workIds?: string[];
  contractReference?: string;
}): Promise<void> {
  const qs = new URLSearchParams();
  if (params?.workGroupId) qs.set("work_group_id", params.workGroupId);
  if (params?.workIds && params.workIds.length > 0) qs.set("work_ids", params.workIds.join(","));
  if (params?.contractReference) qs.set("contract_reference", params.contractReference);
  const query = qs.toString() ? `?${qs.toString()}` : "";

  const res = await fetch(`${API_BASE_URL}/api/v1/works/export/xlsx${query}`, {
    headers: getEntityHeaders(),
  });
  if (!res.ok) {
    throw new Error("Impossible de générer l'export Excel (.xlsx).");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const tag = (params?.contractReference || "CATALOGUE").replace(/[^a-zA-Z0-9_-]/g, "_");
  a.href = url;
  a.download = `KOROM_VISIBILITE_OEUVRES_${tag}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function toggleAiOverrideSwitch(
  deterministicOnly: boolean
): Promise<{ deterministic_only: boolean; active_model: string; updated_at: string }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/settings/override-switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deterministic_only: deterministicOnly }),
  });
  if (!res.ok) {
    throw new Error("Impossible de basculer l'interrupteur d'urgence IA (⏻ Override Switch).");
  }
  return res.json();
}






