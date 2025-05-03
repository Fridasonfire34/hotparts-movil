import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ImageBackground, TextInput, TouchableOpacity, FlatList, BackHandler, Alert, Modal } from 'react-native';
import axios from 'axios';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from './App';

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
    const { nomina, nombre, area } = route?.params || {};
    const [hotParts, setHotParts] = useState<HotPart[]>([]);
    const [filteredHotParts, setFilteredHotParts] = useState<HotPart[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [codigoEntrega, setCodigoEntrega] = useState<string>('');
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedItems, setSelectedItems] = useState<HotPart[]>([]);
    const [searchText, setSearchText] = useState<string>('');
    const [isSearchActive, setIsSearchActive] = useState(false);

    useEffect(() => {
        const fetchHotParts = async () => {
            setLoading(true);
            try {
                const response = await axios.get('http://192.168.16.146:3002/api/Programacion');
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

                const response = await axios.post('http://192.168.16.146:3002/api/cantidadRecibo', {
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
            const response = await axios.post('http://192.168.16.146:3002/api/generarCodigo', { folios: foliosSeleccionados, nomina });
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
            const response = await axios.get('http://192.168.16.146:3002/api/Programacion');
        } catch (error) {
            console.error('Error al obtener datos de calidad:', error);
            Alert.alert('Error', 'No se pudieron actualizar los datos de calidad.');
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
            <Text style={styles.Screen}>Recibir Hot Parts</Text>
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
                    <Text style={styles.buttonText}>Recibir Hot Part</Text>
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
                        <Text style={styles.modalTitle}>Recibo de Hot Part</Text>
                        <Text style={styles.codigoText}>
                            El código de recibo es:
                            <Text style={styles.boldText}> {codigoEntrega}</Text>
                            . Por favor comparte este código a la persona que esta realizando la entrega.
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
        marginRight: 5,
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
    text: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    Screen: {
        fontSize: 14,
        color: 'black',
        marginBottom: 5,
        marginTop: 30,
        textAlign: 'center',
        backgroundColor: '#3498db'
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
        marginTop: 10,
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
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    codigoText: {
        fontSize: 16,
        marginBottom: 20,
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
    boldText: {
        fontWeight: 'bold',
        fontSize: 16,
    },
    disabledButton: {
        backgroundColor: '#cccccc',
    },
});

export default ReciboProduccionScreen;
