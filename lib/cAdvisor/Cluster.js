"use strict";
const co = require('co'),
	Node = require('./Node'),
	_ = require('lodash'),
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

	getAllContainerStats(namespace) {
		return co(function* () {
			// Get containers for our namespace
			const kubeNodes = yield new K8sCluster().getAllNodes({ externalIpOnly: true });
			const containers = _.flattenDeep(yield kubeNodes.map(node => node.getAllPods(namespace)));

			const statsNested = yield kubeNodes.map(node => co(function* () {
			  const pods = yield node.getAllPods(namespace);

				return pods.map(pod => co(function*() {
					const containerIds = yield pod.getContainerIds();
					const containerStats = yield containerIds.map(id => this.getContainerStats(id));

					return containerStats.map(stat => Object.assign({
						container: stat.labels['io.kubernetes.container.name'],
						namespace: pod.namespace,
						pod: pod.name
					}, condenseStats(stat)))
				}.bind(this)));
			}));

			// Grab stats for each container
			const statsPerContainer = yield containers.map(pod => co(function* () {
			  const containerIds = yield pod.getContainerIds();
				const containerStats = yield containerIds.map(id => this.getContainerStats(id));

				return containerStats.map(stat => Object.assign({
					container: stat.labels['io.kubernetes.container.name'],
					namespace: pod.namespace,
					pod: pod.name
				}, condenseStats(stat)))
			}.bind(this)));
			const stats = _.flattenDeep(statsPerContainer);

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
	const kubeNodes = yield new K8sCluster().getAllNodes({ externalIpOnly: true });
	const extNodeIps = yield kubeNodes.map((node) => node.getExternalIp());
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
