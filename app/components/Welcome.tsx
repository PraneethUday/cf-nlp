'use client';

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import './Welcome.css';

dayjs.extend(relativeTime);

interface WelcomeProps {
  handle: string;
  setHandle: (handle: string) => void;
  loadAll: () => void;
  loading: boolean;
  error: string | null;
  upcoming: any[];
}

export default function Welcome({
  handle,
  setHandle,
  loadAll,
  loading,
  error,
  upcoming,
}: WelcomeProps) {
  const topFive = upcoming?.slice(0, 5) || [];

  return (
    <main className="welcome-container">
      <div className="content-grid">
        {/* Left: Insights */}
        <div className="welcome-card">
          <div className="welcome-header">
            <div className="welcome-icon">🌿</div>
            <h1 className="welcome-title">CFinsights</h1>
            <p className="welcome-subtitle">
              Your one stop solution for all things CF
            </p>
          </div>

          <div className="input-box">
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="🔍 Enter Codeforces handle (e.g., tourist, Benq)"
              onKeyPress={(e) => e.key === 'Enter' && loadAll()}
              className="handle-input"
            />
          </div>

          <button
            onClick={loadAll}
            disabled={loading}
            className="primary-btn full-width"
          >
            {loading ? (
              <span className="loading-spinner"></span>
            ) : (
              '🌱 Analyze Profile'
            )}
          </button>

          {error && <div className="error-message">{error}</div>}
        </div>

        {/* Right: Contests */}
        <div className="contest-card">
          <h2 className="contest-heading">📅 Upcoming Contests</h2>
          <div className="contests-list-expanded">
            {!topFive.length ? (
              <div className="muted">No upcoming contests scheduled</div>
            ) : (
              topFive.map((c) => (
                <div
                  key={`${c.name}-${c.startTimeSeconds}`}
                  className="contest-row"
                >
                  <div className="contest-col contest-name">{c.name}</div>
                  <div className="contest-col">
                    🕒 {dayjs
                      .unix(c.startTimeSeconds)
                      .format('MMM DD, YYYY • HH:mm')}
                  </div>
                  <div className="contest-col">
                    ⏱ {Math.round(c.durationSeconds / 3600)}h
                  </div>
                  <div className="contest-col contest-countdown">
                    <span className="countdown-pill">
                      ⚡ Starts {dayjs.unix(c.startTimeSeconds).fromNow()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
