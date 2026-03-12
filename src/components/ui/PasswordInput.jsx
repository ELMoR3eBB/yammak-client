import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "../../helpers/icons";

import "../../styles/ui/password_input.css";

function PasswordInput({
  label = "Password",
  required = false,
  value,
  onChange,
  inputProps = {},
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <label>
        {label} {required && <span>*</span>}
      </label>

      <div className="password-field">
        <input
          type={showPassword ? "text" : "password"}
          className="input"
          value={value}
          onChange={onChange}
          {...inputProps}
        />

        <button
          type="button"
          className={`eye ${showPassword ? "is-on" : "is-off"}`}
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          <span className="eye-swap">
            {showPassword ? (
              <EyeOffIcon className="eye-icon" />
            ) : (
              <EyeIcon className="eye-icon" />
            )}
          </span>
        </button>
      </div>
    </div>
  );
}

export default PasswordInput;
