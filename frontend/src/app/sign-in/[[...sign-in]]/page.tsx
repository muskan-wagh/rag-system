import Link from "next/link"
import { SignIn } from "@clerk/nextjs"
import { AuthShell } from "@/components/auth-shell"
import { authAppearance } from "@/lib/clerk-appearance"

export default function SignInPage() {
  return (
    <AuthShell
      title="Sign in to HireStack"
      subtitle="Welcome back. Sign in to continue hiring."
      footerSwitch={
        <p className="text-sm text-muted">
          New to HireStack?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-ink hover:opacity-70 transition-opacity"
          >
            Create an account
          </Link>
        </p>
      }
    >
      <SignIn appearance={authAppearance} routing="path" path="/sign-in" />
    </AuthShell>
  )
}
