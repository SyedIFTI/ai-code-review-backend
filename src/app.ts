import 'dotenv/config'
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRotues'
import aiGenRoutes from './routes/aiGenRoutes'
import stripeRoutes from './routes/stripeRoutes'
import webhookRoutes from './routes/webhookRoutes'
const app: Application = express();

// Middlewares 
app.use(cors({
  origin: process.env.FRONTEND_URL!,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// MUST be mounted before express.json() because Stripe requires the raw, unparsed request body to verify signatures.
app.use('/api/v1/webhooks', webhookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/ai', aiGenRoutes)
app.use('/api/v1/stripe', stripeRoutes)
//imports 

app.get('/health', (req, res) => {
  res.status(200).json({ message: 'OK' })
})

export default app;

