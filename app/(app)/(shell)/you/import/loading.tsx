import { Skeleton } from "@/components/ui/skeleton";

// Matches Add recs: the title and intro, then the text box (PRD F15.5).
export default function AddRecsLoading() {
  return (
    <main className="mx-auto flex w-full max-w-reading flex-col gap-6 px-4 py-8">
      <Skeleton className="h-14 w-1/2 rounded-control" />
      <Skeleton className="h-5 w-full rounded-control" />
      <Skeleton className="h-48 w-full rounded-control" />
      <Skeleton className="h-12 w-40 rounded-control" />
    </main>
  );
}
