from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
from openpyxl import Workbook
from database import db, Song, Repertoire, RepertoireSong
from datetime import datetime
from reportlab.pdfgen import canvas
from io import BytesIO
import os

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type"]
    }
})
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///songs.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = 'tu-clave-secreta-aqui-12345'

db.init_app(app)

with app.app_context():
    db.create_all()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/songs')
def songs():
    return render_template('songs.html')

@app.route('/repertoire')
def repertoire():
    try:
        return render_template('repertoire.html')
    except Exception as e:
        print("Error al renderizar repertoire.html:", str(e))
        return str(e), 500

@app.route('/history')
def history():
    return render_template('history.html')

# API Endpoints
@app.route('/api/songs', methods=['GET', 'POST'])
def handle_songs():
    if request.method == 'GET':
        songs = Song.query.all()
        recent_reps = Repertoire.query.order_by(Repertoire.date_created.desc()).limit(15).all()
        recent_song_ids = {rs.song_id for rep in recent_reps for rs in rep.songs}

        for song in songs:
            if song.id not in recent_song_ids and not song.is_active:
                song.is_active = True  # reactivar automáticamente

        db.session.commit()

        return jsonify([{
            'id': song.id,
            'title': song.title,
            'artist': song.artist,
            'album': song.album,
            'type': song.song_type,
            'year': song.year,
            'event': song.event,
            'times_played': song.times_played,
            'is_active': song.is_active
        } for song in songs])
    elif request.method == 'POST':
        data = request.json
        new_song = Song(
            title=data['title'],
            artist=data['artist'],
            album=data['album'],
            song_type=data['type'],
            year=data['year'],
            event=data['event']
        )
        db.session.add(new_song)
        db.session.commit()
        return jsonify({'message': 'Song added successfully'}), 201

@app.route('/api/songs/<int:id>', methods=['PUT', 'DELETE'])
def handle_song(id):
    song = Song.query.get_or_404(id)
    if request.method == 'PUT':
        data = request.json
        song.title = data.get('title', song.title)
        song.artist = data.get('artist', song.artist)
        song.album = data.get('album', song.album)
        song.song_type = data.get('type', song.song_type)
        song.year = data.get('year', song.year)
        song.event = data.get('event', song.event)
        song.is_active = data.get('is_active', song.is_active)
        song.times_played = data.get('times_played', song.times_played)
        db.session.commit()
        return jsonify({'message': 'Song updated successfully'})
    elif request.method == 'DELETE':
        db.session.delete(song)
        db.session.commit()
        return jsonify({'message': 'Song deleted successfully'})

@app.route('/api/repertoire', methods=['GET', 'POST'])
def handle_repertoire():
    if request.method == 'GET':
        repertoires = Repertoire.query.order_by(Repertoire.date_created.desc()).all()
        result = []
        for rep in repertoires:
            result.append({
                'id': rep.id,
                'name': rep.name,
                'date_created': rep.date_created.strftime('%Y-%m-%d %H:%M'),
                'song_count': len(rep.songs)
            })
        return jsonify(result)

    # Si es POST, guardar el repertorio
    data = request.json
    new_repertoire = Repertoire(name=data['name'])

    recent_reps = Repertoire.query.order_by(Repertoire.date_created.desc()).limit(15).all()

    for i, song_id in enumerate(data['song_ids']):
        song = Song.query.get(song_id)
        if song:
            song.times_played += 1
            song.last_played = datetime.now()
            song.is_active = False  # 🔒 Desactivar inmediatamente

            rep_song = RepertoireSong(
                repertoire=new_repertoire,
                song_id=song.id,
                order=i
            )
            db.session.add(rep_song)

    db.session.add(new_repertoire)
    db.session.commit()
    return jsonify({'message': 'Repertorio creado correctamente'}), 201

@app.route('/api/repertoire/<int:id>')
def get_repertoire(id):
    repertoire = Repertoire.query.get_or_404(id)
    return jsonify({
        'id': repertoire.id,
        'name': repertoire.name,
        'date_created': repertoire.date_created.strftime('%Y-%m-%d %H:%M'),
        'songs': [{
            'id': rs.song.id,
            'title': rs.song.title,
            'artist': rs.song.artist,
            'album': rs.song.album,
            'type': rs.song.song_type,
            'year': rs.song.year,
            'order': rs.order
        } for rs in repertoire.songs]
    })

