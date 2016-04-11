"use strict";
const co = require('co'),
	Node = require('./Node'),
	_ = require('lodash');

/**
 * A Cluster of cAdvisor instances. Provides methods to find a container, no matter what host it's on.
 */
class Cluster {

	constructor(nodeUrls) {
		this.nodes = nodeUrls.map(nodeUrl => new Node(nodeUrl));
	}

	/**
	 *
	 * @param {string} [namespace="system.slice"] - The namespace to query for this container
	 * @returns {Promise.<T>}
	 */
	getAllContainers(namespace) {
		namespace = (namespace === undefined) ? 'system.slice' : namespace;
		return Promise.all(
			this.nodes.map((node) => co(function* () {
				const containers = yield node.getContainers(namespace);
				return {
					host:       node.url,
					containers: containers
				}
			}))
			)
			.then((hostContainerResults) => {
				return hostContainerResults.reduce((prev, hostResult) => {
					prev[hostResult.host] = hostResult.containers;
					return prev;
				}, {});
			});
	}

	/**
	 * Find the container in the cluster and return the stats for it.
	 * @param containerId - The containerId as a sha1 hash
	 * @param {string} [namespace="system.slice"] - The namespace to query for this container
	 */
	getContainerStats(containerId, namespace) {
		return Promise.all(
			this.nodes.map((node) => {
				return node.getContainerByContainerId(containerId, namespace)
			})
		)
		.then(nodeResults => {
			const results = nodeResults.filter(result => result !== null);
			if(results.length === 1) {
				return results[0];
			}
			return null;
		})
	}
}

module.exports = Cluster;
