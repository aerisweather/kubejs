"use strict";
const exec = require('../util/exec-promise');
const Node = require('./Node'),
	ReplicationController = require('./ReplicationController');

class Cluster {

	/**
	 * @returns {Promise<Node[]>}
   */
	getAllNodes() {
		const cmd = `kubectl get nodes -o json`;

		return exec(cmd)
			.then(out => JSON.parse(out))
			.then(nodeJson => nodeJson.items
				.map(node => new Node(node.metadata.name))
			);
	}

	getAllResourceControllers(opts) {
		opts = Object.assign({}, opts);
		const cmd = `kubectl get rc -o json --all-namespaces`;

		return exec(cmd, {maxBuffer: 1024 * 500})
			.then(out => JSON.parse(out))
			.then(rcListJson => rcListJson.items
				.map(rcJson => {
					return new ReplicationController(rcJson.metadata.name, rcJson.metadata.namespace);
				})
			)
	}
}

module.exports = Cluster;

function filterAsync(array, filter) {
	return Promise
		.all(array.map(entry => filter(entry)))
		.then(bits => array.filter(entry => bits.shift()));
}