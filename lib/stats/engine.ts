import type {
  MatchBoxscore,
  MetricTarget,
  PlayerMetrics,
  RawTeamBoxscore,
  TeamMetrics,
} from "./types";

const safeRate = (numerator: number, denominator: number) =>
  denominator > 0 ? (100 * numerator) / denominator : 0;

export function parseMinutes(value: string) {
  const [minutes, seconds = "0"] = value.split(":");
  return Number(minutes) + Number(seconds) / 60;
}

export function estimatePossessions(team: RawTeamBoxscore) {
  return team.fga + 0.44 * team.fta - team.orb + team.tov;
}

export function calculateTeamMetrics(match: MatchBoxscore): TeamMetrics {
  const { team, opponent } = match;
  const possessions = (estimatePossessions(team) + estimatePossessions(opponent)) / 2;
  const twoPm = team.fgm - team.threePm;
  const twoPa = team.fga - team.threePa;
  const opponentTwoPa = opponent.fga - opponent.threePa;

  return {
    possessions,
    ts: safeRate(team.points, 2 * (team.fga + 0.44 * team.fta)),
    efg: safeRate(team.fgm + 0.5 * team.threePm, team.fga),
    twoPct: safeRate(twoPm, twoPa),
    threePct: safeRate(team.threePm, team.threePa),
    ftPct: safeRate(team.ftm, team.fta),
    threePar: safeRate(team.threePa, team.fga),
    ftr: safeRate(team.fta, team.fga),
    orb: safeRate(team.orb, team.orb + opponent.drb),
    drb: safeRate(team.drb, team.drb + opponent.orb),
    fgast: safeRate(team.ast, team.fgm),
    astRatio: safeRate(team.ast, possessions),
    astTov: team.tov > 0 ? team.ast / team.tov : team.ast,
    tov: safeRate(team.tov, team.fga + 0.44 * team.fta + team.tov),
    stlRate: safeRate(team.stl, possessions),
    blkRate: safeRate(team.blk, opponentTwoPa),
    ortg: safeRate(team.points, possessions),
    drtg: safeRate(opponent.points, possessions),
    net: safeRate(team.points - opponent.points, possessions),
    oppTs: safeRate(opponent.points, 2 * (opponent.fga + 0.44 * opponent.fta)),
    oppEfg: safeRate(opponent.fgm + 0.5 * opponent.threePm, opponent.fga),
    oppFtr: safeRate(opponent.fta, opponent.fga),
    oppOrb: safeRate(opponent.orb, opponent.orb + team.drb),
    oppTov: safeRate(
      opponent.tov,
      opponent.fga + 0.44 * opponent.fta + opponent.tov,
    ),
  };
}

export function calculatePlayerMetrics(match: MatchBoxscore): PlayerMetrics[] {
  const { team, opponent } = match;
  const teamMinutes = match.players.reduce(
    (sum, player) => sum + parseMinutes(player.minutes),
    0,
  );
  const regulationMinutes = teamMinutes / 5;
  const teamUsageDenominator = team.fga + 0.44 * team.fta + team.tov;
  const teamMetrics = calculateTeamMetrics(match);
  const averageStlPer40 = team.stl / 5;
  const averageBlkPer40 = team.blk / 5;
  const averageDrbPer40 = team.drb / 5;
  const averagePfPer40 = team.pf / 5;

  return match.players.map((player) => {
    const mp = parseMinutes(player.minutes);
    const share = mp / regulationMinutes;
    const shootingPossessions = player.fga + 0.44 * player.fta;
    const usedPossessions = shootingPossessions + player.tov;
    const teammateFieldGoals = share * team.fgm - player.fgm;
    const estimatedPointsProduced = player.points + 0.5 * player.ast;
    const stl40 = mp > 0 ? (player.stl * 40) / mp : 0;
    const blk40 = mp > 0 ? (player.blk * 40) / mp : 0;
    const drb40 = mp > 0 ? (player.drb * 40) / mp : 0;
    const pf40 = mp > 0 ? (player.pf * 40) / mp : 0;

    return {
      ...player,
      minutesDecimal: mp,
      ts: shootingPossessions > 0 ? safeRate(player.points, 2 * shootingPossessions) : null,
      efg: player.fga > 0 ? safeRate(player.fgm + 0.5 * player.threePm, player.fga) : null,
      usg:
        mp > 0
          ? (100 * usedPossessions * regulationMinutes) /
            (mp * teamUsageDenominator)
          : 0,
      astPct: teammateFieldGoals > 0 ? safeRate(player.ast, teammateFieldGoals) : 0,
      tovPct: usedPossessions > 0 ? safeRate(player.tov, usedPossessions) : null,
      orbPct: safeRate(player.orb, share * (team.orb + opponent.drb)),
      drbPct: safeRate(player.drb, share * (team.drb + opponent.orb)),
      trbPct: safeRate(
        player.orb + player.drb,
        share * (team.orb + team.drb + opponent.orb + opponent.drb),
      ),
      threePar: safeRate(player.threePa, player.fga),
      ftr: safeRate(player.fta, player.fga),
      pts40: mp > 0 ? (player.points * 40) / mp : 0,
      reb40: mp > 0 ? ((player.orb + player.drb) * 40) / mp : 0,
      ast40: mp > 0 ? (player.ast * 40) / mp : 0,
      stl40,
      blk40,
      // Boxscore-only proxy: points plus partial credit for assists per used possession.
      ortgEstimate:
        usedPossessions > 0 ? safeRate(estimatedPointsProduced, usedPossessions) : null,
      // Defensive estimate anchored to team DRtg, adjusted by boxscore events per 40.
      drtgEstimate:
        teamMetrics.drtg -
        2 * (stl40 - averageStlPer40) -
        1.2 * (blk40 - averageBlkPer40) -
        0.4 * (drb40 - averageDrbPer40) +
        0.4 * (pf40 - averagePfPer40),
    };
  });
}

export type MetricStatus = "good" | "watch" | "bad" | "neutral";

export function metricStatus(value: number | null, target?: MetricTarget): MetricStatus {
  if (value === null || !target) return "neutral";
  if (target.direction === "min") {
    const threshold = target.target as number;
    if (value >= threshold) return "good";
    return value >= threshold - (target.unit === "%" ? 2 : 4) ? "watch" : "bad";
  }
  if (target.direction === "max") {
    const threshold = target.target as number;
    if (value <= threshold) return "good";
    return value <= threshold + (target.unit === "%" ? 2 : 4) ? "watch" : "bad";
  }
  const [low, high] = target.target as [number, number];
  if (value >= low && value <= high) return "good";
  const distance = value < low ? low - value : value - high;
  return distance <= 2 ? "watch" : "bad";
}

export function formatMetric(value: number | null, digits = 1) {
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}
