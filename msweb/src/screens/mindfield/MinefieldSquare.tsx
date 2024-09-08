import { useEffect, useState } from "react";

interface MinefieldSquareProps {
  x: number;
  y: number;
  mode: string;
  rigged: boolean;
  label: string;
  cheatModeEnabled: boolean;
  enabled: boolean;
  onClick: (x: number, y: number) => void;
  onFlag: (x: number, y: number) => void;
}

enum MinefieldSquareMode {
  UNKNOWN = 'unknown', // Not visited by the player.
  CLEARED = 'cleared', // Cleared by the player.
  FLAGGED = 'flagged', // Flagged by the player.
  EXPLODED = 'exploded', // The mine was exploded.
}

const MinefieldSquare: React.FC<MinefieldSquareProps> = ({ x, y, mode, rigged, label, cheatModeEnabled, enabled, onClick, onFlag }) => {
  const handleClickEvent = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();

    if (!enabled) {
      return;
    }

    if (mode === MinefieldSquareMode.UNKNOWN) {
      onClick(x, y);
    } else {
      // NOOP
    }
  }

  const handleRightClickEvent = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();

    if (!enabled) {
      return;
    }

    if (mode === MinefieldSquareMode.UNKNOWN || mode == MinefieldSquareMode.FLAGGED) {
      onFlag(x, y);
    } else {
      // NOOP
    }
  }

  let squareLabel = '';

  if (!enabled && rigged && mode === MinefieldSquareMode.UNKNOWN) {
    squareLabel = '⛳️';
  } else if (mode === MinefieldSquareMode.FLAGGED) {
    squareLabel = '⛳️';
  } else if (cheatModeEnabled || mode === MinefieldSquareMode.CLEARED || mode === MinefieldSquareMode.EXPLODED) {
    squareLabel = label;
  }

  return (
    <div
      aria-label={`At ${x} and ${y}`}
      data-mode={mode}
      data-flag={cheatModeEnabled && rigged ? 'rigged' : ''}
      className="minefield-square"
      onClick={handleClickEvent}
      onContextMenu={handleRightClickEvent}
    >
      {squareLabel}
    </div>
  );
}

export { MinefieldSquare, MinefieldSquareMode };