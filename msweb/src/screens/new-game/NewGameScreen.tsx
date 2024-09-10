import { useState } from "react";
import { createDefaultSession, Session, sessionManager } from "../../common/SessionManager";
import './NewGameScreen.scss';


interface NewGameScreenProps {
  onStart: (session: Session) => void;
}

const NewGameScreen: React.FC<NewGameScreenProps> = ({ onStart }) => {
  const [inFlight, setInFlight] = useState(false);
  const [newGameParameters, setFormData] = useState(createDefaultSession());

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (value.trim().length === 0) {
      return;
    }

    setFormData((prevData) => ({
      ...prevData,
      [name]: parseInt(value, 10)
    }));
  };

  const onNewGameStartSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setInFlight(true);
    const session = await sessionManager.create(newGameParameters);
    setInFlight(false)
    if (session !== null) {
      onStart(session);
    }
  }

  if (inFlight) {
    return <span>Loading...</span>;
  }

  return (
    <form className="new-game-form" onSubmit={onNewGameStartSubmit}>
      <h1>New Game</h1>
      <div className="form-control">
        <label htmlFor="new-game-width">Width</label>
        <input id="new-game-width"
          type="range"
          min={10}
          max={200}
          step={5}
          name="width"
          value={newGameParameters.width}
          onChange={handleChange} />
        <div className="help">{newGameParameters.width}</div>
      </div>
      <div className="form-control">
        <label htmlFor="new-game-height">Height</label>
        <input id="new-game-height"
          type="range"
          min={10}
          max={200}
          step={5}
          name="height"
          value={newGameParameters.height}
          onChange={handleChange} />
        <div className="help">{newGameParameters.height}</div>
      </div>
      <div className="form-control">
        <label htmlFor="new-game-mine-density">Mine Density</label>
        <input id="new-game-mine-density"
          type="range"
          min={5}
          max={50}
          step={5}
          name="mineDensity"
          value={newGameParameters.mineDensity}
          onChange={handleChange} />
      </div>
      <button type="submit">Start</button>
    </form>
  );
}

export default NewGameScreen;