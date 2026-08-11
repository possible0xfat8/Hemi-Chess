import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ClientOnly } from "@/components/ClientOnly";

const Web3Provider = lazy(() =>
  import("@/lib/web3/Web3Provider").then((m) => ({ default: m.Web3Provider })),
);
const HomePage = lazy(() =>
  import("@/components/HomePage").then((m) => ({ default: m.HomePage })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HemiChess — Play Online Chess on Hemi Network" },
      {
        name: "description",
        content:
          "Real-time PvP chess with ELO ratings, wallet login and on-chain rewards on the Hemi Network.",
      },
      { property: "og:title", content: "HemiChess — Play Online Chess on Hemi Network" },
      {
        property: "og:description",
        content: "Real-time PvP chess with ELO ratings and Web3 wallet login on Hemi Network.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  return (
    <ClientOnly fallback={<div className="min-h-screen bg-canvas" />}>
      <Web3Provider>
        <HomePage />
      </Web3Provider>
    </ClientOnly>
  );
}
