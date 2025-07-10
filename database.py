from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Song(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    artist = db.Column(db.String(100), nullable=False)
    album = db.Column(db.String(100), nullable=False)
    song_type = db.Column(db.String(50), nullable=False)  # 'Rápida' o 'Lenta'
    year = db.Column(db.Integer, nullable=False)
    event = db.Column(db.String(50), nullable=False, default='Normal')
    times_played = db.Column(db.Integer, default=0)  # Veces usada en repertorios
    last_played = db.Column(db.Date)  # Fecha último uso
    is_active = db.Column(db.Boolean, default=True)  # TRUE=Activa, FALSE=Inactiva
    usages = db.relationship('RepertoireSong', back_populates='song', lazy=True)

class Repertoire(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)  # Ej: "Repertorio Enero 2023"
    date_created = db.Column(db.DateTime, default=db.func.current_timestamp())
    songs = db.relationship('RepertoireSong', backref='repertoire', lazy=True, cascade='all, delete-orphan')

class RepertoireSong(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    repertoire_id = db.Column(db.Integer, db.ForeignKey('repertoire.id'))
    song_id = db.Column(db.Integer, db.ForeignKey('song.id'))
    order = db.Column(db.Integer)  # Orden en el repertorio
    song = db.relationship('Song', back_populates='usages')