// Headline metrics for the you-vs-pro comparison. `higherIsBetter` drives the
// gap chip color; thresholds are direction-aware so a 2% L-cancel gap and a
// 2s shield gap don't read the same.
export interface MetricDef {
  key: string
  label: string
  unit: string
  higherIsBetter: boolean
  decimals: number
}

export const HEADLINE_METRICS: MetricDef[] = [
  { key: 'lcancel_pct', label: 'L-cancel', unit: '%', higherIsBetter: true, decimals: 0 },
  { key: 'neutral_win_pct', label: 'Neutral wins', unit: '%', higherIsBetter: true, decimals: 0 },
  { key: 'punish_pct', label: 'Damage / opening', unit: '%', higherIsBetter: true, decimals: 1 },
  { key: 'kill_rate_pct', label: 'Kill rate', unit: '%', higherIsBetter: true, decimals: 0 },
  { key: 'avg_kill_pct', label: 'Avg kill percent', unit: '%', higherIsBetter: false, decimals: 0 },
  { key: 'edgeguard_below_pct', label: 'Edgeguards (below)', unit: '%', higherIsBetter: true, decimals: 0 },
  { key: 'free_recovery_given_pct', label: 'Free recoveries given', unit: '%', higherIsBetter: false, decimals: 0 },
  { key: 'whiff_pct', label: 'Whiff rate', unit: '%', higherIsBetter: false, decimals: 0 },
  { key: 'whiff_punished_pct', label: 'Whiffs punished', unit: '%', higherIsBetter: false, decimals: 0 },
  { key: 'oos_punish_pct', label: 'OOS punishes', unit: '%', higherIsBetter: true, decimals: 0 },
  { key: 'shield_s', label: 'Shield time / game', unit: 's', higherIsBetter: false, decimals: 1 },
  { key: 'center_pct', label: 'Center stage', unit: '%', higherIsBetter: true, decimals: 0 },
  { key: 'galint_avg', label: 'GALINT avg', unit: 'f', higherIsBetter: true, decimals: 1 },
  { key: 'wavedash_pct', label: 'Wavedash', unit: '%', higherIsBetter: true, decimals: 0 },
  { key: 'f1_pct', label: 'Frame-1 aerials', unit: '%', higherIsBetter: true, decimals: 0 },
  { key: 'sd_per_game', label: 'SDs / game', unit: '', higherIsBetter: false, decimals: 2 },
  { key: 'reversals_per_game', label: 'Reversals / game', unit: '', higherIsBetter: false, decimals: 2 }
]
