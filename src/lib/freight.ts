/**
 * Freight consolidation (Phase AK).
 *
 * The landed-cost engine used a flat $2,500/unit freight guess. In reality
 * per-unit freight drops sharply when cars are consolidated into a container:
 * a container has a fixed cost split across the cars inside it, plus a small
 * per-unit handling fee. This computes the real per-unit freight for a batch so
 * the buying brain can price a multi-unit import correctly.
 *
 * Pure + unit-tested. Defaults are editable via the import_config site setting.
 */
export interface FreightConfig {
  /** Cost of one container (USD), split across the cars inside it. */
  containerCostUsd: number;
  /** How many cars fit in one container. */
  carsPerContainer: number;
  /** Flat per-unit handling/inland fee on top of the container share. */
  perUnitHandlingUsd: number;
  /** Fallback per-unit freight when qty <= 0 (mirrors the old flat rate). */
  flatPerUnitUsd: number;
}

export const DEFAULT_FREIGHT: FreightConfig = {
  containerCostUsd: 6000,
  carsPerContainer: 4,
  perUnitHandlingUsd: 300,
  flatPerUnitUsd: 2500,
};

export interface FreightResult {
  /** Per-unit freight (USD) for a batch of `qty` cars. */
  perUnitUsd: number;
  /** Containers needed for the batch. */
  containers: number;
  /** Total freight for the whole batch. */
  totalUsd: number;
}

export function freightPerUnit(qty: number, cfg: FreightConfig = DEFAULT_FREIGHT): FreightResult {
  const carsPer = Math.max(1, Math.floor(cfg.carsPerContainer));
  if (!Number.isFinite(qty) || qty <= 0) {
    return { perUnitUsd: cfg.flatPerUnitUsd, containers: 0, totalUsd: 0 };
  }
  const n = Math.floor(qty);
  const containers = Math.ceil(n / carsPer);
  const total = containers * cfg.containerCostUsd + n * cfg.perUnitHandlingUsd;
  return {
    perUnitUsd: Math.round(total / n),
    containers,
    totalUsd: Math.round(total),
  };
}
