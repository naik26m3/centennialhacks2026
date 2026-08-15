import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware(async (auth, request) => {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/") && pathname !== "/api/health") {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/api/:path*"],
};
