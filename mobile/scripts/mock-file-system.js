module.exports = {
  documentDirectory: '/tmp/',
  cacheDirectory: '/tmp/',
  getInfoAsync: async () => ({ exists: false }),
  writeAsStringAsync: async () => {},
  readAsStringAsync: async () => '',
  deleteAsync: async () => {},
  makeDirectoryAsync: async () => {},
  downloadAsync: async () => ({ uri: '' }),
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
};
module.exports.default = module.exports;
