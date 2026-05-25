// server.js - Express server with Elastic Beanstalk support
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import axios from 'axios'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000
const API_URL = process.env.API_URL || 'http://localhost:3000'
const CORS_ORIGIN = process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://localhost:3000']

// ==================== MIDDLEWARE ====================

// CORS configuration
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

// Body parsers
app.use(express.json({ limit: '20mb' }))
app.use(express.urlencoded({ limit: '20mb', extended: true }))

// Serve static files from the built frontend
app.use(express.static(path.join(__dirname, 'frontend/dist')))

// ==================== HEALTH CHECKS ====================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'NutriCal Frontend Server is running',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development'
  })
})

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    frontend: 'running',
    backendUrl: API_URL
  })
})

// ==================== API PROXY ROUTES ====================

// Forward all API requests to backend
const apiProxy = async (req, res, next) => {
  try {
    const forwardUrl = `${API_URL}${req.originalUrl}`
    const config = {
      method: req.method,
      url: forwardUrl,
      headers: {
        ...req.headers,
        host: new URL(API_URL).hostname
      }
    }

    // Forward authorization header
    if (req.headers.authorization) {
      config.headers.authorization = req.headers.authorization
    }

    // Forward body for POST, PUT, PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      config.data = req.body
    }

    const response = await axios(config)
    res.status(response.status).json(response.data)
  } catch (error) {
    console.error(`API Proxy Error: ${req.method} ${req.originalUrl}`, error.message)
    
    if (error.response) {
      res.status(error.response.status).json(error.response.data || { error: 'Backend error' })
    } else if (error.code === 'ECONNREFUSED') {
      res.status(503).json({ error: 'Backend service unavailable', details: 'Cannot connect to API server' })
    } else {
      res.status(500).json({ error: 'Proxy error', details: error.message })
    }
  }
}

// ==================== API ROUTES ====================

// Auth routes
app.post('/api/auth/register', apiProxy)
app.post('/api/auth/login', apiProxy)
app.get('/api/auth/me', apiProxy)
app.post('/api/auth/verify-email', apiProxy)
app.post('/api/auth/request-password-reset', apiProxy)
app.post('/api/auth/reset-password', apiProxy)

// Alimentos (Foods) routes
app.get('/api/alimentos', apiProxy)
app.get('/api/alimentos/buscar', apiProxy)
app.get('/api/alimentos/calorias/:rango', apiProxy)
app.get('/api/alimentos/estadisticas/resumen', apiProxy)
app.get('/api/alimentos/:id', apiProxy)
app.post('/api/alimentos', apiProxy)
app.put('/api/alimentos/:id', apiProxy)
app.delete('/api/alimentos/:id', apiProxy)

// Recetas (Recipes) routes
app.get('/api/recetas', apiProxy)
app.get('/api/recetas/buscar', apiProxy)
app.get('/api/recetas/:id', apiProxy)
app.post('/api/recetas', apiProxy)
app.put('/api/recetas/:id', apiProxy)
app.delete('/api/recetas/:id', apiProxy)

// Recipe ingredients routes
app.post('/api/recetas/:id/ingredientes', apiProxy)
app.put('/api/recetas/:id/ingredientes/:id_alimento', apiProxy)
app.delete('/api/recetas/:id/ingredientes/:id_alimento', apiProxy)

// Usuarios (Users) routes
app.get('/api/usuarios', apiProxy)
app.get('/api/usuarios/test-db', apiProxy)
app.get('/api/usuarios/:id', apiProxy)
app.put('/api/usuarios/:id', apiProxy)
app.delete('/api/usuarios/:id', apiProxy)
app.post('/api/usuarios', apiProxy)

// Planes (Plans) routes
app.get('/api/planes', apiProxy)
app.get('/api/planes/:id', apiProxy)
app.post('/api/planes', apiProxy)
app.put('/api/planes/:id', apiProxy)
app.delete('/api/planes/:id', apiProxy)

// Registros (Records) routes
app.get('/api/registros', apiProxy)
app.get('/api/registros/:id', apiProxy)
app.post('/api/registros', apiProxy)
app.put('/api/registros/:id', apiProxy)
app.delete('/api/registros/:id', apiProxy)

// Images routes
app.get('/api/images/*', apiProxy)
app.post('/api/images/*', apiProxy)
app.delete('/api/images/*', apiProxy)

// Debug route
app.get('/api/debug', (req, res) => {
  res.json({
    success: true,
    timestamp: new Date(),
    server: 'NutriCal Frontend',
    nodeEnv: process.env.NODE_ENV,
    backendUrl: API_URL,
    corsOrigin: CORS_ORIGIN,
    frontendPath: path.join(__dirname, 'frontend/dist')
  })
})

// ==================== SPA FALLBACK ====================

// SPA fallback - serve index.html for all unmatched routes
app.get('*', (req, res) => {
  // Only serve index.html for non-API routes
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'frontend/dist/index.html'), (err) => {
      if (err) {
        console.error('Error serving index.html:', err)
        res.status(500).json({ error: 'Could not load application' })
      }
    })
  } else {
    res.status(404).json({ error: 'API endpoint not found', path: req.path })
  }
})

// ==================== ERROR HANDLING ====================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack)
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  })
})

// ==================== SERVER STARTUP ====================

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 ========================================')
  console.log(`🚀 NutriCal Frontend Server Started`)
  console.log('🚀 ========================================')
  console.log(`📍 Port: ${PORT}`)
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`📍 Backend URL: ${API_URL}`)
  console.log(`📍 Frontend Path: ${path.join(__dirname, 'frontend/dist')}`)
  console.log('🚀 ========================================')
  console.log(`✅ Health Check: http://localhost:${PORT}/health`)
  console.log(`✅ Debug: http://localhost:${PORT}/api/debug`)
  console.log('🚀 ========================================')
})

// ==================== GRACEFUL SHUTDOWN ====================

process.on('SIGINT', () => {
  console.log('🔌 Received SIGINT, shutting down gracefully')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('🔌 Received SIGTERM, shutting down gracefully')
  process.exit(0)
})

export default app
