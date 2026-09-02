import { NextResponse } from "next/server";
import {
  accessCookieName,
  createOpaqueToken,
  hashOpaqueToken,
  PORTAL_ACCESS_MAX_AGE_SECONDS,
} from "@/domain/portal/access";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ locale: string; slug: string }> },
) {
  const { locale, slug } = await params;
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const redirectUrl = new URL(
    `/${locale}/p/${encodeURIComponent(slug)}`,
    request.url,
  );
  if (!password || password.length > 128) {
    redirectUrl.searchParams.set("error", "invalid");
    return NextResponse.redirect(redirectUrl, 303);
  }
  const token = createOpaqueToken();
  const tokenHash = await hashOpaqueToken(token);
  const expiresAt = new Date(
    Date.now() + PORTAL_ACCESS_MAX_AGE_SECONDS * 1000,
  ).toISOString();
  const supabase = await createClient();
  const { data: portalId } = await supabase.rpc("unlock_portal", {
    portal_password: password,
    portal_slug: slug,
    session_expires_at: expiresAt,
    session_token_hash: tokenHash,
  });
  if (!portalId) {
    redirectUrl.searchParams.set("error", "invalid");
    return NextResponse.redirect(redirectUrl, 303);
  }
  const response = NextResponse.redirect(redirectUrl, 303);
  response.cookies.set(accessCookieName(portalId), token, {
    httpOnly: true,
    maxAge: PORTAL_ACCESS_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
