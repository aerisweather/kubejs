"use strict";
const co = require('co'),
	Node = require('./Node'),
	_ = require('lodash'),
	filterAsync = require('../util/filter-async'),
	K8sPod = require('../../lib/Kubernetes/Pod'),
  K8sCluster = require('../../lib/Kubernetes/Cluster');


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
		return co(function* () {
			const nodeResults = yield this.nodes.map(n =>
				n.getContainerByContainerId(containerId, namespace)
			);
			const results = nodeResults.filter(result => result !== null);

			if(results.length === 1) {
				return results[0];
			}
			return null;
		}.bind(this));
	}

	getAllContainerStats(namespace) {
		return co(function* () {
			const podsJson = yield new K8sCluster().getAllPodsJson(namespace);
			const statsNested = yield podsJson.map(podJson => co(function*() {
				try {
					const containerIds = K8sPod.getContainerIds(podJson);
					const containerStats = yield containerIds.map(id => this.getContainerStats(id));

					return containerStats
						.filter(Boolean)
						.map(stat => Object.assign({
							container: stat.labels['io.kubernetes.container.name'],
							namespace: podJson.metadata.namespace,
							pod: podJson.metadata.name,
							node: podJson.spec.nodeName
						}, condenseStats(stat)));
				}
				catch (err) {
					console.error(`Failed to get stats for ${podJson.metadata.namespace} on ${podJson.spec.nodeName}: \n ${err.stack}`);
					return [];
				}
			}.bind(this)));

			return _.flattenDeep(statsNested);
		}.bind(this));
	}

	getClusterStats(namespace) {
		return co(function* () {
		  const stats = yield this.getAllContainerStats(namespace);

			return {
				container: 'Total',
				namespace: '-',
				podCount: stats.length,
				cpu: {
					current: _.sumBy(stats, 'cpu.current')
				},
				memory: {
					hot: _.sumBy(stats, 'memory.hot'),
					total: _.sumBy(stats, 'memory.total')
				}
			};
		}.bind(this));
	}
}

Cluster.fromKubernetesCluster = () => co(function* () {
	const kubeNodes = yield new K8sCluster().getAllNodes();
  const kubeNodesWithCa = yield filterAsync(kubeNodes, n => n.hasCAdvisor());

	return Cluster.fromKubernetesNodes(kubeNodesWithCa);
});

Cluster.fromKubernetesNodes = (nodes) => co(function*() {
	const extNodeIps = yield nodes.map((node) => node.getExternalIp());
	const cAdvisorUrls = extNodeIps.map((externalIp) =>`http://${externalIp}:4194`);

	return new Cluster(cAdvisorUrls);
});

function condenseStats(containerStats) {
	const firstRecord = _.first(containerStats.stats);
	const lastRecord = _.last(containerStats.stats);
	const nanoInterval = 1e6 * (new Date(lastRecord.timestamp) - new Date(firstRecord.timestamp));
	// See https://github.com/google/cadvisor/issues/832
	const cpuUsage = (lastRecord.cpu.usage.total - firstRecord.cpu.usage.total) / nanoInterval;

	return {
		cpu: {
			current: cpuUsage
		},
		memory: {
			total: lastRecord.memory.usage,
			hot: lastRecord.memory.working_set
		}
	}
}


module.exports = Cluster;
