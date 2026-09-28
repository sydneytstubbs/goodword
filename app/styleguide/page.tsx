import { Wordmark } from "@/components/domain/wordmark";
import { Controls } from "./controls";
import { Domain } from "./domain";
import { Foundations } from "./foundations";
import { Primitives } from "./primitives";

const CONTENTS = [
  ["color", "Color"],
  ["type", "Type"],
  ["space", "Space, shape, elevation"],
  ["motion", "Motion"],
  ["icons", "Icons"],
  ["primitives", "Primitives"],
  ["domain", "Domain components"],
];

export default function StyleguidePage() {
  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-toast focus:rounded-control focus:bg-surface-raised focus:px-4 focus:py-2 focus:shadow-md"
      >
        Skip to content
      </a>
      <header className="mx-auto flex max-w-content flex-col gap-6 px-5 pt-10 pb-8 md:px-8 lg:px-10 xl:px-0">
        <Wordmark />
        <div className="flex flex-col gap-3">
          <h1 className="text-title-l text-default">Styleguide</h1>
          <p className="max-w-reading text-body text-muted">
            The living reference for DESIGN-SYSTEM.md v3.1: foundations and every Section 4 component in every state.
            Patterns (Section 5) are added here step by step as each one is built.
          </p>
        </div>
        <Controls />
        <nav aria-label="Contents">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {CONTENTS.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="inline-flex min-h-target items-center text-label font-medium text-action-text hover:underline"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="content" tabIndex={-1} className="mx-auto flex max-w-content flex-col gap-16 px-5 pb-32 md:px-8 lg:px-10 xl:px-0">
        <Foundations />
        <Primitives />
        <Domain />
      </main>
    </>
  );
}
