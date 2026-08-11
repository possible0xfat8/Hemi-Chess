import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ClientOnly } from "@/components/ClientOnly";

const Web3Provider = lazy(() =>
  import("@/lib/web3/Web3Provider").then((m) => ({ default: m.Web3Provider })),
);
const ProfileClient = lazy(() =>
  import("@/components/game/ProfileClient").then((m) => ({ default: m.ProfileClient })),
);

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your Profile — HemiChess Stats & Match History" },
      {
        name: "description",
        content:
          "Track your HemiChess ELO rating, win rate, HELO token balance and recent match history.",
      },
      { property: "og:title", content: "Your Profile — HemiChess Stats & Match History" },
      {
        property: "og:description",
        content: "ELO rating, win rate and recent games for your HemiChess account.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <ClientOnly fallback={<div className="min-h-screen bg-[#0B0E14]" />}>
      <Web3Provider>
        <ProfileClient />
      </Web3Provider>
    </ClientOnly>
  );
}
