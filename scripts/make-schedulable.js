#!/usr/bin/env node
const co = require('co');
const Node = require('../lib/Kubernetes/Node');


const nodeName = process.argv[2];
if (!nodeName) { throw new Error('Missing node name arguments'); }

const node = new Node(nodeName);

node.makeSchedulable()
	.then(() => {
		process.exit(0);
	}, (err) => {
		console.error(err.name, err.stack);
		process.exit(1);
	});