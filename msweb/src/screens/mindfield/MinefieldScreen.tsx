import React, { useEffect, useState } from "react";
import { Session, sessionManager } from "../../common/SessionManager";
import './MinefieldScreen.scss';
import { MinefieldSquare, MinefieldSquareMode } from "./MinefieldSquare";
import MainWindowMode from "../../common/MainWindowMode";

interface MinefieldProps {
  session: Session;
  onPause: () => void;
}

const MinefieldScreen: React.FC<MinefieldProps> = ({ session, onPause }) => {
  const convertCoordinateToIndex = (x: number, y: number): number => {
    return (session.width * y) + x;
  }

  const totalSquareCount = session.width * session.height;
  const totalMineCount = session.mineDensity / 100 * totalSquareCount;


  const mineIndexes: number[] = [];
  for (let mineCoordinate of session.mineCoordinates || []) {
    mineIndexes.push(convertCoordinateToIndex(mineCoordinate.x, mineCoordinate.y));
  }

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const [squareModes, setSquareModes] = useState<(MinefieldSquareMode|string)[]>(Array(totalSquareCount).fill(MinefieldSquareMode.UNKNOWN));
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const [sessionState, setSessionState] = useState<MainWindowMode>(session.state || MainWindowMode.ACTIVE);
  const [cheatModeEnabled, setCheatModeEnabled] = useState(false);

  // Re-calculate the padding and margin.
  const handleWindowResize = () => {
    setWindowWidth(window.innerWidth);
    setWindowHeight(window.innerHeight);
  };

  useEffect(() => {
    sessionManager.getMoves(session.id)
      .then(moves => {
        const newSquareModes = [...squareModes];
        for (let move of moves) {
          const moveIndex = convertCoordinateToIndex(move.x, move.y);
          newSquareModes[moveIndex] = move.state;
        }
        setSquareModes(newSquareModes);
      });

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

  const evaluateSessionState = (): MainWindowMode => {
    let clearedSquareCount = 0;
    let flaggedSquareCount = 0;
    for (let squareMode of squareModes) {
      if (squareMode === MinefieldSquareMode.CLEARED) {
        clearedSquareCount++;
      } else if (squareMode === MinefieldSquareMode.FLAGGED) {
        flaggedSquareCount++;
      } else if (squareMode === MinefieldSquareMode.EXPLODED) {
        sessionManager.setState(session.id, MainWindowMode.EXPLODED);
        return MainWindowMode.EXPLODED;
      }
    }

    if (clearedSquareCount + flaggedSquareCount === totalSquareCount) {
      sessionManager.setState(session.id, MainWindowMode.CLEARED);
      return MainWindowMode.CLEARED;
    } else if (clearedSquareCount + totalMineCount === totalSquareCount) {
      sessionManager.setState(session.id, MainWindowMode.CLEARED);
      return MainWindowMode.CLEARED;
    }

    return MainWindowMode.ACTIVE;
  }

  const afterSquareIsClicked = (x: number, y: number) => {
    const squareIndex = convertCoordinateToIndex(x, y);

    if (mineIndexes.includes(squareIndex)) {
      squareModes[squareIndex] = MinefieldSquareMode.EXPLODED;

      sessionManager.addMove(session.id, session.userId, x, y, squareModes[squareIndex]);
    } else {
      const clearIndexes: number[] = [];

      findClearIndexes(x, y, clearIndexes);

      // for (let clearIndex of clearIndexes) {
      //   squareModes[clearIndex] = MinefieldSquareMode.CLEARED;
      // }
    }

    setSquareModes(squareModes);
    setLastUpdateTime(Date.now());

    const currentState = evaluateSessionState();
    if (currentState !== MainWindowMode.ACTIVE) {
      setSessionState(currentState);
    }
  }

  const afterSquareIsFlagged = (x: number, y: number) => {
    const squareIndex = convertCoordinateToIndex(x, y);
    squareModes[squareIndex] = squareModes[squareIndex] === MinefieldSquareMode.FLAGGED ? MinefieldSquareMode.UNKNOWN : MinefieldSquareMode.FLAGGED;

    setSquareModes(squareModes);
    setLastUpdateTime(Date.now());

    const currentState = evaluateSessionState();
    if (currentState !== MainWindowMode.ACTIVE) {
      setSessionState(currentState);
    }
  }

  const toggleCheatMode = () => {
    setCheatModeEnabled(!cheatModeEnabled);
    setLastUpdateTime(Date.now());
  }

  const findNeighbourIndexes = (x: number, y: number): number[] => {
    const neighbourIndexes: number[] = [];

    for (let neighbourY = Math.max(0, y - 1); neighbourY <= Math.min(session.height - 1, y + 1); neighbourY++) {
      for (let neighbourX = Math.max(0, x - 1); neighbourX <= Math.min(session.width - 1, x + 1); neighbourX++) {
        neighbourIndexes.push(convertCoordinateToIndex(neighbourX, neighbourY));
      }
    }

    return neighbourIndexes;
  }

  const findClearIndexes = (x: number, y: number, clearIndexes: number[], depth?: number) => {
    const currentIndex = convertCoordinateToIndex(x, y);

    depth = depth || 0;

    if (clearIndexes.includes(currentIndex) || mineIndexes.includes(currentIndex) || squareModes[currentIndex] !== MinefieldSquareMode.UNKNOWN) {
      return;
    } else {
      squareModes[currentIndex] = MinefieldSquareMode.CLEARED;
      clearIndexes.push(currentIndex);
      sessionManager.addMove(session.id, session.userId, x, y, squareModes[currentIndex]);
    }

    const neighbourNodes: {x: number, y: number}[] = [];

    // Check if Left is clear.
    if (x - 1 >= 0) {
      neighbourNodes.push({x: x - 1, y: y});
    }

    // Check if Right is clear.
    if (x + 1 < session.width) {
      neighbourNodes.push({x: x + 1, y: y});
    }

    // Check if Top is clear.
    if (y - 1 >= 0) {
      neighbourNodes.push({x: x, y: y - 1});
    }

    // Check if Bottom is clear.
    if (y + 1 < session.height) {
      neighbourNodes.push({x: x, y: y + 1});
    }

    for (let neighbourNode of neighbourNodes) {
      findClearIndexes(neighbourNode.x, neighbourNode.y, clearIndexes, depth + 1);
    }
  }

  const isActiveField = evaluateSessionState() === 'active';

  // Generate the square matrix.
  const rowElements = [];
  for (let rowId = 0; rowId < session.height; rowId++) {
    const columnElements = [];

    // Generate squares per row.
    for (let columnId = 0; columnId < session.width; columnId++) {
      const squareIndex = convertCoordinateToIndex(columnId, rowId);
      const rigged = mineIndexes.includes(squareIndex);

      // Scan the neighbour squares.
      // This loop is ensuring that the range is not exceeding.
      let squareLabel = '';
      let neighbourMineCount: number = 0;
      for (let neighbourIndex of findNeighbourIndexes(columnId, rowId)) {
        if (rigged) {
          squareLabel = '💣';
        } else {
          neighbourMineCount += mineIndexes.includes(neighbourIndex) ? 1 : 0;
          squareLabel = neighbourMineCount === 0 ? '' : `${neighbourMineCount}`
        }
      }

      columnElements.push(
        <MinefieldSquare
          key={`${squareIndex}@${Date.now()}`}
          x={columnId}
          y={rowId}
          mode={squareModes[squareIndex]}
          enabled={isActiveField}
          cheatModeEnabled={cheatModeEnabled}
          rigged={rigged}
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
        <span style={{flex: 1, display: 'flex', maxWidth: '25%', justifyContent: 'flex-start'}}>
          <button onClick={onSuspend}>&lt;</button>
          {/* <button onClick={toggleCheatMode}>{cheatModeEnabled ? 'Disable' : 'Enable'} Cheat Mode</button> */}
        </span>
        <span className="flex-spacer"></span>
        <span className="session-id">Level {session.mineDensity / 5} ({windowWidth} x {windowHeight})</span>
        <span className="flex-spacer"></span>
        <span style={{flex: 1, display: 'flex', maxWidth: '25%', justifyContent: 'flex-end'}}>
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