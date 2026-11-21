import { Suspense } from "react";
import { RoomWorkspace } from "@/components/room/room-workspace";

function RoomLoadingFallback() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-8 sm:px-6">
      <div className="wp-card h-44 animate-pulse bg-surface-card p-6" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="wp-card h-96 animate-pulse bg-surface-card p-6" />
        <div className="wp-card h-64 animate-pulse bg-surface-card p-6" />
      </div>
    </div>
  );
}

async function RoomSlugLoader({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <RoomWorkspace slug={slug} />;
}

export default function RoomPage({ params }: PageProps<"/r/[slug]">) {
  return (
    <Suspense fallback={<RoomLoadingFallback />}>
      <RoomSlugLoader params={params} />
    </Suspense>
  );
}
