import express from 'express';
const router = express.Router();

// Configurable RAG service URL — change this to point to your running interview service
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:8080';

/**
 * POST /api/interview/message
 * Proxies { session_id, user_response } → RAG interview service
 */
router.post('/message', async (req, res) => {
  try {
    const upstream = await fetch(`${RAG_SERVICE_URL}/interview/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error('[InterviewProxy] RAG service unreachable:', err.message);
    res.status(502).json({
      error: 'RAG interview service unavailable',
      details: err.message,
      hint: `Ensure the RAG service is running at ${RAG_SERVICE_URL}`
    });
  }
});

/**
 * GET /api/interview/:session_id/decision
 * Proxies decision fetch → RAG interview service
 */
router.get('/:session_id/decision', async (req, res) => {
  try {
    const upstream = await fetch(`${RAG_SERVICE_URL}/interview/${req.params.session_id}/decision`);
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error('[InterviewProxy] RAG service unreachable:', err.message);
    res.status(502).json({
      error: 'RAG interview service unavailable',
      details: err.message,
      hint: `Ensure the RAG service is running at ${RAG_SERVICE_URL}`
    });
  }
});

export default router;
