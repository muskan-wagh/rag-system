import { redirect } from "next/navigation"

/**
 * Job detail was consolidated into the Assessments workspace. A deep link to a
 * specific job lands in that job's pipeline rather than 404-ing.
 */
export default async function JobDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/assessments?job=${encodeURIComponent(id)}`)
}
