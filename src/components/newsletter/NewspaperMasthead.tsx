interface NewspaperMastheadProps {
  edition?: string | null;
  publishedAt?: string | null;
}

export default function NewspaperMasthead({ edition, publishedAt }: NewspaperMastheadProps) {
  const dateStr = publishedAt
    ? new Date(publishedAt).toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });

  return (
    <div className="newspaper-masthead">
      <h1 className="newspaper-masthead-title text-2xl sm:text-3xl">
        OneRMV Newsletter
      </h1>
      <p className="newspaper-masthead-sub">
        Your Community &middot; Your Stories &middot; Your Voice
      </p>
      <div className="newspaper-masthead-meta">
        <span>{dateStr}</span>
        {edition && <span>{edition}</span>}
        <span>RMV Clusters</span>
      </div>
    </div>
  );
}
