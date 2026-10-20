/** Curated free public sources. Used by seed + upsert-sources. */

export type CatalogSource = {
  name: string;
  url: string;
  /** rss | gdelt */
  type: "rss" | "gdelt";
  theater: string | null;
  trust: number;
};

export const CATALOG_SOURCES: CatalogSource[] = [
  // —— Ukraine / Russia ——
  {
    name: "Kyiv Independent",
    url: "https://kyivindependent.com/news-archive/rss/",
    type: "rss",
    theater: "ukraine-russia",
    trust: 1.25,
  },
  {
    name: "BBC Europe",
    url: "https://feeds.bbci.co.uk/news/world/europe/rss.xml",
    type: "rss",
    theater: "ukraine-russia",
    trust: 1.3,
  },
  {
    name: "Guardian Ukraine",
    url: "https://www.theguardian.com/world/ukraine/rss",
    type: "rss",
    theater: "ukraine-russia",
    trust: 1.2,
  },
  {
    name: "Ukrainska Pravda",
    url: "https://www.pravda.com.ua/rss/",
    type: "rss",
    theater: "ukraine-russia",
    trust: 1.1,
  },

  // —— Middle East ——
  {
    name: "Al Jazeera",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
    type: "rss",
    theater: "middle-east",
    trust: 1.1,
  },
  {
    name: "Guardian Middle East",
    url: "https://www.theguardian.com/world/middleeast/rss",
    type: "rss",
    theater: "middle-east",
    trust: 1.2,
  },
  {
    name: "BBC Middle East",
    url: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml",
    type: "rss",
    theater: "middle-east",
    trust: 1.25,
  },

  // —— Africa ——
  {
    name: "BBC Africa",
    url: "https://feeds.bbci.co.uk/news/world/africa/rss.xml",
    type: "rss",
    theater: "africa",
    trust: 1.2,
  },
  {
    name: "Guardian Africa",
    url: "https://www.theguardian.com/world/africa/rss",
    type: "rss",
    theater: "africa",
    trust: 1.15,
  },

  // —— Indo-Pacific ——
  {
    name: "BBC Asia",
    url: "https://feeds.bbci.co.uk/news/world/asia/rss.xml",
    type: "rss",
    theater: "indo-pacific",
    trust: 1.2,
  },
  {
    name: "Guardian Asia Pacific",
    url: "https://www.theguardian.com/world/asia-pacific/rss",
    type: "rss",
    theater: "indo-pacific",
    trust: 1.1,
  },

  // —— Europe hybrid ——
  {
    name: "DW World",
    url: "https://rss.dw.com/rdf/rss-en-world",
    type: "rss",
    theater: "europe-hybrid",
    trust: 1.1,
  },
  {
    name: "Euronews",
    url: "https://www.euronews.com/rss",
    type: "rss",
    theater: "europe-hybrid",
    trust: 1.0,
  },
  {
    name: "POLITICO Europe",
    url: "https://www.politico.eu/feed/",
    type: "rss",
    theater: "europe-hybrid",
    trust: 1.15,
  },

  // —— Americas ——
  {
    name: "BBC US & Canada",
    url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml",
    type: "rss",
    theater: "americas",
    trust: 1.1,
  },
  {
    name: "Guardian Americas",
    url: "https://www.theguardian.com/world/americas/rss",
    type: "rss",
    theater: "americas",
    trust: 1.1,
  },

  // —— Global / defense ——
  {
    name: "Guardian World",
    url: "https://www.theguardian.com/world/rss",
    type: "rss",
    theater: null,
    trust: 1.2,
  },
  {
    name: "France 24 EN",
    url: "https://www.france24.com/en/rss",
    type: "rss",
    theater: null,
    trust: 1.1,
  },
  {
    name: "Defense News",
    url: "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml",
    type: "rss",
    theater: null,
    trust: 1.05,
  },
  {
    name: "The War Zone",
    url: "https://www.twz.com/feed",
    type: "rss",
    theater: null,
    trust: 1.1,
  },
  {
    name: "ReliefWeb Updates",
    url: "https://reliefweb.int/updates/rss.xml",
    type: "rss",
    theater: null,
    trust: 1.15,
  },
  {
    name: "Google News — conflict",
    url: "https://news.google.com/rss/search?q=war+OR+airstrike+OR+missile+OR+drone+attack+when:1d&hl=en-US&gl=US&ceid=US:en",
    type: "rss",
    theater: null,
    trust: 0.9,
  },

  // —— Curated free defense / conflict (ingest wide; extract capped) ——
  {
    name: "Breaking Defense",
    url: "https://breakingdefense.com/feed/",
    type: "rss",
    theater: null,
    trust: 1.1,
  },
  {
    name: "Military Times",
    url: "https://www.militarytimes.com/arc/outboundfeeds/rss/?outputType=xml",
    type: "rss",
    theater: null,
    trust: 1.05,
  },
  {
    name: "Atlantic Council",
    url: "https://www.atlanticcouncil.org/feed/",
    type: "rss",
    theater: "europe-hybrid",
    trust: 1.05,
  },
  {
    name: "Crisis Group",
    url: "https://www.crisisgroup.org/rss.xml",
    type: "rss",
    theater: null,
    trust: 1.2,
  },
  {
    name: "Bellingcat",
    url: "https://www.bellingcat.com/feed/",
    type: "rss",
    theater: null,
    trust: 1.15,
  },
  {
    name: "UN News",
    url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml",
    type: "rss",
    theater: null,
    trust: 1.1,
  },
  {
    name: "Al-Monitor",
    url: "https://www.al-monitor.com/rss",
    type: "rss",
    theater: "middle-east",
    trust: 1.1,
  },
  {
    name: "Jerusalem Post",
    url: "https://www.jpost.com/rss/rssfeedsfrontpage.aspx",
    type: "rss",
    theater: "middle-east",
    trust: 1.0,
  },
  {
    name: "Meduza EN",
    url: "https://meduza.io/rss/en/all",
    type: "rss",
    theater: "ukraine-russia",
    trust: 1.05,
  },
  {
    name: "Foreign Policy",
    url: "https://foreignpolicy.com/feed/",
    type: "rss",
    theater: null,
    trust: 1.1,
  },

  // —— Free non-RSS: GDELT DOC 2.0 (conflict/security query) ——
  {
    name: "GDELT Conflict Docs",
    url: "https://api.gdeltproject.org/api/v2/doc/doc?query=(conflict OR airstrike OR missile OR drone OR sabotage OR shelling OR \"armed attack\" OR \"air strike\")&mode=ArtList&maxrecords=40&format=json&sort=DateDesc&timespan=24h",
    type: "gdelt",
    theater: null,
    trust: 0.75,
  },
];
