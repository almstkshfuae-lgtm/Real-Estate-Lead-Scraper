export const DEFAULT_SCRAPER_SOURCES = [
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
      namePatterns: ['data-name', 'class*="name"', '.member-title'],
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
      namePatterns: ['data-name', 'class*="member-name"', '.person-name'],
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
      namePatterns: ['data-name', 'class*="patron-name"'],
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
      namePatterns: ['data-name', 'class*="rider-name"'],
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
      namePatterns: ['data-name', 'class*="player-name"'],
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
      namePatterns: ['data-name', '.company-name'],
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
      namePatterns: ['.entity-name'],
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
      namePatterns: ['.decree-title'],
      companyPatterns: ['.entity-mention', '.corporate-body'],
      rolePatterns: ['.signatory', '.minister'],
      phonePatterns: [],
      emailPatterns: []
    },
    maxPages: 10,
    delayBetweenPages: 2000
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
      namePatterns: ['.report-title'],
      companyPatterns: ['.client-name', '.firm'],
      rolePatterns: ['.analyst', '.buyer-type'],
      phonePatterns: [],
      emailPatterns: []
    },
    maxPages: 10,
    delayBetweenPages: 2000
  },
  {
    key: 'ded',
    url: 'https://eservices.dubaided.gov.ae',
    name: 'DED License Portal',
    type: 'Company Registry',
    signals: ['DED License', 'Company Ingestion', 'Dubai Business'],
    crawlDepth: 3,
    navigationSelectors: {
      memberDirectory: ['a[href*="license"]', 'a[href*="search"]', 'a[href*="directory"]'],
      pagination: ['.pagination a', 'a[rel="next"]', 'button[aria-label*="next"]'],
      expandButtons: ['button[aria-expanded]', '.expand-btn'],
      memberLinks: ['a[href*="company"]', 'a[href*="details"]', '.entity-link']
    },
    contentSelectors: {
      namePatterns: ['.license-name', '.company-name'],
      companyPatterns: ['.license-type', '.category'],
      rolePatterns: ['.manager', '.director', '.position'],
      phonePatterns: ['href*="tel:"', '.phone'],
      emailPatterns: ['href*="mailto:"', '.email']
    },
    maxPages: 10,
    delayBetweenPages: 2000
  }
];
