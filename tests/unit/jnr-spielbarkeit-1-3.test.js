// Lumo - Spielbarkeit von Level 1-3 (Pass-Kriterien und Seed-Zahlen in helpers/jnr-spielbarkeit.js).
// Eigene Datei je Level, damit Jest die Level parallel prueft (Review n5, H4).
const { spielbarkeit } = require('./helpers/jnr-spielbarkeit.js');

spielbarkeit('1-3');
