const native = require('@proceed/native');
const Nfs = require('@proceed/native-fs');
const Nexpress = require('@proceed/native-express');
const Nconfig = require('@proceed/native-config');
const Nmachine = require('@proceed/native-machine');
const Nmdns = require('@proceed/native-mdns');
const Ncapabilities = require('@proceed/native-capabilities');
const Nconsole = require('@proceed/native-console');
const NScriptExecution = require('@proceed/native-script-execution');
const NMQTT = require('@proceed/native-mqtt');

native.registerModule(new Nfs());
native.registerModule(new Nexpress());
native.registerModule(new Nconfig());
native.registerModule(new Nmachine());
native.registerModule(new Nmdns());
native.registerModule(new Ncapabilities());
native.registerModule(new Nconsole());
native.registerModule(new NScriptExecution());
native.registerModule(new NMQTT());

native.startEngine({ childProcess: false });
