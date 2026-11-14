import type { Metadata } from "next";
import { OpenAccountForm } from "./open-account-form";

export const metadata: Metadata = { title: "Open an account" };

export default function Page() {
  return <OpenAccountForm />;
}
