import { redirect } from "next/navigation"

/**
 * The standalone Interviews page showed only candidates who had already reached
 * an interview, which was a fraction of the pipeline. Interview management now
 * lives in the workspace's Technical round and Interview & decision tabs.
 */
export default function InterviewRedirect() {
  redirect("/assessments?stage=technical")
}
