import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedPaths = ["/dashboard", "/contractors", "/pay", "/bulk-payout", "/payouts", "/treasury", "/scheduled-payouts"];
  const isProtected = protectedPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (request.nextUrl.pathname === "/login" && user) {
    const url = request.nextUrl.clone();
    const next = request.nextUrl.searchParams.get("next");
    url.pathname = next && next.startsWith("/") ? next : "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/contractors/:path*", "/pay/:path*", "/bulk-payout/:path*", "/bulk-payout", "/payouts/:path*", "/payouts", "/treasury/:path*", "/treasury", "/scheduled-payouts/:path*", "/scheduled-payouts", "/login"],
};
