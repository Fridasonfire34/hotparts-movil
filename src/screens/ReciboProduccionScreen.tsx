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
    ['Orden de Compra']: number;
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
                const response = await axios.get('http://10.0.2.2:3000/api/Programacion');
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
            const response = await axios.post('http://10.0.2.2:3000/api/generarCodigo', { folios: foliosSeleccionados, nomina });
            const { codigoEntrega } = response.data;
            setCodigoEntrega(codigoEntrega);
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
                    placeholder="Buscar Pieza"
                />
            </View>

            <View style={styles.tableContainer}>
                {loading ? (
                    <Text>Cargando HotParts...</Text>
                ) : filteredHotParts.length === 0 ? (
                    <Text style={styles.NoResult}>No hay resultados</Text>
                ) : (
                    <FlatList
                        data={filteredHotParts}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.Folio.toString()}
                    />
                )}
            </View>

            {selectedItems.length > 0 && (
                <TouchableOpacity
                    style={[styles.entregarButton, selectedItems.length === 0 && styles.disabledButton]}
                    onPress={generarCodigoRecibo}
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
    },
    topContainer: {
        position: 'absolute',
        top: 20,
        left: 20,
        right: 20,
        alignItems: 'flex-start',
    },
    text: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    selectedRow: {
        backgroundColor: '#cce7ff'
    },
    disabledButton: {
        backgroundColor: '#cccccc',
    },
    userText: {
        fontSize: 14,
        color: 'black',
        marginBottom: 10,
        marginTop: 40,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 100,
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
    },
    boldText: {
        fontWeight: 'bold',
        fontSize: 16,
    },
});

export default ReciboProduccionScreen;
