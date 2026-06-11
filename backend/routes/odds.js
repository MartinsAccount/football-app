const express = require('express');
const fs = require('fs');

const router = express.Router();

// '/api/odds' ez már használva van a server js middleware-ben ezért lehet rövidíteni
router.get('/', async (req, res) => {
	const params = await req.params;

	console.log('params', params);

	const englandOdds = await require('../stores/england-odds.json');
	const franceOdds = await require('../stores/france-odds.json');
	const germanyOdds = await require('../stores/germany-odds.json');
	const italyOdds = await require('../stores/italy-odds.json');
	const spainOdds = await require('../stores/spain-odds.json');

	let response = {
		englandOdds: englandOdds,
		franceOdds: franceOdds,
		germanyOdds: germanyOdds,
		italyOdds: italyOdds,
		spainOdds: spainOdds
	};

	res.json({ response });
});

router.post('/', async (req, res) => {
	const data = await req.body.response;
	// console.log('data', data);

	fs.readFile(`./stores/${req.query.country}-odds.json`, function (err, content) {
		if (err) throw err;

		let parseContent = JSON.parse(content);

		// Ha nincs még lementve akkor lementi
		data.forEach((fix) => {
			const some = parseContent.odds.some((item) => item.fixture.id === fix.fixture.id);

			if (!some) parseContent.odds.push(fix);
		});

		fs.writeFile(`./stores/${req.query.country}-odds.json`, JSON.stringify(parseContent), function (err) {
			if (err) throw err;

			res.send({ message: `succeed saved ${req.query.country} odds` });
		});
	});
});

module.exports = router;
