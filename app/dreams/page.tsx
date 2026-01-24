"use client";

import dynamic from "next/dynamic";
import Footer from "@/components/Footer";

const AgentScene = dynamic(
  () => import("@/components/live/AgentScene").then((m) => m.AgentScene),
  { ssr: false }
);

export default function DreamsPage() {
  return (
    <>
      <style>{`#layout-footer-section { display: none !important; }`}</style>
      <div className="relative w-full h-screen flex flex-col">
        <div className="flex-1 relative">
          <AgentScene />
        </div>
        <div className="relative z-10">
          <Footer />
        </div>
      </div>
    </>
  );
}
