#!/usr/bin/env node
const co = require('co');
const Cluster = require('../../../lib/Kubernetes/Cluster');
const CACluster = require('../../../lib/cAdvisor/Cluster');
const _ = require('lodash');
const columnify = require('columnify');

const cluster = new Cluster();

module.exports = function(opts) {
	return co(function*() {
		const cACluster = yield CACluster.fromKubernetesCluster();
		const stats = yield cACluster.getAllContainerStats(opts.namespace);

		const aggrStats = _.values(_.groupBy(stats, s => s.container + s.namespace))
			.map(statsInContainer => ({
				container: statsInContainer[0].container,
				namespace: statsInContainer[0].namespace,
				podCount: statsInContainer.length,
				cpu: {
					current: _.sumBy(statsInContainer, 'cpu.current')
				},
				memory: {
					hot: _.sumBy(statsInContainer, 'memory.hot'),
					total: _.sumBy(statsInContainer, 'memory.total')
				}
			}));

		const totalStats = {
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
		const sortedAggrStats = _.sortBy(aggrStats, s => s.cpu.current * -1)
			.concat(totalStats);
		const aggrCols = sortedAggrStats.map(stat => ({
			'Container': stat.container,
			'NS': stat.namespace,
			'CPU': formatCpu(stat.cpu.current),
			'Mem Hot': formatMem(stat.memory.hot),
			'Mem Total': formatMem(stat.memory.total),
			'Count': stat.podCount
		}));

		return console.log(columnify(aggrCols, { columnSplitter: '   ' }));
	})
		.catch(err => console.error(err.stack));

	function condenseStats(containerStats) {
		const firstRecord = _.first(containerStats.stats);
		const lastRecord = _.last(containerStats.stats);
		const nanoInterval = 1e6 * (new Date(lastRecord.timestamp) - new Date(firstRecord.timestamp));
		// See https://github.com/google/cadvisor/issues/832
		const cpuUsage = (lastRecord.cpu.usage.total - firstRecord.cpu.usage.total) / nanoInterval;

		return {
			cpu:    {
				current: cpuUsage
			},
			memory: {
				total: lastRecord.memory.usage,
				hot: lastRecord.memory.working_set
			}
		}
	}
};

function formatCpu(cpuAsPercent) {
	return (cpuAsPercent*100).toFixed((2))+'%';
}

function formatMem(memInBytes) {
	const memInGi = memInBytes / 1024 / 1024 / 1024;

	return `${memInGi.toFixed(2)} Gi`;
}