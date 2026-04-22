import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiCheck, FiEye, FiEyeOff, FiX } from "react-icons/fi";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

const PASSWORD_RULES = [
  { id: "len", label: "At least 8 characters", test: (v) => v.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { id: "lower", label: "One lowercase letter", test: (v) => /[a-z]/.test(v) },
  { id: "digit", label: "One number", test: (v) => /\d/.test(v) },
  {
    id: "special",
    label: "One special character",
    test: (v) => /[!@#$%^&*(),.?":{}|<>\[\]'\\/_+=;`~-]/.test(v),
  },
];

function getStrength(password) {
  return PASSWORD_RULES.filter((rule) => rule.test(password)).length;
}

function PasswordStrength({ password }) {
  if (!password) return null;

  const score = getStrength(password);
  const label = ["", "Very weak", "Weak", "Fair", "Good", "Strong"][score];

  return (
    <div className="pw-strength">
      <div className="pw-bars">
        {[1, 2, 3, 4, 5].map((bar) => (
          <span key={bar} className={`pw-bar ${score >= bar ? "pw-bar--active" : ""}`} />
        ))}
        <span className="pw-label">{label}</span>
      </div>
      <ul className="pw-rules">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li key={rule.id} className={ok ? "pw-rule pw-rule--ok" : "pw-rule"}>
              {ok ? <FiCheck size={12} /> : <FiX size={12} />}
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  label,
  autoComplete = "current-password",
  placeholder = "Enter your password",
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="auth-form-group">
      {label ? <label htmlFor={id}>{label}</label> : null}
      <div className="auth-input-wrap">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          className="auth-eye-btn"
          onClick={() => setVisible((current) => !current)}
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <FiEyeOff size={16} /> : <FiEye size={16} />}
        </button>
      </div>
    </div>
  );
}

function Message({ variant, children }) {
  if (!children) return null;
  return <div className={`auth-message auth-message--${variant}`}>{children}</div>;
}

function LoginView({ goSignup, goForgot }) {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password, remember);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-form-view">
      <p className="auth-kicker">ComfortSync</p>
      <h1 className="auth-title">Welcome back</h1>
      <p className="auth-sub">Sign in to access your workspace.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-form-group">
          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@comfortsync.ai"
            autoComplete="email"
            required
          />
        </div>

        <div className="auth-form-group">
          <div className="auth-label-row">
            <label htmlFor="login-password">Password</label>
            <button type="button" className="auth-link-btn" onClick={goForgot}>
              Forgot password?
            </button>
          </div>
          <PasswordInput
            id="login-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            label=""
          />
        </div>

        <label className="auth-checkbox">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          <span>Remember me</span>
        </label>

        <Message variant="error">{error}</Message>

        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? <span className="auth-spinner" /> : "Login"}
        </button>
      </form>

      <p className="auth-switch">
        Don&apos;t have an account?{" "}
        <button type="button" className="auth-link-btn auth-link-btn--em" onClick={goSignup}>
          Create account
        </button>
      </p>
    </div>
  );
}

function SignupView({ goLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!agreed) {
      setError("You must agree before creating an account.");
      return;
    }

    if (getStrength(password) < 5) {
      setError("Use a stronger password that satisfies every rule below.");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await api.post("/api/auth/register", { name, email, password });
      setSuccess("Account created. You can sign in now.");
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-form-view">
      <p className="auth-kicker">Create account</p>
      <h1 className="auth-title">Join ComfortSync</h1>
      <p className="auth-sub">Create your account to get started.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-form-group">
          <label htmlFor="signup-name">Full name</label>
          <input
            id="signup-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter your name"
            required
          />
        </div>

        <div className="auth-form-group">
          <label htmlFor="signup-email">Email address</label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@comfortsync.ai"
            required
          />
        </div>

        <PasswordInput
          id="signup-password"
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          placeholder="Create a secure password"
        />
        <PasswordStrength password={password} />

        <label className="auth-checkbox">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
          />
          <span>I agree to continue.</span>
        </label>

        <Message variant="error">{error}</Message>
        <Message variant="success">{success}</Message>

        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? <span className="auth-spinner" /> : "Create account"}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account?{" "}
        <button type="button" className="auth-link-btn auth-link-btn--em" onClick={goLogin}>
          Sign in
        </button>
      </p>
    </div>
  );
}

