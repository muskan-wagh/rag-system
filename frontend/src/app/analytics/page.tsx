"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Users, TrendingUp, Award, Target } from "lucide-react"

const summaryStats = [
  { title: "Total Candidates", value: "20", icon: Users, change: "+5 added" },
  { title: "Avg Match Score", value: "67%", icon: TrendingUp, change: "+4% this week" },
  { title: "Top Skill", value: "Python", icon: Award, change: "12 candidates" },
  { title: "Most Searched", value: "Full-Stack", icon: Target, change: "8 searches" },
]

const skillDistribution = [
  { skill: "Python", count: 8, pct: 40 },
  { skill: "JavaScript/TypeScript", count: 7, pct: 35 },
  { skill: "React", count: 5, pct: 25 },
  { skill: "Node.js", count: 5, pct: 25 },
  { skill: "Docker", count: 4, pct: 20 },
  { skill: "AWS", count: 4, pct: 20 },
  { skill: "SQL", count: 4, pct: 20 },
  { skill: "Kubernetes", count: 3, pct: 15 },
  { skill: "Machine Learning", count: 3, pct: 15 },
  { skill: "Java", count: 2, pct: 10 },
]

const experienceDistribution = [
  { range: "0-2 years", count: 2 },
  { range: "3-5 years", count: 5 },
  { range: "6-8 years", count: 7 },
  { range: "9-11 years", count: 4 },
  { range: "12+ years", count: 2 },
]

const educationLevels = [
  { level: "PhD", count: 2 },
  { level: "Master's", count: 9 },
  { level: "Bachelor's", count: 8 },
  { level: "Diploma", count: 1 },
]

export default function AnalyticsPage() {
  const [tab, setTab] = useState("skills")

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
                  {skillDistribution.map((row) => (
                    <TableRow key={row.skill}>
                      <TableCell className="font-medium">{row.skill}</TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${row.pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8">{row.pct}%</span>
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
                  {experienceDistribution.map((row) => {
                    const maxCount = Math.max(...experienceDistribution.map((r) => r.count))
                    const pct = (row.count / maxCount) * 100
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
                  {educationLevels.map((row) => {
                    const maxCount = Math.max(...educationLevels.map((r) => r.count))
                    const pct = (row.count / maxCount) * 100
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
