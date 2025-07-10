import pandas as pd
from app import app, db
from database import Song

def import_from_excel(file_path):
    # Leer el archivo Excel
    df = pd.read_excel(file_path, sheet_name='Listado')
    
    with app.app_context():
        # Eliminar canciones existentes (opcional)
        # db.session.query(Song).delete()
        
        # Iterar sobre las filas del Excel
        for index, row in df.iterrows():
            # Verificar que no sea la fila de encabezados
            if pd.notna(row['N']):
                song = Song(
                    title=row['Canción'],
                    artist=row['Artista'],
                    album=row['Álbum'],
                    song_type=row['Tipo'],
                    year=int(row['Año']),
                    event=row['Evento'],
                    times_played=0,
                    is_active=True
                )
                db.session.add(song)
        
        db.session.commit()
        print(f"Se importaron {len(df)} canciones correctamente.")

if __name__ == '__main__':
    # Asegúrate de que el archivo Excel esté en el mismo directorio
    import_from_excel('Canciones.xlsx')