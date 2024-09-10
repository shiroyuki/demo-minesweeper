import { authenticator } from "./Authenticator";
import { backendBaseUrl, fetchMode } from "./config";

interface GameInfo {
  id: string;
  width: number;
  height: number;
  mine_density: number;
  create_time: number;
  state: string;
}

interface SimplifiedMove {
  x: number;
  y: number;
  state: string;
}

interface Hint {
  // row-to-column matrix, i.e., array<row, column>
  nearby_mine_count: number[][];
}

interface GameSnapshot {
  info: GameInfo;
  moves: SimplifiedMove[];
  hint: Hint;
}

class GameEngine {
  async get(id: string): Promise<GameSnapshot> {
    const response = await fetch(
      `${backendBaseUrl}/api/rpc/snapshot/${id}`,
      {
        headers: { Authorization: `Bearer ${authenticator.getAccessToken()}` },
        method: 'get',
        mode: fetchMode,
      }
    )

    if (response.status !== 200) {
      const error = await response.text()
      throw `Fail to get the snapshot (status=${response.status}, error=${error})`
    }

    const data: GameSnapshot = await response.json()
    return data
  }

  async visit(id: string, x: number, y: number, state?: string): Promise<GameSnapshot> {
    const response = await fetch(
      `${backendBaseUrl}/api/rpc/visit/${id}`,
      {
        headers: { Authorization: `Bearer ${authenticator.getAccessToken()}` },
        method: 'post',
        mode: fetchMode,
        body: JSON.stringify({ x: x, y: y, state: state }),
      }
    )

    if (response.status !== 200) {
      const error = await response.text()
      throw `Fail to evalute/record the visit (status=${response.status}, error=${error})`
    }

    const data: GameSnapshot = await response.json()
    return data
  }
}

const gameEngine = new GameEngine();

export { gameEngine }
export type { GameSnapshot }