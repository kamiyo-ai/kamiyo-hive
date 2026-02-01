"use client";

import dynamic from "next/dynamic";

const TrustGraphScene = dynamic(
  () => import("@/components/trust-graph/TrustGraphScene").then((m) => m.TrustGraphScene),
  { ssr: false }
);

export default function DreamsPage() {
  return (
    <>
      <style>{`#layout-footer-section { display: none !important; }`}</style>
      <div className="relative w-full h-screen">
        <TrustGraphScene />
      </div>
    </>
  );
}
