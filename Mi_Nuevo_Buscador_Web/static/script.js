// script.js (Versión 8.4 - Corrección de espacios y letras)

// --- Variable global para traducciones ---
let i18n = {}; 

// --- Variables de Estado Globales ---
let currentFileId = null; let activeFilters = []; let currentData = [];
let tableData = []; let todasLasColumnas = []; let columnasVisibles = [];
let sortState = { column: null, direction: 'asc' };

// --- Referencias a elementos del HTML ---
const fileUploader = document.getElementById('file-uploader');
const colSelect = document.getElementById('select-columna');
const valInput = document.getElementById('input-valor');
const btnAdd = document.getElementById('btn-add-filter');
const btnClear = document.getElementById('btn-clear-filters');
const filtersListDiv = document.getElementById('active-filters-list');
const resultsHeader = document.getElementById('results-header');
const resultsTableDiv = document.getElementById('results-table');
const btnDownloadExcel = document.getElementById('btn-download-excel');
const btnFullscreen = document.getElementById('btn-fullscreen');
const searchTableInput = document.getElementById('input-search-table');
const btnLangEs = document.getElementById('btn-lang-es');
const btnLangEn = document.getElementById('btn-lang-en');
const columnSelectorWrapper = document.getElementById('column-selector-wrapper');
// ==================================================
// ¡NUEVO! Referencias a los botones de columnas
// ==================================================
const btnCheckAllCols = document.getElementById('btn-check-all-cols');
const btnUncheckAllCols = document.getElementById('btn-uncheck-all-cols');


// --- Función de inicialización ---
document.addEventListener('DOMContentLoaded', (event) => {
    loadTranslations();
    setupEventListeners();
});

async function loadTranslations() {
    try {
        const response = await fetch('/api/get_translations');
        if (!response.ok) throw new Error('Network response was not ok');
        i18n = await response.json();
        updateDynamicText();
    } catch (error) { console.error('Error cargando traducciones:', error); i18n = { /* Fallbacks */ }; updateDynamicText(); }
}

function setupEventListeners() {
    fileUploader.addEventListener('change', handleFileUpload);
    btnAdd.addEventListener('click', handleAddFilter);
    btnClear.addEventListener('click', handleClearFilters);
    btnFullscreen.addEventListener('click', handleFullscreen);
    searchTableInput.addEventListener('keyup', handleSearchTable);
    btnDownloadExcel.addEventListener('click', handleDownloadExcel);
    btnLangEs.addEventListener('click', () => setLanguage('es'));
    btnLangEn.addEventListener('click', () => setLanguage('en'));
    filtersListDiv.addEventListener('click', handleRemoveFilter);
    columnSelectorWrapper.addEventListener('change', handleColumnVisibilityChange);
    resultsTableDiv.addEventListener('click', handleSort); 
    // ==================================================
    // ¡NUEVO! Listeners para los botones de columnas
    // ==================================================
    btnCheckAllCols.addEventListener('click', handleCheckAllColumns);
    btnUncheckAllCols.addEventListener('click', handleUncheckAllColumns); 
}

// --- Función para actualizar texto dinámico inicial ---
function updateDynamicText() {
    valInput.placeholder = i18n['search_text'] || "Texto a buscar...";
    searchTableInput.placeholder = (i18n['search_text'] || "Buscar...") + "...";
    if (activeFilters.length === 0) filtersListDiv.innerHTML = `<p>${i18n['no_filters_applied'] || 'No filters'}</p>`;
    if (todasLasColumnas.length === 0) columnSelectorWrapper.innerHTML = `<p>${i18n['info_upload'] || 'Upload file'}</p>`;
    // Ajuste: Mostrar mensaje correcto si hay archivo pero tabla vacía
    if (!currentFileId) {
        resultsTableDiv.innerHTML = `<p>${i18n['info_upload'] || 'Upload file'}</p>`;
    } else if (currentData.length === 0 && activeFilters.length === 0 && !searchTableInput.value) {
         resultsTableDiv.innerHTML = `<p>Archivo cargado. No se encontraron datos.</p>`; // O usar una clave i18n
    }
}


// --- Función para cambiar de idioma ---
async function setLanguage(langCode) {
    try { await fetch(`/api/set_language/${langCode}`); location.reload(); }
    catch (error) { console.error('Error al cambiar idioma:', error); }
}

// --- Función para quitar filtro individual ---
function handleRemoveFilter(event) {
    if (!event.target.classList.contains('remove-filter-btn')) return;
    const indexToRemove = parseInt(event.target.dataset.index, 10);
    activeFilters.splice(indexToRemove, 1);
    getFilteredData();
}


