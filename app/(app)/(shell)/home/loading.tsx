import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { t } from "@/lib/messages";

// Four skeleton cards in the home card's shape (DS 5.19, 4.1.17).
export default function HomeLoading() {
  return (
    <main className="mx-auto flex w-full max-w-reading flex-col gap-6 px-4 pb-12">
      <SkeletonRegion label={t("home.loading")} className="flex flex-col">
        <Skeleton className="my-1 h-8 w-32 rounded-control" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-4 border-b border-subtle py-6">
            <div className="flex items-center gap-2">
              <Skeleton className="size-6 rounded-pill" />
              <Skeleton className="h-4 w-1/3 rounded-control" />
            </div>
            <Skeleton className="h-6 w-5/6 rounded-control" />
            <div className="flex items-center gap-3">
              <Skeleton className="aspect-2/3 w-12 rounded-poster" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/2 rounded-control" />
                <Skeleton className="h-3 w-1/4 rounded-control" />
              </div>
            </div>
            <Skeleton className="h-4 w-1/3 rounded-control" />
          </div>
        ))}
      </SkeletonRegion>
    </main>
  );
}
