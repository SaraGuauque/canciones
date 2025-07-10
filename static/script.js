document.addEventListener('DOMContentLoaded', function() {
    // Inicializar tooltips de Bootstrap
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Configurar eventos según la página
    if (document.getElementById('addSongForm')) {
        document.getElementById('addSongForm').addEventListener('submit', function(e) {
            e.preventDefault();
            addSong();
        });
    }

    if (document.getElementById('songs-table')) {
        loadSongs();
    }

    if (document.getElementById('repertoire-name')) {
        setupRepertoirePage();
    }

    if (document.getElementById('repertoires-table')) {
        loadRepertoires();
    }

    if (document.getElementById('searchInput')) {
    document.getElementById('searchInput').addEventListener('input', loadSongs);
    }
});

// ============== Funciones para canciones ==============
function loadSongs() {
    fetch('/api/songs')
        .then(response => response.json())
        .then(data => {
            const tableBody = document.querySelector('#songs-table tbody');
            tableBody.innerHTML = '';

            const searchQuery = document.getElementById('searchInput')?.value.toLowerCase() || '';

            const filtered = data.filter(song =>
                song.title.toLowerCase().includes(searchQuery) ||
                song.artist.toLowerCase().includes(searchQuery)
            );

            filtered.forEach(song => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${song.title}</td>
                    <td>${song.artist}</td>
                    <td>${song.album}</td>
                    <td>${song.type}</td>
                    <td>${song.year}</td>
                    <td>${song.times_played}</td>
                    <td>
                        ${song.is_active
                            ? `<span class="badge bg-success">Activa</span>`
                            : `<button class="btn btn-sm btn-warning reactivate-btn" data-id="${song.id}">Activar</button>`
                        }
                    </td>
                    <td>
                        <button class="btn btn-sm btn-info me-1 edit-btn" data-id="${song.id}">Editar</button>
                        <button class="btn btn-sm btn-danger delete-btn" data-id="${song.id}">Eliminar</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });

            // Botón Editar
            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', function () {
                    const songId = this.getAttribute('data-id');
                    fetch(`/api/songs/${songId}`)
                        .then(res => res.json())
                        .then(song => {
                            document.getElementById('editSongId').value = song.id;
                            document.getElementById('editTitle').value = song.title;
                            document.getElementById('editArtist').value = song.artist;
                            document.getElementById('editAlbum').value = song.album;
                            document.getElementById('editType').value = song.type;
                            document.getElementById('editYear').value = song.year;
                            document.getElementById('editEvent').value = song.event;
                            document.getElementById('editIsActive').checked = song.is_active;
                            document.getElementById('editTimesPlayed').value = song.times_played;
                            const modal = new bootstrap.Modal(document.getElementById('editSongModal'));
                            modal.show();
                        });
                });
            });

            // Botón Eliminar
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', function () {
                    deleteSong(this.getAttribute('data-id'));
                });
            });

            // Botón Reactivar (columna Estado)
            document.querySelectorAll('.reactivate-btn').forEach(btn => {
                btn.addEventListener('click', function () {
                    const id = this.getAttribute('data-id');
                    fetch(`/api/songs/${id}/unlock`, { method: 'POST' })
                        .then(res => res.json())
                        .then(data => {
                            alert('Canción activada manualmente.');
                            loadSongs();
                        });
                });
            });
        })
        .catch(error => console.error('Error:', error));
}

function addSong() {
    const songData = {
        title: document.getElementById('songTitle').value,
        artist: document.getElementById('songArtist').value,
        album: document.getElementById('songAlbum').value,
        type: document.getElementById('songType').value,
        year: document.getElementById('songYear').value,
        event: document.getElementById('songEvent').value
    };

    fetch('/api/songs', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(songData)
    })
    .then(response => {
        if (response.ok) {
            document.getElementById('addSongForm').reset();
            loadSongs();
            showAlert('Canción agregada correctamente', 'success');
        }
    });
}

function openEditModal(songId) {
    fetch(`/api/songs/${songId}`)
        .then(response => response.json())
        .then(song => {
            document.getElementById('editSongId').value = song.id;
            document.getElementById('editTitle').value = song.title;
            document.getElementById('editArtist').value = song.artist;
            document.getElementById('editAlbum').value = song.album;
            document.getElementById('editType').value = song.type;
            document.getElementById('editYear').value = song.year;
            document.getElementById('editEvent').value = song.event;
            document.getElementById('editIsActive').checked = song.is_active;

            const editModal = new bootstrap.Modal(document.getElementById('editSongModal'));
            editModal.show();
        });
}

