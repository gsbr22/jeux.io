const express = require('express');
const socketio = require('socket.io');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Configuration du jeu
const PORT = process.env.PORT || 3000;
const PLAYER_SPEED = 5;
const MAP_SIZE = 2000;
const ITEM_COUNT = 50;

// Données du jeu
const players = {};
const items = {};

// Générer des items aléatoires
function generateItems() {
  for (let i = 0; i < ITEM_COUNT; i++) {
    items[i] = {
      x: Math.floor(Math.random() * MAP_SIZE),
      y: Math.floor(Math.random() * MAP_SIZE),
      color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`
    };
  }
}

// Démarrer le jeu
generateItems();

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Route pour la page d'accueil
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
  console.log('Nouveau joueur connecté:', socket.id);
  
  // Créer un nouveau joueur
  players[socket.id] = {
    id: socket.id,
    x: Math.floor(Math.random() * MAP_SIZE),
    y: Math.floor(Math.random() * MAP_SIZE),
    color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
    score: 0,
    radius: 20
  };
  
  // Envoyer les données initiales au joueur
  socket.emit('init', { 
    playerId: socket.id, 
    players, 
    items, 
    mapSize: MAP_SIZE 
  });
  
  // Informer les autres joueurs
  socket.broadcast.emit('newPlayer', players[socket.id]);
  
  // Gérer les mouvements
  socket.on('move', (data) => {
    const player = players[socket.id];
    if (!player) return;
    
    // Mettre à jour la position
    if (data.direction === 'up') player.y -= PLAYER_SPEED;
    if (data.direction === 'down') player.y += PLAYER_SPEED;
    if (data.direction === 'left') player.x -= PLAYER_SPEED;
    if (data.direction === 'right') player.x += PLAYER_SPEED;
    
    // Garder le joueur dans la carte
    player.x = Math.max(0, Math.min(MAP_SIZE, player.x));
    player.y = Math.max(0, Math.min(MAP_SIZE, player.y));
    
    // Vérifier la collision avec les items
    for (const itemId in items) {
      const item = items[itemId];
      const dx = player.x - item.x;
      const dy = player.y - item.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < player.radius + 10) {
        // Collecter l'item
        player.score += 1;
        player.radius += 2;
        delete items[itemId];
        
        // Générer un nouvel item
        items[itemId] = {
          x: Math.floor(Math.random() * MAP_SIZE),
          y: Math.floor(Math.random() * MAP_SIZE),
          color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`
        };
        
        // Envoyer les mises à jour à tous les joueurs
        io.emit('itemCollected', {
          playerId: socket.id,
          itemId,
          newItem: items[itemId],
          playerScore: player.score,
          playerRadius: player.radius
        });
      }
    }
    
    // Envoyer la nouvelle position à tous les joueurs
    socket.broadcast.emit('playerMoved', {
      playerId: socket.id,
      x: player.x,
      y: player.y
    });
  });
  
  // Gérer la déconnexion
  socket.on('disconnect', () => {
    console.log('Joueur déconnecté:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Serveur en écoute sur http://localhost:${PORT}`);
});
