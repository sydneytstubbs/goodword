import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { t } from "@/lib/messages";

// Matches the title layout's shapes (DS 4.1.17).
export default function TitleLoading() {
  return (
    <main className="mx-auto w-full max-w-detail px-4 pt-2 pb-12">
      <SkeletonRegion label={t("titleDetail.loading")} className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        <Skeleton className="aspect-2/3 w-full max-w-80 rounded-poster lg:w-72" />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-12 w-3/4 rounded-control" />
          <Skeleton className="h-4 w-1/3 rounded-control" />
          <Skeleton className="h-4 w-1/2 rounded-control" />
        </div>
      </SkeletonRegion>
    </main>
  );
}
