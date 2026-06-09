export interface ValidationMetrics {
  totalLeads: number;
  wonLeads: number;
  lostLeads: number;
  overallWinRate: number;
  avgScoreWon: number;
  avgScoreLost: number;
  pearsonCorrelation: number;
  tierConversion: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
  scoreBandConversion: {
    band90to100: number; // Elite UHNWI
    band80to89: number;  // Premium HNWIs
    band70to79: number;  // HNWIs
    band60to69: number;  // Premium Clients
    bandBelow60: number; // Standard / Lower
  };
  classifierPerformance: {
    threshold: number;
    tp: number;
    fp: number;
    tn: number;
    fn: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
}

/**
 * Calculates the Pearson Correlation Coefficient between lead scores and outcomes.
 * Outcome is represented as 1 for 'won' and 0 for 'lost'.
 * Returns a value between -1 and 1.
 */
export function calculatePearsonCorrelation(scores: number[], outcomes: number[]): number {
  const n = scores.length;
  if (n <= 1) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const x = scores[i];
    const y = outcomes[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Computes all lead scoring and tiering validation metrics against outcomes.
 */
export function computeValidationMetrics(leads: any[]): ValidationMetrics {
  const wonLostLeads = leads.filter(l => l.status === 'won' || l.status === 'lost');
  const totalLeads = wonLostLeads.length;

  if (totalLeads === 0) {
    return {
      totalLeads: 0,
      wonLeads: 0,
      lostLeads: 0,
      overallWinRate: 0,
      avgScoreWon: 0,
      avgScoreLost: 0,
      pearsonCorrelation: 0,
      tierConversion: { tier1: 0, tier2: 0, tier3: 0 },
      scoreBandConversion: {
        band90to100: 0,
        band80to89: 0,
        band70to79: 0,
        band60to69: 0,
        bandBelow60: 0,
      },
      classifierPerformance: {
        threshold: 80,
        tp: 0,
        fp: 0,
        tn: 0,
        fn: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
      }
    };
  }

  const wonLeads = wonLostLeads.filter(l => l.status === 'won');
  const lostLeads = wonLostLeads.filter(l => l.status === 'lost');

  const wonLeadsCount = wonLeads.length;
  const lostLeadsCount = lostLeads.length;
  const overallWinRate = (wonLeadsCount / totalLeads) * 100;

  const sumScoreWon = wonLeads.reduce((sum, l) => sum + l.score, 0);
  const sumScoreLost = lostLeads.reduce((sum, l) => sum + l.score, 0);
  const avgScoreWon = wonLeadsCount > 0 ? sumScoreWon / wonLeadsCount : 0;
  const avgScoreLost = lostLeadsCount > 0 ? sumScoreLost / lostLeadsCount : 0;

  // Pearson Correlation
  const scores = wonLostLeads.map(l => l.score);
  const outcomes = wonLostLeads.map(l => (l.status === 'won' ? 1 : 0));
  const pearsonCorrelation = calculatePearsonCorrelation(scores, outcomes);

  // Conversion rates by Tier
  const tierCounts = (tier: number) => {
    const tierLeads = wonLostLeads.filter(l => l.tier === tier);
    const won = tierLeads.filter(l => l.status === 'won').length;
    const total = tierLeads.length;
    return total > 0 ? (won / total) * 100 : 0;
  };

  // Conversion rates by Score Band
  const getBandConversion = (minScore: number, maxScore: number) => {
    const bandLeads = wonLostLeads.filter(l => l.score >= minScore && l.score <= maxScore);
    const won = bandLeads.filter(l => l.status === 'won').length;
    const total = bandLeads.length;
    return total > 0 ? (won / total) * 100 : 0;
  };

  // Heuristic performance at threshold 80
  const threshold = 80;
  let tp = 0; // Predicted won, actually won
  let fp = 0; // Predicted won, actually lost
  let tn = 0; // Predicted lost, actually lost
  let fn = 0; // Predicted lost, actually won

  for (const lead of wonLostLeads) {
    const predictedWon = lead.score >= threshold;
    const actuallyWon = lead.status === 'won';

    if (predictedWon && actuallyWon) tp++;
    else if (predictedWon && !actuallyWon) fp++;
    else if (!predictedWon && !actuallyWon) tn++;
    else if (!predictedWon && actuallyWon) fn++;
  }

  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
  const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
  const f1Score = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    totalLeads,
    wonLeads: wonLeadsCount,
    lostLeads: lostLeadsCount,
    overallWinRate,
    avgScoreWon,
    avgScoreLost,
    pearsonCorrelation,
    tierConversion: {
      tier1: tierCounts(1),
      tier2: tierCounts(2),
      tier3: tierCounts(3)
    },
    scoreBandConversion: {
      band90to100: getBandConversion(90, 100),
      band80to89: getBandConversion(80, 89),
      band70to79: getBandConversion(70, 79),
      band60to69: getBandConversion(60, 69),
      bandBelow60: getBandConversion(0, 59),
    },
    classifierPerformance: {
      threshold,
      tp,
      fp,
      tn,
      fn,
      precision,
      recall,
      f1Score
    }
  };
}
