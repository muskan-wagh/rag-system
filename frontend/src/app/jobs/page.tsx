import { redirect } from "next/navigation"

/**
 * `/jobs` was consolidated into the Assessments workspace, which now owns job
 * creation, editing, open/close and the whole recruitment pipeline. The route is
 * kept purely as a redirect so existing bookmarks and links keep working.
 */
export default function JobsRedirect() {
  redirect("/assessments?stage=jobs")
}
