import { useEffect, useState } from "react";

interface MinefieldSquareProps {
  x: number;
  y: number;
  mode: string;
  label: string;
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

const MinefieldSquare: React.FC<MinefieldSquareProps> = ({ x, y, mode, label, enabled, onClick, onFlag }) => {
  const [suspended, setSuspended] = useState(false);

  const handleClickEvent = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();

    if (!enabled || suspended) {
      return;
    }

    if (mode === MinefieldSquareMode.UNKNOWN) {
      setSuspended(true);
      onClick(x, y);
    } else {
      // NOOP
    }
  }

  const handleRightClickEvent = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();

    if (!enabled || suspended) {
      return;
    }

    if (mode === MinefieldSquareMode.UNKNOWN || mode == MinefieldSquareMode.FLAGGED) {
      setSuspended(true);
      onFlag(x, y);
    } else {
      // NOOP
    }
  }

  let squareLabel = '';

  if (mode === MinefieldSquareMode.FLAGGED) {
    squareLabel = '⛳️';
  } else if (mode === MinefieldSquareMode.CLEARED || mode === MinefieldSquareMode.EXPLODED) {
    squareLabel = label;
  }

  const classNames = ['minefield-square'];
  if (suspended) {
    classNames.push('suspended');
  }

  return (
    <div
      aria-label={`At ${x} and ${y}`}
      data-mode={mode}
      className={classNames.join(' ')}
      onClick={handleClickEvent}
      onContextMenu={handleRightClickEvent}
    >
      {squareLabel}
    </div>
  );
}

export { MinefieldSquare, MinefieldSquareMode };