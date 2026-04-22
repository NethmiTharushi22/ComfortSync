import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import DashboardHeader from '../components/DashboardHeader'
import DashboardSidebar from '../components/DashboardSidebar'
import './Dashboard.css'
import './Settings.css'

const PASSWORD_RULES = [
  { id: 'len', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { id: 'upper', label: 'One uppercase letter (A-Z)', test: (v) => /[A-Z]/.test(v) },
  { id: 'lower', label: 'One lowercase letter (a-z)', test: (v) => /[a-z]/.test(v) },
  { id: 'digit', label: 'One number (0-9)', test: (v) => /\d/.test(v) },
  { id: 'special', label: 'One special character (!@#...)', test: (v) => /[!@#$%^&*(),.?":{}|<>\[\]'\\/_+=;`~\-]/.test(v) },
]

function getPasswordScore(password) {
  return PASSWORD_RULES.filter((rule) => rule.test(password)).length
}

function PasswordRequirements({ password }) {
  if (!password) return null

  const score = getPasswordScore(password)
  const label = ['', 'Very weak', 'Weak', 'Fair', 'Good', 'Strong'][score]
  const colorClass = ['', 'pw-s1', 'pw-s2', 'pw-s3', 'pw-s4', 'pw-s5'][score]

  return (
    <div className="pw-strength">
      <div className="pw-bars">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`pw-bar ${score >= i ? colorClass : ''}`} />
        ))}
        <span className={`pw-label ${colorClass}`}>{label}</span>
      </div>
      <ul className="pw-rules">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password)
          return (
            <li key={rule.id} className={ok ? 'pw-rule--ok' : 'pw-rule--fail'}>
              <span className="pw-rule-icon" aria-hidden="true">{ok ? '+' : '-'}</span>
              {rule.label}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const EyeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const EyeOffIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

function PasswordInput({ id, name, placeholder, value, onChange, required }) {
  const [show, setShow] = useState(false)

  return (
    <div className="pw-input-wrap">
      <input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete="off"
      />
      <button
        type="button"
        className="pw-eye-btn"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const { user, isAuthenticated, updateUser, logout } = useAuth()
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    phone: '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' })

  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarMsg, setAvatarMsg] = useState({ type: '', text: '' })

  const [pwForm, setPwForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [pwErrors, setPwErrors] = useState({})
  const [changingPw, setChangingPw] = useState(false)
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' })

  useEffect(() => {
    if (user) {
      const parts = (user.name || '').split(' ')
      setForm({
        first_name: parts[0] || '',
        last_name: parts.slice(1).join(' ') || '',
        username: user.username || '',
        email: user.email || '',
        phone: user.phone || '',
      })
    }
  }, [user])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: '' }))
    setProfileMsg({ type: '', text: '' })
  }

  const handlePhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
    setForm((prev) => ({ ...prev, phone: digits }))
    if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: '' }))
    setProfileMsg({ type: '', text: '' })
  }

  const validateProfile = () => {
    const errs = {}

    if (!form.first_name.trim()) {
      errs.first_name = 'First name is required.'
    }
    if (!form.username.trim()) {
      errs.username = 'Username is required.'
    }
    if (form.phone && !/^\d{10}$/.test(form.phone)) {
      errs.phone = 'Phone must be exactly 10 digits.'
    }

    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!validateProfile()) return

    setSaving(true)
    setProfileMsg({ type: '', text: '' })
    try {
      const { data } = await api.patch('/api/settings/profile', {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        username: form.username.trim(),
        phone: form.phone,
      })
      updateUser(data)
      setProfileMsg({ type: 'success', text: 'Profile updated successfully!' })
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to update profile.'
      setProfileMsg({ type: 'error', text: msg })
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      setAvatarMsg({ type: 'error', text: 'Please choose a JPEG, PNG, WebP or GIF image.' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarMsg({ type: 'error', text: 'Image must be smaller than 5 MB.' })
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)
    setAvatarMsg({ type: '', text: '' })
    setAvatarUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/api/settings/avatar/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      updateUser(data)
      setAvatarPreview(null)
      setAvatarMsg({ type: 'success', text: 'Profile picture updated!' })
    } catch (err) {
      setAvatarPreview(null)
      const msg = err?.response?.data?.detail || 'Upload failed. Please try again.'
      setAvatarMsg({ type: 'error', text: msg })
    } finally {
      setAvatarUploading(false)
      e.target.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    setAvatarMsg({ type: '', text: '' })
    setAvatarUploading(true)
    try {
      const { data } = await api.patch('/api/settings/avatar', { avatar_url: '' })
      updateUser(data)
      setAvatarPreview(null)
      setAvatarMsg({ type: 'success', text: 'Profile picture removed.' })
    } catch {
      setAvatarMsg({ type: 'error', text: 'Failed to remove picture.' })
    } finally {
      setAvatarUploading(false)
    }
  }

  const handlePwChange = (e) => {
    const { name, value } = e.target
    setPwForm((prev) => ({ ...prev, [name]: value }))
    if (pwErrors[name]) setPwErrors((prev) => ({ ...prev, [name]: '' }))
    setPwMsg({ type: '', text: '' })
  }

  const validatePassword = () => {
    const errs = {}
    const score = getPasswordScore(pwForm.new_password)

    if (!pwForm.current_password) {
      errs.current_password = 'Enter your current password.'
    }
    if (score < 5) {
      errs.new_password = 'Password must satisfy all requirements below.'
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      errs.confirm_password = 'Passwords do not match.'
    }

    setPwErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!validatePassword()) return

    setChangingPw(true)
    setPwMsg({ type: '', text: '' })
    try {
      await api.post('/api/settings/change-password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      })
      setPwMsg({ type: 'success', text: 'Password changed successfully!' })
      setPwForm({ current_password: '', new_password: '', confirm_password: '' })
      setPwErrors({})
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to change password.'
      setPwMsg({ type: 'error', text: msg })
    } finally {
      setChangingPw(false)
    }
  }

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'
  const displayAvatar = avatarPreview || user?.avatar_url
  const isNewPasswordStrong = getPasswordScore(pwForm.new_password) === 5
  const isPasswordFormValid =
    !!pwForm.current_password &&
    !!pwForm.new_password &&
    !!pwForm.confirm_password &&
    isNewPasswordStrong &&
    pwForm.new_password === pwForm.confirm_password

  const handleLogout = async () => {
    await logout()
    navigate('/auth', { replace: true })
  }

  return (
    <main className="dashboard-root">
      <section className="dashboard-shell">
        <DashboardSidebar onLogout={handleLogout} activeTab="Settings" onNavigate={navigate} />

        <section className="dashboard-main">
          <DashboardHeader
            isAuthenticated={isAuthenticated}
            userEmail={user?.email}
            hasAlerts={false}
            alertItems={[]}
            latestAlertAt={null}
          />

          <div className="dashboard-tabs" role="tablist" aria-label="Dashboard views">
            {['Dashboard', 'Analytics', 'Chat'].map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={false}
                className="dashboard-tab"
                onClick={() => navigate(`/${tab.toLowerCase()}`)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="settings-page">
            <section className="settings-hero">
              <div className="settings-hero__copy">
                <p className="settings-kicker">Profile center</p>
                <h2>Make your account feel intentional.</h2>
                <p className="settings-hero__text">
                  Update your personal details, profile image, and password from one place without changing any of the underlying account fields.
                </p>
                <div className="settings-pill-row">
                  <span className="settings-pill">Primary email</span>
                  <a href={`mailto:${user?.email}`} className="email-link">{user?.email}</a>
                </div>
              </div>

              <aside className="settings-hero__panel">
                <div className={`settings-avatar settings-avatar--hero${avatarUploading ? ' avatar--uploading' : ''}`}>
                  {displayAvatar ? <img src={displayAvatar} alt="avatar" /> : <span>{initials}</span>}
                  {avatarUploading && <div className="avatar-spinner" />}
                </div>

                <div className="settings-hero__meta">
                  <strong>{user?.name || 'User profile'}</strong>
                  <span>@{form.username || 'username'}</span>
                </div>

                <input
                  ref={fileInputRef}
                  id="avatar-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: 'none' }}
                  onChange={handleFileSelected}
                />

                <div className="avatar-area">
                  <button
                    className="avatar-btn avatar-btn--solid"
                    type="button"
                    onClick={handleAvatarClick}
                    disabled={avatarUploading}
                  >
                    {avatarUploading ? 'Uploading...' : 'Change photo'}
                  </button>

                  <button
                    className="avatar-btn avatar-btn--outline avatar-btn--danger"
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={avatarUploading}
                  >
                    Remove
                  </button>
                </div>

                <p className="settings-email-notice">
                  Supported: JPEG, PNG, WebP, GIF. Max size 5 MB.
                </p>
              </aside>
            </section>

            {avatarMsg.text && (
              <p className={`avatar-msg ${avatarMsg.type === 'success' ? 'settings-success' : 'settings-error'}`}>
                {avatarMsg.text}
              </p>
            )}

            <div className="settings-card">
              <section className="settings-panel">
                <div className="settings-section-heading">
                  <p className="settings-section-heading__eyebrow">Profile details</p>
                  <h2>Basic information</h2>
                  <p>Update your personal information. Your address will never be publicly available.</p>
                </div>

                <form className="settings-form" onSubmit={handleSave} noValidate>
                  <div className="field-row">
                    <label className="settings-label">
                      Full name <span className="required-star">*</span>
                    </label>
                    <div className="name-inputs">
                      <div className="input-group">
                        <input
                          id="settings-first-name"
                          name="first_name"
                          type="text"
                          placeholder="First name"
                          value={form.first_name}
                          onChange={handleChange}
                          className={fieldErrors.first_name ? 'input--error' : ''}
                        />
                        {fieldErrors.first_name && <span className="field-error">{fieldErrors.first_name}</span>}
                      </div>
                      <div className="input-group">
                        <input
                          id="settings-last-name"
                          name="last_name"
                          type="text"
                          placeholder="Last name"
                          value={form.last_name}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="field-row">
                    <label htmlFor="settings-username" className="settings-label">
                      Username <span className="required-star">*</span>
                    </label>
                    <div className="single-input">
                      <div className="input-group">
                        <input
                          id="settings-username"
                          name="username"
                          type="text"
                          placeholder="username"
                          value={form.username}
                          onChange={handleChange}
                          className={fieldErrors.username ? 'input--error' : ''}
                        />
                        {fieldErrors.username && <span className="field-error">{fieldErrors.username}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="field-row">
                    <label htmlFor="settings-email" className="settings-label">Email</label>
                    <div className="full-input">
                      <input
                        id="settings-email"
                        name="email"
                        type="email"
                        value={form.email}
                        disabled
                      />
                    </div>
                  </div>

                  <div className="field-row">
                    <label htmlFor="settings-phone" className="settings-label">Phone</label>
                    <div className="full-input">
                      <div className="input-group">
                        <input
                          id="settings-phone"
                          name="phone"
                          type="tel"
                          inputMode="numeric"
                          placeholder="10-digit phone number"
                          value={form.phone}
                          onChange={handlePhoneChange}
                          maxLength={10}
                          className={fieldErrors.phone ? 'input--error' : ''}
                        />
                        {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
                      </div>
                    </div>
                  </div>

                  {profileMsg.text && (
                    <p className={profileMsg.type === 'success' ? 'settings-success' : 'settings-error'}>
                      {profileMsg.text}
                    </p>
                  )}

                  <div className="settings-actions">
                    <button
                      id="settings-save-btn"
                      type="submit"
                      className="save-btn"
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </section>

              <section className="settings-panel settings-panel--password">
                <div className="settings-section-heading">
                  <p className="settings-section-heading__eyebrow">Security</p>
                  <h2>Change password</h2>
                  <p>Use a strong password with all requirements completed below. Click the eye icon to show or hide.</p>
                </div>

                <form className="settings-form" onSubmit={handleChangePassword} noValidate>
                  <div className="field-row">
                    <label htmlFor="settings-current-pw" className="settings-label">Current password</label>
                    <div className="full-input">
                      <div className="input-group">
                        <PasswordInput
                          id="settings-current-pw"
                          name="current_password"
                          placeholder="Enter current password"
                          value={pwForm.current_password}
                          onChange={handlePwChange}
                          required
                        />
                        {pwErrors.current_password && <span className="field-error">{pwErrors.current_password}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="field-row">
                    <label htmlFor="settings-new-pw" className="settings-label">New password</label>
                    <div className="full-input">
                      <div className="input-group">
                        <PasswordInput
                          id="settings-new-pw"
                          name="new_password"
                          placeholder="At least 8 characters"
                          value={pwForm.new_password}
                          onChange={handlePwChange}
                          required
                        />
                        {pwErrors.new_password && <span className="field-error">{pwErrors.new_password}</span>}
                        <PasswordRequirements password={pwForm.new_password} />
                      </div>
                    </div>
                  </div>

                  <div className="field-row">
                    <label htmlFor="settings-confirm-pw" className="settings-label">Confirm new</label>
                    <div className="full-input">
                      <div className="input-group">
                        <PasswordInput
                          id="settings-confirm-pw"
                          name="confirm_password"
                          placeholder="Repeat new password"
                          value={pwForm.confirm_password}
                          onChange={handlePwChange}
                          required
                        />
                        {pwErrors.confirm_password && <span className="field-error">{pwErrors.confirm_password}</span>}
                      </div>
                    </div>
                  </div>

                  {pwMsg.text && (
                    <p className={pwMsg.type === 'success' ? 'settings-success' : 'settings-error'}>
                      {pwMsg.text}
                    </p>
                  )}

                  <div className="settings-actions">
                    <button
                      id="settings-change-pw-btn"
                      type="submit"
                      className="save-btn"
                      disabled={changingPw || !isPasswordFormValid}
                    >
                      {changingPw ? 'Updating...' : 'Change Password'}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}
