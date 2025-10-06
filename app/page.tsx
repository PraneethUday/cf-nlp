'use client';

import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Line, Pie, Bar, Doughnut, Radar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement, RadialLinearScale } from 'chart.js';
import { cf } from '@/lib/cf/client';
import { fetchProfile, fetchUpcomingContests, fetchRatingHistory, fetchSubmissionOverview, fetchProblemDifficulty } from '@/lib/analytics/aggregate';
import Welcome from './components/Welcome';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement, RadialLinearScale);
dayjs.extend(relativeTime);

export default function HomePage() {
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisStarted, setAnalysisStarted] = useState(false);

  const [profile, setProfile] = useState<any>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any>(null);
  const [subs, setSubs] = useState<any>(null);
  const [diff, setDiff] = useState<any>(null);
  const [insights, setInsights] = useState<string | null>(null);

  useEffect(() => {
    fetchUpcomingContests()
      .then(contests => contests.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds))
      .then(setUpcoming)
      .catch(console.error);
  }, []);

  async function loadAll() {
    if (!handle) {
      setError('Please enter a handle.');
      return;
    }
    setLoading(true); 
    setError(null);
    if (!analysisStarted) setAnalysisStarted(true);

    try {
      const [p, up, rh, s, d] = await Promise.all([
        fetchProfile(handle),
        fetchUpcomingContests(),
        fetchRatingHistory(handle),
        fetchSubmissionOverview(handle),
        fetchProblemDifficulty(handle),
      ]);
      setProfile(p); setUpcoming(up); setRatings(rh); setSubs(s); setDiff(d);
      fetch('/api/insights', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile: p, ratings: rh, submissions: s, difficulty: d }) })
        .then(r => r.json())
        .then(j => setInsights(j.insights))
        .catch(() => {});
    } catch (e: any) { setError(e.message || 'Failed'); }
    finally { setLoading(false); }
  }

  const getRatingColor = (rating: number) => {
    if (rating < 1200) return '#808080';
    if (rating < 1400) return '#008000';
    if (rating < 1600) return '#03a89e';
    if (rating < 1900) return '#0000ff';
    if (rating < 2100) return '#a0a';
    if (rating < 2300) return '#ff8c00';
    if (rating < 2400) return '#ff8c00';
    if (rating < 2600) return '#ff0000';
    if (rating < 3000) return '#ff0000';
    return '#ff0000';
  };

  const getRatingTitle = (rating: number) => {
    if (rating < 1200) return 'newbie';
    if (rating < 1400) return 'pupil';
    if (rating < 1600) return 'specialist';
    if (rating < 1900) return 'expert';
    if (rating < 2100) return 'candidate master';
    if (rating < 2300) return 'master';
    if (rating < 2400) return 'international master';
    if (rating < 2600) return 'grandmaster';
    if (rating < 3000) return 'international grandmaster';
    return 'legendary grandmaster';
  };

  const ratingChart = useMemo(() => {
    if (!ratings) return null;
    const labels = ratings.entries.map((e: any) => dayjs.unix(e.ratingUpdateTimeSeconds).format('MMM DD'));
    const data = ratings.entries.map((e: any) => e.newRating);
    return { 
      labels, 
      datasets: [{ 
        label: 'Rating',
        data,
        borderColor: 'var(--primary-color)',
        backgroundColor: 'rgba(0, 112, 243, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'var(--primary-color)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }] 
    };
  }, [ratings]);

  const verdictPie = useMemo(() => {
    if (!subs) return null;
    const entries = Object.entries(subs.verdictCounts);
    const verdicts = entries.map(([k]) => k);
    
    const semanticColors: { [key: string]: string } = {
      'OK': 'var(--success-color)',
      'WRONG_ANSWER': 'var(--danger-color)',
      'TIME_LIMIT_EXCEEDED': 'var(--warning-color)',
      'COMPILATION_ERROR': '#6b7280',
      'RUNTIME_ERROR': '#f97316',
    };

    const colorList: string[] = [];
    let hue = 0;
    const hueStep = 360 / (verdicts.length - Object.keys(semanticColors).filter(k => verdicts.includes(k)).length + 1);

    verdicts.forEach(verdict => {
      if (semanticColors[verdict]) {
        colorList.push(semanticColors[verdict]);
      } else {
        hue = (hue + hueStep) % 360;
        colorList.push(`hsl(${hue}, 70%, 50%)`);
      }
    });

    return { 
      labels: verdicts, 
      datasets: [{ 
        data: entries.map(([, v]) => v),
        backgroundColor: colorList,
        borderWidth: 2,
        borderColor: 'var(--bg-primary)',
        hoverOffset: 10
      }] 
    };
  }, [subs]);

  const diffBar = useMemo(() => {
    if (!diff) return null;
    const labels = ['<1100', '1100–1399', '1400–1699', '1700–1999', '≥2000'];
    const data = [diff.buckets.lt1100, diff.buckets['1100_1399'], diff.buckets['1400_1699'], diff.buckets['1700_1999'], diff.buckets.ge2000];
    const colors = [
      getRatingColor(1000),
      getRatingColor(1200),
      getRatingColor(1400),
      getRatingColor(1700),
      getRatingColor(2100),
    ];
    return { 
      labels, 
      datasets: [{ 
        label: 'Problems Solved',
        data,
        backgroundColor: colors,
        borderRadius: 6,
        borderSkipped: false
      }] 
    };
  }, [diff]);

  if (!analysisStarted) {
    return (
      <Welcome 
        handle={handle}
        setHandle={setHandle}
        loadAll={loadAll}
        loading={loading}
        error={error}
        upcoming={upcoming}
      />
    );
  }

  return (
    <main>
      <header>
        <h1>🏆 Codeforces Analytics Summary</h1>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <a href="/analytics" className="header-link">
            📊 Analytics Dashboard
          </a>
          <div className="input-group">
            <input 
              value={handle} 
              onChange={(e) => setHandle(e.target.value)} 
              placeholder="Enter Codeforces handle"
              style={{ minWidth: '200px' }}
            />
            <button onClick={loadAll} disabled={loading}>
              {loading ? <span className="loading-spinner"></span> : '🚀 Analyze'}
            </button>
          </div>
        </div>
      </header>

      {error && <div className="card error-card">❌ Error: {error}</div>}

      <section className="card fade-in">
        <h2>👤 Profile Overview</h2>
        {!profile ? <div className="muted">🔍 No profile data available</div> : (
          <div className="profile-grid">
            <div className="profile-stat">
              <b>Handle</b>
              <div>@{profile.handle}</div>
            </div>
            <div className="profile-stat">
              <b>Title</b>
              <div style={{ color: profile.currentRating ? getRatingColor(profile.currentRating) : 'var(--text-secondary)' }}>
                {profile.title || getRatingTitle(profile.currentRating || 0)}
              </div>
            </div>
            <div className="profile-stat">
              <b>Current Rating</b>
              <div style={{ color: profile.currentRating ? getRatingColor(profile.currentRating) : 'var(--text-secondary)', fontSize: '1.5rem' }}>
                {profile.currentRating ?? '-'}
              </div>
            </div>
            <div className="profile-stat">
              <b>Max Rating</b>
              <div style={{ color: profile.maxRating ? getRatingColor(profile.maxRating) : 'var(--text-secondary)' }}>
                {profile.maxRating ?? '-'}
              </div>
            </div>
            <div className="profile-stat">
              <b>Join Date</b>
              <div>📅 {dayjs.unix(profile.registrationTime).format('MMM DD, YYYY')}</div>
            </div>
            <div className="profile-stat">
              <b>Contribution</b>
              <div style={{ color: profile.contribution > 0 ? 'var(--success-color)' : profile.contribution < 0 ? 'var(--danger-color)' : 'var(--text-secondary)' }}>
                {profile.contribution > 0 ? '+' : ''}{profile.contribution}
              </div>
            </div>
            <div className="profile-stat">
              <b>Analytics Score</b>
              <div style={{ color: 'var(--primary-color)' }}>⭐ {profile.customScore}</div>
            </div>
          </div>
        )}
      </section>

      <section className="card fade-in">
        <h2>🏁 Upcoming Contests</h2>
        {!upcoming?.length ? <div className="muted">📅 No upcoming contests scheduled</div> : (
          <div className="grid grid-3">
            {upcoming.map((c) => (
              <div key={`${c.name}-${c.startTimeSeconds}`} className="contest-card">
                <div className="contest-name">
                  🎯 {c.name} {c.division ? `(${c.division})` : ''}
                </div>
                <div className="contest-info">
                  🕒 {dayjs.unix(c.startTimeSeconds).format('MMM DD, YYYY • HH:mm')}
                </div>
                <div className="contest-info">
                  ⏱️ Duration: {Math.round(c.durationSeconds/3600)}h
                </div>
                <div className="contest-countdown">
                  ⚡ Starts {dayjs.unix(c.startTimeSeconds).fromNow()}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>📈 Rating Journey</h2>
        {ratings && (
          <div className="grid grid-2">
            <div className="grid grid-3">
              <div className="stat-card">
                <div className="stat-value">{ratings.summary.total}</div>
                <div className="stat-label">🏆 Total Contests</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--success-color)' }}>#{ratings.summary.bestRank ?? '-'}</div>
                <div className="stat-label">🥇 Best Rank</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: ratings.summary.avgDelta > 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                  {ratings.summary.avgDelta > 0 ? '+' : ''}{ratings.summary.avgDelta ?? '-'}
                </div>
                <div className="stat-label">📊 Avg Change</div>
              </div>
            </div>
            {ratingChart && (
              <div className="chart-container">
                <Line 
                  data={ratingChart} 
                  options={{ 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { 
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'var(--primary-color)',
                        borderWidth: 1
                      }
                    },
                    scales: {
                      y: {
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: 'var(--text-secondary)' }
                      },
                      x: {
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: 'var(--text-secondary)' }
                      }
                    }
                  }} 
                  height={200}
                />
              </div>
            )}
          </div>
        )}
        {ratings && (
          <div style={{ overflowX: 'auto', marginTop: '24px' }}>
            <table>
              <thead>
                <tr>
                  <th>🏆 Contest</th><th>📅 Date</th><th>🏅 Rank</th><th>📉 Before</th><th>📈 After</th><th>⚡ Change</th>
                </tr>
              </thead>
              <tbody>
                {ratings.entries.slice(0, 10).map((e: any) => (
                  <tr key={e.contestId}>
                    <td style={{ maxWidth: '300px', wordWrap: 'break-word' }}>{e.contestName}</td>
                    <td>{dayjs.unix(e.ratingUpdateTimeSeconds).format('MMM DD, YY')}</td>
                    <td>#{e.rank}</td>
                    <td style={{ color: getRatingColor(e.oldRating) }}>{e.oldRating}</td>
                    <td style={{ color: getRatingColor(e.newRating) }}>{e.newRating}</td>
                    <td style={{ 
                      color: e.newRating - e.oldRating > 0 ? 'var(--success-color)' : 'var(--danger-color)',
                      fontWeight: 'bold'
                    }}>
                      {e.newRating - e.oldRating > 0 ? '+' : ''}{e.newRating - e.oldRating}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>🎯 Problem Difficulty Breakdown</h2>
        {diff && (
          <div className="grid grid-2">
            <div className="grid grid-3">
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--success-color)' }}>{diff.totalSolved}</div>
                <div className="stat-label">✅ Total Solved</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: profile?.currentRating ? getRatingColor(profile.currentRating) : 'var(--text-secondary)' }}>
                  {profile?.currentRating ?? '-'}
                </div>
                <div className="stat-label">⭐ Current Rating</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--warning-color)' }}>{diff.highestSolvedRating ?? '-'}</div>
                <div className="stat-label">🔥 Highest Solved</div>
              </div>
            </div>
            {diffBar && (
              <div className="chart-container">
                <Bar 
                  data={diffBar} 
                  options={{ 
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff'
                      }
                    },
                    scales: {
                      y: {
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: 'var(--text-secondary)' }
                      },
                      x: {
                        grid: { display: false },
                        ticks: { color: 'var(--text-secondary)' }
                      }
                    }
                  }} 
                  height={200}
                />
              </div>
            )}
          </div>
        )}
      </section>

