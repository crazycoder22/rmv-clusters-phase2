"use client";

import FoodHub from "../food/FoodHub";

// Bazaar = the same hub as Food, in MARKET mode (sell-by-unit produce & goods).
export default function BazaarPage() {
  return <FoodHub kind="MARKET" />;
}
