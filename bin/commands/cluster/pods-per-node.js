#!/usr/bin/env node
const co = require('co');
const columnify = require('columnify');
const Cluster = require('../../../lib/Kubernetes/Cluster');
const _ = require('lodash');

const cluster = new Cluster();

cluster.getAllNodes(true)
	.then(nodes => co(function* () {
		return yield nodes.reduce((nodePods, node) => Object.assign(nodePods, {
			[node.name]: node.getAllPods()
		}), {})
	}))
	.then(nodePods => {
		// Display
		_.forEach(nodePods, (pods, nodeName) => {
			console.log(`${nodeName} (${pods.length} Running Pods)`);
			const podData = pods.map(pod => ({namespace:pod.namespace, name: pod.name, status: pod.status}));
			const columnifiedOutput = columnify(podData, {
				columnSplitter: "\t"
			});
			console.log(`\t${columnifiedOutput.split("\n").join("\n\t")}\n`);
		});
	})
	.catch(err => console.log(err.stack));