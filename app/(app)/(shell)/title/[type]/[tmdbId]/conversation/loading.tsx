import { CommentSkeletons } from "@/components/domain/comment";
import { Skeleton } from "@/components/ui/skeleton";

// The conversation's shapes while it loads: the compact header, then four
// skeleton comments (DS 5.17, 4.1.17).
export default function ConversationLoading() {
  return (
    <main className="fixed inset-0 z-nav flex flex-col bg-surface lg:static lg:ms-auto lg:h-dvh lg:w-96 lg:border-s lg:border-subtle xl:w-120">
      <div aria-hidden="true" className="flex items-center gap-3 border-b border-subtle px-4 pt-4 pb-3">
        <Skeleton className="h-18 w-12 rounded-poster" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-1/2 rounded-control" />
          <Skeleton className="h-3 w-1/3 rounded-control" />
        </div>
      </div>
      <div className="px-4 pt-4">
        <CommentSkeletons />
      </div>
    </main>
  );
}
