const React = require('react');
module.exports = {
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: true }, () => Promise.resolve({ granted: true })],
};
module.exports.default = module.exports;
