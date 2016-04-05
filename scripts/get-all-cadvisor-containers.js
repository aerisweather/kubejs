#!/usr/bin/env node
const co = require('co');
const Cluster = require('../lib/Kubernetes/Cluster');
const CACluster = require('../lib/cAdvisor/Cluster');
const _ = require('lodash');

const cluster = new Cluster();

cluster.getAllNodes()
	.then(nodes => {
		return Promise.all(nodes.map((node) => node.getExternalIp()));
	})
	.then(externalIps => {
		const cAdvisorUrls = externalIps.map((externalIp) =>`http://${externalIp}:4194`);
		return new CACluster(cAdvisorUrls);
	})
	// We now have a cAdvisor cluster to play with
	.then(cAdvisorCluster => {
		// Grab this ID from `kubectl get pod [pod]`.status.containerStatuses[0].containerID
		return cAdvisorCluster.getContainerStats('docker://37ea1257b3bf4e6edee31cab87c13505666ffd1baa64673bda9e2e5140ccb506');
	})
	.then(cAdvisorContainers => {
		console.log(JSON.stringify(cAdvisorContainers, null, 2))
	})
	.catch(err => {
		console.log(err.stack);
		console.log(JSON.stringify(err, null, 2));
	});

function condenseStats(cAdvisorContainerStats) {
	return {
		cpu: {

		}
	}
}