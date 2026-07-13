#!/usr/bin/env node
/**
 * sync-skill — refresh the committed .claude/skills/specpad mirror from skill/specpad.
 *
 * skill/specpad/ is the canonical source of the distributable specpad skill (what gets
 * zipped as specpad-skill.zip for downstream consumers). .claude/skills/specpad/ is a
 * committed mirror so contributors working on this repo have the skill active in Claude
 * Code with zero setup on clone. Drift is caught by the pre-push hook.
 *
 * Usage: node scripts/sync-skill.mjs
 */
import { cpSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const src = resolve(repoRoot, 'skill/specpad');
const dst = resolve(repoRoot, '.claude/skills/specpad');

if (!existsSync(src)) {
  console.error(`sync-skill: source not found: ${src}`);
  process.exit(1);
}

rmSync(dst, { recursive: true, force: true });
cpSync(src, dst, { recursive: true });
console.error(`sync-skill: ${src} → ${dst}`);
