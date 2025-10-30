# app.py (Versión 8 - Ordenar y Ocultar Columnas)

import os
import pandas as pd
import uuid
import io 
from flask import Flask, request, jsonify, render_template, send_file, session, redirect, url_for
from flask_cors import CORS

# --- Importar tus módulos ---
from modules.loader import cargar_datos
from modules.filters import aplicar_filtros_dinamicos
from modules.translator import get_text, LANGUAGES

# --- Configuración de Flask ---
app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app) 
app.config['SECRET_KEY'] = 'mi-llave-secreta-para-el-buscador-12345'
UPLOAD_FOLDER = 'temp_uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# --- Context Processor para Traducciones ---
@app.context_processor
def inject_translator():
    lang = session.get('language', 'es') 
    return dict(get_text=get_text, lang=lang)

# --- Ruta Principal ---
@app.route('/')
def home():
    return render_template('index.html')

# --- APIs de Idioma ---
@app.route('/api/set_language/<string:lang_code>')
def set_language(lang_code):
    if lang_code in LANGUAGES:
        session['language'] = lang_code 
    return jsonify({"status": "success", "language": lang_code})

@app.route('/api/get_translations')
def get_translations():
    lang = session.get('language', 'es')
    return jsonify(LANGUAGES.get(lang, LANGUAGES['es']))

# --- API de Carga ---
@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files: return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_FOLDER, f"{file_id}.xlsx")
    file.save(file_path)
    try:
        df = cargar_datos(file_path)
        if df.empty: raise Exception("File is empty or corrupt")
        # ¡Devolvemos todas las columnas posibles!
        todas_las_columnas = [col for col in df.columns]
        return jsonify({ "file_id": file_id, "columnas": todas_las_columnas })
    except Exception as e:
        print(f"Error en /api/upload: {e}") 
        return jsonify({"error": str(e)}), 500

# --- API de Filtrado ---
@app.route('/api/filter', methods=['POST'])
def filter_data():
    data = request.json
    file_id = data.get('file_id')
    filtros_recibidos = data.get('filtros_activos')
    if not file_id: return jsonify({"error": "Missing file_id"}), 400
    file_path = os.path.join(UPLOAD_FOLDER, f"{file_id}.xlsx")
    if not os.path.exists(file_path): return jsonify({"error": "File expired or not found"}), 404
    try:
        df_original = cargar_datos(file_path) 
        resultado_df = aplicar_filtros_dinamicos(df_original, filtros_recibidos)
        resultado_json = resultado_df.to_dict(orient="records") 
        return jsonify({ "data": resultado_json, "num_filas": len(resultado_df) })
    except Exception as e:
        print(f"Error en /api/filter: {e}") 
        return jsonify({"error": str(e)}), 500

# ---
# ¡MODIFICADO! API de Descarga Excel (Acepta columnas)
# ---
@app.route('/api/download_excel', methods=['POST'])
def download_excel():
    data = request.json
    file_id = data.get('file_id')
    filtros_recibidos = data.get('filtros_activos')
    # ¡NUEVO! Recibimos las columnas que el usuario quiere ver
    columnas_visibles = data.get('columnas_visibles') 

    if not file_id: return "Error: Missing file_id", 400
    file_path = os.path.join(UPLOAD_FOLDER, f"{file_id}.xlsx")
    if not os.path.exists(file_path): return "Error: File not found", 404

    try:
        df_original = cargar_datos(file_path) 
        resultado_df = aplicar_filtros_dinamicos(df_original, filtros_recibidos)
        
        # --- ¡NUEVA LÓGICA DE COLUMNAS! ---
        df_a_exportar = resultado_df
        # Si el frontend nos envió una lista de columnas visibles, la usamos
        if columnas_visibles and isinstance(columnas_visibles, list):
             # Nos aseguramos de que solo usemos columnas que realmente existen
             columnas_existentes = [col for col in columnas_visibles if col in resultado_df.columns]
             if columnas_existentes:
                 df_a_exportar = resultado_df[columnas_existentes]
        # --- FIN NUEVA LÓGICA ---

        output_buffer = io.BytesIO()
        with pd.ExcelWriter(output_buffer, engine='xlsxwriter') as writer:
            # Exportamos el DataFrame (potencialmente con columnas filtradas)
            df_a_exportar.to_excel(writer, sheet_name='Resultados', index=False)
        output_buffer.seek(0)
        
        return send_file(
            output_buffer,
            as_attachment=True,
            download_name='facturas_filtradas.xlsx',
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        print(f"Error en /api/download_excel: {e}") 
        return "Error al generar el Excel", 500

# --- Punto de entrada ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)