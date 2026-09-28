import type { ReactNode } from "react";

// Layout helpers for /styleguide. Dev tooling, so labels are written inline.

export function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex scroll-mt-24 flex-col gap-8 border-t border-subtle pt-10">
      <div className="flex flex-col gap-2">
        <h2 id={id} className="text-display-m text-default">
          {title}
        </h2>
        {intro && <p className="max-w-reading text-body text-muted">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

export function Component({ id, title, spec, children }: { id: string; title: string; spec: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h3 id={id} className="scroll-mt-24 text-title-m text-default">
          {title}
        </h3>
        <span className="text-caption text-muted">DS {spec}</span>
      </div>
      {children}
    </div>
  );
}

/** One labeled state. */
export function Specimen({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "flex flex-col gap-2 md:col-span-2 lg:col-span-3" : "flex flex-col gap-2"}>
      <p className="text-caption text-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  );
}

export function SpecimenGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

/** A framed preview area, e.g. for bars and cards. */
export function Frame({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="flex w-full flex-col gap-2">
      {label && <p className="text-caption text-muted">{label}</p>}
      <div className="overflow-hidden rounded-card border border-dashed border-subtle">{children}</div>
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="max-w-reading text-caption text-muted">{children}</p>;
}
