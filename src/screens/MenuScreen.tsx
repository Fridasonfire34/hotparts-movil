import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';


type RootStackParamList = {
    Login: undefined;
    Menu: undefined;
    Notificaciones: undefined;
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
    const insets = useSafeAreaInsets();

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
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#116bbf" />
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

    const handleLogout = () => {
        Alert.alert(
            'Cerrar sesión',
            '¿Seguro que deseas cerrar sesión?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Cerrar sesión',
                    style: 'destructive',
                    onPress: async () => {
                        await AsyncStorage.removeItem('user');
                        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                    },
                },
            ]
        );
    };

    return (
        <ImageBackground
            source={require('./assets/fondo2.jpg')}
            style={styles.container}
        >
            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingTop: 24 + insets.top, paddingBottom: 16 + insets.bottom },
                ]}
            >
                <View style={styles.topRow}>
                    <View style={styles.userBadge}>
                        <View style={styles.userBadgeTopLine}>
                            <Text style={styles.userBadgeText} numberOfLines={1}>
                                {user.Nomina} · {user.Nombre}
                            </Text>
                            <View style={styles.areaPill}>
                                <Text style={styles.areaPillText}>{user.Area}</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
                            <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.notificationsButton}
                        onPress={() => navigation.navigate('Notificaciones')}
                        activeOpacity={0.7}
                    >
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                            <Path
                                d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
                                stroke="#0d3f73"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <Path
                                d="M13.73 21a2 2 0 0 1-3.46 0"
                                stroke="#0d3f73"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </Svg>
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    <Text style={styles.title}>Hot Parts</Text>
                    <Text style={styles.subtitle}>Elige una opción</Text>

                    <View style={styles.optionsList}>
                    {user.Area === 'Programacion' && (
                        <TouchableOpacity style={styles.optionCard} onPress={handleEntrega} activeOpacity={0.85}>
                            <View style={styles.optionIconWrapper}>
                                <Image source={require('./assets/entrega.png')} style={styles.optionIcon} resizeMode="contain" />
                            </View>
                            <Text style={styles.optionText}>Entregar Hot Parts</Text>
                        </TouchableOpacity>
                    )}

                    {user.Area === 'Embarques' && (
                        <TouchableOpacity style={styles.optionCard} onPress={handleRecibo} activeOpacity={0.85}>
                            <View style={styles.optionIconWrapper}>
                                <Image source={require('./assets/recibir.png')} style={styles.optionIcon} resizeMode="contain" />
                            </View>
                            <Text style={styles.optionText}>Recibir Hot Parts</Text>
                        </TouchableOpacity>
                    )}

                    {user.Area === 'Calidad' && (
                        <>
                            <TouchableOpacity style={styles.optionCard} onPress={handleEntrega} activeOpacity={0.85}>
                                <View style={styles.optionIconWrapper}>
                                    <Image source={require('./assets/entrega.png')} style={styles.optionIcon} resizeMode="contain" />
                                </View>
                                <Text style={styles.optionText}>Entregar Hot Parts</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.optionCard} onPress={handleRecibo} activeOpacity={0.85}>
                                <View style={styles.optionIconWrapper}>
                                    <Image source={require('./assets/recibir.png')} style={styles.optionIcon} resizeMode="contain" />
                                </View>
                                <Text style={styles.optionText}>Recibir Hot Parts</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.optionCard} onPress={handleReorden} activeOpacity={0.85}>
                                <View style={styles.optionIconWrapper}>
                                    <Image source={require('./assets/reorden.png')} style={styles.optionIcon} resizeMode="contain" />
                                </View>
                                <Text style={styles.optionText}>Reordenar Hot Parts</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {user.Area === 'Produccion' && (
                        <>
                            <TouchableOpacity style={styles.optionCard} onPress={handleEntrega} activeOpacity={0.85}>
                                <View style={styles.optionIconWrapper}>
                                    <Image source={require('./assets/entrega.png')} style={styles.optionIcon} resizeMode="contain" />
                                </View>
                                <Text style={styles.optionText}>Entregar Hot Parts</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.optionCard} onPress={handleRecibo} activeOpacity={0.85}>
                                <View style={styles.optionIconWrapper}>
                                    <Image source={require('./assets/recibir.png')} style={styles.optionIcon} resizeMode="contain" />
                                </View>
                                <Text style={styles.optionText}>Recibir Hot Parts</Text>
                            </TouchableOpacity>
                        </>
                    )}
                    </View>
                </View>

                <Text style={styles.footerText}>TMP Hot Parts 2025 ©</Text>
            </ScrollView>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
    },
    topRow: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 20,
    },
    notificationsButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.9)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        color: '#3d3d3d',
        textAlign: 'center',
    },
    userBadge: {
        flex: 1,
        alignItems: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    userBadgeTopLine: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 0,
    },
    userBadgeText: {
        flex: 1,
        fontSize: 13,
        color: '#333',
        fontWeight: '600',
    },
    areaPill: {
        backgroundColor: '#116bbf',
        borderRadius: 20,
        paddingVertical: 4,
        paddingHorizontal: 12,
    },
    areaPillText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    logoutButton: {
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: '#d33',
        borderRadius: 20,
        paddingVertical: 4,
        paddingHorizontal: 12,
    },
    logoutButtonText: {
        color: '#d33',
        fontSize: 12,
        fontWeight: 'bold',
    },
    content: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 24,
    },
    title: {
        fontSize: 28,
        color: '#0d3f73',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        color: '#3d3d3d',
        marginTop: 1,
        marginBottom: 15,
        textAlign: 'center',
    },
    optionsList: {
        width: '100%',
        alignItems: 'center',
        gap: 22,
    },
    optionCard: {
        width: '100%',
        maxWidth: 460,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 24,
        paddingVertical: 28,
        paddingHorizontal: 26,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 4,
    },
    optionIconWrapper: {
        width: 112,
        height: 112,
        borderRadius: 22,
        backgroundColor: '#f2f6fb',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 24,
        overflow: 'hidden',
    },
    optionIcon: {
        width: '100%',
        height: '100%',
    },
    optionText: {
        flex: 1,
        color: '#0d3f73',
        fontSize: 26,
        fontWeight: 'bold',
    },
    footerText: {
        paddingTop: 12,
        color: '#3d3d3d',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
});

export default MenuScreen;
