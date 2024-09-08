import { useEffect, useState } from 'react';
import './App.scss';
import './screens/new-game/NewGameScreen'
import NewGameScreen from './screens/new-game/NewGameScreen';
import { createDefaultSession, Session, sessionManager } from './common/SessionManager';
import MinefieldScreen from './screens/mindfield/MinefieldScreen';
import { authenticator } from './common/Authenticator';
import LoginScreen from './screens/login/LoginScreen';
import GameListScreen from './screens/game-list/GameListScreen';


enum Mode {
  HOME = 'home',
  LOGIN = 'login',
  LOGOUT = 'logout',
  MINEFIELD = 'minefield',
  STANDBY = 'standby',
  UNKNOWN = 'unknown',
}


var fixedSchedulerId: any | null = null;


interface ComponentState {
  accessTokenTtl: number,
  mode: Mode,
  authMode: Mode,
  session: Session | null,
}


function App() {
  const [mode, setMode] = useState(Mode.STANDBY);
  const [submode, setSubMode] = useState('game-new');
  const [componentState, setComponentState] = useState<ComponentState>({
    accessTokenTtl: -1,
    mode: Mode.STANDBY,
    authMode: Mode.HOME,
    session: null,
  });

  const startNewGame = (newSession: Session) => {
    setComponentState({
      ...componentState,
      authMode: Mode.MINEFIELD,
      session: newSession,
    });
    setMode(Mode.MINEFIELD);
  }

  const onResumeButtonClick = () => {
    setComponentState({
      ...componentState,
      authMode: Mode.MINEFIELD,
    });
    setMode(Mode.MINEFIELD);
  }

  const onPause = () => {
    setComponentState({
      ...componentState,
      authMode: Mode.HOME,
    });
    setMode(Mode.HOME);
  }

  const checkAuthentication = () => {
    authenticator.checkAuthentication()
      .then(tokenTtl => {
        if (tokenTtl < 300) {
          authenticator.refreshTokens()
            .then(response => {
              if (response === null) {
                clearSession();
              } else {
                authenticator.saveSession(response);

                setComponentState({
                  ...componentState,
                  accessTokenTtl: response.expires_in,
                });
                setMode(componentState.authMode);
              }
            });
        } else if (tokenTtl < 0) {
          authenticator.clearTokens();
          setMode(Mode.LOGIN);
        } else {
          setMode(componentState.authMode);
        }

        setComponentState({
          ...componentState,
          accessTokenTtl: tokenTtl,
        });
      });
  }

  const onAuthSucceeded = (tokenTtl: number) => {
    setComponentState({
      ...componentState,
      accessTokenTtl: tokenTtl,
    });

    setMode(componentState.authMode);
  }

  const clearSession = () => {
    if (fixedSchedulerId !== null) {
      clearInterval(fixedSchedulerId);
      fixedSchedulerId = null;
    }

    setComponentState({
      ...componentState,
      accessTokenTtl: -1,
    });
    setMode(Mode.LOGIN);

    authenticator.clearTokens();
  }

  const onSignOut = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (componentState.accessTokenTtl === null || componentState.accessTokenTtl < 0) {
      return;
    }

    if (window.confirm('Are you sure?')) {
      clearSession();
    }
  }

  const selectGame = (id: string) => {
    sessionManager.get(id)
      .then(session => {
        const nextMode = session === null ? Mode.HOME : Mode.MINEFIELD;
        setMode(nextMode);
        setComponentState({
          ...componentState,
          authMode: nextMode,
          session: session,
        });
      });
  }

  useEffect(() => {
    if (authenticator.hasTokens()) {
      checkAuthentication();

      if (componentState.session === null) {
        setTimeout(() => setMode(Mode.HOME), 1000);
      }
    } else {
      setTimeout(() => setMode(Mode.LOGIN), 1000);
    }
  }, []);

  const currentMode = mode;

  switch (currentMode) {
    case Mode.STANDBY:
      return (
        <div className="app-container" data-mode={currentMode}>
          Initializing...
        </div>
      );
    case Mode.LOGIN:
      return (
        <div className="app-container" data-mode={currentMode}>
          <LoginScreen onAuthSucceeded={onAuthSucceeded} />
        </div>
      );
    case Mode.LOGOUT:
      return (
        <div className="app-container" data-mode={currentMode}>
          Signing out...
        </div>
      );
    case Mode.HOME:
      return (
        <div className="app-container" data-mode={currentMode} data-sub-mode={submode}>
          <div className="app-controls">
            <button className='resume-button' disabled={componentState.session === null} onClick={onResumeButtonClick}>← Resume the game</button>
            <div className='flex-spacer'></div>
            <button className={submode === 'game-new' ? 'active' : ''} onClick={() => setSubMode('game-new')}>New Game</button>
            <button className={submode !== 'game-new' ? 'active' : ''} onClick={() => setSubMode('game-list')}>Most Recent Games</button>
            <div className='flex-spacer'></div>
            <button className='sign-out-button' onClick={onSignOut}>Sign out</button>
          </div>
          {submode === 'game-new' ? <NewGameScreen onStart={startNewGame} /> : <GameListScreen onSelect={selectGame}/>}

        </div>
      );
    case Mode.MINEFIELD:
      return (
        <div className="app-container" data-mode={currentMode}>
          {componentState.session ? <MinefieldScreen session={componentState.session} onPause={onPause} /> : 'Re-initializing...'}
        </div>
      );
    default:
      return <div>Invalid State (mode = {currentMode})</div>;
  }
}

export default App;