// --- EVENTO 1: Subir archivo ---
async function handleFileUpload(event) {
    const file = event.target.files[0]; if (!file) return;
    const formData = new FormData(); formData.append('file', file);
    try {
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        const result = await response.json(); if (!response.ok) throw new Error(result.error);
        currentFileId = result.file_id;
        todasLasColumnas = result.columnas; columnasVisibles = [...todasLasColumnas];
        colSelect.innerHTML = `<option value="">${i18n['column_select'] || 'Select col...'}</option>`;
        todasLasColumnas.forEach(col => {
            const option = document.createElement('option'); option.value = col; option.textContent = col; colSelect.appendChild(option);
        });
        renderColumnSelector();
        activeFilters = []; searchTableInput.value = ''; sortState = { column: null, direction: 'asc' }; // Reset sort
        await getFilteredData();
    } catch (error) { console.error('Error en fetch /api/upload:', error); alert((i18n['error_critical'] || 'Error: {e}').replace('{e}', error.message)); todasLasColumnas = []; columnasVisibles = []; renderColumnSelector(); }
}

// --- EVENTO 2: Añadir filtro ---
async function handleAddFilter() {
    const col = colSelect.value; const val = valInput.value;
    if (col && val) { activeFilters.push({ columna: col, valor: val }); valInput.value = ''; searchTableInput.value = ''; await getFilteredData(); }
    else { alert(i18n['warning_no_filter'] || 'Select col and value'); }
}

// --- EVENTO 3: Limpiar filtros ---
async function handleClearFilters() { activeFilters = []; searchTableInput.value = ''; await getFilteredData(); }

// --- EVENTO 4: Pantalla Completa ---
function handleFullscreen() { document.body.classList.toggle('fullscreen-mode'); /* ... icono ... */ }

// --- EVENTO 5: Lupa de Búsqueda ---
function handleSearchTable() {
    const searchTerm = searchTableInput.value.toLowerCase();
    if (!searchTerm) { tableData = [...currentData]; }
    else { tableData = currentData.filter(row => columnasVisibles.some(col => String(row[col]).toLowerCase().includes(searchTerm))); }
    applySort(); renderTable();
}

// --- EVENTO 6: Descargar Excel ---
async function handleDownloadExcel() {
    if (currentData.length === 0 || !currentFileId) { alert(i18n['no_filters_applied'] + " " + (i18n['download_button'] || "")); return; }
    try {
        const response = await fetch('/api/download_excel', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id: currentFileId, filtros_activos: activeFilters, columnas_visibles: columnasVisibles })
        });
        if (!response.ok) throw new Error('Server error generating Excel.');
        const blob = await response.blob(); const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'facturas_filtradas.xlsx';
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (error) { console.error('Error en fetch /api/download_excel:', error); alert('Error downloading file: ' + error.message); }
}

// --- EVENTO 7: Cambio en Checkbox de Columna (¡MODIFICADO!) ---
function handleColumnVisibilityChange(event) {
    if (event.target.type !== 'checkbox') return;
    
    // Ahora usamos la función helper
    updateVisibleColumnsFromCheckboxes();
    renderTable(); // Re-render table with updated visible columns
}

// ==================================================
// --- ¡NUEVAS FUNCIONES! ---
// ==================================================

// --- FUNCIÓN HELPER ---
// Sincroniza el array 'columnasVisibles' con el estado de los checkboxes
function updateVisibleColumnsFromCheckboxes() {
    // Esta lógica estaba antes en 'handleColumnVisibilityChange'
    columnasVisibles = todasLasColumnas.filter(col => {
        const checkbox = document.querySelector(`#column-selector-wrapper input[value="${col}"]`);
        return checkbox ? checkbox.checked : false; // Usar el estado actual del checkbox
    });
}

// --- NUEVO EVENTO: Marcar Todas ---
function handleCheckAllColumns() {
    const checkboxes = document.querySelectorAll('#column-selector-wrapper input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
    
    // Sincronizar y re-renderizar
    updateVisibleColumnsFromCheckboxes();
    renderTable();
}

// --- NUEVO EVENTO: Desmarcar Todas ---
function handleUncheckAllColumns() {
    const checkboxes = document.querySelectorAll('#column-selector-wrapper input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    
    // Sincronizar y re-renderizar
    updateVisibleColumnsFromCheckboxes();
    renderTable();
}
// ==================================================
// --- FIN NUEVAS FUNCIONES ---
// ==================================================


// --- EVENTO 8: Clic en Encabezado de Tabla (Ordenar) ---
function handleSort(event) {
    const headerCell = event.target.closest('th'); if (!headerCell) return;
    const columnToSort = headerCell.dataset.column; if (!columnToSort) return;
    if (sortState.column === columnToSort) { sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc'; }
    else { sortState.column = columnToSort; sortState.direction = 'asc'; }
    applySort(); renderTable();
}

// --- FUNCIÓN CENTRAL: Pedir datos filtrados (del API) ---
async function getFilteredData() {
    if (!currentFileId) { currentData = []; tableData = []; renderFilters(); renderTable(); resultsHeader.textContent = i18n['results_header']?.split('(')[0] || 'Results'; return; }
    try {
        const response = await fetch('/api/filter', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id: currentFileId, filtros_activos: activeFilters })
        });
        const result = await response.json(); if (!response.ok) throw new Error(result.error);
        currentData = result.data; tableData = [...currentData];
        applySort(); renderFilters(); renderTable();
        resultsHeader.textContent = i18n['results_header']?.replace('{num_filas}', result.num_filas) || `Results (${result.num_filas})`;
    } catch (error) { console.error('Error en fetch /api/filter:', error); alert('Error filtering: ' + error.message); }
}

