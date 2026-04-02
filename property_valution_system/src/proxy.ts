import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const intlProxy = createMiddleware({
  locales: ["en", "kh"],
  defaultLocale: "en",
  localePrefix: "always",
});

export function proxy(request: NextRequest) {
  const intlResponse = intlProxy(request);

  const refreshToken = request.cookies.get("refreshToken")?.value;
  const accessToken = request.cookies.get("accessToken")?.value;
  const token = refreshToken || accessToken;
  const { pathname } = request.nextUrl;

  const pathSegments = pathname.split("/").filter(Boolean);
  const locale =
    pathSegments[0] === "en" || pathSegments[0] === "kh"
      ? pathSegments[0]
      : "en";

  const pathWithoutLocale =
    pathSegments[0] === "en" || pathSegments[0] === "kh"
      ? "/" + pathSegments.slice(1).join("/")
      : pathname;

  const protectedRoutes = ["/dashboard"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathWithoutLocale.startsWith(route)
  );

  if (isProtectedRoute && !token) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (
    (pathWithoutLocale === "/login" || pathWithoutLocale === "/register") &&
    token
  ) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
