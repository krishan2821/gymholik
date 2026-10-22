
const React = require('react');
module.exports = {
  enableScreens: () => {},
  screensEnabled: () => true,
  featureFlags: {
    experiment: {},
  },
  Screen: ({ children, style, ...props }) => React.createElement('div', { style, ...props }, children),
  ScreenContainer: ({ children, style, ...props }) => React.createElement('div', { style, ...props }, children),
  NativeScreen: ({ children, style, ...props }) => React.createElement('div', { style, ...props }, children),
  NativeScreenContainer: ({ children, style, ...props }) => React.createElement('div', { style, ...props }, children),
};
