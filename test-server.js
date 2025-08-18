// Simple test server to verify basic functionality
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 4444;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Test server running' });
});

app.post('/api/sites', (req, res) => {
  console.log('Received request:', req.body);
  const { name, domain } = req.body;
  
  if (!name || !domain) {
    return res.status(400).json({ error: 'Name and domain are required' });
  }
  
  const siteId = Math.random().toString(36).substr(2, 9);
  const installSnippet = `<script defer src="http://localhost:4444/sniffer.js" data-site-id="${siteId}"></script>`;
  
  res.json({
    siteId,
    name,
    domain,
    installSnippet,
    message: 'Site registered successfully'
  });
});

app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});
