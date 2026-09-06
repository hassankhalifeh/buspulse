// Mirrors Buspulse's 01_schema.sql / 02_triggers.sql / 03_views_and_rls.sql,
// the multi-tenancy upgrade (tenants/fleets/schools), the
// driver_bus_assignments fix, and the WhatsApp bot module
// (buspulse-whatsapp/01_whatsapp_module_schema.sql +
// 02_integration_adapter.sql). Keep in sync if the schema changes.

export type AppRole = "owner" | "admin" | "driver" | "guardian" | "client_viewer";

export interface AppUser {
  id: string;
  auth_uid: string;
  full_name: string;
  phone: string | null;
  role: AppRole;
  driver_id: string | null;
  guardian_id: string | null;
  tenant_id: string | null;
}

export interface Bus {
  bus_id: string;
  plate_number: string;
  model: string | null;
  status: "Active" | "In_Maintenance" | "Retired";
  current_driver_id: string | null;
}

export interface GpsPing {
  tracking_id: number;
  bus_id: string;
  trip_id: string | null;
  event_timestamp: string;
  latitude: number;
  longitude: number;
  is_broadcast_active: boolean;
}

export interface SosAlert {
  alert_id: string;
  bus_id: string;
  driver_id: string;
  event_timestamp: string;
  latitude: number;
  longitude: number;
  status: "Active" | "Resolved";
}

export interface School {
  school_id: string;
  tenant_id: string;
  school_name: string;
  contact_phone: string | null;
  contact_email: string | null;
}

export interface Fleet {
  fleet_id: string;
  company_name: string;
  contact_phone: string | null;
  contact_email: string | null;
}

export interface FleetSchoolLink {
  fleet_id: string;
  school_id: string;
  status: "pending" | "active" | "revoked";
  fleets: Fleet;
}

export interface ClientTrip {
  trip_id: string;
  contract_id: string;
  fleet_id: string;
  route_name: string | null;
  trip_date: string;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  status: string;
  buses: { plate_number: string; model: string | null } | null;
}

// ---------------------------------------------------------------------
// WhatsApp bot module (wa_*) — lives inside the Buspulse admin
// dashboard now, not a separate app, so one login/one URL covers both.
// ---------------------------------------------------------------------
export interface WaTenant {
  id: string;
  company_name: string;
  mode: "standalone" | "integrated";
  linked_fleet_id: string | null;
  subscription_status: "trial" | "active" | "inactive";
}

export type WaContactRole = "owner" | "manager" | "driver" | "parent";

export interface WaContact {
  id: string;
  wa_tenant_id: string;
  phone_number: string;
  full_name: string | null;
  role: WaContactRole;
  contact_saved_confirmed: boolean;
  whitelisted: boolean;
  linked_driver_id: string | null;
  linked_guardian_id: string | null;
}

export interface WaRoute {
  id: string;
  wa_tenant_id: string;
  route_name: string;
  school_name: string | null;
  default_driver_id: string | null;
  default_bus_ref: string | null;
}

export interface WaStudent {
  id: string;
  wa_tenant_id: string;
  student_name: string;
  parent_contact_id: string;
  route_id: string | null;
  station: string | null;
  tuition_override: number | null;
  outstanding_debt: number;
}

export type WaPaymentStatus = "Pending" | "Underpaid_Flagged" | "Confirmed" | "Carried_Forward";

export interface WaPayment {
  id: string;
  wa_tenant_id: string;
  student_id: string;
  amount_due: number;
  amount_paid: number;
  shortfall_amount: number;
  status: WaPaymentStatus;
  collected_by_contact_id: string | null;
  payment_date: string;
  owner_decision: string | null;
}

export type WaExpenseStatus = "Pending" | "Approved" | "Rejected";

export interface WaDriverExpense {
  id: string;
  wa_tenant_id: string;
  driver_contact_id: string;
  expense_date: string;
  amount: number;
  category: string | null;
  receipt_photo_url: string;
  status: WaExpenseStatus;
}

export type WaBroadcastType = "Departed" | "Emergency" | "Wakeup" | "Payment_Reminder" | "Circular";

export interface WaBroadcast {
  id: string;
  wa_tenant_id: string;
  broadcast_type: WaBroadcastType;
  route_id: string | null;
  message_text: string;
  recipient_count: number | null;
  sent_at: string;
}

export interface WaMessageLog {
  id: number;
  wa_tenant_id: string;
  contact_id: string | null;
  phone_number: string;
  direction: "inbound" | "outbound";
  message_type: string | null;
  created_at: string;
}

export interface WaHoliday {
  id: string;
  wa_tenant_id: string;
  holiday_date: string;
  description: string | null;
}
