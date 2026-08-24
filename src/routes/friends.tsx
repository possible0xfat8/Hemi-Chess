import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { FriendsList } from "@/components/FriendsList";

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
    <div className="min-h-screen bg-canvas flex flex-col">
      <Navbar />
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 flex-1 w-full">
        <FriendsList />
      </main>
      <Footer />
    </div>
  );
}
