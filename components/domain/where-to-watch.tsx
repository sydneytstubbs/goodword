import { t } from "@/lib/messages";
import { logoSrc } from "@/lib/tmdb/images";
import type { Provider, WatchProviders } from "@/lib/tmdb/normalize";
import { Icon } from "../icon";
import { Skeleton, SkeletonRegion } from "../ui/skeleton";
import { TextLink } from "../ui/text-link";

// Where to watch (PRD F6, DS 5.7): the viewer's region, grouped Stream / Rent
// / Buy, provider logos and names linking out through TMDB's watch link.
// JustWatch attribution sits beneath, as TMDB's terms require (PRD 9.2).
// Links open in a new tab, so the choice in progress isn't lost (DS 4.1.3).

const KINDS = ["stream", "rent", "buy"] as const;

export const JUSTWATCH_URL = "https://www.justwatch.com";

function ProviderLink({ provider, href }: { provider: Provider; href: string | null }) {
  const content = (
    <>
      {provider.logo ? (
        // A 32px logo from TMDB's image CDN; the name beside it is the label.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoSrc(provider.logo)}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          decoding="async"
          className="size-8 shrink-0 rounded-control bg-surface-sunken"
        />
      ) : (
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-control bg-surface-sunken text-caption font-semibold text-muted">
          {Array.from(provider.name)[0]}
        </span>
      )}
      <span className="min-w-0 text-body text-default">{provider.name}</span>
    </>
  );
  if (!href) return <span className="flex min-h-target items-center gap-3">{content}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-provider-id={provider.id}
      className="group -mx-2 flex min-h-target items-center gap-3 rounded-control px-2 transition duration-fast ease-standard hover:bg-surface-hover active:bg-surface-pressed"
    >
      {content}
      <Icon name="external" size={16} className="ms-auto shrink-0 text-muted" />
      <span className="sr-only">{t("common.opensInNewTab")}</span>
    </a>
  );
}

export function WhereToWatchList({
  providers,
  headingLevel = 3,
}: {
  providers: WatchProviders;
  /** One below the "Where to watch" heading. */
  headingLevel?: 3 | 4 | 5;
}) {
  const Heading = `h${headingLevel}` as const;
  const kinds = KINDS.filter((kind) => providers[kind].length > 0);
  return (
    <div className="flex flex-col gap-4">
      {kinds.length === 0 ? (
        <p className="text-body text-muted">{t("whereToWatch.none")}</p>
      ) : (
        kinds.map((kind) => (
          <div key={kind} className="flex flex-col gap-1">
            <Heading className="text-label font-semibold text-muted">{t(`whereToWatch.${kind}`)}</Heading>
            <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {providers[kind].map((provider) => (
                <li key={provider.id}>
                  <ProviderLink provider={provider} href={providers.link} />
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      <p className="text-caption text-muted">
        {t("whereToWatch.attributionBefore")}
        <TextLink href={JUSTWATCH_URL} newTab>
          {t("whereToWatch.justWatch")}
        </TextLink>
      </p>
    </div>
  );
}

/** While the region's providers load: rows in the list's exact shape (DS 4.1.17). */
export function WhereToWatchSkeleton() {
  return (
    <SkeletonRegion label={t("whereToWatch.loading")}>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-16 rounded-control" />
        {[0, 1].map((i) => (
          <div key={i} className="flex min-h-target items-center gap-3">
            <Skeleton className="size-8 rounded-control" />
            <Skeleton className="h-4 w-28 rounded-control" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
