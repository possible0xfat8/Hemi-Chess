import { createFileRoute } from "@tanstack/react-router";
import { UserProfileClient } from "@/components/game/UserProfileClient";

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
  return <UserProfileClient walletAddress={address} />;
}
