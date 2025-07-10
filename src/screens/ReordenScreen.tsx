import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ImageBackground, TextInput, TouchableOpacity, FlatList, BackHandler, Alert, Modal, KeyboardAvoidingView, TouchableWithoutFeedback, ActivityIndicator, Keyboard, Platform } from 'react-native';
import axios from 'axios';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from './App';

type ReordenScreenRouteProp = RouteProp<RootStackParamList, 'ReordenScreen'>;

interface Props {
    route: ReordenScreenRouteProp;
}

interface HotPart {
    Folio: string;
    ['Secuencia']: number;
    ['Numero de Parte']: string;
    ['Cantidad Faltante']: number;
}

const ReordenScreen: React.FC<Props> = ({ route }) => {
    const { nomina, nombre, area } = route?.params || {};
    const [hotParts, setHotParts] = useState<HotPart[]>([]);
    const [filteredHotParts, setFilteredHotParts] = useState<HotPart[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedItems, setSelectedItems] = useState<HotPart[]>([]);
    const [searchText, setSearchText] = useState<string>('');
    const [quantitiesToDeliver, setQuantitiesToDeliver] = useState<Record<string, number>>({});
    const [currentItemIndex, setCurrentItemIndex] = useState(0);
    const [isQuantityModalVisible, setIsQuantityModalVisible] = useState(false);
    const [foliosCantidadUno, setFoliosCantidadUno] = useState<string[]>([]);
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [isComentarioModalVisible, setIsComentarioModalVisible] = useState(false);
    const [comentario, setComentario] = useState('');
    const [showComentarioPrompt, setShowComentarioPrompt] = useState(false);
    const [mostrarAlertaSeleccionUnica, setMostrarAlertaSeleccionUnica] = useState(true);
    const [refreshing, setRefreshing] = useState(false);


    useEffect(() => {
        const fetchHotParts = async () => {
            setLoading(true);
            try {
                const response = await axios.get('http://192.168.16.146:3002/api/calidad');
                setHotParts(response.data);
                setFilteredHotParts(response.data);
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

    useEffect(() => {
        const timer = setTimeout(() => {
            setMostrarAlertaSeleccionUnica(true);
        }, 500);

        return () => clearTimeout(timer);
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            const response = await axios.get('http://192.168.16.146:3002/api/calidad');
            setHotParts(response.data);
            setFilteredHotParts(response.data);
        } catch (error) {
            Alert.alert('Error', 'No se pudieron actualizar los datos.');
        } finally {
            setRefreshing(false);
        }
    };

    const handleSearch = (text: string) => {
        setSearchText(text);

        const trimmedText = text.trim().toLowerCase();
        setIsSearchActive(trimmedText.length > 0);

        const filtered = hotParts.filter(
            (item) =>
                item['Cantidad Faltante'] > 0 &&
                item['Numero de Parte'].toLowerCase().includes(trimmedText)
        );

        setFilteredHotParts(filtered);
    };

    const toggleSelectItem = (item: HotPart) => {
        setSelectedItems((prevSelectedItems) => {
            const isAlreadySelected = prevSelectedItems.some((selectedItem) => selectedItem.Folio === item.Folio);

            if (isAlreadySelected) {
                return [];
            } else {
                return [item];
            }
        });
    };

    const handleRecibirHotPart = async () => {
        const rowsWithQuantityOne = selectedItems.filter(
            (item) => item['Cantidad Faltante'] === 1
        );

        const rowsWithQuantityGreaterThanOne = selectedItems.filter(
            (item) => item['Cantidad Faltante'] > 1
        );

        if (rowsWithQuantityOne.length > 0) {
            const folios = rowsWithQuantityOne.map((item) => item.Folio);
            const cantidades = rowsWithQuantityOne.map((item) => item['Cantidad Faltante']);
            const ordenesCompra = rowsWithQuantityOne.map((item) => item['Secuencia']);
            const numerosParte = rowsWithQuantityOne.map((item) => item['Numero de Parte']);

            try {
                const response = await axios.post('http://192.168.16.146:3002/api/cantidadReorden', {
                    folios,
                    cantidades,
                    ordenesCompra,
                    numerosParte,
                    nomina,
                });

                if (response.data.success) {
                    console.log('Filas con cantidad 1 procesadas correctamente.');
                    setFoliosCantidadUno(folios);
                    setSelectedItems(rowsWithQuantityOne);
                    setShowComentarioPrompt(true); // Preguntar si se desea agregar comentario
                } else {
                    Alert.alert('Error', response.data.message);
                }
            } catch (error) {
                console.error('Error al procesar las filas con cantidad 1:', error);
                Alert.alert('Error', 'Hubo un error al procesar las filas con cantidad 1.');
            }
        }

        if (rowsWithQuantityGreaterThanOne.length > 0) {
            setSelectedItems(rowsWithQuantityGreaterThanOne);
            setCurrentItemIndex(0);
            setIsQuantityModalVisible(true);
        }

        if (rowsWithQuantityOne.length === 0 && rowsWithQuantityGreaterThanOne.length === 0) {
            Alert.alert('Aviso', 'No se seleccionaron piezas con cantidad válida.');
        }
    };
    const handleQuantityConfirm = async () => {
        const item = selectedItems[currentItemIndex];
        const quantityToDeliver = quantitiesToDeliver[item.Folio];

        if (!quantityToDeliver || quantityToDeliver <= 0 || quantityToDeliver > item['Cantidad Faltante']) {
            Alert.alert('Error', `La cantidad ingresada para el Hot Part ${item['Numero de Parte']} debe ser mayor a 0 y menor o igual a la cantidad disponible.`);
            return;
        }

        try {
            const response = await axios.post('http://192.168.16.146:3002/api/cantidadReorden', {
                folios: [item.Folio],
                cantidades: [quantityToDeliver],
                nomina: nomina,
                ordenesCompra: [item['Secuencia']],
                numerosParte: [item['Numero de Parte']],
            });

            if (response.data.success) {
                console.log(`Cantidad registrada correctamente para Hot Part ${item['Numero de Parte']}`);
            } else {
                Alert.alert('Error', response.data.message);
            }

            if (currentItemIndex + 1 < selectedItems.length) {
                setCurrentItemIndex(currentItemIndex + 1);
            } else {
                setIsQuantityModalVisible(false);
                setShowComentarioPrompt(true);
            }

        } catch (error) {
            console.error('Error al enviar la cantidad:', error);
            Alert.alert('Error', 'Hubo un error al enviar la cantidad.');
        }
    };
    const handleConfirmarComentario = async () => {
        try {
            const foliosSeleccionados = selectedItems.map(item => item.Folio);
            const secuencias = selectedItems.map(item => item['Secuencia']);

            const response = await axios.post('http://192.168.16.146:3002/api/ComentariosReorden', {
                folios: foliosSeleccionados,
                comentario,
                nomina: nomina
            });

            if (response.data.success) {
                await axios.post('http://192.168.16.146:3002/api/estatusReorden', {
                    folios: foliosSeleccionados,
                    nomina: nomina
                });

                await axios.post('http://192.168.16.146:3002/api/guardarMovimientoReorden', {
                    folios: foliosSeleccionados,
                    nomina: nomina
                });

                await axios.post('http://192.168.16.146:3002/api/reordenNotif', {
                    secuencias: secuencias,
                });

                Alert.alert('Éxito', 'Comentario registrado correctamente.', [
                    {
                        text: 'OK',
                        onPress: async () => {
                            const updateResponse = await axios.get('http://192.168.16.146:3002/api/calidad');
                            setHotParts(updateResponse.data);
                            setFilteredHotParts(updateResponse.data);
                            setSelectedItems([]);
                            setComentario('');
                        }
                    }
                ]);
                setIsComentarioModalVisible(false);
            } else {
                Alert.alert('Error', response.data.message);
            }
        } catch (error) {
            console.error('Error al guardar comentario:', error);
            Alert.alert('Error', 'Hubo un error al guardar el comentario.');
        }
    };

    const handleReordenSinComentario = async () => {
        const folios = selectedItems.map(item => item.Folio);
        const secuencias = selectedItems.map(item => item['Secuencia']);

        if (folios.length === 0) {
            Alert.alert('Aviso', 'No hay piezas seleccionadas para registrar.');
            return;
        }

        try {
            const response = await axios.post('http://192.168.16.146:3002/api/estatusReorden', {
                folios,
                nomina
            });

            if (response.data.success) {
                Alert.alert(
                    'Registro exitoso',
                    'Pieza registrada para reorden.',
                    [
                        {
                            text: 'OK',
                            onPress: async () => {
                                try {
                                    const guardarMovimientoResponse = await axios.post('http://192.168.16.146:3002/api/guardarMovimientoReorden', {
                                        folios: folios,
                                        nomina: nomina
                                    });
                                    console.log('Movimiento guardado:', guardarMovimientoResponse.data);

                                    await axios.post('http://192.168.16.146:3002/api/reordenNotif', {
                                        secuencias: secuencias,
                                    });

                                } catch (error) {
                                    console.error('Error al guardar movimiento de reorden o enviar notificación:', error);
                                }

                                const updateResponse = await axios.get('http://192.168.16.146:3002/api/calidad');
                                setHotParts(updateResponse.data);
                                setFilteredHotParts(updateResponse.data);
                                setSelectedItems([]);
                            }
                        }
                    ]
                );
            } else {
                Alert.alert('Error', response.data.message);
            }
        } catch (error) {
            console.error('Error al registrar sin comentario:', error);
            Alert.alert('Error', 'Error al registrar sin comentario.');
        }
    };

    const handleQuantityChange = (text: string) => {
        const item = selectedItems[currentItemIndex];
        const newQuantity = text === '' ? undefined : Number(text);
        setQuantitiesToDeliver((prev) => ({
            ...prev,
            [item.Folio]: newQuantity,
        }));
    };

    const handleConfirmar = () => {
        setIsModalVisible(false);
    };


    const renderItem = ({ item }: { item: HotPart }) => {
        const isSelected = selectedItems.some((selectedItem) => selectedItem.Folio === item.Folio);

        return (
            <TouchableOpacity
                onPress={() => toggleSelectItem(item)}
                style={[
                    styles.tableRow,
                    isSelected && styles.selectedRow
                ]}
            >
                <Text style={styles.headerSecuencia}>{item.Secuencia}</Text>
                <Text style={styles.headerParte}>{item['Numero de Parte']}</Text>
                <Text style={styles.headerQty}>{item['Cantidad Faltante']}</Text>
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
                        <Text style={styles.userText}>{nomina} {nombre} {area}</Text>
                    </View>

                    <Modal
                        transparent={true}
                        animationType="fade"
                        visible={mostrarAlertaSeleccionUnica}
                        onRequestClose={() => setMostrarAlertaSeleccionUnica(false)}
                    >
                        <View style={styles.modalBackground}>
                            <View style={styles.modalContainer}>
                                <Text style={styles.modalTitle}>
                                    Solo puedes seleccionar un Hot Part a la vez para realizar la reorden
                                </Text>
                                <TouchableOpacity
                                    style={styles.confirmButton}
                                    onPress={() => setMostrarAlertaSeleccionUnica(false)}
                                >
                                    <Text style={styles.buttonText}>Entendido</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>

                    <Text style={styles.Screen}>Reordenes</Text>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            value={searchText}
                            onChangeText={handleSearch}
                            placeholder="Buscar Pieza"
                        />
                    </View>

                    <View style={styles.tableContainer}>
                        {loading ? (
                            <ActivityIndicator size="large" color="#0e5699" />
                        ) : (
                            <FlatList
                                data={filteredHotParts}
                                renderItem={renderItem}
                                keyExtractor={(item) => item.Folio.toString()}
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                ListEmptyComponent={
                                    <Text style={styles.NoResult}>No hay resultados</Text>
                                }
                                ListHeaderComponent={
                                    filteredHotParts.length > 0 ? (
                                        <View style={[styles.tableRow, styles.headerRow]}>
                                            <Text style={styles.headerSecuencia}>Secuencia</Text>
                                            <Text style={styles.headerParte}>N. Parte</Text>
                                            <Text style={styles.headerQty}>Qty</Text>
                                        </View>
                                    ) : null
                                }
                                contentContainerStyle={{
                                    flexGrow: 1,
                                    justifyContent: filteredHotParts.length === 0 ? 'center' : 'flex-start',
                                }}
                            />
                        )}
                    </View>

                    {selectedItems.length > 0 && (
                        <View style={styles.fixedButtonContainer}>
                        <TouchableOpacity
                            style={[styles.entregarButton, selectedItems.length === 0 && styles.disabledButton]}
                            onPress={handleRecibirHotPart}
                            disabled={selectedItems.length === 0}
                        >
                            <Text style={styles.buttonText}>Reordenar Hot Part</Text>
                        </TouchableOpacity>
                        </View>
                    )}

                    <Modal
                        transparent={true}
                        animationType="slide"
                        visible={isQuantityModalVisible}
                        onRequestClose={() => setIsQuantityModalVisible(false)}
                    >
                        <View style={styles.modalBackground}>
                            <View style={styles.modalContainer}>
                                {selectedItems.length > 0 && currentItemIndex < selectedItems.length && (
                                    <View key={selectedItems[currentItemIndex].Folio}>
                                        <Text style={styles.modalTitle}>
                                            El Hot Part: {selectedItems[currentItemIndex]['Numero de Parte']} contiene {selectedItems[currentItemIndex]['Cantidad Faltante']} piezas. ¿Cuántas se van a Reordenar?
                                        </Text>
                                        <TextInput
                                            style={styles.input}
                                            value={String(quantitiesToDeliver[selectedItems[currentItemIndex].Folio] || '')}
                                            onChangeText={handleQuantityChange}
                                            keyboardType="numeric"
                                            placeholder="Piezas a Reordenar"
                                        />
                                        <View style={styles.buttonsContainer}>
                                            <TouchableOpacity
                                                style={styles.confirmButton}
                                                onPress={handleQuantityConfirm}
                                            >
                                                <Text style={styles.buttonText}>Confirmar</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.cancelButton}
                                                onPress={() => setIsQuantityModalVisible(false)}
                                            >
                                                <Text style={styles.buttonText}>Cancelar</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </View>
                        </View>
                    </Modal>

                    <Modal
                        transparent={true}
                        animationType="fade"
                        visible={showComentarioPrompt}
                        onRequestClose={() => setShowComentarioPrompt(false)}
                    >
                        <View style={styles.modalBackground}>
                            <View style={styles.modalContainer}>
                                <Text style={styles.modalTitle}>¿Deseas agregar un comentario?</Text>
                                <View style={styles.buttonsContainer}>
                                    <TouchableOpacity
                                        style={styles.confirmButton}
                                        onPress={() => {
                                            setShowComentarioPrompt(false);
                                            setIsComentarioModalVisible(true);
                                        }}
                                    >
                                        <Text style={styles.buttonText}>Sí</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.cancelButton}
                                        onPress={() => {
                                            handleReordenSinComentario();
                                        }}
                                    >
                                        <Text style={styles.buttonText}>No</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>

                    <Modal
                        transparent={true}
                        animationType="slide"
                        visible={isComentarioModalVisible}
                        onRequestClose={() => setIsComentarioModalVisible(false)}
                    >
                        <View style={styles.modalBackground}>
                            <View style={styles.modalContainer}>
                                <Text style={styles.modalTitle}>Agregar Comentario</Text>
                                <TextInput
                                    style={styles.inputComentario}
                                    placeholder="Escribe un comentario"
                                    value={comentario}
                                    onChangeText={setComentario}
                                    multiline={true}
                                    numberOfLines={4}
                                />
                                <View style={styles.buttonsContainer}>
                                    <TouchableOpacity
                                        style={styles.confirmButton}
                                        onPress={handleConfirmarComentario}
                                    >
                                        <Text style={styles.buttonText}>Confirmar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.cancelButton}
                                        onPress={() => {
                                            setIsComentarioModalVisible(false);
                                            setIsQuantityModalVisible(true);
                                        }}
                                    >
                                        <Text style={styles.buttonText}>Cancelar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>

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
        paddingVertical: 10,
    },
    headerRow: {
        borderBottomWidth: 1,
        borderColor: '#363636',
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 5,
    },
    Screen: {
        fontSize: 14,
        color: 'black',
        marginBottom: 5,
        marginTop: 30,
        textAlign: 'center',
        backgroundColor: '#3498db'
    },
    cellText: {
        fontSize: 13,
        color: '#000',
    },
    fixedButtonContainer: {
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        alignItems: 'center',
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
        top: 5,
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
        marginTop: 15,
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
        marginBottom: 5
    },
    inputComentario: {
        width: 270,
        height: 100,
        borderColor: '#c4c4c4',
        backgroundColor: '#cfcfcf',
        borderWidth: 1,
        paddingLeft: 10,
        marginRight: 10,
        fontSize: 16,
        marginBottom: 5
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        textAlign: 'center',
    },
    tableContainer: {
        marginTop: 10,
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
        position: 'absolute',
        bottom: 20,
    },
    disabledButton: {
        backgroundColor: '#cccccc',
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
    }
});
export default ReordenScreen;
