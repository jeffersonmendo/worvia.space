import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user)
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  const { jobId } = await params;
  const { data: job, error } = await supabase
    .from("ai_workflow_jobs")
    .select(
      "id,portal_id,kind,status,request_id,result,error_code,updated_at,operation:payload->>operation,auto_apply:payload->autoApply,target:payload->target,progress:result->>progress,progress_detail:result->progressDetail",
    )
    .eq("id", jobId)
    .single();
  if (error || !job)
    return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  const { data: portal } = await supabase
    .from("portals")
    .select("name")
    .eq("id", job.portal_id)
    .maybeSingle();
  return NextResponse.json({
    job: {
      ...job,
      autoApply: job.auto_apply === true,
      portal_name: portal?.name ?? null,
      progressDetail: job.progress_detail,
    },
  });
}
