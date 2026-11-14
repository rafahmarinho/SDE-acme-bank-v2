"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrorsOf, runAction, type ActionState } from "@/lib/action";
import { authorize } from "@/lib/authz";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";
import { createTicket, ReplyInput, replyToTicket, setTicketStatus, TicketInput } from "@/services/support.service";

export async function createTicketAction(_prev: ActionState<{ id: string }>, form: FormData): Promise<ActionState<{ id: string }>> {
  const result = await runAction<{ id: string }>(async () => {
    const { user, role, supabase } = await authorize("support", "POST");
    if (role !== "customer") return { ok: false, message: "Staff reply to existing requests." };
    await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
    const parsed = TicketInput.safeParse({ subject: form.get("subject"), body: form.get("body"), category: form.get("category") });
    if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error.issues) };
    const id = await createTicket(supabase, user.id, parsed.data);
    revalidatePath("/support");
    return { ok: true, data: { id } };
  });
  if (result?.ok && result.data) redirect(`/support/${result.data.id}?created=1`);
  return result;
}

export async function replyAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user, role, supabase } = await authorize("support/:id", "POST");
    await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
    const parsed = ReplyInput.safeParse({ ticketId: form.get("ticketId"), body: form.get("body") });
    if (!parsed.success) return { ok: false, message: "Write a message (up to 2,000 characters)." };
    await replyToTicket(supabase, user.id, role, parsed.data);
    revalidatePath(`/support/${parsed.data.ticketId}`);
    revalidatePath("/support");
    return { ok: true, message: "Message sent." };
  });
}

export async function setTicketStatusAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user, role, supabase } = await authorize("support/:id", "PATCH");
    await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
    const ticketId = z.string().uuid().parse(form.get("ticketId"));
    const status = z.enum(["open", "closed"]).parse(form.get("status"));
    await setTicketStatus(supabase, user.id, role, ticketId, status);
    revalidatePath(`/support/${ticketId}`);
    revalidatePath("/support");
    return { ok: true, message: status === "closed" ? "Request closed." : "Request reopened." };
  });
}
