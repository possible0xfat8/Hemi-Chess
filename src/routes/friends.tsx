import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { ClientOnly } from "@/components/ClientOnly";

const Web3Provider = lazy(() =>
  import("@/lib/web3/Web3Provider").then((m) => ({ default: m.Web3Provider })),
);
const Navbar = lazy(() =>
  import("@/components/Navbar").then((m) => ({ default: m.Navbar })),
);
const Footer = lazy(() =>
  import("@/components/Footer").then((m) => ({ default: m.Footer })),
);
const FriendsList = lazy(() =>
  import("@/components/FriendsList").then((m) => ({ default: m.FriendsList })),
);

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "Friends — HemiChess Social" },
      {
        name: "description",
        content:
          "Manage your HemiChess friends and challenge them to matches.",
      },
      { property: "og:title", content: "Friends — HemiChess Social" },
      {
        property: "og:description",
        content: "Connect with other chess players and challenge your friends.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FriendsPage,
});

function FriendsPage() {
  return (
    <ClientOnly fallback={<div className="min-h-screen bg-[#0B0E14]" />}>
      <Web3Provider>
        <div className="min-h-screen bg-canvas flex flex-col">
          <Navbar />
          <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 flex-1">
            <FriendsList />
          </main>
          <Footer />
        </div>
      </Web3Provider>
    </ClientOnly>
  );
}
