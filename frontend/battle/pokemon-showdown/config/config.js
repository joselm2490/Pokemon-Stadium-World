'use strict';

// Puerto dinámico asignado por Render (o 10000 por defecto para Render)
exports.port = Number(process.env.PORT) || 10000;
exports.bindaddress = '0.0.0.0';
exports.wsdeflate = null;
exports.lazysockets = false;

// OPTIMIZACIÓN DE MEMORIA PARA PLANES GRATUITOS (512MB RAM):
// Deshabilitar subprocesos secundarios innecesarios para que todo corra
// en un solo proceso ligero por debajo de 150MB de RAM.
exports.subprocesses = 0;
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

// Health check para Render y otros servicios de hosting en la nube
exports.customhttpresponse = function (req, res) {
	if (req.url === '/healthz' || req.url === '/health' || req.url === '/') {
		res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
		res.end('OK');
		return true;
	}
	return false;
};

