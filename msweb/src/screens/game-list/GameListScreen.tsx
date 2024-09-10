import { useEffect, useState } from "react";
import { sessionManager } from "../../common/SessionManager";
import { Session } from '../../common/models';
import './GameListScreen.scss';
import SessionState from "../../common/SessionState";

interface GameListScreenProps {
  onSelect: (id: string) => void;
}

function getElaspedTime(game: Session): string {
  const currentTime = Date.now() / 1000;  // convert to seconds
  const diff = game.createTime === undefined ? 0 : currentTime - game.createTime;

  const dividers = [60.0, 60.0, 24.0];
  const units = ['second', 'minute', 'hour', 'day'];

  let remainder = Math.floor(diff);
  let unitIndex = 0

  for (let unitDivider of dividers) {
    if (remainder > unitDivider) {
      remainder = Math.floor(remainder / unitDivider);
      unitIndex++;
    } else {
      break;
    }
  }

  return `${remainder} ${units[unitIndex]}${remainder > 1 ? 's' : ''} ago`;
}

const GameListScreen: React.FC<GameListScreenProps> = ({ onSelect }) => {
  const [inFlight, setInFlight] = useState(false);
  const [games, setGames] = useState<Session[]>([]);

  useEffect(() => {
    if (inFlight) {
      return;
    }

    setInFlight(true);
    sessionManager.list()
      .then(sessions => {
        const updatedList: Session[] = [];
        sessions.forEach((s: Session) => updatedList.push(s));
        setGames(updatedList);
        setInFlight(false);
      })
  }, []);

  if (inFlight) {
    return <span>Loading...</span>;
  }

  if (games.length === 0) {
    return <span>No recent games</span>;
  }

  return (
    <div className="game-list">
      <h1>Most recent games</h1>
      {
        games
          .filter(game => game.id !== undefined)
          .slice(0, 3)
          .flatMap(game => {
            return (
              <div key={game.id} className="game-item" onClick={() => onSelect(game.id)}>
                <span className="state">
                  { game.state === SessionState.EXPLODED ? '💣' : (game.state === SessionState.CLEARED ? '✅' : '⏳') }
                </span>
                <span className="meta">
                  {/* <span className="id">{game.id}</span> */}
                  <span className="level">Level {game.mineDensity / 5}</span>
                  <span className="dimension">{game.width} x {game.height}</span>
                  <span className="elapsed-time">{getElaspedTime(game)}</span>
                </span>
              </div>
            )
          })
      }
    </div>
  )
}

export default GameListScreen;