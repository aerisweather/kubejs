"use strict";
const exec = require('../util/exec-promise');
const Node = require('./Node');

class Cluster {

	getAllNodes(externalIpOnly) {
		if(externalIpOnly === undefined) externalIpOnly = false;
		const cmd = `kubectl get nodes -o json`;

		return exec(cmd)
			.then(out => JSON.parse(out))
			.then(nodeJson => nodeJson.items
				.map(node => {
					return new Node(node.metadata.name);
				})
			)
			.then(nodes => {
				if(externalIpOnly) {
					return filterAsync(nodes, (node) => node.getExternalIp());
				}
				return nodes;
			});
	}
}

module.exports = Cluster;

function filterAsync(array, filter) {
	return Promise
		.all(array.map(entry => filter(entry)))
		.then(bits => array.filter(entry => bits.shift()));
}