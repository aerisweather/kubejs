"use strict";
const exec = require('../util/exec-promise');
const Node = require('./Node');

class Cluster {

	getAllNodes() {
		const cmd = `kubectl get nodes -o json`;

		return exec(cmd)
			.then(out => JSON.parse(out))
			.then(nodeJson => nodeJson.items
				.map(node => {
					return new Node(node.metadata.name);
				})
			);
	}
}

module.exports = Cluster;