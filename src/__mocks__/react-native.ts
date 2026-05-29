// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require('react');

const host = (name: string) =>
  function MockHostComponent({ children, ...props }: Record<string, unknown>) {
    return React.createElement(name, props, children);
  };

const ReactNative = {
  Alert: {
    alert: jest.fn(),
  },
  Image: host('Image'),
  Linking: {
    openURL: jest.fn().mockResolvedValue(true),
    canOpenURL: jest.fn().mockResolvedValue(true),
  },
  Share: {
    share: jest.fn().mockResolvedValue({ action: 'sharedAction' }),
  },
  Platform: {
    OS: 'ios',
    select: (obj: Record<string, unknown>) => obj['ios'] ?? obj['default'],
  },
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
    flatten: (style: unknown) => style,
  },
  ActivityIndicator: host('ActivityIndicator'),
  KeyboardAvoidingView: host('KeyboardAvoidingView'),
  Modal: host('Modal'),
  RefreshControl: host('RefreshControl'),
  SafeAreaView: host('SafeAreaView'),
  ScrollView: host('ScrollView'),
  StatusBar: host('StatusBar'),
  Text: host('Text'),
  TextInput: host('TextInput'),
  TouchableOpacity: host('TouchableOpacity'),
  View: host('View'),
};

ReactNative.FlatList = function FlatListMock({
  data = [],
  renderItem,
  keyExtractor,
  ListEmptyComponent,
  children,
  ...props
}: Record<string, unknown>) {
  const items =
    Array.isArray(data) && typeof renderItem === 'function' && data.length > 0
      ? data.map((item, index) =>
          React.createElement(
            React.Fragment,
            {
              key: typeof keyExtractor === 'function' ? keyExtractor(item, index) : String(index),
            },
            renderItem({ item, index }),
          ),
        )
      : ListEmptyComponent
        ? typeof ListEmptyComponent === 'function'
          ? React.createElement(ListEmptyComponent)
          : ListEmptyComponent
        : children;

  return React.createElement('FlatList', props, items);
};

module.exports = ReactNative;
