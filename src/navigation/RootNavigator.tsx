import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';

import { CdrmsApp } from '@/src/cdrms/CdrmsApp';
import type { RootStackParamList } from '@/src/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function MainScreen() {
  return <CdrmsApp />;
}

export function RootNavigator() {
  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { flex: 1 },
          }}
        >
          <Stack.Screen name="Main" component={MainScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}
