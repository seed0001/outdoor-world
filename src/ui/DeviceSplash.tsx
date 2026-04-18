import type { DeviceMode } from "../deviceMode";

export default function DeviceSplash({
  onSelect,
}: {
  onSelect: (mode: DeviceMode) => void;
}) {
  return (
    <div className="device-splash">
      <div className="device-splash__glow" aria-hidden />
      <header className="device-splash__header">
        <h1 className="device-splash__title">Outdoor World</h1>
        <p className="device-splash__subtitle">
          Choose how you want to play — no account required.
        </p>
      </header>

      <div className="device-splash__grid">
        <button
          type="button"
          className="device-splash__card device-splash__card--desktop"
          onClick={() => onSelect("desktop")}
        >
          <span className="device-splash__icon" aria-hidden>
            🖥
          </span>
          <span className="device-splash__label">Desktop</span>
          <span className="device-splash__hint">
            Keyboard + mouse, pointer lock look
          </span>
        </button>

        <button
          type="button"
          className="device-splash__card device-splash__card--tablet"
          onClick={() => onSelect("tablet")}
        >
          <span className="device-splash__icon" aria-hidden>
            📱
          </span>
          <span className="device-splash__label">Tablet</span>
          <span className="device-splash__hint">
            Touch drag to look, on-screen friendly layout
          </span>
        </button>

        <button
          type="button"
          className="device-splash__card device-splash__card--phone"
          onClick={() => onSelect("phone")}
        >
          <span className="device-splash__icon" aria-hidden>
            📲
          </span>
          <span className="device-splash__label">Phone</span>
          <span className="device-splash__hint">
            Touch look + WebXR augmented reality when supported
          </span>
        </button>
      </div>
    </div>
  );
}
