import dayjs from 'dayjs';
import isoweek from 'dayjs/plugin/isoweek';
import { cf } from '@/lib/cf/client';

dayjs.extend(isoweek);

export type ProfileAggregate = {
  handle: string;
  title: string | null;
  currentRating: number | null;
  maxRating: number | null;
  maxRank: string | null;
  contribution: number;
  registrationTime: number;
  customScore: number;
};

export type ContestEntry = {
  name: string;
  division: string | null;
  startTimeSeconds: number;
  durationSeconds: number;
};

export type RatingEntry = {
  contestName: string;
  contestId: number;
  ratingUpdateTimeSeconds: number;
  rank: number;
  oldRating: number;
  newRating: number;
};

export type SubmissionStats = {
  total: number;
  verdictCounts: Record<string, number>;
  languages: Record<string, number>;
  accepted: number;
};

export type ProblemDifficulty = {
  totalSolved: number;
  highestSolvedRating: number | null;
  buckets: Record<'lt1100'|'1100_1399'|'1400_1699'|'1700_1999'|'ge2000', number>;
};

export type Activity = {
  weeks: Record<string, { submissions: number; accepted: number }>;
  streak: {
    current: number;
    longest: number;
    activeWeeks: number;
  };
  heatmap: Record<string, number>;
  mostProductiveWeek: {
    week: string;
    submissions: number;
  } | null;
  avgAcceptedPerWeek: number;
};

export async function fetchProfile(handle: string): Promise<ProfileAggregate> {
  const [user] = await cf('user.info', { handles: handle });
  const customScore = computeCustomScore(user);
  return {
    handle: user.handle,
    title: user.rank || null,
    currentRating: user.rating ?? null,
    maxRating: user.maxRating ?? null,
    maxRank: user.maxRank ?? null,
    contribution: user.contribution ?? 0,
    registrationTime: user.registrationTimeSeconds,
    customScore,
  };
}

function computeCustomScore(user: any): number {
  const rating = user.rating ?? 0;
  const contests = user.friendOfCount ?? 0; // proxy if missing; replace if you prefer
  return Math.round(rating * 0.9 + contests * 0.1);
}

export async function fetchUpcomingContests(): Promise<ContestEntry[]> {
  const list = await cf('contest.list', { gym: false });
  const now = dayjs().unix();
  return list
    .filter((c: any) => c.phase === 'BEFORE' && c.startTimeSeconds > now)
    .slice(0, 20)
    .map((c: any) => ({
      name: c.name,
      division: extractDivision(c.name),
      startTimeSeconds: c.startTimeSeconds,
      durationSeconds: c.durationSeconds,
    }));
}

function extractDivision(name: string): string | null {
  const m = name.match(/Div\.?\s*(\d)/i);
  return m ? `Div.${m[1]}` : null;
}

export async function fetchRatingHistory(handle: string): Promise<{ summary: { total: number; bestRank: number | null; avgDelta: number | null }, entries: RatingEntry[] }> {
  const entries: RatingEntry[] = await cf('user.rating', { handle });
  const total = entries.length;
  const bestRank = entries.reduce((acc, e: any) => acc === null ? e.rank : Math.min(acc, e.rank), null as number | null);
  const avgDelta = total ? Math.round(entries.reduce((s: number, e: any) => s + (e.newRating - e.oldRating), 0) / total) : null;
  return { summary: { total, bestRank, avgDelta }, entries } as any;
}

export async function fetchSubmissionOverview(handle: string): Promise<SubmissionStats> {
  const subs = await cf('user.status', { handle, from: 1, count: 10000 });
  const verdictCounts: Record<string, number> = {};
  const languages: Record<string, number> = {};
  let accepted = 0;
  for (const s of subs) {
    const v = s.verdict || 'UNKNOWN';
    verdictCounts[v] = (verdictCounts[v] || 0) + 1;
    const lang = s.programmingLanguage || 'Unknown';
    languages[lang] = (languages[lang] || 0) + 1;
    if (v === 'OK') accepted += 1;
  }
  return { total: subs.length, verdictCounts, languages, accepted };
}

