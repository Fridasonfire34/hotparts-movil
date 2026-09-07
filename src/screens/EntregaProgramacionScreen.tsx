import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ImageBackground,
    TextInput,
    TouchableOpacity,
    FlatList,
    SectionList,
    Alert,
    Modal,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
    TouchableWithoutFeedback
} from 'react-native';
import { Camera } from 'react-native-camera-kit';
import QRCode from 'react-native-qrcode-svg';
import axios from 'axios';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from './App';
import { runOnJS } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type EntregaProgramacionScreenRouteProp = RouteProp<RootStackParamList, 'EntregaProgramacion'>;

interface Props {
    route: EntregaProgramacionScreenRouteProp;
}

interface HotPart {
    Folio: string;
    ['Secuencia']: number;
    ['Numero de Parte']: string;
    ['Cantidad']: number;
    ['Entregar']?: string;
}

const EntregaProgramacionScreen: React.FC<Props> = ({ route }) => {
    const { nomina, nombre, area } = route?.params || {};
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const [hotParts, setHotParts] = useState<HotPart[]>([]);
    const [filteredHotParts, setFilteredHotParts] = useState<HotPart[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [codigoEntrega, setCodigoEntrega] = useState<string>('');
    const [selectedItems, setSelectedItems] = useState<HotPart[]>([]);
    const [searchText, setSearchText] = useState<string>('');
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isScannerVisible, setIsScannerVisible] = useState(false);

    useEffect(() => {
        const fetchHotParts = async () => {
            setLoading(true);
            try {
                const response = await axios.get('http://192.168.16.146:3002/api/hotparts/Programacion');
                setHotParts(response.data);
                setFilteredHotParts(response.data);
                // Piezas que Programación ya marcó para entregar desde Disparos
                // vienen precargadas/seleccionadas, sin que el usuario tenga que buscarlas.
                setSelectedItems(response.data.filter((item: HotPart) => item['Entregar'] === 'OK'));
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

        fetchHotParts();
    }, []);


    const onRefresh = async () => {
        setLoading(true);
        setRefreshing(true);
        try {
            const response = await axios.get('http://192.168.16.146:3002/api/hotparts/Programacion');
            setHotParts(response.data);
            setFilteredHotParts(response.data);
        } catch (error) {
            Alert.alert('Error', 'No se pudieron actualizar los datos.');
        } finally {
            setRefreshing(false);
            setLoading(false);
        }
    };

    const handleSearch = (text: string) => {
        setSearchText(text);

        const trimmedText = text.trim().toLowerCase();
        setIsSearchActive(trimmedText.length > 0);

        const filtered = hotParts.filter(
            (item) =>
                item['Cantidad'] > 0 &&
                (item['Numero de Parte'].toLowerCase().includes(trimmedText) ||
                    item['Secuencia'].toString().toLowerCase().includes(trimmedText))
        );

        setFilteredHotParts(filtered);
    };

    const toggleSelectItem = (item: HotPart) => {
        console.log("Toggling item:", item.Folio);
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

                const response = await axios.post('http://192.168.16.146:3002/api/hotparts/cantidadTodo', {
                    folios: folios,
                    cantidades: cantidades,
                    ordenesCompra: ordenesCompra,
                    numerosParte: numerosParte,
                    nomina: nomina
                });

                await axios.post('http://192.168.16.146:3002/api/hotparts/listadoEntregaProgramacion', {
                    folios: folios,
                    cantidades: cantidades,
                    ordenesCompra: ordenesCompra,
                    numerosParte: numerosParte,
                    nomina: nomina,
                    area: area
                });

                if (response.data.success) {
                    setIsModalVisible(true);

                    // Aviso inmediato a todos los usuarios de que Programación quiere
                    // entregar, para que Producción pueda ir directo a recibir. No debe
                    // bloquear ni tronar el flujo si falla el envío del push.
                    axios.post('http://192.168.16.146:3002/api/hotparts/solicitudRecibo', {
                        origen: area,
                        destino: 'Produccion',
                        nomina: nomina,
                    }).catch((err) => console.error('Error al enviar solicitud de recibo:', err));
                } else {
                    Alert.alert('Error', response.data.message);
                }
            } catch (error) {
                console.error('Error al Entregar Hot Part:', error);
                Alert.alert('Error', 'Hubo un error al procesar la solicitud.');
            }
        } else {
            Alert.alert('Error', 'No hay Hot Parts para entregar.');
        }
    };

    const handleEscanearQR = () => {
        setIsScannerVisible(true);
    };


    const handleVerificarCodigos = async () => {
        if (!codigoEntrega) {
            Alert.alert('Error', 'El código de recibo es incorrecto');
            return;
        }
        try {
            const folios = selectedItems.map(item => item.Folio);
            console.log("Folios seleccionados:", folios);
            setLoading(true);

            if (!folios || folios.length === 0) {
                Alert.alert('Error', 'No se encontró el folio');
                setLoading(false);
                return;
            }

            const verifyResponse = await axios.post('http://192.168.16.146:3002/api/hotparts/verificarCodigos', {
                folios: folios,
                codigoEntrega: codigoEntrega,
                nomina: nomina
            });

            if (verifyResponse.data.success) {
                const reciboResponse = await axios.post('http://192.168.16.146:3002/api/hotparts/reciboProduccion', {
                    folios: folios,
                    nomina: nomina,
                });

                if (reciboResponse.data.success) {
                    try {
                        const guardarMovimientoResponse = await axios.post('http://192.168.16.146:3002/api/hotparts/guardarMovimiento', {
                            folios: folios,
                            nomina: nomina,
                        });

                        if (guardarMovimientoResponse.data.success) {
                            console.log('Movimiento guardado correctamente');
                        } else {
                            console.error('Error al guardar el movimiento:', guardarMovimientoResponse.data.message);
                        }
                    } catch (guardarMovimientoError) {
                        console.error('Error al llamar a la API guardarMovimiento:', guardarMovimientoError.message);
                    }

                    Alert.alert('Éxito', 'Hot Parts entregados a Producción', [
                        {
                            text: 'OK',
                            onPress: async () => {
                                try {
                                    const updateResponse = await axios.get('http://192.168.16.146:3002/api/hotparts/Programacion');
                                    setHotParts(updateResponse.data);
                                    setFilteredHotParts(updateResponse.data);
                                    navigation.navigate('Menu');

                                    const entregaResponse = await axios.post('http://192.168.16.146:3002/api/hotparts/entregaProgramacion', {
                                        folios: folios,
                                        nomina: nomina,
                                        area: area,
                                    });
                                    console.log('Respuesta de entregaProgramacion:', entregaResponse.data);
                                } catch (error) {
                                    console.error('Error al ejecutar las APIs:', error);
                                }
                            }
                        }
                    ]);
                    setIsModalVisible(false);
                } else {
                    Alert.alert('Error', reciboResponse.data.message || 'Error desconocido al actualizar el estatus');
                }
            } else {
                Alert.alert('Error', verifyResponse.data.message || 'Error desconocido al verificar los códigos');
            }
        } catch (error) {
            const backendMessage = error.response?.data?.error || error.response?.data?.message;
            console.error('Axios Error:', error.response ? error.response.data : error.message);

            try {
                const eliminarResponse = await axios.post('http://192.168.16.146:3002/api/hotparts/eliminarCodigos', {});

                if (eliminarResponse.data.success) {
                    console.log('Códigos eliminados correctamente');
                } else {
                    console.error('Error al eliminar los códigos:', eliminarResponse.data.message);
                }
            } catch (eliminarError) {
                console.error('Error al llamar a la API eliminarCodigos:', eliminarError.message);
            }

            Alert.alert(
                'Error',
                backendMessage
                    ? `Hubo un error al verificar los códigos: ${backendMessage}`
                    : 'Hubo un error al verificar los códigos: El código de entrega no coincide para las piezas seleccionadas'
            );
        } finally {
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
        const isPrecargado = item['Entregar'] === 'OK';

        return (
            <TouchableOpacity
                style={[styles.card, isSelected && styles.selectedCard]}
                onPress={() => toggleSelectItem(item)}
            >
                <View style={styles.cardRow}>
                    <Text style={styles.cardPart}>{item['Numero de Parte']}</Text>
                    <Text style={styles.cardQty}>{item['Cantidad']}</Text>
                </View>
                {isPrecargado && (
                    <Text style={styles.precargadoBadge}>Marcado en Disparos para entregar</Text>
                )}
            </TouchableOpacity>
        );
    };

    const qrEntregaData = JSON.stringify({
        usuarioEntrega: nomina,
        items: selectedItems.map((item) => ({
            folio: item.Folio,
            secuencia: item['Secuencia'],
            numeroParte: item['Numero de Parte'],
            cantidad: item['Cantidad'],
        })),
    });

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ImageBackground
                    source={require('./assets/fondo2.jpg')}
                    style={[styles.container, { paddingBottom: insets.bottom }]}
                    imageStyle={styles.backgroundImage}
                >
                    <View style={styles.topContainer}>
                        <Text style={styles.userText}>{nomina}  |  {nombre}  |  {area}</Text>
                    </View>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            value={searchText}
                            onChangeText={handleSearch}
                            placeholder="Buscar Hot Part"
                            placeholderTextColor="#999"
                        />
                    </View>

                    <View style={styles.tableContainer}>
                        {loading ? (
                            <ActivityIndicator size="large" color="#0e5699" />
                        ) : (
                            <SectionList
                                style={styles.list}
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
                                    paddingBottom: 12,
                                  }}
                            />
                        )}
                    </View>

                    <View style={styles.fixedButtonContainer}>
                        {selectedItems.length > 0 && (
                            <TouchableOpacity
                                style={styles.entregarButton}
                                onPress={handleRecibirHotPart}
                            >
                                <Text style={styles.buttonText}>Entregar Hot Part</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* MODAL */}
                    <Modal
                        transparent={true}
                        animationType="slide"
                        visible={isModalVisible}
                        onRequestClose={() => setIsModalVisible(true)}
                    >
                        <View style={styles.modalBackground}>
                            <View style={styles.modalContainer}>
                                <TouchableOpacity
                                    style={styles.modalCloseButton}
                                    onPress={() => setIsModalVisible(false)}
                                >
                                    <Text style={styles.modalCloseButtonText}>✕</Text>
                                </TouchableOpacity>

                                <Text style={styles.modalTitle}>Hot Parts a entregar</Text>

                                <View style={styles.qrContainer}>
                                    <QRCode value={qrEntregaData} size={150} />
                                </View>

                                <Text style={styles.qrHelperText}>
                                    Muestra este código QR a la persona de Producción para que identifique lo que estás entregando.
                                </Text>

                                <Text style={styles.modalTitle}>Ingresa el código de Recibo</Text>

                                <TextInput
                                    style={styles.inputCodigo}
                                    placeholder="Ingresa el código"
                                    value={codigoEntrega}
                                    onChangeText={setCodigoEntrega}
                                    keyboardType="default"
                                />

                                <View style={styles.buttonsContainer}>
                                    <TouchableOpacity style={[styles.modalButtonScan, { backgroundColor: '#4CAF50' }]} onPress={handleEscanearQR}>
                                        <Text style={styles.buttonText}>Escanear QR de Recibo</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#0e5699' }]} onPress={handleVerificarCodigos}>
                                        <Text style={styles.buttonText}>Confirmar Codigo</Text>
                                    </TouchableOpacity>
                                </View>
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
                                onReadCode={(event) => {
                                    setCodigoEntrega(event.nativeEvent.codeStringValue);
                                    setIsScannerVisible(false);
                                }}
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
        marginTop: 15,
    },
    backgroundImage: {
        opacity: 1,
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
        marginLeft: 10,
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
    text: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    userText: {
        fontSize: 12,
        color: 'black',
        marginBottom: 10,
        marginTop: 10,
    },
    inputContainer: {
        width: '92%',
        marginTop: 40,
        marginBottom: 12,
    },
    input: {
        width: '100%',
        height: 48,
        backgroundColor: 'white',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 15,
        color: '#000',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    tableContainer: {
        flex: 1,
        width: '95%',
    },
    list: {
        flex: 1,
    },
    fixedButtonContainer: {
        width: '100%',
        height: 88,
        alignItems: 'center',
        justifyContent: 'center',
    },
    disabledButton: {
        backgroundColor: '#cccccc',
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
        width: '50%',
        fontSize: 8,
        // color: 'black',
        textAlign: 'center',
        // padding: 3,
        //   fontWeight: 'bold',
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
        borderRadius: 8,
        width: '90%',
        alignItems: 'center',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 40,
        paddingBottom: 100, // espacio para que el botón no tape la lista
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
    modalBackground: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: '90%',
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10,
        elevation: 5,
        position: 'relative',
    },
    modalCloseButton: {
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e0e0e0',
    },
    modalCloseButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#555',
        lineHeight: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
    },
    qrContainer: {
        alignItems: 'center',
        marginVertical: 10,
    },
    qrHelperText: {
        fontSize: 13,
        color: '#555',
        textAlign: 'center',
        marginBottom: 10,
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 1,
    },
    modalButton: {
        flex: 1,
        marginHorizontal: 5,
        paddingVertical: 12,
        borderRadius: 5,
        alignItems: 'center',
    },
    button: {
        flex: 1,
        marginHorizontal: 5,
        backgroundColor: '#007AFF',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
        textAlign: 'center',
    },
    inputCodigo: {
        width: '80%',
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: '#a9aaac',
        borderRadius: 5,
        padding: 10,
        marginBottom: 10,
        backgroundColor: '#cfcfcf',
    },
    modalButtonScan: {
        flex: 1.2,
        marginHorizontal: 4,
        paddingVertical: 12,
        borderRadius: 5,
        alignItems: 'center',
        width: '90%',
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
    precargadoBadge: {
        fontSize: 11,
        fontWeight: '600',
        color: '#0e8f4b',
        marginTop: 4,
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
export default EntregaProgramacionScreen;

