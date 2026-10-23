const React = require('react');
function ViewShot(props) {
  return props.children || null;
}
ViewShot.captureRef = async () => 'data:image/png;base64,';
module.exports = ViewShot;
module.exports.default = ViewShot;
module.exports.captureRef = ViewShot.captureRef;
