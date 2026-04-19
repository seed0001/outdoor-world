import type { PlayMode } from "../systems/settings/playMode";

export default function PlayModeSplash({
  onSelect,
  onBack,
}: {
  onSelect: (mode: PlayMode) => void;
  onBack: () => void;
}) {
  return (
    <div className="device-splash">
      <button type="button" className="device-back" onClick={onBack}>
        ← Devices
      </button>

      <div className="device-splash__glow" aria-hidden />

      <header className="device-splash__header">
        <h1 className="device-splash__title">How do you want to play?</h1>
        <p className="device-splash__subtitle">
          Sim mode is carefree exploration. Survive mode uses hunger, thirst,
          sanity, and temperature rules.
        </p>
      </header>

      <div className="device-splash__grid">
        <button
          type="button"
          className="device-splash__card device-splash__card--desktop"
          onClick={() => onSelect("sim")}
        >
          <span className="device-splash__icon" aria-hidden>
            ◎
          </span>
          <span className="device-splash__label">Sim</span>
          <span className="device-splash__hint">
            Explore the world — no passive hunger, thirst, sanity drain, or
            temperature damage from survival rules.
          </span>
        </button>

        <button
          type="button"
          className="device-splash__card device-splash__card--phone"
          onClick={() => onSelect("survive")}
        >
          <span className="device-splash__icon" aria-hidden>
            ✶
          </span>
          <span className="device-splash__label">Survive</span>
          <span className="device-splash__hint">
            Full survival: manage food, water, mind, and weather exposure over
            time.
          </span>
        </button>
      </div>
    </div>
  );
}
