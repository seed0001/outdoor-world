import type { InventoryItem } from "../systems/player/inventory";

type Props = {
  item: InventoryItem;
  className?: string;
};

/** Simple inline SVG icons for backpack inventory slots. */
export default function InventoryItemIcon({ item, className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      aria-hidden
      focusable="false"
    >
      {renderIcon(item)}
    </svg>
  );
}

function renderIcon(item: InventoryItem) {
  switch (item) {
    case "stick":
      return (
        <>
          <rect x="5" y="14" width="22" height="3" rx="1" fill="#8b5a2b" />
          <rect x="8" y="11" width="18" height="3" rx="1" fill="#a06a35" transform="rotate(-12 17 12.5)" />
          <rect x="7" y="17" width="19" height="3" rx="1" fill="#6b4423" transform="rotate(8 16.5 18.5)" />
        </>
      );
    case "wood":
      return (
        <>
          <ellipse cx="16" cy="18" rx="11" ry="7" fill="#5c3a1a" />
          <ellipse cx="16" cy="17" rx="9" ry="5.5" fill="#7a4f28" />
          <ellipse cx="16" cy="16" rx="3" ry="3" fill="#c4a574" />
          <ellipse cx="16" cy="16" rx="1.4" ry="1.4" fill="#3d2814" />
        </>
      );
    case "stone":
      return (
        <path
          d="M8 20 L12 10 L20 9 L26 16 L22 24 L14 25 Z"
          fill="#8a8274"
          stroke="#5c5850"
          strokeWidth="1"
        />
      );
    case "arrow":
      return (
        <>
          <rect x="6" y="15" width="16" height="2" rx="1" fill="#8b7355" />
          <path d="M22 16 L28 16 L24 12 Z" fill="#c8c0b0" />
          <path d="M22 16 L28 16 L24 20 Z" fill="#c8c0b0" />
          <path d="M6 14 L9 16 L6 18 Z" fill="#6a5040" />
        </>
      );
    case "sturdy_frame":
      return (
        <>
          <rect x="7" y="8" width="18" height="16" rx="1" fill="none" stroke="#9a7a50" strokeWidth="2" />
          <line x1="16" y1="8" x2="16" y2="24" stroke="#7a5a38" strokeWidth="1.5" />
          <line x1="7" y1="16" x2="25" y2="16" stroke="#7a5a38" strokeWidth="1.5" />
          <rect x="13" y="20" width="6" height="4" fill="#5c4028" />
        </>
      );
    case "iron_ore":
      return (
        <path
          d="M9 21 L13 11 L21 9 L25 17 L20 24 L12 23 Z"
          fill="#7a4a3a"
          stroke="#4a2820"
          strokeWidth="1"
        />
      );
    case "copper_ore":
      return (
        <path
          d="M9 21 L13 11 L21 9 L25 17 L20 24 L12 23 Z"
          fill="#3d8a72"
          stroke="#2a5a48"
          strokeWidth="1"
        />
      );
    case "quartz":
      return (
        <>
          <path d="M16 6 L22 14 L19 26 L13 26 L10 14 Z" fill="#e8eef4" stroke="#a8b0bc" strokeWidth="1" />
          <path d="M16 6 L19 26 L13 26 Z" fill="#d0d8e4" opacity="0.6" />
        </>
      );
    case "sulfur":
      return (
        <path
          d="M9 21 L13 11 L21 9 L25 17 L20 24 L12 23 Z"
          fill="#d4c840"
          stroke="#9a9020"
          strokeWidth="1"
        />
      );
    case "salt":
      return (
        <>
          <ellipse cx="16" cy="20" rx="10" ry="5" fill="#ece8e0" />
          <ellipse cx="13" cy="17" rx="4" ry="2.5" fill="#f8f6f2" />
          <ellipse cx="19" cy="18" rx="3.5" ry="2" fill="#fff" />
        </>
      );
    case "raw_rat":
      return (
        <>
          <ellipse cx="17" cy="18" rx="9" ry="6" fill="#9a8a88" />
          <circle cx="23" cy="15" r="4" fill="#b0a0a0" />
          <circle cx="24.5" cy="14" r="1" fill="#2a2020" />
          <path d="M8 17 Q5 14 7 12" stroke="#8a7a78" strokeWidth="1.5" fill="none" />
        </>
      );
    case "raw_snake":
      return (
        <path
          d="M8 20 Q12 10 18 14 Q24 18 26 10 Q22 22 14 20 Q10 24 8 20"
          fill="#6a8a50"
          stroke="#3a5028"
          strokeWidth="1"
        />
      );
    case "raw_fish":
      return (
        <>
          <ellipse cx="15" cy="17" rx="10" ry="5" fill="#6a9ab8" />
          <path d="M25 17 L30 13 L30 21 Z" fill="#5a8aa8" />
          <circle cx="10" cy="16" r="1.2" fill="#1a2830" />
        </>
      );
    case "cooked_rat":
      return (
        <>
          <ellipse cx="17" cy="18" rx="9" ry="6" fill="#8a5a38" />
          <circle cx="23" cy="15" r="4" fill="#a06840" />
          <line x1="12" y1="16" x2="20" y2="19" stroke="#5c3820" strokeWidth="1" />
          <line x1="14" y1="20" x2="22" y2="15" stroke="#5c3820" strokeWidth="1" />
        </>
      );
    case "cooked_snake":
      return (
        <>
          <path
            d="M8 20 Q12 10 18 14 Q24 18 26 10 Q22 22 14 20 Q10 24 8 20"
            fill="#7a5030"
            stroke="#4a3018"
            strokeWidth="1"
          />
          <line x1="12" y1="15" x2="20" y2="18" stroke="#4a2810" strokeWidth="1" />
        </>
      );
    case "cooked_fish":
      return (
        <>
          <ellipse cx="15" cy="17" rx="10" ry="5" fill="#c89050" />
          <path d="M25 17 L30 13 L30 21 Z" fill="#a87840" />
          <line x1="11" y1="15" x2="19" y2="19" stroke="#7a5028" strokeWidth="1" />
        </>
      );
    default:
      return <rect x="8" y="8" width="16" height="16" rx="2" fill="#666" />;
  }
}
