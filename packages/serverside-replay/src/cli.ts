#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import minimist from 'minimist';
import type { eventWithTime } from '@rrweb/types';

// Side-effect: install Node.js polyfills for rrdom-nodejs
import 'rrdom-nodejs';

import { generateDomAtTimestamps } from './apply-events';

interface CliArgs {
  input: string;
  timestamps: string;
  output?: string;
  help?: boolean;
}

function printUsage(): void {
  console.log(`Usage: serverside-replay --input <file> --timestamps <ms,...> [--output <dir>]

Options:
  --input, -i       Path to a JSON file containing rrweb events
  --timestamps, -t  Comma-separated timestamps in ms (absolute)
  --output, -o      Output directory (defaults to current directory)
  --help, -h        Show this help message
`);
}

function main(): void {
  const argv = minimist(process.argv.slice(2), {
    string: ['input', 'timestamps', 'output'],
    boolean: ['help'],
    alias: {
      i: 'input',
      t: 'timestamps',
      o: 'output',
      h: 'help',
    },
  }) as minimist.ParsedArgs & CliArgs;

  if (argv.help || !argv.input || !argv.timestamps) {
    printUsage();
    process.exit(argv.help ? 0 : 1);
  }

  const inputPath = path.resolve(argv.input);
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const outputDir = path.resolve(argv.output || '.');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamps = argv.timestamps
    .split(',')
    .map((s: string) => parseInt(s.trim(), 10))
    .filter((n: number) => !isNaN(n));

  if (timestamps.length === 0) {
    console.error('Error: No valid timestamps provided');
    process.exit(1);
  }

  console.log(`Reading events from ${inputPath}...`);
  const raw = fs.readFileSync(inputPath, 'utf-8');
  let events: eventWithTime[];
  try {
    events = JSON.parse(raw) as eventWithTime[];
  } catch (e) {
    console.error('Error: Failed to parse events JSON:', (e as Error).message);
    process.exit(1);
  }

  if (!Array.isArray(events)) {
    console.error('Error: Events file must contain a JSON array');
    process.exit(1);
  }

  console.log(
    `Generating DOM snapshots for ${timestamps.length} timestamp(s)...`,
  );
  const results = generateDomAtTimestamps({ events, timestamps });

  for (const result of results) {
    const htmlFile = path.join(outputDir, `dom-at-${result.timestamp}ms.html`);
    const metaFile = path.join(
      outputDir,
      `dom-at-${result.timestamp}ms.meta.json`,
    );

    fs.writeFileSync(htmlFile, result.html, 'utf-8');
    fs.writeFileSync(
      metaFile,
      JSON.stringify(result.metadata, null, 2),
      'utf-8',
    );

    console.log(`  ${path.basename(htmlFile)}`);
    console.log(`  ${path.basename(metaFile)}`);
  }

  console.log(`Done. ${results.length} snapshot(s) written to ${outputDir}`);
}

main();
