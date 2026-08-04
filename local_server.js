const app = require('./api/index.js');
const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`[Server] Local Express server running at http://localhost:${port}`);
  console.log(`[Server] Press Ctrl+C to stop`);
});
