import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logo from './assets/TMP2.png';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
    Menu: undefined;
    EntregaProgramacion: { nomina: string; nombre: string; area: string };
    EntregaProduccion: { nomina: string; nombre: string; area: string };
    EntregaCalidad: { nomina: string; nombre: string; area: string };
    ReciboProduccion: { nomina: string; nombre: string; area: string };
    ReciboCalidad: { nomina: string; nombre: string; area: string };
    ReciboEmbarques: { nomina: string; nombre: string; area: string };
};

type MenuScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Menu'>;

interface Props {
    navigation: MenuScreenNavigationProp;
}

const MenuScreen: React.FC<Props> = ({ navigation }) => {
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const loadUserData = async () => {
            const userData = await AsyncStorage.getItem('user');
            if (userData) {
                setUser(JSON.parse(userData));
            }
        };

        loadUserData();
    }, []);

    if (!user) {
        return (
            <View style={styles.container}>
                <Text style={styles.loadingText}>Cargando datos del usuario...</Text>
            </View>
        );
    }

    const handleEntrega = () => {
        const routeMap: { [key: string]: string } = {
            'Programacion': 'EntregaProgramacion',
            'Produccion': 'EntregaProduccion',
            'Calidad': 'EntregaCalidad',
        };

        if (routeMap[user.Area]) {
            navigation.navigate(routeMap[user.Area], {
                nomina: user.Nomina,
                nombre: user.Nombre,
                area: user.Area,
            });
        }
    };

    const handleRecibo = () => {
        const routeMap: { [key: string]: string } = {
            'Produccion': 'ReciboProduccion',
            'Calidad': 'ReciboCalidad',
            'Embarques': 'ReciboEmbarques',
        };

        if (routeMap[user.Area]) {
            navigation.navigate(routeMap[user.Area], {
                nomina: user.Nomina,
                nombre: user.Nombre,
                area: user.Area,
            });
        }
    };

    return (
        <ImageBackground
            source={require('./assets/fondo2.jpg')}
            style={styles.container}
        >
            <View style={styles.container}>
                <Text style={styles.welcomeText}> {user.Nomina}     {user.Nombre}    {user.Area}</Text>

                <Image
                    source={logo}
                    style={styles.image}
                    resizeMode="contain"
                />

                <Text style={styles.headerText}>Elige una opción</Text>

                {user.Area === 'Programacion' && (
                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleEntrega}
                    >
                        <Text style={styles.buttonText}>Entregar</Text>
                    </TouchableOpacity>
                )}

                {user.Area === 'Embarques' && (
                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleRecibo}
                    >
                        <Text style={styles.buttonText}>Recibir</Text>
                    </TouchableOpacity>
                )}

                {user.Area === 'Calidad' && (
                    <>
                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleEntrega}
                        >
                            <Text style={styles.buttonText}>Entregar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleRecibo}
                        >
                            <Text style={styles.buttonText}>Recibir</Text>
                        </TouchableOpacity>
                    </>
                )}

                {user.Area === 'Produccion' && (
                    <>
                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleEntrega}
                        >
                            <Text style={styles.buttonText}>Entregar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleRecibo}
                        >
                            <Text style={styles.buttonText}>Recibir</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
            <Text style={styles.footerText}>TMP Hot Parts 2025 ©</Text>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 5,
        paddingHorizontal: 1,
    },
    headerText: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        marginTop: 1
    },
    image: {
        width: '60%',
        height: '25%',
        aspectRatio: 1,
        marginBottom: 1,
    },
    welcomeText: {
        fontSize: 12,
        color: 'black',
        marginBottom: 10,
        marginTop: 20,
    },
    loadingText: {
        fontSize: 18,
        textAlign: 'center',
        color: '#333',
    },
    button: {
        backgroundColor: '#116bbf',
        paddingVertical: 15,
        //addingHorizontal: 70,
        marginBottom: 40,
        borderRadius: 5,
        width: 250,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footerText: {
        position: 'relative',
        //bottom: 1,
        marginTop: 100,
        left: '20%',
        color: 'black',
        fontSize: 12,
        fontWeight: 'bold'

    },
});

export default MenuScreen;
