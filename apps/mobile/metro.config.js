// Metro: az apps/mobile NEM tagja a gyökér-workspace-nek (React 19 vs. web React 17, lásd DECISIONS.md).
// A megosztott csomagokat (TS-forrásként) a repó packages/ mappájából olvassa: watchFolders + extraNodeModules.
// A függőségeket CSAK az apps/mobile/node_modules-ból oldja fel (a gyökér node_modules React 17-e ne keveredjen be).
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const packagesRoot = path.resolve(projectRoot, '../../packages');
const shared = ['core', 'contract', 'theme'];

const config = getDefaultConfig(projectRoot);

config.watchFolders = shared.map((name) => path.join(packagesRoot, name));
config.resolver.nodeModulesPaths = [path.join(projectRoot, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;
config.resolver.extraNodeModules = Object.fromEntries(shared.map((name) => [`@football/${name}`, path.join(packagesRoot, name)]));

module.exports = config;
