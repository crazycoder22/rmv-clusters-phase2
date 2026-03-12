export const BLOCKS = [
  { block: 1, sqft: 80403, label: "Block 1" },
  { block: 2, sqft: 85322, label: "Block 2" },
  { block: 3, sqft: 83126, label: "Block 3" },
  { block: 4, sqft: 86236, label: "Block 4" },
] as const;

export const TOTAL_SQFT = BLOCKS.reduce((sum, b) => sum + b.sqft, 0);

export const BLOCK_PERCENTAGES = BLOCKS.map((b) => ({
  block: b.block,
  label: b.label,
  sqft: b.sqft,
  percentage: (b.sqft / TOTAL_SQFT) * 100,
}));

export type DistributionType = "percentage" | "block_specific" | "custom" | "income";

export const DISTRIBUTION_LABELS: Record<DistributionType, string> = {
  percentage: "Split by %",
  block_specific: "Block Specific",
  custom: "Custom Split",
  income: "Income / Deduction",
};

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
    case "percentage":
      return {
        block1Amount: Math.round((totalAmount * BLOCKS[0].sqft) / TOTAL_SQFT),
        block2Amount: Math.round((totalAmount * BLOCKS[1].sqft) / TOTAL_SQFT),
        block3Amount: Math.round((totalAmount * BLOCKS[2].sqft) / TOTAL_SQFT),
        block4Amount: Math.round((totalAmount * BLOCKS[3].sqft) / TOTAL_SQFT),
      };
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
      return {
        block1Amount: Math.round((totalAmount * BLOCKS[0].sqft) / TOTAL_SQFT),
        block2Amount: Math.round((totalAmount * BLOCKS[1].sqft) / TOTAL_SQFT),
        block3Amount: Math.round((totalAmount * BLOCKS[2].sqft) / TOTAL_SQFT),
        block4Amount: Math.round((totalAmount * BLOCKS[3].sqft) / TOTAL_SQFT),
      };
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
