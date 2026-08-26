/**
 * Hand written to match supabase/migrations. Once you have a project running,
 * regenerate with:
 *   npx supabase gen types typescript --project-id <ref> > lib/supabase/types.ts
 */

export type MemberRole = "owner" | "manager" | "accountant" | "caretaker";
export type LeaseCycle = "daily" | "monthly" | "quarterly" | "semester" | "yearly";
export type LeaseStatus = "upcoming" | "active" | "ended";
export type ChargeStatus = "open" | "paid" | "void";
export type ChargeState = "paid" | "pending" | "overdue" | "void";
export type PaymentMethod =
  | "cash" | "orange_money" | "mtn_momo" | "bank_transfer" | "card" | "other";
export type TicketStatus = "new" | "assigned" | "in_progress" | "resolved" | "cancelled";
export type TicketPriority = "normal" | "high" | "urgent";
export type ReportChannel = "whatsapp" | "sms" | "phone" | "email" | "in_person";
export type EventKind = "viewing" | "work" | "inspection" | "other";
export type PlanTier = "starter" | "growth" | "agency";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled";

export type Agency = {
  id: string;
  name: string;
  country: string;
  city: string;
  currency: string;
  locale: "fr" | "en";
  whatsapp_number: string | null;
  logo_path: string | null;
  created_at: string;
  updated_at: string;
};

export type AgencyMember = {
  user_id: string;
  full_name: string | null;
  role: MemberRole;
  email: string;
  allowed_pages: string[];
  created_at: string;
};

export type Membership = {
  user_id: string;
  agency_id: string;
  role: MemberRole;
  full_name: string | null;
  /** Sidebar pages this member may open. Navigation, not the data guard. */
  allowed_pages: string[];
  created_at: string;
};

