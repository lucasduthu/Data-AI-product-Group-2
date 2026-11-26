export type ValidationStatus = "PENDING_REVIEW" | "VALIDATED" | "REJECTED";

export type RightHolderRole =
  | "AUTHOR"
  | "COMPOSER"
  | "AUTHOR_COMPOSER"
  | "ARRANGER"
  | "ADAPTOR"
  | "PUBLISHER"
  | "SUB_PUBLISHER"
  | "PRODUCER"
  | "PERFORMER"
  | "A"
  | "C"
  | "AC"
  | "AR"
  | "AD"
  | "E"
  | "SE"
  | "P"
  | "I";

export interface RightHolderSplit {
  holder_name: string;
  ipi_number: string | null;
  role: RightHolderRole;
  dep_share_pct: string;
  drm_share_pct: string;
  sync_share_pct?: string;
  phono_share_pct?: string;
  share_percentage: string;
  society_name?: string | null;
  society_de?: string | null;
  society_dr?: string | null;
  is_controlled?: boolean;
  controlled_by_name?: string | null;
}

export interface CWRValidationReport {
  work_id: string | null;
  work_title: string;
  is_cwr_ready: boolean;
  dep_total_pct: string;
  drm_total_pct: string;
  sync_total_pct?: string;
  phono_total_pct?: string;
  publisher_dep_pct: string;
  blocking_errors: string[];
  warnings: string[];
}

export interface WorkTimelineNote {
  id: string;
  author: string;
  text: string;
  created_at: string;
}

export interface WorkTimelineNoteCreate {
  author?: string;
  text: string;
}

export type AdministrationStatus =
  | "ACTIVE"
  | "IN_DISPUTE"
  | "UNDER_ADMIN"
  | "ARCHIVED";

export type WorkGroupType =
  | "SERIE_TV"
  | "FILM_CINEMA"
  | "DOCUMENTAIRE"
  | "EMISSION_TV"
  | "ALBUM"
  | "AUTRE";

export interface WorkGroupReadSummary {
  id: string;
  name: string;
  group_type: WorkGroupType | string;
  production_company?: string | null;
  broadcaster_or_client?: string | null;
  contract_reference?: string | null;
  cue_usage_type?: string | null;
  track_or_cue_number?: string | null;
}

export interface WorkGroupRead {
  id: string;
  name: string;
  group_type: WorkGroupType | string;
  production_company?: string | null;
  broadcaster_or_client?: string | null;
  release_year?: number | null;
  director_or_producer?: string | null;
  notes?: string | null;
  contract_id?: string | null;
  contract_reference?: string | null;
  default_splits?: RightHolderSplit[];
  works_count: number;
  created_at: string;
  updated_at: string;
}

export interface WorkGroupCreatePayload {
  name: string;
  group_type?: WorkGroupType | string;
  production_company?: string | null;
  broadcaster_or_client?: string | null;
  release_year?: number | null;
  director_or_producer?: string | null;
  notes?: string | null;
  contract_id?: string | null;
  contract_reference?: string | null;
  default_splits?: RightHolderSplit[];
  initial_work_ids?: string[];
}

export interface TargetHolderBatchUpdate {
  target_holder_name_or_ipi: string;
  new_holder_name?: string | null;
  new_ipi_number?: string | null;
  new_role?: RightHolderRole | string | null;
  new_dep_share_pct?: string | null;
  new_drm_share_pct?: string | null;
  new_sync_share_pct?: string | null;
  new_phono_share_pct?: string | null;
}

export interface WorkBatchUpdatePayload {
  work_ids: string[];
  assign_to_group_id?: string | null;
  inherit_group_contract?: boolean;
  inherit_group_splits?: boolean;
  remove_from_group_id?: string | null;
  cue_usage_type?: string | null;
  administration_status?: AdministrationStatus | string | null;
  lifecycle_status?: WorkLifeCycleStatus | string | null;
  contract_reference?: string | null;
  cotage_number?: string | null;
  genre?: string | null;
  append_timeline_note?: WorkTimelineNoteCreate | null;
  append_general_notes?: string | null;
  splits_preset?: string | null;
  target_holder_update?: TargetHolderBatchUpdate | null;
}

export interface WorkBatchUpdateResult {
  updated_works_count: number;
  work_ids: string[];
  summary_messages: string[];
}

