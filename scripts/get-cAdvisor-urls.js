#!/usr/bin/env node
const co = require('co');
const Cluster = require('../lib/Kubernetes/Cluster');
const _ = require('lodash');

const cluster = new Cluster();

cluster.getAllNodes()
	.then(nodes => {
		return Promise.all(nodes.map((node) => node.getExternalIp()));
	})
	.then(externalIps => {
		externalIps.map((externalIp) => console.log(`http://${externalIp}:4194`));
	})
	.catch(err => console.log(err.stack));