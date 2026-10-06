import { Skeleton } from "@/components/ui/skeleton";
import { ListSkeleton } from "../../list/list-cards";

// Matches the person view: their name, the groups you share, then cards (PRD F8).
export default function PersonLoading() {
  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 py-8">
      <Skeleton className="h-14 w-2/3 rounded-control" />
      <ListSkeleton />
    </main>
  );
}
