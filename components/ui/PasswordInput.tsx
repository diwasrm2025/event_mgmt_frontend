"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";

export function PasswordInput({ id, className, placeholder = "Enter your password", disabled, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input-wrap">
      <input {...props} id={inputId} className={className} type={visible ? "text" : "password"} placeholder={placeholder} disabled={disabled} />
      <button
        type="button"
        className="password-visibility-toggle"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-controls={inputId}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
        disabled={disabled}
        onClick={() => setVisible(current => !current)}
      >
        <FontAwesomeIcon icon={visible ? faEyeSlash : faEye} />
      </button>
    </div>
  );
}
