"use client";

import dynamic from "next/dynamic";

// R3F Canvas must be loaded client-side only
const AgentScene = dynamic(
  () => import("@/components/live/AgentScene").then((m) => m.AgentScene),
  { ssr: false }
);

export default function LivePage() {
  return <AgentScene />;
}