function updateSong() {
    const songId = document.getElementById('editSongId').value;
    const songData = {
    title: document.getElementById('editTitle').value,
    artist: document.getElementById('editArtist').value,
    album: document.getElementById('editAlbum').value,
    type: document.getElementById('editType').value,
    year: document.getElementById('editYear').value,
    event: document.getElementById('editEvent').value,
    is_active: document.getElementById('editIsActive').checked,
    times_played: parseInt(document.getElementById('editTimesPlayed').value)
};

    fetch(`/api/songs/${songId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(songData)
    })
    .then(response => {
        if (response.ok) {
            loadSongs();
            bootstrap.Modal.getInstance(document.getElementById('editSongModal')).hide();
            showAlert('Canción actualizada correctamente', 'success');
        }
    });
}

function deleteSong(songId) {
    if (confirm('¿Estás seguro de que deseas eliminar esta canción?')) {
        fetch(`/api/songs/${songId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (response.ok) {
                loadSongs();
                showAlert('Canción eliminada correctamente', 'success');
            }
        });
    }
}

// ============== Funciones para repertorios ==============
let currentRepertoire = {
    name: '',
    songs: []
};

function setupRepertoirePage() {
    document.getElementById('searchSongsBtn').addEventListener('click', searchSongs);
    document.getElementById('saveRepertoireBtn').addEventListener('click', saveRepertoire);
    document.getElementById('generatePdfBtn').addEventListener('click', generatePDF);
}

function searchSongs() {
    const artist = document.getElementById('filter-artist').value;
    const album = document.getElementById('filter-album').value;
    const songType = document.getElementById('filter-type').value;
    const year = document.getElementById('filter-year').value;

    let url = '/api/filter/songs?';
    if (artist) url += `artist=${encodeURIComponent(artist)}&`;
    if (album) url += `album=${encodeURIComponent(album)}&`;
    if (songType) url += `type=${encodeURIComponent(songType)}&`;
    if (year) url += `year=${encodeURIComponent(year)}`;

    fetch(url)
        .then(response => response.json())
        .then(songs => {
            const resultsContainer = document.getElementById('search-results');
            resultsContainer.innerHTML = '';

            songs.forEach(song => {
                const songElement = document.createElement('div');
                songElement.className = 'list-group-item d-flex justify-content-between align-items-center';
                songElement.innerHTML = `
                    <div>
                        <h6>${song.title}</h6>
                        <small class="text-muted">${song.artist} - ${song.album} (${song.year}) - ${song.type}</small>
                    </div>
                    <button class="btn btn-sm btn-success add-to-repertoire" data-id="${song.id}">
                        ${currentRepertoire.songs.some(s => s.id === song.id) ? '✓ Agregada' : 'Agregar'}
                    </button>
                `;
                resultsContainer.appendChild(songElement);
            });

            document.querySelectorAll('.add-to-repertoire').forEach(btn => {
                btn.addEventListener('click', function() {
                    addSongToRepertoire(this.getAttribute('data-id'));
                });
            });
        });
}

function addSongToRepertoire(songId) {
    fetch(`/api/songs/${songId}`)
        .then(response => response.json())
        .then(song => {
            if (!currentRepertoire.songs.some(s => s.id === song.id)) {
                currentRepertoire.songs.push(song);
                updateRepertoireView();
                showAlert('Canción agregada al repertorio', 'success');
            } else {
                showAlert('Esta canción ya está en el repertorio', 'warning');
            }
        });
}

function removeSongFromRepertoire(index) {
    currentRepertoire.songs.splice(index, 1);
    updateRepertoireView();
}

