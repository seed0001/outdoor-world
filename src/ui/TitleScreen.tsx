import { hasSave } from "../systems/player/saveSystem";

interface Props {
  onNewGame: () => void;
  onContinue: () => void;
}

export default function TitleScreen({ onNewGame, onContinue }: Props) {
  const canContinue = hasSave();

  return (
    <div className="device-splash">
      <div className="device-splash__glow" aria-hidden />

      <header className="device-splash__header">
        <h1 className="device-splash__title title-screen__game-title">
          The World
        </h1>
        <p className="device-splash__subtitle">
          An open wilderness. Explore, survive, endure the seasons.
        </p>
      </header>

      <div className="device-splash__grid title-screen__grid">
        {canContinue && (
          <button
            type="button"
            className="device-splash__card device-splash__card--desktop"
            onClick={onContinue}
          >
            <span className="device-splash__icon" aria-hidden>
              ▶
            </span>
            <span className="device-splash__label">Continue</span>
            <span className="device-splash__hint">Resume your last run</span>
          </button>
        )}

        <button
          type="button"
          className="device-splash__card device-splash__card--phone"
          onClick={onNewGame}
        >
          <span className="device-splash__icon" aria-hidden>
            {canContinue ? "↺" : "◎"}
          </span>
          <span className="device-splash__label">
            {canContinue ? "New Game" : "Start"}
          </span>
          <span className="device-splash__hint">
            {canContinue
              ? "Start fresh — your save will be cleared"
              : "Begin a new adventure in the wilderness"}
          </span>
        </button>
      </div>
    </div>
  );
}
