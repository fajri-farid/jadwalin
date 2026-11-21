import { Suspense } from "react";
import { RoomReceiptPreview } from "@/components/room/room-receipt-preview";

function RoomLoadingFallback() {
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-8 sm:px-6">
      <div className="wp-card h-44 animate-pulse bg-surface-card p-6" />
      <div className="wp-card h-36 animate-pulse bg-surface-card p-6" />
    </div>
  );
}

async function RoomSlugLoader({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <RoomReceiptPreview slug={slug} />;
}

export default function RoomPage({ params }: PageProps<"/r/[slug]">) {
  return (
    <Suspense fallback={<RoomLoadingFallback />}>
      <RoomSlugLoader params={params} />
    </Suspense>
  );
}
