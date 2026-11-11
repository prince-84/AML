export interface Company {
  id: number;
  name: string;
  trade_license_no?: string | null;
  sector?: string | null;
  country?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  plan?: string | null;
  plan_expires_at?: string | null;
  screening_credits_used?: number;
  status?: string | null;
}

export interface User {
  id: number;
  company_id?: number;
  name: string;
  email: string;
  role: "owner" | "mlro" | "officer" | "viewer" | string;
  phone?: string | null;
  last_login_at?: string | null;
  company?: Company;
}

export interface CustomerDocument {
  id: number;
  customer_id: number;
  doc_type: string;
  doc_number?: string | null;
  issuing_country?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  file_name?: string | null;
  verified: boolean;
  verification?: Record<string, string> | null;
  verified_by?: number | null;
  verified_at?: string | null;
  created_at?: string;
}

export interface Candidate {
  name?: string;
  full_name?: string;
  matched_name?: string;
  score?: number;
  match_score?: number;
  list_name?: string;
  source_list?: string;
  datasets?: string[];
  programmes?: string[];
  topics?: string[];
  dob?: string | null;
  nationality?: string | null;
  entity_id?: string | null;
  external_id?: string | null;
  caption?: string;
  summary?: string;
  aliases?: string[];
  [key: string]: unknown;
}

export interface Screening {
  id: number;
  customer_id?: number | null;
  subject_name: string;
  subject_dob?: string | null;
  subject_nationality?: string | null;
  mode: string;
  source: string;
  threshold?: number | string;
  status: string;
  best_score?: number | null;
  candidates_count?: number;
  duration_ms?: number | null;
  credits_used?: number;
  results?: Candidate[] | null;
  note?: string | null;
  created_at?: string;
  customer?: Customer | null;
  tm_alerts?: TmAlert[];
}

export interface ScreeningAlert {
  id: number;
  customer_id: number;
  screening_id?: number;
  matched_name: string;
  match_score: number;
  list_name: string;
  priority: "low" | "review" | "high" | string;
  status: string;
  decision_notes?: string | null;
  decided_by?: number | null;
  decided_at?: string | null;
  due_at?: string | null;
  created_at?: string;
  customer?: Customer | null;
  tm_alerts?: TmAlert[];
}

export interface Customer {
  id: number;
  customer_no: string;
  type: string;
  member_category?: string | null;
  residency?: string | null;
  full_name: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  name_ar?: string | null;
  dob?: string | null;
  gender?: string | null;
  nationality?: string | null;
  occupation?: string | null;
  employer?: string | null;
  source_of_funds?: string | null;
  expected_activity?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address_line?: string | null;
  city?: string | null;
  country?: string | null;
  status: string;
  kyc_status: string;
  screening_status: string;
  risk_level?: string | null;
  risk_score?: number | null;
  edd_required?: boolean;
  edd_status?: string | null;
  next_review_date?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  documents?: CustomerDocument[];
  screenings?: Screening[];
  alerts?: ScreeningAlert[];
  screening_alerts?: ScreeningAlert[];
  transactions?: Transaction[];
  cases?: CaseItem[];
  journey?: JourneyStep[] | null;
}

export interface JourneyStep {
  key?: string;
  label?: string;
  name?: string;
  title?: string;
  status?: string;
  state?: string;
  detail?: string | null;
  note?: string | null;
}

export interface Transaction {
  id: number;
  customer_id: number;
  txn_no: string;
  txn_date: string;
  type: string;
  item_description?: string | null;
  metal_type?: string | null;
  weight_grams?: number | string | null;
  amount: number | string;
  currency: string;
  payment_method: string;
  channel?: string | null;
  status?: string | null;
  flagged: boolean;
  created_at?: string;
  customer?: Customer | null;
  tm_alerts?: TmAlert[];
}

export interface TmAlert {
  id: number;
  transaction_id?: number | null;
  customer_id: number;
  rule_code: string;
  title: string;
  description?: string | null;
  severity: string;
  status: string;
  notes?: string | null;
  decided_at?: string | null;
  created_at?: string;
  customer?: Customer | null;
  transaction?: Transaction | null;
}

export interface TmRule {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  params?: Record<string, number | string> | null;
  is_enabled: boolean;
  severity?: string | null;
}

export interface CaseItem {
  id: number;
  case_no: string;
  customer_id: number;
  source: string;
  title: string;
  description?: string | null;
  status: string;
  priority?: string | null;
  assigned_to?: number | null;
  opened_by?: number | null;
  due_at?: string | null;
  closed_at?: string | null;
  resolution?: string | null;
  created_at?: string;
  customer?: Customer | null;
  str_reports?: StrReport[];
}

export interface StrReport {
  id: number;
  case_id: number;
  customer_id: number;
  report_no: string;
  report_type: string;
  status: string;
  reason?: string | null;
  narrative?: string | null;
  amount_involved?: number | string | null;
  goaml_xml?: string | null;
  filed_at?: string | null;
  filed_by?: number | null;
  created_at?: string;
  customer?: Customer | null;
  case?: CaseItem | null;
}

export interface Provider {
  id?: number;
  provider: string;
  is_enabled: boolean;
  mode?: string | null;
  has_key?: boolean;
  api_key_masked?: string | null;
  masked_key?: string | null;
  key_last4?: string | null;
  key_stored_at?: string | null;
  threshold?: number | string | null;
  dataset_size?: string | null;
  entries_count?: number | null;
  names_count?: number | null;
  sync_schedule?: string | null;
  last_sync_at?: string | null;
  status_text?: string | null;
}

export interface Ewra {
  id: number;
  title: string;
  period?: string | null;
  status: string;
  inherent_score?: number | null;
  customer_score?: number | null;
  products_score?: number | null;
  channels_score?: number | null;
  geography_score?: number | null;
  counterparty_score?: number | null;
  // tolerated alternate key spellings from the API
  customer?: number | null;
  products?: number | null;
  channels?: number | null;
  geography?: number | null;
  counterparty?: number | null;
  residual_score?: number | null;
  residual?: number | null;
  methodology_note?: string | null;
  created_at?: string;
  approved_by?: number | null;
}

export interface FormField {
  id: number;
  field_key: string;
  label: string;
  section?: string | null;
  is_mandatory: boolean;
  is_enabled: boolean;
  sort?: number;
}

export interface AuditLog {
  id: number;
  action: string;
  subject_type?: string | null;
  subject_id?: number | null;
  meta?: Record<string, unknown> | null;
  created_at?: string;
  user?: { id: number; name: string } | null;
}

export interface UsageRow {
  id?: number;
  provider: string;
  calls: number;
  credits: number;
  month: string;
  source?: string | null;
}
