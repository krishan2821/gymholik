
const React = require('react');
module.exports = {
  BlurView: ({ children, style, ...props }) => React.createElement('div', { style, ...props }, children),
};
