// Metro config: lets the app consume the monorepo packages in ../packages
// (@restaurantos/contracts, @restaurantos/api-client), symlinked into node_modules via `file:` deps,
// straight from their TypeScript source. Metro's default resolverMainFields are
// ['react-native', 'browser', 'main'], so each package's "react-native": "src/index.ts" field wins.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const packagesRoot = path.resolve(projectRoot, '../packages/packages');

const config = getDefaultConfig(projectRoot);

// Watch every shared package so Metro can transpile them and edits there hot-reload.
config.watchFolders = [...(config.watchFolders ?? []), packagesRoot];

// Resolve every dependency from this app's node_modules (Expo pins its own React / socket.io-client).
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

// Never pick modules from any packages/*/node_modules (dev tooling only).
const escape = (p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sep = '[\\\\/]'; // either path separator
const packagesNodeModules = new RegExp(`^${escape(packagesRoot)}${sep}[^\\\\/]+${sep}node_modules${sep}.*`);
const defaultBlockList = config.resolver.blockList;
config.resolver.blockList = [...(Array.isArray(defaultBlockList) ? defaultBlockList : defaultBlockList ? [defaultBlockList] : []), packagesNodeModules];

// Bare imports made from inside ../packages (e.g. api-client importing socket.io-client or
// @restaurantos/contracts) would otherwise walk up to the monorepo root node_modules, which holds the
// web apps' copies. Resolve them as if they were imported from this app instead.
const norm = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
const packagesPrefix = norm(packagesRoot + path.sep);
const appOrigin = path.join(projectRoot, 'package.json');
const isBare = (name) => !name.startsWith('.') && !path.isAbsolute(name);
const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromPackages = isBare(moduleName) && norm(context.originModulePath).startsWith(packagesPrefix);
  const ctx = fromPackages ? { ...context, originModulePath: appOrigin } : context;
  return (upstreamResolve ?? context.resolveRequest)(ctx, moduleName, platform);
};

module.exports = config;
