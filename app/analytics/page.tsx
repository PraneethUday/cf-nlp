'use client';

import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Line, Bar, Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement } from 'chart.js';
import ReactMarkdown from 'react-markdown';
import { fetchProfile, fetchRatingHistory, fetchSubmissionOverview, fetchProblemDifficulty, fetchUpcomingContests } from '@/lib/analytics/aggregate';
import './analytics.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement);
dayjs.extend(relativeTime);

const AnalyticsPage = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState<any>(null);
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Real CF data states
  const [profile, setProfile] = useState<any>(null);
  const [ratings, setRatings] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any>(null);
  const [difficulty, setDifficulty] = useState<any>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [dailyActivity, setDailyActivity] = useState<number[]>([]);
  const [insights, setInsights] = useState<string | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlHandle = urlParams.get('handle');
    if (urlHandle) {
      setHandle(urlHandle);
    }
    async function loadUpcoming() {
      try {
        const contests = await fetchUpcomingContests();
        setUpcoming(contests);
      } catch (err) {
        console.error('Failed to load upcoming contests', err);
      }
    }
    loadUpcoming();
  }, []);

  // Load real CF data
  async function loadRealData() {
    if (!handle.trim()) {
      setError('Please enter a Codeforces handle.');
      return;
    }
    
    setLoading(true);
    setError(null);
    setData(null);
    
    try {
      console.log('Loading CF data for:', handle);
      const [profileData, ratingsData, submissionsData, difficultyData] = await Promise.all([
        fetchProfile(handle),
        fetchRatingHistory(handle),
        fetchSubmissionOverview(handle),
        fetchProblemDifficulty(handle),
      ]);
      
      setProfile(profileData);
      setRatings(ratingsData);
      setSubmissions(submissionsData);
      setDifficulty(difficultyData);
      
      // Add this line to calculate and set daily activity
      const daily = await calculateDailyActivity(handle);
      setDailyActivity(daily);

      // Compute analytics from real data with async weekly activity
      const realAnalytics = await computeAnalyticsFromRealData(profileData, ratingsData, submissionsData, difficultyData);
      setData(realAnalytics);
      
      console.log('✅ Data loaded successfully', realAnalytics);
    } catch (err: any) {
      console.error('❌ Error loading data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  // Compute analytics from real CF API data
  async function computeAnalyticsFromRealData(profileData: any, ratingsData: any, submissionsData: any, difficultyData: any) {
    // Calculate weekly consistency from actual submission data
    const weeklyActivity = await calculateWeeklyActivity(handle);
    
    // Calculate streaks and consistency metrics
    const consistencyMetrics = calculateConsistencyMetrics(weeklyActivity);
    
    // Extract problem tags from submissions (simplified)
    const problemTags = extractProblemTags(submissionsData);
    
    return {
      consistency: {
        currentStreak: consistencyMetrics.currentStreak,
        longestStreak: consistencyMetrics.longestStreak,
        activeWeeks: consistencyMetrics.activeWeeks,
        totalWeeks: 26, // Last 6 months
        status: consistencyMetrics.status,
        drySpells: consistencyMetrics.drySpells
      },
      performance: {
        avgACsPerWeek: Math.round(submissionsData.accepted / Math.max(consistencyMetrics.activeWeeks, 1)),
        mostProductiveWeek: consistencyMetrics.maxWeeklySubmissions,
        activityRate: Math.round((consistencyMetrics.activeWeeks / 26) * 100),
        mostProductiveDate: 'Recent weeks'
      },
      weeklyData: weeklyActivity,
      problemTags: problemTags,
      badges: generateBadgesFromData(profileData, ratingsData, submissionsData, difficultyData)
    };
  }

  // Helper to calculate daily activity for heatmap
  async function calculateDailyActivity(handle: string): Promise<number[]> {
    const cf = (await import('@/lib/cf/client')).cf;
    const submissions = await cf('user.status', { handle, from: 1, count: 10000 });
    
    const dailyData = Array(365).fill(0);
    const now = dayjs();
    
    submissions.forEach((submission: any) => {
      const submissionDate = dayjs.unix(submission.creationTimeSeconds);
      const daysAgo = now.diff(submissionDate, 'day');
      
      if (daysAgo >= 0 && daysAgo < 365) {
        const dayIndex = 364 - daysAgo;
        dailyData[dayIndex]++;
      }
    });
    
    return dailyData;
  }

  // Helper functions for analytics computation
  async function calculateWeeklyActivity(handle: string): Promise<number[]> {
    // Get actual submissions from CF API
    const cf = (await import('@/lib/cf/client')).cf;
    const submissions = await cf('user.status', { handle, from: 1, count: 10000 });
    
    // Calculate weekly activity from actual submission dates
    const weeklyData = Array(26).fill(0);
    const now = dayjs();
    
    // Group submissions by week
    submissions.forEach((submission: any) => {
      const submissionDate = dayjs.unix(submission.creationTimeSeconds);
      const weeksAgo = Math.floor(now.diff(submissionDate, 'week'));
      
      // Only count submissions from last 26 weeks
      if (weeksAgo >= 0 && weeksAgo < 26) {
        const weekIndex = 25 - weeksAgo; // Most recent week at index 25
        weeklyData[weekIndex]++;
      }
    });
    
    return weeklyData;
  }

  function calculateConsistencyMetrics(weeklyActivity: number[]) {
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let activeWeeks = 0;
    let drySpells = 0;
    let maxWeeklySubmissions = 0;
    
    // Calculate from the end (most recent)
    for (let i = weeklyActivity.length - 1; i >= 0; i--) {
      const activity = weeklyActivity[i];
      maxWeeklySubmissions = Math.max(maxWeeklySubmissions, activity);
      
      if (activity > 0) {
        activeWeeks++;
        tempStreak++;
        if (i === weeklyActivity.length - 1 || weeklyActivity[i + 1] > 0) {
          currentStreak = tempStreak;
        }
      } else {
        if (tempStreak > 0) {
          drySpells++;
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 0;
        }
      }
    }
    
    longestStreak = Math.max(longestStreak, tempStreak, currentStreak);
    
    const activityRate = (activeWeeks / 26) * 100;
    let status = 'needs-work';
    if (activityRate >= 80) status = 'excellent';
    else if (activityRate >= 60) status = 'good';
    else if (activityRate >= 40) status = 'inconsistent';
    
    return {
      currentStreak,
      longestStreak,
      activeWeeks,
      drySpells,
      maxWeeklySubmissions,
      status
    };
  }

  function extractProblemTags(submissionsData: any) {
    // Simplified problem tags - in real implementation, you'd parse from submissions
    return {
      implementation: Math.floor(submissionsData.accepted * 0.3),
      greedy: Math.floor(submissionsData.accepted * 0.25),
      math: Math.floor(submissionsData.accepted * 0.2),
      constructive: Math.floor(submissionsData.accepted * 0.15),
      bruteforce: Math.floor(submissionsData.accepted * 0.12),
      dp: Math.floor(submissionsData.accepted * 0.1),
      graphs: Math.floor(submissionsData.accepted * 0.08),
      strings: Math.floor(submissionsData.accepted * 0.05)
    };
  }

  function generateBadgesFromData(profileData: any, ratingsData: any, submissionsData: any, difficultyData: any) {
    const successRate = (submissionsData.accepted / submissionsData.total) * 100;
    const contestCount = ratingsData.summary.total;
    const currentRating = profileData.currentRating || 0;
    const totalSolved = difficultyData.totalSolved;
    
    return [
      { 
        name: 'Never Give Up', 
        progress: Math.min(100, Math.round(successRate * 2)), 
        description: `${successRate.toFixed(1)}% success rate` 
      },
      { 
        name: 'Speed Demon', 
        progress: Math.min(100, Math.round((totalSolved / 100) * 100)), 
        description: `Solved ${totalSolved} problems` 
      },
      { 
        name: 'Consistent Coder', 
        progress: Math.min(100, Math.round((profileData.contribution + 50) / 2)), 
        description: `${profileData.contribution} contribution` 
      },
      { 
        name: 'Contest Warrior', 
        progress: Math.min(100, Math.round((contestCount / 50) * 100)), 
        description: `Participated in ${contestCount} contests` 
      },
      { 
        name: 'Rating Climber', 
        progress: Math.min(100, Math.round((currentRating / 2500) * 100)), 
        description: `Current rating: ${currentRating}` 
      }
    ];
  }

  const consistencyStatus = useMemo(() => {
    if (!data) return { label: 'N/A', color: '#6b7280', emoji: '❓' };
    const rate = (data.consistency.activeWeeks / data.consistency.totalWeeks) * 100;
    if (rate >= 80) return { label: 'Excellent', color: '#10b981', emoji: '🏆' };
    if (rate >= 60) return { label: 'Good', color: '#f59e0b', emoji: '👍' };
    if (rate >= 40) return { label: 'Inconsistent', color: '#ef4444', emoji: '⚠️' };
    return { label: 'Needs Work', color: '#ef4444', emoji: '❌' };
  }, [data]);

  const weeklyChart = useMemo(() => {
    if (!data) return null;
    const labels = Array.from({ length: 26 }, (_, i) => `W${i + 1}`);
    return {
      labels,
      datasets: [{
        label: 'Problems Solved',
        data: data.weeklyData,
        backgroundColor: (ctx: any) => {
          const value = ctx.parsed.y;
          if (value === 0) return '#fee2e2';
          if (value < 10) return '#fef3c7';
          if (value < 20) return '#d1fae5';
          return '#dcfce7';
        },
        borderColor: '#10b981',
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false
      }]
    };
  }, [data]);

  const tagsChart = useMemo(() => {
    if (!data) return null;
    const entries = Object.entries(data.problemTags);
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];
    
    return {
      labels: entries.map(([tag]) => tag.toUpperCase()),
      datasets: [{
        data: entries.map(([, count]) => count),
        backgroundColor: colors.slice(0, entries.length),
        borderWidth: 3,
        borderColor: '#fff',
        hoverOffset: 10
      }]
    };
  }, [data]);

  async function getAIInsights() {
    setInsightsLoading(true);
    setInsights(null);
    try {
      // 1. Get the HTML of the current page
      const htmlContent = document.documentElement.outerHTML;

      // 2. Send it to our new API route
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ htmlContent }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setInsights(result.insights);
    } catch (err: any) {
      console.error('Failed to get AI insights', err);
      setInsights('Sorry, I was unable to generate insights at this time.');
    } finally {
      setInsightsLoading(false);
    }
  }

  return (
    <div className="analytics-dashboard">
      <div className="dashboard-content">
        {/* Header */}
        <div className="dashboard-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <a 
              href="/" 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(59, 130, 246, 0.1)',
                color: '#3b82f6',
                textDecoration: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                fontWeight: '600',
                border: '2px solid rgba(59, 130, 246, 0.2)',
                transition: 'all 0.2s ease'
              }}
            >
              ← Back to Overview
            </a>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input 
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="Enter CF handle"
                style={{
                  padding: '8px 12px',
                  border: '2px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '6px',
                  fontSize: '0.9rem'
                }}
              />
              <button 
                onClick={loadRealData}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  background: loading ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? '🔄 Loading...' : '🚀 Analyze'}
              </button>
            </div>
          </div>
          
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '2px solid #ef4444',
              color: '#ef4444',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '24px',
              fontWeight: '600'
            }}>
              ❌ Error: {error}
            </div>
          )}
          
          <h1 className="dashboard-title">🏆 CF Analytics Pro Dashboard</h1>
          <p className="dashboard-subtitle">
            {profile ? (
              <>Analyzing <strong style={{ color: '#3b82f6' }}>@{profile.handle}</strong> - Track your competitive programming journey with detailed insights</>
            ) : (
              'Enter a handle and click "Analyze" to get started'
            )}
          </p>
        </div>

        {loading && (
          <div style={{
            textAlign: 'center',
            padding: '48px 24px',
            background: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '16px',
            margin: '24px 0'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔄</div>
            <h3 style={{ color: '#3b82f6', margin: '0 0 8px 0' }}>Loading Analytics...</h3>
            <p style={{ color: '#6b7280', margin: 0 }}>Fetching data from Codeforces API</p>
          </div>
        )}

        {!loading && !data && (
          <div style={{
            textAlign: 'center',
            padding: '48px 24px',
            background: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '16px',
            margin: '24px 0'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>👋</div>
            <h3 style={{ color: '#3b82f6', margin: '0 0 8px 0' }}>Welcome to the Analytics Dashboard</h3>
            <p style={{ color: '#6b7280', margin: 0 }}>Enter a Codeforces handle above and click "Analyze" to see the magic happen!</p>
          </div>
        )}

        {!loading && data && (
          <>
          <section className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">🧠 AI Insights</h2>
          </div>
          
          <div className="insights-card">
            {insightsLoading && (
              <div style={{
                textAlign: 'center',
                padding: '48px 24px',
                background: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '16px',
                margin: '24px 0'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🧠</div>
                <h3 style={{ color: '#8b5cf6', margin: '0 0 8px 0' }}>Generating AI Insights...</h3>
                <p style={{ color: '#6b7280', margin: 0 }}>The agent is analyzing the profile...</p>
              </div>
            )}
            
            {!insightsLoading && insights && (
              <div className="analysis-card" style={{ lineHeight: '1.6' }}>
                <ReactMarkdown>{insights}</ReactMarkdown>
              </div>
            )}
            
            {!insightsLoading && !insights && (
              <div className="insights-placeholder">
                <span>No AI insights generated yet.</span>
              </div>
            )}
            
            <button 
              className="generate-insights-btn"
              onClick={getAIInsights}
              disabled={insightsLoading}
              style={{
                padding: '8px 16px',
                background: insightsLoading ? '#9ca3af' : '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: insightsLoading ? 'not-allowed' : 'pointer',
                marginLeft: '12px'
              }}
            >
              {insightsLoading ? '🧠 Thinking...' : '🤖 Get AI Insights'}
            </button>
          </div>
        </section>
            {/* Consistency Index Section */}
            <section className="dashboard-section">
            
          <div className="section-header">
            <h2 className="section-title">📅 Consistency Index – Weekly practice tracking</h2>
          </div>
          
          <div className="metrics-grid">
            <div className="metric-card highlight-card">
              <div className="metric-value">{data.consistency.currentStreak}</div>
              <div className="metric-label">Current Streak</div>
              <div className="metric-unit">weeks</div>
            </div>
            
            <div className="metric-card">
              <div className="metric-value">{data.consistency.longestStreak}</div>
              <div className="metric-label">Longest Streak</div>
              <div className="metric-unit">weeks</div>
            </div>
            
            <div className="metric-card">
              <div className="metric-value">{data.consistency.activeWeeks}/{data.consistency.totalWeeks}</div>
              <div className="metric-label">Active Weeks</div>
              <div className="metric-unit">ratio</div>
            </div>
            
            <div className="metric-card status-card" style={{ borderColor: consistencyStatus.color }}>
              <div className="metric-value" style={{ color: consistencyStatus.color }}>
                {consistencyStatus.emoji} {consistencyStatus.label}
              </div>
              <div className="metric-label">Status</div>
            </div>
          </div>

          {/* Streak Analysis */}
          <div className="analysis-card">
            <h3 className="analysis-title">📊 Streak Analysis</h3>
            <div className="analysis-points">
              <div className="analysis-point">
                <span className="bullet">•</span>
                <span>Current streak: <strong>{data.consistency.currentStreak} weeks</strong></span>
              </div>
              <div className="analysis-point">
                <span className="bullet">•</span>
                <span>Longest streak: <strong>{data.consistency.longestStreak} weeks</strong></span>
              </div>
              <div className="analysis-point">
                <span className="bullet">•</span>
                <span>Dry spells: <strong>{data.consistency.drySpells}</strong></span>
              </div>
            </div>
          </div>
        </section>

        {/* Performance Section */}
        <section className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">⚡ Performance Metrics</h2>
          </div>
          
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-value">{data.performance.avgACsPerWeek}</div>
              <div className="metric-label">Avg ACs per active week</div>
            </div>
            
            <div className="metric-card">
              <div className="metric-value">{data.performance.mostProductiveWeek}</div>
              <div className="metric-label">Most productive week</div>
            </div>
            
            <div className="metric-card">
              <div className="metric-value">{data.performance.activityRate}%</div>
              <div className="metric-label">Activity rate</div>
            </div>
          </div>
        </section>

        {/* Consistency Goals */}
        <section className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">🎯 Consistency Goals</h2>
          </div>
          
          <div className="goals-grid">
            <div className="goals-main-card">
              <div className="goals-header">
                <h3 className="goals-title">🏆 Amazing consistency!</h3>
                <p className="goals-subtitle">"You've maintained a {data.consistency.currentStreak}-week streak. Keep it up!"</p>
              </div>
              <div className="goals-progress">
                <div className="progress-item">
                  <span className="progress-label">Weekly Activity Goal</span>
                  <div className="progress-bar-large">
                    <div 
                      className="progress-fill-large" 
                      style={{ width: `${(data.consistency.activeWeeks / data.consistency.totalWeeks) * 100}%` }}
                    ></div>
                  </div>
                  <span className="progress-percentage">{Math.round((data.consistency.activeWeeks / data.consistency.totalWeeks) * 100)}%</span>
                </div>
              </div>
            </div>
            
            <div className="goals-list-card">
              <h3 className="goals-list-title">Current Objectives</h3>
              <div className="goals-list">
                <div className="goal-item">
                  <span className="goal-icon">🎯</span>
                  <div className="goal-content">
                    <span className="goal-title">Target</span>
                    <span className="goal-description">Solve problems every week</span>
                  </div>
                  <span className="goal-status">⏳</span>
                </div>
                <div className="goal-item">
                  <span className="goal-icon">📈</span>
                  <div className="goal-content">
                    <span className="goal-title">Goal</span>
                    <span className="goal-description">Maintain 80%+ activity rate</span>
                  </div>
                  <span className="goal-status">{(data.consistency.activeWeeks / data.consistency.totalWeeks) >= 0.8 ? '✅' : '❌'}</span>
                </div>
                <div className="goal-item">
                  <span className="goal-icon">🏅</span>
                  <div className="goal-content">
                    <span className="goal-title">Challenge</span>
                    <span className="goal-description">Beat your {data.consistency.longestStreak}-week record</span>
                  </div>
                  <span className="goal-status">{data.consistency.currentStreak > data.consistency.longestStreak ? '🏆' : '⚡'}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* Most Productive Week Highlight */}
        <section className="dashboard-section">
          <div className="highlight-special-card">
            <div className="rocket-icon">🚀</div>
            <div className="highlight-content">
              <h3 className="highlight-title">Week of {data.performance.mostProductiveDate}</h3>
              <p className="highlight-text">You solved <strong>{data.performance.mostProductiveWeek} problems</strong>! Incredible productivity!</p>
            </div>
          </div>
        </section>

        {/* Charts Section */}
        <section className="dashboard-section">
          <div className="charts-grid">
            <div className="chart-card">
              <h3 className="chart-title">📊 Weekly Activity</h3>
              <div className="chart-container">
                {weeklyChart && <Bar 
                  data={weeklyChart} 
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
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' },
                        ticks: { color: '#6b7280' }
                      },
                      x: {
                        grid: { display: false },
                        ticks: { color: '#6b7280' }
                      }
                    }
                  }} 
                />}
              </div>
            </div>
            
            <div className="chart-card">
              <h3 className="chart-title">🏷️ Problem Tags Distribution</h3>
              <div className="chart-container">
                {tagsChart && <Doughnut 
                  data={tagsChart}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          padding: 15,
                          usePointStyle: true,
                          font: { size: 12, weight: 'bold' }
                        }
                      }
                    },
                    cutout: '50%'
                  }}
                />}
              </div>
            </div>
          </div>
        </section>

        {/* Badges Progress */}
        <section className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">🏅 Profile Badges Progress</h2>
          </div>
          
          <div className="badges-grid">
            {data.badges.map((badge: any, index: number) => (
              <div key={badge.name} className="badge-card">
                <div className="badge-header">
                  <h4 className="badge-name">{badge.name}</h4>
                  <span className="badge-percentage">{badge.progress}%</span>
                </div>
                <div className="badge-description">{badge.description}</div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ 
                      width: `${badge.progress}%`,
                      backgroundColor: index % 2 === 0 ? '#3b82f6' : '#10b981'
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Submission Activity Heatmap */}
        <section className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">🔥 Submission Activity Heatmap</h2>
          </div>
          
          <div className="heatmap-card">
            <div className="heatmap-header">
              <div className="heatmap-stats">
                <div className="heatmap-stat">
                  <span className="heatmap-value">{submissions?.total || 0}</span>
                  <span className="heatmap-label">Total Submissions</span>
                </div>
                <div className="heatmap-stat">
                  <span className="heatmap-value">{data.consistency.activeWeeks}</span>
                  <span className="heatmap-label">Active Weeks</span>
                </div>
                <div className="heatmap-stat">
                  <span className="heatmap-value">{data.consistency.currentStreak}</span>
                  <span className="heatmap-label">Current Streak</span>
                </div>
                <div className="heatmap-stat">
                  <span className="heatmap-value">{data.consistency.longestStreak}</span>
                  <span className="heatmap-label">Longest Streak</span>
                </div>
              </div>
            </div>
            
            <div className="heatmap-container">
              <div className="heatmap-months">
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => (
                  <div key={month} className="heatmap-month">{month}</div>
                ))}
              </div>
              
              <div className="heatmap-body">
                <div className="heatmap-days-col">
                  <div>Mon</div>
                  <div>Wed</div>
                  <div>Fri</div>
                </div>
                <div className="heatmap-grid">
                  {Array.from({ length: 365 }).map((_, i) => {
                    const activity = dailyActivity[i] || 0;
                    let color = '#ebedf0';
                    if (activity > 0) color = '#c6e48b';
                    if (activity > 3) color = '#7bc96f';
                    if (activity > 6) color = '#239a3b';
                    if (activity > 9) color = '#196127';
                    
                    const date = dayjs().subtract(365 - 1 - i, 'days');
                    
                    return (
                      <div
                        key={i}
                        className="heatmap-cell"
                        style={{ backgroundColor: color }}
                        title={`${activity} submissions on ${date.format('MMM DD, YYYY')}`}
                      />
                    );
                  })}
                </div>
              </div>
              
              <div className="heatmap-legend">
                <span className="legend-text">Less</span>
                <div className="legend-colors">
                  <div className="legend-color" style={{ backgroundColor: '#ebedf0' }}></div>
                  <div className="legend-color" style={{ backgroundColor: '#c6e48b' }}></div>
                  <div className="legend-color" style={{ backgroundColor: '#7bc96f' }}></div>
                  <div className="legend-color" style={{ backgroundColor: '#239a3b' }}></div>
                  <div className="legend-color" style={{ backgroundColor: '#196127' }}></div>
                </div>
                <span className="legend-text">More</span>
              </div>
            </div>
            
            <div className="activity-insights">
              <h4 className="insights-title">📊 Activity Insights</h4>
              <div className="insights-grid">
                <div className="insight-item">
                  <span className="insight-label">Average: {Math.round((submissions?.total || 0) / Math.max(data.consistency.activeWeeks, 1))} submissions per active week</span>
                </div>
                <div className="insight-item">
                  <span className="insight-label">Most active week: {data.performance.mostProductiveWeek} submissions</span>
                </div>
                <div className="insight-item">
                  <span className="insight-label">Activity rate: {data.performance.activityRate}% of weeks</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Strategy Tips */}
        <section className="dashboard-section">
          <div className="tips-card">
            <h3 className="tips-title">💡 Strategy Tips</h3>
            <div className="tips-content">
              <div className="tip-item">
                <span className="tip-icon">🎯</span>
                <span>
                  {submissions && submissions.total > 0 
                    ? `Success Rate: ${Math.round((submissions.accepted / submissions.total) * 100)}% - ${submissions.accepted} problems solved out of ${submissions.total} attempts`
                    : 'Focus on consistency - solve problems regularly to build momentum'
                  }
                </span>
              </div>
              <div className="tip-item">
                <span className="tip-icon">⏰</span>
                <span>
                  {data.performance.activityRate < 50 
                    ? 'Try to be more consistent - aim for solving problems at least 3 times per week'
                    : 'Great consistency! Keep up the regular practice schedule'
                  }
                </span>
              </div>
              <div className="tip-item">
                <span className="tip-icon">📈</span>
                <span>
                  {profile?.currentRating
                    ? `Current rating: ${profile.currentRating}. ${profile.currentRating < profile.maxRating ? `You're ${profile.maxRating - profile.currentRating} points away from your peak!` : "You're at your peak rating! 🏆"}`
                    : 'Start participating in contests to get a rating and track your progress!'}
                </span>
              </div>
            </div>
          </div>
        </section>
        {/* AI Insights Section */}
        </>
        )}
      </div>
    </div>
  );
};

export default AnalyticsPage;
