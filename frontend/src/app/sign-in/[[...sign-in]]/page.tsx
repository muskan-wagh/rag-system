import { SignIn } from "@clerk/nextjs"

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background via-primary/[0.03] to-background p-4">
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-30" />
      <div className="absolute inset-0 noise-bg pointer-events-none opacity-20" />
      <div className="relative w-full max-w-md">
        <SignIn />
      </div>
    </div>
  )
}
