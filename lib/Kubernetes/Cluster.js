"use strict";
const exec = require('../util/exec-promise');
const Node = require('./Node'),
	ReplicationController = require('./ReplicationController');

class Cluster {

	/**
	 * @returns {Promise<Node[]>}
   */
	getAllNodes() {
		return this.getAllNodesJson()
			.then(json => json.map(node => new Node(node.metadata.name)));
	}

	getAllNodesJson() {
		const cmd = `kubectl get nodes -o json`;

		return exec(cmd)
			.then(out => JSON.parse(out).items);
	}

	getAllPodsJson(namespace) {
		const namespaceSelector = namespace === undefined ?
			'--all-namespaces' : `--namespace=${namespace}`;
		const cmd = `kubectl get pods ${namespaceSelector} -o json`;

		return exec(cmd, {maxBuffer: 5* 1024 * 1024})
			.then(out => JSON.parse(out).items);
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