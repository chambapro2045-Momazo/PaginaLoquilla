// script.js (Versión 6.2 - Corregidos los 3 bugs de vistas)

// --- Variable global para traducciones ---
let i18n = {}; 

// --- Variables de Estado Globales ---
let currentFileId = null; 
let activeFilters = []; 
let currentData = [];
let tableData = [];
let todasLasColumnas = [];
let columnasVisibles = [];
let sortState = { column: null, direction: 'asc' };
let currentView = 'detailed'; // 'detailed' o 'grouped'

const COLUMNAS_AGRUPABLES = [
    "Vendor Name", "Status", "Assignee", 
    "Operating Unit Name", "Pay Status", "Document Type", "_row_status"
];

// --- Función de inicialización ---
document.addEventListener('DOMContentLoaded', (event) => {
    loadTranslations();
    try {
        setupEventListeners();
    } catch (e) {
        console.error("Error fatal al configurar los listeners:", e);
    }
}); 

// ---
// SECCIÓN 1: MANEJO DE COLUMNAS
// ---

function renderColumnSelector() {
    const wrapper = document.getElementById('column-selector-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = ''; 

    if (todasLasColumnas.length === 0) { 
        wrapper.innerHTML = `<p>${i18n['info_upload'] || 'Upload file'}</p>`; 
        return; 
    }

    todasLasColumnas.forEach(columnName => {
        const isChecked = columnasVisibles.includes(columnName);
        const itemHTML = `
            <div class="column-selector-item">
                <label>
                    <input type="checkbox" value="${columnName}" ${isChecked ? 'checked' : ''}>
                    ${(columnName === '_row_status') ? "Row Status" : columnName}
                </label>
            </div>`;
        wrapper.innerHTML += itemHTML;
    });
}

function updateVisibleColumnsFromCheckboxes() {
    const checkboxes = document.querySelectorAll('#column-selector-wrapper input[type="checkbox"]');
    columnasVisibles = [];
    checkboxes.forEach(cb => {
        if (cb.checked) {
            columnasVisibles.push(cb.value);
        }
    });
    renderTable();
}

function handleColumnVisibilityChange(event) {
    if (event.target.type !== 'checkbox') return;
    updateVisibleColumnsFromCheckboxes();
}

function handleCheckAllColumns() {
    const checkboxes = document.querySelectorAll('#column-selector-wrapper input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
    updateVisibleColumnsFromCheckboxes();
}

function handleUncheckAllColumns() {
    const checkboxes = document.querySelectorAll('#column-selector-wrapper input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    updateVisibleColumnsFromCheckboxes();
}

// ---
// SECCIÓN 2: CONFIGURACIÓN INICIAL Y LISTENERS (¡CORREGIDO!)
// ---

async function loadTranslations() {
    try {
        const response = await fetch('/api/get_translations');
        if (!response.ok) throw new Error('Network response was not ok');
        i18n = await response.json();
    } catch (error) { 
        console.error('Error cargando traducciones:', error); 
        i18n = { /* Fallbacks */ }; 
    }
    updateDynamicText();
}

function setupEventListeners() {
    // --- Referencias a Elementos ---
    const fileUploader = document.getElementById('file-uploader');
    const dragDropArea = document.querySelector('.drag-drop-label');
    const btnAdd = document.getElementById('btn-add-filter');
    const btnLangEs = document.getElementById('btn-lang-es');
    const btnLangEn = document.getElementById('btn-lang-en');
    const columnSelectorWrapper = document.getElementById('column-selector-wrapper');
    const btnCheckAllCols = document.getElementById('btn-check-all-cols');
    const btnUncheckAllCols = document.getElementById('btn-uncheck-all-cols');

    const addSafeListener = (element, event, handler) => {
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Elemento no encontrado. No se pudo adjuntar el evento: ${event}`);
        }
    };

    // --- Listeners Generales ---
    addSafeListener(fileUploader, 'change', handleFileUpload);
    addSafeListener(btnAdd, 'click', handleAddFilter);
    addSafeListener(btnLangEs, 'click', () => setLanguage('es'));
    addSafeListener(btnLangEn, 'click', () => setLanguage('en'));
    addSafeListener(columnSelectorWrapper, 'change', handleColumnVisibilityChange);
    addSafeListener(btnCheckAllCols, 'click', handleCheckAllColumns);
    addSafeListener(btnUncheckAllCols, 'click', handleUncheckAllColumns);

    // --- Listeners para Vista Detallada ---
    addSafeListener(document.getElementById('btn-clear-filters'), 'click', handleClearFilters);
    addSafeListener(document.getElementById('btn-fullscreen'), 'click', handleFullscreen);
    addSafeListener(document.getElementById('btn-download-excel'), 'click', handleDownloadExcel);
    addSafeListener(document.getElementById('input-search-table'), 'keyup', handleSearchTable);
    addSafeListener(document.getElementById('active-filters-list'), 'click', handleRemoveFilter);
    addSafeListener(document.getElementById('results-table'), 'click', handleSort);
    
    // --- Listeners para V6.0 (Vista Agrupada) ---
    addSafeListener(document.getElementById('btn-view-detailed'), 'click', () => toggleView('detailed'));
    addSafeListener(document.getElementById('btn-view-grouped'), 'click', () => toggleView('grouped'));
    addSafeListener(document.getElementById('select-columna-agrupar'), 'change', handleGroupColumnChange);
    
    // --- (ARREGLO 3) Listeners para los botones duplicados ---
    addSafeListener(document.getElementById('btn-clear-filters-grouped'), 'click', handleClearFilters);
    addSafeListener(document.getElementById('btn-fullscreen-grouped'), 'click', handleFullscreen);
    addSafeListener(document.getElementById('btn-download-excel-grouped'), 'click', handleDownloadExcelGrouped); // Nueva función
    addSafeListener(document.getElementById('active-filters-list-grouped'), 'click', handleRemoveFilter);

    // --- Listeners para Drag and Drop ---
    if (dragDropArea) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dragDropArea.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
        });
        ['dragenter', 'dragover'].forEach(eventName => {
            dragDropArea.addEventListener(eventName, () => dragDropArea.classList.add('dragging'), false);
        });
        ['dragleave', 'drop'].forEach(eventName => {
            dragDropArea.addEventListener(eventName, () => dragDropArea.classList.remove('dragging'), false);
        });
        dragDropArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0 && fileUploader) {
                fileUploader.files = files;
                const changeEvent = new Event('change', { 'bubbles': true });
                fileUploader.dispatchEvent(changeEvent);
            }
        }, false);
    } else {
        console.warn("Elemento 'dragDropArea' no encontrado.");
    }
}

function updateDynamicText() {
    const valInput = document.getElementById('input-valor');
    const searchTableInput = document.getElementById('input-search-table');
    const resultsTableDiv = document.getElementById('results-table');

    if (valInput) valInput.placeholder = i18n['search_text'] || "Texto a buscar...";
    if (searchTableInput) searchTableInput.placeholder = (i18n['search_text'] || "Buscar...") + "...";
    
    if (resultsTableDiv && !currentFileId) {
        resultsTableDiv.innerHTML = `<p>${i18n['info_upload'] || 'Upload file'}</p>`;
    }
}

async function setLanguage(langCode) {
    try { 
        await fetch(`/api/set_language/${langCode}`); 
        location.reload();
    }
    catch (error) { console.error('Error al cambiar idioma:', error); }
}

// ---
// SECCIÓN 3: MANEJO DE EVENTOS PRINCIPALES
// ---

async function handleFileUpload(event) {
    const file = event.target.files[0]; if (!file) return;
    const fileUploadList = document.getElementById('file-upload-list');
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    fileUploadList.innerHTML = `
        <div class="file-list-item">
            <svg class="file-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd" /></svg>
            <div class="file-details">
                <span class="file-name">${file.name}</span>
                <span class="file-size">${fileSizeMB}MB</span>
            </div>
        </div>
    `;     

    const formData = new FormData(); formData.append('file', file);
    try {
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        const result = await response.json(); if (!response.ok) throw new Error(result.error);

        currentFileId = result.file_id;
        todasLasColumnas = result.columnas; 
        columnasVisibles = [...todasLasColumnas];

        const colSelect = document.getElementById('select-columna');
        colSelect.innerHTML = `<option value="">${i18n['column_select'] || 'Select col...'}</option>`;
        todasLasColumnas.forEach(col => {
            const option = document.createElement('option'); 
            option.value = col; 
            option.textContent = (col === '_row_status') ? "Row Status" : col;
            colSelect.appendChild(option);
        });

        renderColumnSelector(); 
        resetResumenCard(); 
        
        activeFilters = []; 
        document.getElementById('input-search-table').value = ''; 
        sortState = { column: null, direction: 'asc' };

        // Asegura que la vista detallada sea la activa al cargar
        toggleView('detailed', true); // true = forzar reseteo

    } catch (error) { 
        console.error('Error en fetch /api/upload:', error); 
        todasLasColumnas = []; 
        columnasVisibles = []; 
        fileUploadList.innerHTML = `<p style="color: red;">Error al cargar el archivo.</p>`;
        renderColumnSelector();
        resetResumenCard(); 
    }
}

async function handleAddFilter() {
    const colSelect = document.getElementById('select-columna');
    const valInput = document.getElementById('input-valor');
    const col = colSelect.value; 
    const val = valInput.value;
    
    if (col && val) { 
        activeFilters.push({ columna: col, valor: val }); 
        valInput.value = ''; 
        if (currentView === 'detailed') {
            document.getElementById('input-search-table').value = ''; 
        }
        await refreshActiveView();
    }
    else { alert(i18n['warning_no_filter'] || 'Select col and value'); }
}

async function handleClearFilters() { 
    activeFilters = []; 
    if (currentView === 'detailed') {
        document.getElementById('input-search-table').value = ''; 
    }
    await refreshActiveView(); 
}

async function handleRemoveFilter(event) {
    if (!event.target.classList.contains('remove-filter-btn')) return;
    const indexToRemove = parseInt(event.target.dataset.index, 10);
    activeFilters.splice(indexToRemove, 1);
    await refreshActiveView(); 
}

// (ARREGLO 3) Fullscreen actualizado
function handleFullscreen(event) {
    const viewContainerId = (currentView === 'detailed') 
        ? 'view-container-detailed' 
        : 'view-container-grouped';
    
    const viewContainer = document.getElementById(viewContainerId);

    // Si ya estamos en fullscreen, salimos
    if (document.body.classList.contains('fullscreen-mode')) {
        document.body.classList.remove('fullscreen-mode');
        if (viewContainer) viewContainer.classList.remove('in-fullscreen');
        
        // Restaura el icono de CUALQUIER botón de fullscreen
        document.querySelectorAll('.icon-button[title="Pantalla Completa"]').forEach(btn => {
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>`;
        });

    } else {
        // Entramos en fullscreen
        document.body.classList.add('fullscreen-mode');
        if (viewContainer) viewContainer.classList.add('in-fullscreen');

        // Cambia el icono solo del botón que se presionó
        const icon = event.currentTarget.querySelector('svg');
        if (icon) {
            icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9V4.5M15 9h4.5M15 9l5.25-5.25M15 15v4.5M15 15h4.5M15 15l5.25 5.25" />`;
        }
    }
}

function handleSearchTable() {
    const searchTableInput = document.getElementById('input-search-table');
    const searchTerm = searchTableInput.value.toLowerCase();
    
    if (!searchTerm) { 
        tableData = [...currentData];
    }
    else { 
        tableData = currentData.filter(row => 
            columnasVisibles.some(col => 
                String(row[col]).toLowerCase().includes(searchTerm)
            )
        ); 
    }
    applySort();
    if (currentView === 'detailed') {
        renderTable();
    }
}

async function handleDownloadExcel() {
    if (currentData.length === 0 || !currentFileId) { 
        alert(i18n['no_data_to_download'] || "No hay datos para descargar."); 
        return; 
    }
    try {
        const response = await fetch('/api/download_excel', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                file_id: currentFileId, 
                filtros_activos: activeFilters, 
                columnas_visibles: columnasVisibles
            })
        });
        if (!response.ok) throw new Error('Error del servidor al generar Excel.');
        
        const blob = await response.blob(); 
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); 
        a.href = url; 
        a.download = 'datos_filtrados_detallado.xlsx';
        document.body.appendChild(a); 
        a.click(); 
        document.body.removeChild(a); 
        URL.revokeObjectURL(url);
        
    } catch (error) { 
        console.error('Error en fetch /api/download_excel:', error); 
        alert('Error al descargar el archivo: ' + error.message); 
    }
}

