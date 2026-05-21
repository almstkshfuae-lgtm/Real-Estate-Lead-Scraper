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
  }
];
