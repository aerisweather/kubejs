"use strict";
const exec = require('../util/exec-promise');
const Node = require('./Node');

class Cluster {

	/**
	 * @param {Object} opts
	 * @param {Boolean} opts.externalIpOnly
	 * 				Only include nodes with external IPs.
	 * 			  Set to `true` to exclude the master node from results
	 *
	 * @returns {Promise<Node[]>}
   */
	getAllNodes(opts) {
		opts = Object.assign({
			externalIpOnly: false
		}, opts);
		const cmd = `kubectl get nodes -o json`;

		return exec(cmd)
			.then(out => JSON.parse(out))
			.then(nodeJson => nodeJson.items
				.map(node => {
					return new Node(node.metadata.name);
				})
			)
			.then(nodes => {
				if(opts.externalIpOnly) {
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