// (ARREGLO 3) Nueva función de descarga
async function handleDownloadExcelGrouped() {
    const select = document.getElementById('select-columna-agrupar');
    const colAgrupar = select ? select.value : null;

    if (!currentFileId || !colAgrupar) {
        alert("Por favor seleccione una columna para agrupar antes de descargar.");
        return;
    }
    
    // ¡¡¡IMPORTANTE!!!
    // Esta función asume que crearás una API '/api/download_excel_grouped' en tu app.py
    // Te daré el código de esa API después de esto.
    
    try {
        const response = await fetch('/api/download_excel_grouped', { // <-- Nueva API
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                file_id: currentFileId, 
                filtros_activos: activeFilters, 
                columna_agrupar: colAgrupar
            })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Error del servidor al generar Excel.');
        }
        
        const blob = await response.blob(); 
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); 
        a.href = url; 
        a.download = `datos_agrupados_por_${colAgrupar}.xlsx`;
        document.body.appendChild(a); 
        a.click(); 
        document.body.removeChild(a); 
        URL.revokeObjectURL(url);
        
    } catch (error) { 
        console.error('Error en fetch /api/download_excel_grouped:', error); 
        alert('Error al descargar el archivo: ' + error.message); 
    }
}

function handleSort(event) {
    const headerCell = event.target.closest('th');
    if (!headerCell || headerCell.classList.contains('cell-row-number')) return;
    
    const columnToSort = headerCell.dataset.column; 
    if (!columnToSort) return;
    
    if (sortState.column === columnToSort) { 
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc'; 
    }
    else { 
        sortState.column = columnToSort; 
        sortState.direction = 'asc'; 
    }
    applySort(); 
    renderTable();
}

