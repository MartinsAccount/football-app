import { observer } from 'mobx-react';
import React, { Component } from 'react';
import { AuthStore } from '../../stores/AuthStore';
import { card, cx, dangerText, input, warningBox } from '../ui/oeClasses';

interface ILoginPageProps {
	store: AuthStore;
}

/**
 * Belépés az admin-jelszóval (I31). Felhasználónév nincs: a rejtett „admin” mező csak a böngésző jelszókezelőjének kell,
 * hogy a jelszót el tudja menteni. A jelszó a mező DOM-értékéből jön (nem kerül MobX-állapotba).
 */
@observer
class LoginPage extends Component<ILoginPageProps> {
	private passwordRef = React.createRef<HTMLInputElement>();

	componentDidMount() {
		this.passwordRef.current?.focus();
	}

	submit = (e: React.FormEvent) => {
		e.preventDefault();
		const password = this.passwordRef.current?.value ?? '';
		if (password) this.props.store.login(password);
	};

	render() {
		const { store } = this.props;

		return (
			<main className="grid min-h-screen place-items-center bg-canvas px-sp-6 py-sp-12">
				<form className={cx(card, 'w-full max-w-aside')} onSubmit={this.submit} aria-labelledby="login-title" noValidate>
					<div className="oe-brand">
						<svg width="28" height="28" viewBox="0 0 30 30" aria-hidden="true">
							<circle cx="15" cy="15" r="13" fill="none" stroke="currentColor" strokeWidth="2" />
							<path d="M15 2 V28 M2 15 H28" stroke="currentColor" strokeWidth="1.2" opacity=".5" />
							<circle cx="15" cy="15" r="4" fill="currentColor" />
						</svg>
						<span>Odds elemző</span>
					</div>
					<div className="flex flex-col gap-sp-3">
						<h1 className="oe-h2" id="login-title">
							Belépés
						</h1>
						<p className="oe-muted text-small m-0">Az app csak a tulajdonosnak érhető el.</p>
					</div>

					{!store.loginEnabled && (
						<p className={cx('oe-warning text-small m-0', warningBox)} role="status">
							A szerveren nincs beállítva a bejelentkezés (APP_PASSWORD_HASH, SESSION_SECRET).
						</p>
					)}

					<input
						className="sr-only"
						type="text"
						name="username"
						autoComplete="username"
						value="admin"
						readOnly
						tabIndex={-1}
						aria-hidden="true"
					/>
					<label className="oe-field">
						Jelszó
						<input
							ref={this.passwordRef}
							className={input}
							type="password"
							name="password"
							autoComplete="current-password"
							required
							aria-invalid={store.error ? true : undefined}
							aria-describedby={store.error ? 'login-error' : undefined}
							onChange={() => store.error && store.clearError()}
						/>
					</label>

					{store.error && (
						<p className={cx('text-small m-0', dangerText)} id="login-error" role="alert">
							{store.error}
						</p>
					)}

					<button className="oe-btn oe-btn--primary w-full" type="submit" disabled={store.submitting || !store.loginEnabled}>
						{store.submitting ? 'Belépés…' : 'Belépés'}
					</button>
				</form>
			</main>
		);
	}
}

export default LoginPage;