export async function fetchProblemDifficulty(handle: string): Promise<ProblemDifficulty> {
  const subs = await cf('user.status', { handle, from: 1, count: 10000 });
  const solved: Record<string, boolean> = {};
  for (const s of subs) {
    if (s.verdict === 'OK') {
      const key = `${s.problem.contestId}-${s.problem.index}`;
      solved[key] = true;
    }
  }
  let totalSolved = 0;
  let highestSolvedRating: number | null = null;
  const buckets: ProblemDifficulty['buckets'] = { lt1100: 0, '1100_1399': 0, '1400_1699': 0, '1700_1999': 0, ge2000: 0 };
  for (const s of subs) {
    const key = `${s.problem.contestId}-${s.problem.index}`;
    if (!solved[key] || s.verdict !== 'OK') continue;
    totalSolved += 1;
    const r: number | undefined = s.problem.rating;
    if (r !== undefined) {
      highestSolvedRating = Math.max(highestSolvedRating ?? r, r);
      if (r < 1100) buckets.lt1100 += 1;
      else if (r < 1400) buckets['1100_1399'] += 1;
      else if (r < 1700) buckets['1400_1699'] += 1;
      else if (r < 2000) buckets['1700_1999'] += 1;
      else buckets.ge2000 += 1;
    }
  }
  return { totalSolved, highestSolvedRating, buckets };
}

export async function fetchActivity(handle: string): Promise<Activity> {
  const subs = await cf('user.status', { handle, from: 1, count: 10000 });
  const weekly: Record<string, { submissions: number; accepted: number }> = {};
  const heatmap: Record<string, number> = {};

  for (const s of subs) {
    const date = dayjs.unix(s.creationTimeSeconds);
    const weekId = `${date.isoWeekYear()}-${date.isoWeek()}`;
    if (!weekly[weekId]) {
      weekly[weekId] = { submissions: 0, accepted: 0 };
    }
    weekly[weekId].submissions += 1;
    if (s.verdict === 'OK') {
      weekly[weekId].accepted += 1;
    }

    const dayId = date.format('YYYY-MM-DD');
    heatmap[dayId] = (heatmap[dayId] || 0) + 1;
  }

  const sortedWeeks = Object.keys(weekly).sort();
  let currentStreak = 0;
  let longestStreak = 0;
  let lastWeek = 0;

  if (sortedWeeks.length > 0) {
    const firstWeekDate = dayjs(sortedWeeks[0], 'YYYY-W');
    const lastWeekDate = dayjs(sortedWeeks[sortedWeeks.length - 1], 'YYYY-W');
    const totalWeeksSinceFirstSubmission = lastWeekDate.diff(firstWeekDate, 'week') + 1;

    for (let i = 0; i < sortedWeeks.length; i++) {
      const week = dayjs(sortedWeeks[i], 'YYYY-W').isoWeek();
      if (i > 0 && week === lastWeek + 1) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
      lastWeek = week;
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
      }
    }

    const currentWeekId = `${dayjs().isoWeekYear()}-${dayjs().isoWeek()}`;
    const lastSubmissionWeekId = sortedWeeks[sortedWeeks.length - 1];
    if (currentWeekId !== lastSubmissionWeekId && dayjs().subtract(1, 'week').format('YYYY-W') !== lastSubmissionWeekId) {
      currentStreak = 0;
    }
  }

  let mostProductiveWeek: Activity['mostProductiveWeek'] = null;
  for (const week in weekly) {
    if (!mostProductiveWeek || weekly[week].submissions > mostProductiveWeek.submissions) {
      mostProductiveWeek = { week, submissions: weekly[week].submissions };
    }
  }

  const totalAccepted = Object.values(weekly).reduce((sum, week) => sum + week.accepted, 0);
  const totalWeeksWithSubmissions = sortedWeeks.length;
  const avgAcceptedPerWeek = totalWeeksWithSubmissions > 0 ? totalAccepted / totalWeeksWithSubmissions : 0;

  return {
    weeks: weekly,
    streak: {
      current: currentStreak,
      longest: longestStreak,
      activeWeeks: sortedWeeks.length,
    },
    heatmap,
    mostProductiveWeek,
    avgAcceptedPerWeek,
  };
}

