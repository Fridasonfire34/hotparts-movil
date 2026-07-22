import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ImageBackground,
    TouchableOpacity,
    FlatList,
    Alert,
    ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DetalleItem {
    folio: string;
    numeroParte: string;
    secuencia: number;
    cantidad: number;
}

interface NotificacionDetalle {
    usuarioEntrega: string | null;
    usuarioRecibe: string | null;
    items: DetalleItem[];
}

interface NotificacionHistorial {
    Id: number;
    Titulo: string;
    Cuerpo: string;
    Modulo: string | null;
    Detalle: NotificacionDetalle | null;
    FechaHora: string;
}

const formatFecha = (fechaHora: string) => {
    // FechaHora viene de SQL Server como hora local (GETDATE()), pero el driver la
    // serializa como si fuera UTC. Se parsean los componentes del string tal cual,
    // sin pasar por `new Date(...)`, porque eso aplicaría una conversión de zona
    // horaria incorrecta (le restaría las horas de diferencia con UTC).
    const match = fechaHora.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (!match) return fechaHora;

    const [, year, month, day, hour, minute] = match;
    const hourNum = parseInt(hour, 10);
    const periodo = hourNum >= 12 ? 'p.m.' : 'a.m.';
    const hour12 = hourNum % 12 === 0 ? 12 : hourNum % 12;

    return `${day}/${month}/${year}, ${hour12}:${minute} ${periodo}`;
};

const NotificacionesScreen: React.FC = () => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const [notificaciones, setNotificaciones] = useState<NotificacionHistorial[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const fetchNotificaciones = async () => {
        try {
            const response = await axios.get('http://192.168.16.224:3002/api/hotparts/notificaciones');
            setNotificaciones(response.data);
        } catch (error) {
            Alert.alert('Error', 'No se pudo obtener el historial de notificaciones.');
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchNotificaciones().finally(() => setLoading(false));
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchNotificaciones();
        setRefreshing(false);
    };

    const toggleExpanded = (id: number) => {
        setExpandedId((prev) => (prev === id ? null : id));
    };

    const renderItem = ({ item }: { item: NotificacionHistorial }) => {
        const isExpanded = expandedId === item.Id;
        const tieneDetalle = !!item.Detalle && item.Detalle.items.length > 0;

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.Titulo}</Text>
                    {!!item.Modulo && (
                        <View style={styles.modulePill}>
                            <Text style={styles.modulePillText}>{item.Modulo}</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.cardBody}>{item.Cuerpo}</Text>
                <Text style={styles.cardDate}>{formatFecha(item.FechaHora)}</Text>

                {tieneDetalle && (
                    <>
                        <TouchableOpacity onPress={() => toggleExpanded(item.Id)} activeOpacity={0.7}>
                            <Text style={styles.detallesToggle}>
                                {isExpanded ? 'Ocultar Detalles ▴' : 'Detalles ▾'}
                            </Text>
                        </TouchableOpacity>

                        {isExpanded && (
                            <View style={styles.detalleContainer}>
                                <Text style={styles.detalleUsuarios}>
                                    Quien Entregó: <Text style={styles.detalleUsuariosValor}>{item.Detalle!.usuarioEntrega ?? '-'}</Text>
                                </Text>
                                <Text style={styles.detalleUsuarios}>
                                    Quien Recibió: <Text style={styles.detalleUsuariosValor}>{item.Detalle!.usuarioRecibe ?? '-'}</Text>
                                </Text>

                                <View style={styles.detalleTableHeader}>
                                    <Text style={[styles.detalleCell, styles.detalleHeaderText, { flex: 1.3 }]}>Folio</Text>
                                    <Text style={[styles.detalleCell, styles.detalleHeaderText, { flex: 1.3 }]}>NP</Text>
                                    <Text style={[styles.detalleCell, styles.detalleHeaderText, { flex: 0.9 }]}>Secuencia</Text>
                                    <Text style={[styles.detalleCell, styles.detalleHeaderText, { flex: 0.7, textAlign: 'right' }]}>Cant.</Text>
                                </View>

                                {item.Detalle!.items.map((detalleItem, index) => (
                                    <View key={`${detalleItem.folio}-${index}`} style={styles.detalleTableRow}>
                                        <Text style={[styles.detalleCell, { flex: 1.3 }]} numberOfLines={1}>{detalleItem.folio}</Text>
                                        <Text style={[styles.detalleCell, { flex: 1.3 }]} numberOfLines={1}>{detalleItem.numeroParte}</Text>
                                        <Text style={[styles.detalleCell, { flex: 0.9 }]}>{detalleItem.secuencia}</Text>
                                        <Text style={[styles.detalleCell, { flex: 0.7, textAlign: 'right' }]}>{detalleItem.cantidad}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </>
                )}
            </View>
        );
    };

    return (
        <ImageBackground
            source={require('./assets/fondo2.jpg')}
            style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backButton}>
                    <Text style={styles.backButtonText}>{'‹'} Volver</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notificaciones</Text>
                <View style={styles.backButton} />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#0e5699" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={notificaciones}
                    keyExtractor={(item) => String(item.Id)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    ListEmptyComponent={<Text style={styles.emptyText}>No hay notificaciones todavía</Text>}
                />
            )}
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        minWidth: 70,
    },
    backButtonText: {
        color: '#0d3f73',
        fontSize: 15,
        fontWeight: '600',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0d3f73',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
        flexGrow: 1,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
        gap: 8,
    },
    cardTitle: {
        flex: 1,
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0d3f73',
    },
    modulePill: {
        backgroundColor: '#116bbf',
        borderRadius: 20,
        paddingVertical: 3,
        paddingHorizontal: 10,
    },
    modulePillText: {
        color: 'white',
        fontSize: 11,
        fontWeight: 'bold',
    },
    cardBody: {
        fontSize: 14,
        color: '#333',
        marginBottom: 8,
    },
    cardDate: {
        fontSize: 12,
        color: '#888',
        textAlign: 'right',
    },
    detallesToggle: {
        marginTop: 8,
        color: '#116bbf',
        fontSize: 13,
        fontWeight: 'bold',
    },
    detalleContainer: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    detalleUsuarios: {
        fontSize: 13,
        color: '#555',
        marginBottom: 4,
    },
    detalleUsuariosValor: {
        fontWeight: 'bold',
        color: '#333',
    },
    detalleTableHeader: {
        flexDirection: 'row',
        marginTop: 8,
        paddingBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    detalleHeaderText: {
        fontWeight: 'bold',
        color: '#0d3f73',
    },
    detalleTableRow: {
        flexDirection: 'row',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    detalleCell: {
        fontSize: 12,
        color: '#333',
        paddingRight: 4,
    },
    emptyText: {
        fontSize: 16,
        textAlign: 'center',
        marginTop: 80,
        color: '#333',
    },
});

export default NotificacionesScreen;
