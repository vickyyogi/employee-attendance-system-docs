import dotenv from 'dotenv';
dotenv.config();

import { app } from './app';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

app.listen(PORT, () => {
  console.info(`API Server running on http://localhost:${PORT}`);
});
