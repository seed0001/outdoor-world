import { useWaterImmersion } from "../systems/player/waterImmersion";

/**
 * Full-screen underwater filter. Sits on top of the Canvas when the player's
 * head is below the lake surface. Uses backdrop-filter to blur + desaturate
 * + hue-shift everything rendered underneath, plus a stacked blue tint and
 * animated caustics so the scene convincingly reads as "through water".
 */
export default function UnderwaterOverlay() {
  const { submerged, depth } = useWaterImmersion();
  if (!submerged) return null;

  const k = Math.min(1, depth / 3.5);
  const tintAlpha = 0.5 + k * 0.35;
  const vignetteAlpha = 0.45 + k * 0.35;
  const blurPx = (1.5 + k * 2.5).toFixed(2);
  const saturate = (0.7 - k * 0.25).toFixed(2);
  const brightness = (0.78 - k * 0.18).toFixed(2);

  return (
    <div
      className="underwater-overlay"
      aria-hidden
      style={
        {
          "--underwater-tint-alpha": tintAlpha.toFixed(3),
          "--underwater-vignette-alpha": vignetteAlpha.toFixed(3),
          "--underwater-blur": `${blurPx}px`,
          "--underwater-saturate": saturate,
          "--underwater-brightness": brightness,
        } as React.CSSProperties
      }
    >
      <div className="underwater-overlay__lens" />
      <div className="underwater-overlay__tint" />
      <div className="underwater-overlay__vignette" />
      <div className="underwater-overlay__caustics" />
    </div>
  );
}
