import { createApp } from './app.js';
import { loadConfig } from './config.js';

const { PORT: port } = loadConfig();
const app = createApp();

app.listen(port, () => {
  console.log(`api listening on http://localhost:${port}`);
});
