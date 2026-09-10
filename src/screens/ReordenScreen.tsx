import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ImageBackground, TextInput, TouchableOpacity, FlatList, BackHandler, Alert, Modal, KeyboardAvoidingView, TouchableWithoutFeedback, ActivityIndicator, Keyboard, Platform } from 'react-native';
import axios from 'axios';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from './App';
import { useNavigation } from '@react-navigation/native';

// Servidor de la app de Reordenes (no hotparts-server): de ahi salen las
// listas de Defecto/Causa/Maquina, las mismas que usa Calidad en la web.
// Corre en esta misma PC de la base de datos (.146); en .146 solo hay una
// copia vieja/de prueba con otra base de datos (confirmado 2026-09-09).
const REORDENES_API_URL = 'http://192.168.16.224:4000';

type PickerField = 'defecto' | 'causa' | 'maquina' | 'area' | null;

type ReordenScreenRouteProp = RouteProp<RootStackParamList, 'ReordenScreen'>;

interface Props {
    route: ReordenScreenRouteProp;
}

interface HotPart {
    Folio: string;
    ['Secuencia']: number;
    ['Numero de Parte']: string;
    ['Cantidad Recibida de Produccion']?: number;
    ['Cantidad Faltante por Entregar']?: number;
}

const ReordenScreen: React.FC<Props> = ({ route }) => {
    const { nomina, nombre, area } = route?.params || {};
    const navigation = useNavigation();
    // Calidad reordena desde lo que tiene recibido de Produccion; Produccion
    // reordena desde lo que aun le falta entregar a Calidad.
    const endpointListado = area === 'Produccion' ? 'produccion' : 'calidad';
    const getCantidadDisponible = (item: HotPart): number =>
        Number(area === 'Produccion' ? item['Cantidad Faltante por Entregar'] : item['Cantidad Recibida de Produccion']);
    const [hotParts, setHotParts] = useState<HotPart[]>([]);
    const [filteredHotParts, setFilteredHotParts] = useState<HotPart[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedItems, setSelectedItems] = useState<HotPart[]>([]);
    const [searchText, setSearchText] = useState<string>('');
    const [quantitiesToDeliver, setQuantitiesToDeliver] = useState<Record<string, number>>({});
    const [currentItemIndex, setCurrentItemIndex] = useState(0);
    const [isQuantityModalVisible, setIsQuantityModalVisible] = useState(false);
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [isComentarioModalVisible, setIsComentarioModalVisible] = useState(false);
    const [comentario, setComentario] = useState('');
    const [showComentarioPrompt, setShowComentarioPrompt] = useState(false);
    const [mostrarAlertaSeleccionUnica, setMostrarAlertaSeleccionUnica] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Defecto/Causa/Maquina: Reordenes los pide como obligatorios en su
    // formulario de captura, asi que se piden aqui tambien y se mandan con
    // la solicitud para que Calidad no tenga que volver a buscarlos.
    const [isDefectoModalVisible, setIsDefectoModalVisible] = useState(false);
    const [defecto, setDefecto] = useState('');
    const [causa, setCausa] = useState('');
    const [maquina, setMaquina] = useState('');
    // Area de planta (formulario Nueva Reorden), distinta del "area" de arriba
    // (departamento de Hot Parts: Calidad/Produccion).
    const [areaDefecto, setAreaDefecto] = useState('');
    const [defectoOptions, setDefectoOptions] = useState<string[]>([]);
    const [causaOptions, setCausaOptions] = useState<string[]>([]);
    const [maquinaOptions, setMaquinaOptions] = useState<string[]>([]);
    const [areaDefectoOptions, setAreaDefectoOptions] = useState<string[]>([]);
    const [loadingCausas, setLoadingCausas] = useState(false);
    const [activePicker, setActivePicker] = useState<PickerField>(null);


    useEffect(() => {
        const fetchHotParts = async () => {
            setLoading(true);
            try {
                const response = await axios.get(`http://192.168.16.146:3002/api/hotparts/${endpointListado}`);
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
    }, [endpointListado]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setMostrarAlertaSeleccionUnica(true);
        }, 500);

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const fetchOpciones = async () => {
            try {
                const [defectosRes, maquinasRes, areasRes] = await Promise.all([
                    axios.get(`${REORDENES_API_URL}/api/defectos`),
                    axios.get(`${REORDENES_API_URL}/api/maquinas`),
                    axios.get(`${REORDENES_API_URL}/api/areas`),
                ]);
                setDefectoOptions(Array.isArray(defectosRes.data?.defectos) ? defectosRes.data.defectos : []);
                setMaquinaOptions(Array.isArray(maquinasRes.data?.maquinas) ? maquinasRes.data.maquinas : []);
                setAreaDefectoOptions(Array.isArray(areasRes.data?.areas) ? areasRes.data.areas : []);
            } catch (error) {
                console.error('Error al obtener defectos/maquinas/areas de Reordenes:', error);
            }
        };

        fetchOpciones();
    }, []);

    const handleDefectoChange = async (nuevoDefecto: string) => {
        setDefecto(nuevoDefecto);
        setCausa('');
        setCausaOptions([]);
        setActivePicker(null);

        if (!nuevoDefecto.trim()) return;

        setLoadingCausas(true);
        try {
            const response = await axios.get(`${REORDENES_API_URL}/api/causas`, {
                params: { defecto: nuevoDefecto },
            });
            setCausaOptions(Array.isArray(response.data?.causas) ? response.data.causas : []);
        } catch (error) {
            console.error('Error al obtener causas de Reordenes:', error);
        } finally {
            setLoadingCausas(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            const response = await axios.get(`http://192.168.16.146:3002/api/hotparts/${endpointListado}`);
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
                getCantidadDisponible(item) > 0 &&
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
        if (selectedItems.length === 0) {
            Alert.alert('Aviso', 'No se seleccionaron piezas para reordenar.');
            return;
        }

        const item = selectedItems[0];

        // Evita mandar una solicitud duplicada si ya hay una pendiente para
        // este folio (p. ej. otra persona lo reordeno casi al mismo tiempo,
        // antes de que se ocultara del listado a entregar).
        try {
            const existeResponse = await axios.get(`${REORDENES_API_URL}/api/hotparts-solicitudes/existe`, {
                params: { folio: item.Folio },
            });
            if (existeResponse.data?.existe) {
                Alert.alert('Aviso', 'Ya existe una solicitud de reorden pendiente para esta pieza.');
                return;
            }
        } catch (error) {
            console.error('Error al verificar solicitud de reorden existente:', error);
            // Mejor esfuerzo: si la verificacion falla (ej. sin red momentanea),
            // no se bloquea todo el flujo de reorden por eso.
        }

        const cantidadDisponible = getCantidadDisponible(item);

        if (cantidadDisponible === 1) {
            // Cantidad disponible es 1: se reordena directo, sin preguntar cuantas piezas.
            try {
                const response = await axios.post('http://192.168.16.146:3002/api/hotparts/cantidadReorden', {
                    folios: [item.Folio],
                    cantidades: [1],
                    ordenesCompra: [item['Secuencia']],
                    numerosParte: [item['Numero de Parte']],
                    nomina,
                });

                if (response.data.success) {
                    // Ya que se sabe la cantidad, se piden los detalles del
                    // defecto (Reordenes los pide como obligatorios).
                    setIsDefectoModalVisible(true);
                } else {
                    Alert.alert('Error', response.data.message);
                }
            } catch (error) {
                console.error('Error al procesar la pieza con cantidad 1:', error);
                Alert.alert('Error', 'Hubo un error al procesar la pieza.');
            }
            return;
        }

        // Cantidad disponible mayor a 1: preguntar cuantas piezas se van a reordenar.
        setCurrentItemIndex(0);
        setIsQuantityModalVisible(true);
    };

    const handleConfirmarDefecto = async () => {
        if (!defecto.trim() || !causa.trim() || !maquina.trim() || !areaDefecto.trim()) {
            Alert.alert('Aviso', 'Selecciona Defecto, Causa, Maquina y Area para continuar.');
            return;
        }

        try {
            const folios = selectedItems.map((item) => item.Folio);
            const response = await axios.post('http://192.168.16.146:3002/api/hotparts/detallesReorden', {
                folios,
                defecto,
                causa,
                maquina,
                areaDefecto,
            });

            if (response.data.success) {
                setIsDefectoModalVisible(false);
                setShowComentarioPrompt(true);
            } else {
                Alert.alert('Error', response.data.message);
            }
        } catch (error) {
            console.error('Error al guardar los detalles del defecto:', error);
            Alert.alert('Error', 'Hubo un error al guardar los detalles del defecto.');
        }
    };
    const handleQuantityConfirm = async () => {
        const item = selectedItems[currentItemIndex];
        const quantityToDeliver = quantitiesToDeliver[item.Folio];
        const maxCantidad = getCantidadDisponible(item);
        const hasValidMax = Number.isFinite(maxCantidad) && maxCantidad > 0;

        if (!quantityToDeliver || quantityToDeliver <= 0 || (hasValidMax && quantityToDeliver > maxCantidad)) {
            Alert.alert(
                'Error',
                `La cantidad ingresada para el Hot Part ${item['Numero de Parte']} debe ser mayor a 0${hasValidMax ? ` y menor o igual a ${maxCantidad}` : ''}.`
            );
            return;
        }

        try {
            const response = await axios.post('http://192.168.16.146:3002/api/hotparts/cantidadReorden', {
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
                // Ya que se sabe la cantidad, se piden los detalles del
                // defecto (Reordenes los pide como obligatorios).
                setIsQuantityModalVisible(false);
                setIsDefectoModalVisible(true);
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
            const numerosParteSeleccionados = selectedItems.map(item => item['Numero de Parte']);
            const cantidadesSeleccionadas = selectedItems.map(item => quantitiesToDeliver[item.Folio] ?? 1);

            const response = await axios.post('http://192.168.16.146:3002/api/hotparts/ComentariosReorden', {
                folios: foliosSeleccionados,
                comentario,
                nomina: nomina
            });

            if (response.data.success) {
                await axios.post('http://192.168.16.146:3002/api/hotparts/estatusReorden', {
                    folios: foliosSeleccionados,
                    nomina: nomina,
                    area
                });

                await axios.post('http://192.168.16.146:3002/api/hotparts/guardarMovimientoReorden', {
                    folios: foliosSeleccionados,
                    nomina: nomina,
                    area
                });

                await axios.post('http://192.168.16.146:3002/api/hotparts/reordenNotif', {
                    folios: foliosSeleccionados,
                    numerosParte: numerosParteSeleccionados,
                    secuencias: secuencias,
                    cantidades: cantidadesSeleccionadas,
                });

                Alert.alert('Éxito', 'Comentario registrado correctamente.', [
                    {
                        text: 'OK',
                        onPress: async () => {
                            const updateResponse = await axios.get(`http://192.168.16.146:3002/api/hotparts/${endpointListado}`);
                            setHotParts(updateResponse.data);
                            setFilteredHotParts(updateResponse.data);
                            setSelectedItems([]);
                            setComentario('');
                            setDefecto('');
                            setCausa('');
                            setMaquina('');
                            setAreaDefecto('');
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
        const numerosParte = selectedItems.map(item => item['Numero de Parte']);
        const cantidades = selectedItems.map(item => quantitiesToDeliver[item.Folio] ?? 1);

        if (folios.length === 0) {
            Alert.alert('Aviso', 'No hay piezas seleccionadas para registrar.');
            return;
        }

        try {
            const response = await axios.post('http://192.168.16.146:3002/api/hotparts/estatusReorden', {
                folios,
                nomina,
                area
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
                                    const guardarMovimientoResponse = await axios.post('http://192.168.16.146:3002/api/hotparts/guardarMovimientoReorden', {
                                        folios: folios,
                                        nomina: nomina,
                                        area
                                    });
                                    
                                    console.log('Movimiento guardado:', guardarMovimientoResponse.data);

                                    await axios.post('http://192.168.16.146:3002/api/hotparts/reordenNotif', {
                                        folios,
                                        numerosParte,
                                        secuencias,
                                        cantidades,
                                    });
                                    navigation.navigate('Menu');

                                } catch (error) {
                                    console.error('Error al guardar movimiento de reorden o enviar notificación:', error);
                                }

                                const updateResponse = await axios.get(`http://192.168.16.146:3002/api/hotparts/${endpointListado}`);
                                setHotParts(updateResponse.data);
                                setFilteredHotParts(updateResponse.data);
                                setSelectedItems([]);
                                setDefecto('');
                                setCausa('');
                                setMaquina('');
                                setAreaDefecto('');
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
                style={[styles.card, isSelected && styles.selectedCard]}
                onPress={() => toggleSelectItem(item)}
            >
                {/* Primera fila */}
                <View style={styles.cardRow}>
                    <Text style={styles.cardPart}>{item['Numero de Parte']}</Text>
                    <Text style={styles.cardQty}>{getCantidadDisponible(item)}</Text>
                </View>
    
                {/* Segunda fila */}
                <View style={styles.cardRow}>
                    <Text style={styles.cardSecuencia}>Secuencia: {item['Secuencia']}</Text>
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
                                        </View>
                                    ) : null
                                }
                                contentContainerStyle={{
                                    flexGrow: 1,
                                    justifyContent: filteredHotParts.length === 0 ? 'center' : 'flex-start',
                                    paddingBottom: 50, // espacio extra para no tapar el último item con el botón
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
                        visible={isDefectoModalVisible}
                        onRequestClose={() => setIsDefectoModalVisible(false)}
                    >
                        <View style={styles.modalBackground}>
                            <View style={styles.modalContainer}>
                                <Text style={styles.modalTitle}>Detalles del Defecto</Text>

                                <TouchableOpacity style={styles.pickerField} onPress={() => setActivePicker('defecto')}>
                                    <Text style={styles.pickerFieldLabel}>Defecto</Text>
                                    <Text style={styles.pickerFieldValue}>{defecto || 'Selecciona un defecto'}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.pickerField, !defecto && styles.pickerFieldDisabled]}
                                    onPress={() => defecto && setActivePicker('causa')}
                                    disabled={!defecto}
                                >
                                    <Text style={styles.pickerFieldLabel}>Causa</Text>
                                    <Text style={styles.pickerFieldValue}>
                                        {!defecto
                                            ? 'Selecciona primero un defecto'
                                            : loadingCausas
                                                ? 'Cargando causas...'
                                                : (causa || 'Selecciona una causa')}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.pickerField} onPress={() => setActivePicker('maquina')}>
                                    <Text style={styles.pickerFieldLabel}>Maquina</Text>
                                    <Text style={styles.pickerFieldValue}>{maquina || 'Selecciona una maquina'}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.pickerField} onPress={() => setActivePicker('area')}>
                                    <Text style={styles.pickerFieldLabel}>Area</Text>
                                    <Text style={styles.pickerFieldValue}>{areaDefecto || 'Selecciona un area'}</Text>
                                </TouchableOpacity>

                                <View style={styles.buttonsContainer}>
                                    <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmarDefecto}>
                                        <Text style={styles.buttonText}>Continuar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.cancelButton}
                                        onPress={() => setIsDefectoModalVisible(false)}
                                    >
                                        <Text style={styles.buttonText}>Cancelar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>

                    <Modal
                        transparent={true}
                        animationType="fade"
                        visible={activePicker !== null}
                        onRequestClose={() => setActivePicker(null)}
                    >
                        <View style={styles.modalBackground}>
                            <View style={styles.modalContainer}>
                                <Text style={styles.modalTitle}>
                                    {activePicker === 'defecto' ? 'Selecciona un Defecto' : activePicker === 'causa' ? 'Selecciona una Causa' : activePicker === 'maquina' ? 'Selecciona una Maquina' : 'Selecciona un Area'}
                                </Text>
                                <FlatList
                                    style={styles.pickerList}
                                    data={activePicker === 'defecto' ? defectoOptions : activePicker === 'causa' ? causaOptions : activePicker === 'maquina' ? maquinaOptions : areaDefectoOptions}
                                    keyExtractor={(opcion) => opcion}
                                    ListEmptyComponent={<Text style={styles.NoResult}>Sin opciones disponibles</Text>}
                                    renderItem={({ item: opcion }) => (
                                        <TouchableOpacity
                                            style={styles.pickerOption}
                                            onPress={() => {
                                                if (activePicker === 'defecto') {
                                                    handleDefectoChange(opcion);
                                                } else if (activePicker === 'causa') {
                                                    setCausa(opcion);
                                                    setActivePicker(null);
                                                } else if (activePicker === 'maquina') {
                                                    setMaquina(opcion);
                                                    setActivePicker(null);
                                                } else if (activePicker === 'area') {
                                                    setAreaDefecto(opcion);
                                                    setActivePicker(null);
                                                }
                                            }}
                                        >
                                            <Text style={styles.pickerOptionText}>{opcion}</Text>
                                        </TouchableOpacity>
                                    )}
                                />
                                <TouchableOpacity style={styles.cancelButton} onPress={() => setActivePicker(null)}>
                                    <Text style={styles.buttonText}>Cerrar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>

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
                                            {(() => {
                                                const activeItem = selectedItems[currentItemIndex];
                                                const maxCantidad = getCantidadDisponible(activeItem);
                                                const hasValidMax = Number.isFinite(maxCantidad) && maxCantidad > 0;
                                                return hasValidMax
                                                    ? `El Hot Part: ${activeItem['Numero de Parte']} contiene ${maxCantidad} piezas. ¿Cuántas se van a Reordenar?`
                                                    : `¿Cuántas piezas del Hot Part ${activeItem['Numero de Parte']} se van a Reordenar?`;
                                            })()}
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
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
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
    cardSecuencia: {
        fontSize: 12,
        color: '#555',
    },
    pickerField: {
        width: '100%',
        borderWidth: 1,
        borderColor: '#c4c4c4',
        backgroundColor: '#f7f7f7',
        borderRadius: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 10,
    },
    pickerFieldDisabled: {
        opacity: 0.5,
    },
    pickerFieldLabel: {
        fontSize: 12,
        color: '#666',
        fontWeight: 'bold',
    },
    pickerFieldValue: {
        fontSize: 15,
        color: '#000',
        marginTop: 2,
    },
    pickerList: {
        width: '100%',
        maxHeight: 300,
    },
    pickerOption: {
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        width: '100%',
    },
    pickerOptionText: {
        fontSize: 15,
        color: '#000',
    },
});
export default ReordenScreen;
