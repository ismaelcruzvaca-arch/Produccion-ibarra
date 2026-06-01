import '@testing-library/jest-native/extend-expect';

// Polyfill setImmediate for react-native-paper Snackbar dismiss timer
if (typeof global.setImmediate !== 'function') {
  global.setImmediate = function(fn) { return setTimeout(fn, 0); };
}

// Mock expo modules
jest.mock('expo-constants', () => ({
  default: { manifest: {}, expoConfig: {} },
}));
