import '@testing-library/jest-native/extend-expect';

// Polyfill setImmediate for react-native-paper Snackbar dismiss timer
if (typeof global.setImmediate !== 'function') {
  global.setImmediate = function(fn) { return setTimeout(fn, 0); };
}

// Mock expo modules
jest.mock('expo-constants', () => ({
  default: { manifest: {}, expoConfig: {} },
}));

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    multiRemove: jest.fn(() => Promise.resolve()),
  },
  __esModule: true,
}));

// Mock react-native-paper components (Provider, Snackbar, etc.)
jest.mock('react-native-paper', () => {
  const React = require('react');
  const { View, Text, TextInput } = require('react-native');
  return {
    Provider: ({ children }) => React.createElement(View, null, children),
    Snackbar: ({ children, onDismiss, ...props }) =>
      React.createElement(View, props, children),
    Dialog: ({ children, visible, ...props }) =>
      visible ? React.createElement(View, props, children) : null,
    Portal: ({ children }) => React.createElement(View, null, children),
    Button: ({ children, onPress, ...props }) =>
      React.createElement(Text, { ...props, onPress }, children),
    TextInput: ({ label, ...props }) =>
      React.createElement(TextInput, { placeholder: label, ...props }),
    RadioButton: {
      Group: ({ children }) => React.createElement(View, null, children),
      Android: ({ value, status, onPress, ...props }) =>
        React.createElement(
          Text,
          { ...props, onPress },
          status === 'checked' ? '●' : '○',
        ),
    },
    Switch: ({ value, onValueChange, ...props }) =>
      React.createElement(View, { ...props, onPress: () => onValueChange && onValueChange(!value) }),
    Checkbox: {
      Android: ({ status, onPress, ...props }) =>
        React.createElement(Text, { ...props, onPress }, status === 'checked' ? '☑' : '☐'),
    },
    List: {
      Section: ({ children, title, ...props }) =>
        React.createElement(View, props, React.createElement(Text, null, title), children),
      Item: ({ title, description, onPress, ...props }) =>
        React.createElement(
          View,
          { ...props, onPress },
          React.createElement(Text, null, title),
          description ? React.createElement(Text, null, description) : null,
        ),
    },
    Chip: ({ children, onPress, selected, ...props }) =>
      React.createElement(View, { ...props, onPress }, children),
    Menu: {
      Item: ({ title, onPress, ...props }) =>
        React.createElement(Text, { ...props, onPress }, title),
    },
    IconButton: ({ icon, onPress, ...props }) =>
      React.createElement(Text, { ...props, onPress }, icon || '•'),
    FAB: ({ icon, onPress, ...props }) =>
      React.createElement(Text, { ...props, onPress }, icon || '+'),
    Surface: ({ children, ...props }) =>
      React.createElement(View, props, children),
    Card: ({ children, onPress, ...props }) =>
      React.createElement(View, { ...props, onPress }, children),
    CardContent: ({ children, ...props }) =>
      React.createElement(View, props, children),
    Divider: () => React.createElement(View),
    Banner: ({ children, visible, ...props }) =>
      visible ? React.createElement(View, props, children) : null,
    TouchableRipple: ({ children, onPress, ...props }) =>
      React.createElement(View, { ...props, onPress }, children),
    Paragraph: ({ children, ...props }) =>
      React.createElement(Text, props, children),
    Title: ({ children, ...props }) =>
      React.createElement(Text, props, children),
    Caption: ({ children, ...props }) =>
      React.createElement(Text, props, children),
    Headline: ({ children, ...props }) =>
      React.createElement(Text, props, children),
    Subheading: ({ children, ...props }) =>
      React.createElement(Text, props, children),
    Appbar: {
      Header: ({ children, ...props }) =>
        React.createElement(View, props, children),
      Content: ({ children, ...props }) =>
        React.createElement(View, props, children),
      Action: ({ icon, onPress, ...props }) =>
        React.createElement(Text, { ...props, onPress }, icon),
      BackAction: ({ onPress, ...props }) =>
        React.createElement(Text, { ...props, onPress }, '←'),
    },
    Searchbar: ({ value, onChangeText, placeholder, ...props }) =>
      React.createElement(
        View,
        props,
        React.createElement(TextInput, { value, onChangeText, placeholder }),
      ),
    Modal: ({ children, visible, ...props }) =>
      visible ? React.createElement(View, props, children) : null,
    ProgressBar: ({ progress, ...props }) =>
      React.createElement(View, props),
    HelperText: ({ children, type, ...props }) =>
      React.createElement(Text, props, children),
    useTheme: () => ({
      colors: {
        primary: '#000',
        background: '#fff',
        surface: '#fff',
        accent: '#000',
        error: '#f00',
        text: '#000',
        onSurface: '#000',
        disabled: '#999',
        placeholder: '#999',
        backdrop: 'rgba(0,0,0,0.5)',
      },
      fonts: {
        regular: { fontFamily: 'Roboto', fontWeight: '400' },
        medium: { fontFamily: 'Roboto', fontWeight: '500' },
        light: { fontFamily: 'Roboto', fontWeight: '300' },
        thin: { fontFamily: 'Roboto', fontWeight: '100' },
      },
    }),
    withTheme: (Component) => (props) =>
      React.createElement(Component, { ...props, theme: { colors: {} } }),
  };
});

