import React, { useRef, useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet, TouchableOpacity, Image, ImageBackground } from 'react-native';
import { KeyboardAvoidingView, Platform, ScrollView, Keyboard, PermissionsAndroid } from 'react-native';
import { TouchableWithoutFeedback } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';
import logo from './assets/LoginIcon.jpg';
import showIcon from './assets/show.png';
import hideIcon from './assets/hide.png';
import messaging from '@react-native-firebase/messaging';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


type RootStackParamList = {
    Login: undefined;
    Menu: undefined;
    ReciboProduccion: { nomina: string; nombre: string; area: string; autoFetch?: boolean };
    ReciboCalidad: { nomina: string; nombre: string; area: string; autoFetch?: boolean };
    ReciboEmbarques: { nomina: string; nombre: string; area: string; autoFetch?: boolean };
};

// A qué pantalla de recibo mandar según el destino de la solicitud pendiente.
const RECIBO_SCREEN_BY_DESTINO: Record<string, keyof RootStackParamList> = {
    Produccion: 'ReciboProduccion',
    Calidad: 'ReciboCalidad',
    Embarques: 'ReciboEmbarques',
};

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface Props {
    navigation: LoginScreenNavigationProp;
}

const LoginScreen: React.FC<Props> = ({ navigation }) => {
    const [nomina, setNomina] = useState('');
    const [password, setPassword] = useState('');
    const passwordRef = useRef<TextInput>(null);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const insets = useSafeAreaInsets();

    const requestCameraPermission = async (): Promise<boolean> => {
        if (Platform.OS === 'ios') {
            const result = await request(PERMISSIONS.IOS.CAMERA);
            return result === RESULTS.GRANTED;
        } else {
            const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
            return result === PermissionsAndroid.RESULTS.GRANTED;
        }
    };

    const handleLogin = async () => {
        try {
            setError('');

            const response = await fetch('http://192.168.16.146:3002/api/hotparts/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    nomina: nomina,
                    password: password,
                }),
            });

            if (response.ok) {
                const data = await response.json();

                await AsyncStorage.setItem('user', JSON.stringify(data.user));
                setNomina('');
                setPassword('');

                const token = await messaging().getToken();
                console.log('FCM Token:', token);

                await fetch('http://192.168.16.146:3002/api/hotparts/registroToken', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        token: token,
                        nomina: nomina,
                    }),
                });

                // ✅ Solicitar permiso de cámara después de iniciar sesión
                const cameraGranted = await requestCameraPermission();
                if (!cameraGranted) {
                    console.warn('Permiso de cámara no concedido');
                }

                // Si el login vino de tocar "Recibir" en el aviso de solicitud de entrega,
                // se retoma directo en la pantalla de recibo correspondiente en vez de ir al Menu.
                const pendingRecibo = await AsyncStorage.getItem('pendingRecibo');
                if (pendingRecibo) {
                    await AsyncStorage.removeItem('pendingRecibo');
                    const screen = RECIBO_SCREEN_BY_DESTINO[pendingRecibo];
                    if (screen && data.user.Area === pendingRecibo) {
                        navigation.navigate(screen as any, {
                            nomina: data.user.Nomina,
                            nombre: data.user.Nombre,
                            area: data.user.Area,
                            autoFetch: true,
                        });
                        return;
                    }
                }

                navigation.navigate('Menu');
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Error en el servidor');
            }
        } catch (err) {
            console.log("Error:", err);
            setError('Error de conexión al servidor');
        }
    };


    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                    <ImageBackground
                        source={require('./assets/fondo1.jpg')}
                        resizeMode="cover"
                        style={[styles.container, { paddingBottom: 20 + insets.bottom }]}
                    >
                        <View style={styles.content}>
                            <View style={styles.logoWrapper}>
                                <Image source={logo} style={styles.image} />
                            </View>

                            <Text style={styles.headerText}>Hot Parts</Text>
                            <Text style={styles.subHeaderText}>Inicia sesión para continuar</Text>

                            <View style={styles.card}>
                                <Text style={styles.inputLabel}>Nómina</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ingresa tu nómina"
                                    value={nomina}
                                    onChangeText={setNomina}
                                    placeholderTextColor="#a0a0a0"
                                    returnKeyType="next"
                                    onSubmitEditing={() => passwordRef?.current?.focus()}
                                />

                                <Text style={styles.inputLabel}>Contraseña</Text>
                                <View style={styles.passwordContainer}>
                                    <TextInput
                                        style={styles.passwordInput}
                                        ref={passwordRef}
                                        placeholder="Ingresa tu contraseña"
                                        secureTextEntry={!showPassword}
                                        value={password}
                                        onChangeText={setPassword}
                                        placeholderTextColor="#a0a0a0"
                                        returnKeyType="done"
                                        onSubmitEditing={handleLogin}
                                    />
                                    <TouchableOpacity
                                        style={styles.eyeButton}
                                        onPress={() => setShowPassword(prev => !prev)}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Image
                                            source={showPassword ? hideIcon : showIcon}
                                            style={styles.eyeIcon}
                                            resizeMode="contain"
                                        />
                                    </TouchableOpacity>
                                </View>

                                {error ? <Text style={styles.error}>{error}</Text> : null}

                                <TouchableOpacity style={styles.button} onPress={handleLogin} activeOpacity={0.8}>
                                    <Text style={styles.buttonText}>Iniciar sesión</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <Text style={styles.footerText}>TMP Hot Parts 2025 ®</Text>
                    </ImageBackground>
                </ScrollView>
            </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 28,
        paddingTop: 60,
        paddingBottom: 20,
    },
    content: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoWrapper: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
    },
    image: {
        width: 72,
        height: 72,
        borderRadius: 36,
    },
    headerText: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#0d3f73',
        textAlign: 'center',
    },
    subHeaderText: {
        fontSize: 14,
        color: '#3d3d3d',
        marginBottom: 28,
        textAlign: 'center',
    },
    card: {
        width: '100%',
        backgroundColor: 'white',
        borderRadius: 16,
        paddingHorizontal: 22,
        paddingVertical: 26,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#555',
        marginBottom: 6,
        marginLeft: 2,
    },
    input: {
        width: '100%',
        height: 52,
        borderColor: '#e2e2e2',
        borderWidth: 1,
        marginBottom: 18,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: '#f7f7f7',
        color: 'black',
        fontSize: 15,
    },
    passwordContainer: {
        width: '100%',
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        borderColor: '#e2e2e2',
        borderWidth: 1,
        marginBottom: 18,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: '#f7f7f7',
    },
    passwordInput: {
        flex: 1,
        height: '100%',
        color: 'black',
        fontSize: 15,
    },
    eyeButton: {
        paddingLeft: 10,
    },
    eyeIcon: {
        width: 20,
        height: 20,
        tintColor: '#777',
    },
    error: {
        color: '#d33',
        marginBottom: 15,
        textAlign: 'center',
        fontSize: 13,
    },
    button: {
        backgroundColor: '#116bbf',
        width: '100%',
        paddingVertical: 15,
        alignItems: 'center',
        borderRadius: 10,
        marginTop: 4,
        shadowColor: '#116bbf',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    footerText: {
        paddingTop: 16,
        color: '#3d3d3d',
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
});

export default LoginScreen;
