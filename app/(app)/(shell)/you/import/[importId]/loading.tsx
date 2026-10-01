import { Skeleton } from "@/components/ui/skeleton";

// Matches the review deck: progress, then a poster beside its title (PRD F15.5).
export default function ReviewDeckLoading() {
  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-6 px-4 pt-16">
      <div className="flex items-start gap-4">
        <Skeleton className="aspect-2/3 w-28 rounded-poster md:w-36" />
        <div className="flex flex-1 flex-col gap-2 pt-1">
          <Skeleton className="h-7 w-3/4 rounded-control" />
          <Skeleton className="h-4 w-1/3 rounded-control" />
        </div>
      </div>
    </main>
  );
}
