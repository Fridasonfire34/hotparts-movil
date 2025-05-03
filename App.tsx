import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import { PermissionsAndroid, Platform } from 'react-native';

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
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setup = async () => {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'Permiso para Notificaciones',
            message: 'Esta app necesita permiso para mostrar notificaciones.',
            buttonPositive: 'Aceptar',
          }
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('✅ Permiso de notificaciones concedido');
        } else {
          console.log('❌ Permiso de notificaciones denegado');
        }
      }

      // Firebase + Notifee setup
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('✅ Firebase autorizado');
      }

      await notifee.createChannel({
        id: 'default',
        name: 'Default Channel',
      });

      messaging().onMessage(async remoteMessage => {
        console.log('📩 Notificación recibida en primer plano:', remoteMessage);

        await notifee.displayNotification({
          title: remoteMessage.notification?.title,
          body: remoteMessage.notification?.body,
          android: {
            channelId: 'default',
            smallIcon: 'ic_launcher',
            pressAction: { id: 'default' },
          },
        });
      });

      messaging().setBackgroundMessageHandler(async remoteMessage => {
        console.log('📩 Notificación en segundo plano:', remoteMessage);
      });
    };

    setup();
  }, []);


  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Menu" component={MenuScreen} options={{ headerShown: false }} />
        <Stack.Screen name="EntregaProgramacion" component={EntregaProgramacionScreen} options={{ headerShown: false }} />
        <Stack.Screen name="EntregaProduccion" component={EntregaProduccionScreen} options={{ headerShown: false }} />
        <Stack.Screen name="EntregaCalidad" component={EntregaCalidadScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ReciboProduccion" component={ReciboProduccionScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ReciboCalidad" component={ReciboCalidadScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ReciboEmbarques" component={ReciboEmbarquesScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ReordenScreen" component={ReordenScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
