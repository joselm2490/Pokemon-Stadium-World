'use strict';

// Puerto dinámico asignado por Render (o 8000 por defecto)
exports.port = Number(process.env.PORT) || 8000;
exports.bindaddress = '0.0.0.0';
exports.wsdeflate = null;
exports.lazysockets = false;

// OPTIMIZACIÓN DE MEMORIA PARA PLANES GRATUITOS (512MB RAM):
// Deshabilitar subprocesos secundarios innecesarios para que todo corra
// en un solo proceso ligero por debajo de 150MB de RAM.
exports.subprocesses = 0;

exports.workers = 0;
exports.nogendata = false;

exports.backdoor = false;
exports.serverid = 'stadiumworld';
exports.servertoken = '';

exports.routes = {
	root: 'pokemonshowdown.com',
	client: 'play.pokemonshowdown.com',
	dex: 'dex.pokemonshowdown.com',
	replays: 'replay.pokemonshowdown.com',
};

exports.allowcreateuser = true;
exports.allowrename = true;
exports.registeredservers = false;
