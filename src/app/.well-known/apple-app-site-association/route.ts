// Apple App Site Association (AASA) file — required for Universal Links.
//
// iOS fetches this file from https://rmvclustersphase2.in/.well-known/apple-app-site-association
// to verify that the domain is associated with our app. When a user taps or
// scans any link on this domain, iOS will open the app directly if it is
// installed, falling back to Safari (and the web page) if it isn't.
//
// Must be served at exactly this path, with Content-Type application/json,
// over HTTPS, without redirects.

export function GET() {
  const aasa = {
    applinks: {
      details: [
        {
          // Format: "<TeamID>.<BundleID>"
          appIDs: ["W59Y6WK5HG.in.rmvclustersphase2.app"],
          components: [
            // All paths handled by the app — expand as we add more features.
            // '*' wildcard covers everything under that prefix.
            { "/": "/parking/*", comment: "Parking slot pages" },
            { "/": "/parking", comment: "Parking hub" },
            { "/": "/food/*", comment: "Food menu pages" },
            { "/": "/food", comment: "Food hub" },
            { "/": "/initiatives/*", comment: "Initiative pages" },
            { "/": "/initiatives", comment: "Initiatives hub" },
            { "/": "/referendums/*", comment: "Referendum pages" },
            { "/": "/referendums", comment: "Referendums hub" },
            { "/": "/habits/*", comment: "Habit pages" },
            { "/": "/habits", comment: "Habits hub" },
            { "/": "/community/*", comment: "Community post pages" },
            { "/": "/news/*", comment: "News / announcement pages" },
            { "/": "/duties", comment: "Staff duties" },
          ],
        },
      ],
    },
  };

  return new Response(JSON.stringify(aasa), {
    headers: {
      "Content-Type": "application/json",
      // Cache for 1 hour — Apple also caches it on their CDN.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
