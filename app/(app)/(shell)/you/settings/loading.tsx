import { Skeleton } from "@/components/ui/skeleton";

// Matches Settings: the title, then Account, Notifications, and Your data.
export default function SettingsLoading() {
  return (
    <main className="mx-auto flex w-full max-w-reading flex-col gap-10 px-4 py-8">
      <Skeleton className="h-10 w-1/2 rounded-control" />
      {[3, 3, 2].map((rows, section) => (
        <div key={section} className="flex flex-col gap-3">
          <Skeleton className="h-7 w-1/3 rounded-control" />
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-control" />
          ))}
        </div>
      ))}
    </main>
  );
}
