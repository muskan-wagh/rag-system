import Link from "next/link"
import { SignUp } from "@clerk/nextjs"
import { AuthShell } from "@/components/auth-shell"
import { authAppearance } from "@/lib/clerk-appearance"

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Start finding the right candidate in seconds."
      footerSwitch={
        <p className="text-sm text-muted">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-ink hover:opacity-70 transition-opacity"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <SignUp appearance={authAppearance} routing="path" path="/sign-up" />
    </AuthShell>
  )
}
