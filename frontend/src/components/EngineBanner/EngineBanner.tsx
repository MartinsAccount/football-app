import React, { Component } from 'react';
import { banner } from '../ui/oeClasses';

interface IEngineBannerProps {
	title: string;
	text: string;
}

/** DESIGN §7.3: csak „Motor javaslata” módban; félkövér cím + egy mondat indoklás. */
class EngineBanner extends Component<IEngineBannerProps> {
	render() {
		const { title, text } = this.props;
		return (
			<div className={banner} role="note">
				<div>
					<strong>{title}</strong> {text}
				</div>
			</div>
		);
	}
}

export default EngineBanner;