export type BuildingRow = {
  id: string;
  agency_id: string;
  name: string;
  address: string;
  city: string;
  acquisition_value: number | null;
  market_value: number | null;
  photo_path: string | null;
  interior_path: string | null;
  amenities: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ApartmentRow = {
  id: string;
  agency_id: string;
  building_id: string;
  label: string;
  floor: string | null;
  rooms: number;
  bathrooms: number;
  sqm: number | null;
  base_rent: number;
  photo_path: string | null;
};

export type ApartmentState = {
  apartment_id: string;
  agency_id: string;
  building_id: string;
  label: string;
  rooms: number;
  bathrooms: number;
  sqm: number | null;
  base_rent: number;
  lease_id: string | null;
  cycle: LeaseCycle | null;
  rent_amount: number | null;
  resident_id: string | null;
  resident_name: string | null;
  resident_phone: string | null;
  lease_started_on: string | null;
  lease_ends_on: string | null;
  is_occupied: boolean;
  rent_state: ChargeState;
};

export type BuildingPerformance = {
  building_id: string;
  agency_id: string;
  name: string;
  apartment_count: number;
  occupied_count: number;
  total_sqm: number;
  income_ytd: number;
  expenses_ytd: number;
  net_yield_pct: number | null;
};

export type ChargeStatusRow = {
  rent_charge_id: string;
  agency_id: string;
  lease_id: string;
  period_start: string;
  period_end: string;
  due_on: string;
  amount: number;
  paid_amount: number;
  balance: number;
  state: ChargeState;
};

export type TicketRow = {
  id: string;
  agency_id: string;
  building_id: string;
  apartment_id: string | null;
  resident_id: string | null;
  technician_id: string | null;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  reported_via: ReportChannel;
  cost: number | null;
  opened_at: string;
  resolved_at: string | null;
};

export type EventRow = {
  id: string;
  agency_id: string;
  building_id: string;
  apartment_id: string | null;
  kind: EventKind;
  title: string;
  detail: string | null;
  starts_at: string;
  assignee: string | null;
};

export type ResidentRow = {
  id: string;
  agency_id: string;
  full_name: string;
  phone_e164: string | null;
  email: string | null;
  notes: string | null;
};

export type LeaseRow = {
  id: string;
  agency_id: string;
  apartment_id: string;
  resident_id: string;
  cycle: LeaseCycle;
  rent_amount: number;
  deposit: number;
  due_day: number;
  starts_on: string;
  ends_on: string | null;
  status: LeaseStatus;
};

export type TechnicianRow = {
  id: string;
  agency_id: string;
  full_name: string;
  trade: string | null;
  phone_e164: string | null;
  is_external: boolean;
  created_at: string;
};

export type RentChargeRow = {
  id: string;
  agency_id: string;
  lease_id: string;
  period_start: string;
  period_end: string;
  due_on: string;
  amount: number;
  status: string;
  created_at: string;
};

export type PaymentRow = {
  id: string;
  agency_id: string;
  lease_id: string;
  amount: number;
  paid_on: string;
  method: PaymentMethod;
  reference: string | null;
  recorded_by: string | null;
  created_at: string;
};

export type PaymentAllocationRow = {
  payment_id: string;
  rent_charge_id: string;
  agency_id: string;
  amount: number;
};

export type ApartmentPhotoRow = {
  id: string;
  agency_id: string;
  apartment_id: string;
  storage_path: string;
  caption: string | null;
  position: number;
  created_at: string;
};

export type TechnicianPerformance = {
  technician_id: string;
  agency_id: string;
  full_name: string;
  trade: string | null;
  phone_e164: string | null;
  is_external: boolean;
  jobs_total: number;
  jobs_resolved: number;
  jobs_open: number;
  total_paid: number;
  avg_days_to_resolve: number | null;
  last_job_at: string | null;
};

export type ReminderRuleRow = {
  id: string;
  agency_id: string;
  offset_days: number;
  channel: ReportChannel;
  template_name: string | null;
  /** What the reminder says, with {tenant} {amount} {period} placeholders. */
  message_body: string | null;
  escalation_step: number;
  is_active: boolean;
};

export type ReminderTargetRow = {
  rent_charge_id: string;
  agency_id: string;
  due_on: string;
  amount: number;
  agency_name: string;
  agency_whatsapp: string | null;
  currency: string;
  resident_name: string;
  resident_phone: string | null;
  apartment_label: string;
};

export type RateLimitRow = {
  bucket: string;
  window_start: string;
  hits: number;
};

export type ReminderEventRow = {
  id: string;
  agency_id: string;
  rent_charge_id: string;
  rule_id: string | null;
  channel: ReportChannel;
  sent_at: string;
  provider_message_id: string | null;
  status: string;
};

export type TicketMessageRow = {
  id: string;
  agency_id: string;
  ticket_id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  media_path: string | null;
  provider_message_id: string | null;
  created_at: string;
};

export type WaConversationRow = {
  id: string;
  agency_id: string;
  phone_e164: string;
  resident_id: string | null;
  last_inbound_at: string | null;
};

export type ExpenseRow = {
  id: string;
  agency_id: string;
  building_id: string;
  apartment_id: string | null;
  ticket_id: string | null;
  category: string;
  amount: number;
  incurred_on: string;
  description: string | null;
  receipt_path: string | null;
};

export type SubscriptionRow = {
  agency_id: string;
  plan: PlanTier;
  status: SubscriptionStatus;
  trial_ends_at: string;
  current_period_end: string | null;
};

export type Database = {
  public: {
    Tables: {
      agencies: { Row: Agency; Insert: Partial<Agency>; Update: Partial<Agency>; Relationships: [] };
      memberships: {
        Row: Membership;
        Insert: Partial<Membership>;
        Update: Partial<Membership>;
        // getCurrentAgency embeds the agency row in one select.
        Relationships: [
          {
            foreignKeyName: "memberships_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      buildings: { Row: BuildingRow; Insert: Partial<BuildingRow>; Update: Partial<BuildingRow>; Relationships: [] };
      apartments: { Row: ApartmentRow; Insert: Partial<ApartmentRow>; Update: Partial<ApartmentRow>; Relationships: [] };
      tickets: {
        Row: TicketRow;
        Insert: Partial<TicketRow>;
        Update: Partial<TicketRow>;
        // The dashboard reads a ticket with its unit, tenant and technician in
        // one select, and PostgREST embeds need the relationship declared.
        Relationships: [
          { foreignKeyName: "tickets_apartment_id_fkey"; columns: ["apartment_id"]; isOneToOne: false; referencedRelation: "apartments"; referencedColumns: ["id"] },
          { foreignKeyName: "tickets_resident_id_fkey"; columns: ["resident_id"]; isOneToOne: false; referencedRelation: "residents"; referencedColumns: ["id"] },
          { foreignKeyName: "tickets_technician_id_fkey"; columns: ["technician_id"]; isOneToOne: false; referencedRelation: "technicians"; referencedColumns: ["id"] },
          { foreignKeyName: "tickets_building_id_fkey"; columns: ["building_id"]; isOneToOne: false; referencedRelation: "buildings"; referencedColumns: ["id"] },
        ];
      };
      residents: { Row: ResidentRow; Insert: Partial<ResidentRow>; Update: Partial<ResidentRow>; Relationships: [] };
      leases: { Row: LeaseRow; Insert: Partial<LeaseRow>; Update: Partial<LeaseRow>; Relationships: [] };
      technicians: { Row: TechnicianRow; Insert: Partial<TechnicianRow>; Update: Partial<TechnicianRow>; Relationships: [] };
      apartment_photos: { Row: ApartmentPhotoRow; Insert: Partial<ApartmentPhotoRow>; Update: Partial<ApartmentPhotoRow>; Relationships: [] };
      reminder_rules: { Row: ReminderRuleRow; Insert: Partial<ReminderRuleRow>; Update: Partial<ReminderRuleRow>; Relationships: [] };
      reminder_events: { Row: ReminderEventRow; Insert: Partial<ReminderEventRow>; Update: Partial<ReminderEventRow>; Relationships: [] };
      ticket_messages: { Row: TicketMessageRow; Insert: Partial<TicketMessageRow>; Update: Partial<TicketMessageRow>; Relationships: [] };
      wa_conversations: { Row: WaConversationRow; Insert: Partial<WaConversationRow>; Update: Partial<WaConversationRow>; Relationships: [] };
      expenses: { Row: ExpenseRow; Insert: Partial<ExpenseRow>; Update: Partial<ExpenseRow>; Relationships: [] };
      events: { Row: EventRow; Insert: Partial<EventRow>; Update: Partial<EventRow>; Relationships: [] };
      rate_limits: { Row: RateLimitRow; Insert: Partial<RateLimitRow>; Update: Partial<RateLimitRow>; Relationships: [] };
      rent_charges: { Row: RentChargeRow; Insert: Partial<RentChargeRow>; Update: Partial<RentChargeRow>; Relationships: [] };
      payments: { Row: PaymentRow; Insert: Partial<PaymentRow>; Update: Partial<PaymentRow>; Relationships: [] };
      payment_allocations: {
        Row: PaymentAllocationRow;
        Insert: Partial<PaymentAllocationRow>;
        Update: Partial<PaymentAllocationRow>;
        Relationships: [
          { foreignKeyName: "payment_allocations_payment_id_fkey"; columns: ["payment_id"]; isOneToOne: false; referencedRelation: "payments"; referencedColumns: ["id"] },
          { foreignKeyName: "payment_allocations_rent_charge_id_fkey"; columns: ["rent_charge_id"]; isOneToOne: false; referencedRelation: "rent_charges"; referencedColumns: ["id"] },
        ];
      };
      subscriptions: {
        Row: SubscriptionRow;
        Insert: Partial<SubscriptionRow>;
        Update: Partial<SubscriptionRow>;
       Relationships: [];
      };
    };
    Views: {
      v_apartment_state: { Row: ApartmentState; Relationships: [] };
      v_building_performance: { Row: BuildingPerformance; Relationships: [] };
      v_charge_status: { Row: ChargeStatusRow; Relationships: [] };
      v_technician_performance: { Row: TechnicianPerformance; Relationships: [] };
      v_reminder_targets: { Row: ReminderTargetRow; Relationships: [] };
    };
    Functions: {
      create_agency_for_current_user: {
        Args: {
          agency_name: string;
          agency_country?: string;
          agency_city?: string;
          agency_currency?: string;
          agency_locale?: string;
          owner_name?: string | null;
        };
        Returns: string;
      };
      create_lease: {
        Args: {
          target_apartment: string;
          resident_name: string;
          resident_phone: string | null;
          rent: number;
          cycle_in?: LeaseCycle;
          starts_on_in?: string;
          deposit_in?: number;
          ends_on_in?: string | null;
        };
        Returns: string;
      };
      record_payment: {
        Args: {
          target_lease: string;
          payment_amount: number;
          payment_method_in?: PaymentMethod;
          paid_on_in?: string;
          reference_in?: string | null;
          periods_covered?: number;
          proof_path_in?: string | null;
        };
        Returns: string;
      };
      resolve_ticket: {
        Args: { target_ticket: string; final_cost?: number };
        Returns: void;
      };
      assign_technician: {
        Args: {
          target_ticket: string;
          target_technician: string;
          estimated_cost?: number | null;
        };
        Returns: void;
      };
      list_agency_members: {
        Args: { target_agency: string };
        Returns: AgencyMember[];
      };
      has_role: {
        Args: { target_agency: string; allowed: MemberRole[] };
        Returns: boolean;
      };
      take_rate_limit: {
        Args: { bucket_key: string; max_hits: number; window_seconds: number };
        Returns: boolean;
      };
      ensure_rent_charge: {
        Args: { target_lease: string; period: string };
        Returns: string;
      };
      next_period_start: {
        Args: { from_period: string; cycle_in: LeaseCycle };
        Returns: string;
      };
      set_member_pages: {
        Args: { target_agency: string; target_user: string; pages: string[] };
        Returns: void;
      };
      resident_by_phone: {
        Args: { target_agency: string; phone: string };
        Returns: { resident_id: string; full_name: string }[];
      };
      wa_route_inbound: {
        Args: { from_phone: string; body: string };
        Returns: {
          conversation_id: string | null;
          agency: string | null;
          resident: string | null;
          resident_name: string | null;
          decision: "attach" | "ask" | "answer" | "open" | "unknown";
          ticket_id: string | null;
          report: string | null;
          lease_count: number;
        }[];
      };
      wa_set_state: {
        Args: {
          conversation: string;
          new_state: "idle" | "awaiting_apartment";
          report?: string | null;
          ticket?: string | null;
        };
        Returns: void;
      };
      set_my_display_name: {
        Args: { target_agency: string; new_name: string };
        Returns: void;
      };
    };
    Enums: {
      member_role: MemberRole;
      lease_cycle: LeaseCycle;
      lease_status: LeaseStatus;
      charge_status: ChargeStatus;
      payment_method: PaymentMethod;
      ticket_status: TicketStatus;
      ticket_priority: TicketPriority;
      report_channel: ReportChannel;
      event_kind: EventKind;
      plan_tier: PlanTier;
      subscription_status: SubscriptionStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
