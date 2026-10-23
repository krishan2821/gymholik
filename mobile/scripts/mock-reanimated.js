const React = require('react');

const useSharedValue = (initialValue) => {
  const ref = React.useRef({ value: initialValue });
  return ref.current;
};

const useAnimatedStyle = (fn) => {
  return fn ? fn() : {};
};

const withSpring = (toValue) => toValue;
const withTiming = (toValue) => toValue;
const withSequence = (...anims) => anims[anims.length - 1];
const withDelay = (_delay, anim) => anim;
const runOnJS = (fn) => fn;
const useReducedMotion = () => false;
const interpolate = (val, inRange, outRange) => (outRange ? outRange[0] : 0);

const createAnimatedComponent = (Comp) => Comp;

const AnimatedView = React.forwardRef((props, ref) => {
  return React.createElement('div', { ...props, ref });
});
AnimatedView.displayName = 'Animated.View';

const AnimatedText = React.forwardRef((props, ref) => {
  return React.createElement('span', { ...props, ref });
});
AnimatedText.displayName = 'Animated.Text';

const Animated = {
  View: AnimatedView,
  Text: AnimatedText,
  createAnimatedComponent,
};

module.exports = {
  __esModule: true,
  default: Animated,
  View: AnimatedView,
  Text: AnimatedText,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  useReducedMotion,
  interpolate,
  createAnimatedComponent,
  Animated,
};
