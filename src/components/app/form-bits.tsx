"use client";
/** Client-side form helpers: pending-aware submit button and action result message. */
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/feedback";

type ButtonProps = React.ComponentProps<typeof Button> & { pendingText?: string };

export function SubmitButton({ children, pendingText, disabled, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

export function FormMessage({ state }: { state: { ok: boolean; message?: string } | null | undefined }) {
  if (!state?.message) return null;
  return (
    <Alert variant={state.ok ? "success" : "destructive"}>
      {state.ok ? <CircleCheck aria-hidden /> : <CircleAlert aria-hidden />}
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}
