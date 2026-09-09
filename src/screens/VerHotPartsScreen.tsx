import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

// Mismo endpoint/servidor que usa el resto de la app (ver LoginScreen, ReordenScreen, etc.)
const ENDPOINT_TODOS_HOTPARTS = 'http://192.168.16.146:3002/api/hotparts/todos';
const REFRESH_INTERVAL_MS = 20000;
const CRITICO_HORAS = 48;

type HotPartRow = Record<string, any>;

// Réplica de la vista móvil de Hot Parts del proyecto Disparos
// (Disparos/app/hotparts/movil/page.tsx), adaptada a React Native.
const VerHotPartsScreen: React.FC = () => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    const [hotParts, setHotParts] = useState<HotPartRow[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [searchText, setSearchText] = useState<string>('');
    const [ocultarEnviados, setOcultarEnviados] = useState<boolean>(true);
    const [expandedFolios, setExpandedFolios] = useState<Set<string>>(new Set());
    const [currentTime, setCurrentTime] = useState<number>(Date.now());
    const [blinkState, setBlinkState] = useState<boolean>(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const toggleExpanded = (folio: string) => {
        setExpandedFolios((prev) => {
            const next = new Set(prev);
            if (next.has(folio)) next.delete(folio);
            else next.add(folio);
            return next;
        });
    };

    const fetchHotParts = async (isRefresh: boolean = false) => {
        isRefresh ? setRefreshing(true) : setLoading(true);
        setErrorMsg('');
        try {
            const response = await axios.get(ENDPOINT_TODOS_HOTPARTS);
            const data: HotPartRow[] = Array.isArray(response.data) ? response.data : [];
            setHotParts(data);
            setLastUpdated(new Date());
        } catch (error: any) {
            const mensaje =
                error?.response?.data?.message ||
                (error?.response
                    ? `Error ${error.response.status} al consultar el servidor.`
                    : 'No se pudo conectar con el servidor.');
            setErrorMsg(mensaje);
        } finally {
            isRefresh ? setRefreshing(false) : setLoading(false);
        }
    };

    useEffect(() => {
        fetchHotParts();
        const interval = setInterval(() => fetchHotParts(), REFRESH_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    // Reloj para el tiempo transcurrido y el parpadeo de las tarjetas críticas.
    useEffect(() => {
        const timer = setInterval(() => {
            setBlinkState((prev) => !prev);
            setCurrentTime(Date.now());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const parseIngresoDate = (value: any): Date | null => {
        if (!value) return null;
        const valueStr = String(value);
        const match = valueStr.match(/(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2}):?(\d{2})?/);
        if (match) {
            const [, year, month, day, hours, minutes, seconds] = match;
            const parsed = new Date(
                parseInt(year, 10),
                parseInt(month, 10) - 1,
                parseInt(day, 10),
                parseInt(hours, 10),
                parseInt(minutes, 10),
                parseInt(seconds || '0', 10)
            );
            return isNaN(parsed.getTime()) ? null : parsed;
        }
        const parsed = new Date(valueStr);
        return isNaN(parsed.getTime()) ? null : parsed;
    };

    const formatIngresoDisplay = (value: any): string => {
        const ingresoDate = parseIngresoDate(value);
        if (!ingresoDate) return '';
        const day = String(ingresoDate.getDate()).padStart(2, '0');
        const month = String(ingresoDate.getMonth() + 1).padStart(2, '0');
        const hours24 = ingresoDate.getHours();
        const minutes = String(ingresoDate.getMinutes()).padStart(2, '0');
        const amPm = hours24 >= 12 ? 'PM' : 'AM';
        const hours12 = hours24 % 12 || 12;
        return `${day}/${month} ${hours12}:${minutes} ${amPm}`;
    };

    const getElapsedInfo = (row: HotPartRow) => {
        const estatus = String(row.Estatus || '').trim().toUpperCase();

        if (estatus === 'ENVIADO') {
            return { elapsed: '', isSent: true, isCritical: false };
        }

        const ingresoDate = parseIngresoDate(row['Hora Ingreso']);
        if (!ingresoDate) {
            return { elapsed: '0d 00:00', isSent: false, isCritical: false };
        }

        const diffMs = Math.max(0, currentTime - ingresoDate.getTime());
        const totalMinutes = Math.floor(diffMs / 60000);
        const days = Math.floor(totalMinutes / 1440);
        const hours = Math.floor((totalMinutes % 1440) / 60);
        const minutes = totalMinutes % 60;
        const totalHours = diffMs / 3600000;

        return {
            elapsed: `${days}d ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
            isSent: false,
            isCritical: totalHours >= CRITICO_HORAS,
        };
    };

    const passesSearch = (row: HotPartRow): boolean => {
        const query = searchText.trim().toLowerCase();
        if (!query) return true;
        const searchableFields = [
            row['Numero de Parte'],
            row.Secuencia,
            row.Folio,
            row['Orden de Compra'],
            row.Descripcion,
        ];
        return searchableFields.some((field) => String(field ?? '').toLowerCase().includes(query));
    };

    const visibleData = useMemo(() => {
        return (ocultarEnviados
            ? hotParts.filter((row) => String(row.Estatus ?? '').toUpperCase() !== 'ENVIADO')
            : hotParts
        ).filter(passesSearch);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hotParts, ocultarEnviados, searchText]);

    const renderItem = ({ item: row, index: idx }: { item: HotPartRow; index: number }) => {
        const elapsedInfo = getElapsedInfo(row);
        let cardStyle: any[] = [styles.card];
        if (elapsedInfo.isSent) {
            cardStyle = [styles.card, styles.cardSent];
        } else if (elapsedInfo.isCritical) {
            cardStyle = [styles.card, blinkState ? styles.cardCriticalBlink : styles.cardCritical];
        }

        const rowKey = String(row.Folio || idx);
        const isExpanded = expandedFolios.has(rowKey);

        return (
            <View style={cardStyle}>
                <TouchableOpacity style={styles.cardHeader} onPress={() => toggleExpanded(rowKey)} activeOpacity={0.7}>
                    <Text style={styles.cardNumeroParte} numberOfLines={1}>
                        {row['Numero de Parte'] || ''}
                    </Text>
                    <Text style={styles.cardEstatus}>{row.Estatus}</Text>
                    <Text style={styles.cardChevron}>{isExpanded ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.cardBody}>
                        <DetailRow label="Folio" value={row.Folio} />
                        <DetailRow label="Secuencia" value={row.Secuencia} />
                        <DetailRow label="PO" value={row['Orden de Compra']} />
                        {!!row.Descripcion && <DetailRow label="Descripcion" value={row.Descripcion} />}
                        <DetailRow label="Cantidad" value={row['Cantidad Total']} />
                        {!!row['Comentarios CMX'] && <DetailRow label="Comentarios CMX" value={row['Comentarios CMX']} />}
                        {!!row['Comentarios TMP'] && <DetailRow label="Comentarios TMP" value={row['Comentarios TMP']} />}
                        <DetailRow label="Solicitado por" value={row['Solicitado por']} />
                        <DetailRow label="Planta" value={row.Planta} />
                        <DetailRow label="Ingreso" value={formatIngresoDisplay(row['Hora Ingreso'])} />
                        {!elapsedInfo.isSent && (
                            <DetailRow label="Transcurrido" value={elapsedInfo.elapsed} critical={elapsedInfo.isCritical} />
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
                <Defs>
                    <LinearGradient id="fondo" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#ffffff" />
                        <Stop offset="60%" stopColor="#ffffff" />
                        <Stop offset="100%" stopColor="#ffffff" />
                    </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#fondo)" />
            </Svg>

            <View style={[styles.topBar, { paddingTop: insets.top ? 4 : 12 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backButton}>
                    <Text style={styles.backButtonText}>{'‹'} Volver</Text>
                </TouchableOpacity>
                <Text style={styles.title}>🔥 Hot Parts</Text>
                <View style={styles.backButton} />
            </View>

            <TextInput
                style={styles.searchInput}
                placeholder="Buscar por numero de parte, secuencia, PO..."
                placeholderTextColor="rgba(0, 0, 0, 0.5)"
                value={searchText}
                onChangeText={setSearchText}
            />

            <View style={styles.controls}>
                <TouchableOpacity
                    style={styles.filterCheckbox}
                    onPress={() => setOcultarEnviados((prev) => !prev)}
                    activeOpacity={0.7}
                >
                    <View style={[styles.checkboxBox, ocultarEnviados && styles.checkboxBoxChecked]}>
                        {ocultarEnviados && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>
                    <Text style={styles.filterCheckboxText}>Ocultar Enviados</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.refreshButton, loading && styles.refreshButtonDisabled]}
                    onPress={() => fetchHotParts()}
                    disabled={loading}
                    activeOpacity={0.7}
                >
                    <Text style={styles.refreshButtonText}>{loading ? 'Actualizando...' : 'Actualizar'}</Text>
                </TouchableOpacity>
            </View>

            {lastUpdated && (
                <Text style={styles.lastUpdated}>
                    Última actualización: {lastUpdated.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </Text>
            )}

            {errorMsg ? (
                <View style={styles.centered}>
                    <Text style={styles.errorText}>{errorMsg}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={() => fetchHotParts()} activeOpacity={0.7}>
                        <Text style={styles.retryButtonText}>Reintentar</Text>
                    </TouchableOpacity>
                </View>
            ) : loading && hotParts.length === 0 ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#63b3ed" />
                </View>
            ) : (
                <FlatList
                    data={visibleData}
                    keyExtractor={(row, idx) => String(row.Folio || idx)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.cardList}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => fetchHotParts(true)} tintColor="#63b3ed" colors={['#63b3ed']} />
                    }
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No hay Hot Parts disponibles.</Text>
                    }
                />
            )}
        </View>
    );
};

const DetailRow: React.FC<{ label: string; value: any; critical?: boolean }> = ({ label, value, critical }) => (
    <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>{label}</Text>
        <Text style={[styles.cardValue, critical && styles.cardValueCritical]}>
            {value === null || value === undefined || value === '' ? '-' : String(value)}
        </Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 10,
    },
    backButton: {
        minWidth: 70,
    },
    backButtonText: {
        color: '#000000',
        fontSize: 15,
        fontWeight: '600',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#020202',
        letterSpacing: 0.5,
    },
    searchInput: {
        marginHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.2)',
        backgroundColor: 'rgba(5, 5, 5, 0.08)',
        color: '#000000',
        fontSize: 14,
        paddingHorizontal: 14,
        height: 42,
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        marginHorizontal: 16,
        marginTop: 10,
    },
    filterCheckbox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        //backgroundColor: 'rgba(3, 3, 3, 0.43)',
        borderWidth: 1,
        borderColor: 'rgba(2, 2, 2, 0.57)',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 14,
        color: '#000000',
    },
    checkboxBox: {
        width: 16,
        height: 16,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgb(5, 5, 5)',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#000000',
    },
    checkboxBoxChecked: {
        backgroundColor: '#003cff',
        borderColor: '#003cff',
    },
    checkboxMark: {
        color: '#0f172a',
        fontSize: 11,
        fontWeight: 'bold',
    },
    filterCheckboxText: {
        fontSize: 13,
        color: 'rgba(0, 0, 0, 0.85)',
    },
    refreshButton: {
        backgroundColor: '#2563eb',
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 20,
    },
    refreshButtonDisabled: {
        opacity: 0.6,
    },
    refreshButtonText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
    },
    lastUpdated: {
        color: 'rgba(0, 0, 0, 0.55)',
        fontSize: 11,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 4,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    errorText: {
        color: '#fca5a5',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 16,
    },
    retryButton: {
        backgroundColor: '#2563eb',
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 10,
    },
    retryButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },
    emptyText: {
        color: 'rgba(54, 54, 54, 0.7)',
        textAlign: 'center',
        paddingVertical: 24,
        fontSize: 14,
    },
    cardList: {
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 24,
        gap: 10,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 10,
        borderLeftWidth: 6,
        borderLeftColor: '#046bfc',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    cardSent: {
        borderLeftColor: '#16a34a',
        backgroundColor: '#f0fdf4',
    },
    cardCritical: {
        borderLeftColor: '#dc2626',
        backgroundColor: '#fef2f2',
    },
    cardCriticalBlink: {
        borderLeftColor: '#dc2626',
        backgroundColor: '#ffffff',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    cardNumeroParte: {
        fontWeight: '700',
        fontSize: 15,
        color: '#1e293b',
        flex: 1,
    },
    cardEstatus: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1e40af',
        backgroundColor: '#dbeafe',
        borderRadius: 10,
        paddingVertical: 3,
        paddingHorizontal: 10,
    },
    cardChevron: {
        color: '#64748b',
        fontSize: 12,
    },
    cardBody: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.08)',
        gap: 5,
    },
    cardRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    cardLabel: {
        color: '#64748b',
        fontWeight: '600',
        fontSize: 13,
    },
    cardValue: {
        color: '#1e293b',
        textAlign: 'right',
        fontSize: 13,
        flexShrink: 1,
    },
    cardValueCritical: {
        color: '#dc2626',
        fontWeight: '700',
    },
});

export default VerHotPartsScreen;