// ---
// SECCIÓN 4: LÓGICA DE DATOS Y RENDERIZADO
// ---

function resetResumenCard() {
    const totalFacturas = document.getElementById('resumen-total-facturas');
    const montoTotal = document.getElementById('resumen-monto-total');
    const montoPromedio = document.getElementById('resumen-monto-promedio');

    if (totalFacturas) totalFacturas.textContent = '0';
    if (montoTotal) montoTotal.textContent = '$0.00';
    if (montoPromedio) montoPromedio.textContent = '$0.00';
}

function applySort() {
    if (!sortState.column) return;
    const column = sortState.column; 
    const direction = sortState.direction === 'asc' ? 1 : -1;
    tableData.sort((a, b) => {
        const valA = a[column]; 
        const valB = b[column];
        const numA = parseFloat(valA); 
        const numB = parseFloat(valB);
        if (!isNaN(numA) && !isNaN(numB)) { 
            return (numA - numB) * direction; 
        } else { 
            const strA = String(valA).toLowerCase(); 
            const strB = String(valB).toLowerCase(); 
            if (strA < strB) return -1 * direction; 
            if (strA > strB) return 1 * direction; 
            return 0; 
        }
    });
}

// (ARREGLO 3) renderFilters actualizado
function renderFilters() {
    const listId = (currentView === 'detailed') ? 'active-filters-list' : 'active-filters-list-grouped';
    const clearBtnId = (currentView === 'detailed') ? 'btn-clear-filters' : 'btn-clear-filters-grouped';
    
    const filtersListDiv = document.getElementById(listId);
    const btnClear = document.getElementById(clearBtnId);
    
    // Limpia ambos contenedores para evitar duplicados al cambiar de vista
    document.getElementById('active-filters-list').innerHTML = '';
    document.getElementById('active-filters-list-grouped').innerHTML = '';
    document.getElementById('btn-clear-filters').style.display = 'none';
    document.getElementById('btn-clear-filters-grouped').style.display = 'none';
    
    if (!filtersListDiv || !btnClear) return;

    if (activeFilters.length === 0) { 
        btnClear.style.display = 'none';
        return; 
    }

    btnClear.style.display = 'inline-block';
    
    activeFilters.forEach((filtro, index) => {
        const filterItemHTML = `
            <div class="filtro-chip">
                <span>${filtro.columna}: <strong>${filtro.valor}</strong></span>
                <button class="remove-filter-btn" data-index="${index}">&times;</button>
            </div>
        `;
        filtersListDiv.innerHTML += filterItemHTML;
    });
}

