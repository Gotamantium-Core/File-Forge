import { Router } from 'express';
import { z } from 'zod';
import { executeGraph } from '../engine/executor';
import { GraphValidationError } from '../engine/types';

export const runsRouter = Router();

const artifactSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  mime: z.string(),
  kind: z.enum(['image', 'pdf', 'file']),
  size: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  pages: z.number().optional(),
});

const nodeSchema = z.object({
  id: z.string().min(1),
  data: z.object({
    defType: z.string().min(1),
    params: z.record(z.string(), z.unknown()).optional(),
    artifacts: z.array(artifactSchema).max(200).optional(),
  }),
});

const edgeSchema = z.object({
  id: z.string().optional(),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().nullish(),
  targetHandle: z.string().nullish(),
});

const runSchema = z.object({
  nodes: z.array(nodeSchema).min(1).max(200),
  edges: z.array(edgeSchema).max(1000),
});

runsRouter.post('/runs', async (req, res) => {
  const parsed = runSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid pipeline payload.',
      details: parsed.error.issues.map(
        (issue) => `${issue.path.join('.') || 'pipeline'}: ${issue.message}`,
      ),
    });
    return;
  }

  try {
    const result = await executeGraph(parsed.data.nodes, parsed.data.edges);
    res.json(result);
  } catch (error) {
    if (error instanceof GraphValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    throw error;
  }
});
