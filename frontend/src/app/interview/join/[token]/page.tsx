"use client"

import { useParams } from "next/navigation"
import { InterviewJoinView } from "@/components/interview/interview-join-view"

export default function JoinTechnicalInterviewPage() {
  const params = useParams<{ token: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  return <InterviewJoinView token={token} expectedStage="Technical Interview" />;
}
