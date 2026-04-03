import path from 'path'
import { existsSync, readFileSync, statSync } from 'fs'

export interface StephanyTrainingData {
  exists: boolean
  path: string
  context: string
  updatedAt: string | null
}

export function getStephanyTrainingContextPath(): string {
  const explicitPath = (process.env.STEPHANY_TRAINING_CONTEXT_PATH || '').trim()
  if (explicitPath) {
    return explicitPath
  }

  const workspacePath = (process.env.WORKSPACE_PATH || '').trim()
  if (workspacePath) {
    return path.resolve(
      workspacePath,
      '..',
      'skills',
      'stephany-training',
      'data',
      'RUNTIME_CONTEXT.md',
    )
  }

  const home = (process.env.HOME || '').trim()
  return path.resolve(
    home || '/',
    '.openclaw',
    'skills',
    'stephany-training',
    'data',
    'RUNTIME_CONTEXT.md',
  )
}

export function getStephanyTrainingData(): StephanyTrainingData {
  const filePath = getStephanyTrainingContextPath()

  if (!existsSync(filePath)) {
    return {
      exists: false,
      path: filePath,
      context: '',
      updatedAt: null,
    }
  }

  try {
    return {
      exists: true,
      path: filePath,
      context: readFileSync(filePath, 'utf-8').trim(),
      updatedAt: statSync(filePath).mtime.toISOString(),
    }
  } catch {
    return {
      exists: false,
      path: filePath,
      context: '',
      updatedAt: null,
    }
  }
}
