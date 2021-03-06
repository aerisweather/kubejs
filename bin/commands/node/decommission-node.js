#!/usr/bin/env node
const co = require('co');
const Node = require('../../../lib/Kubernetes/Node');

module.exports = function decommissionNode(nodeName) {
	const node = new Node(nodeName);

	return node.evacuate();
};


