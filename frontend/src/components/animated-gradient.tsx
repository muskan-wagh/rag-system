"use client"

export function AnimatedGradient() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 -left-40 h-[600px] w-[600px] animate-blob rounded-full bg-purple-600/10 blur-[120px]" />
      <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] animate-blob rounded-full bg-blue-600/8 blur-[120px] [animation-delay:2s]" />
      <div className="absolute top-1/2 left-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 animate-blob rounded-full bg-purple-500/5 blur-[100px] [animation-delay:4s]" />
      <div className="absolute top-1/3 right-1/4 h-[300px] w-[300px] animate-blob rounded-full bg-cyan-500/5 blur-[100px] [animation-delay:6s]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.03)_0%,transparent_50%)]" />
    </div>
  )
}