function ForgotView({ goLogin, goVerify, setResetEmail }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/api/auth/forgot-password", { email });
      setResetEmail(email);
      setSuccess("Reset code sent.");
      setTimeout(() => goVerify(), 1000);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to send reset code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-form-view">
      <button type="button" className="auth-back-btn" onClick={goLogin}>
        <FiArrowLeft size={16} /> Back to login
      </button>

      <p className="auth-kicker">Password reset</p>
      <h1 className="auth-title">Forgot password?</h1>
      <p className="auth-sub">Enter your email and we will send you a reset code.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-form-group">
          <label htmlFor="forgot-email">Email address</label>
          <input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@comfortsync.ai"
            required
          />
        </div>

        <Message variant="error">{error}</Message>
        <Message variant="success">{success}</Message>

        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? <span className="auth-spinner" /> : "Send reset code"}
        </button>
      </form>
    </div>
  );
}

function VerifyView({ goLogin, resetEmail }) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const inputsRef = useRef([]);

  const handleDigit = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...code];
    next[index] = value;
    setCode(next);
    if (value && index < 5) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...pasted.split(""), ...Array(6).fill("")].slice(0, 6);
    setCode(next);
    inputsRef.current[Math.min(pasted.length, 5)]?.focus();
    event.preventDefault();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const fullCode = code.join("");

    if (fullCode.length !== 6) {
      setError("Enter the full six-digit verification code.");
      return;
    }

    if (getStrength(newPassword) < 5) {
      setError("Choose a stronger password that satisfies every rule below.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await api.post("/api/auth/reset-password", {
        email: resetEmail,
        code: fullCode,
        new_password: newPassword,
      });
      setSuccess("Password updated. Redirecting to login.");
      setTimeout(() => goLogin(), 1500);
    } catch (err) {
      setError(err.response?.data?.detail || "Password reset failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-form-view">
      <button type="button" className="auth-back-btn" onClick={goLogin}>
        <FiArrowLeft size={16} /> Back to login
      </button>

      <p className="auth-kicker">Verification</p>
      <h1 className="auth-title">Enter reset code</h1>
      <p className="auth-sub">
        We sent a code to <strong>{resetEmail || "your email"}</strong>.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="otp-row" onPaste={handlePaste}>
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputsRef.current[index] = element;
              }}
              className="otp-box"
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(event) => handleDigit(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
            />
          ))}
        </div>

        <PasswordInput
          id="reset-password"
          label="New password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
          placeholder="Create a new password"
        />
        <PasswordStrength password={newPassword} />

        <Message variant="error">{error}</Message>
        <Message variant="success">{success}</Message>

        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? <span className="auth-spinner" /> : "Reset password"}
        </button>
      </form>
    </div>
  );
}

export default function Auth({ initialView = "login" }) {
  const [view, setView] = useState(initialView);
  const [resetEmail, setResetEmail] = useState("");
  const [animKey, setAnimKey] = useState(0);

  const go = (nextView) => {
    setView(nextView);
    setAnimKey((value) => value + 1);
  };

  return (
    <main className="auth-root">
      <section className="auth-shell">
        <div className="auth-side">
          <img src="/comfortsynclogo.png" alt="ComfortSync logo" className="auth-logo" />
          <p className="auth-side-kicker">Indoor comfort platform</p>
          <h2 className="auth-side-title">Healthy spaces, simpler monitoring.</h2>
          <p className="auth-side-copy">
            Track indoor conditions, keep teams comfortable, and respond faster when air quality
            shifts.
          </p>
        </div>

        <section className="auth-panel" key={animKey}>
          {view === "login" && <LoginView goSignup={() => go("signup")} goForgot={() => go("forgot")} />}
          {view === "signup" && <SignupView goLogin={() => go("login")} />}
          {view === "forgot" && (
            <ForgotView
              goLogin={() => go("login")}
              goVerify={() => go("verify")}
              setResetEmail={setResetEmail}
            />
          )}
          {view === "verify" && <VerifyView goLogin={() => go("login")} resetEmail={resetEmail} />}
        </section>
      </section>
    </main>
  );
}
