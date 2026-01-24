"use client";

import dynamic from "next/dynamic";

const AgentScene = dynamic(
  () => import("@/components/live/AgentScene").then((m) => m.AgentScene),
  { ssr: false }
);

export default function DreamsPage() {
  return <AgentScene />;
}
