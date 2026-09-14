import './config/database';
import app from './server';

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`Rup API listening on port ${port}`);
});

export default app;