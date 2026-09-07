import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, Image, ActivityIndicator, Alert, ScrollView, Modal, Animated, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
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

const SIDEBAR_WIDTH = 280;

const MenuScreen: React.FC<Props> = ({ navigation }) => {
    const [user, setUser] = useState<any>(null);
    const [hasUnread, setHasUnread] = useState(false);
    const [sidebarVisible, setSidebarVisible] = useState(false);
    const [changePasswordVisible, setChangePasswordVisible] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changePasswordError, setChangePasswordError] = useState('');
    const [changePasswordLoading, setChangePasswordLoading] = useState(false);
    // Para Produccion y Calidad, Entregar/Reordenar se deshabilitan si no hay
    // piezas disponibles bajo el mismo criterio que ya usan esas pantallas.
    // Por defecto quedan habilitados: si la verificación falla por red, no se
    // bloquea al usuario (la pantalla destino ya maneja "sin resultados").
    const [canEntregar, setCanEntregar] = useState(true);
    const [canReorden, setCanReorden] = useState(true);
    const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
    const insets = useSafeAreaInsets();

    const openSidebar = () => {
        setSidebarVisible(true);
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
        }).start();
    };

    const closeSidebar = () => {
        Animated.timing(slideAnim, {
            toValue: -SIDEBAR_WIDTH,
            duration: 200,
            useNativeDriver: true,
        }).start(() => setSidebarVisible(false));
    };

    const openChangePassword = () => {
        closeSidebar();
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setChangePasswordError('');
        setChangePasswordVisible(true);
    };

    const closeChangePassword = () => {
        setChangePasswordVisible(false);
    };

    const handleSubmitChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            setChangePasswordError('Completa todos los campos.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setChangePasswordError('La nueva contraseña y su confirmación no coinciden.');
            return;
        }
        if (newPassword.length < 4) {
            setChangePasswordError('La nueva contraseña debe tener al menos 4 caracteres.');
            return;
        }

        setChangePasswordError('');
        setChangePasswordLoading(true);
        try {
            // TODO: endpoint pendiente de crear en el backend (192.168.16.146:3002).
            await axios.post('http://192.168.16.146:3002/api/hotparts/cambiarPassword', {
                nomina: user.Nomina,
                passwordActual: currentPassword,
                passwordNueva: newPassword,
            });

            setChangePasswordVisible(false);
            Alert.alert('Listo', 'Tu contraseña se actualizó correctamente.');
        } catch (err: any) {
            setChangePasswordError(
                err?.response?.data?.message || 'No se pudo actualizar la contraseña. Intenta de nuevo.'
            );
        } finally {
            setChangePasswordLoading(false);
        }
    };

    useEffect(() => {
        const loadUserData = async () => {
            const userData = await AsyncStorage.getItem('user');
            if (userData) {
                setUser(JSON.parse(userData));
            }
        };

        loadUserData();
    }, []);

    // Se revisa cada vez que la pantalla recupera el foco (ej. al volver de
    // Notificaciones, donde se limpia la bandera) para que el punto rojo
    // desaparezca sin necesidad de recargar el Menu completo.
    useFocusEffect(
        useCallback(() => {
            const checkUnread = async () => {
                const count = parseInt((await AsyncStorage.getItem('unreadNotificationsCount')) ?? '0', 10);
                setHasUnread(count > 0);
            };
            checkUnread();
        }, [])
    );

    // Se revisa también cada vez que el Menu recupera el foco (ej. al volver
    // de entregar/reordenar) para que los botones reflejen el estado actual.
    useFocusEffect(
        useCallback(() => {
            const checkAvailability = async () => {
                if (!user || (user.Area !== 'Produccion' && user.Area !== 'Calidad')) {
                    return;
                }

                try {
                    const endpoint = user.Area === 'Produccion' ? 'Produccion' : 'calidad';
                    const response = await axios.get(`http://192.168.16.146:3002/api/hotparts/${endpoint}`);
                    const data: any[] = response.data || [];

                    if (user.Area === 'Produccion') {
                        const hasFaltante = data.some((item) => Number(item['Cantidad Faltante por Entregar']) > 0);
                        setCanEntregar(hasFaltante);
                        setCanReorden(hasFaltante);
                    } else {
                        setCanEntregar(data.some((item) => Number(item['Cantidad Faltante de Entregar']) > 0));
                        setCanReorden(data.some((item) => Number(item['Cantidad Recibida de Produccion']) > 0));
                    }
                } catch (error) {
                    console.error('Error al verificar disponibilidad de Hot Parts:', error);
                }
            };

            checkAvailability();
        }, [user])
    );

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
            'Calidad': 'ReordenScreen',
            'Produccion': 'ReordenScreen',
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
                    <TouchableOpacity style={styles.menuButton} onPress={openSidebar} activeOpacity={0.7}>
                        <View style={styles.menuBar} />
                        <View style={styles.menuBar} />
                        <View style={styles.menuBar} />
                    </TouchableOpacity>

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
                        {hasUnread && <View style={styles.unreadDot} />}
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
                            <TouchableOpacity
                                style={[styles.optionCard, !canEntregar && styles.optionCardDisabled]}
                                onPress={handleEntrega}
                                activeOpacity={0.85}
                                disabled={!canEntregar}
                            >
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

                            <TouchableOpacity
                                style={[styles.optionCard, !canReorden && styles.optionCardDisabled]}
                                onPress={handleReorden}
                                activeOpacity={0.85}
                                disabled={!canReorden}
                            >
                                <View style={styles.optionIconWrapper}>
                                    <Image source={require('./assets/reorden.png')} style={styles.optionIcon} resizeMode="contain" />
                                </View>
                                <Text style={styles.optionText}>Reordenar Hot Parts</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {user.Area === 'Produccion' && (
                        <>
                            <TouchableOpacity
                                style={[styles.optionCard, !canEntregar && styles.optionCardDisabled]}
                                onPress={handleEntrega}
                                activeOpacity={0.85}
                                disabled={!canEntregar}
                            >
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

                            <TouchableOpacity
                                style={[styles.optionCard, !canReorden && styles.optionCardDisabled]}
                                onPress={handleReorden}
                                activeOpacity={0.85}
                                disabled={!canReorden}
                            >
                                <View style={styles.optionIconWrapper}>
                                    <Image source={require('./assets/reorden.png')} style={styles.optionIcon} resizeMode="contain" />
                                </View>
                                <Text style={styles.optionText}>Reordenar Hot Parts</Text>
                            </TouchableOpacity>
                        </>
                    )}
                    </View>
                </View>

                <Text style={styles.footerText}>TMP Hot Parts 2025 ©</Text>
            </ScrollView>

            <Modal transparent visible={sidebarVisible} animationType="none" onRequestClose={closeSidebar}>
                <View style={styles.sidebarWrapper}>
                    <TouchableOpacity
                        style={styles.sidebarBackdrop}
                        activeOpacity={1}
                        onPress={closeSidebar}
                    />
                    <Animated.View
                        style={[
                            styles.sidebarShadowWrapper,
                            { transform: [{ translateX: slideAnim }] },
                        ]}
                    >
                        <View style={styles.sidebarPanel}>
                            <View style={[styles.sidebarHeader, { paddingTop: insets.top + 28 }]}>
                                <View style={styles.sidebarAvatar}>
                                    <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
                                        <Path
                                            d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z"
                                            fill="#116bbf"
                                        />
                                        <Path
                                            d="M4.5 20c0-4.14 3.36-6.5 7.5-6.5s7.5 2.36 7.5 6.5"
                                            stroke="#116bbf"
                                            strokeWidth={2}
                                            strokeLinecap="round"
                                        />
                                    </Svg>
                                </View>
                                <Text style={styles.sidebarNombre} numberOfLines={1}>{user.Nombre}</Text>
                                <Text style={styles.sidebarNominaText}>Nómina {user.Nomina}</Text>
                                <View style={styles.sidebarAreaPillOnHeader}>
                                    <Text style={styles.sidebarAreaPillText}>{user.Area}</Text>
                                </View>
                            </View>

                            <View style={[styles.sidebarBody, { paddingBottom: insets.bottom + 20 }]}>
                                <TouchableOpacity
                                    style={styles.changePasswordButton}
                                    onPress={openChangePassword}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.changePasswordButtonText}>Cambiar Contraseña</Text>
                                </TouchableOpacity>

                                <View style={{ flex: 1 }} />

                                <TouchableOpacity
                                    style={styles.sidebarLogoutButton}
                                    onPress={() => {
                                        closeSidebar();
                                        handleLogout();
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
                                </TouchableOpacity>

                                <Text style={styles.sidebarFooterText}>Hot Parts</Text>
                            </View>
                        </View>
                    </Animated.View>
                </View>
            </Modal>

            <Modal
                transparent
                animationType="fade"
                visible={changePasswordVisible}
                onRequestClose={closeChangePassword}
            >
                <View style={styles.cpBackground}>
                    <View style={styles.cpContainer}>
                        <Text style={styles.cpTitle}>Cambiar Contraseña</Text>

                        <TextInput
                            style={styles.cpInput}
                            placeholder="Contraseña actual"
                            placeholderTextColor="#a0a0a0"
                            secureTextEntry
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                        />
                        <TextInput
                            style={styles.cpInput}
                            placeholder="Nueva contraseña"
                            placeholderTextColor="#a0a0a0"
                            secureTextEntry
                            value={newPassword}
                            onChangeText={setNewPassword}
                        />
                        <TextInput
                            style={styles.cpInput}
                            placeholder="Confirmar nueva contraseña"
                            placeholderTextColor="#a0a0a0"
                            secureTextEntry
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                        />

                        {!!changePasswordError && (
                            <Text style={styles.cpError}>{changePasswordError}</Text>
                        )}

                        <View style={styles.cpButtonsRow}>
                            <TouchableOpacity
                                style={styles.cpCancelButton}
                                onPress={closeChangePassword}
                                activeOpacity={0.7}
                                disabled={changePasswordLoading}
                            >
                                <Text style={styles.cpCancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.cpSaveButton}
                                onPress={handleSubmitChangePassword}
                                activeOpacity={0.7}
                                disabled={changePasswordLoading}
                            >
                                {changePasswordLoading ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Text style={styles.cpSaveButtonText}>Guardar</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    menuButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,255,255,0.9)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    menuBar: {
        width: 18,
        height: 2,
        borderRadius: 1,
        backgroundColor: '#0d3f73',
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
    unreadDot: {
        position: 'absolute',
        top: 2,
        right: 4,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#e63946',
        borderWidth: 1.5,
        borderColor: 'white',
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
    sidebarWrapper: {
        flex: 1,
    },
    sidebarBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    sidebarShadowWrapper: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: SIDEBAR_WIDTH,
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    sidebarPanel: {
        flex: 1,
        backgroundColor: 'white',
        borderTopRightRadius: 24,
        borderBottomRightRadius: 24,
        overflow: 'hidden',
    },
    sidebarHeader: {
        backgroundColor: '#116bbf',
        alignItems: 'center',
        paddingHorizontal: 22,
        paddingBottom: 26,
    },
    sidebarAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    sidebarNombre: {
        fontSize: 17,
        fontWeight: '700',
        color: 'white',
        textAlign: 'center',
    },
    sidebarNominaText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.85)',
        marginTop: 2,
        marginBottom: 14,
    },
    sidebarAreaPillOnHeader: {
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderRadius: 20,
        paddingVertical: 5,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    sidebarAreaPillText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    sidebarBody: {
        flex: 1,
        paddingHorizontal: 22,
        paddingTop: 20,
    },
    changePasswordButton: {
        alignSelf: 'stretch',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#116bbf',
        borderRadius: 20,
        paddingVertical: 10,
        marginBottom: 10,
    },
    changePasswordButtonText: {
        color: '#116bbf',
        fontSize: 12,
        fontWeight: 'bold',
    },
    sidebarLogoutButton: {
        alignSelf: 'stretch',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#d33',
        borderRadius: 20,
        paddingVertical: 10,
    },
    sidebarFooterText: {
        textAlign: 'center',
        color: '#aaa',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 14,
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
    optionCardDisabled: {
        opacity: 0.4,
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
    cpBackground: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cpContainer: {
        width: '85%',
        backgroundColor: 'white',
        borderRadius: 14,
        paddingVertical: 24,
        paddingHorizontal: 20,
    },
    cpTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: '#0d3f73',
        textAlign: 'center',
        marginBottom: 18,
    },
    cpInput: {
        width: '100%',
        height: 48,
        borderColor: '#e2e2e2',
        borderWidth: 1,
        marginBottom: 14,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: '#f7f7f7',
        color: 'black',
        fontSize: 14,
    },
    cpError: {
        color: '#d33',
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 10,
    },
    cpButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        marginTop: 4,
    },
    cpCancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        backgroundColor: '#e0e0e0',
    },
    cpCancelButtonText: {
        color: '#333',
        fontWeight: 'bold',
    },
    cpSaveButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        backgroundColor: '#0e5699',
    },
    cpSaveButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
});

export default MenuScreen;
