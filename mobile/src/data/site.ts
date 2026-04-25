// Mirrors the relevant bits of `../../../src/data/site.json`. Kept as TS
// so the mobile app doesn't carry along copies of fields it doesn't render.
export const SITE_INFO = {
  name: "RMV Clusters Phase II",
  tagline: "Your Home, Your Community",
  address: {
    lines: [
      "RMV Clusters Phase II",
      "Devinagar Main Road, Lotte Golla Halli",
      "19, 1st Cross Rd, Muneshwara Layout",
      "RMV 2nd Stage, Devinagar",
      "Bengaluru, Karnataka 560094",
    ],
    // Exact-name Google Maps query so the link opens the correct pin.
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=RMV+Clusters+Phase+II+Bengaluru",
  },
  contact: {
    phone: "+91-9945038871",
    email: "rmvclustersphase2@gmail.com",
    officeHours: "Mon – Sat, 9:00 AM – 6:00 PM",
  },
  social: {
    instagram: "https://www.instagram.com/lifeatrmvclustersph2",
    youtube: "https://www.youtube.com/@RMVClustersEvents",
    website: "https://www.rmvclustersphase2.in",
  },
};
