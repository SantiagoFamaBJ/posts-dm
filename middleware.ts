import { NextResponse, type NextRequest } from "next/server";

// /admin (cualquier variante de mayúsculas) → /ADMIN
export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if (p.toLowerCase() === "/admin" && p !== "/ADMIN") {
    const url = req.nextUrl.clone();
    url.pathname = "/ADMIN";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] };
