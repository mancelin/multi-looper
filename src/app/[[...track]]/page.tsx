import { Home } from "@/components/Home";

// The app is a single client page; /<n> selects the n-th library track
// (see src/store/urlSync.ts). The static export pre-renders / plus /1../20
// so direct loads of track URLs work on static hosting; higher numbers
// still work client-side once the app is loaded.
export function generateStaticParams() {
  return [
    { track: [] as string[] },
    ...Array.from({ length: 20 }, (_, i) => ({ track: [String(i + 1)] })),
  ];
}

export default function Page() {
  return <Home />;
}