// --- FUNCIÓN para aplicar el orden actual a 'tableData' ---
function applySort() {
    if (!sortState.column) return;
    const column = sortState.column; const direction = sortState.direction === 'asc' ? 1 : -1;
    tableData.sort((a, b) => {
        const valA = a[column]; const valB = b[column];
        const numA = parseFloat(valA); const numB = parseFloat(valB);
        if (!isNaN(numA) && !isNaN(numB)) { return (numA - numB) * direction; }
        else { const strA = String(valA).toLowerCase(); const strB = String(valB).toLowerCase(); if (strA < strB) return -1 * direction; if (strA > strB) return 1 * direction; return 0; }
    });
}

// --- DIBUJADO 1: Filtros (con botón "Quitar") ---
function renderFilters() {
    filtersListDiv.innerHTML = ''; 
    if (activeFilters.length === 0) { filtersListDiv.innerHTML = `<p>${i18n['no_filters_applied'] || 'No filters'}</p>`; return; }
    activeFilters.forEach((filtro, index) => {
        const filterText = (i18n['filter_display'] || "Col **{c}** cont **'{v}'**").replace('{columna}', filtro.columna).replace('{valor}', filtro.valor).replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        const removeButtonText = i18n['remove_button'] || 'Remove';
        const filterItemHTML = `<div class="filtro-item"><span>• ${filterText}</span><button class="remove-filter-btn" data-index="${index}">${removeButtonText}</button></div>`;
        filtersListDiv.innerHTML += filterItemHTML;
    });
}

// --- DIBUJADO 1.5: Selector de Columnas ---
function renderColumnSelector() {
    columnSelectorWrapper.innerHTML = ''; 
    if (todasLasColumnas.length === 0) { columnSelectorWrapper.innerHTML = `<p>${i18n['info_upload'] || 'Upload file'}</p>`; return; }
    todasLasColumnas.forEach(columnName => {
        const isChecked = columnasVisibles.includes(columnName);
        const itemHTML = `<div class="column-selector-item"><label><input type="checkbox" value="${columnName}" ${isChecked ? 'checked' : ''}>${columnName}</label></div>`;
        columnSelectorWrapper.innerHTML += itemHTML;
    });
}

// --- DIBUJADO 2: Tabla (¡CORREGIDO!) ---
function renderTable() {
    resultsTableDiv.innerHTML = ''; 
    if (!currentFileId) { resultsTableDiv.innerHTML = `<p>${i18n['info_upload'] || 'Upload file'}</p>`; return; }
    
    // Mensaje de no resultados
    if (tableData.length === 0) { 
        if (activeFilters.length > 0 || searchTableInput.value) {
            resultsTableDiv.innerHTML = `<p>${(i18n['no_filters_applied'] || 'No results').replace('.', ' for these filters.')}</p>`;
        } else {
             resultsTableDiv.innerHTML = `<p>File loaded. No data found.</p>`; // O usar i18n
        }
        return; 
    }

    const table = document.createElement('table');
    const thead = table.createTHead(); const headerRow = thead.insertRow();
    
    // Usa 'columnasVisibles' para encabezados
    columnasVisibles.forEach(colName => {
        const th = document.createElement('th');
        th.dataset.column = colName; // Para ordenar
        
        // ¡ARREGLO! Usa span para el nombre
        th.innerHTML = `
            <span class="column-name">${colName}</span>
            <span class="sort-icon-container">
                <svg class="sort-icon asc" fill="currentColor" viewBox="0 0 20 20"><path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/></svg>
                <svg class="sort-icon desc" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
            </span>`;
        
        if (sortState.column === colName) th.classList.add(sortState.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
        headerRow.appendChild(th);
    });

    const tbody = table.createTBody();
    tableData.forEach(fila => {
        const row = tbody.insertRow();
        // Usa 'columnasVisibles' para celdas
        columnasVisibles.forEach(colName => {
            const cell = row.insertCell(); 
            // Asegurarse de que exista la columna en la fila (puede no existir si el excel tiene filas raras)
            cell.textContent = fila.hasOwnProperty(colName) ? fila[colName] : ''; 
        });
    });
    resultsTableDiv.appendChild(table);
}