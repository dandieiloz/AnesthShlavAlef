import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder shapes shown by route `loading.tsx` files while the server
 * renders the real page. Having a loading boundary also lets Next.js prefetch
 * these dynamic routes, so navigation responds instantly.
 */
function Title() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </div>
  );
}

function CardBlock({ className = "h-28" }: { className?: string }) {
  return <Skeleton className={`w-full rounded-xl ${className}`} />;
}

export function HomeSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <CardBlock className="h-48 lg:col-span-2" />
        <CardBlock className="h-48" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <CardBlock className="h-20" />
        <CardBlock className="h-20" />
        <CardBlock className="h-20" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <CardBlock className="h-40" />
        <CardBlock className="h-40" />
      </div>
    </div>
  );
}

export function ListSkeleton({ tabs = false }: { tabs?: boolean }) {
  return (
    <div className="space-y-6" aria-busy="true">
      <Title />
      {tabs && <Skeleton className="h-10 w-full max-w-md rounded-lg" />}
      <CardBlock className="h-24" />
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <CardBlock key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true">
      <Title />
      <CardBlock className="h-32" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <CardBlock key={i} className="h-24" />
        ))}
      </div>
      <CardBlock className="h-40" />
      <CardBlock className="h-64" />
    </div>
  );
}

export function NarrowSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-5" aria-busy="true">
      <Skeleton className="h-4 w-24" />
      <Title />
      <CardBlock className="h-64" />
      <CardBlock className="h-32" />
    </div>
  );
}
