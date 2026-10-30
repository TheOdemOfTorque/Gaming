// Lumo - Spielbarkeit von Level 2-1 (Pass-Kriterien und Seed-Zahlen in helpers/jnr-spielbarkeit.js).
// Eigene Datei je Level, damit Jest die Level parallel prueft (Review n5, H4).
const { spielbarkeit } = require('./helpers/jnr-spielbarkeit.js');

spielbarkeit('2-1');
