import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ImageBackground, TextInput, TouchableOpacity, SectionList, BackHandler, Alert, Modal, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Platform, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from './App';
import QRCode from 'react-native-qrcode-svg';
import { Camera } from 'react-native-camera-kit';

type ReciboProduccionScreenRouteProp = RouteProp<RootStackParamList, 'ReciboProduccion'>;

interface Props {
    route: ReciboProduccionScreenRouteProp;
}

interface HotPart {
    Folio: string;
    ['Secuencia']: number;
    ['Numero de Parte']: string;
    ['Cantidad']: number;
}

const ReciboProduccionScreen: React.FC<Props> = ({ route }) => {
    const { nomina, nombre, area, autoFetch } = route?.params || {};
    const [hotParts, setHotParts] = useState<HotPart[]>([]);
    const [filteredHotParts, setFilteredHotParts] = useState<HotPart[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [codigoEntrega, setCodigoEntrega] = useState<string>('');
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedItems, setSelectedItems] = useState<HotPart[]>([]);
    const [searchText, setSearchText] = useState<string>('');
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isChooserVisible, setIsChooserVisible] = useState(!autoFetch);
    const [isScannerVisible, setIsScannerVisible] = useState(false);

    const mapListadoItem = (row: any): HotPart => ({
        Folio: row.FOLIO ?? row.Folio,
        ['Secuencia']: row['Secuencia'],
        ['Numero de Parte']: row['Numero de Parte'],
        ['Cantidad']: row['Cantidad'],
    });

    const fetchListadoEntregaProduccion = async () => {
        setLoading(true);
        try {
            const response = await axios.post('http://192.168.16.146:3002/api/hotparts/listadoEntregaProgramacion', { nomina });
            const data = (response.data.data ?? []).map(mapListadoItem);
            setHotParts(data);
            setFilteredHotParts(data);
            setSelectedItems(data);
        } catch (error) {
            let errorMessage = '';

            if (error.response) {
                errorMessage = `Error ${error.response.status}: ${error.response.data || 'No hay detalles disponibles'}`;
                console.error('Error al obtener los HotParts:', error.response.status, error.response.data);
            } else if (error.request) {
                errorMessage = 'No se recibió respuesta del servidor.';
                console.error('No se recibió respuesta:', error.request);
            } else {
                errorMessage = `Error en la solicitud: ${error.message}`;
                console.error('Error en la configuración de la solicitud:', error.message);
            }
            Alert.alert('Error al obtener los HotParts', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Viene del aviso "Programación desea Entregar Hot Parts" -> se salta el
        // selector de Buscar/Escanear y se carga directo lo que Programación tiene pendiente.
        if (autoFetch) {
            fetchListadoEntregaProduccion();
        }
    }, []);

    const handleSearch = (text: string) => {
        setSearchText(text);

        const trimmedText = text.trim().toLowerCase();
        setIsSearchActive(trimmedText.length > 0);

        const filtered = hotParts.filter(
            (item) =>
                item['Cantidad'] > 0 &&
                item['Numero de Parte'].toLowerCase().includes(trimmedText)
        );

        setFilteredHotParts(filtered);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchListadoEntregaProduccion();
        setRefreshing(false);
    };

    const handleElegirBuscar = () => {
        setIsChooserVisible(false);
        fetchListadoEntregaProduccion();
    };

    const handleElegirEscanear = () => {
        setIsChooserVisible(false);
        setIsScannerVisible(true);
    };

    const handleReadCode = async (codeStringValue: string) => {
        setIsScannerVisible(false);
        try {
            const parsed = JSON.parse(codeStringValue);
            if (!parsed || !Array.isArray(parsed.items)) {
                throw new Error('Formato inválido');
            }
            const items: HotPart[] = parsed.items.map((item: any) => ({
                Folio: item.folio,
                ['Secuencia']: item.secuencia,
                ['Numero de Parte']: item.numeroParte,
                ['Cantidad']: item.cantidad,
            }));

            // Valida que el QR escaneado sea justo de Hot Parts que Programación tiene
            // pendientes para esta pantalla, y no de otro flujo (p. ej. Calidad->Embarques)
            // por haber escaneado por error el QR de otro dispositivo.
            const response = await axios.post('http://192.168.16.146:3002/api/hotparts/listadoEntregaProgramacion', { nomina });
            const foliosValidos = new Set((response.data.data ?? []).map((row: any) => row.FOLIO ?? row.Folio));
            const foliosInvalidos = items.filter((item) => !foliosValidos.has(item.Folio));

            if (foliosInvalidos.length > 0) {
                Alert.alert(
                    'QR no válido',
                    'Las piezas asociadas a este código QR para entrega NO corresponden a tu departamento.',
                    [{ text: 'OK', onPress: () => setIsChooserVisible(true) }]
                );
                return;
            }

            setHotParts(items);
            setFilteredHotParts(items);
            setSelectedItems(items);
        } catch (error) {
            Alert.alert(
                'Código QR no válido',
                'Este código no contiene información de Hot Parts.',
                [{ text: 'OK', onPress: () => setIsChooserVisible(true) }]
            );
        }
    };

    const toggleSelectItem = (item: HotPart) => {
        setSelectedItems((prevSelectedItems) => {
            if (prevSelectedItems.some((selectedItem) => selectedItem.Folio === item.Folio)) {
                return prevSelectedItems.filter((selectedItem) => selectedItem.Folio !== item.Folio);
            }
            return [...prevSelectedItems, item];
        });
    };

    const handleRecibirHotPart = async () => {
        if (filteredHotParts.length > 0) {
            try {
                const folios = selectedItems.map(item => item.Folio);
                const cantidades = selectedItems.map(item => item.Cantidad);
                const ordenesCompra = selectedItems.map(item => item['Secuencia']);
                const numerosParte = selectedItems.map(item => item['Numero de Parte']);
                console.log("Folios seleccionados:", folios);

                const response = await axios.post('http://192.168.16.146:3002/api/hotparts/cantidadRecibo', {
                    folios: folios,
                    cantidades: cantidades,
                    ordenesCompra: ordenesCompra,
                    numerosParte: numerosParte,
                    nomina: nomina
                });

                if (response.data.success) {
                    setIsModalVisible(true);
                    generarCodigoRecibo();
                } else {
                    Alert.alert('Error', response.data.message);
                }
            } catch (error) {
                console.error('Error al Recibir Hot Part:', error);
                Alert.alert('Error', 'Hubo un error al procesar la solicitud.');
            }
        } else {
            Alert.alert('Error', 'No hay Hot Parts para Recibir.');
        }
    };

    const generarCodigoRecibo = async () => {
        const foliosSeleccionados = selectedItems.map(item => item.Folio);
        console.log("Nomina enviado:", nomina);
        console.log("Folios seleccionados:", foliosSeleccionados);

        if (foliosSeleccionados.length === 0) {
            Alert.alert("Error", "No hay piezas seleccionadas");
            return;
        }

        try {
            setLoading(true);
            const response = await axios.post('http://192.168.16.146:3002/api/hotparts/generarCodigo', { folios: foliosSeleccionados, nomina });
            const { codigoEntrega } = response.data;
            setCodigoEntrega(typeof codigoEntrega === 'string' ? codigoEntrega : codigoEntrega[0]);
            setLoading(false);
            setIsModalVisible(true);
        } catch (error) {
            setLoading(false);
            if (error.response) {
                console.error("Error en respuesta:", error.response.data);
                Alert.alert('Error', `Hubo un error al generar el código de entrega: ${error.response.data}`);
            } else if (error.request) {
                console.error("No se recibió respuesta:", error.request);
                Alert.alert('Error', 'No se recibió respuesta del servidor');
            } else {
                console.error("Error en la solicitud:", error.message);
                Alert.alert('Error', `Error en la solicitud: ${error.message}`);
            }
        }
    };

    const handleConfirmar = async () => {
        try {
            setIsModalVisible(false);
            await fetchListadoEntregaProduccion();
        } catch (outerError) {
            console.error('Error inesperado en handleConfirmar:', outerError);
            Alert.alert('Error inesperado', 'Ocurrió un error inesperado. Inténtalo de nuevo.');
            setLoading(false);
        }
    };

    const groupedHotParts = React.useMemo(() => {
        const groups = new Map<number, HotPart[]>();
        filteredHotParts.forEach((item) => {
            const secuencia = item['Secuencia'];
            if (!groups.has(secuencia)) {
                groups.set(secuencia, []);
            }
            groups.get(secuencia)!.push(item);
        });
        return Array.from(groups.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([secuencia, data]) => ({
                title: secuencia,
                data,
            }));
    }, [filteredHotParts]);

    const renderItem = ({ item }: { item: HotPart }) => {
        const isSelected = selectedItems.some((selectedItem) => selectedItem.Folio === item.Folio);

        return (
            <TouchableOpacity
                style={[styles.card, isSelected && styles.selectedCard]}
                onPress={() => toggleSelectItem(item)}
            >
                <View style={styles.cardRow}>
                    <Text style={styles.cardPart}>{item['Numero de Parte']}</Text>
                    <Text style={styles.cardQty}>{item['Cantidad']}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ImageBackground source={require('./assets/fondo2.jpg')} style={styles.container}>
                    <View style={styles.topContainer}>
                        <Text style={styles.userText}>{nomina}  |  {nombre}  |  {area}</Text>
                    </View>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            value={searchText}
                            onChangeText={handleSearch}
                            placeholder="Buscar Hot Part"
                        />
                    </View>

                    <View style={styles.tableContainer}>
                        {loading ? (
                            <ActivityIndicator size="large" color="#0e5699" />
                        ) : (
                            <SectionList
                                sections={groupedHotParts}
                                renderItem={renderItem}
                                renderSectionHeader={({ section }) => {
                                    const totalPiezas = section.data.reduce(
                                        (sum: number, item: any) => sum + Number(item['Cantidad']),
                                        0
                                    );
                                    return (
                                        <View style={styles.secuenciaHeader}>
                                            <Text style={styles.secuenciaHeaderText}>
                                                Secuencia {section.title}
                                                <Text style={styles.secuenciaCountText}>
                                                    {'   '}({totalPiezas} {totalPiezas === 1 ? 'pieza' : 'piezas'})
                                                </Text>
                                            </Text>
                                        </View>
                                    );
                                }}
                                keyExtractor={(item) => item.Folio.toString()}
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                stickySectionHeadersEnabled={true}
                                ListEmptyComponent={
                                    <Text style={styles.NoResult}>No hay resultados</Text>
                                }
                                contentContainerStyle={{
                                    flexGrow: 1,
                                    justifyContent: groupedHotParts.length === 0 ? 'center' : 'flex-start',
                                    paddingBottom: 50, // espacio extra para no tapar el último item con el botón
                                  }}
                            />
                        )}
                    </View>

                    {filteredHotParts.length > 0 && (
                        <View style={styles.fixedButtonContainer}>
                        <TouchableOpacity
                            style={[styles.entregarButton, selectedItems.length === 0 && styles.disabledButton]}
                            onPress={handleRecibirHotPart}
                            disabled={selectedItems.length === 0}
                        >
                            <Text style={styles.buttonText}>Confirmar Recibo</Text>
                        </TouchableOpacity>
                        </View>
                    )}

                    <Modal
                        transparent={true}
                        animationType="slide"
                        visible={isModalVisible}
                        onRequestClose={() => setIsModalVisible(false)}
                    >
                        <View style={styles.modalBackground}>
                            <View style={styles.modalContainer}>
                                <Text style={styles.modalTitle}>Recibo de Hot Part</Text>

                                <View style={styles.qrContainer}>
                                    <QRCode value={codigoEntrega || ' '} size={150} />
                                </View>

                                <Text style={styles.codigoTexto}>
                                    Código: <Text style={styles.boldText}>{codigoEntrega}</Text>
                                    <Text>. Por favor comparte este código con la persona que realiza la entrega.
                                    </Text>
                                </Text>

                                <TouchableOpacity
                                    style={styles.confirmButton}
                                    onPress={handleConfirmar}
                                >
                                    <Text style={styles.buttonText}>OK</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>

                    <Modal
                        transparent={true}
                        animationType="fade"
                        visible={isChooserVisible}
                        onRequestClose={handleElegirBuscar}
                    >
                        <View style={styles.modalBackground}>
                            <View style={styles.modalContainer}>
                                <Text style={styles.modalTitle}>Recibir Hot Parts</Text>
                                <Text style={styles.chooserSubtitle}>¿Cómo quieres identificar las piezas?</Text>

                                <TouchableOpacity style={[styles.chooserButton, { backgroundColor: '#0e5699' }]} onPress={handleElegirBuscar}>
                                    <Text style={styles.buttonText}>Buscar Hot Parts</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={[styles.chooserButton, { backgroundColor: '#4CAF50' }]} onPress={handleElegirEscanear}>
                                    <Text style={styles.buttonText}>Escanear QR</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>

                    {isScannerVisible && (
                        <Modal
                            animationType="slide"
                            transparent={false}
                            visible={isScannerVisible}
                            onRequestClose={() => setIsScannerVisible(false)}
                        >
                            <Camera
                                style={{ flex: 1 }}
                                cameraType="back"
                                scanBarcode={true}
                                onReadCode={(event) => handleReadCode(event.nativeEvent.codeStringValue)}
                            />
                        </Modal>
                    )}
                </ImageBackground>
            </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        //  paddingVertical: 10,
    },
    headerRow: {
        //   borderBottomWidth: 1,
        borderColor: '#363636',
        flexDirection: 'row',
        // paddingVertical: 10,
        // paddingHorizontal: 5,
    },
    cellText: {
        fontSize: 13,
        color: '#000',
    },
    Screen: {
        fontSize: 14,
        color: 'black',
        marginBottom: 5,
        marginTop: 30,
        textAlign: 'center',
        backgroundColor: '#3498db'
    },
    headerSecuencia: {
        flex: 1.2,
        textAlign: 'left',
        marginLeft: 15,
        fontWeight: 'bold',
        color: '#000',
    },
    headerParte: {
        flex: 2,
        textAlign: 'center',
        fontWeight: 'bold',
        color: '#000',
    },
    headerQty: {
        flex: 1,
        textAlign: 'right',
        marginRight: 10,
        fontWeight: 'bold',
        color: '#000',
    },
    selectedRow: {
        backgroundColor: '#cce7ff'
    },
    topContainer: {
        position: 'absolute',
        // top: 20,
        left: 20,
        right: 20,
        alignItems: 'center',
    },
    boldText: {
        fontWeight: 'bold',
        fontSize: 16,
    },
    text: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    userText: {
        fontSize: 12,
        color: 'black',
        marginBottom: 5,
        marginTop: 10,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 35,
        marginBottom: 1
    },
    input: {
        width: 250,
        height: 40,
        borderColor: '#c4c4c4',
        backgroundColor: '#cfcfcf',
        borderWidth: 1,
        paddingLeft: 10,
        marginRight: 10,
        fontSize: 16,
    },
    searchButton: {
        backgroundColor: '#0e5699',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 5,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        textAlign: 'center',
    },
    tableContainer: {
        marginTop: 2,
        width: '95%',
        marginBottom: 150,
    },
    tableRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#c4c4c4',
        paddingHorizontal: 10,
    },
    tableCell: {
        width: '45%',
        fontSize: 16,
        color: 'black',
        textAlign: 'center',
        padding: 3,
        fontWeight: 'bold',
    },
    NoResult: {
        fontSize: 25,
        textAlign: 'center',
        marginTop: 80,
    },
    entregarButton: {
        backgroundColor: '#0e5699',
        paddingVertical: 15,
        paddingHorizontal: 25,
        borderRadius: 5,
        marginTop: 20,
        width: '90%',
        //  position: 'absolute',
        //  bottom: 20,
    },
    disabledButton: {
        backgroundColor: '#cccccc',
    },
    fixedButtonContainer: {
        position: 'absolute',
        bottom: 60,      // distancia desde abajo (ajústalo según tu tab bar)
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 40,
        paddingBottom: 100, // espacio para que el botón no tape la lista
    },
    modalBackground: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContainer: {
        width: '80%',
        padding: 20,
        backgroundColor: 'white',
        borderRadius: 10,
        alignItems: 'center',
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    chooserSubtitle: {
        fontSize: 14,
        color: '#555',
        textAlign: 'center',
        marginBottom: 16,
    },
    chooserButton: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 12,
    },
    codigoText: {
        fontSize: 16,
    },
    confirmButton: {
        backgroundColor: '#0e5699',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 5,
        width: '48%',
    },
    cancelButton: {
        backgroundColor: '#c4c4c4',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 5,
        width: '48%',
    },
    qrContainer: {
        alignItems: 'center',
        marginVertical: 5,
    },
    codigoTexto: {
        textAlign: 'center',
        fontSize: 16,
        marginBottom: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        marginVertical: 8,   // separación entre elementos
        marginHorizontal: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2, // sombra Android
    },
    selectedCard: {
        backgroundColor: '#cce7ff',
    },
    cardRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    cardPart: {
        fontSize: 14,
        fontWeight: '600',
        color: '#000',
    },
    cardQty: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0e5699',
    },
    secuenciaHeader: {
        backgroundColor: '#f0f4f8',
        borderBottomWidth: 2,
        borderBottomColor: '#0e5699',
        paddingVertical: 6,
        paddingHorizontal: 10,
        marginTop: 14,
        marginBottom: 4,
        marginHorizontal: 4,
    },
    secuenciaHeaderText: {
        color: '#0e5699',
        fontWeight: 'bold',
        fontSize: 14,
    },
    secuenciaCountText: {
        color: '#5c7a94',
        fontWeight: '400',
        fontSize: 12,
    },
});

export default ReciboProduccionScreen;
