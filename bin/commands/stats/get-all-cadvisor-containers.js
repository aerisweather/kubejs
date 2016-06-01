#!/usr/bin/env node
const co = require('co');
const Cluster = require('../../../lib/Kubernetes/Cluster');
const CACluster = require('../../../lib/cAdvisor/Cluster');
const _ = require('lodash');

const cluster = new Cluster();

module.exports = function(namespace) {

	return co(function*() {
		const kubeNodes = yield cluster.getAllNodes(true);
		const extNodeIps = yield kubeNodes.map((node) => node.getExternalIp());
		const cAdvisorUrls = extNodeIps.map((externalIp) =>`http://${externalIp}:4194`);
		const cACluster = new CACluster(cAdvisorUrls);

		// Get containers for our namespace
		const containersPerNode = yield kubeNodes.map((node) => {
			return node.getAllPods(namespace);
		});

		// Alphabetical list of pods
		const pods = _.flatten(containersPerNode).sort((a, b) => {
			if (a.name < b.name) {
				return -1;
			}
			return 1;
		});

		const podStats = yield pods.map((pod) => {
			return pod.getContainerIds()
				.then((containerIds) => {
					return Promise.all(containerIds.map((containerId) => cACluster.getContainerStats(containerId)));
				})
				.then((containerStats) => {
					pod._stats = containerStats;
					return pod;
				})
		});

		podStats.map((pod) => {
			console.log(`${pod.name} (${pod.namespace})`);
			pod._stats.map((stats) => {
				const condensedStats = condenseStats(stats);
				console.log(`\t CPU: ${condensedStats.cpu.current}\tMemHot: ${formatMem(condensedStats.memory.hot)}\t MemTotal: ${formatMem(condensedStats.memory.total)}\n`);
			})
		});
	})
		.catch(err => console.error(err.stack));

	function condenseStats(cAdvisorContainerStats) {
		const latestStats = _.last(cAdvisorContainerStats.stats);
		return {
			cpu:    {
				current: latestStats.cpu.load_average
			},
			memory: {
				total: latestStats.memory.usage,
				hot:   latestStats.memory.working_set
			}
		}
	}
};

function formatMem(memInBytes) {
	return ""+(memInBytes / 1024 / 1024).toFixed(2) + 'M';
}