<section className="card">
  <h2>📊 Submission Analytics</h2>
  {subs && (
    <div className="grid grid-2">
      <div className="grid grid-3">
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--primary-color)' }}>
            {subs.total}
          </div>
          <div className="stat-label">📤 Total Submissions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success-color)' }}>
            {subs.accepted}
          </div>
          <div className="stat-label">✅ Accepted</div>
        </div>
        <div className="stat-card">
          <div
            className="stat-value"
            style={{
              color:
                subs.total && subs.accepted / subs.total > 0.5
                  ? 'var(--success-color)'
                  : 'var(--warning-color)'
            }}
          >
            {subs.total ? `${Math.round((100 * subs.accepted) / subs.total)}%` : '-'}
          </div>
          <div className="stat-label">🎯 Success Rate</div>
        </div>
      </div>

      {verdictPie && (
        <div className="chart-container">
          <Doughnut
            data={{
              ...verdictPie,
              datasets: verdictPie.datasets.map(ds => {
                const baseColors = [
                  '#4CAF50',
                  '#2196F3',
                  '#FF9800',
                  '#F44336',
                  '#9C27B0',
                  '#00BCD4',
                  '#8BC34A',
                  '#FFC107',
                  '#795548',
                  '#607D8B'
                ];

                const extraColors = Array.from(
                  { length: Math.max(0, ds.data.length - baseColors.length) },
                  () =>
                    `hsl(${Math.floor(Math.random() * 360)}, 70%, 55%)`
                );

                return {
                  ...ds,
                  backgroundColor: [...baseColors, ...extraColors].slice(
                    0,
                    ds.data.length
                  ),
                  borderColor: '#fff',
                  borderWidth: 2
                };
              })
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: {
                    padding: 20,
                    usePointStyle: true,
                    font: { size: 12, weight: 'bold' },
                    color: 'var(--text-secondary)'
                  }
                },
                tooltip: {
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  titleColor: '#fff',
                  bodyColor: '#fff'
                }
              },
              cutout: '60%'
            }}
            height={200}
          />
        </div>
      )}
    </div>
  )}
