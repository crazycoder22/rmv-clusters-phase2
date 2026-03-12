export const BLOCKS = [
  { block: 1, sqft: 80403, label: "Block 1", percentage: 24.00 },
  { block: 2, sqft: 85322, label: "Block 2", percentage: 25.46 },
  { block: 3, sqft: 83126, label: "Block 3", percentage: 24.81 },
  { block: 4, sqft: 86236, label: "Block 4", percentage: 25.73 },
] as const;

export const TOTAL_SQFT = BLOCKS.reduce((sum, b) => sum + b.sqft, 0);

export const BLOCK_PERCENTAGES = BLOCKS.map((b) => ({
  block: b.block,
  label: b.label,
  sqft: b.sqft,
  percentage: b.percentage,
}));

export type DistributionType = "percentage" | "block_specific" | "custom" | "income";

export const DISTRIBUTION_LABELS: Record<DistributionType, string> = {
  percentage: "Split by %",
  block_specific: "Block Specific",
  custom: "Custom Split",
  income: "Income / Deduction",
};

/**
 * Split totalAmount across 4 blocks using the largest remainder method.
 * This ensures block amounts always sum exactly to totalAmount.
 *
 * 1. Compute raw (unrounded) share for each block
 * 2. Floor all shares
 * 3. Distribute the leftover (total − sum of floors) one rupee at a time
 *    to blocks with the largest fractional remainders
 */
function splitByPercentage(totalAmount: number): [number, number, number, number] {
  const raw = BLOCKS.map((b) => (totalAmount * b.percentage) / 100);
  const floored = raw.map((v) => Math.floor(v));
  let remainder = totalAmount - floored.reduce((s, v) => s + v, 0);

  // Indices sorted by largest fractional part descending
  const indices = [0, 1, 2, 3].sort((a, b) => (raw[b] - floored[b]) - (raw[a] - floored[a]));

  for (const idx of indices) {
    if (remainder <= 0) break;
    floored[idx] += 1;
    remainder -= 1;
  }

  return [floored[0], floored[1], floored[2], floored[3]];
}

export function calculateBlockAmounts(
  totalAmount: number,
  distributionType: DistributionType,
  targetBlock?: number | null,
  customAmounts?: { block1: number; block2: number; block3: number; block4: number }
): {
  block1Amount: number;
  block2Amount: number;
  block3Amount: number;
  block4Amount: number;
} {
  switch (distributionType) {
    case "percentage": {
      const [b1, b2, b3, b4] = splitByPercentage(totalAmount);
      return { block1Amount: b1, block2Amount: b2, block3Amount: b3, block4Amount: b4 };
    }
    case "income":
      // Income supports custom per-block amounts (e.g., some blocks get 0)
      if (customAmounts && (customAmounts.block1 || customAmounts.block2 || customAmounts.block3 || customAmounts.block4)) {
        return {
          block1Amount: -(Math.abs(customAmounts.block1)),
          block2Amount: -(Math.abs(customAmounts.block2)),
          block3Amount: -(Math.abs(customAmounts.block3)),
          block4Amount: -(Math.abs(customAmounts.block4)),
        };
      }
      {
        const [b1, b2, b3, b4] = splitByPercentage(totalAmount);
        return { block1Amount: b1, block2Amount: b2, block3Amount: b3, block4Amount: b4 };
      }
    case "block_specific":
      return {
        block1Amount: targetBlock === 1 ? totalAmount : 0,
        block2Amount: targetBlock === 2 ? totalAmount : 0,
        block3Amount: targetBlock === 3 ? totalAmount : 0,
        block4Amount: targetBlock === 4 ? totalAmount : 0,
      };
    case "custom":
      return {
        block1Amount: customAmounts?.block1 ?? 0,
        block2Amount: customAmounts?.block2 ?? 0,
        block3Amount: customAmounts?.block3 ?? 0,
        block4Amount: customAmounts?.block4 ?? 0,
      };
    default:
      return { block1Amount: 0, block2Amount: 0, block3Amount: 0, block4Amount: 0 };
  }
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
