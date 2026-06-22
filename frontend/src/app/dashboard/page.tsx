"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Users, Search, Star, Clock } from "lucide-react"
import Link from "next/link"
import { ROUTES } from "@/lib/constants"

const stats = [
  { title: "Total Candidates", value: "20", icon: Users, change: "+5 this week" },
  { title: "Searches Today", value: "3", icon: Search, change: "Last: 2 hours ago" },
  { title: "Avg Match Score", value: "67%", icon: Star, change: "+4% vs last week" },
  { title: "Top Role", value: "Full-Stack", icon: Clock, change: "Most searched" },
]

const recentSearches = [
  { role: "Senior Full-Stack Engineer", candidates: 8, topScore: "73%", time: "2h ago" },
  { role: "Data Scientist - NLP", candidates: 5, topScore: "81%", time: "5h ago" },
  { role: "DevOps/SRE Engineer", candidates: 6, topScore: "68%", time: "1d ago" },
]

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <Link href={ROUTES.candidates}>
          <Button>New Search</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
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

      <Card>
        <CardHeader>
          <CardTitle>Recent Searches</CardTitle>
        </CardHeader>
        <CardContent>
          {!mounted ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Candidates Found</TableHead>
                  <TableHead>Top Score</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSearches.map((row) => (
                  <TableRow key={row.role}>
                    <TableCell className="font-medium">{row.role}</TableCell>
                    <TableCell>{row.candidates}</TableCell>
                    <TableCell>
                      <Badge variant={parseInt(row.topScore) >= 70 ? "default" : "secondary"}>
                        {row.topScore}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.time}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
