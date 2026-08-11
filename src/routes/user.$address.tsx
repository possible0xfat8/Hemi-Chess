import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ClientOnly } from "@/components/ClientOnly";

const Web3Provider = lazy(() =>
  import("@/lib/web3/Web3Provider").then((m) => ({ default: m.Web3Provider })),
);
const UserProfileClient = lazy(() =>
  import("@/components/game/UserProfileClient").then((m) => ({ default: m.UserProfileClient })),
);

export const Route = createFileRoute("/user/$address")({
  head: () => ({
    meta: [
      { title: "Player Profile — HemiChess" },
      {
        name: "description",
        content:
          "View player stats, ELO rating, and match history on HemiChess.",
      },
      { property: "og:title", content: "Player Profile — HemiChess" },
      {
        property: "og:description",
        content: "View player stats and match history.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UserProfilePage,
});

function UserProfilePage() {
  const { address } = Route.useParams();
  
  return (
    <ClientOnly fallback={<div className="min-h-screen bg-[#0B0E14]" />}>
      <Web3Provider>
        <UserProfileClient walletAddress={address} />
      </Web3Provider>
    </ClientOnly>
  );
}
