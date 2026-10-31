import { createFileRoute } from "@tanstack/react-router";
import { ConverterApp } from "@/components/converter/ConverterApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "USB→NML · Rekordbox USB to Traktor Pro 4" },
      { name: "description", content: "Turn a Rekordbox USB stick into a Traktor Pro 4 NML playlist with cues and beatgrids, without copying audio." },
      { property: "og:title", content: "USB→NML · Rekordbox USB to Traktor Pro 4" },
      { property: "og:description", content: "Convert Rekordbox USB exports into Traktor NML playlists that play straight from the stick." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConverterApp,
});
