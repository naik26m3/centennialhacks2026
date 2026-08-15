export function GET() {
  return Response.json({ data: { service: "greenlight-api", status: "ok" }, error: null });
}
