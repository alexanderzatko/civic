const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;

// Expo SDK 52+ auto-detects the pnpm monorepo (watchFolders, nodeModulesPaths).
// Only add resolver tweaks we still need beyond the defaults.
const config = getDefaultConfig(projectRoot);

config.resolver.unstable_enableSymlinks = true;

// packages/shared uses NodeNext-style `./foo.js` imports that map to `./foo.ts`.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.startsWith(".") &&
    moduleName.endsWith(".js") &&
    context.originModulePath &&
    context.originModulePath.includes(`${path.sep}packages${path.sep}shared${path.sep}`)
  ) {
    const dir = path.dirname(context.originModulePath);
    const withoutJs = moduleName.slice(0, -3);
    for (const ext of [".ts", ".tsx", ".js"]) {
      const candidate = path.resolve(dir, withoutJs + ext);
      if (fs.existsSync(candidate)) {
        return { type: "sourceFile", filePath: candidate };
      }
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
