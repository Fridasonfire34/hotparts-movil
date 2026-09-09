import React, { useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import { PermissionsAndroid, Platform, Alert, Linking, Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

import LoginScreen from './src/screens/LoginScreen';
import MenuScreen from './src/screens/MenuScreen';
import EntregaProgramacionScreen from './src/screens/EntregaProgramacionScreen';
import EntregaCalidadScreen from './src/screens/EntregaCalidadScreen';
import EntregaProduccionScreen from './src/screens/EntregaProduccionScreen';
import ReciboProduccionScreen from './src/screens/ReciboProduccionScreen';
import ReciboCalidadScreen from './src/screens/ReciboCalidadScreen';
import ReciboEmbarquesScreen from './src/screens/ReciboEmbarquesScreen';
import ReordenScreen from './src/screens/ReordenScreen';
import NotificacionesScreen from './src/screens/NotificacionesScreen';
import VerHotPartsScreen from './src/screens/VerHotPartsScreen';

export type RootStackParamList = {
  Login: undefined;
  Menu: undefined;
  Notificaciones: undefined;
  VerHotParts: undefined;
  EntregaProgramacion: { nomina: string; nombre: string; area: string };
  EntregaProduccion: { nomina: string; nombre: string; area: string; nominaEntrega?: string };
  EntregaCalidad: { nomina: string; nombre: string; area: string };
  ReciboProduccion: { nomina: string; nombre: string; area: string; nominaEntrega?: string; autoFetch?: boolean };
  ReciboCalidad: { nomina: string; nombre: string; area: string; nominaEntrega?: string; autoFetch?: boolean };
  ReciboEmbarques: { nomina: string; nombre: string; area: string; nominaEntrega?: string; autoFetch?: boolean };
  ReordenScreen: { nomina: string; nombre: string; area: string };
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const Stack = createStackNavigator<RootStackParamList>();
const VERSION_JSON_URL = 'https://hot-parts.web.app/version.json'; // La URL de tu version.json

// Versión instalada de la app. Debe actualizarse a mano en cada release para
// que coincida con el "version" que se publica en public/version.json.
const CURRENT_APP_VERSION = '1.4';

// Compara versiones tipo "1.0.10" vs "1.0.7" numéricamente (no como texto).
const esVersionMasNueva = (remota: string, actual: string) => {
  const a = remota.split('.').map(Number);
  const b = actual.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
};

const App: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<{ version: string; url: string; changelog?: string } | null>(null);
  const [solicitudRecibo, setSolicitudRecibo] = useState<{ origen: string; destino: string } | null>(null);

  const detectarSolicitudRecibo = (data?: Record<string, string>, opts?: { onlyIfIdle?: boolean }) => {
    if (data?.tipo !== 'solicitud_recibo') return;

    if (opts?.onlyIfIdle) {
      // Si llegó mientras el usuario ya está usando la app (primer plano), no se
      // interrumpe con el modal si está en medio de otro flujo (selector de QR,
      // escaneo, etc.) — se encimaba con el modal de esa pantalla. La notificación
      // del sistema (notifee) ya se mostró de todos modos, así que no se pierde.
      const currentRoute = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;
      if (currentRoute !== 'Menu' && currentRoute !== 'Login') {
        return;
      }
    }

    setSolicitudRecibo({ origen: data.origen, destino: data.destino });
  };

  const handleCerrarSolicitud = () => setSolicitudRecibo(null);

  const bumpUnreadCount = async () => {
    const current = parseInt((await AsyncStorage.getItem('unreadNotificationsCount')) ?? '0', 10);
    const next = (Number.isNaN(current) ? 0 : current) + 1;
    await AsyncStorage.setItem('unreadNotificationsCount', String(next));
    return next;
  };

  // A qué pantalla de recibo mandar según el destino de la solicitud.
  const RECIBO_SCREEN_BY_DESTINO: Record<string, keyof RootStackParamList> = {
    Produccion: 'ReciboProduccion',
    Calidad: 'ReciboCalidad',
    Embarques: 'ReciboEmbarques',
  };

  const handleRecibirSolicitud = async () => {
    const destino = solicitudRecibo?.destino;
    setSolicitudRecibo(null);

    const userData = await AsyncStorage.getItem('user');
    if (!userData) {
      // Sin sesión: se guarda la intención y se retoma en LoginScreen tras iniciar sesión.
      if (destino) await AsyncStorage.setItem('pendingRecibo', destino);
      if (navigationRef.isReady()) navigationRef.navigate('Login');
      return;
    }

    const user = JSON.parse(userData);
    const screen = destino ? RECIBO_SCREEN_BY_DESTINO[destino] : undefined;

    // Solo se redirige si el usuario logueado es justo el área a la que iba dirigida
    // esta solicitud; para cualquier otra área, "Recibir" no hace nada.
    if (screen && user.Area === destino && navigationRef.isReady()) {
      navigationRef.navigate(screen as any, {
        nomina: user.Nomina,
        nombre: user.Nombre,
        area: user.Area,
        autoFetch: true,
      });
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setup = async () => {
      // Verifica si hay una versión más nueva publicada en version.json. Si la
      // hay, se bloquea la app con un modal obligatorio hasta que actualice
      // (ver render). Si falla la petición (sin internet, etc.) simplemente
      // no se muestra nada y la app sigue funcionando con la versión actual.
      try {
        const { data } = await axios.get(VERSION_JSON_URL);
        if (data?.version && esVersionMasNueva(data.version, CURRENT_APP_VERSION)) {
          setUpdateInfo({ version: data.version, url: data.apk_url, changelog: data.changelog });
        }
      } catch (error) {
        console.log('No se pudo verificar la versión disponible:', error);
      }

      // Configuración de Firebase y Notifee
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

        const unreadCount = await bumpUnreadCount();

        await notifee.displayNotification({
          title: remoteMessage.notification?.title,
          body: remoteMessage.notification?.body,
          android: {
            channelId: 'default',
            smallIcon: 'ic_notification',
            pressAction: { id: 'default' },
            // Numerito en el ícono de la app (launchers que lo soportan, ej. Samsung One UI).
            badgeCount: unreadCount,
          },
        });

        detectarSolicitudRecibo(remoteMessage.data as Record<string, string> | undefined, { onlyIfIdle: true });
      });

      messaging().setBackgroundMessageHandler(async remoteMessage => {
        console.log('📩 Notificación en segundo plano:', remoteMessage);
        // Aquí no se controla el ícono de la notificación que Firebase ya
        // mostró solo (llega con "notification" en el payload); esto solo
        // mantiene el contador sincronizado para el punto rojo del Menu.
        await bumpUnreadCount();
      });

      // App abierta desde segundo plano al tocar la notificación.
      messaging().onNotificationOpenedApp(remoteMessage => {
        detectarSolicitudRecibo(remoteMessage.data as Record<string, string> | undefined);
      });

      // App abierta desde cerrada (cold start) al tocar la notificación.
      const initialNotification = await messaging().getInitialNotification();
      if (initialNotification) {
        detectarSolicitudRecibo(initialNotification.data as Record<string, string> | undefined);
      }
    };

    setup();
  }, []); // Empty dependency array, se ejecuta solo al montar

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator initialRouteName="Login">
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Menu" component={MenuScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Notificaciones" component={NotificacionesScreen} options={{ headerShown: false }} />
          <Stack.Screen name="VerHotParts" component={VerHotPartsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="EntregaProgramacion" component={EntregaProgramacionScreen} options={{ headerShown: false }} />
          <Stack.Screen name="EntregaProduccion" component={EntregaProduccionScreen} options={{ headerShown: false }} />
          <Stack.Screen name="EntregaCalidad" component={EntregaCalidadScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ReciboProduccion" component={ReciboProduccionScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ReciboCalidad" component={ReciboCalidadScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ReciboEmbarques" component={ReciboEmbarquesScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ReordenScreen" component={ReordenScreen} options={{ headerShown: false }} />
        </Stack.Navigator>

        <Modal
          transparent
          animationType="fade"
          visible={!!solicitudRecibo}
          onRequestClose={handleCerrarSolicitud}
        >
          <View style={modalStyles.background}>
            <View style={modalStyles.container}>
              <Text style={modalStyles.title}>
                {solicitudRecibo?.origen} desea Entregar Hot Parts
              </Text>
              <View style={modalStyles.buttonsRow}>
                <TouchableOpacity style={modalStyles.closeButton} onPress={handleCerrarSolicitud} activeOpacity={0.7}>
                  <Text style={modalStyles.closeButtonText}>Cerrar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={modalStyles.receiveButton} onPress={handleRecibirSolicitud} activeOpacity={0.7}>
                  <Text style={modalStyles.receiveButtonText}>Recibir</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          transparent
          animationType="fade"
          visible={!!updateInfo}
          onRequestClose={() => {}} // Obligatorio: el botón atrás de Android no debe cerrarlo.
        >
          <View style={modalStyles.background}>
            <View style={modalStyles.container}>
              <Text style={modalStyles.title}>Nueva versión disponible</Text>
              <Text style={modalStyles.updateBody}>
                Hay una nueva versión ({updateInfo?.version}) de Hot Parts. Debes
                actualizar para seguir usando la app.
                {updateInfo?.changelog ? `\n\n${updateInfo.changelog}` : ''}
              </Text>
              <TouchableOpacity
                style={modalStyles.updateButton}
                onPress={() => updateInfo?.url && Linking.openURL(updateInfo.url)}
                activeOpacity={0.7}
              >
                <Text style={modalStyles.receiveButtonText}>Actualizar ahora</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

const modalStyles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 14,
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0d3f73',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  closeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  closeButtonText: {
    color: '#333',
    fontWeight: 'bold',
  },
  receiveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#0e5699',
  },
  receiveButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  updateBody: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  updateButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#0e5699',
  },
});

export default App;
