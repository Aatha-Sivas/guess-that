import React, { PropsWithChildren } from 'react';
import { SafeAreaView, SafeAreaViewProps } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ViewStyle } from 'react-native';
import { theme } from '../theme';

type BG = 'bg' | 'card';
type Props = PropsWithChildren<{
  background?: BG;
  edges?: SafeAreaViewProps['edges'];
  style?: ViewStyle;
}>;

const t = theme('purple');

export default function Screen({ children, background = 'bg', edges = ['top','bottom','left','right'], style }: Props) {
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: background === 'bg' ? t.bg : t.card }, style]}>
      {/* You can keep StatusBar in App.tsx; keeping it here is also fine */}
      <StatusBar style="light" translucent />
      {children}
    </SafeAreaView>
  );
}