import { useState } from "react";
import { createDefaultSession, Session, sessionManager } from "../../common/SessionManager";
import './LoginScreen.scss';
import { authenticator, TokenResponse } from "../../common/Authenticator";


interface LoginScreenProps {
  onAuthSucceeded: (tokenTtl: number) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onAuthSucceeded }) => {
  const [formData, setFormData] = useState({username: '', password: ''});
  const [inFlight, setiInFlight] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (value.trim().length === 0) {
      return;
    }

    setFormData((prevData) => ({
      ...prevData,
      [name]: value
    }));
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setiInFlight(true);

    const response: TokenResponse | null = await authenticator.authenticate(formData.username, formData.password);

    if (response !== null) {
      authenticator.saveSession(response);

      setiInFlight(false);
      onAuthSucceeded(response.expires_in);
    }
  }

  if (inFlight) {
    return (
      <form className="login-form" onSubmit={onSubmit}>
        Signing in...
      </form>
    );
  } else {
    return (
      <form className="login-form" onSubmit={onSubmit}>
        <h1>Hello there! Please sign in first.</h1>
        <div className="form-control">
          <label htmlFor="login-username">Username</label>
          <input id="login-username"
            type="text"
            name="username"
            required={true}
            value={formData.username}
            onChange={handleChange} />
        </div>
        <div className="form-control">
          <label htmlFor="login-password">Password</label>
          <input id="login-password"
            type="password"
            name="password"
            required={true}
            value={formData.password}
            onChange={handleChange} />
        </div>
        <button type="submit">Sign in</button>
      </form>
    );
  }
}

export default LoginScreen;