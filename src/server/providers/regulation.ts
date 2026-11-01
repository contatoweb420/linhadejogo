type ScorePair = { home?: number | null; away?: number | null } | null | undefined;

export function regulationScore(
  duration: string | null | undefined,
  regularTime: ScorePair,
  fullTime: ScorePair,
) {
  if (regularTime?.home != null && regularTime?.away != null) {
    return { home: regularTime.home, away: regularTime.away };
  }
  if ((duration === "REGULAR" || duration == null) && fullTime?.home != null && fullTime?.away != null) {
    return { home: fullTime.home, away: fullTime.away };
  }
  return { home: null, away: null };
}

export function pairOrNull(pair: ScorePair) {
  if (pair?.home == null || pair?.away == null) return { home: null, away: null };
  return { home: pair.home, away: pair.away };
}
