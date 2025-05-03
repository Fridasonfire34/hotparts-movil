import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ImageBackground, TextInput, TouchableOpacity, FlatList, BackHandler, Alert, Modal } from 'react-native';
import axios from 'axios';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from './App';

type EntregaProgramacionScreenRouteProp = RouteProp<RootStackParamList, 'EntregaProgramacion'>;

interface Props {
    route: EntregaProgramacionScreenRouteProp;
}

interface HotPart {
    Folio: string;
    ['Secuencia']: number;
    ['Numero de Parte']: string;
    ['Cantidad']: number;
}

const EntregaProgramacionScreen: React.FC<Props> = ({ route }) => {
    const { nomina, nombre, area } = route?.params || {};

    const [hotParts, setHotParts] = useState<HotPart[]>([]);
    const [filteredHotParts, setFilteredHotParts] = useState<HotPart[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [codigoEntrega, setCodigoEntrega] = useState<string>('');
    const [selectedItems, setSelectedItems] = useState<HotPart[]>([]);
    const [searchText, setSearchText] = useState<string>('');
    const [isSearchActive, setIsSearchActive] = useState(false);

    useEffect(() => {
        const fetchHotParts = async () => {
            setLoading(true);
            try {
                const response = await axios.get('http://192.168.16.182:3000/api/Programacion');
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
                item['Cantidad'] > 0 &&
                item['Numero de Parte'].toLowerCase().includes(trimmedText)
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

                const response = await axios.post('http://192.168.16.182:3000/api/cantidadTodo', {
                    folios: folios,
                    cantidades: cantidades,
                    ordenesCompra: ordenesCompra,
                    numerosParte: numerosParte,
                    nomina: nomina
                });

                if (response.data.success) {
                    setIsModalVisible(true);
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

            const verifyResponse = await axios.post('http://192.168.16.182:3000/api/verificarCodigos', {
                folios: folios,
                codigoEntrega: codigoEntrega,
                nomina: nomina
            });

            if (verifyResponse.data.success) {
                const reciboResponse = await axios.post('http://192.168.16.182:3000/api/reciboProduccion', {
                    folios: folios,
                    nomina: nomina,
                });

                if (reciboResponse.data.success) {
                    try {
                        const guardarMovimientoResponse = await axios.post('http://192.168.16.182:3000/api/guardarMovimiento', {
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

                    Alert.alert('Éxito', 'Estatus actualizado a Produccion', [
                        {
                            text: 'OK',
                            onPress: async () => {
                                try {
                                    const updateResponse = await axios.get('http://192.168.16.182:3000/api/Programacion');
                                    setHotParts(updateResponse.data);
                                    setFilteredHotParts(updateResponse.data);

                                    const entregaResponse = await axios.get('http://192.168.16.182:3000/api/entregaProgramacion');
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

    const renderItem = ({ item }: { item: HotPart }) => {
        const isSelected = selectedItems.some((selectedItem) => selectedItem.Folio === item.Folio);

        return (
            <TouchableOpacity
                style={[styles.tableRow, isSelected && styles.selectedRow]}
                onPress={() => toggleSelectItem(item)}
            >
                <Text>{String(item['Secuencia'])}</Text>
                <Text>{String(item['Numero de Parte'])}</Text>
                <Text>{String(item['Cantidad'])}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <ImageBackground source={require('./assets/fondo2.jpg')} style={styles.container}>
            <View style={styles.topContainer}>
                <Text style={styles.userText}>{nomina}    {nombre}     {area}</Text>
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
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 75,
        marginBottom: 1
    },
    input: {
        width: 250,
        height: 45,
        borderColor: '#c4c4c4',
        backgroundColor: '#cfcfcf',
        borderWidth: 1,
        paddingLeft: 10,
        marginRight: 10,
        fontSize: 16,
        color: 'black'
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
    }
});
export default EntregaProgramacionScreen;
