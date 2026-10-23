global.__DEV__ = true;
global.window = global.window || { location: { protocol: 'https:', href: 'https://localhost/' }, addEventListener() {}, removeEventListener() {} };
global.location = global.window.location;
global.document = global.document || { createElement: () => ({ style: {} }), head: { appendChild() {} } };
global.WebSocket = global.WebSocket || class WebSocket { addEventListener() {} send() {} close() {} };
global.ErrorUtils = global.ErrorUtils || { getGlobalHandler: () => () => {}, setGlobalHandler: () => {} };
process.env.EXPO_OS = 'web';
globalThis.expo = globalThis.expo || {
  EventEmitter: class EventEmitter {
    addListener() { return { remove() {} }; }
    emit() {}
  },
  modules: new Proxy({}, {
    get: () => ({})
  })
};

const rnWeb = require('react-native-web');
if (!rnWeb.codegenNativeComponent) {
  rnWeb.codegenNativeComponent = () => 'div';
}
if (!rnWeb.TurboModuleRegistry) {
  rnWeb.TurboModuleRegistry = {
    get: () => ({}),
    getEnforcing: () => ({}),
  };
}

let assetCounter = 0;
const AssetRegistry = require('react-native-web/dist/cjs/modules/AssetRegistry');
const assetHandler = (module) => {
  assetCounter++;
  if (AssetRegistry && AssetRegistry.registerAsset) {
    AssetRegistry.registerAsset({
      httpServerLocation: '/assets',
      width: 100,
      height: 100,
      scales: [1],
      hash: String(assetCounter),
      name: 'asset_' + assetCounter,
      type: 'png',
    });
  }
  module.exports = assetCounter;
};
require.extensions['.png'] = assetHandler;
require.extensions['.jpg'] = assetHandler;
require.extensions['.jpeg'] = assetHandler;
require.extensions['.webp'] = assetHandler;
require.extensions['.svg'] = assetHandler;

const path = require('path');
const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'react-native') {
    return origResolve.call(this, 'react-native-web', parent, isMain, options);
  }
  if (request.includes('codegenNativeComponent')) {
    return path.resolve(__dirname, 'mock-codegen.js');
  }
  if (request === 'react-native-safe-area-context') {
    return path.resolve(__dirname, 'mock-safe-area.js');
  }
  if (request === 'react-native-screens') {
    return path.resolve(__dirname, 'mock-screens.js');
  }
  if (request === 'react-native-toast-message') { return path.resolve(__dirname, 'mock-toast.js'); }
  if (request === 'expo-blur') { return path.resolve(__dirname, 'mock-blur.js'); }
  if (request === 'expo-router') {
    return path.resolve(__dirname, 'mock-expo-router.js');
  }
  if (request === 'react-native-qrcode-svg') {
    return path.resolve(__dirname, 'mock-qrcode.js');
  }
  if (request === 'react-native-gifted-charts') {
    return path.resolve(__dirname, 'mock-charts.js');
  }
  if (request === '@react-native-community/datetimepicker') {
    return path.resolve(__dirname, 'mock-datetimepicker.js');
  }
  if (request === 'expo-camera') {
    return path.resolve(__dirname, 'mock-camera.js');
  }
  if (request === 'expo-file-system' || request.startsWith('expo-file-system/')) {
    return path.resolve(__dirname, 'mock-file-system.js');
  }
  if (request === 'expo-sharing') {
    return path.resolve(__dirname, 'mock-sharing.js');
  }
  if (request === 'react-native-view-shot') {
    return path.resolve(__dirname, 'mock-view-shot.js');
  }
  if (request === 'react-native-reanimated') {
    return path.resolve(__dirname, 'mock-reanimated.js');
  }
  return origResolve.call(this, request, parent, isMain, options);
};
