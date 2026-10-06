import { Skeleton } from "@/components/ui/skeleton";
import { ListSkeleton } from "../list/list-cards";

// Matches My list: the page title, then 6 cards (PRD F5.7).
export default function MyListLoading() {
  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-10 px-4 py-8">
      <Skeleton className="h-14 w-2/3 rounded-control" />
      <ListSkeleton />
    </main>
  );
}
