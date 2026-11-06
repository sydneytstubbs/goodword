import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { groupsEnabled } from "@/lib/flags";
import { t } from "@/lib/messages";

// Four skeleton cards in the home card's shape (DS 5.19, 4.1.17): who, the
// poster, the actions, the title, and the note.
export default function HomeLoading() {
  return (
    <main className="mx-auto flex w-full max-w-reading flex-col gap-6 px-4 pb-12">
      <SkeletonRegion label={t("home.loading")} className="flex flex-col">
        {groupsEnabled && <Skeleton className="my-1 h-8 w-32 rounded-control" />}
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-3 border-b border-subtle py-6">
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-pill" />
              <Skeleton className="h-4 w-1/3 rounded-control" />
            </div>
            <Skeleton className="aspect-2/3 w-full max-w-96 rounded-poster" />
            <Skeleton className="h-10 w-48 rounded-control" />
            <Skeleton className="h-5 w-1/2 rounded-control" />
            <Skeleton className="h-4 w-5/6 rounded-control" />
          </div>
        ))}
      </SkeletonRegion>
    </main>
  );
}
