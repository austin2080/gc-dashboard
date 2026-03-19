import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function handleLogout(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const redirectUrl = new URL("/login", request.url);
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: Request) {
  return handleLogout(request);
}

export async function POST(request: Request) {
  return handleLogout(request);
}