// Mock RxDB document helpers
jest.mock('rxdb', () => {
  const actual = jest.requireActual('rxdb');
  return {
    ...actual,
    isRxDocument: jest.fn(() => false),
    isRxCollection: jest.fn(() => false),
    isRxDatabase: jest.fn(() => false),
    isRxQuery: jest.fn(() => false),
    isRxSchema: jest.fn(() => false),
    addRxPlugin: jest.fn(),
  };
});

// Virtual mocks for modules not installed in node_modules
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: 'GestureHandlerRootView',
  Swipeable: 'Swipeable',
  TouchableOpacity: 'TouchableOpacity',
  TouchableHighlight: 'TouchableHighlight',
  PanGestureHandler: 'PanGestureHandler',
  TapGestureHandler: 'TapGestureHandler',
  LongPressGestureHandler: 'LongPressGestureHandler',
  PinchGestureHandler: 'PinchGestureHandler',
  RotationGestureHandler: 'RotationGestureHandler',
  FlingGestureHandler: 'FlingGestureHandler',
  NativeViewGestureHandler: 'NativeViewGestureHandler',
  State: { UNDETERMINED: 0, FAILED: 1, BEGAN: 2, CANCELLED: 3, ACTIVE: 4, END: 5 },
  Directions: { LEFT: 1, RIGHT: 2, UP: 4, DOWN: 8 },
  Gesture: { Tap: () => ({}), Pan: () => ({}), Pinch: () => ({}), Rotation: () => ({}), Fling: () => ({}), LongPress: () => ({}), Native: () => ({}) },
}), { virtual: true });

jest.mock('expo-sqlite', () => ({
  openDatabase: jest.fn(() => ({
    transaction: jest.fn((cb) => cb({ executeSql: jest.fn() })),
  })),
  SQLiteProvider: ({ children }) => null,
  useSQLiteContext: jest.fn(() => ({})),
}), { virtual: true });

jest.mock('expo-modules-core', () => ({
  NativeModulesProxy: {},
  requireNativeModule: () => ({}),
  requireOptionalNativeModule: () => ({}),
  EventEmitter: class {},
}), { virtual: true });

jest.mock('react-native-reanimated', () => ({
  default: { createAnimatedComponent: (c) => c },
  useSharedValue: jest.fn(() => ({ value: 0 })),
  useAnimatedStyle: jest.fn(() => ({})),
  withTiming: jest.fn(() => 0),
  withSpring: jest.fn(() => 0),
  Easing: { in: (v) => v, out: (v) => v, inOut: (v) => v },
}), { virtual: true });

jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const View = require('react-native').View;
  return {
    default: ({ children, ...props }) => React.createElement(View, props, children),
    PagerView: ({ children, ...props }) => React.createElement(View, props, children),
  };
}, { virtual: true });

// Mock global crypto for uuid
if (!global.crypto || !global.crypto.randomUUID) {
  global.crypto = {
    ...(global.crypto || {}),
    randomUUID: jest.fn(() => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    })),
  };
}
