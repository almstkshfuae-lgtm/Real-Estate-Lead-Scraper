export type SearchCriteria = {
  propertyTypes: ('apartment' | 'villa' | 'townhouse' | 
                  'penthouse' | 'commercial')[];
  budgetMin?: number;
  budgetMax?: number;
  recentlyRelocated: boolean;
  excludeRental: boolean;
  emirates: string[];
  signals: string[];
  tierMin: 1 | 2 | 3;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
};

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 
                         'won' | 'lost';

export type LeadTier = 1 | 2 | 3;

// ============ Source Verification Types ============

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'manual_review';

export type VerificationStageResult = {
  passed: boolean;
  checks: Record<string, boolean>;
  issues: string[];
  [key: string]: any;
};

export type VerificationReport = {
  url: string;
  timestamp: string;
  overallStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW_REQUIRED' | 'ERROR';
  stages: {
    technicalAccess?: VerificationStageResult;
    domData?: VerificationStageResult;
    interactionMapping?: VerificationStageResult;
    aiExtraction?: VerificationStageResult;
  };
  summary: {
    totalTests: number;
    passedTests: number;
    blockers: string[];
    warnings: string[];
  };
  recommendation: 'APPROVED_FOR_INTEGRATION' | 'REJECTED_HARD_BLOCKS' | 'FLAGGED_FOR_MANUAL_REVIEW' | 'FAILED_PIPELINE_ERROR';
  nextSteps: string[];
};

export type SourceVerificationRequest = {
  url: string;
  proxyUrl?: string;
  secret: string;
};

export type SourceProfileData = {
  key: string;
  url: string;
  name: string;
  type: string;
  signals: string[];
  navigationSelectors: Record<string, string[]>;
  contentSelectors: Record<string, string[]>;
  crawlDepth?: number;
  maxPages?: number;
  delayBetweenPages?: number;
};