export interface DashboardTaskRead {
  id: string;
  title: string;
  category: string;
  priority: "HIGH" | "NORMAL" | "LOW" | string;
  due_date?: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardTaskCreatePayload {
  title: string;
  category?: string;
  priority?: string;
  due_date?: string | null;
}

export interface SacemDistributionInfo {
  name: string;
  target_date: string;
  days_remaining: number;
  rights_covered: string;
  is_next: boolean;
}

export interface SubpublisherDeadlineInfo {
  partner: string;
  territory: string;
  expected_period: string;
  notes: string;
}

export interface DashboardDeadlinesReport {
  current_date: string;
  next_sacem_distribution: SacemDistributionInfo;
  all_sacem_distributions: SacemDistributionInfo[];
  subpublisher_deadlines: SubpublisherDeadlineInfo[];
}

export type WorkLifeCycleStatus =
  | "INFORMATIONS_MANQUANTES"
  | "A_DEPOSER"
  | "DEPOSE_EN_ATTENTE"
  | "DEPOSE_ET_EXPLOITE"
  | "REJET_SACEM"
  | "ARCHIVE";

export interface WorkRead {
  id: string;
  title: string;
  subtitle?: string | null;
  alternate_titles: string[];
  iswc: string | null;
  sacem_work_code?: string | null;
  cotage_number?: string | null;
  isrc_codes: string[];
  performers: string[];
  genre?: string | null;
  duration_seconds?: number | null;
  creation_year?: number | null;
  administration_status?: AdministrationStatus | string;
  contract_reference?: string | null;
  general_notes?: string | null;
  timeline_notes?: WorkTimelineNote[];
  groups?: WorkGroupReadSummary[];
  rights_managed?: string[];
  splits: RightHolderSplit[];
  sacem_registration_status?: string | null;
  sacem_ack_reference?: string | null;
  sacem_registered_at?: string | null;
  sacem_rejection_reason?: string | null;
  cwr_validation: CWRValidationReport | null;
  lifecycle_status?: WorkLifeCycleStatus | string;
  lifecycle_status_label?: string | null;
  lifecycle_status_issues?: string[];
  entity_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CwrAckItem {
  transaction_number?: number;
  work_id?: string | null;
  work_title: string;
  matched: boolean;
  status: "REGISTERED" | "REJECTED" | "UNMATCHED" | string;
  sacem_work_code?: string | null;
  iswc?: string | null;
  cotage_number?: string | null;
  rejection_reason?: string | null;
  cisac_error_code?: string | null;
}

export interface CwrAckReport {
  filename: string;
  total_transactions: number;
  registered_count: number;
  rejected_count: number;
  unmatched_count: number;
  items: CwrAckItem[];
  summary_messages: string[];
}

export interface ContractPartyExtraction {
  party_name: string;
  role: RightHolderRole;
  ipi_number: string | null;
  dep_share_pct: string;
  drm_share_pct: string;
  sync_share_pct?: string;
  phono_share_pct?: string;
  source_clause_quote: string | null;
  postal_address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string;
  legal_form?: string | null;
  rcs_or_siret?: string | null;
}

export interface AdvanceClauseExtraction {
  has_advance: boolean;
  advance_amount: string;
  beneficiary_name: string | null;
  recoupable_streams: string[];
  source_clause_quote: string | null;
}

export interface ContractWorkSubgroup {
  name: string;
  composers: string[];
  work_titles: string[];
}

export interface ExpectedCessionContract {
  subgroup_name: string;
  composers: string[];
  work_count: number;
  status: "PENDING" | "LINKED" | string;
  linked_contract_id?: string | null;
  linked_contract_reference?: string | null;
}

export interface ContractRead {
  id: string;
  contract_reference: string;
  contract_type: string;
  publisher_name: string;
  counterparty_name: string;
  signature_date: string | null;
  start_date: string | null;
  end_date: string | null;
  territory: string;
  duration_years: number | null;
  advance_amount: string;
  recouped_amount: string;
  remaining_advance_balance: string;
  currency: string;
  parties: ContractPartyExtraction[];
  advance: AdvanceClauseExtraction | null;
  work_titles: string[];
  work_subgroups?: ContractWorkSubgroup[];
  co_edition_alert?: string | null;
  requires_cession_contract?: boolean;
  expected_cession_contracts?: ExpectedCessionContract[];
  audiovisual_program?: string | null;
  source_filename: string | null;
  sacem_contract_number?: string | null;
  cwr_contract_type?: string | null;
  extracted_clauses_summary: string | null;
  cwr_split_warnings: string[];
  confidence_score: number;
  validation_status: ValidationStatus;
  validated_by: string | null;
  validated_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateWorkMatch {
  work_id: string;
  work_title: string;
  iswc: string | null;
  performers: string[];
  cosine_similarity: number;
  lexical_similarity: number;
  combined_confidence: number;
  match_method: string;
}

export interface DeterministicSplitAllocation {
  holder_name: string;
  role: string | null;
  ipi_number: string | null;
  right_type: "DEP" | "DRM" | "SYNC" | "PHONO";
  share_percentage: string;
  allocated_amount: string;
  recouped_amount: string;
  net_payable_amount: string;
}

export interface StatementLineMatch {
  id: string;
  statement_id: string;
  row_number: number;
  raw_work_title: string;
  raw_iswc: string | null;
  raw_sacem_code?: string | null;
  raw_isrc: string | null;
  raw_performer: string | null;
  right_type: "DEP" | "DRM" | "SYNC" | "PHONO";
  exploitation_type: string;
  territory: string;
  units: number;
  gross_amount: string;
  currency: string;
  source_currency?: string;
  exchange_rate?: string;
  source_gross_amount?: string;
  matched_work_id: string | null;
  matched_work_title: string | null;
  match_method: string;
  match_reasoning?: string | null;
  confidence_score: number;
  validation_status: ValidationStatus;
  validated_by: string | null;
  validated_at: string | null;
  review_notes: string | null;
  top_match: CandidateWorkMatch | null;
  alternatives: CandidateWorkMatch[];
  allocations: DeterministicSplitAllocation[];
}

export interface StatementRead {
  id: string;
  source_name: string;
  filename: string | null;
  period_start: string;
  period_end: string;
  total_gross_amount: string;
  validated_gross_amount: string;
  pending_gross_amount: string;
  lines_count: number;
  validated_lines_count: number;
  currency: string;
  source_currency?: string;
  exchange_rate?: string;
  source_gross_amount?: string;
  accounting_status?: "DRAFT" | "LOCKED" | "PAID" | string;
  campaign_id?: string | null;
  locked_at?: string | null;
  paid_at?: string | null;
  payment_reference?: string | null;
  payment_method?: string | null;
  payment_notes?: string | null;
  integrity_hash?: string | null;
  lines: StatementLineMatch[];
  created_at: string;
}

export interface HolderWorkBreakdown {
  work_id?: string | null;
  work_title: string;
  iswc?: string | null;
  right_type: string;
  exploitation_type?: string;
  gross_line_amount: string;
  source_gross_amount?: string;
  source_currency?: string;
  exchange_rate?: string;
  share_percentage: string;
  allocated_amount: string;
  territory?: string;
  work_group_id?: string | null;
  work_group_title?: string | null;
}

export interface AdvancedStatementGroup {
  group_key: string;
  group_label: string;
  total_gross: string;
  total_allocated: string;
  works_count: number;
  lines: Array<{
    work_title: string;
    right_type: string;
    gross_amount: string;
    share_percentage: string;
    allocated_amount: string;
    territory?: string;
    work_group_title?: string;
  }>;
}

export interface AdvanceRecoupmentState {
  right_holder_id?: string | null;
  holder_name: string;
  role: string | null;
  ipi_number: string | null;
  contract_id: string | null;
  contract_reference: string | null;
  entity_type?: "PERSONNE_PHYSIQUE" | "SOCIETE" | string;
  legal_form?: string | null;
  siret?: string | null;
  vat_number?: string | null;
  vat_applicable?: boolean;
  vat_rate_pct?: string;
  vat_amount?: string;
  ircec_precompte_applicable?: boolean;
  urssaf_dispense_certificate?: boolean;
  iban?: string | null;
  bic?: string | null;
  gross_royalties_allocated: string;
  source_gross_royalties_allocated?: string | null;
  source_currency?: string;
  exchange_rate?: string;
  initial_advance: string;
  previously_recouped: string;
  recouped_in_period: string;
  remaining_unrecouped_balance: string;
  taxable_base_ht?: string;
  precompte_ircec_amount?: string;
  precompte_social_amount?: string;
  previous_reserve_balance?: string;
  min_payment_threshold?: string;
  is_below_payment_threshold?: boolean;
  retained_in_reserve?: string;
  carried_forward_to_next?: string;
  payout_status?: "PAYABLE" | "BELOW_THRESHOLD" | "RECOUPING" | "ZERO_BALANCE" | string;
  legal_mention_applied?: string | null;
  net_payable_amount: string;
  e_invoicing_status?: string;
  is_deceased?: boolean;
  payout_recipient_id?: string | null;
  payout_recipient_name?: string | null;
  payout_redirected?: boolean;
  succession_active?: boolean;
  heirs_distribution?: Array<{
    heir_name: string;
    relationship: string;
    share_pct: string;
    allocated_gross: string;
    net_payable: string;
    iban?: string | null;
    bic?: string | null;
  }>;
  works_count?: number;
  works_breakdown?: HolderWorkBreakdown[];
}

export interface RoyaltyRunReport {
  statement_id: string;
  source_name: string;
  accounting_status?: "DRAFT" | "LOCKED" | "PAID" | string;
  is_locked?: boolean;
  locked_at?: string | null;
  paid_at?: string | null;
  payment_reference?: string | null;
  payment_method?: string | null;
  payment_notes?: string | null;
  integrity_hash?: string | null;
  total_statement_gross: string;
  total_validated_gross: string;
  total_pending_review_gross: string;
  total_allocated_checksum: string;
  total_recouped_in_period: string;
  total_net_payable: string;
  total_retained_in_reserve?: string;
  below_threshold_count?: number;
  validated_lines_processed: number;
  pending_lines_skipped: number;
  holder_statements: AdvanceRecoupmentState[];
}

export interface DashboardSummary {
  total_works: number;
  cwr_ready_works: number;
  cwr_conflict_works: number;
  total_contracts: number;
  pending_contracts: number;
  validated_contracts: number;
  total_advances_granted: string;
  total_advances_recouped: string;
  total_advances_remaining: string;
  total_statements: number;
  total_statement_lines: number;
  validated_statement_lines: number;
  pending_statement_lines: number;
  total_gross_reconciled: string;
  total_gross_pending_blackbox: string;
}

export interface SplitPreset {
  id: string;
  name: string;
  description: string;
  admin_fee_pct: string;
  splits: RightHolderSplit[];
}

export interface CurrencyRateItem {
  currency: string;
  label: string;
  symbol: string;
  rate_to_eur: string;
  rate_bce?: string;
  source?: string;
  last_updated?: string;
}

export interface CurrencyConvertRequest {
  amount: string;
  from_currency: string;
  to_currency: string;
  custom_rate?: string | null;
}

export interface CurrencyConvertResponse {
  source_amount: string;
  source_currency: string;
  target_amount: string;
  target_currency: string;
  effective_rate: string;
  rate_bce?: string | null;
  converted_at: string;
}

export interface WorkspaceSettings {
  id: string;
  publisher_name: string;
  publisher_ipi: string;
  publisher_iban?: string;
  publisher_bic?: string;
  cwr_sender_code: string;
  affiliated_societies: string[];
  default_currency: string;
  currency_rates?: CurrencyRateItem[];
  default_operator_email: string;
  max_publisher_dep_pct: string;
  default_admin_fee_pct: string;
  vat_rate_pct: string;
  min_payment_threshold: string;
  statement_messages?: Record<string, string>;
  openrouter_model: string;
  high_confidence_threshold: number;
  anomaly_threshold: number;
  vector_weight: number;
  lexical_weight: number;
  onboarding_completed?: boolean;
  onboarding_dismissed?: boolean;
  onboarding_completed_steps?: string[];
  split_presets: SplitPreset[];
  updated_at: string;
}

export interface SandboxStatus {
  total_works: number;
  total_contracts: number;
  total_holders: number;
  total_work_groups: number;
  total_statements: number;
  is_empty: boolean;
  onboarding_completed: boolean;
  onboarding_dismissed: boolean;
  onboarding_completed_steps: string[];
}

export interface SandboxLoadDemoResult {
  status: string;
  message: string;
  works_count: number;
  contracts_count: number;
  holders_count: number;
  work_groups_count: number;
  statements_count: number;
}

export interface SandboxResetResult {
  status: string;
  message: string;
  works_count: number;
  contracts_count: number;
  holders_count: number;
  work_groups_count: number;
  statements_count: number;
}

export type SandboxActionResponse = SandboxLoadDemoResult;

export interface CSVImportProfile {
  id: string;
  profile_name: string;
  source_organism: string;
  delimiter: string;
  decimal_separator: string;
  default_right_type: string;
  title_column: string;
  iswc_column: string;
  isrc_column: string;
  performer_column: string;
  right_type_column: string;
  exploitation_type_column: string;
  gross_amount_column: string;
  units_column: string;
  territory_column: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  actor: string;
  summary: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface IndividualHolderReport {
  filename: string;
  generated_at: string;
  publisher_name: string;
  publisher_ipi: string;
  holder_name: string;
  holder_ipi: string | null;
  contract_reference: string | null;
  period_start: string;
  period_end: string;
  language?: string;
  group_by?: string;
  hide_zero_lines?: boolean;
  total_lines_count?: number;
  filtered_lines_count?: number;
  gross_royalties_allocated: string;
  source_gross_royalties_allocated?: string | null;
  source_currency?: string;
  exchange_rate?: string;
  initial_advance: string;
  previously_recouped: string;
  recouped_in_period: string;
  remaining_unrecouped_balance: string;
  taxable_base_ht?: string;
  net_payable_ht: string;
  vat_rate_pct: string;
  vat_amount: string;
  net_payable_ttc: string;
  precompte_social?: string;
  previous_reserve_balance?: string;
  retained_in_reserve?: string;
  net_payable_amount?: string;
  groups?: AdvancedStatementGroup[];
  line_details?: Array<{
    work_title: string;
    right_type: string;
    gross_amount: string;
    share_percentage: string;
    allocated_amount: string;
    territory?: string;
    work_group_title?: string;
  }>;
  csv_content: string;
  printable_text?: string;
}

export interface MigratedWorkPreview {
  title: string;
  subtitle?: string | null;
  alternate_titles: string[];
  iswc: string | null;
  sacem_work_code?: string | null;
  cotage_number?: string | null;
  genre?: string | null;
  isrc_codes: string[];
  performers: string[];
  migration_action: "NEW" | "UPSERT_ISWC" | string;
  holders_count: number;
  dep_total_pct: string;
  drm_total_pct: string;
  sync_total_pct: string;
  phono_total_pct: string;
  is_cwr_ready: boolean;
  blocking_errors: string[];
  contract_reference: string | null;
  initial_advance_eur: string;
  recouped_advance_eur: string;
  remaining_advance_eur: string;
}

export interface CatalogMigrationReport {
  dry_run: boolean;
  source_system: string;
  source_filename: string;
  sha256_integrity_hash: string;
  total_works_parsed: number;
  new_works_count: number;
  upserted_existing_iswc_count: number;
  cwr_ready_works_count: number;
  cwr_conflict_works_count: number;
  contracts_migrated_count: number;
  holders_synced_count?: number;
  total_initial_advances_eur: string;
  total_recouped_advances_eur: string;
  total_remaining_advances_eur: string;
  items: MigratedWorkPreview[];
  migrated_works: WorkRead[];
}

export interface HeirShare {
  heir_name: string;
  share_pct: string;
  relationship: string;
  heir_id?: string | null;
  ipi_number?: string | null;
  iban?: string | null;
  bic?: string | null;
  tax_notes?: string | null;
}

export interface RightHolderDirectoryEntry {
  id: string;
  full_name: string;
  stage_name_or_trade_name: string | null;
  entity_type: "PERSONNE_PHYSIQUE" | "SOCIETE";
  legal_form: string | null;
  primary_role: string;
  ipi_number: string | null;
  coad_or_isni: string | null;
  affiliated_society: string;
  society_de?: string;
  society_dr?: string;
  email: string | null;
  phone: string | null;
  postal_address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
  siret: string | null;
  vat_number: string | null;
  vat_applicable: boolean;
  vat_rate_pct: string;
  ircec_precompte_applicable: boolean;
  urssaf_dispense_certificate: boolean;
  iban: string | null;
  bic: string | null;
  retained_reserve_balance?: string;
  notes: string | null;
  is_deceased?: boolean;
  deceased_at?: string | null;
  payout_recipient_id?: string | null;
  payout_recipient_name?: string | null;
  succession_active?: boolean;
  succession_notes?: string | null;
  heirs?: HeirShare[];
  succession_summary?: string | null;
  works_count: number;
  invoicing_profile_label: string;
  is_invoice_ready: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReadyToUseInvoicePayload {
  invoice_number: string;
  document_type: "NOTE_DROITS_AUTEUR" | "FACTURE_REDEVANCES_FACTURX" | string;
  issue_date: string;
  period_label: string;
  publisher_name: string;
  publisher_siret: string;
  publisher_vat: string;
  publisher_address: string;
  holder_id: string;
  holder_name: string;
  entity_type: "PERSONNE_PHYSIQUE" | "SOCIETE" | string;
  legal_form: string;
  holder_ipi: string | null;
  holder_siret: string | null;
  holder_vat_number: string | null;
  holder_address: string;
  holder_email: string | null;
  holder_iban: string | null;
  gross_royalties_eur: string;
  recouped_advance_eur: string;
  taxable_base_ht_eur: string;
  vat_rate_pct: string;
  vat_amount_eur: string;
  ircec_raap_cotisation_eur: string;
  csg_crds_cotisation_eur: string;
  total_precompte_social_eur: string;
  net_payable_to_holder_eur: string;
  legal_mentions: string[];
  printable_text: string;
}

export type WorkAuditIssueSeverity = "ERROR" | "WARNING" | "INFO";

export type WorkAuditIssueCategory =
  | "MISSING_IPI"
  | "EQUILIBRIUM_ERROR"
  | "NO_CONTROLLED_PUBLISHER"
  | "ORPHAN_COEDITION"
  | "MISSING_SACEM_CODE"
  | "MISSING_ISWC"
  | "MISSING_COTAGE";

export interface WorkAuditIssueItem {
  category: WorkAuditIssueCategory;
  severity: WorkAuditIssueSeverity;
  label: string;
  details: string;
  can_auto_repair: boolean;
}

export interface WorkAuditReportItem {
  work_id: string;
  title: string;
  iswc: string | null;
  sacem_work_code: string | null;
  cotage_number: string | null;
  contract_reference: string | null;
  has_blocking_errors: boolean;
  issues: WorkAuditIssueItem[];
}

export interface CatalogAuditReport {
  total_works: number;
  healthy_works_count: number;
  health_score_pct: string;
  blocking_works_count: number;
  warning_works_count: number;
  issues_by_category: Record<string, number>;
  items: WorkAuditReportItem[];
}

export interface CatalogAutoRepairPayload {
  auto_fill_ipis_from_directory?: boolean;
  auto_balance_splits?: boolean;
  auto_inherit_project_contracts?: boolean;
  target_work_ids?: string[];
}

export interface CatalogAutoRepairResult {
  repaired_works_count: number;
  repaired_ipis_count: number;
  repaired_splits_count: number;
  repaired_contracts_count: number;
  summary_messages: string[];
}

export interface CGP1ImportReport {
  created_contracts_count: number;
  updated_contracts_count: number;
  synchronized_parties_count: number;
  errors: string[];
  contract_references: string[];
}

export interface ContractLinkToWorksPayload {
  link_mode: "WORK_GROUP" | "RIGHT_HOLDER_MATCH" | "SPECIFIC_WORKS";
  work_group_id?: string | null;
  right_holder_name_or_ipi?: string | null;
  work_ids?: string[];
  set_cotage_prefix?: string | null;
}

export interface ContractLinkToWorksResult {
  linked_works_count: number;
  contract_reference: string;
  affected_work_ids: string[];
  summary: string;
}

export interface StatementLockPayload {
  notes?: string;
  operator_email?: string;
}

export interface MarkStatementPaidPayload {
  payment_date?: string | null;
  payment_method?: string;
  payment_reference: string;
  payment_notes?: string | null;
  operator_email?: string;
}

export interface SepaPayeeSummary {
  payee_id: string;
  name: string;
  role?: string | null;
  amount_eur: string;
  iban_raw: string;
  iban_formatted: string;
  bic?: string | null;
  is_iban_valid: boolean;
  is_heir: boolean;
  heir_of?: string | null;
  is_mandataire: boolean;
  mandataire_of?: string | null;
  remittance_info: string;
}

export interface SepaSkippedPayeeSummary {
  payee_id: string;
  name: string;
  role?: string | null;
  gross_amount_eur: string;
  net_amount_eur: string;
  reason: string;
  iban_raw?: string | null;
}

export interface SepaValidationReport {
  statement_id: string;
  source_name: string;
  period_start?: string | null;
  period_end?: string | null;
  debtor_name: string;
  debtor_iban: string;
  debtor_bic?: string | null;
  is_debtor_iban_valid: boolean;
  is_debtor_bic_valid: boolean;
  min_payment_threshold: string;
  total_payees_evaluated: number;
  total_valid_recipients: number;
  total_skipped_recipients: number;
  total_amount_eur: string;
  is_ready_for_export: boolean;
  blocking_issues: string[];
  included: SepaPayeeSummary[];
  skipped: SepaSkippedPayeeSummary[];
}

export interface SepaExportRequest {
  execution_date?: string | null;
  remittance_prefix?: string;
  allow_unverified_ibans?: boolean;
  debtor_name?: string | null;
  debtor_iban?: string | null;
  debtor_bic?: string | null;
}

export interface SepaExportResponse {
  statement_id: string;
  filename: string;
  xml_content: string;
  total_transactions: number;
  total_amount_eur: string;
  execution_date: string;
  message_id: string;
  payment_info_id: string;
  debtor_iban: string;
  included_payees: SepaPayeeSummary[];
  skipped_payees: SepaSkippedPayeeSummary[];
}

export interface UnifiedSearchWorkItem {
  id: string;
  title: string;
  subtitle?: string | null;
  iswc?: string | null;
  sacem_work_code?: string | null;
  cotage_number?: string | null;
  performers: string[];
  contract_reference?: string | null;
  holders_count: number;
  is_cwr_ready: boolean;
  sacem_registration_status?: string | null;
}

export interface UnifiedSearchHolderItem {
  id: string;
  full_name: string;
  stage_name_or_trade_name?: string | null;
  primary_role: string;
  ipi_number?: string | null;
  entity_type: string;
  associated_works_count: number;
  associated_contracts_count: number;
}

export interface UnifiedSearchContractItem {
  id: string;
  contract_reference: string;
  contract_type: string;
  publisher_name: string;
  counterparty_name: string;
  audiovisual_program?: string | null;
  works_count: number;
  validation_status: string;
}

export interface UnifiedSearchGroupItem {
  id: string;
  name: string;
  group_type: string;
  production_company?: string | null;
  contract_reference?: string | null;
  works_count: number;
}

export interface UnifiedSearchResponse {
  query: string;
  total_results: number;
  works: UnifiedSearchWorkItem[];
  holders: UnifiedSearchHolderItem[];
  contracts: UnifiedSearchContractItem[];
  groups: UnifiedSearchGroupItem[];
}

export interface StatementSummary {
  id: string;
  source_name: string;
  filename?: string | null;
  period_start: string;
  period_end: string;
  total_gross_amount: string;
  currency: string;
  source_currency: string;
  exchange_rate: string;
  source_gross_amount: string;
  accounting_status: string;
  integrity_hash?: string | null;
}

export interface DistributionCampaign {
  id: string;
  name: string;
  period_start?: string | null;
  period_end?: string | null;
  accounting_status: 'DRAFT' | 'LOCKED' | 'PAID' | string;
  locked_at?: string | null;
  paid_at?: string | null;
  payment_reference?: string | null;
  payment_method?: string | null;
  payment_notes?: string | null;
  integrity_hash?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  statements_count: number;
  total_gross_amount: string;
  statements: StatementSummary[];
}

export interface ConsolidatedSourceBreakdown {
  statement_id: string;
  source_name: string;
  filename?: string | null;
  allocated_gross: string;
  source_gross_amount?: string | null;
  source_currency: string;
  exchange_rate: string;
}

export interface ConsolidatedHolderPayout {
  right_holder_id?: string | null;
  holder_name: string;
  role?: string | null;
  ipi_number?: string | null;
  entity_type: string;
  legal_form?: string | null;
  siret?: string | null;
  vat_number?: string | null;
  vat_applicable: boolean;
  vat_rate_pct: string;
  vat_amount: string;
  precompte_social_amount: string;
  iban?: string | null;
  bic?: string | null;
  total_gross_allocated: string;
  initial_advance: string;
  previously_recouped: string;
  recouped_in_period: string;
  remaining_unrecouped_balance: string;
  taxable_base_ht: string;
  previous_reserve_balance: string;
  min_payment_threshold: string;
  is_below_payment_threshold: boolean;
  retained_in_reserve: string;
  carried_forward_to_next: string;
  payout_status: 'PAYABLE' | 'BELOW_THRESHOLD' | 'RECOUPING' | 'ZERO_BALANCE' | string;
  legal_mention_applied?: string | null;
  net_payable_amount: string;
  e_invoicing_status?: string | null;
  sources_breakdown: ConsolidatedSourceBreakdown[];
  works_count: number;
  works_breakdown: HolderWorkBreakdown[];
  is_deceased: boolean;
  payout_recipient_id?: string | null;
  payout_recipient_name?: string | null;
  payout_redirected: boolean;
  succession_active: boolean;
  heirs_distribution: Array<{
    heir_name: string;
    relationship: string;
    share_pct: string;
    allocated_gross: string;
    net_payable: string;
    iban?: string | null;
    bic?: string | null;
  }>;
}

export interface ConsolidatedCampaignReport {
  campaign_id: string;
  campaign_name: string;
  period_start?: string | null;
  period_end?: string | null;
  accounting_status: string;
  is_locked: boolean;
  locked_at?: string | null;
  paid_at?: string | null;
  payment_reference?: string | null;
  payment_method?: string | null;
  payment_notes?: string | null;
  integrity_hash?: string | null;
  total_statements_count: number;
  total_campaign_gross: string;
  total_allocated_checksum: string;
  total_recouped_in_period: string;
  total_net_payable: string;
  total_retained_in_reserve: string;
  payable_holders_count: number;
  below_threshold_count: number;
  recouping_count: number;
  sources_summary: Array<{
    statement_id: string;
    source_name: string;
    filename?: string | null;
    period_start?: string | null;
    period_end?: string | null;
    total_gross_amount: string;
    allocated_gross: string;
    accounting_status: string;
  }>;
  holders_payouts: ConsolidatedHolderPayout[];
}

export interface PublishingEntity {
  id: string;
  name: string;
  legal_name?: string | null;
  sacem_ipi: string;
  sacem_account_number?: string | null;
  cwr_sender_code: string;
  color: string;
  description?: string | null;
  iban?: string | null;
  bic?: string | null;
  default_currency: string;
  is_default: boolean;
  works_count: number;
  contracts_count: number;
  cwr_ready_works: number;
  created_at: string;
  updated_at: string;
}

export interface PublishingEntityCreatePayload {
  name: string;
  legal_name?: string | null;
  sacem_ipi: string;
  sacem_account_number?: string | null;
  cwr_sender_code?: string;
  color?: string;
  description?: string | null;
  iban?: string | null;
  bic?: string | null;
  default_currency?: string;
  is_default?: boolean;
}

export interface PublishingEntityUpdatePayload {
  name?: string;
  legal_name?: string | null;
  sacem_ipi?: string;
  sacem_account_number?: string | null;
  cwr_sender_code?: string;
  color?: string;
  description?: string | null;
  iban?: string | null;
  bic?: string | null;
  default_currency?: string;
  is_default?: boolean;
}

// -------------------------------------------------------------
// US-5.18 : Bac à Sable Comparaison Différentielle & Sous-Édition
// -------------------------------------------------------------

export type ComparisonStatus = "SYNCHRONIZED" | "DISCREPANCY" | "KOROM_ONLY" | "SACEM_ONLY";

export interface DiscrepancyDetail {
  field: string;
  severity: "ERROR" | "WARNING" | "INFO";
  korom_value?: string | null;
  sacem_value?: string | null;
  message: string;
  can_auto_sync: boolean;
}

export interface CatalogDiffItem {
  id: string;
  korom_work_id?: string | null;
  title_korom?: string | null;
  title_sacem?: string | null;
  sacem_work_code_korom?: string | null;
  sacem_work_code_sacem?: string | null;
  iswc_korom?: string | null;
  iswc_sacem?: string | null;
  cotage_korom?: string | null;
  splits_korom: RightHolderSplit[];
  splits_sacem: RightHolderSplit[];
  status: ComparisonStatus;
  status_label: string;
  discrepancies: DiscrepancyDetail[];
  can_apply_sacem_codes: boolean;
}

export interface CatalogDiffReport {
  total_compared: number;
  synchronized_count: number;
  discrepancy_count: number;
  korom_only_count: number;
  sacem_only_count: number;
  health_score_pct: string | number;
  items: CatalogDiffItem[];
  summary_messages: string[];
}

export interface ApplySacemCodesItem {
  work_id: string;
  sacem_work_code?: string | null;
  iswc?: string | null;
}

export interface ApplySacemCodesPayload {
  items: ApplySacemCodesItem[];
}

export interface ApplySacemCodesResult {
  updated_works_count: number;
  updated_work_ids: string[];
  messages: string[];
}

export interface SubpublishingDeliveryPayload {
  work_ids: string[];
  sub_publisher_name: string;
  sub_publisher_ipi?: string | null;
  territory: string;
  territory_code?: string;
  delivery_reference: string;
  notes?: string | null;
}



