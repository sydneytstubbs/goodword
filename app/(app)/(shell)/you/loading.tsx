import { Skeleton } from "@/components/ui/skeleton";
import { ShelfSkeleton } from "../shelf/shelf-cards";

// Matches My shelf: the page title, then 6 cards (PRD F5.7).
export default function MyShelfLoading() {
  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-10 px-4 py-8">
      <Skeleton className="h-14 w-2/3 rounded-control" />
      <ShelfSkeleton />
    </main>
  );
}
