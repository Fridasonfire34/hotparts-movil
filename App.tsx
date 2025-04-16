import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from './src/screens/LoginScreen';
import MenuScreen from './src/screens/MenuScreen';
import EntregaProgramacionScreen from './src/screens/EntregaProgramacionScreen';
import EntregaCalidadScreen from './src/screens/EntregaCalidadScreen';
import EntregaProduccionScreen from './src/screens/EntregaProduccionScreen';
import ReciboProduccionScreen from './src/screens/ReciboProduccionScreen';
import ReciboCalidadScreen from './src/screens/ReciboCalidadScreen';
import ReciboEmbarquesScreen from './src/screens/ReciboEmbarquesScreen';
import ReordenScreen from './src/screens/ReordenScreen';

type RootStackParamList = {
  Login: undefined;
  Menu: undefined;
  EntregaProgramacion: { nomina: string; nombre: string; area: string };
  EntregaProduccion: { nomina: string; nombre: string; area: string };
  EntregaCalidad: { nomina: string; nombre: string; area: string };
  ReciboProduccion: { nomina: string; nombre: string; area: string };
  ReciboCalidad: { nomina: string; nombre: string; area: string };
  ReciboEmbarques: { nomina: string; nombre: string; area: string };
  ReordenScreen: { nomina: string; nombre: string; area: string };
};

const Stack = createStackNavigator<RootStackParamList>();

const App: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Menu"
          component={MenuScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EntregaProgramacion"
          component={EntregaProgramacionScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EntregaProduccion"
          component={EntregaProduccionScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ReciboProduccion"
          component={ReciboProduccionScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EntregaCalidad"
          component={EntregaCalidadScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ReciboCalidad"
          component={ReciboCalidadScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ReordenScreen"
          component={ReordenScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ReciboEmbarques"
          component={ReciboEmbarquesScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
