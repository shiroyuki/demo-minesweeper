import SessionState from "./SessionState";

interface Coordinate {
  x: number;
  y: number;
}

interface Session {
  id: string;
  userId: number;
  width: number;
  height: number;
  mineDensity: number;
  mineCoordinates?: Coordinate[];
  state?: SessionState;
  createTime?: number;
}

interface Move {
  id?: number;
  gameId: string;
  userId: number;
  x: number;
  y: number;
  state: string;
  createTime?: number;
}

export type {Coordinate, Session, Move}