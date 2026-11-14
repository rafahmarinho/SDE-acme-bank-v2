/** Profile: view and correct personal information (single source of truth: public.profiles - T742). */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/common";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageRole } from "@/lib/page-auth";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { user, supabase } = await requirePageRole(["customer"]);
  const { data: profile } = await supabase
    .from("profiles").select("full_name, email, phone, address_line1, city, postal_code").eq("id", user.id).maybeSingle();
  if (!profile) notFound();
  return (
    <>
      <PageHeader title="Profile" description="Keep your details up to date so we can reach you about your account." />
      <Card>
        <CardHeader><div><CardTitle>Personal details</CardTitle><CardDescription>Used to operate your account and send security notices.</CardDescription></div></CardHeader>
        <CardContent><ProfileForm profile={profile} /></CardContent>
      </Card>
    </>
  );
}
