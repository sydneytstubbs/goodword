import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { t } from "@/lib/messages";

// Matches Friends: the title, the link card, then a few person rows.
export default function FriendsLoading() {
  return (
    <main className="mx-auto flex w-full max-w-reading flex-col gap-8 px-4 py-8">
      <Skeleton className="h-10 w-1/2 rounded-control" />
      <SkeletonRegion label={t("friends.loading")} className="flex flex-col gap-8">
        <Skeleton className="h-56 w-full rounded-card" />
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="h-5 w-1/3 rounded-control" />
            </div>
          ))}
        </div>
      </SkeletonRegion>
    </main>
  );
}
