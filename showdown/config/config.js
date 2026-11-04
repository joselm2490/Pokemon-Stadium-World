var Config = Config || {};

Config.version = "0.11.2";
Config.customcolors = {};
Config.bannedHosts = [];
Config.whitelist = [];

// CONEXIÓN DIRECTA A TU SERVIDOR PROPIO DE RENDER:
Config.defaultserver = {
	id: 'pokemon-showdown-server-ydnp',
	host: 'pokemon-showdown-server-ydnp.onrender.com',
	port: 443,
	httpport: 443,
	altport: 443,
	registered: true
};

Config.server = Config.defaultserver;

Config.routes = {
	root: 'pokemon-showdown-server-ydnp.onrender.com',
	client: (typeof window !== 'undefined' ? window.location.hostname : 'localhost'),
	dex: 'dex.pokemonshowdown.com',
	replays: 'replay.pokemonshowdown.com',
	users: 'pokemonshowdown.com/users',
	teams: 'teams.pokemonshowdown.com',
};
