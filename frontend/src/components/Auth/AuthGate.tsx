import { observer } from 'mobx-react';
import React, { Component } from 'react';
import { AuthStore } from '../../stores/AuthStore';
import LoginPage from './LoginPage';

interface IAuthGateProps {
	store: AuthStore;
	/** Az app; csak belépés után épül fel (a store-okkal együtt). */
	children: () => React.ReactNode;
}

/** I31: induláskor `GET /api/session`; belépés nélkül a login-oldal, utána az app. */
@observer
class AuthGate extends Component<IAuthGateProps> {
	componentDidMount() {
		this.props.store.check();
	}

	render() {
		const { store, children } = this.props;
		if (store.status === 'checking') return <main className="min-h-screen bg-canvas" aria-busy="true" aria-label="Betöltés" />;
		if (store.status === 'anonymous') return <LoginPage store={store} />;
		return <>{children()}</>;
	}
}

export default AuthGate;
