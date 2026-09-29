import { Skeleton } from "@/components/ui/skeleton";

// Matches Settings: the title, the section heading and intro, three switches.
export default function SettingsLoading() {
  return (
    <main className="mx-auto flex w-full max-w-reading flex-col gap-10 px-4 py-8">
      <Skeleton className="h-10 w-1/2 rounded-control" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-1/3 rounded-control" />
        <Skeleton className="h-6 w-full rounded-control" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-control" />
        ))}
      </div>
    </main>
  );
}