function updateRepertoireView() {
    const repertoireList = document.getElementById('repertoire-songs');
    repertoireList.innerHTML = '';

    currentRepertoire.songs.forEach((song, index) => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
            <div>
                <span class="badge bg-secondary me-2">${index + 1}</span>
                ${song.title} - ${song.artist}
                <small class="text-muted d-block">${song.album} (${song.year}) - ${song.type}</small>
            </div>
            <button class="btn btn-sm btn-danger remove-song" data-index="${index}">
                &times;
            </button>
        `;
        repertoireList.appendChild(li);
    });

    document.getElementById('total-songs').textContent = currentRepertoire.songs.length;
    document.getElementById('fast-songs').textContent = currentRepertoire.songs.filter(s => s.type === 'Rápida').length;
    document.getElementById('slow-songs').textContent = currentRepertoire.songs.filter(s => s.type === 'Lenta').length;

    document.querySelectorAll('.remove-song').forEach(btn => {
        btn.addEventListener('click', function() {
            removeSongFromRepertoire(parseInt(this.getAttribute('data-index')));
        });
    });

    // Actualizar botones en resultados de búsqueda
    document.querySelectorAll('.add-to-repertoire').forEach(btn => {
        const songId = btn.getAttribute('data-id');
        btn.textContent = currentRepertoire.songs.some(s => s.id == songId) ? '✓ Agregada' : 'Agregar';
        btn.className = currentRepertoire.songs.some(s => s.id == songId) 
            ? 'btn btn-sm btn-success add-to-repertoire' 
            : 'btn btn-sm btn-outline-success add-to-repertoire';
    });
}

function saveRepertoire() {
    const songIds = this.repertoireSongs.map(song => song.id);
    fetch('/api/repertoire', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: this.repertoireName,
            song_ids: songIds
        })
    })
    .then(response => {
        if (response.ok) {
            alert('Repertorio guardado exitosamente');
            this.repertoireSongs = [];
            this.repertoireName = '';
        } else {
            alert('Error al guardar repertorio');
        }
    });
}

function generatePDF() {
    if (currentRepertoire.songs.length === 0) {
        showAlert('El repertorio está vacío', 'warning');
        return;
    }

    const repertoireName = document.getElementById('repertoire-name').value || 'Repertorio';
    const songIds = currentRepertoire.songs.map(song => song.id).join(',');

    window.open(`/api/repertoire/pdf?name=${encodeURIComponent(repertoireName)}&songs=${songIds}`, '_blank');
}

// ============== Funciones para historial ==============
function loadRepertoires() {
    fetch('/api/repertoire')
        .then(response => response.json())
        .then(repertoires => {
            const tableBody = document.querySelector('#repertoires-table tbody');
            tableBody.innerHTML = '';

            repertoires.forEach(repertoire => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${repertoire.name}</td>
                    <td>${repertoire.date_created}</td>
                    <td>${repertoire.song_count}</td>
                    <td>
                        <button class="btn btn-sm btn-info view-repertoire" data-id="${repertoire.id}">Ver</button>
                        <button class="btn btn-sm btn-primary download-pdf" data-id="${repertoire.id}">PDF</button>
                        <button class="btn btn-sm btn-danger delete-repertoire" data-id="${repertoire.id}">Eliminar</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });

            // Eventos de botones
            document.querySelectorAll('.view-repertoire').forEach(btn => {
                btn.addEventListener('click', function() {
                    viewRepertoireDetails(this.getAttribute('data-id'));
                });
            });

            document.querySelectorAll('.download-pdf').forEach(btn => {
                btn.addEventListener('click', function() {
                    downloadRepertoirePDF(this.getAttribute('data-id'));
                });
            });

            document.querySelectorAll('.delete-repertoire').forEach(btn => {
                btn.addEventListener('click', function() {
                    deleteRepertoire(this.getAttribute('data-id'));
                });
            });
        });
}

function viewRepertoireDetails(repertoireId) {
    fetch(`/api/repertoire/${repertoireId}`)
        .then(response => response.json())
        .then(repertoire => {
            document.getElementById('detail-name').textContent = repertoire.name;
            document.getElementById('detail-date').textContent = repertoire.date_created;
            
            const songsList = document.getElementById('detail-songs');
            songsList.innerHTML = '';
            
            repertoire.songs.sort((a, b) => a.order - b.order).forEach((song, index) => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.innerHTML = `
                    <strong>${index + 1}.</strong> ${song.title} - ${song.artist}
                    <small class="text-muted d-block">${song.album} (${song.year}) - ${song.type}</small>
                `;
                songsList.appendChild(li);
            });
            
            const fastCount = repertoire.songs.filter(s => s.type === 'Rápida').length;
            const slowCount = repertoire.songs.filter(s => s.type === 'Lenta').length;
            
            document.getElementById('detail-stats').innerHTML = `
                <p>Total: ${repertoire.songs.length} canciones</p>
                <p>Rápidas: ${fastCount}</p>
                <p>Lentas: ${slowCount}</p>
            `;
            
            const detailModal = new bootstrap.Modal(document.getElementById('repertoireDetailModal'));
            detailModal.show();
        });
}

function downloadRepertoirePDF(repertoireId) {
    window.open(`/api/repertoire/${repertoireId}/pdf`, '_blank');
}

// ============== Funciones auxiliares ==============
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

function deleteRepertoire(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este repertorio?')) {
        fetch(`/api/repertoire/${id}`, { method: 'DELETE' })
            .then(response => {
                if (response.ok) {
                    showAlert('Repertorio eliminado correctamente', 'success');
                    loadRepertoires();
                } else {
                    showAlert('Error al eliminar repertorio', 'danger');
                }
            });
    }
}

function exportSongs() {
    window.open('/api/songs/export', '_blank');
}

// Exportar funciones para uso en HTML
window.updateSong = updateSong;
window.loadSongs = loadSongs;
window.addSong = addSong;
window.openEditModal = openEditModal;
window.deleteSong = deleteSong;
window.searchSongs = searchSongs;
window.addSongToRepertoire = addSongToRepertoire;
window.removeSongFromRepertoire = removeSongFromRepertoire;
window.saveRepertoire = saveRepertoire;
window.generatePDF = generatePDF;
window.loadRepertoires = loadRepertoires;
window.viewRepertoireDetails = viewRepertoireDetails;
window.downloadRepertoirePDF = downloadRepertoirePDF;