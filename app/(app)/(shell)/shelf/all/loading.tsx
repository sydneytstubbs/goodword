import { Skeleton } from "@/components/ui/skeleton";
import { ShelfSkeleton } from "../shelf-cards";

// Matches the shelf's layout: the bar, the page title, then 6 cards (PRD F5.7).
export default function ShelfLoading() {
  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 pb-12">
      <Skeleton className="h-11 w-40 rounded-control" />
      <Skeleton className="h-14 w-2/3 rounded-control" />
      <ShelfSkeleton />
    </main>
  );
}
