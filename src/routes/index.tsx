import { createFileRoute } from "@tanstack/react-router";
import { ConverterApp } from "@/components/converter/ConverterApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "USB DJ Bridge · Rekordbox USB Playlists to any DJ software" },
      { name: "description", content: "Turn a Rekordbox USB stick into playlists for Traktor, VirtualDJ, Serato, Engine DJ, djay, Mixxx, and M3U8, without copying audio." },
      { property: "og:title", content: "USB DJ Bridge · Rekordbox USB Playlists to any DJ software" },
      { property: "og:description", content: "Convert Rekordbox USB exports into playlists for any major DJ software that play straight from the stick." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConverterApp,
});