function renderTable(data = null, forceClear = false) {
    const resultsTableDiv = document.getElementById('results-table');
    if (!resultsTableDiv) return;

    if (forceClear) {
        resultsTableDiv.innerHTML = '';
        return;
    }
    
    const dataToRender = data || tableData;
    resultsTableDiv.innerHTML = ''; 
    
    if (!currentFileId) { 
        resultsTableDiv.innerHTML = `<p>${i18n['info_upload'] || 'Upload file'}</p>`; 
        return; 
    }
    
    if (dataToRender.length === 0) { 
        if (activeFilters.length > 0 || document.getElementById('input-search-table').value) {
            resultsTableDiv.innerHTML = `<p>${(i18n['no_filters_applied'] || 'No results').replace('.', ' for these filters.')}</p>`;
        } else {
             resultsTableDiv.innerHTML = `<p>File loaded. No data found.</p>`;
        }
        return; 
    }

    const table = document.createElement('table');
    const thead = table.createTHead(); 
    const headerRow = thead.insertRow();
    
    const thNum = document.createElement('th');
    thNum.className = 'cell-row-number';
    thNum.textContent = '#';
    headerRow.appendChild(thNum);
    
    columnasVisibles.forEach(colName => {
        const th = document.createElement('th');
        th.dataset.column = colName;
        th.innerHTML = `
            ${(colName === '_row_status') ? "Row Status" : colName}
            <span class="sort-icon asc">▲</span>
            <span class="sort-icon desc">▼</span>
        `;
        if (sortState.column === colName) {
            th.classList.add(sortState.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
        }
        headerRow.appendChild(th);
    });

    const tbody = table.createTBody();
    dataToRender.forEach((fila, index) => {
        const row = tbody.insertRow();
        const tdNum = row.insertCell();
        tdNum.className = 'cell-row-number';
        tdNum.textContent = index + 1;
        
        columnasVisibles.forEach(colName => {
            const cell = row.insertCell(); 
            cell.textContent = fila.hasOwnProperty(colName) ? fila[colName] : ''; 
        });
    });
    
    resultsTableDiv.appendChild(table);
}

// ---
// SECCIÓN 5: LÓGICA DE VISTAS (V6.0)
// ---

async function refreshActiveView() {
    if (currentView === 'detailed') {
        renderGroupedTable(null, null, true); // true = forzar limpieza
        await getFilteredData();
    } 
    else if (currentView === 'grouped') {
        renderTable(null, true); // true = forzar limpieza
        await getGroupedData();
    }
}

async function getFilteredData() {
    const resultsHeader = document.getElementById('results-header');
    if (!currentFileId) { 
        currentData = []; 
        tableData = []; 
        renderFilters(); 
        renderTable();
        resetResumenCard(); 
        if (resultsHeader) resultsHeader.textContent = i18n['results_header']?.split('(')[0] || 'Results'; 
        return; 
    }
    try {
        const response = await fetch('/api/filter', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id: currentFileId, filtros_activos: activeFilters })
        });
        const result = await response.json(); 
        if (!response.ok) throw new Error(result.error);

        currentData = result.data;
        tableData = [...currentData];

        if (result.resumen) {
            const totalFacturas = document.getElementById('resumen-total-facturas');
            const montoTotal = document.getElementById('resumen-monto-total');
            const montoPromedio = document.getElementById('resumen-monto-promedio');
            if (totalFacturas) totalFacturas.textContent = result.resumen.total_facturas;
            if (montoTotal) montoTotal.textContent = result.resumen.monto_total;
            if (montoPromedio) montoPromedio.textContent = result.resumen.monto_promedio;
        }

        applySort();
        renderFilters(); 
        renderTable();   

        if (resultsHeader) resultsHeader.textContent = i18n['results_header']?.replace('{num_filas}', result.num_filas) || `Results (${result.num_filas})`;

    } catch (error) { 
        console.error('Error en fetch /api/filter:', error); 
        alert('Error al filtrar: ' + error.message);
        resetResumenCard(); 
    }
}


