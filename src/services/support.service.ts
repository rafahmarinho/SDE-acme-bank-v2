/**
 * Support tickets and replies.
 * - Customers see and create only their own tickets (RLS tickets_select / tickets_insert).
 * - Staff see the queue through staff_list_tickets() (names only, no other personal data).
 * - Message text is length-limited (T536) and always rendered as plain text by React - no rich
 *   HTML, so no dangerouslySetInnerHTML anywhere (T36).
 * - The reply author's role is set by a database trigger from the JWT, never from the request.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { HttpError } from "@/lib/errors";
import type { AppRole } from "@/lib/supabase/server";

export const TICKET_CATEGORIES = ["general", "card", "transfer", "account", "privacy"] as const;
export const TICKET_STATUSES = ["open", "answered", "closed"] as const;

export const TicketInput = z.object({
  subject: z.string().trim().min(3, "Add a short subject.").max(120),
  body: z.string().trim().min(10, "Tell us a bit more (at least 10 characters).").max(2000),
  category: z.enum(TICKET_CATEGORIES),
});
export const ReplyInput = z.object({
  ticketId: z.string().uuid(),
  body: z.string().trim().min(1, "Write a message.").max(2000),
});

export type TicketListItem = {
  id: string; subject: string; category: string; status: string; created_at: string; updated_at: string;
  customer_name?: string; reply_count?: number;
};

export async function listTickets(supabase: SupabaseClient, userId: string, role: AppRole, status?: string): Promise<TicketListItem[]> {
  const s = (TICKET_STATUSES as readonly string[]).includes(status ?? "") ? status : undefined;
  if (role !== "customer") {
    const { data, error } = await supabase.rpc("staff_list_tickets", { p_status: s ?? null, p_limit: 50 });
    if (error) throw new HttpError(500);
    return data as TicketListItem[];
  }
  let q = supabase
    .from("support_tickets").select("id, subject, category, status, created_at, updated_at")
    .eq("customer_id", userId).order("updated_at", { ascending: false }).limit(50);
  if (s) q = q.eq("status", s);
  const { data, error } = await q;
  if (error) throw new HttpError(500);
  return data;
}

export async function getTicket(supabase: SupabaseClient, userId: string, role: AppRole, ticketId: string) {
  let q = supabase.from("support_tickets").select("id, customer_id, subject, body, category, status, created_at, updated_at").eq("id", ticketId);
  if (role === "customer") q = q.eq("customer_id", userId);
  const { data: ticket } = await q.maybeSingle();
  if (!ticket) throw new HttpError(404);
  const { data: replies, error } = await supabase
    .from("support_replies").select("id, author_id, author_role, body, created_at")
    .eq("ticket_id", ticketId).order("created_at").limit(100);
  if (error) throw new HttpError(500);
  let customerName: string | null = null;
  if (role !== "customer") {
    const { data } = await supabase.rpc("staff_ticket_customer", { p_ticket: ticketId });
    customerName = (data as string | null) ?? null;
  }
  return { ticket, replies: replies as Array<{ id: string; author_id: string; author_role: string; body: string; created_at: string }>, customerName };
}

export async function createTicket(supabase: SupabaseClient, userId: string, input: z.infer<typeof TicketInput>) {
  const { count } = await supabase
    .from("support_tickets").select("id", { count: "exact", head: true }).eq("customer_id", userId).eq("status", "open");
  if ((count ?? 0) >= 10) throw new HttpError(409, "You have 10 open requests. Please wait for a reply before opening more.");
  const { data, error } = await supabase
    .from("support_tickets").insert({ customer_id: userId, subject: input.subject, body: input.body, category: input.category })
    .select("id").single();
  if (error) throw new HttpError(500);
  return data.id as string;
}

export async function replyToTicket(supabase: SupabaseClient, userId: string, role: AppRole, input: z.infer<typeof ReplyInput>) {
  const { ticket } = await getTicket(supabase, userId, role, input.ticketId); // 404 if not visible
  if (ticket.status === "closed") throw new HttpError(409, "This request is closed. Open a new one if you still need help.");
  const { error } = await supabase.from("support_replies").insert({ ticket_id: input.ticketId, author_id: userId, body: input.body });
  if (error) throw new HttpError(500);
}

export async function setTicketStatus(supabase: SupabaseClient, userId: string, role: AppRole, ticketId: string, status: "open" | "closed") {
  if (role === "customer" && status !== "closed") throw new HttpError(403);
  let q = supabase.from("support_tickets").update({ status, updated_at: new Date().toISOString() }).eq("id", ticketId);
  if (role === "customer") q = q.eq("customer_id", userId);
  const { data, error } = await q.select("id").maybeSingle();
  if (error) throw new HttpError(500);
  if (!data) throw new HttpError(404);
}
