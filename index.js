const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple file-based database for audit results
const DB_FILE = path.join(__dirname, 'results.json');

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

// Endpoint to receive scan results
app.post('/api/audit', (req, res) => {
  try {
    const data = req.body;

    const results = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

    const record = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      score: data.score,
      details: data.details
    };

    results.push(record);
    fs.writeFileSync(DB_FILE, JSON.stringify(results, null, 2));

    res.status(200).json({ success: true, message: 'Audit saved successfully', recordId: record.id });
  } catch (error) {
    console.error('Error saving audit:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Endpoint to get all results
app.get('/api/results', (req, res) => {
  try {
    const results = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read results' });
  }
});

// Endpoint to get client IP and Basic Geo Information
app.get('/api/ip-info', async (req, res) => {
  try {
    // Get the IP from the request (works roughly for local / proxies)
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // For localhost testing, we use a public API to get our outward facing IP
    if (ip === '::1' || ip === '127.0.0.1') {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      ip = data.ip;
    }

    // Use a free GeoIP service to check proxy / location
    const geoResponse = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,isp,proxy,hosting`);
    const geoData = await geoResponse.json();

    res.json({
      ip,
      location: geoData.status === 'success' ? `${geoData.city}, ${geoData.country}` : 'Unknown',
      isp: geoData.isp || 'Unknown',
      isProxy: geoData.proxy || geoData.hosting || false
    });

  } catch (error) {
    console.error('Error fetching IP info:', error);
    res.status(500).json({ error: 'Failed to retrieve IP information' });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`DevShield backend server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