@app.route('/api/repertoire/<int:id>/pdf')
def generate_pdf(id):
    repertoire = Repertoire.query.get_or_404(id)
    
    buffer = BytesIO()
    p = canvas.Canvas(buffer)
    
    p.drawString(100, 800, f"Repertorio: {repertoire.name}")
    p.drawString(100, 780, f"Fecha: {repertoire.date_created.strftime('%Y-%m-%d')}")
    
    y = 750
    for i, rep_song in enumerate(sorted(repertoire.songs, key=lambda x: x.order)):
        song = rep_song.song
        p.drawString(100, y, f"{i+1}. {song.title} - {song.artist} ({song.album}) - {song.song_type}")
        y -= 20
        if y < 50:
            p.showPage()
            y = 800
    
    p.save()
    buffer.seek(0)
    
    return send_file(
        buffer,
        as_attachment=True,
        download_name=f'repertoire_{id}.pdf',
        mimetype='application/pdf'
    )

@app.route('/api/repertoire/pdf')
def generate_pdf_from_params():
    name = request.args.get('name', 'Repertorio')
    song_ids = request.args.get('songs', '').split(',')
    
    buffer = BytesIO()
    p = canvas.Canvas(buffer)
    
    p.drawString(100, 800, f"Repertorio: {name}")
    p.drawString(100, 780, f"Fecha: {datetime.now().strftime('%Y-%m-%d')}")
    
    y = 750
    for i, song_id in enumerate(song_ids):
        if song_id:
            song = Song.query.get(int(song_id))
            if song:
                p.drawString(100, y, f"{i+1}. {song.title} - {song.artist} ({song.album}) - {song.song_type}")
                y -= 20
                if y < 50:
                    p.showPage()
                    y = 800
    
    p.save()
    buffer.seek(0)
    
    return send_file(
        buffer,
        as_attachment=True,
        download_name=f'repertoire_{name}.pdf',
        mimetype='application/pdf'
    )

@app.route('/api/repertoire/<int:id>', methods=['DELETE'])
def delete_repertoire(id):
    rep = Repertoire.query.get_or_404(id)

    for rep_song in rep.songs:
        song = rep_song.song
        song.times_played = max(0, song.times_played - 1)
        song.is_active = True  # reactivar al eliminar repertorio

    db.session.delete(rep)
    db.session.commit()
    return jsonify({'message': 'Repertorio eliminado'})

@app.route('/api/songs/<int:id>/unlock', methods=['POST'])
def unlock_song(id):
    song = Song.query.get_or_404(id)
    song.is_active = True
    db.session.commit()
    return jsonify({'message': 'Canción desbloqueada'})

@app.route('/api/songs/<int:id>', methods=['GET'])
def get_song(id):
    song = Song.query.get_or_404(id)
    return jsonify({
        'id': song.id,
        'title': song.title,
        'artist': song.artist,
        'album': song.album,
        'type': song.song_type,
        'year': song.year,
        'event': song.event,
        'is_active': song.is_active
    })

@app.route('/api/songs/export', methods=['GET'])
def export_songs_excel():
    songs = Song.query.all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Canciones"

    headers = ["Título", "Artista", "Álbum", "Tipo", "Año", "Evento", "Veces tocada", "Estado"]
    ws.append(headers)

    for song in songs:
        ws.append([
            song.title,
            song.artist,
            song.album,
            song.song_type,
            song.year,
            song.event,
            song.times_played,
            "Activa" if song.is_active else "Inactiva"
        ])

    output = BytesIO()
    wb.save(output)
    output.seek(0)

    return send_file(
        output,
        as_attachment=True,
        download_name='lista_canciones.xlsx',
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )

@app.route('/api/filter/songs')
def filter_songs():
    try:
        artist = request.args.get('artist', '')
        album = request.args.get('album', '')
        song_type = request.args.get('type', '')
        year = request.args.get('year', '')
        recent_reps = Repertoire.query.order_by(Repertoire.date_created.desc()).limit(15).all()
        blocked_song_ids = set()

        for rep in recent_reps:
            for rs in rep.songs:
                if not rs.song.is_active:  # solo bloquear si sigue inactiva
                     blocked_song_ids.add(rs.song_id)

        query = Song.query.filter(Song.is_active == True, ~Song.id.in_(blocked_song_ids))
        
        if artist:
            query = query.filter(Song.artist == artist)
        if album:
            query = query.filter(Song.album == album)
        if song_type:
            query = query.filter(Song.song_type == song_type)
        if year:
            query = query.filter(Song.year >= int(year))
        
        songs = query.all()
        
        return jsonify([{
            'id': song.id,
            'title': song.title,
            'artist': song.artist,
            'album': song.album,
            'type': song.song_type,
            'year': song.year
        } for song in songs])
    except Exception as e:
        return jsonify({'error': str(e)}), 500 

if __name__ == '__main__':
    app.run(debug=True)