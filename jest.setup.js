import '@testing-library/jest-native/extend-expect';

// Mock expo modules
jest.mock('expo-constants', () => ({
  default: { manifest: {}, expoConfig: {} },
}));
