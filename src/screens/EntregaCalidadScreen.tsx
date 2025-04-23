import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ImageBackground, TextInput, TouchableOpacity, FlatList, BackHandler, Alert, Modal } from 'react-native';
import axios from 'axios';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from './App';

type EntregaCalidadScreenRouteProp = RouteProp<RootStackParamList, 'EntregaCalidad'>;

interface Props {
    route: EntregaCalidadScreenRouteProp;
}

interface HotPart {
    Folio: string;
    ['Orden de Compra']: number;
    ['Numero de Parte']: string;
    ['Cantidad Faltante']: number;
}

const EntregaCalidadScreen: React.FC<Props> = ({ route }) => {
    const { nomina, nombre, area } = route?.params || {};

    const [hotParts, setHotParts] = useState<HotPart[]>([]);
    const [filteredHotParts, setFilteredHotParts] = useState<HotPart[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [codigoEntrega, setCodigoEntrega] = useState<string>('');
    const [selectedItems, setSelectedItems] = useState<HotPart[]>([]);
    const [searchText, setSearchText] = useState<string>('');
    const [quantitiesToDeliver, setQuantitiesToDeliver] = useState<Record<string, number>>({});
    const [currentItemIndex, setCurrentItemIndex] = useState(0);
    const [isQuantityModalVisible, setIsQuantityModalVisible] = useState(false);
    const [foliosCantidadUno, setFoliosCantidadUno] = useState<string[]>([]);
    const [isSearchActive, setIsSearchActive] = useState(false);


    useEffect(() => {
        const fetchHotParts = async () => {
            setLoading(true);
            try {
                const response = await axios.get('http://192.168.16.182:3000/api/calidad');
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
            if (prevSelectedItems.some((selectedItem) => selectedItem.Folio === item.Folio)) {
                return prevSelectedItems.filter((selectedItem) => selectedItem.Folio !== item.Folio);
            }
            return [...prevSelectedItems, item];
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
            const ordenesCompra = rowsWithQuantityOne.map((item) => item['Orden de Compra']);
            const numerosParte = rowsWithQuantityOne.map((item) => item['Numero de Parte']);

            try {
                const response = await axios.post('http://192.168.16.182:3000/api/cantidadEntrega', {
                    folios,
                    cantidades,
                    ordenesCompra,
                    numerosParte,
                    nomina,
                });

                if (response.data.success) {
                    console.log('Filas con cantidad 1 procesadas correctamente.');
                    setFoliosCantidadUno(folios);
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
        } else {
            setIsModalVisible(true);
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
            const response = await axios.post('http://192.168.16.182:3000/api/cantidadEntrega', {
                folios: [item.Folio],
                cantidades: [quantityToDeliver],
                nomina: nomina,
                ordenesCompra: [item['Orden de Compra']],
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
                setIsModalVisible(true);
            }
        } catch (error) {
            console.error('Error al enviar la cantidad:', error);
            Alert.alert('Error', 'Hubo un error al enviar la cantidad.');
        }
    };

    const handleVerificarCodigos = async () => {
        if (!codigoEntrega) {
            Alert.alert('Error', 'El código de recibo es incorrecto');
            return;
        }
        try {
            const foliosConCantidadMayorA1 = selectedItems.map(item => item.Folio);
            const foliosSeleccionados = [...foliosCantidadUno, ...foliosConCantidadMayorA1];
            setLoading(true);

            if (!foliosSeleccionados || foliosSeleccionados.length === 0) {
                Alert.alert('Error', 'No se encontró el folio');
                setLoading(false);
                return;
            }

            const verifyResponse = await axios.post('http://192.168.16.182:3000/api/verificarCodigos', {
                folios: foliosSeleccionados,
                codigoEntrega: codigoEntrega,
                nomina: nomina
            });

            if (verifyResponse.data.success) {
                const reciboResponse = await axios.post('http://192.168.16.182:3000/api/reciboEmbarques', {
                    folios: foliosSeleccionados,
                    nomina: nomina,
                });

                if (reciboResponse.data.success) {
                    const guardarMovimientoResponse = await axios.post('http://192.168.16.182:3000/api/guardarMovimiento', {
                        folios: foliosSeleccionados,
                        nomina: nomina,
                    });

                    if (guardarMovimientoResponse.data.success) {
                        console.log('Movimiento guardado correctamente');
                    } else {
                        console.error('Error al guardar el movimiento:', guardarMovimientoResponse.data.message);
                    }

                    Alert.alert('Éxito', 'Estatus actualizado a Embarques', [
                        {
                            text: 'OK',
                            onPress: async () => {
                                const updateResponse = await axios.get('http://192.168.16.182:3000/api/calidad');
                                setHotParts(updateResponse.data);
                                setFilteredHotParts(updateResponse.data);
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
            console.error('Axios Error:', error.response ? error.response.data : error.message);

            try {
                const eliminarResponse = await axios.post('http://192.168.16.182:3000/api/eliminarCodigos', {});

                if (eliminarResponse.data.success) {
                    console.log('Códigos eliminados correctamente');
                } else {
                    console.error('Error al eliminar los códigos:', eliminarResponse.data.message);
                }
            } catch (eliminarError) {
                console.error('Error al llamar a la API eliminarCodigos:', eliminarError.message);
            }

            Alert.alert('Error', 'Hubo un error al verificar los códigos: El código de entrega no coincide para las piezas seleccionadas');
        } finally {
            setLoading(false);
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
                style={[styles.tableRow, isSelected && styles.selectedRow]}
                onPress={() => toggleSelectItem(item)}
            >
                <Text>{String(item['Orden de Compra'])}</Text>
                <Text>{String(item['Numero de Parte'])}</Text>
                <Text>{String(item['Cantidad Faltante'])}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <ImageBackground source={require('./assets/fondo2.jpg')} style={styles.container}>
            <View style={styles.topContainer}>
                <Text style={styles.userText}>{nomina}    {nombre}     {area}</Text>
            </View>
            <Text style={styles.Screen}>Entregar a Embarques</Text>

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
                    <Text>Cargando HotParts...</Text>
                ) : filteredHotParts.length === 0 ? (
                    <Text style={styles.NoResult}>No hay resultados</Text>
                ) : (
                    <>
                        <View style={[styles.tableRow, styles.headerRow]}>
                            <Text style={styles.headerSecuencia}>Secuencia</Text>
                            <Text style={styles.headerParte}>N. Parte</Text>
                            <Text style={styles.headerQty}>Qty</Text>
                        </View>

                        <FlatList
                            data={filteredHotParts}
                            renderItem={renderItem}
                            keyExtractor={(item) => item.Folio.toString()}
                        />
                    </>
                )}
            </View>

            {selectedItems.length > 0 && (
                <TouchableOpacity
                    style={[styles.entregarButton, selectedItems.length === 0 && styles.disabledButton]}
                    onPress={handleRecibirHotPart}
                    disabled={selectedItems.length === 0}
                >
                    <Text style={styles.buttonText}>Entregar Hot Part</Text>
                </TouchableOpacity>
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
                                    El Hot Part: {selectedItems[currentItemIndex]['Numero de Parte']} contiene {selectedItems[currentItemIndex]['Cantidad Faltante']} piezas. ¿Cuántas se van a entregar?
                                </Text>
                                <TextInput
                                    style={styles.input}
                                    value={String(quantitiesToDeliver[selectedItems[currentItemIndex].Folio] || '')}
                                    onChangeText={handleQuantityChange}
                                    keyboardType="numeric"
                                    placeholder="Piezas a Recibir"
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
                animationType="slide"
                visible={isModalVisible}
                onRequestClose={() => setIsModalVisible(false)}
            >
                <View style={styles.modalBackground}>
                    <View style={styles.modalContainer}>
                        <Text style={styles.modalTitle}>Ingresa el código de Recibo</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ingresa el código"
                            value={codigoEntrega}
                            onChangeText={setCodigoEntrega}
                            keyboardType="default"
                        />
                        <View style={styles.buttonsContainer}>
                            <TouchableOpacity
                                style={styles.confirmButton}
                                onPress={handleVerificarCodigos}
                            >
                                <Text style={styles.buttonText}>Confirmar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setIsModalVisible(false)}
                            >
                                <Text style={styles.buttonText}>Cancelar</Text>
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
        flex: 0.999,
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
    cellText: {
        fontSize: 13,
        color: '#000',
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
        top: 20,
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
        marginTop: 35,
    },
    Screen: {
        fontSize: 14,
        color: 'black',
        marginBottom: 5,
        marginTop: 75,
        textAlign: 'center',
        backgroundColor: '#3498db'
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
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
    buttonText: {
        color: 'white',
        fontSize: 16,
        textAlign: 'center',
    },
    disabledButton: {
        backgroundColor: '#cccccc',
    },
    tableContainer: {
        marginTop: 20,
        width: '90%',
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
    },
});
export default EntregaCalidadScreen;
