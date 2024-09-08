import { authenticator } from "./Authenticator";
import { backendBaseUrl, fetchMode } from "./config";
import MainWindowMode from "./MainWindowMode";
import { Coordinate, Move, Session } from "./models";

class SessionManager {
    async create(session: Session): Promise<Session | null> {
        const expectedMineCount = Math.ceil(session.width * session.height * session.mineDensity / 100);
        const mineCoordinateMap = new Map<string, Coordinate>();

        while (mineCoordinateMap.size < expectedMineCount) {
            const x: number = Math.floor(Math.random() * session.width);
            const y: number = Math.floor(Math.random() * session.height);
            let locationKey = `${x},${y}`;
            if (mineCoordinateMap.has(locationKey)) {
                continue;
            } else {
                mineCoordinateMap.set(locationKey, { x: x, y: y });
            }
        }

        const mineCoordinates: Coordinate[] = [];
        mineCoordinateMap.forEach((v, _) => mineCoordinates.push(v));
        mineCoordinates.sort((a, b) => {
            if (a.y === b.y)
                return (a.x < b.x) ? -1 : 1;
            else
                return a.y < b.y ? -1 : 1;
        });

        session.mineCoordinates = mineCoordinates;

        const response = await fetch(
            `${backendBaseUrl}/api/games/`,
            {
                headers: {Authorization: `Bearer ${authenticator.getAccessToken()}`},
                method: 'post',
                mode: fetchMode,
                body: JSON.stringify(session),
            }
        );

        if (response.status !== 200) {
            const error = await response.text();
            throw `Fail to create (status=${response.status}, error=${error})`;
        }

        const data: Session = await response.json();
        return data;
    }

    async list(): Promise<Session[]> {
        const response = await fetch(
            `${backendBaseUrl}/api/games/`,
            {
                headers: {Authorization: `Bearer ${authenticator.getAccessToken()}`},
                method: 'get',
                mode: fetchMode,
            }
        );

        if (response.status !== 200) {
            const error = await response.text();
            throw `Fail to list (status=${response.status}, error=${error})`;
        }

        const data: Session[] = await response.json();
        return data;
    }

    async get(id: string): Promise<Session | null> {
        const response = await fetch(
            `${backendBaseUrl}/api/games/${id}`,
            {
                headers: {Authorization: `Bearer ${authenticator.getAccessToken()}`},
                method: 'get',
                mode: fetchMode,
            }
        );

        if (response.status !== 200) {
            const error = await response.text();
            throw `Fail to get a game session (status=${response.status}, error=${error})`;
        }

        const data: Session = await response.json();
        return data;
    }

    async setState(id: string, state: MainWindowMode) {
        const getResponse = await fetch(
            `${backendBaseUrl}/api/games/${id}`,
            {
                headers: {Authorization: `Bearer ${authenticator.getAccessToken()}`},
                method: 'get',
                mode: fetchMode,
            }
        );

        if (getResponse.status !== 200) {
            const error = await getResponse.text();
            alert(`Fail to get the game session (status=${getResponse.status}, error=${error})`);
            return;
        }

        const session: Session = await getResponse.json();
        session.state = state;

        const updateResponse = await fetch(
            `${backendBaseUrl}/api/games/${id}`,
            {
                headers: {Authorization: `Bearer ${authenticator.getAccessToken()}`},
                method: 'put',
                mode: fetchMode,
                body: JSON.stringify(session),
            }
        );

        if (updateResponse.status !== 200) {
            const error = await updateResponse.text();
            throw `Fail to update the game session (status=${updateResponse.status}, error=${error})`;
        }
    }

    async addMove(id: string, userId: number, x: number, y: number, state: string) {
        const move: Move = {
            gameId: id,
            userId: userId,
            x: x,
            y: y,
            state: state,
        };

        const response = await fetch(
            `${backendBaseUrl}/api/moves/`,
            {
                headers: {Authorization: `Bearer ${authenticator.getAccessToken()}`},
                method: 'post',
                mode: fetchMode,
                body: JSON.stringify(move),
            }
        );

        if (response.status !== 200) {
            const error = await response.text();
            console.error(`Fail to create a move (status=${response.status}, error=${error})`);
            return null;
        }
    }

    async getMoves(id: string): Promise<Move[]> {
        const response = await fetch(
            `${backendBaseUrl}/api/moves/?filter_gameId=${id}`,
            {
                headers: {Authorization: `Bearer ${authenticator.getAccessToken()}`},
                method: 'get',
                mode: fetchMode,
            }
        );

        if (response.status !== 200) {
            const error = await response.text();
            throw `Fail to list moves (status=${response.status}, error=${error})`
        }

        const data: Move[] = await response.json();
        return data;
    }
}

function createDefaultSession(): Session {
    return {
        id: '',
        userId: -1,
        width: 10,
        height: 10,
        mineDensity: 25,
    }
}

const sessionManager = new SessionManager();

export { sessionManager, createDefaultSession };
export type { Session };
