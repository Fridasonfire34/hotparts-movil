import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet, TouchableOpacity, Image, ImageBackground } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';
import logo from './assets/LoginIcon.jpg';
import messaging from '@react-native-firebase/messaging';


type RootStackParamList = {
    Login: undefined;
    Menu: undefined;
};

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface Props {
    navigation: LoginScreenNavigationProp;
}

const LoginScreen: React.FC<Props> = ({ navigation }) => {
    const [nomina, setNomina] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async () => {
        try {
            setError('');

            const response = await fetch('http://192.168.16.146:3002/api/login', {
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

                await fetch('http://192.168.16.146:3002/api/registroToken', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        token: token,
                        nomina: nomina, // o data.user.id si así lo llamas
                    }),
                });

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
        <ImageBackground
            source={require('./assets/fondo1.jpg')}
            resizeMode="cover"
            style={styles.container}
        >
            <Text style={styles.headerText}>Iniciar Sesión en Hot Parts</Text>

            <Image source={logo} style={styles.image} />

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Nómina"
                    value={nomina}
                    onChangeText={setNomina}
                    placeholderTextColor="#999"
                />
                <TextInput
                    style={styles.input}
                    placeholder="Contraseña"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    placeholderTextColor="#999"
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}

                <TouchableOpacity style={styles.button} onPress={handleLogin}>
                    <Text style={styles.buttonText}>Iniciar sesión</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.footerText}>TMP Hot Parts 2025 ©</Text>
        </ImageBackground >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        //   justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 100,
        paddingHorizontal: 50,
        backgroundColor: 'white',
        position: 'relative'
    },
    headerText: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 40,
    },
    inputContainer: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    input: {
        width: '95%',
        height: 60,
        borderColor: '#ebebeb',
        borderWidth: 1,
        marginBottom: 20,
        paddingLeft: 8,
        borderRadius: 5,
        backgroundColor: '#ebebeb',
        color: 'black',
    },
    error: {
        color: 'red',
        marginBottom: 15,
    },
    button: {
        backgroundColor: 'white',
        width: '95%',
        paddingVertical: 13,
        alignItems: 'center',
        borderRadius: 5,
    },
    buttonText: {
        color: '#116bbf',
        fontSize: 18,
        fontWeight: 'bold',
    },
    image: {
        width: 100,
        height: 100,
        marginBottom: 40,
    },
    footerText: {
        position: 'relative',
        //bottom: 1,
        marginTop: 220,
        left: '30%',
        color: 'black',
        fontSize: 14,
        fontWeight: 'bold'
    },
});

export default LoginScreen;
