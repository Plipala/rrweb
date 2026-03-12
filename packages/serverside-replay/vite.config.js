import path from 'path';
import { build as esbuild } from 'esbuild';
import config from '../../vite.config.default';

function buildCliPlugin() {
  return {
    name: 'build-cli',
    async closeBundle() {
      await esbuild({
        entryPoints: [path.resolve(__dirname, 'src/cli.ts')],
        outfile: path.resolve(__dirname, 'dist/cli.cjs'),
        bundle: true,
        platform: 'node',
        format: 'cjs',
        target: 'node18',
      });
      console.log('dist/cli.cjs');
    },
  };
}

export default config(
  path.resolve(__dirname, 'src/index.ts'),
  'serversideReplay',
  { plugins: [buildCliPlugin()] },
);
