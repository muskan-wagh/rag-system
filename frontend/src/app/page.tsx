import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, GitCompare, MessageSquare, BarChart3, ArrowRight } from "lucide-react"
import { ROUTES } from "@/lib/constants"

const features = [
  {
    title: "Smart Candidate Search",
    description: "Paste a job description and let AI find the best matching candidates from your database.",
    icon: Search,
    href: ROUTES.candidates,
    badges: ["Semantic Search", "AI Ranking"],
  },
  {
    title: "Side-by-Side Comparison",
    description: "Compare multiple candidates against the same job description with detailed breakdowns.",
    icon: GitCompare,
    href: ROUTES.compare,
    badges: ["Head-to-Head", "Score Breakdown"],
  },
  {
    title: "Recruiter Chat",
    description: "Get recruitment advice, interpret results, and refine your search with AI assistance.",
    icon: MessageSquare,
    href: ROUTES.recruiterChat,
    badges: ["AI Assistant", "Context-Aware"],
  },
  {
    title: "Analytics & Insights",
    description: "Track your hiring pipeline, view search history, and identify skill gaps across candidates.",
    icon: BarChart3,
    href: ROUTES.analytics,
    badges: ["Metrics", "Trends"],
  },
]

export default function Home() {
  return (
    <div className="flex flex-col items-center">
      <section className="w-full py-20 md:py-28 lg:py-36">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <Badge variant="secondary" className="mb-2">AI-Powered Recruitment Engine</Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl max-w-3xl">
              Discover & Rank Candidates with AI
            </h1>
            <p className="max-w-[700px] text-muted-foreground md:text-xl">
              Paste a job description, get ranked candidates with explainable scores. 
              Built for the INDIA RUNS Challenge.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <Link href={ROUTES.candidates}>
                <Button size="lg">
                  Search Candidates <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href={ROUTES.dashboard}>
                <Button variant="outline" size="lg">
                  View Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full py-12 md:py-20 bg-muted/50">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Link key={feature.title} href={feature.href} className="group">
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <feature.icon className="h-8 w-8 text-primary mb-2" />
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {feature.badges.map((badge) => (
                        <Badge key={badge} variant="secondary">{badge}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
