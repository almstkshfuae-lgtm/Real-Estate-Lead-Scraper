export const DEFAULT_SCRAPER_SOURCES = [
  {
    key: 'alforsan',
    url: 'https://www.alforsan.ae',
    name: 'Al Forsan International Sports Resort',
    type: 'Equestrian Club',
    signals: ['Equestrian Investor', 'Sports Enthusiast', 'Member'],
    crawlDepth: 3,
    navigationSelectors: {
      memberDirectory: ['a[href*="members"]', 'a[href*="directory"]', 'a[href*="participants"]'],
      pagination: ['.pagination a', 'a[rel="next"]', 'a[aria-label*="Next"]'],
      expandButtons: ['button[aria-expanded="false"]', '.expand-btn', '.toggle-content'],
      memberLinks: ['a[href*="member"]', 'a[href*="profile"]', '[class*="member-item"] a']
    },
    contentSelectors: {
      namePatterns: ['data-name', 'data-member-name', 'class*="member-name"', 'h3', 'h2'],
      companyPatterns: ['data-company', 'class*="company"', 'class*="organization"', '.company-name'],
      rolePatterns: ['data-role', 'class*="title"', 'class*="position"', '.role-text'],
      phonePatterns: ['data-phone', 'href*="tel:"', 'class*="phone"'],
      emailPatterns: ['data-email', 'href*="mailto:"', 'class*="email"']
    },
    maxPages: 10,
    delayBetweenPages: 2000
  },
  {
    key: 'adec',
    url: 'https://www.adec.ae',
    name: 'Abu Dhabi Equestrian Club',
    type: 'Equestrian Club',
    signals: ['Equestrian Investor', 'Club Member', 'Leadership'],
    crawlDepth: 3,
    navigationSelectors: {
      memberDirectory: ['a[href*="members"]', 'a[href*="committee"]', 'a[href*="board"]'],
      pagination: ['.pagination a', 'a[rel="next"]', 'button[aria-label*="next"]'],
      expandButtons: ['button[aria-expanded]', '[class*="expand"]', '.toggle'],
      memberLinks: ['a[href*="member"]', '[class*="member-card"] a', '.profile-link']
    },
    contentSelectors: {
      namePatterns: ['data-name', 'class*="name"', 'h3', '.member-title'],
      companyPatterns: ['data-company', 'class*="organization"', '.affiliation'],
      rolePatterns: ['data-role', 'class*="position"', '.title'],
      phonePatterns: ['data-phone', 'href*="tel:"'],
      emailPatterns: ['data-email', 'href*="mailto:"']
    },
    maxPages: 10,
    delayBetweenPages: 2000
  },
  {
    key: 'rotary',
    url: 'https://www.rotary.ae',
    name: 'Rotary Club Abu Dhabi',
    type: 'Service Club',
    signals: ['Business Owner', 'Community Leader', 'Networking Hub'],
    crawlDepth: 3,
    navigationSelectors: {
      memberDirectory: ['a[href*="members"]', 'a[href*="directory"]', 'a[href*="club-members"]'],
      pagination: ['.pagination', 'a[rel="next"]', '.page-nav a'],
      expandButtons: ['button', '[role="button"]'],
      memberLinks: ['a[href*="member"]', '[class*="member"] a', '.person-card a']
    },
    contentSelectors: {
      namePatterns: ['data-name', 'class*="member-name"', 'h3', '.person-name'],
      companyPatterns: ['data-company', 'class*="company"', 'class*="business"', '.occupation'],
      rolePatterns: ['data-role', 'class*="title"', 'class*="position"', '.job-title'],
      phonePatterns: ['data-phone', 'href*="tel:"'],
      emailPatterns: ['data-email', 'href*="mailto:"']
    },
    maxPages: 10,
    delayBetweenPages: 2000
  },
  {
    key: 'whatson',
    url: 'https://www.whatson.ae',
    name: 'Whats On UAE',
    type: 'News Portal',
    signals: ['Business News', 'Executive', 'Public Figure'],
    crawlDepth: 2,
    navigationSelectors: {
      articleList: ['article', '[class*="article"]', '[class*="post"]', '[class*="news-item"]'],
      pagination: ['.pagination a', 'a[rel="next"]', '[aria-label*="Next"]'],
      expandButtons: [],
      memberLinks: ['a[href*="news"]', 'a[href*="article"]', '.article-link']
    },
    contentSelectors: {
      namePatterns: ['data-author', 'class*="author"', 'class*="byline"', '.writer-name'],
      companyPatterns: ['data-source', 'class*="source"', 'class*="publication"'],
      rolePatterns: ['class*="title"', 'class*="executive"', '.position-mention'],
      phonePatterns: [],
      emailPatterns: []
    },
    maxPages: 15,
    delayBetweenPages: 1000
  },
  {
    key: 'artsclub',
    url: 'https://www.theartsclub.ae',
    name: 'The Arts Club Abu Dhabi',
    type: 'Arts Club',
    signals: ['Art Collector', 'Cultural Patron', 'Premium Member'],
    crawlDepth: 3,
    navigationSelectors: {
      memberDirectory: ['a[href*="members"]', 'a[href*="directory"]', 'a[href*="patrons"]'],
      pagination: ['.pagination a', 'a[rel="next"]'],
      expandButtons: ['button[aria-expanded]', '.expand'],
      memberLinks: ['a[href*="member"]', '[class*="patron"] a', '.profile-link']
    },
    contentSelectors: {
      namePatterns: ['data-name', 'class*="patron-name"', 'h3'],
      companyPatterns: ['data-company', 'class*="company"', '.affiliation'],
      rolePatterns: ['data-role', 'class*="title"'],
      phonePatterns: ['data-phone'],
      emailPatterns: ['data-email']
    },
    maxPages: 5,
    delayBetweenPages: 2000
  },
  {
    key: 'dhabianequi',
    url: 'https://www.dhabianequi.com',
    name: 'Dhabian Equestrian Centre',
    type: 'Equestrian Club',
    signals: ['Equestrian Investor', 'Premium Member'],
    crawlDepth: 3,
    navigationSelectors: {
      memberDirectory: ['a[href*="member"]', 'a[href*="rider"]', 'a[href*="sponsor"]'],
      pagination: ['.pagination', 'a[rel="next"]'],
      expandButtons: ['button'],
      memberLinks: ['a[href*="profile"]', '[class*="member"] a']
    },
    contentSelectors: {
      namePatterns: ['data-name', 'class*="rider-name"', 'h3'],
      companyPatterns: ['data-sponsor', 'class*="sponsor"'],
      rolePatterns: ['class*="title"'],
      phonePatterns: ['data-phone'],
      emailPatterns: ['data-email']
    },
    maxPages: 8,
    delayBetweenPages: 1500
  },
  {
    key: 'alhabtoor',
    url: 'https://www.alhabtoorpoloclub.com',
    name: 'Al Habtoor Polo Club',
    type: 'Polo Club',
    signals: ['Polo Enthusiast', 'High Net Worth', 'Club Member'],
    crawlDepth: 3,
    navigationSelectors: {
      memberDirectory: ['a[href*="members"]', 'a[href*="player"]', 'a[href*="sponsor"]'],
      pagination: ['.pagination a', 'a[rel="next"]'],
      expandButtons: ['button'],
      memberLinks: ['a[href*="member"]', '[class*="player"] a', '.profile-link']
    },
    contentSelectors: {
      namePatterns: ['data-name', 'class*="player-name"', 'h3'],
      companyPatterns: ['data-sponsor', 'class*="company"'],
      rolePatterns: ['data-role', 'class*="title"'],
      phonePatterns: ['data-phone'],
      emailPatterns: ['data-email']
    },
    maxPages: 8,
    delayBetweenPages: 2000
  },
  {
    key: 'adgm',
    url: 'https://www.adgm.com/public-registers',
    name: 'ADGM Registered Entities',
    type: 'Company Registry',
    signals: ['Family Office', 'Fund Manager', 'Wealth Management', 'UHNW'],
    crawlDepth: 3,
    navigationSelectors: {
      memberDirectory: ['a[href*="public-registers"]', 'a[href*="companies"]', 'a[href*="directory"]'],
      pagination: ['.pagination a', 'a[rel="next"]', 'button[aria-label*="next"]'],
      expandButtons: ['button[aria-expanded]', '.expand-btn'],
      memberLinks: ['a[href*="company"]', 'a[href*="entity"]', '.company-link']
    },
    contentSelectors: {
      namePatterns: ['data-name', '.company-name', 'h1', 'h2', 'h3'],
      companyPatterns: ['.entity-type', '.registration-number'],
      rolePatterns: ['.director-name', '.officer-name', '.role'],
      phonePatterns: ['href*="tel:"', '.phone'],
      emailPatterns: ['href*="mailto:"', '.email']
    },
    maxPages: 10,
    delayBetweenPages: 2000
  },
  {
    key: 'difc',
    url: 'https://www.difc.com/business/public-register',
    name: 'DIFC Public Register',
    type: 'Company Registry',
    signals: ['Investment Firm', 'Private Equity', 'CEO', 'HNWI'],
    crawlDepth: 3,
    navigationSelectors: {
      memberDirectory: ['a[href*="public-register"]', 'a[href*="directory"]'],
      pagination: ['.pagination a', 'a[rel="next"]'],
      expandButtons: ['button[aria-expanded]'],
      memberLinks: ['a[href*="view-entity"]', 'a[href*="company"]', '.entity-link']
    },
    contentSelectors: {
      namePatterns: ['.entity-name', 'h1', 'h2'],
      companyPatterns: ['.industry', '.status'],
      rolePatterns: ['.director', '.principal'],
      phonePatterns: ['href*="tel:"'],
      emailPatterns: ['href*="mailto:"']
    },
    maxPages: 10,
    delayBetweenPages: 2000
  },
  {
    key: 'gazette',
    url: 'https://www.ecouncil.ae',
    name: 'Abu Dhabi Official Gazette',
    type: 'Government Gazette',
    signals: ['Decree Recipient', 'Strategic Investor', 'UHNW'],
    crawlDepth: 3,
    navigationSelectors: {
      memberDirectory: ['a[href*="gazette"]', 'a[href*="decree"]', 'a[href*="official"]'],
      pagination: ['.pagination a', 'a[rel="next"]'],
      expandButtons: [],
      memberLinks: ['a[href*="gazette"]', 'a[href*="decree"]', '.gazette-link']
    },
    contentSelectors: {
      namePatterns: ['.decree-title', 'h1', 'h2', 'h3'],
      companyPatterns: ['.entity-mention', '.corporate-body'],
      rolePatterns: ['.signatory', '.minister'],
      phonePatterns: [],
      emailPatterns: []
    },
    maxPages: 10,
    delayBetweenPages: 2000
  },
  {
    key: 'arabianbusiness',
    url: 'https://www.arabianbusiness.com',
    name: 'Arabian Business Leaders',
    type: 'Business News',
    signals: ['Rich List', 'Executive Move', 'Wealthy Investor'],
    crawlDepth: 2,
    navigationSelectors: {
      articleList: ['article', '[class*="article"]', '[class*="post"]'],
      pagination: ['.pagination a', 'a[rel="next"]'],
      expandButtons: [],
      memberLinks: ['a[href*="leader"]', 'a[href*="article"]', '.article-link']
    },
    contentSelectors: {
      namePatterns: ['.author-name', 'h1', 'h2', '.leader-name'],
      companyPatterns: ['.company-name', '.organization'],
      rolePatterns: ['.leader-title', '.job-title'],
      phonePatterns: [],
      emailPatterns: []
    },
    maxPages: 15,
    delayBetweenPages: 1000
  },
  {
    key: 'propertymonitor',
    url: 'https://www.propertymonitor.ae',
    name: 'Property Monitor Reports',
    type: 'Property Intelligence',
    signals: ['Strategic Buyer', 'Institutional Investor', 'HNWI'],
    crawlDepth: 2,
    navigationSelectors: {
      memberDirectory: ['a[href*="report"]', 'a[href*="insight"]', 'a[href*="news"]'],
      pagination: ['.pagination a', 'a[rel="next"]'],
      expandButtons: [],
      memberLinks: ['a[href*="report"]', 'a[href*="insight"]', '.report-link']
    },
    contentSelectors: {
      namePatterns: ['.report-title', 'h1', 'h2'],
      companyPatterns: ['.client-name', '.firm'],
      rolePatterns: ['.analyst', '.buyer-type'],
      phonePatterns: [],
      emailPatterns: []
    },
    maxPages: 10,
    delayBetweenPages: 2000
  },
  {
    key: 'abudhabichamber',
    url: 'https://www.abudhabichamber.ae',
    name: 'Abu Dhabi Chamber Directory',
    type: 'Business Directory',
    signals: ['Business Licensee', 'Executive Director', 'Commercial Buyer'],
    crawlDepth: 3,
    navigationSelectors: {
      memberDirectory: ['a[href*="directory"]', 'a[href*="members"]', 'a[href*="search"]'],
      pagination: ['.pagination a', 'a[rel="next"]', 'button[aria-label*="next"]'],
      expandButtons: ['button[aria-expanded]', '.expand'],
      memberLinks: ['a[href*="member"]', 'a[href*="company"]', '.directory-link']
    },
    contentSelectors: {
      namePatterns: ['.company-name', '.owner-name', 'h1', 'h2', 'h3'],
      companyPatterns: ['.license-type', '.category'],
      rolePatterns: ['.manager', '.director', '.position'],
      phonePatterns: ['href*="tel:"', '.phone'],
      emailPatterns: ['href*="mailto:"', '.email']
    },
    maxPages: 10,
    delayBetweenPages: 2000
  },
  {
    key: 'google-maps',
    url: 'https://www.google.com/maps',
    name: 'Google Maps Search',
    type: 'Google Maps Business Directory',
    signals: ['Local Business', 'Verified Lead', 'Directory Ingestion'],
    crawlDepth: 1,
    navigationSelectors: {
      memberDirectory: [],
      pagination: [],
      expandButtons: [],
      memberLinks: ['.hfpxzc', 'a[href*="/maps/place/"]']
    },
    contentSelectors: {
      namePatterns: ['h1.DUwDvf', 'span[class*="header-title"]'],
      companyPatterns: ['button[data-item-id="authority"]', 'button[data-tooltip*="Website"]'],
      rolePatterns: [],
      phonePatterns: ['button[data-tooltip*="Phone"]', 'button[data-item-id*="phone:tel:"]'],
      emailPatterns: []
    },
    maxPages: 10,
    delayBetweenPages: 2000
  },
  {
    key: 'yellow-pages',
    url: 'https://www.yellowpages.ae',
    name: 'Yellow Pages UAE',
    type: 'Business Directory',
    signals: ['Local Business', 'Verified Lead', 'B2B Lead'],
    crawlDepth: 2,
    navigationSelectors: {
      memberDirectory: ['a[href*="/search"]'],
      pagination: ['.pagination a', 'a[class*="page-link"]', 'a:has-text("Next")'],
      expandButtons: [],
      memberLinks: ['a[href*="/profile/"]', '.listing-title a']
    },
    contentSelectors: {
      namePatterns: ['h1', '.profile-name', '.company-name'],
      companyPatterns: ['.company-info', '.category'],
      rolePatterns: [],
      phonePatterns: ['.phone-number', 'a[href*="tel:"]', '[class*="phone"]'],
      emailPatterns: ['a[href*="mailto:"]', '[class*="email"]']
    },
    maxPages: 10,
    delayBetweenPages: 2000
  }
];
