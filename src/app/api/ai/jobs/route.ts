import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user)
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  const portalId = new URL(request.url).searchParams.get("portalId");
  let query = supabase
    .from("ai_workflow_jobs")
    .select(
      "id,portal_id,kind,status,request_id,error_code,updated_at,operation:payload->>operation,auto_apply:payload->autoApply,target:payload->target,progress:result->>progress,progress_detail:result->progressDetail",
    )
    .in("status", ["queued", "processing"])
    .order("updated_at", { ascending: false })
    .limit(50);
  if (portalId) query = query.eq("portal_id", portalId);
  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: "jobs_unavailable" }, { status: 503 });
  const portalIds = [...new Set((data ?? []).map((job) => job.portal_id))];
  const { data: portals } = portalIds.length
    ? await supabase.from("portals").select("id,name").in("id", portalIds)
    : { data: [] };
  const portalNames = new Map(
    (portals ?? []).map((portal) => [portal.id, portal.name]),
  );
  return NextResponse.json({
    jobs: (data ?? []).map((job) => ({
      ...job,
      portal_name: portalNames.get(job.portal_id) ?? null,
      autoApply: job.auto_apply === true,
      progressDetail: job.progress_detail,
    })),
  });
}
