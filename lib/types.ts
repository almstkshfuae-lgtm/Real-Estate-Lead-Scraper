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