/**
 * LÓGICA DE VISTA 2: Pedir datos agrupados (del API)
 * ¡ARREGLO 1 (BUG FILTROS)!
 */
async function getGroupedData() {
    const select = document.getElementById('select-columna-agrupar');
    const colAgrupar = select ? select.value : null;

    if (!currentFileId || !colAgrupar) {
        renderGroupedTable(null, null, true); 
        return;
    }

    try {
        const resultsDiv = document.getElementById('results-table-grouped');
        resultsDiv.innerHTML = `<p>Agrupando datos...</p>`;

        const response = await fetch('/api/group_by', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                file_id: currentFileId, 
                filtros_activos: activeFilters,
                columna_agrupar: colAgrupar
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        
        renderGroupedTable(result.data, colAgrupar, false);
        
        // --- ¡ARREGLO 1! Vuelve a dibujar los chips de filtros ---
        renderFilters(); 
        // ----------------------------------------------------

    } catch (error) {
        console.error('Error en fetch /api/group_by:', error);
        const resultsDiv = document.getElementById('results-table-grouped');
        resultsDiv.innerHTML = `<p style="color: red;">Error al agrupar: ${error.message}</p>`;
    }
}

/**
 * LÓGICA DE VISTA 2: Cambia entre vistas
 */
function toggleView(view, force = false) {
    if (view === currentView && !force) return; 

    currentView = view;
    
    const contDetailed = document.getElementById('view-container-detailed');
    const contGrouped = document.getElementById('view-container-grouped');
    const btnDetailed = document.getElementById('btn-view-detailed');
    const btnGrouped = document.getElementById('btn-view-grouped');
    const groupControls = document.getElementById('group-by-controls-wrapper');

    if (view === 'detailed') {
        contDetailed.style.display = 'flex'; 
        contGrouped.style.display = 'none';
        btnDetailed.classList.add('active');
        btnGrouped.classList.remove('active');
        groupControls.style.display = 'none'; 
    } else {
        contDetailed.style.display = 'none';
        contGrouped.style.display = 'flex';
        btnDetailed.classList.remove('active');
        btnGrouped.classList.add('active');
        groupControls.style.display = 'flex'; 
        
        populateGroupDropdown();

        const selectAgrupar = document.getElementById('select-columna-agrupar');
        const firstOption = selectAgrupar.querySelector('option[value!=""]');
        
        if (firstOption && !selectAgrupar.value) { // Solo si no hay nada seleccionado
            selectAgrupar.value = firstOption.value;
        }
    }
    
    if (!force) {
        refreshActiveView();
    } else if (view === 'detailed') {
        refreshActiveView();
    }
}

/**
 * LÓGICA DE VISTA 2: Puebla el dropdown de 'Agrupar por'
 */
function populateGroupDropdown() {
    const select = document.getElementById('select-columna-agrupar');
    if (!select) return;
    
    const valorActual = select.value;
    select.innerHTML = `<option value="">${i18n['group_by_placeholder'] || 'Select column...'}</option>`;

    const opcionesValidas = COLUMNAS_AGRUPABLES.filter(col => 
        todasLasColumnas.includes(col)
    );

    opcionesValidas.forEach(colName => {
        const option = document.createElement('option');
        option.value = colName;
        option.textContent = (colName === '_row_status') ? "Row Status" : colName;
        select.appendChild(option);
    });

    select.value = valorActual;
}

/**
 * LÓGICA DE VISTA 2: Handler para el cambio del dropdown
 */
async function handleGroupColumnChange() {
    await getGroupedData();
}


/**
 * DIBUJADO 3: Dibuja la Tabla Agrupada
 * ¡ARREGLO 2 (BUG TABLA ROTA)!
 */
function renderGroupedTable(data, colAgrupada, forceClear = false) {
    // --- ¡ARREGLO 2! Apunta al DIV de la vista agrupada ---
    const resultsTableDiv = document.getElementById('results-table-grouped');
    // --------------------------------------------------
    if (!resultsTableDiv) return;

    if (forceClear) {
        resultsTableDiv.innerHTML = '';
        return;
    }

    if (!data) {
        resultsTableDiv.innerHTML = `<p>${i18n['info_upload'] || 'Please upload a file and select a grouping column.'}</p>`;
        return;
    }

    if (data.length === 0) {
        resultsTableDiv.innerHTML = `<p>${i18n['no_filters_applied'] || 'No results found for these filters.'}</p>`;
        return;
    }

    const table = document.createElement('table');
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    
    const headersMap = {
        [colAgrupada]: (colAgrupada === '_row_status') ? "Row Status" : colAgrupada,
        "Total_sum": i18n['group_total_amount'] || "Total Amount",
        "Total_mean": i18n['group_avg_amount'] || "Avg Amount",
        "Total_min": i18n['group_min_amount'] || "Min Amount",
        "Total_max": i18n['group_max_amount'] || "Max Amount",
        "Total_count": i18n['group_invoice_count'] || "Invoice Count"
    };
    
    const headerOrder = [colAgrupada, "Total_sum", "Total_mean", "Total_min", "Total_max", "Total_count"];

    headerOrder.forEach(key => {
        if (headersMap[key]) { 
            const th = document.createElement('th');
            th.textContent = headersMap[key];
            headerRow.appendChild(th);
        }
    });

    const tbody = table.createTBody();
    data.forEach(fila => {
        const row = tbody.insertRow();
        
        headerOrder.forEach(key => {
            if (headersMap[key]) { 
                const cell = row.insertCell();
                let valor = fila[key];
                
                if (key.startsWith('Total_') && key !== 'Total_count') {
                    const numero = parseFloat(valor);
                    if (!isNaN(numero)) {
                        valor = numero.toFixed(2);
                    }
                }
                cell.textContent = valor;
            }
        });
    });

    resultsTableDiv.innerHTML = '';
    resultsTableDiv.appendChild(table);
}