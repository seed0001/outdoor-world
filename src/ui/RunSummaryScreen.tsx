import { useRunStats } from "../systems/player/runStats";
import { useRunGoal } from "../systems/world/runGoal";
import { useHealth } from "../systems/player/health";

const SEASON_ICONS = ["🌱", "☀", "🍂", "❄"] as const;
const SEASON_LABELS = ["Spring", "Summer", "Autumn", "Winter"] as const;

interface Props {
  onRestart: () => void;
  onMainMenu: () => void;
}

export default function RunSummaryScreen({ onRestart, onMainMenu }: Props) {
  const hp = useHealth();
  const stats = useRunStats();
  const goal = useRunGoal();

  const visible = hp.dead || goal.complete;
  if (!visible) return null;

  const won = goal.complete && !hp.dead;

  return (
    <div className="run-summary">
      <div className="run-summary__card">
        <div className="run-summary__icon" aria-hidden>
          {won ? "🏕" : "💀"}
        </div>

        <h1 className="run-summary__title">
          {won ? "You Survived" : "You Were Killed"}
        </h1>

        <p className="run-summary__subtitle">
          {won
            ? "All four seasons endured. Well done."
            : hp.deathSource
              ? `by ${hp.deathSource}`
              : "somehow"}
        </p>

        <div className="run-summary__seasons" aria-label="Seasons survived">
          {SEASON_LABELS.map((label, i) => (
            <div
              key={label}
              className={`run-summary__season${i < goal.seasonsCompleted ? " run-summary__season--done" : ""}`}
            >
              <span className="run-summary__season-icon" aria-hidden>
                {SEASON_ICONS[i]}
              </span>
              <span className="run-summary__season-label">{label}</span>
            </div>
          ))}
        </div>

        <div className="run-summary__stats">
          <div className="run-summary__stat">
            <span className="run-summary__stat-label">Days survived</span>
            <span className="run-summary__stat-value mono">{stats.daysElapsed}</span>
          </div>
          <div className="run-summary__stat">
            <span className="run-summary__stat-label">Trees chopped</span>
            <span className="run-summary__stat-value mono">{stats.treesChopped}</span>
          </div>
          <div className="run-summary__stat">
            <span className="run-summary__stat-label">Animals hunted</span>
            <span className="run-summary__stat-value mono">{stats.animalsKilled}</span>
          </div>
          <div className="run-summary__stat">
            <span className="run-summary__stat-label">Campfires lit</span>
            <span className="run-summary__stat-value mono">{stats.campfiresLit}</span>
          </div>
          <div className="run-summary__stat">
            <span className="run-summary__stat-label">Structures built</span>
            <span className="run-summary__stat-value mono">{stats.structuresBuilt}</span>
          </div>
        </div>

        <div className="run-summary__actions">
          <button
            type="button"
            className="run-summary__btn run-summary__btn--primary"
            onClick={onRestart}
          >
            Try Again
          </button>
          <button
            type="button"
            className="run-summary__btn"
            onClick={onMainMenu}
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
