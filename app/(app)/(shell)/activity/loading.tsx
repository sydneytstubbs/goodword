import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { t } from "@/lib/messages";

// Five skeleton rows, matching the Activity list (DS 5.17, 4.1.17).
export default function ActivityLoading() {
  return (
    <main className="mx-auto w-full max-w-detail px-4 pb-12">
      <SkeletonRegion label={t("activityScreen.loading")} className="flex flex-col gap-6">
        <Skeleton className="h-12 w-1/2 rounded-control" />
        <div className="flex flex-col">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start gap-3 border-b border-subtle py-3">
              <Skeleton className="size-10 rounded-pill" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-3/4 rounded-control" />
                <Skeleton className="h-3 w-1/2 rounded-control" />
              </div>
              <Skeleton className="h-24 w-16 rounded-poster" />
            </div>
          ))}
        </div>
      </SkeletonRegion>
    </main>
  );
}