</section>

      {profile && ratings && subs && (
        <section className="card">
          <h2>⚡ Performance Dashboard</h2>
          <div className="grid grid-3">
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--primary-color)' }}>
                {Math.round((dayjs().unix() - profile.registrationTime) / (365.25 * 24 * 3600) * 10) / 10}
              </div>
              <div className="stat-label">📅 Years Active</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--success-color)' }}>
                {ratings.summary.total ? Math.round(subs.accepted / ratings.summary.total * 10) / 10 : '-'}
              </div>
              <div className="stat-label">🎯 Solves/Contest</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--warning-color)' }}>
                {profile.maxRating && profile.currentRating ? 
                  Math.round((profile.currentRating / profile.maxRating) * 100) : '-'}%
              </div>
              <div className="stat-label">📈 Rating Efficiency</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#8b5cf6' }}>
                {profile.contribution > 0 ? '🌟' : profile.contribution < 0 ? '🔻' : '➖'}
              </div>
              <div className="stat-label">👑 Community Impact</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--danger-color)' }}>
                {ratings.entries.length > 0 ? 
                  Math.round(ratings.entries.reduce((sum: number, e: any) => sum + Math.abs(e.newRating - e.oldRating), 0) / ratings.entries.length) : '-'}
              </div>
              <div className="stat-label">📊 Avg Rating Swing</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--accent-color)' }}>
                {Math.round(dayjs().diff(dayjs.unix(profile.registrationTime), 'day') / (subs.total || 1))}
              </div>
              <div className="stat-label">⏰ Days/Submission</div>
            </div>
          </div>
        </section>
      )}

      <footer>
      </footer>
    </main>
  );
}

