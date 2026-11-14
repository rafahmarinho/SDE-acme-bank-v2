"use server";
/** Statement generation (expensive: strict budget - T1362). Format is an enum allow-list (T42). */
import { revalidatePath } from "next/cache";
import { runAction, type ActionState } from "@/lib/action";
import { authorize } from "@/lib/authz";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";
import { generateStatement, StatementRequest } from "@/services/statements.service";

export async function generateStatementAction(_prev: ActionState<{ statementId: string; format: string }>, form: FormData): Promise<ActionState<{ statementId: string; format: string }>> {
  return runAction(async () => {
    const { user, supabase } = await authorize("statements", "POST");
    await rateLimit(`statement:${user.id}`, BUDGETS.statementGeneration);
    const parsed = StatementRequest.safeParse({
      accountId: form.get("accountId"), periodStart: form.get("periodStart"), periodEnd: form.get("periodEnd"), format: form.get("format"),
    });
    if (!parsed.success) return { ok: false, message: "Choose an account and a period of up to 12 months." };
    const { statementId } = await generateStatement(supabase, user.id, parsed.data);
    revalidatePath("/statements");
    return { ok: true, message: "Your statement is ready.", data: { statementId, format: parsed.data.format } };
  });
}
