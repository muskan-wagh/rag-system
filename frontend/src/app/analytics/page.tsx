"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, TrendingUp, Award, Code2 } from "lucide-react"
import { getAnalytics, type AnalyticsData } from "@/lib/api"

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [tab, setTab] = useState("skills")

  useEffect(() => {
    async function load() {
      try {
        const res = await getAnalytics()
        if (res.success && res.data) {
          setData(res.data)
        } else {
          setError(res.error || "Failed to load analytics")
        }
      } catch {
        setError("Failed to connect to server")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex-1 space-y-6 p-6 md:p-8 pt-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex-1 p-6 md:p-8 pt-6">
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-12">
            {error || "No data available"}
          </CardContent>
        </Card>
      </div>
    )
  }

  const summaryStats = [
    { title: "Total Candidates", value: String(data.totalCandidates), icon: Users, change: `${data.skills.length} unique skills` },
    { title: "Avg Experience", value: `${data.avgExperience}y`, icon: TrendingUp, change: "across all candidates" },
    { title: "Top Skill", value: data.topSkills[0]?.skill || "N/A", icon: Award, change: `${data.topSkills[0]?.count || 0} candidates` },
    { title: "Total Skills", value: String(data.skills.length), icon: Code2, change: "across database" },
  ]

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 pt-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Insights into your candidate database and hiring pipeline.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryStats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="experience">Experience</TabsTrigger>
          <TabsTrigger value="education">Education</TabsTrigger>
        </TabsList>

        <TabsContent value="skills" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Skill Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Skill</TableHead>
                    <TableHead>Candidates</TableHead>
                    <TableHead>Coverage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.skills.map((row) => (
                    <TableRow key={row.skill}>
                      <TableCell className="font-medium">{row.skill}</TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${row.percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8">{row.percentage}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="experience" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Experience Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Range</TableHead>
                    <TableHead>Candidates</TableHead>
                    <TableHead>Distribution</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.experienceDistribution.map((row) => {
                    const maxCount = Math.max(...data.experienceDistribution.map((r) => r.count))
                    const pct = maxCount > 0 ? (row.count / maxCount) * 100 : 0
                    return (
                      <TableRow key={row.range}>
                        <TableCell className="font-medium">{row.range}</TableCell>
                        <TableCell>{row.count}</TableCell>
                        <TableCell>
                          <div className="h-2 rounded-full bg-muted overflow-hidden max-w-xs">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="education" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Education Levels</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Level</TableHead>
                    <TableHead>Candidates</TableHead>
                    <TableHead>Distribution</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.educationDistribution.map((row) => {
                    const maxCount = Math.max(...data.educationDistribution.map((r) => r.count))
                    const pct = maxCount > 0 ? (row.count / maxCount) * 100 : 0
                    return (
                      <TableRow key={row.level}>
                        <TableCell className="font-medium">{row.level}</TableCell>
                        <TableCell>{row.count}</TableCell>
                        <TableCell>
                          <div className="h-2 rounded-full bg-muted overflow-hidden max-w-xs">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
