const express = require('express');
const morgan = require('morgan');

const pollutionRoutes = require('./routes/pollution');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 4002;

const path = require('path');

app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve the isolated Pollution Government Website

app.get('/', (req, res) => {
  res.json({
    service: 'Pollution / Environment Department API (simulated)',
    description:
      'A deliberately independent, legacy-shaped demo environmental API for consent and compliance verification in the Government Interoperability Layer.',
    endpoints: [
      'GET    /api/pollution/applications/:applicationNo',
      'GET    /api/pollution/status/:applicationNo',
      'POST   /api/pollution/verify',
      'PATCH  /api/pollution/applications/:applicationNo/consent',
      'POST   /api/pollution/schema-mapping/detect',
      'GET    /api/pollution/audit'
    ]
  });
});

app.use('/api/pollution', pollutionRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Pollution Department API (simulated) listening on http://localhost:${PORT}`);
  console.log('See README.md for demo API keys and example requests.');
});
