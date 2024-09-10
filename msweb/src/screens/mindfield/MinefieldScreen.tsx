import React, { useEffect, useState } from "react";
import { Session, sessionManager } from "../../common/SessionManager";
import './MinefieldScreen.scss';
import { MinefieldSquare, MinefieldSquareMode } from "./MinefieldSquare";
import SessionState from "../../common/SessionState";
import { gameEngine, GameSnapshot } from "../../common/GameEngine";

interface MinefieldProps {
  session: Session;
  onPause: () => void;
}

const MinefieldScreen: React.FC<MinefieldProps> = ({ session, onPause }) => {
  const convertCoordinateToIndex = (x: number, y: number): number => {
    return (session.width * y) + x;
  }

  const totalSquareCount = session.width * session.height;

  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null)

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const [squareModes, setSquareModes] = useState<(MinefieldSquareMode | string)[]>(Array(totalSquareCount).fill(MinefieldSquareMode.UNKNOWN));
  const [sessionState, setSessionState] = useState<SessionState | string>(session.state || SessionState.ACTIVE);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now())

  // Re-calculate the padding and margin.
  const handleWindowResize = () => {
    setWindowWidth(window.innerWidth);
    setWindowHeight(window.innerHeight);
  };

  const processSnapshot = (gameSnapshot: GameSnapshot) => {
    const newSquareModes: (MinefieldSquareMode | string)[] = [...squareModes];

    for (let move of gameSnapshot.moves) {
      const index = convertCoordinateToIndex(move.x, move.y)
      newSquareModes[index] = move.state
    }

    setSnapshot(gameSnapshot);
    setSquareModes(newSquareModes);
    setSessionState(gameSnapshot.info.state);
    setLastUpdateTime(Date.now())
  }

  useEffect(() => {
    gameEngine
      .get(session.id)
      .then(processSnapshot);

    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  const onSuspend = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();

    onPause();
  }

  const afterSquareIsClicked = (x: number, y: number) => {
    gameEngine
      .visit(session.id, x, y)
      .then(processSnapshot);
  }

  const afterSquareIsFlagged = (x: number, y: number) => {
    const squareIndex = convertCoordinateToIndex(x, y);
    const newState = squareModes[squareIndex] === MinefieldSquareMode.FLAGGED
      ? MinefieldSquareMode.UNKNOWN
      : MinefieldSquareMode.FLAGGED;

    gameEngine
      .visit(session.id, x, y, newState)
      .then(processSnapshot);
  }

  // Generate the square matrix.
  const rowElements = [];
  for (let rowId = 0; rowId < session.height; rowId++) {
    const columnElements = [];

    // Generate squares per row.
    for (let columnId = 0; columnId < session.width; columnId++) {
      const squareIndex = convertCoordinateToIndex(columnId, rowId);
      const mineCount = snapshot !== null ? snapshot.hint.nearby_mine_count[rowId][columnId] : '';

      let squareLabel = mineCount === 0 ? '' : `${mineCount}`;

      const squareMode = squareModes[squareIndex];
      if (squareMode === MinefieldSquareMode.EXPLODED) {
        squareLabel = '💣';
      } else if (squareMode === MinefieldSquareMode.FLAGGED) {
        squareLabel = '⛳️';
      }

      columnElements.push(
        <MinefieldSquare
          key={`${squareIndex}@${Date.now()}`}
          x={columnId}
          y={rowId}
          mode={squareMode}
          enabled={snapshot !== null ? (snapshot.info.state === null || snapshot.info.state === 'active') : false}
          label={squareLabel}
          onClick={afterSquareIsClicked}
          onFlag={afterSquareIsFlagged}
        />
      );
    }

    rowElements.push(
      <div
        key={`Row: ${rowId}`}
        className="minefield-strip"
        style={{
          width: `${session.width * 38}px`,
        }}
      >
        {columnElements}
      </div>
    );
  }

  let knownSquareCount = 0;
  for (let squareMode of squareModes) {
    knownSquareCount += (squareMode === MinefieldSquareMode.UNKNOWN) ? 0 : 1;
  }

  const squareDimention = 38; // Derived from the CSS file.

  const horizontalPadding = Math.max(
    0,
    Math.floor((windowWidth - (squareDimention * session.width)) / 2)
  );

  const verticalPadding = Math.max(
    0,
    Math.floor((windowHeight - (squareDimention * session.height)) / 2)
  );

  return (
    <div className="minefield-container" data-state={sessionState}>
      <h1>
        <span style={{ flex: 1, display: 'flex', maxWidth: '25%', justifyContent: 'flex-start' }}>
          <button onClick={onSuspend}>&lt;</button>
        </span>
        <span className="flex-spacer"></span>
        <span className="session-id">Level {session.mineDensity / 5} ({session.width} x {session.height})</span>
        <span className="flex-spacer"></span>
        <span style={{ flex: 1, display: 'flex', maxWidth: '25%', justifyContent: 'flex-end' }}>
          <span className="session-state">{sessionState}</span>
        </span>
      </h1>

      <div className="minefield" data-last-update-at={lastUpdateTime} style={{
        paddingTop: verticalPadding,
        paddingLeft: horizontalPadding,
        paddingRight: horizontalPadding,
        paddingBottom: verticalPadding,
      }}>
        {rowElements}
      </div>
    </div>
  );
}

export default MinefieldScreen;