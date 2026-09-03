import { NextResponse } from "next/server";
import {
  claimAiOperationJob,
  processClaimedAiOperationJob,
} from "@/lib/portal/ai-workflow";
import { createClient } from "@/lib/supabase/server";

export async function POST(
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
      "id,portal_id,kind,status,request_id,payload,result,error_code,created_at,updated_at",
    )
    .eq("id", jobId)
    .single();
  if (error || !job)
    return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  if (job.status !== "queued") return NextResponse.json({ job });
  if (job.kind !== "portal-operation") {
    return NextResponse.json(
      { error: "job_kind_not_supported" },
      { status: 422 },
    );
  }
  try {
    const claimedJob = await claimAiOperationJob(supabase, job.id);
    if (!claimedJob) return NextResponse.json({ job });
    await processClaimedAiOperationJob(supabase, claimedJob);
  } catch {
    // The durable row contains the error state for reconciliation.
  }
  const { data: updated } = await supabase
    .from("ai_workflow_jobs")
    .select(
      "id,portal_id,kind,status,request_id,result,error_code,created_at,updated_at",
    )
    .eq("id", jobId)
    .single();
  return NextResponse.json({ job: updated });
}
