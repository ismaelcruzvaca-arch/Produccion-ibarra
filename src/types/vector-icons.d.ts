declare module '@expo/vector-icons' {
  import { ComponentType } from 'react';
  import { TextProps } from 'react-native';

  export interface IconProps {
    name: string;
    size?: number;
    color?: string;
  }

  export const MaterialCommunityIcons: ComponentType<IconProps & TextProps>;
  export const MaterialIcons: ComponentType<IconProps & TextProps>;
  export const Ionicons: ComponentType<IconProps & TextProps>;
}
