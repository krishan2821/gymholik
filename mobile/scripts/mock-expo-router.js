
const React = require('react');
module.exports = {
  useRouter: () => ({
    push: () => {},
    back: () => {},
    replace: () => {},
    setParams: () => {},
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  usePathname: () => '/',
  Link: ({ children, ...props }) => React.createElement('a', props, children),
  Stack: Object.assign(({ children }) => children, { Screen: () => null }),
  Tabs: Object.assign(({ children }) => children, { Screen: () => null }),
};
