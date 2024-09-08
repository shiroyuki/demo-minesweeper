import { backendBaseUrl, fetchMode } from "./config";


interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  token_type: string;
}

class Authenticator {
  constructor() {

  }

  getAccessToken(): string {
    return sessionStorage.getItem('access_token') || '';
  }

  getRefreshToken(): string {
    return sessionStorage.getItem('refresh_token') || '';
  }

  hasTokens(): boolean {
    const accessToken = this.getAccessToken();
    const refreshToken = this.getRefreshToken();

    return accessToken.length > 0 && refreshToken.length > 0;
  }

  clearTokens() {
    sessionStorage.setItem('access_token', '');
    sessionStorage.setItem('refresh_token', '');
  }

  /**
   * Check the authentication
   * @param allowRetry Allow retry when the verification fails.
   * @returns Positive number for the token TTL, Negative for invalid session.
   */
  async checkAuthentication(allowRetry?: boolean): Promise<number> {
    if (allowRetry === undefined) {
      allowRetry = true;
    }

    if (!this.hasTokens()) {
      return -1;
    }

    const accessToken = this.getAccessToken();

    let verificationResponse = await fetch(
      `${backendBaseUrl}/api/me`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
        mode: fetchMode,
      }
    );

    if (verificationResponse.status === 400) {
      if (allowRetry) {
        const refreshTokenResponse = await this.refreshTokens();
        if (refreshTokenResponse !== null) {
          authenticator.saveSession(refreshTokenResponse);

          return await this.checkAuthentication(false);
        } else {
          return -1;
        }
      } else {
        return -1;
      }
    } else if (verificationResponse.status !== 200) {
      return -1;
    }

    let verification: {authorized: boolean, claims?: {exp: number}} = await verificationResponse.json();

    if (verification.authorized) {
      if (verification.claims !== undefined) {
        return verification.claims.exp - (Date.now() / 1000);
      } else {
        return -1;
      }
    } else {
      return -1;
    }
  }

  async refreshTokens(): Promise<TokenResponse | null> {
    const refreshToken = this.getRefreshToken();

    if (refreshToken.length === 0) {
      authenticator.clearTokens();

      return null;
    }

    const postData = new FormData();
    postData.append('grant_type', 'refresh_token');
    postData.append('refresh_token', refreshToken);

    const response = await fetch(
      `${backendBaseUrl}/api/oauth/refresh`,
      {
        method: 'POST',
        body: postData,
        mode: fetchMode,
      }
    );

    if (response.status !== 200) {
      return null;
    }

    const data: TokenResponse = await response.json();
    return data;
  }

  async authenticate(username: string, password: string): Promise<TokenResponse | null> {
    const postData = new FormData();
    postData.append('grant_type', 'client_credentials');
    postData.append('client_id', username);
    postData.append('client_secret', password);

    try {
      const response = await fetch(
        `${backendBaseUrl}/api/oauth/token`,
        {
          method: 'POST',
          body: postData,
          mode: fetchMode,
        }
      );

      if (response.status === 200) {
        const data: TokenResponse = await response.json();
        return data;
      } else {
        const data: {error: string} = await response.json();
        alert(`Failed to sign you in. (code: ${data.error})`);

        return null;
      }
    } catch (e) {
      console.error('Error:', e);

      return null;
    }
  }

  saveSession(data: TokenResponse) {
    sessionStorage.setItem('access_token', data.access_token);
    sessionStorage.setItem('refresh_token', data.refresh_token);
  }
}

const authenticator = new Authenticator();

export {authenticator, Authenticator}
export type {TokenResponse}