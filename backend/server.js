const express = require('express');
const cors = require('cors');

const app = express();
const odds = require('./routes/odds');

const PORT = 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// ROUTES
app.use('/api/odds', odds);

// ne fusson le kétszer a post
app.options('/', (req, res) => res.send({ message: 'nothing' }));

app.listen(PORT, () => {
	console.log('Express server listening on port ', PORT);
});
