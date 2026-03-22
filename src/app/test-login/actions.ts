"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function isTestLoginEnabled() {
  return process.env.ENABLE_TEST_LOGIN === "true";
}

function getSafeRedirectPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return "/bidding/all";
  }

  if (value.startsWith("//")) {
    return "/bidding/all";
  }

  return value;
}

export async function signInAsTestUser(formData: FormData) {
  if (!isTestLoginEnabled()) {
    redirect("/login");
  }

  const email = process.env.TEST_LOGIN_EMAIL;
  const password = process.env.TEST_LOGIN_PASSWORD;

  if (!email || !password) {
    redirect("/login?message=Test+login+is+not+configured");
  }

  const supabase = await createClient();
  const redirectTo = getSafeRedirectPath(formData.get("redirectTo"));
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`);
  }

  redirect(redirectTo);
}
