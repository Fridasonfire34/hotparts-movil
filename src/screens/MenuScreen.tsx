import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logo from './assets/TMP2.png';
import { StackNavigationProp } from '@react-navigation/stack';
import { Dimensions } from 'react-native';


type RootStackParamList = {
    Menu: undefined;
    EntregaProgramacion: { nomina: string; nombre: string; area: string };
    EntregaProduccion: { nomina: string; nombre: string; area: string };
    EntregaCalidad: { nomina: string; nombre: string; area: string };
    ReciboProduccion: { nomina: string; nombre: string; area: string };
    ReciboCalidad: { nomina: string; nombre: string; area: string };
    ReciboEmbarques: { nomina: string; nombre: string; area: string };
    ReordenScreen: { nomina: string; nombre: string; area: string };
};

type MenuScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Menu'>;

interface Props {
    navigation: MenuScreenNavigationProp;
}

const MenuScreen: React.FC<Props> = ({ navigation }) => {
    const [user, setUser] = useState<any>(null);
    const screenHeight = Dimensions.get('window').height;

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

    const handleReorden = () => {
        const routeMap: { [key: string]: string } = {
            'Calidad': 'ReordenScreen'
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
            <Text style={styles.welcomeText}> {user.Nomina}     {user.Nombre}    {user.Area}</Text>

            <Text style={styles.Text}> Hot Parts</Text>

            {user.Area !== 'Programacion' && user.Area !== 'Embarques' && (
                <Text style={styles.headerText}>Elige una opción</Text>
            )}
            {user.Area === 'Programacion' && (

                <TouchableOpacity
                    style={styles.buttonProgramacion}
                    onPress={handleEntrega}
                >
                    <Image
                        source={require('./assets/entrega.png')}
                        style={styles.buttonImage}
                        resizeMode="contain"
                    />
                    <Text style={styles.buttonText}>Entregar</Text>
                </TouchableOpacity>
            )}

            {user.Area === 'Embarques' && (
                <TouchableOpacity
                    style={styles.buttonEmbarques}
                    onPress={handleRecibo}
                >
                    <Image
                        source={require('./assets/recibir.png')}
                        style={styles.buttonImageRecibe}
                        resizeMode="contain"
                    />
                    <Text style={styles.buttonText}>Recibir</Text>
                </TouchableOpacity>
            )}

            {user.Area === 'Calidad' && (
                <>
                    <TouchableOpacity
                        style={styles.buttonCalidad}
                        onPress={handleEntrega}
                    >
                        <Image
                            source={require('./assets/entrega.png')}
                            style={styles.buttonImage}
                            resizeMode="contain"
                        />
                        <Text style={styles.buttonText}>Entregar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.buttonCalidad}
                        onPress={handleRecibo}
                    >
                        <Image
                            source={require('./assets/recibir.png')}
                            style={styles.buttonImageRecibe}
                            resizeMode="contain"
                        />
                        <Text style={styles.buttonText}>Recibir</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.buttonCalidad}
                        onPress={handleReorden}
                    >
                        <Image
                            source={require('./assets/reorden.png')}
                            style={styles.buttonImageReorden}
                            resizeMode="contain"
                        />
                        <Text style={styles.buttonText}>Reorden</Text>
                    </TouchableOpacity>
                </>
            )}

            {user.Area === 'Produccion' && (
                <>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleEntrega}
                    >
                        <Image
                            source={require('./assets/entrega.png')}
                            style={styles.buttonImage}
                            resizeMode="contain"
                        />
                        <Text style={styles.buttonText}>Entregar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleRecibo}
                    >
                        <Image
                            source={require('./assets/recibir.png')}
                            style={styles.buttonImageRecibe}
                            resizeMode="center"
                        />
                        <Text style={styles.buttonText}>Recibir</Text>
                    </TouchableOpacity>
                </>
            )}

            <Text style={styles.footerText}>TMP Hot Parts 2025 ©</Text>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingHorizontal: 1,
    },
    headerText: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    welcomeText: {
        fontSize: 12,
        color: 'black',
        marginBottom: 10,
    },
    Text: {
        fontSize: 24,
        color: 'black',
        fontWeight: 'bold',
        marginBottom: 1,
        marginTop: 5,
    },
    loadingText: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 80,
    },
    buttonCalidad: {
        width: 340,
        height: '26%',
        borderRadius: 10,
        justifyContent: 'flex-end',
        alignItems: 'center',
        elevation: 3,
        marginHorizontal: 15,
        marginBottom: 5,
        paddingBottom: 5,
    },
    button: {
        width: 340,
        height: '35%',
        backgroundColor: 'rgba(211, 211, 211, 0.4)',
        borderRadius: 10,
        justifyContent: 'flex-end',
        alignItems: 'center',
        elevation: 3,
        marginHorizontal: 15,
        marginBottom: 5,
        paddingBottom: 10,
        marginTop: 5
    },
    buttonProgramacion: {
        width: 340,
        height: '35%',
        backgroundColor: 'rgba(211, 211, 211, 0.4)',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
        position: 'absolute',
        top: '50%',
        left: '56%',
        transform: [
            { translateX: -190 },
            { translateY: -('35%' === '35%' ? 0.35 * Dimensions.get('window').height / 2 : 100) }
        ],
    },
    buttonEmbarques: {
        width: 340,
        height: '35%',
        backgroundColor: 'rgba(211, 211, 211, 0.4)',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [
            { translateX: -170 },
            { translateY: -('35%' === '35%' ? 0.35 * Dimensions.get('window').height / 2 : 100) }
        ],
    },
    buttonText: {
        color: 'black',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 5
    },
    footerText: {
        position: 'absolute',
        bottom: 20,
        right: 10,
        color: 'black',
        fontSize: 12,
        fontWeight: 'bold',
    },
    buttonImage: {
        width: '100%',
        height: '75%',
        borderRadius: 10,
    },
    buttonImageRecibe: {
        width: '100%',
        height: '90%',
        alignItems: 'center',
        borderRadius: 10,
    },
    buttonImageReorden: {
        width: '100%',
        height: '87%',
        alignItems: 'center',
        borderRadius: 10,
    },
});

export default MenuScreen;
