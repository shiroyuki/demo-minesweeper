import { authenticator } from "./Authenticator";
import { backendBaseUrl, fetchMode } from "./config";
import { Session } from "./models";

class SessionManager {
    async create(session: Session): Promise<Session | null> {
        session.mineCoordinates = [];

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
}

function createDefaultSession(): Session {
    return {
        id: '',
        userId: -1,
        width: 20,
        height: 20,
        mineDensity: 25,
    }
}

const sessionManager = new SessionManager();

export { sessionManager, createDefaultSession };
export type { Session };
