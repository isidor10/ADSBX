import { jsonError, jsonOk } from "@/lib/api";
import { getCompany, getCompanyAirports } from "@/lib/company/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/company/:slug
 * Company profile with its fleet, live status per aircraft and the airports
 * the fleet actually uses.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const [profile, airports] = await Promise.all([
      getCompany(slug),
      getCompanyAirports(slug),
    ]);
    if (!profile) {
      return jsonError("not_found", "No company on record under that name.", 404);
    }
    return jsonOk({ ...profile, airports });
  } catch (error) {
    return jsonError(
      "company_unavailable",
      "Company information temporarily unavailable.",
      502,
      (error as Error).message,
    );
  }
}
