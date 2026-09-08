import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ImageBackground,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PAGE_SIZE = 20;
const COLUMN_MIN_WIDTH = 130;

// TODO: este endpoint todavía no existe en el servidor — hay que implementarlo
// para que regrese el listado completo de HotParts (de todas las áreas).
const ENDPOINT_TODOS_HOTPARTS = 'http://192.168.16.146:3002/api/hotparts/todos';

type HotPartRow = Record<string, any>;

const VerHotPartsScreen: React.FC = () => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    const [hotParts, setHotParts] = useState<HotPartRow[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [searchText, setSearchText] = useState<string>('');
    const [page, setPage] = useState<number>(1);

    const fetchHotParts = async (isRefresh: boolean = false) => {
        isRefresh ? setRefreshing(true) : setLoading(true);
        setErrorMsg('');
        try {
            const response = await axios.get(ENDPOINT_TODOS_HOTPARTS);
            const data: HotPartRow[] = Array.isArray(response.data) ? response.data : [];
            setHotParts(data);
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
    }, []);

    // Cada vez que cambia la búsqueda, se regresa a la primera página.
    useEffect(() => {
        setPage(1);
    }, [searchText]);

    // Las columnas de la tabla se derivan de las llaves que regrese el
    // servidor, para no depender de un esquema fijo (el endpoint todavía
    // no existe, así que se adapta a lo que se implemente).
    const columns = useMemo<string[]>(() => {
        return hotParts.length > 0 ? Object.keys(hotParts[0]) : [];
    }, [hotParts]);

    const filteredHotParts = useMemo<HotPartRow[]>(() => {
        if (!searchText.trim()) return hotParts;
        const texto = searchText.trim().toLowerCase();
        return hotParts.filter((row) =>
            columns.some((col) => String(row[col] ?? '').toLowerCase().includes(texto))
        );
    }, [hotParts, columns, searchText]);

    const totalPages = Math.max(1, Math.ceil(filteredHotParts.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pageItems = filteredHotParts.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
    );

    return (
        <ImageBackground
            source={require('./assets/fondo2.jpg')}
            style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backButton}>
                    <Text style={styles.backButtonText}>{'‹'} Volver</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Todos los HotParts</Text>
                <View style={styles.backButton} />
            </View>

            <View style={styles.searchWrapper}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar..."
                    placeholderTextColor="#a0a0a0"
                    value={searchText}
                    onChangeText={setSearchText}
                />
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#116bbf" />
                    <Text style={styles.loadingText}>Cargando HotParts...</Text>
                </View>
            ) : errorMsg ? (
                <View style={styles.centered}>
                    <Text style={styles.errorText}>{errorMsg}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={() => fetchHotParts()} activeOpacity={0.7}>
                        <Text style={styles.retryButtonText}>Reintentar</Text>
                    </TouchableOpacity>
                </View>
            ) : columns.length === 0 ? (
                <View style={styles.centered}>
                    <Text style={styles.emptyText}>No hay HotParts para mostrar.</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={() => fetchHotParts()} activeOpacity={0.7}>
                        <Text style={styles.retryButtonText}>Recargar</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <>
                    <View style={styles.tableSection}>
                        <ScrollView
                            contentContainerStyle={styles.verticalScrollContent}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={() => fetchHotParts(true)}
                                    colors={['#116bbf']}
                                    tintColor="#116bbf"
                                />
                            }
                        >
                            <ScrollView horizontal showsHorizontalScrollIndicator>
                                <View>
                                    <View style={styles.tableRow}>
                                        {columns.map((col) => (
                                            <View key={col} style={styles.tableHeaderCell}>
                                                <Text style={styles.tableHeaderText} numberOfLines={2}>
                                                    {col}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>

                                    {pageItems.length === 0 ? (
                                        <View style={styles.emptyRow}>
                                            <Text style={styles.emptyRowText}>
                                                Sin resultados para "{searchText}".
                                            </Text>
                                        </View>
                                    ) : (
                                        pageItems.map((row, idx) => (
                                            <View
                                                key={idx}
                                                style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
                                            >
                                                {columns.map((col) => (
                                                    <View key={col} style={styles.tableCell}>
                                                        <Text style={styles.tableCellText} numberOfLines={2}>
                                                            {row[col] === null || row[col] === undefined
                                                                ? '-'
                                                                : String(row[col])}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        ))
                                    )}
                                </View>
                            </ScrollView>
                        </ScrollView>
                    </View>

                    <View style={styles.paginationBar}>
                        <TouchableOpacity
                            style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
                            onPress={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.pageButtonText}>‹ Anterior</Text>
                        </TouchableOpacity>

                        <Text style={styles.pageIndicatorText}>
                            Página {currentPage} de {totalPages} ({filteredHotParts.length} registros)
                        </Text>

                        <TouchableOpacity
                            style={[styles.pageButton, currentPage === totalPages && styles.pageButtonDisabled]}
                            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.pageButtonText}>Siguiente ›</Text>
                        </TouchableOpacity>
                    </View>
                </>
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
    searchWrapper: {
        paddingHorizontal: 16,
        marginBottom: 10,
    },
    searchInput: {
        backgroundColor: 'white',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e2e2',
        paddingHorizontal: 14,
        height: 44,
        color: 'black',
        fontSize: 14,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    loadingText: {
        marginTop: 12,
        color: '#0d3f73',
        fontSize: 14,
    },
    errorText: {
        color: '#d33',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 16,
    },
    emptyText: {
        color: '#3d3d3d',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 16,
    },
    retryButton: {
        backgroundColor: '#116bbf',
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 10,
    },
    retryButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },
    tableSection: {
        flex: 1,
        marginHorizontal: 16,
        marginBottom: 10,
        backgroundColor: 'white',
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    verticalScrollContent: {
        flexGrow: 1,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    tableRowAlt: {
        backgroundColor: '#f7f9fc',
    },
    tableHeaderCell: {
        minWidth: COLUMN_MIN_WIDTH,
        paddingVertical: 10,
        paddingHorizontal: 10,
        backgroundColor: '#0d3f73',
        justifyContent: 'center',
    },
    tableHeaderText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    tableCell: {
        minWidth: COLUMN_MIN_WIDTH,
        paddingVertical: 10,
        paddingHorizontal: 10,
        justifyContent: 'center',
    },
    tableCellText: {
        color: '#333',
        fontSize: 12,
    },
    emptyRow: {
        padding: 20,
        alignItems: 'center',
    },
    emptyRowText: {
        color: '#777',
        fontSize: 13,
    },
    paginationBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 6,
        paddingTop: 4,
    },
    pageButton: {
        backgroundColor: '#116bbf',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 8,
    },
    pageButtonDisabled: {
        backgroundColor: '#b7c9d9',
    },
    pageButtonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    pageIndicatorText: {
        color: '#0d3f73',
        fontSize: 11,
        fontWeight: '600',
        flexShrink: 1,
        textAlign: 'center',
        marginHorizontal: 6,
    },
});

export default VerHotPartsScreen;
