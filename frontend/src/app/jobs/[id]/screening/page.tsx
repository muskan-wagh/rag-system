import { redirect } from "next/navigation"

/** Screening now lives in the workspace's Shortlisting tab. */
export default async function JobScreeningRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/assessments?job=${encodeURIComponent(id)}&stage=shortlisting`)
}
