// App.tsx  (top of file — these two lines must be first)
import "react-native-reanimated";
import "react-native-gesture-handler";

import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from 'expo-status-bar';

import Home from "./src/screens/Home";
import Setup from "./src/screens/Setup";
import Cover from "./src/screens/Cover";
import Turn from "./src/screens/Turn";
import RoundEnd from "./src/screens/RoundEnd";
import { initDb } from "./src/db";
import { ensureSeed, topUpIfLow } from "./src/repo/CardRepository";

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    (async () => {
      await initDb();
      await ensureSeed();
      await topUpIfLow();
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" translucent />
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home" component={Home} />
            <Stack.Screen name="Setup" component={Setup} />
            <Stack.Screen name="Cover" component={Cover} />
            <Stack.Screen name="Turn" component={Turn} />
            <Stack.Screen name="RoundEnd" component={RoundEnd} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
