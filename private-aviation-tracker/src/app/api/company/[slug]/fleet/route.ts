import { jsonError, jsonOk } from "@/lib/api";
import { getCompanyRegistrations } from "@/lib/company/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/company/:slug/fleet
 * Just the registrations, used to filter the live map to one company's fleet.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const registrations = await getCompanyRegistrations(slug);
    return jsonOk({ slug, registrations });
  } catch (error) {
    return jsonError("fleet_unavailable", "Fleet lookup failed.", 502, (error as Error).message);
  }
}
