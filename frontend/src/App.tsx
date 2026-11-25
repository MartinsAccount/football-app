import React, { Component } from 'react';
import { MainStore } from './stores/MainStore';
import { AuthStore } from './stores/AuthStore';
import { Provider } from 'mobx-react';
import Main from './components/Main/Main';
import AuthGate from './components/Auth/AuthGate';
import { readApi } from './services/readApi';

class App extends Component {
	// I31: a web-login a store-ok előtt dől el; a MainStore (és vele az első API-hívások) csak belépés után jön létre.
	private auth = new AuthStore(readApi);
	private stores?: { MainStore: MainStore; AuthStore: AuthStore };

	private renderApp = () => {
		this.stores ??= { MainStore: new MainStore(), AuthStore: this.auth };
		return (
			<Provider {...this.stores}>
				<Main />
			</Provider>
		);
	};

	render() {
		return <AuthGate store={this.auth}>{this.renderApp}</AuthGate>;
	}
}

export default App;
