import express from 'express';

import adminRouter from './src/routes/admin';

export function createApp(db: unknown) {
  const app = express();
  app.use(express.json());

  // Inject DB pool so routes can access it via req.app.locals.db
  app.locals.db = db;

  // Routes
  app.use('/admin', adminRouter);

  return app;
}

// Start server only when run directly (not during tests)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  // TODO: replace with your real pg Pool instance
  const app = createApp(null);
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
